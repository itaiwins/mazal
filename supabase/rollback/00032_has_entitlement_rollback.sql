-- ROLLBACK for 00032_has_entitlement.sql (MEXA-373)
--
-- Drops `public.has_entitlement(text)` and deletes 00032's ledger row, leaving the database
-- byte-identical to its pre-00032 state.
--
-- WHAT THIS RESTORES IS THE FINDING. MEXA-373 is "every premium gate is enforced on the
-- device only, and there is nothing server-side to check". 00032 created the thing to check.
-- Removing it puts that back. Nothing regresses in behaviour on the way out, because 00032
-- gates nothing - see below - so this is a clean undo rather than a trade.
--
-- NOTHING IS RE-GRANTED AND NOTHING IS RESTORED. 00032 added no policy, no column, no
-- constraint and no table privilege; it did not rewrite any COMMENT other than the one on the
-- function it creates, which goes with the function. So there is no prior state to put back
-- and no ledger branch to read - contrast `00025`'s rollback, which has to decide whose
-- `public.swipes` comment it is restoring. In particular this file does **not** touch
-- `public.subscriptions`: its CHECK, its single SELECT policy and its (still-granted, still
-- inert) write privileges were not 00032's to change and are not 00032's to give back.
--
-- THE ONE THING THAT MAKES THIS UNSAFE IS A CALLER. 00032 deliberately ships with no call
-- site, but the rest of MEXA-373 Phase 1 adds them - the swipe caps, the Rewind gate, and the
-- gate inside `get_who_liked_me()` once 00026 is applied. A SQL function called from another
-- function's string body leaves no `pg_depend` edge, so Postgres will let this DROP succeed
-- and the caller will then fail at runtime, not at rollback time. Section 0c therefore reads
-- the function bodies and the policy expressions itself and refuses rather than trusting
-- RESTRICT. If it fires, roll back the migration that added the caller first.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 0a. There is something to roll back.
  IF to_regprocedure('public.has_entitlement(text)') IS NULL THEN
    RAISE EXCEPTION 'MEXA-373 rollback: public.has_entitlement(text) is not on this database - 00032 is not applied';
  END IF;

  -- 0b. Exactly one signature, so the DROP below cannot leave a sibling behind. If Phase 2
  -- ever adds an overload, this file is not the one to remove it.
  SELECT count(*) INTO v_n
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname = 'has_entitlement';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-373 rollback: % functions named has_entitlement in public - this file drops one signature and would strand the rest', v_n;
  END IF;

  -- 0c. Nothing calls it. Three places a caller can hide, and only the first is something
  -- `DROP ... RESTRICT` would catch on its own:
  --
  --   1. A real catalog dependency - a view, a column default, a generated column.
  SELECT count(*) INTO v_n
    FROM pg_depend d
   WHERE d.refobjid = to_regprocedure('public.has_entitlement(text)')
     AND d.deptype <> 'i'
     AND d.classid <> 'pg_proc'::regclass;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'MEXA-373 rollback: % object(s) depend on has_entitlement() - drop them first, this file will not CASCADE', v_n;
  END IF;

  --   2. Another function's body. Bodies are text, so there is no dependency edge to find;
  --      grep them. This is how the swipe-cap trigger and the Rewind gate would show up.
  SELECT string_agg(format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid)), ', '),
         count(*)
    INTO v_bad, v_n
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.oid <> to_regprocedure('public.has_entitlement(text)')
     AND p.prosrc LIKE '%has_entitlement%';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'MEXA-373 rollback: % function(s) call has_entitlement [%] - roll back the migration that added them first', v_n, v_bad;
  END IF;

  --   3. An RLS policy expression, in either USING or WITH CHECK.
  SELECT string_agg(format('%s.%s: %s', schemaname, tablename, policyname), ', '), count(*)
    INTO v_bad, v_n
    FROM pg_policies
   WHERE COALESCE(qual, '') LIKE '%has_entitlement%'
      OR COALESCE(with_check, '') LIKE '%has_entitlement%';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'MEXA-373 rollback: % polic(ies) reference has_entitlement [%] - roll back the migration that added them first', v_n, v_bad;
  END IF;

  -- 0d. The ledger row this file deletes is present, so we are undoing the apply we think
  -- we are undoing.
  IF NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00032'
  ) THEN
    RAISE EXCEPTION 'MEXA-373 rollback: no 00032 ledger row - the function exists but this database did not record the apply; investigate before dropping';
  END IF;
END $$;

-- =====================================================
-- 1. Drop it
-- =====================================================
--
-- RESTRICT (the default) on purpose. 0c has already refused the cases RESTRICT cannot see;
-- this keeps the ones it can.

DROP FUNCTION public.has_entitlement(TEXT);

-- =====================================================
-- 2. Ledger
-- =====================================================

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00032';

-- =====================================================
-- 3. Assert the undo, in the same transaction
-- =====================================================

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  IF to_regprocedure('public.has_entitlement(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373 rollback 3a: has_entitlement(text) is still present';
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname = 'has_entitlement';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MEXA-373 rollback 3a: % function(s) named has_entitlement remain in public', v_n;
  END IF;

  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00032') THEN
    RAISE EXCEPTION 'MEXA-373 rollback 3b: the 00032 ledger row is still present';
  END IF;

  -- 3c. public.subscriptions is untouched, on the way out as on the way in: exactly one
  -- policy, and it is the SELECT-own-row one.
  SELECT count(*) INTO v_n
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscriptions';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-373 rollback 3c: public.subscriptions has % policies, expected exactly 1', v_n;
  END IF;
END $$;

COMMIT;
