-- ROLLBACK for 00025_rewind_undo_last_swipe.sql (MEXA-314)
--
-- Drops `public.undo_last_swipe()`, puts the `public.swipes` comment back to whatever it
-- was before 00025 ran, and deletes 00025's ledger row, so the database is byte-identical
-- to its pre-00025 state.
--
-- WHAT THIS RESTORES IS THE BUG. With the function gone, `/rest/v1/rpc/undo_last_swipe`
-- 404s. If the client half of MEXA-314 is still deployed, Rewind then fails loudly on
-- every attempt, which is bad but honest. If the client is reverted **too**, Rewind goes
-- back to what this issue was filed about: `DELETE FROM swipes` matching zero rows because
-- there is no DELETE policy, no error, and a UI that reports a rewind that did not happen.
-- Revert both halves together or neither, or nobody will be able to tell which one is in
-- force.
--
-- NOTHING IS RE-GRANTED. 00025 added no policy and changed no table privilege, which is
-- the point of it, so there is nothing to give back here. In particular this file does
-- **not** grant `DELETE ON public.swipes` to `authenticated`: that grant is 00016's to
-- revoke and was never 00025's to hold.
--
-- THE `swipes` COMMENT DEPENDS ON 00016. 00016 also writes a comment on that table, so the
-- string that was there before 00025 is not a constant: it is 00016's text on a database
-- where 00016 is applied, and NULL on one where it is not (measured on live 2026-09-29:
-- `obj_description` was NULL, and 00016 is not applied). Section 2 reads the ledger and
-- restores the right one rather than hardcoding either.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  -- 0a. There is something to roll back.
  IF to_regprocedure('public.undo_last_swipe()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-314 rollback: public.undo_last_swipe() is not on this database - 00025 is not applied';
  END IF;

  -- 0b. Exactly one signature, so the unqualified DROP below cannot leave a sibling
  -- behind. 00025's post-check 3b asserts the same thing on the way in.
  SELECT count(*) INTO v_n
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname = 'undo_last_swipe';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-314 rollback: % functions named undo_last_swipe in public - this file drops one signature and would strand the rest', v_n;
  END IF;

  -- 0c. Nothing else has come to depend on it. `pg_depend` would catch a view, a default
  -- or another function that references it; RESTRICT below would fail anyway, but say why.
  SELECT count(*) INTO v_n
    FROM pg_depend d
   WHERE d.refobjid = to_regprocedure('public.undo_last_swipe()')
     AND d.deptype <> 'i'
     AND d.classid <> 'pg_proc'::regclass;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'MEXA-314 rollback: % object(s) depend on undo_last_swipe() - drop them first, this file will not CASCADE', v_n;
  END IF;
END
$$;

-- =====================================================
-- 1. Drop the function
-- =====================================================
--
-- RESTRICT (the default), never CASCADE: if anything has grown a dependency on this
-- function the right outcome is an abort, not a silent removal of whatever that was.
DROP FUNCTION public.undo_last_swipe();

-- =====================================================
-- 2. Put the table comment back
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00016') THEN
    -- 00016's text, verbatim from supabase/migrations/00016_client_role_write_privileges.sql.
    -- Note it still says "add a DELETE policy AND a GRANT DELETE", which is the advice
    -- MEXA-314 decided against; restoring it verbatim is the job of a rollback, and
    -- 00025's header is where the argument lives.
    COMMENT ON TABLE public.swipes IS
      'Append-only record of a swipe (MEXA-274). authenticated holds INSERT and SELECT only. '
      'Rewind goes through public.undo_last_swipe(), a SECURITY DEFINER function added by '
      '00025 (MEXA-314), so this grant can stay revoked. Do not add a DELETE policy or a '
      'client DELETE grant here.';
  ELSE
    COMMENT ON TABLE public.swipes IS NULL;
  END IF;
END
$$;

-- =====================================================
-- 3. Ledger
-- =====================================================

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00025';

-- =====================================================
-- 4. Assert the undo, in the same transaction
-- =====================================================

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  IF to_regprocedure('public.undo_last_swipe()') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-314 rollback: to_regprocedure still resolves undo_last_swipe() after the DROP';
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname = 'undo_last_swipe';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MEXA-314 rollback: % function(s) named undo_last_swipe remain in public', v_n;
  END IF;

  -- The comment matches the 00016 state, whichever that is.
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00016') THEN
    IF obj_description('public.swipes'::regclass, 'pg_class') IS NULL THEN
      RAISE EXCEPTION 'MEXA-314 rollback: 00016 is applied but the public.swipes comment is NULL';
    END IF;
  ELSE
    IF obj_description('public.swipes'::regclass, 'pg_class') IS NOT NULL THEN
      RAISE EXCEPTION 'MEXA-314 rollback: 00016 is not applied, so the public.swipes comment should be NULL, not [%]',
        obj_description('public.swipes'::regclass, 'pg_class');
    END IF;
  END IF;

  -- 00025 never touched a policy or a grant on `swipes`, so the undo must not have either.
  IF (SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname)
        FROM pg_policies WHERE schemaname = 'public' AND tablename = 'swipes')
     IS DISTINCT FROM 'Users can create swipes:INSERT, Users can view own swipes:SELECT' THEN
    RAISE EXCEPTION 'MEXA-314 rollback: the public.swipes policies are not 00002''s two';
  END IF;

  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00025') THEN
    RAISE EXCEPTION 'MEXA-314 rollback: ledger row 00025 is still present';
  END IF;
END
$$;

COMMIT;
