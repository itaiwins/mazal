-- Mazal - Match the table grants held by `anon` and `authenticated` to the RLS policies
--
-- Fixes MEXA-274, the table-by-table half that 00014 deliberately left out.
-- Rollback: supabase/rollback/00016_client_role_write_privileges_rollback.sql
-- Apply AFTER 00014, which is already applied live (2026-09-28 23:36Z). Independent of
-- 00013 and 00015: 00013 narrows what `authenticated` may *read* from `public.users` by
-- column, 00015 what it may *write* by column, while this file takes `users` DELETE from
-- `authenticated` and every verb from `anon`. Disjoint verbs, so any order works.
--
-- ===================================================================================
-- WHAT THIS IS ABOUT
-- ===================================================================================
--
-- 00014 took TRUNCATE, TRIGGER, REFERENCES and MAINTAIN away from both client roles on
-- every table in `public`, plus UPDATE and DELETE on `reports`. It left `arwd` -
-- INSERT/SELECT/UPDATE/DELETE - alone everywhere else, because that is the surface the 88
-- RLS policies are written against, and said the rest needed a table-by-table argument.
--
-- This is that argument. Walking `pg_policies` against the four verbs on
-- `tayiyczmacvhokdxfqvm` gave 48 (table, verb) pairs where both client roles hold the
-- verb and NO policy admits any row for it. 00014 has since been applied live and took
-- two of them (`reports` UPDATE and DELETE), so **46 remain** and this file is written
-- against that number - re-measured after the apply, with `reports` now at `anon=ar,
-- authenticated=ar` and every table at `arwd` rather than `arwdDxtm`.
--
-- RLS makes those 46 no-ops today. They still matter, and Alucard's MEXA-275 review of
-- 00014 sharpened why: the loud case is a policy arriving without a grant, which fails
-- 42501 the first time anyone tests it. The quiet case is the one still standing here - a
-- verb granted with no policy, inert until someone adds a permissive policy and opens the
-- standing grant along with it, with nothing to notice.
--
-- ===================================================================================
-- THE RULE THIS FILE APPLIES
-- ===================================================================================
--
-- Not "revoke every verb with no policy". Those 48 pairs are not one thing. Reading each
-- one against the client code splits them three ways, and only the first two are grants:
--
--   (1) NO CLIENT PATH, AND NONE INTENDED. The writes belong to service_role - an Edge
--       Function, the RevenueCat webhook, a trigger - or to nobody at all because the
--       feature was never built. Revoked here. The table comment says so.
--
--   (2) A DELIBERATE INTEGRITY DECISION. A swipe is a fact, a match is deactivated
--       rather than deleted, a profile row outlives the session that made it. Revoked
--       here, and the table comment records the decision so the next person does not
--       quietly undo it by adding a policy.
--
--   (3) A MISSING POLICY BEHIND LIVE CODE. The client really does issue that verb and
--       RLS really does refuse it, so the feature is broken right now. The fix is a
--       policy, not a revoke, and revoking would only bury the bug one layer deeper.
--       LEFT GRANTED ON PURPOSE. Four pairs, listed in section 4, each with an issue.
--
-- Group (3) is why this file is not one sweeping REVOKE. Finding it is the main result
-- of MEXA-274: three product features - mutual matching, safta likes, shidduch
-- suggestions - are dead on the live database, and the grant audit is what surfaced them.
--
-- Section 5 does the same thing for sequences, which 00014 spotted and handed here.
--
-- ===================================================================================
-- MEASURED ON THE LIVE PROJECT, BEFORE THIS MIGRATION
-- ===================================================================================
--
-- All of the below ran inside `begin … rollback` on `tayiyczmacvhokdxfqvm` as the real
-- `authenticated` and `anon` roles with `request.jwt.claims` set, against two seeded
-- users. Nothing was left behind.
--
--   As `authenticated`, user A, after user B had already liked A:
--     INSERT INTO swipes (A likes B)        -> succeeded, and matches ended with 0 rows
--     the `check_for_match` EXISTS, as A    -> mutual_like = FALSE
--     INSERT INTO matches                   -> 42501, no INSERT policy
--     INSERT INTO user_safta_stats          -> 42501, no INSERT policy
--     UPDATE matches SET last_message_at    -> 1 row (the one invoker trigger that works)
--     DELETE FROM swipes WHERE mine         -> no error, 0 rows deleted
--     DELETE FROM messages WHERE mine       -> no error, 0 rows deleted
--     INSERT INTO notification_queue        -> 42501, no policy at all
--
--   As `anon`:
--     SELECT FROM users (2 rows present)    -> 0 rows
--     INSERT INTO users                     -> 42501
--     SELECT FROM colleges (1 row)          -> 1 row
--     SELECT FROM user_badges (1 row)       -> 1 row
--
-- ===================================================================================
-- 1. `anon` LOSES EVERY TABLE PRIVILEGE IN `public`
-- ===================================================================================
--
-- MEXA-274 asked whether `anon` needs table access at all. It does not, and the one path
-- that might have justified keeping it turned out to be a bug rather than a use.
--
-- Every policy in this schema is either keyed on `auth.uid()` or scoped `TO
-- authenticated`. For `anon`, `auth.uid()` is NULL, so every uid-keyed policy admits
-- nothing. Three SELECT policies are `USING (true) TO public`, which does include `anon`:
-- `colleges`, `user_badges` and `user_safta_stats`. Those are the only rows `anon` can
-- reach today, and losing them is the only behaviour change in this section:
--
--   colleges          - reference data. No screen reads it; the only mentions outside the
--                       generated types are a query key and a help page string.
--   user_badges       - every user's badges, readable by anyone holding the anon key.
--                       The app reads it from the profile screens, all behind auth.
--   user_safta_stats  - every user's safta-like counter, same exposure, same conclusion.
--
-- The anon key is not a secret: it ships in every app binary, and this repo's git history
-- contains the old project's copy. `USING (true) TO public` means "the whole internet",
-- which is not what any of those three policies meant.
--
-- THE PROFILE-INSERT QUESTION, SETTLED. With email confirmations on, `signUp` returns no
-- session, so a `public.users` insert at that moment would run as `anon`. It does not
-- happen. `useCreateProfile` (src/api/mutations/useProfile.ts:19) is exported from the
-- barrel and called from nowhere. The profile row is written in onboarding, by
-- `app/(onboarding)/complete.tsx`, and only after `supabase.auth.getUser()` has returned
-- a user - with no session the app stops at "check your email" and never reaches
-- onboarding. So the insert always runs as `authenticated`, and the `users` INSERT policy
-- (`auth.uid() = auth_id`) is satisfiable.
--
-- Two anon-shaped paths did turn up, and both are already broken, which is the finding:
--
--   a) src/api/supabase/directApi.ts:70 falls back to `Bearer SUPABASE_ANON_KEY` when the
--      AsyncStorage token read times out, so `insertUser` can run as `anon`. Measured:
--      42501. Today that surfaces as "could not save your profile" instead of "you are
--      not signed in". Filed - see section 4.
--   b) app/(orthodox-auth)/register.tsx:92 reads `users` and `orthodox_emails` before
--      sign-up to tell you an email is taken. As `anon` both return nothing, so the check
--      always passes. It has to stay that way: making it work would hand anyone with the
--      anon key an email-enumeration oracle. Filed - see section 4.
--
-- Nothing else in `src/` or `app/` touches a table before a session exists.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;

-- And on every table created from here on. Same known limit as 00014 section 2: only the
-- `postgres`-owned `pg_default_acl` entry is ours to change, and that is the one that
-- governs tables created by migrations and by the dashboard SQL editor.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;

-- `anon` keeps USAGE on schema `public` and its function grants. This is about tables.
-- PostgREST itself connects as `authenticator` and switches roles, so it is unaffected;
-- an unauthenticated request still reaches PostgREST, it now gets 42501 on any table
-- instead of an empty result set.

-- ===================================================================================
-- 2. `notification_queue` BECOMES service_role ONLY
-- ===================================================================================
--
-- The one table in the list with no policy at all, for any verb, while granting all four
-- to both client roles. RLS was doing 100% of the work and nothing was written down.
--
-- Who actually writes it: the four SECURITY DEFINER notification triggers
-- (`notify_new_match`, `notify_new_message`, `notify_super_like`, `notify_safta_like`),
-- which run as `postgres` and so pass both RLS and the grant regardless.
-- Who reads it: `supabase/functions/send-notification`, with the service-role key.
-- Who else: nothing in `src/` or `app/` mentions the table.
--
-- Modelled on how 00011 handles `deleted_accounts` and `moderation_secrets`: state the
-- intent as a grant, not as an absence of policies.
REVOKE ALL PRIVILEGES ON TABLE public.notification_queue FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.notification_queue TO service_role;

COMMENT ON TABLE public.notification_queue IS
  'Outbound push queue. service_role only (MEXA-274): written by the SECURITY DEFINER '
  'notify_* triggers, drained by the send-notification Edge Function. It has no RLS policy '
  'for any verb, and that is deliberate - the grant, not the missing policy, is what keeps '
  'clients out. If a client ever needs to read its own notifications, add a SELECT policy '
  'AND a GRANT SELECT in the same migration.';

-- ===================================================================================
-- 3. `authenticated` LOSES THE VERBS WHOSE ABSENCE IS A DECISION
-- ===================================================================================
--
-- Group (1) and group (2) from the rule above. Each REVOKE is followed by the reason it
-- is safe, checked against `src/`, `app/` and `supabase/functions/`.
--
-- The three Edge Functions all build their client with SUPABASE_SERVICE_ROLE_KEY
-- (delete-account/index.ts:77-79 and the same shape in the other two), so none of the
-- deletes below are theirs to lose.

-- --- Reference and config data. Rows come from migrations or an admin, never a client.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.colleges           FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.community_settings FROM authenticated;
REVOKE INSERT, DELETE         ON TABLE public.shadchanim         FROM authenticated;
-- shadchanim keeps UPDATE: it has an UPDATE policy (a shadchan editing their own row).

-- --- Written by service_role only.
-- subscriptions is the RevenueCat webhook's table. The client reads its own row through
-- the one SELECT policy and never writes; nothing in src/ or app/ references it at all.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscriptions FROM authenticated;

-- --- Append-only by design: the row is the record of an event.
-- A swipe is a fact about what someone did. `useUndoSwipe` (src/api/mutations/useSwipe.ts:140)
-- exists but is exported from the barrel and called from no screen, and measured live it
-- deletes 0 rows while reporting success. Revoking turns that silent lie into 42501.
-- To build Rewind for real: add a DELETE policy AND `GRANT DELETE ON swipes TO authenticated`
-- in the same migration.
--   **Superseded by 00025 (MEXA-314), and this REVOKE is deliberately unchanged.** Rewind
--   was built the other way: `public.undo_last_swipe()`, a SECURITY DEFINER function that
--   checks ownership, the 30-second window and "has this pair already matched" in one
--   place. So the client never deletes from this table, `authenticated` does not need the
--   grant back, and section 7b below keeps asserting it is gone. Only the comment text in
--   section 5 changed, to stop sending the next reader after a DELETE policy.
REVOKE UPDATE, DELETE ON TABLE public.swipes                 FROM authenticated;
REVOKE UPDATE, DELETE ON TABLE public.shidduch_profile_views FROM authenticated;
REVOKE UPDATE         ON TABLE public.blocks                 FROM authenticated;
-- blocks keeps INSERT and DELETE - block and unblock, both with policies (useMatch.ts:77,133).
-- Editing a block is not a thing.

-- --- Deactivated, never deleted. Each of these has a live "soft delete" path that is an
-- --- UPDATE, so DELETE is not just unused, it is the wrong verb.
REVOKE DELETE ON TABLE public.matches           FROM authenticated;  -- unmatch = UPDATE is_active (useMatch.ts:42,101)
REVOKE DELETE ON TABLE public.safta_accounts    FROM authenticated;  -- useProfile.ts:287 sets is_active = false
REVOKE DELETE ON TABLE public.shidduch_profiles FROM authenticated;  -- delete-account/index.ts:193 updates it
REVOKE DELETE ON TABLE public.users             FROM authenticated;  -- delete-account/index.ts:217, service_role

-- --- No policy, no client code, feature not built.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.family_connections FROM authenticated;
REVOKE DELETE ON TABLE public.notification_preferences FROM authenticated;
REVOKE DELETE ON TABLE public.safta_connections        FROM authenticated;
REVOKE DELETE ON TABLE public.safta_daily_usage        FROM authenticated;
REVOKE DELETE ON TABLE public.safta_likes              FROM authenticated;
REVOKE DELETE ON TABLE public.safta_messages           FROM authenticated;
REVOKE DELETE ON TABLE public.shadchan_connections     FROM authenticated;
REVOKE DELETE ON TABLE public.shadchan_recommendations FROM authenticated;
REVOKE DELETE ON TABLE public.shidduch_suggestions     FROM authenticated;

-- messages DELETE. `useDeleteMessage` (src/api/mutations/useMessage.ts:122) is in the
-- same position as `useUndoSwipe`: exported, wired to nothing, and measured live it
-- deletes 0 rows while returning no error. Deleting a message in a two-person thread is a
-- product decision nobody has made. Same instruction as swipes if it is ever made: policy
-- and grant together.
REVOKE DELETE ON TABLE public.messages FROM authenticated;

-- shidduch_messages. SELECT has a policy; INSERT, UPDATE and DELETE do not, and there is
-- no send path anywhere in the client - the only reference is the service_role cleanup in
-- delete-account/index.ts:188. The shidduch surface is being hidden behind a flag anyway
-- (docs/ROADMAP.md). Whoever builds shidduch messaging writes the policies and the grants
-- in one migration.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.shidduch_messages FROM authenticated;

-- user_safta_stats. Counters, maintained by the `update_safta_stats` trigger on
-- safta_likes. That trigger is SECURITY INVOKER, so its INSERT ... ON CONFLICT runs as the
-- liker and hits 42501 - measured - which aborts the whole like. The fix is to make the
-- trigger SECURITY DEFINER (filed, section 4), after which it runs as `postgres` and needs
-- neither this grant nor a policy. So the grant is dead either way.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_safta_stats FROM authenticated;

-- `reports` UPDATE and DELETE are 00014 section 3, not repeated here.

-- ===================================================================================
-- 4. WHAT IS DELIBERATELY LEFT GRANTED, AND WHY
-- ===================================================================================
--
-- Group (3). These four (table, verb) pairs have no policy AND live client code behind
-- them. Each is a broken feature whose fix is a policy; revoking would change the error
-- message and nothing else, and would make the eventual fix a two-part migration for no
-- reason. The grants stay so that adding the policy is all it takes.
--
--   matches INSERT              src/api/mutations/useSwipe.ts:66 and, worse, the
--                               `check_for_match` trigger body. Mutual matching is dead.
--   safta_likes UPDATE          src/features/safta/hooks/useSaftaRecommendations.ts:166
--   shidduch_suggestions INSERT src/services/matchingService.ts:602
--   shidduch_suggestions UPDATE app/(shidduch-tabs)/index.tsx:483
--
-- Two more findings from the same pass, neither a grant question, both filed:
--   - `check_for_match` is SECURITY INVOKER, so its mutual-like EXISTS runs under the
--     `swipes` SELECT policy (`swiper_id = me`) and can never see the other person's like.
--     Measured: mutual_like = FALSE with the other swipe sitting right there. Even with a
--     matches INSERT policy, matching stays broken until this is SECURITY DEFINER.
--   - `update_safta_stats`, same shape, same fix.
--   - directApi.ts's anon-key fallback, and the orthodox register email-exists check.
--
-- The issue numbers are on MEXA-274. This file does not try to fix any of them: they are
-- policy and application changes, and a privilege migration is the wrong place for both.

-- ===================================================================================
-- 5. SEQUENCES, THE SAME STOCK DEFAULT ONE LAYER DOWN
-- ===================================================================================
--
-- 00014's review (MEXA-275) recorded this against MEXA-274, so it is settled here.
--
-- `pg_default_acl` hands `anon=rwU` - SELECT, UPDATE, USAGE - on every new sequence in
-- `public`, to both client roles, from both the `postgres` and the `supabase_admin` entry.
-- USAGE on a sequence means `nextval()`, and UPDATE means `setval()`: a client role could
-- wind a sequence backwards and make the next insert collide, or burn through its range.
--
-- There are **no sequences in `public` today** - every table takes its id from
-- `uuid_generate_v4()` or `gen_random_uuid()`, and nothing uses `serial` or `IDENTITY`.
-- So the REVOKE below is a no-op and the ALTER DEFAULT PRIVILEGES is the whole point: it
-- means the first `serial` column anyone adds does not quietly hand `anon` `setval()`.
--
-- Same known limit as 00014 section 2: the `supabase_admin`-owned default ACL entry is not
-- ours to change (the pooler role is not a member of `supabase_admin`), and it only governs
-- objects created by `supabase_admin`, which is not how any migration here runs.
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;

-- `anon` only, deliberately. `authenticated` keeps `rwU` because a `serial` column's
-- default is `nextval('…')`, and Postgres evaluates a column default with the privileges of
-- the **inserting** role, not the table owner - so revoking USAGE from `authenticated` would
-- break INSERT into the first `serial` table anyone adds, in a way that reads as an
-- unrelated "permission denied for sequence". That is a trap worth not setting.
--
-- The narrower fix, if `setval()` ever needs taking away from clients: use
-- `GENERATED ALWAYS AS IDENTITY` rather than `serial`. An identity column's sequence is
-- owned by the column and needs no grant on the caller's side at all, which makes
-- `REVOKE ALL ON SEQUENCES FROM authenticated` safe. Worth doing when the first such table
-- appears; there is nothing to fix until then.
--
-- `service_role` keeps its sequence privileges, same as everywhere else in 00011/00014/00016.

-- ===================================================================================
-- 6. THE DECISION, WRITTEN ON THE TABLES
-- ===================================================================================
--
-- MEXA-274 asked for a comment on every table saying which category it is in, so that the
-- next person reading `\d+` sees the argument and not just the ACL.
COMMENT ON TABLE public.subscriptions IS
  'RevenueCat entitlements. service_role writes, clients read their own row (MEXA-274). '
  'INSERT/UPDATE/DELETE revoked from authenticated: no policy, no client code, and a client '
  'that could write here could grant itself premium.';
COMMENT ON TABLE public.swipes IS
  'Append-only record of a swipe (MEXA-274). authenticated holds INSERT and SELECT only. '
  'Rewind goes through public.undo_last_swipe(), a SECURITY DEFINER function added by '
  '00025 (MEXA-314), so this grant can stay revoked. Do not add a DELETE policy or a '
  'client DELETE grant here.';
COMMENT ON TABLE public.matches IS
  'A match is deactivated (is_active = false), never deleted - DELETE revoked from '
  'authenticated (MEXA-274). INSERT is still granted on purpose: there is no INSERT policy, '
  'so mutual matching is broken today, and the fix is the policy (see MEXA-274).';
COMMENT ON TABLE public.messages IS
  'DELETE revoked from authenticated (MEXA-274): no DELETE policy, and useDeleteMessage is '
  'wired to no screen. Deleting a message from a two-person thread is an unmade product '
  'decision; making it needs a policy and a grant together.';
COMMENT ON TABLE public.user_safta_stats IS
  'Per-user safta-like counters, maintained by the update_safta_stats trigger on safta_likes '
  '(MEXA-274). Client writes revoked; the trigger must become SECURITY DEFINER, which needs '
  'neither grant nor policy. SELECT is USING (true) - it is a public counter by design, but '
  'only for authenticated now, not anon.';
COMMENT ON TABLE public.shidduch_messages IS
  'Shidduch thread messages. authenticated holds SELECT only (MEXA-274): no send path exists '
  'in the client and the surface is behind a flag. Building it means policies and grants in '
  'one migration.';
COMMENT ON TABLE public.colleges IS
  'Reference data, seeded by migration (MEXA-274). Read-only to authenticated, unreachable '
  'by anon. The SELECT policy is USING (true) TO public, which is why the grant, not the '
  'policy, is what now keeps anon out.';
COMMENT ON TABLE public.user_badges IS
  'Badges, readable by any signed-in user (USING (true)) so they can be shown on profiles. '
  'Unreachable by anon since MEXA-274 - the anon key ships in the app binary, so TO public '
  'meant the whole internet.';

-- ===================================================================================
-- 7. FAIL THE MIGRATION IF ANY OF IT DID NOT TAKE
-- ===================================================================================
--
-- Same reasoning as 00014 section 4: a REVOKE that hits nothing is silent, so the only
-- way to know this file did its job is to ask the catalog afterwards. `has_table_privilege`
-- rather than information_schema, because it folds in PUBLIC and role membership.
DO $$
DECLARE
  v_rows TEXT;
  v_expected CONSTANT TEXT[][] := ARRAY[
    ['blocks','UPDATE'],
    ['colleges','INSERT'],['colleges','UPDATE'],['colleges','DELETE'],
    ['community_settings','INSERT'],['community_settings','UPDATE'],['community_settings','DELETE'],
    ['family_connections','INSERT'],['family_connections','UPDATE'],['family_connections','DELETE'],
    ['matches','DELETE'],
    ['messages','DELETE'],
    ['notification_preferences','DELETE'],
    ['notification_queue','INSERT'],['notification_queue','SELECT'],
    ['notification_queue','UPDATE'],['notification_queue','DELETE'],
    ['safta_accounts','DELETE'],
    ['safta_connections','DELETE'],
    ['safta_daily_usage','DELETE'],
    ['safta_likes','DELETE'],
    ['safta_messages','DELETE'],
    ['shadchan_connections','DELETE'],
    ['shadchan_recommendations','DELETE'],
    ['shadchanim','INSERT'],['shadchanim','DELETE'],
    ['shidduch_messages','INSERT'],['shidduch_messages','UPDATE'],['shidduch_messages','DELETE'],
    ['shidduch_profile_views','UPDATE'],['shidduch_profile_views','DELETE'],
    ['shidduch_profiles','DELETE'],
    ['shidduch_suggestions','DELETE'],
    ['subscriptions','INSERT'],['subscriptions','UPDATE'],['subscriptions','DELETE'],
    ['swipes','UPDATE'],['swipes','DELETE'],
    ['user_safta_stats','INSERT'],['user_safta_stats','UPDATE'],['user_safta_stats','DELETE'],
    ['users','DELETE']
  ];
  i INTEGER;
BEGIN
  -- 7a. anon holds nothing on any table in public.
  SELECT string_agg(c.relname || ':' || p.priv, ', ' ORDER BY c.relname, p.priv)
    INTO v_rows
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   CROSS JOIN (VALUES ('INSERT'),('SELECT'),('UPDATE'),('DELETE'),
                      ('TRUNCATE'),('TRIGGER'),('REFERENCES'),('MAINTAIN')) AS p(priv)
   WHERE c.relkind IN ('r','p','v','m')
     AND has_table_privilege('anon', c.oid, p.priv);
  IF v_rows IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-274: anon still holds table privileges: %', v_rows;
  END IF;

  -- 7b. every revoke in section 3 actually landed for authenticated.
  v_rows := NULL;
  FOR i IN 1 .. array_length(v_expected, 1) LOOP
    IF has_table_privilege('authenticated',
                           ('public.' || quote_ident(v_expected[i][1]))::regclass,
                           v_expected[i][2]) THEN
      v_rows := concat_ws(', ', v_rows, v_expected[i][1] || ':' || v_expected[i][2]);
    END IF;
  END LOOP;
  IF v_rows IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-274: these privileges survived the revoke for authenticated: %', v_rows;
  END IF;

  -- 7c. the four pairs of section 4 are still granted. If a later migration revokes one
  -- without fixing the feature, this says so rather than leaving the app quietly broken.
  v_rows := NULL;
  IF NOT has_table_privilege('authenticated','public.matches'::regclass,'INSERT') THEN
    v_rows := concat_ws(', ', v_rows, 'matches:INSERT');
  END IF;
  IF NOT has_table_privilege('authenticated','public.safta_likes'::regclass,'UPDATE') THEN
    v_rows := concat_ws(', ', v_rows, 'safta_likes:UPDATE');
  END IF;
  IF NOT has_table_privilege('authenticated','public.shidduch_suggestions'::regclass,'INSERT') THEN
    v_rows := concat_ws(', ', v_rows, 'shidduch_suggestions:INSERT');
  END IF;
  IF NOT has_table_privilege('authenticated','public.shidduch_suggestions'::regclass,'UPDATE') THEN
    v_rows := concat_ws(', ', v_rows, 'shidduch_suggestions:UPDATE');
  END IF;
  IF v_rows IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-274: these grants are meant to stay until the missing policies land, but are gone: %', v_rows;
  END IF;

  -- 7d. service_role still owns notification_queue outright.
  IF NOT (has_table_privilege('service_role','public.notification_queue'::regclass,'SELECT')
      AND has_table_privilege('service_role','public.notification_queue'::regclass,'INSERT')
      AND has_table_privilege('service_role','public.notification_queue'::regclass,'UPDATE')
      AND has_table_privilege('service_role','public.notification_queue'::regclass,'DELETE')) THEN
    RAISE EXCEPTION 'MEXA-274: service_role lost access to notification_queue - the notify_* triggers and send-notification would break';
  END IF;

  -- 7e. the default-privileges fix for anon. `a` is the empty-privilege case; any anon=
  -- entry at all in the postgres-owned default ACL means a new table would re-grant.
  IF EXISTS (
    SELECT 1
      FROM pg_default_acl d
      JOIN pg_namespace n ON n.oid = d.defaclnamespace
     WHERE n.nspname = 'public'
       AND d.defaclobjtype = 'r'
       AND pg_get_userbyid(d.defaclrole) = 'postgres'
       AND EXISTS (
         SELECT 1 FROM unnest(d.defaclacl) a
          WHERE a::text LIKE 'anon=%'
            AND split_part(split_part(a::text, '=', 2), '/', 1) <> ''
       )
  ) THEN
    RAISE EXCEPTION 'MEXA-274: the postgres default privileges on public still grant anon something on new tables';
  END IF;

  -- 7f. section 5, the same two checks for sequences. The first covers the sequences that
  -- exist (none today, so it can only start failing once one is added and re-grants).
  SELECT string_agg(c.relname || ':' || p.priv, ', ' ORDER BY c.relname, p.priv)
    INTO v_rows
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   CROSS JOIN (VALUES ('SELECT'),('UPDATE'),('USAGE')) AS p(priv)
   WHERE c.relkind = 'S'
     AND has_sequence_privilege('anon', c.oid, p.priv);
  IF v_rows IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-274: anon still holds sequence privileges: %', v_rows;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_default_acl d
      JOIN pg_namespace n ON n.oid = d.defaclnamespace
     WHERE n.nspname = 'public'
       AND d.defaclobjtype = 'S'
       AND pg_get_userbyid(d.defaclrole) = 'postgres'
       AND EXISTS (
         SELECT 1 FROM unnest(d.defaclacl) a
          WHERE a::text LIKE 'anon=%'
            AND split_part(split_part(a::text, '=', 2), '/', 1) <> ''
       )
  ) THEN
    RAISE EXCEPTION 'MEXA-274: the postgres default privileges on public still grant anon something on new sequences';
  END IF;
END;
$$;
