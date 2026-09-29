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

-- **Three** files write this comment now, not two: `00016`, this migration and `00026`
-- (MEXA-315). The ledger has no apply timestamp, so "whichever ran last" cannot be read
-- back. Choose by content instead (MEXA-376): `00026`'s text is true whenever `00026` is
-- applied and already says everything `00016`'s does (append-only, undo_last_swipe, the
-- revoked grants), so it wins whenever it is present, in either apply order. `00016`'s
-- text next, then NULL.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00026') THEN
    -- 00026's text, verbatim from supabase/migrations/00026_who_liked_me.sql. Without this
    -- branch, rolling 00025 back on a database that has 00026 would blank a comment 00026
    -- wrote and leave the table describing a state it is not in.
    COMMENT ON TABLE public.swipes IS
      'Append-only record of a swipe. Clients hold INSERT and SELECT only, and the SELECT '
      'policy is own-swiper-only on purpose: a policy admitting swiped_id = <me> would publish '
      '"who passed on you" along with "who liked you" (00017, MEXA-294). Rewind goes through '
      'public.undo_last_swipe() (00025); "see who likes you" goes through '
      'public.get_who_liked_me() and public.count_who_liked_me() (00026), which read the like '
      'side and never the pass side. Do not add a DELETE policy, a cross-side SELECT policy or '
      'a client write grant here: 00016 revokes those grants and asserts they stayed revoked.';
  ELSIF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00016') THEN
    -- 00016's text, verbatim from supabase/migrations/00016_client_role_write_privileges.sql.
    COMMENT ON TABLE public.swipes IS
      'Append-only record of a swipe (MEXA-274). authenticated holds INSERT and SELECT only. '
      'Rewind goes through public.undo_last_swipe(), a SECURITY DEFINER function added by '
      '00025 (MEXA-314), so this grant can stay revoked. Do not add a DELETE policy or a '
      'client DELETE grant here.';
  ELSE
    -- Nothing had written a comment before 00025 did. Measured on live 2026-09-29: NULL.
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

  -- The comment matches whichever of 00016 / 00026 is applied, and mentions the right
  -- function. Asserting the *content*, not just NULL-ness, is what catches the branch above
  -- picking the wrong string.
  -- Same precedence as the write above: 00026 first (MEXA-376).
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00026') THEN
    IF coalesce(obj_description('public.swipes'::regclass, 'pg_class'), '') NOT LIKE '%get_who_liked_me()%' THEN
      RAISE EXCEPTION 'MEXA-314 rollback: 00026 is applied, so the public.swipes comment should be 00026''s, not [%]',
        obj_description('public.swipes'::regclass, 'pg_class');
    END IF;
  ELSIF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00016') THEN
    IF coalesce(obj_description('public.swipes'::regclass, 'pg_class'), '') NOT LIKE '%MEXA-274%' THEN
      RAISE EXCEPTION 'MEXA-314 rollback: 00016 is applied, so the public.swipes comment should be 00016''s, not [%]',
        obj_description('public.swipes'::regclass, 'pg_class');
    END IF;
  ELSE
    IF obj_description('public.swipes'::regclass, 'pg_class') IS NOT NULL THEN
      RAISE EXCEPTION 'MEXA-314 rollback: neither 00016 nor 00026 is applied, so the public.swipes comment should be NULL, not [%]',
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
