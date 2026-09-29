-- Mazal - drop get_orthodox_discovery_profiles instead of reshaping it
--
-- MEXA-327 (found again in MEXA-348). Rollback:
-- supabase/rollback/00021_drop_orthodox_discovery_rpc_rollback.sql
--
-- WHAT IS WRONG WITH IT
--
-- `public.get_orthodox_discovery_profiles(uuid,integer,integer,integer,text[])` is
-- SECURITY DEFINER, `authenticated` holds EXECUTE, and it declares:
--
--   RETURNS SETOF public.users
--
-- So one call hands the caller up to 50 whole rows of `public.users` belonging to other
-- people - all **53** columns live has, measured, including `email`, `phone`, `auth_id`,
-- `current_latitude`, `current_longitude`, `location`, `date_of_birth`, `elo_score` and
-- `orthodox_subscription_status`. DEFINER means RLS never applies, and `00013` (MEXA-261)
-- making `users` own-row-only did nothing to this route: a view cannot stand in for a
-- `SETOF users` return type, so `00013` could not narrow it, and its own header wrongly
-- claimed `00010` had closed it. That header line is corrected in the same commit as this
-- file.
--
-- One thing this is NOT, despite what `src/types/supabase.generated.ts` still says: it does
-- not leak `instagram_access_token`. `00013` moved that column and `instagram_user_id` off
-- `users` into `user_integrations` and dropped them, and `00013` is applied - the live
-- `users` table has neither. The generated types are stale on that point, which is drift
-- from something other than this issue.
--
-- `00010` (MEXA-251/252) fixed the function's *authorisation* - `requesting_user_id` must
-- equal `current_app_user_id()` - but not what it returns. The caller can only ask on their
-- own behalf; what comes back is still everybody else's row.
--
-- WHY DROP RATHER THAN RESHAPE (MEXA-348, Gojo's call)
--
-- Reshaping the column list to `user_public_profiles`' set would have left a second
-- problem standing: the function never checks that the caller is entitled to the Orthodox
-- product. It filters the *pool* on `is_orthodox_user`, never the *caller*, and
-- `is_orthodox_user` is a client-set column - `app/(orthodox-auth)/register.tsx:103` writes
-- `is_orthodox_user: true` from the device. So any signed-in account, subscriber or not,
-- can page the Orthodox pool. Fixing the shape without fixing the entitlement would have
-- shipped a narrower version of the same hole, and there is no caller to preserve:
--
--   * Nothing in the app calls it. The Orthodox deck
--     (`app/(orthodox-tabs)/index.tsx:79`) reads the `user_public_profiles` view directly
--     since MEXA-279. The only non-SQL reference in the tree is the generated types entry,
--     removed in this commit.
--   * So there is no behaviour to keep working, and no reason to keep a DEFINER function
--     that reads `users` alive for a screen that does not use it.
--
-- If an Orthodox discovery RPC is wanted later it gets its own issue and is written from
-- scratch: `user_public_profiles` columns, plus a server-side entitlement check on the
-- caller (`orthodox_subscription_status`, read as owner, not a client-set boolean).
--
-- ===================================================================================
-- MEASURED ON THE LIVE PROJECT, BEFORE THIS MIGRATION
-- ===================================================================================
--
-- `tayiyczmacvhokdxfqvm` (live, not dev - MEXA-287), read-only, 2026-09-29:
--
--   to_regprocedure(...)              get_orthodox_discovery_profiles(uuid,integer,integer,integer,text[])
--   pg_get_function_result             SETOF users
--   prosecdef / proconfig              true / {search_path=public}
--   proacl                             {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--   has_function_privilege anon        false
--   overloads in public                1
--   pg_depend referrers (deptype<>'i') 0
--   users rows / is_orthodox_user rows  0 / 0
--
-- So: `authenticated` can reach it, `anon` cannot, nothing in the database depends on it,
-- and **the pool is empty, so nothing has leaked yet**. It opens the moment the first
-- Orthodox user finishes onboarding, which is why this blocks turning the Orthodox flag on
-- (MEXA-292) and nothing else.
--
-- The exposure was then reproduced, not just read off the catalog, in a rolled-back
-- transaction on the same project as the real `authenticated` role with `request.jwt.claims`
-- set (`.scratch/mazal-mexa327/verify.mjs --mode before`, BEFORE.txt, 21/21, nothing left
-- behind). Four fixture users: A the caller with `is_orthodox_user = false` and
-- `orthodox_subscription_status = NULL`, B and C Orthodox subscribers, D not Orthodox.
--
--   as A:  select * from get_orthodox_discovery_profiles(A.id)
--     -> 2 rows (B and C), 53 columns, no error
--     -> B.email='mexa327-B@example.test'  B.phone='+155500066'
--        B.auth_id=d0000000-…-032  B.current_latitude=40.71280000  B.elo_score=1800
--        B.date_of_birth=1995-06-15
--     -> ordered B before C, by elo_score DESC
--
-- A is entitled to nothing. That call is the whole finding: the function filters the *pool*
-- on `is_orthodox_user` and never the *caller*, so being signed in is the only requirement.
-- D is correctly absent, and 00010's checks do still hold (a mismatched
-- `requesting_user_id` is 42501, `anon` is 42501) - they are simply not the problem.
--
-- DEPENDS ON NOTHING, AND NOTHING DEPENDS ON IT
--
-- It removes one function `00005_orthodox_mode.sql` created and `00010` replaced. No other
-- migration in the tree names it except `00013`'s header comment and `00010`'s own
-- rollback, neither of which is executable state. `pg_depend` shows 0 referrers, so the
-- `DROP` below is deliberately RESTRICT (no CASCADE): if anything ever does come to depend
-- on it, this migration fails loudly rather than dropping that too.

BEGIN;

-- =====================================================
-- 1. Pre-flight. Abort unless live is the shape measured above.
-- =====================================================
--
-- A `DROP FUNCTION IF EXISTS` would pass silently on a database where somebody had already
-- replaced this function with something else of the same name. Assert first instead.

DO $$
DECLARE
  v_oid OID := to_regprocedure('public.get_orthodox_discovery_profiles(uuid,integer,integer,integer,text[])');
  v_overloads INTEGER;
  v_result TEXT;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'MEXA-327: get_orthodox_discovery_profiles(uuid,integer,integer,integer,text[]) is not on this database; nothing to drop (already applied?)';
  END IF;

  SELECT count(*) INTO v_overloads
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_orthodox_discovery_profiles';
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION 'MEXA-327: expected exactly 1 get_orthodox_discovery_profiles in public, found % - the signature below would leave the others behind', v_overloads;
  END IF;

  SELECT pg_get_function_result(v_oid) INTO v_result;
  IF v_result <> 'SETOF users' THEN
    RAISE EXCEPTION 'MEXA-327: return type is % , not "SETOF users" - somebody has already reshaped this function and this file is the wrong fix for it', v_result;
  END IF;

  RAISE NOTICE 'MEXA-327: dropping get_orthodox_discovery_profiles (oid %, RETURNS %)', v_oid, v_result;
END
$$;

-- Snapshot enough of the rest of the schema to prove section 4's "nothing else changed".
-- Transaction-local settings rather than a temp table: a table of any kind would itself
-- change the relation count this is here to measure, and a TEMP row type would have to be
-- resolved through `pg_temp` by section 4's DO block, which sets no search_path.
SELECT set_config('mexa327.public_functions',
         (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public'), TRUE),
       set_config('mexa327.public_relations',
         (SELECT count(*)::text FROM pg_class WHERE relnamespace = 'public'::regnamespace
           AND relkind IN ('r', 'v', 'm')), TRUE),
       set_config('mexa327.public_policies',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public'), TRUE),
       set_config('mexa327.users_rows',
         (SELECT count(*)::text FROM public.users), TRUE);

-- =====================================================
-- 2. Revoke, then drop.
-- =====================================================
--
-- The REVOKE is redundant on paper - `DROP FUNCTION` takes the whole ACL with it - but it
-- is cheap, it is what the scope fence asks for, and it means that if the DROP is ever
-- edited out of this file by mistake the privilege is still gone. `postgres` keeps its
-- owner EXECUTE until the DROP, which is what lets this transaction run at all.

REVOKE EXECUTE ON FUNCTION public.get_orthodox_discovery_profiles(UUID, INTEGER, INTEGER, INTEGER, TEXT[])
  FROM PUBLIC, authenticated, service_role;

DROP FUNCTION public.get_orthodox_discovery_profiles(UUID, INTEGER, INTEGER, INTEGER, TEXT[]);

-- =====================================================
-- 3. Ledger row, in this transaction (MEXA-325)
-- =====================================================
--
-- `00011` went on through a route that wrote the objects but not the ledger row, so a
-- re-run would have applied it twice; the row had to be backfilled by hand. Keeping the
-- insert in the file means every apply route gets it, whatever the operator remembers.
-- `on conflict do nothing` keeps it harmless when the apply script writes the same row.

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00021', 'drop_orthodox_discovery_rpc')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. Post-check. The function is gone; nothing else moved.
-- =====================================================

DO $$
DECLARE
  v_fns_before      INTEGER := current_setting('mexa327.public_functions')::INTEGER;
  v_rels_before     INTEGER := current_setting('mexa327.public_relations')::INTEGER;
  v_pols_before     INTEGER := current_setting('mexa327.public_policies')::INTEGER;
  v_users_before    INTEGER := current_setting('mexa327.users_rows')::INTEGER;
  v_n INTEGER;
BEGIN
  -- 4a. no function of that name in public, under any signature.
  IF to_regprocedure('public.get_orthodox_discovery_profiles(uuid,integer,integer,integer,text[])') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-327: to_regprocedure still resolves get_orthodox_discovery_profiles after the DROP';
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_orthodox_discovery_profiles';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MEXA-327: % function(s) named get_orthodox_discovery_profiles remain in public', v_n;
  END IF;

  -- 4b. exactly one function left, and it is the one this file names. A CASCADE or a
  -- wrong signature would show up here as a drop of 2 or more.
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public';
  IF v_n <> v_fns_before - 1 THEN
    RAISE EXCEPTION 'MEXA-327: public function count went % -> %, expected a drop of exactly 1', v_fns_before, v_n;
  END IF;

  -- 4c. the sibling DEFINER functions 00010 hardened are untouched. They share a file with
  -- the dropped one, so a bad signature match is the failure worth naming.
  SELECT count(*) INTO v_n
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('respond_to_suggestion', 'owns_safta_account', 'current_app_user_id')
     AND p.prosecdef;
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'MEXA-327: expected 3 SECURITY DEFINER siblings from 00010 (respond_to_suggestion, owns_safta_account, current_app_user_id), found %', v_n;
  END IF;

  -- 4d. no table, view, policy or user row moved. This file changes one function and one
  -- ledger row, and that claim is worth asserting rather than trusting.
  SELECT count(*) INTO v_n FROM pg_class
   WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'v', 'm');
  IF v_n <> v_rels_before THEN
    RAISE EXCEPTION 'MEXA-327: public relation count changed % -> %', v_rels_before, v_n;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'public';
  IF v_n <> v_pols_before THEN
    RAISE EXCEPTION 'MEXA-327: public policy count changed % -> %', v_pols_before, v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.users;
  IF v_n <> v_users_before THEN
    RAISE EXCEPTION 'MEXA-327: users row count changed % -> %', v_users_before, v_n;
  END IF;

  -- 4e. the view the Orthodox deck actually reads is still there. Dropping the RPC is only
  -- safe because this exists; if it ever does not, the deck has no source at all.
  IF to_regclass('public.user_public_profiles') IS NULL THEN
    RAISE EXCEPTION 'MEXA-327: public.user_public_profiles is missing - 00013 is not applied, so dropping the RPC leaves the Orthodox deck with no source';
  END IF;

  RAISE NOTICE 'MEXA-327: get_orthodox_discovery_profiles is gone; % functions, % relations, % policies, % users rows unchanged.',
    v_fns_before - 1, v_rels_before, v_pols_before, v_users_before;
END
$$;

COMMIT;
