-- Mazal - a grandchild can see the name of a Safta she is connected to
--
-- MEXA-302. Rollback: supabase/rollback/00022_safta_public_profiles_rollback.sql
--
-- Adds ONE object: `public.safta_public_profiles`, a view over `safta_accounts` carrying
-- three display columns (`id`, `display_name`, `relationship`) and one row rule - the
-- caller is the `connected_user_id` of an `accepted` `safta_connections` row pointing at
-- that account, or the account is the caller's own.
--
-- It changes no policy, no grant and no column on `safta_accounts` itself. The table stays
-- exactly as `00002` left it: one SELECT policy, `auth_id = auth.uid()`. `email`,
-- `subscription_status`, `subscription_plan`, `subscription_expires_at`, `auth_id`,
-- `user_id`, `is_active` and `created_at` remain unreadable by anyone but the Safta who
-- owns the row. That is deliberate and is the whole reason this is a view and not an extra
-- policy: a second SELECT policy on the table would widen *every* column at once, and four
-- of the eleven are an adult's contact details and billing state.
--
-- Same shape as `00013`'s `user_public_profiles`: an owner-run view supplies a row rule the
-- table's RLS does not, the app reads the view in a second query keyed on an id list, and
-- the generated types get a hand-written entry in src/types/database.types.ts.
--
-- DEPENDS ON: `00002` (the tables and their policies) and `00013` (which created
-- `public.current_app_user_id()`). Independent of everything in flight: it names no object
-- `00016`, `00020` or `00021` touches, adds no policy and changes no existing grant, so no
-- other migration's post-check can see it. Safe in either order against all of them.
--
-- ===================================================================================
-- THE DEFECT, MEASURED ON THE LIVE PROJECT
-- ===================================================================================
--
-- `tayiyczmacvhokdxfqvm`, inside `begin … rollback`, as the real `authenticated` and `anon`
-- roles with `request.jwt.claims` set (`.scratch/mazal-mexa302/verify.mjs --mode before`).
-- Nothing left behind. Fixtures: one `safta_accounts` row, a grandchild G on an `accepted`
-- connection to it, a grandchild P on a `pending` one, and an unconnected user U.
--
--   As G (accepted connection):
--     select id, display_name from safta_accounts where id = <the safta>  ->  0 rows
--
-- Zero, not null - the row is invisible, not redacted. Three call sites depended on it:
--
--   * src/api/queries/useSaftaConnections.ts embeds `safta_accounts!inner(...)`. PostgREST
--     turns `!inner` into an inner join, so an unreadable account row does not blank the
--     name, it **deletes the connection**. The grandchild's Safta list in
--     app/(tabs)/matches.tsx:295 has always rendered empty.
--   * src/api/queries/useSaftaMessages.ts `useSaftaConnectionById` embeds it without
--     `!inner`, so the chat header at app/(tabs)/safta-chat/[connectionId].tsx:367 falls
--     through to its `'Unknown Safta'` default.
--   * src/features/safta/hooks/useSaftaRecommendations.ts, in `useGrandchildRecommendations`
--     and `useSaftaConnection`. Neither is called from a screen yet; both are exported from
--     src/features/safta/hooks/index.ts and are converted here so the next screen that
--     wires one up does not re-find this bug.
--
-- All of it is behind `FEATURE_SAFTA_MODE`, which is off, so no user is affected today.
--
-- ===================================================================================
-- WHY A VIEW, AND WHAT THE ROW RULE HAS TO GET RIGHT
-- ===================================================================================
--
-- This is a cross-account read: it lets one person read a row belonging to a different
-- person, who signed up separately and holds her own auth identity. Three properties carry
-- it, and the post-check at the bottom plus `.scratch/mazal-mexa302/verify.mjs` assert each.
--
-- 1. COLUMNS. Three, chosen from what the three call sites actually render: a name, a
--    relationship label ("Bubbe", "Mom") and the id they key on. A column absent from a
--    view cannot be leaked by a policy mistake, so this is the strongest of the three
--    properties and the reason the view exists.
--
-- 2. ROWS. `accepted` only. `safta_connections` is created by the Safta
--    (`00002`, "Safta can create connections": the INSERT check is that the account is
--    hers) and moved to `accepted` by the grandchild ("Users can update connection
--    status"). So a `pending` row is an unanswered invitation from a stranger, and if
--    `pending` counted, anyone holding a Safta account could learn the display name of any
--    user id by inserting a connection and never being accepted. It reads the other way
--    too - the grandchild consents by accepting - which is why the rule is `= 'accepted'`
--    and not `<> 'rejected'`.
--
-- 3. WRITES. A single-table view with no aggregate is auto-updatable, and this one runs as
--    its owner, so an INSERT or UPDATE through it would write `safta_accounts` with RLS
--    switched off. Supabase's `ALTER DEFAULT PRIVILEGES` grants all four verbs on any new
--    object in `public` to `anon`, `authenticated` and `service_role`, so *not mentioning*
--    them is not the same as not granting them. Section 2 revokes everything and grants
--    back SELECT, to `authenticated` alone.
--
--    Measured, not assumed (`.scratch/mazal-mexa302/probe_mine_updatable.mjs`): after
--    creating this view Postgres reports `is_insertable_into = YES, is_updatable = YES`,
--    and with the grants handed back an `UPDATE … SET display_name` runs instead of
--    erroring. So the REVOKE is the thing stopping it, not a formality. Note this is the
--    opposite of `00013`'s `user_public_profiles`, which is NOT auto-updatable
--    (`is_updatable = NO`; a write through it is `55000 cannot update view`) - the write
--    privileges still sitting on that view are inert, checked while writing this one.
--
-- WHY `security_invoker = false`. Stated because everything above depends on it. The view
-- runs as `postgres`, which owns `safta_accounts` and `safta_connections` and so is not
-- subject to their RLS - that is the point, the view supplies the row rule itself. An
-- invoker-rights view would inherit the owner-scoped policy and return nothing, i.e. the
-- bug. Supabase's linter flags definer views; expected, not an oversight.
--
-- WHY `security_barrier = true`. It stops a caller-supplied qual containing a leaky
-- function from being evaluated against rows the WHERE clause would have removed. The
-- filters the app generates (`in('id', ids)`) are plain comparisons, which are leakproof,
-- so they still push down and still use `safta_accounts_pkey`.
--
-- WHY `current_app_user_id()` AND NOT A SUBQUERY ON `users`. `00013` made `users`
-- own-row-only; the function is the SECURITY DEFINER lookup every policy written since
-- uses for the same job, and it is `STABLE`, so it is evaluated once per statement rather
-- than per row. It returns NULL when there is no session, and `connected_user_id = NULL`
-- matches nothing, which is what shuts `anon` out on the row rule as well as on the grant.
--
-- INDEXES. No new ones. The EXISTS probes `safta_connections` by `(safta_account_id,
-- status, connected_user_id)`; `safta_connections_safta_account_id_connected_user_id_key`
-- is a unique index leading on `safta_account_id`, so the lookup is an index scan already.
--
-- WHAT THIS DOES NOT FIX. A Safta still cannot see the display name of another Safta
-- connected to the same grandchild, and nothing needs her to. The view also does not
-- expose `is_active`, so a deactivated Safta's name still renders in an existing
-- conversation - that is the behaviour before this migration too, and hiding her is a
-- product decision, not a privacy one.

BEGIN;

-- ===================================================================================
-- 1. The view
-- ===================================================================================

DROP VIEW IF EXISTS public.safta_public_profiles;

CREATE VIEW public.safta_public_profiles
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  sa.id,
  sa.display_name,
  sa.relationship
FROM public.safta_accounts sa
WHERE
  -- The Safta's own row. She can already read it straight off the table; this keeps the
  -- view a complete substitute for the embed, so a caller never has to know which side of
  -- the connection it is on.
  sa.auth_id = auth.uid()
  -- ...or the caller is a grandchild on an accepted connection to this account.
  OR EXISTS (
    SELECT 1
      FROM public.safta_connections sc
     WHERE sc.safta_account_id = sa.id
       AND sc.status = 'accepted'
       AND sc.connected_user_id = public.current_app_user_id()
  );

COMMENT ON VIEW public.safta_public_profiles IS
  'Display columns of a safta_accounts row, readable by a grandchild on an accepted '
  'safta_connections row to it (and by the Safta herself). safta_accounts itself stays '
  'owner-scoped - email and the subscription_* columns are not in this view and must not '
  'be added to it. Runs as owner (security_invoker = false), so the WHERE clause IS the '
  'row rule. Added by 00022 (MEXA-302); keep in step with src/types/database.types.ts.';

-- ===================================================================================
-- 2. Grants: SELECT to authenticated, nothing else to anyone
-- ===================================================================================
--
-- The REVOKE is the load-bearing statement, not boilerplate. Supabase's default privileges
-- on `public` hand every new view all four verbs for `anon`, `authenticated` and
-- `service_role`, and this view is auto-updatable and owner-run.
--
-- `anon` gets nothing at all: no screen reads a Safta name signed-out, and the row rule
-- already returns nothing without a session, so the grant would be a second lock on a door
-- that is shut - but `00013`'s `user_photos` finding (MEXA-286) is exactly the case where a
-- surviving anon grant turned out to matter, so it goes.
--
-- `service_role` gets nothing either: it bypasses RLS on `safta_accounts` directly and has
-- no use for a filtered view whose filter (`auth.uid()`) is NULL for it.

REVOKE ALL ON TABLE public.safta_public_profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.safta_public_profiles FROM anon;
REVOKE ALL ON TABLE public.safta_public_profiles FROM authenticated;
REVOKE ALL ON TABLE public.safta_public_profiles FROM service_role;

GRANT SELECT ON TABLE public.safta_public_profiles TO authenticated;

-- ===================================================================================
-- 3. Assert the result, in the same transaction
-- ===================================================================================
--
-- A view that is too wide fails open and stays quiet. These checks are what make the three
-- properties in the header true of the object that actually landed, not of the one this
-- file describes.

DO $$
DECLARE
  v_bad  TEXT;
  v_n    INT;
  v_opts TEXT;
BEGIN
  -- 3a. Exactly the three intended columns, no more. This is the check that would catch
  -- someone adding `email` or a `subscription_*` column to the SELECT list later.
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    INTO v_bad
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'safta_public_profiles';
  IF v_bad IS DISTINCT FROM 'id, display_name, relationship' THEN
    RAISE EXCEPTION 'MEXA-302: safta_public_profiles columns are "%", expected "id, display_name, relationship"', v_bad;
  END IF;

  -- 3b. The view options are the ones the row rule depends on. `security_invoker = true`
  -- would make it return nothing; no `security_barrier` would let a leaky qual see rows
  -- the WHERE clause removes.
  SELECT coalesce(array_to_string(c.reloptions, ' '), '')
    INTO v_opts
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'safta_public_profiles';
  IF v_opts NOT LIKE '%security_invoker=false%' OR v_opts NOT LIKE '%security_barrier=true%' THEN
    RAISE EXCEPTION 'MEXA-302: safta_public_profiles reloptions are "%", expected security_invoker=false and security_barrier=true', v_opts;
  END IF;

  -- 3c. The definition still filters on `accepted` and still consults
  -- `safta_connections`. A rule that lost either half would publish every Safta's name to
  -- every signed-in user.
  IF pg_get_viewdef('public.safta_public_profiles'::regclass) NOT LIKE '%safta_connections%'
     OR pg_get_viewdef('public.safta_public_profiles'::regclass) NOT LIKE '%accepted%' THEN
    RAISE EXCEPTION 'MEXA-302: safta_public_profiles no longer restricts rows to accepted connections';
  END IF;

  -- 3d. No write privilege on the view for anybody but its owner, and no privilege at all
  -- for anon. An INSERT or UPDATE through an owner-run view writes safta_accounts with RLS
  -- switched off.
  SELECT string_agg(format('%s:%s', grantee, privilege_type), ', ' ORDER BY grantee, privilege_type)
    INTO v_bad
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name = 'safta_public_profiles'
     AND grantee <> 'postgres'
     AND (privilege_type <> 'SELECT' OR grantee = 'anon');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-302: unexpected grants on safta_public_profiles: %', v_bad;
  END IF;

  -- 3e. `safta_accounts` itself is untouched: still one SELECT policy, still the
  -- owner-scoped one. This file widens a view, never the table.
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_accounts' AND cmd = 'SELECT';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-302: safta_accounts has % SELECT policies, expected exactly 1', v_n;
  END IF;

  SELECT qual INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_accounts' AND cmd = 'SELECT';
  IF v_bad IS DISTINCT FROM '(auth_id = auth.uid())' THEN
    RAISE EXCEPTION 'MEXA-302: the safta_accounts SELECT policy is now "%", expected "(auth_id = auth.uid())"', v_bad;
  END IF;

  RAISE NOTICE 'MEXA-302: safta_public_profiles created; safta_accounts unchanged.';
END
$$;

COMMIT;
