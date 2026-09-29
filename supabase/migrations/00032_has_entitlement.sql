-- Mazal - public.has_entitlement(text): the first server-side answer to "has this caller paid?"
--
-- MEXA-373, Phase 1 item 1 of Gojo's scope. Every premium gate in Mazal is enforced on the
-- device: `usePremium.ts` reads the RevenueCat SDK into a zustand store and every gate reads
-- that store. Nothing on the server knows, and until this file there was nothing on the
-- server to ask. Both of the SECURITY DEFINER features written since say so in their own
-- headers and point here:
--
--   * `00025_rewind_undo_last_swipe.sql` - "does NOT check entitlement ... a server-side gate
--     would refuse every real paying user"; its bound is the 30-second window instead.
--   * `00026_who_liked_me.sql` - "Neither function checks an entitlement, because there is
--     nothing server-side to check ... Closing the revenue side is MEXA-373."
--
-- This file creates the thing to check. It changes **no** caller: nothing in the database and
-- nothing in the client calls it yet. That is deliberate, and section "What this file
-- deliberately does NOT do" says why for each gate.
--
-- =====================================================
-- What it answers, and what it refuses to answer
-- =====================================================
--
-- `has_entitlement(p_entitlement)` -> "does the **caller** hold this entitlement right now".
--
-- It takes no user id. Identity comes from `public.current_app_user_id()` inside the body,
-- which is 00010's rule and the same one `undo_last_swipe()` and the who-liked-me functions
-- follow. There is no argument by which one user can ask about another, so granting EXECUTE
-- to `authenticated` discloses nothing about anybody else. A caller with no `public.users`
-- row - `anon`, or a JWT for a deleted account - gets `false`, because the `user_id =` test
-- against a NULL id matches nothing.
--
-- Fail-closed, three ways, all of which matter while `public.subscriptions` is empty:
--
--   1. No row            -> false. Today that is every caller, which is correct: nobody can
--                           pay yet (there is no RevenueCat project - see Phase 2 below).
--   2. `status <> 'active'` -> false. 'cancelled' and 'expired' are the other two values the
--                           table's CHECK allows.
--   3. `expires_at` NULL or past -> false. **NULL is deliberately not treated as "no
--                           expiry"**: an entitlement gate should never read an unset column
--                           as a grant. See the Phase 2 contract below - this puts the
--                           burden on the webhook, which is the component that knows.
--
-- =====================================================
-- The contract this places on Phase 2's RevenueCat webhook
-- =====================================================
--
-- Phase 2 (blocked on Itai: there is no RevenueCat account, project or product yet) writes
-- `public.subscriptions` as `service_role` from a webhook. For this function to answer
-- correctly, that writer must honour three things, and none of them is guessable from the
-- table definition:
--
--   a. `plan_type` holds the **RevenueCat entitlement identifier**, matching `ENTITLEMENTS`
--      in `src/lib/config/revenuecat.ts`, so that a gate and the client's `hasEntitlement()`
--      ask the same question with the same string.
--   b. A lifetime / non-expiring entitlement is written with a far-future `expires_at`, never
--      NULL, per rule 3 above.
--   c. `user_id` is resolved from RevenueCat's `app_user_id`, which `revenuecat.ts` already
--      sets to our `users.id` (`Purchases.logIn(userId)`).
--
-- **Measured blocker for (a), and it is not this file's to fix:** the live CHECK constraint is
--   `subscriptions_plan_type_check CHECK (plan_type = ANY (ARRAY['mazal_plus','mazal_gold']))`
-- while `ENTITLEMENTS` is `mazal_gold`, `mazal_platinum`, `mazal_orthodox`, `safta_pro`. Three
-- of the four entitlements the paywall sells **cannot be stored in this table at all** -
-- `mazal_platinum`, the top tier in `app/premium/index.tsx`, would be rejected by the CHECK,
-- so a Platinum purchase would 400 in the webhook and the customer would pay and get nothing.
-- `mazal_plus` in the CHECK is from `PREMIUM_TIERS` in `src/lib/constants/app.ts` and is not
-- an entitlement id anywhere. Widening that CHECK means deciding which tiers exist, which is
-- Itai's call and explicitly out of Gojo's Phase 1 scope ("anything priced or shown on the
-- paywall"), so this file leaves the constraint alone and section 3 asserts it is still what
-- was measured - a later apply that has quietly changed it should not go unnoticed.
--
-- Until that is decided, `has_entitlement('mazal_gold')` is the only one of the four that
-- could ever return true, and only once a writer exists.
--
-- =====================================================
-- Why this is safe to add while the table has no writer
-- =====================================================
--
-- The danger with an entitlement function is not that it says "no" - it is that a client can
-- make it say "yes". `public.subscriptions` today:
--
--   * RLS is **on** (`relrowsecurity = true`, measured).
--   * It carries exactly **one** policy, `Users can view own subscription`, SELECT, with
--     `user_id = current user`. There is no INSERT, UPDATE or DELETE policy, so a client
--     write is refused by RLS.
--   * But the table-level grants still read `INSERT, UPDATE, DELETE, SELECT` for **both**
--     `authenticated` and `anon` (measured live). Those grants are inert only because no
--     write policy exists. `00016_client_role_write_privileges.sql` revokes them, for exactly
--     this reason in its own words - "a client that could write here could grant itself
--     premium" - and `00016` has never been applied (MEXA-364).
--
-- So the whole of the protection is "nobody has added a write policy". That is one commit
-- away from being false, and the day it stops being true this function starts answering
-- `true` for anyone who asks it to. Section 0f refuses to apply if a write policy already
-- exists, and the function's COMMENT states the rule so the next person to touch this table
-- reads it there. Applying `00016` is the durable fix and is tracked on MEXA-364.
--
-- =====================================================
-- search_path: `public, pg_temp`, not `public`
-- =====================================================
--
-- `SET search_path = public` is the house habit (00010, 00017) and it does **not** close the
-- hole it looks like it closes: Postgres searches the caller's temp schema for relation names
-- ahead of everything else unless `pg_temp` is named explicitly. A caller who can plant
-- `pg_temp.subscriptions` under a `public`-only pin owns the answer. Measured on this project
-- for MEXA-319 and written up in `00028_pin_function_search_path.sql`'s header. This file
-- takes the fixed form from the start and schema-qualifies `public.subscriptions` in the body
-- as well, so neither alone is load-bearing.
--
-- `has_database_privilege('authenticated', current_database(), 'TEMP')` is true by default on
-- Supabase, so that half of the vector is granted - but PostgREST exposes no DDL, so a REST
-- client cannot run `CREATE TEMP TABLE`. Defence in depth, not a live hole.
--
-- **Known gap, not closed here:** `public.current_app_user_id()` is itself pinned to
-- `search_path=public` and names `users` unqualified, and `00028` does not pin it (it covers
-- the four `notify_*` triggers and the three postgis functions). Every DEFINER function in
-- Mazal takes its identity from it, so the pin belongs there. Reported to MEXA-319 rather
-- than fixed here: changing a function the whole schema depends on is not a passenger on an
-- entitlement migration.
--
-- =====================================================
-- What this file deliberately does NOT do
-- =====================================================
--
--  * **It gates nothing.** Adding the call sites is the rest of Gojo's Phase 1 and each one
--    needs a decision this file must not make on its own:
--      - `undo_last_swipe()` (Rewind): `FREE_TIER.rewinds = 0`, so gating it on an entitlement
--        today refuses **every** caller and kills the button MEXA-372 has just shipped. That
--        is a visible removal of something a free user can do now, not a no-op.
--      - The daily swipe / super-like caps: the repo holds two disagreeing free tiers -
--        `FREE_TIER` in `src/lib/constants/app.ts` says `dailyLikes: 25, superLikesPerDay: 1`,
--        `FEATURE_LIMITS.free` in `src/lib/config/revenuecat.ts` says
--        `dailySwipes: 25, superLikesPerWeek: 1`, and `premiumStore` (what actually runs) uses
--        the second. "25 likes" and "25 swipes" are different caps, and per-day and per-week
--        are different products. The server cannot become the authority until one is chosen.
--      - `get_who_liked_me()`: that function does not exist on this database - `00026` is
--        written but unapplied (measured: `to_regproc` NULL, no `00026` ledger row). Its
--        header already specifies where the gate goes ("in `get_who_liked_me()` and nowhere
--        else: `count_who_liked_me()` stays free by design"), so the gate lands with or after
--        that apply, not from here.
--  * **No change to `public.subscriptions`** - not the CHECK, not the grants, not the policy.
--    Revoking the write grants is `00016`'s job and it already asserts its own result.
--  * **No new table, column, policy or trigger anywhere.**

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================
--
-- Everything below is a fact this function's body or its safety argument relies on. Checking
-- it here means a database that does not match gets an abort, rather than a function that
-- compiles and then answers the wrong question.

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 0a. Not already applied. Re-running is harmless in itself (CREATE OR REPLACE), but a
  -- second apply means somebody lost track of which state live is in, and this file's
  -- rollback would then run against a database whose ledger row it did not write.
  IF to_regprocedure('public.has_entitlement(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373: public.has_entitlement(text) already exists - 00032 is already applied';
  END IF;

  -- 0b. The identity helper from 00008/00010. This is where the caller comes from; this
  -- function takes no user id.
  IF to_regprocedure('public.current_app_user_id()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-373: public.current_app_user_id() is missing - apply 00008/00010 first';
  END IF;

  -- It must run as its owner, or the `subscriptions` read below would be evaluated as the
  -- caller and RLS would hide the very row we are asked about.
  --
  -- The search_path is checked as "pinned to something starting with public" rather than as
  -- an exact string, on purpose: MEXA-319 will re-pin it to `public, pg_temp` (see header),
  -- and this file must not abort the day that lands.
  SELECT string_agg(format('secdef=%s config=%s', p.prosecdef, p.proconfig), ', ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.current_app_user_id()')
     AND (p.prosecdef IS NOT TRUE
          OR p.proconfig IS NULL
          OR NOT (p.proconfig::text LIKE '%search_path=public%'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373: current_app_user_id() is not DEFINER with a public search_path: %', v_bad;
  END IF;

  -- 0c. The table exists and has the four columns the body reads. Built from the live column
  -- list, never from src/types/supabase.generated.ts, which is older than the applied
  -- migrations (MEXA-355).
  IF to_regclass('public.subscriptions') IS NULL THEN
    RAISE EXCEPTION 'MEXA-373: public.subscriptions is missing';
  END IF;

  SELECT string_agg(c.n, ', ')
    INTO v_bad
    FROM (VALUES ('user_id'), ('plan_type'), ('status'), ('expires_at')) AS c(n)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public' AND ic.table_name = 'subscriptions'
        AND ic.column_name = c.n
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373: public.subscriptions has no column(s) [%]', v_bad;
  END IF;

  -- 0d. `status = 'active'` has to be a value the table can actually hold, or the gate is a
  -- constant false that nobody would notice.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.subscriptions'::regclass
       AND conname  = 'subscriptions_status_check'
       AND pg_get_constraintdef(oid) LIKE '%''active''%'
  ) THEN
    RAISE EXCEPTION 'MEXA-373: subscriptions_status_check no longer admits ''active'' - the gate would never open';
  END IF;

  -- 0e. RLS is on. Not because the function depends on it - SECURITY DEFINER reads past RLS -
  -- but because the safety argument in the header does: with RLS off, the write grants in 0f
  -- would be live and a client could insert its own subscription row.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'subscriptions' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'MEXA-373: RLS is OFF on public.subscriptions - a client could grant itself premium; refusing to add an entitlement gate on top of that';
  END IF;

  -- 0f. **The load-bearing one.** No client-writable policy on `subscriptions`. The table's
  -- INSERT/UPDATE/DELETE grants to `authenticated` and `anon` are still in place (00016
  -- revokes them and is unapplied, MEXA-364); the only thing stopping a self-granted premium
  -- row today is that no write policy exists. If one has appeared, this function would be a
  -- server-side rubber stamp on a client-controlled value, so refuse to create it.
  SELECT string_agg(format('%s (%s)', policyname, cmd), ', '), count(*)
    INTO v_bad, v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'subscriptions'
     AND cmd <> 'SELECT';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'MEXA-373: public.subscriptions has % client-write polic(ies) [%] - a client could grant itself premium; fix that before adding an entitlement gate', v_n, v_bad;
  END IF;
END $$;

-- =====================================================
-- 1. The function
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_entitlement(p_entitlement TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- `public.subscriptions` is schema-qualified as well as the search_path being pinned with
  -- pg_temp last: either alone would do, and neither should be the only thing standing
  -- between a planted temp table and a free premium subscription (header, MEXA-319).
  --
  -- `current_app_user_id()` returns NULL for a caller with no public.users row, and
  -- `user_id = NULL` matches nothing, so anon and deleted accounts get false without a
  -- special case.
  SELECT EXISTS (
    SELECT 1
      FROM public.subscriptions s
     WHERE s.user_id    = public.current_app_user_id()
       AND s.plan_type  = p_entitlement
       AND s.status     = 'active'
       AND s.expires_at > now()
  );
$$;

COMMENT ON FUNCTION public.has_entitlement(TEXT) IS
  'MEXA-373. True when the CALLER holds the named RevenueCat entitlement right now: an '
  'active public.subscriptions row of that plan_type whose expires_at is in the future. '
  'Takes no user id - identity is public.current_app_user_id() - so it cannot be asked '
  'about anybody else. Fail-closed: no row, non-active status, or a NULL/past expires_at '
  'all return false, which is every caller today because public.subscriptions has no writer '
  '(the RevenueCat webhook is Phase 2, blocked on Itai). '
  'DO NOT add an INSERT, UPDATE or DELETE policy to public.subscriptions: the table still '
  'grants those verbs to authenticated and anon (00016 revokes them, unapplied), so a write '
  'policy would let any client grant itself premium and this function would confirm it. '
  '00032 refuses to apply if such a policy exists.';

-- Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE on every new function in public to
-- anon, authenticated and service_role at CREATE time, so state the intent explicitly
-- rather than relying on what is absent (supabase/MIGRATIONS.md).
--
-- `anon` is revoked because an unauthenticated caller has no users row and could only ever
-- get `false` - the call is meaningless, and leaving it callable invites somebody to read
-- that `false` as an answer about a real person.
--
-- `service_role` is revoked for the same reason as in 00025: it acts as the platform, not as
-- a signed-in person, has no public.users row, and holds BYPASSRLS anyway - anything
-- server-side that needs to know about a subscription can read the table directly.
REVOKE EXECUTE ON FUNCTION public.has_entitlement(TEXT) FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION public.has_entitlement(TEXT) TO authenticated;

-- =====================================================
-- 2. Ledger row, in this transaction (MEXA-325)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00032', 'has_entitlement')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. Assert the result, in the same transaction
-- =====================================================
--
-- Catalog assertions plus one execution. A function that exists with the right flags can
-- still answer the wrong question, and the answer that matters here is the fail-closed one:
-- with an empty subscriptions table every call must be false. The rehearsal named in
-- supabase/MIGRATIONS.md proves the true case as well, with a seeded row.

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 3a. It exists, is DEFINER, is STABLE, and is pinned with pg_temp last.
  SELECT string_agg(format('secdef=%s volatile=%s config=%s',
                           p.prosecdef, p.provolatile, p.proconfig), ', ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.has_entitlement(text)')
     AND (p.prosecdef IS NOT TRUE
          OR p.provolatile <> 's'
          OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373 3a: has_entitlement is not STABLE SECURITY DEFINER with search_path=public, pg_temp: %', v_bad;
  END IF;

  IF to_regprocedure('public.has_entitlement(text)') IS NULL THEN
    RAISE EXCEPTION 'MEXA-373 3a: public.has_entitlement(text) was not created';
  END IF;

  -- 3b. EXECUTE is held by `authenticated` and by nobody else. proacl must be non-NULL: for
  -- a function the built-in default is EXECUTE TO PUBLIC, so "no explicit ACL" is the OPEN
  -- case, not the closed one.
  SELECT p.proacl::text INTO v_bad
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.has_entitlement(text)');
  IF v_bad IS NULL THEN
    RAISE EXCEPTION 'MEXA-373 3b: has_entitlement has no explicit ACL, which means EXECUTE TO PUBLIC';
  END IF;

  SELECT string_agg(format('%s', COALESCE(a.grantee::regrole::text, 'PUBLIC')), ', '), count(*)
    INTO v_bad, v_n
    FROM pg_proc p, aclexplode(p.proacl) a
   WHERE p.oid = to_regprocedure('public.has_entitlement(text)')
     AND a.privilege_type = 'EXECUTE'
     AND a.grantee <> 0                                  -- 0 is PUBLIC
     AND a.grantee::regrole::text NOT IN ('authenticated', 'postgres', 'supabase_admin');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'MEXA-373 3b: unexpected EXECUTE grantee(s) on has_entitlement: %', v_bad;
  END IF;

  -- PUBLIC itself (grantee 0) must hold nothing. has_function_privilege('public', ...)
  -- raises - there is no role named public - so read the ACL.
  IF EXISTS (
    SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
     WHERE p.oid = to_regprocedure('public.has_entitlement(text)')
       AND a.privilege_type = 'EXECUTE' AND a.grantee = 0
  ) THEN
    RAISE EXCEPTION 'MEXA-373 3b: PUBLIC still holds EXECUTE on has_entitlement';
  END IF;

  IF has_function_privilege('authenticated', 'public.has_entitlement(text)', 'EXECUTE') IS NOT TRUE THEN
    RAISE EXCEPTION 'MEXA-373 3b: authenticated cannot EXECUTE has_entitlement';
  END IF;
  IF has_function_privilege('anon', 'public.has_entitlement(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-373 3b: anon can still EXECUTE has_entitlement';
  END IF;

  -- 3c. It actually answers, and with an empty table the answer is false for every
  -- entitlement id the client knows about - including the three the CHECK cannot even store.
  -- Run as the migration role, which has no public.users row, so this also covers the
  -- "caller is nobody" path.
  IF public.has_entitlement('mazal_gold')
     OR public.has_entitlement('mazal_platinum')
     OR public.has_entitlement('mazal_orthodox')
     OR public.has_entitlement('safta_pro')
     OR public.has_entitlement(NULL)
     OR public.has_entitlement('') THEN
    RAISE EXCEPTION 'MEXA-373 3c: has_entitlement returned true against an empty subscriptions table';
  END IF;

  -- 3d. Nothing about public.subscriptions changed. This file adds a reader, not a writer:
  -- same policy set, same CHECK. The CHECK assertion is here so that the header's "three of
  -- the four entitlements cannot be stored" stops being true loudly rather than silently.
  SELECT count(*) INTO v_n
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscriptions';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-373 3d: public.subscriptions has % policies, expected exactly 1 (SELECT own row)', v_n;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_bad
    FROM pg_constraint
   WHERE conrelid = 'public.subscriptions'::regclass AND conname = 'subscriptions_plan_type_check';
  IF v_bad IS DISTINCT FROM 'CHECK ((plan_type = ANY (ARRAY[''mazal_plus''::text, ''mazal_gold''::text])))' THEN
    RAISE EXCEPTION 'MEXA-373 3d: subscriptions_plan_type_check is not what 00032 measured (%) - re-read the header''s Phase 2 contract before trusting it', COALESCE(v_bad, 'MISSING');
  END IF;

  -- 3e. The ledger row this file's rollback keys on.
  IF NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00032'
  ) THEN
    RAISE EXCEPTION 'MEXA-373 3e: the 00032 ledger row was not written';
  END IF;
END $$;

COMMIT;
