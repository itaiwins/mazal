-- Rollback for 00026_who_liked_me.sql (MEXA-315)
--
-- Undoes the "See who likes you" backend: drops the three functions, puts the
-- `public.swipes` comment back to the text `00025` left, and deletes 00026's own ledger
-- row (the same shape `00021` introduced and `00024` and `00025` follow, because `00026`
-- writes that row inside its own transaction).
--
-- **This is a bit-exact inverse**, with one thing worth saying out loud: `00026` adds no
-- policy, no grant on any table, no column and no publication entry, so there is nothing
-- else to give back. It only ever added three functions and rewrote one comment. If this
-- file has to restore anything more than that, `00026` is not what was applied.
--
-- **What rolling back costs.** "See who likes you" stops working for everyone: both RPCs
-- 404 from PostgREST, `useWhoLikedMe` and `useWhoLikedMeCount` throw, and the Likes screen
-- shows its error state. Nothing is lost - the likes are rows in `swipes` and this file
-- does not touch them - and the feature comes back by re-applying `00026`. Nobody sees
-- anyone else's data as a result of running this; the failure direction is closed.
--
-- Run it in one transaction, as written.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================

DO $$
BEGIN
  -- Refuse to run against a database 00026 was never applied to, rather than silently
  -- dropping somebody else's functions of the same name and deleting a ledger row this
  -- file did not write.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00026') THEN
    RAISE EXCEPTION 'MEXA-315 rollback: no ledger row for 00026 - it is not applied here';
  END IF;

  IF to_regprocedure('public.get_who_liked_me(integer,integer)') IS NULL
     AND to_regprocedure('public.count_who_liked_me()') IS NULL
     AND to_regprocedure('public.pending_likers()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-315 rollback: the ledger says 00026 is applied but none of its three functions exists - reconcile by hand';
  END IF;
END
$$;

-- =====================================================
-- 1. Drop the three functions
-- =====================================================
--
-- Dependency order is not an issue - the two published functions call `pending_likers()`,
-- but a plain DROP FUNCTION does not track that dependency, so any order works. Dropping
-- the callers first anyway means no window inside this transaction where a live endpoint
-- has lost the function underneath it.
--
-- No CASCADE. Nothing else in the schema references these; if something has come to, it
-- should be an error here rather than a silent drop of whatever that is.

DROP FUNCTION IF EXISTS public.get_who_liked_me(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.count_who_liked_me();
DROP FUNCTION IF EXISTS public.pending_likers();

-- =====================================================
-- 2. Put the comment on public.swipes back
-- =====================================================
--
-- Three files write this comment - `00016`, `00025` and `00026` - so "put it back" depends
-- on which of the other two are applied, exactly as `00025`'s own rollback does. Reading
-- the ledger beats hardcoding one string: guessing wrong leaves the table describing a
-- state it is not in, which is how somebody ends up looking for a bug in the wrong file.
--
-- `00016` last if both are on, because `00016` is the later writer in the apply order the
-- runbook gives (`00016` comes after `00025` only if it is applied later; when both are
-- applied, whichever ran last owns the text, and `00016` is the one still pending).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00016') THEN
    -- 00016's text, verbatim from supabase/migrations/00016_client_role_write_privileges.sql.
    COMMENT ON TABLE public.swipes IS
      'Append-only record of a swipe (MEXA-274). authenticated holds INSERT and SELECT only. '
      'Rewind goes through public.undo_last_swipe(), a SECURITY DEFINER function added by '
      '00025 (MEXA-314), so this grant can stay revoked. Do not add a DELETE policy or a '
      'client DELETE grant here.';
  ELSIF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00025') THEN
    -- 00025's text, verbatim from supabase/migrations/00025_rewind_undo_last_swipe.sql.
    COMMENT ON TABLE public.swipes IS
      'Append-only record of a swipe. Clients hold INSERT and SELECT only; there is no DELETE '
      'policy on purpose (MEXA-314). Rewind goes through public.undo_last_swipe(), a '
      'SECURITY DEFINER function that enforces ownership, the 30-second window and the '
      '"already matched" rule in one place. Do not add a DELETE policy or a client DELETE '
      'grant here: 00016 revokes that grant and asserts it stayed revoked.';
  ELSE
    -- Neither is applied, so nothing had written a comment before 00026 did.
    COMMENT ON TABLE public.swipes IS NULL;
  END IF;
END
$$;

-- =====================================================
-- 3. Ledger row and post-check, in the same transaction
-- =====================================================

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00026';

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 3a. All three are gone, including any overload somebody added later.
  SELECT count(*), string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    INTO v_n, v_bad
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname IN ('pending_likers', 'count_who_liked_me', 'get_who_liked_me');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MEXA-315 rollback: % who-liked-me function(s) survive: %', v_n, v_bad;
  END IF;

  -- 3b. The comment no longer advertises a function that has just been dropped, and it
  -- still names Rewind's when the file that added Rewind is applied.
  v_bad := obj_description('public.swipes'::regclass, 'pg_class');
  IF v_bad LIKE '%who_liked_me%' THEN
    RAISE EXCEPTION 'MEXA-315 rollback: the public.swipes comment still advertises a who-liked-me function that no longer exists';
  END IF;
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN ('00016','00025'))
     AND (v_bad IS NULL OR v_bad NOT LIKE '%undo_last_swipe()%') THEN
    RAISE EXCEPTION 'MEXA-315 rollback: 00016/00025 is applied but the public.swipes comment no longer names undo_last_swipe(): %', coalesce(v_bad, '<none>');
  END IF;

  -- 3c. `swipes` is exactly where 00002 left it, which is the thing 00026 promised not to
  -- change in the first place. If this fails, something other than 00026 touched the table.
  SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname)
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'swipes';
  IF v_bad IS DISTINCT FROM 'Users can create swipes:INSERT, Users can view own swipes:SELECT' THEN
    RAISE EXCEPTION 'MEXA-315 rollback: public.swipes policies are [%], not 00002''s two', v_bad;
  END IF;

  -- 3d. The ledger row is gone.
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00026') THEN
    RAISE EXCEPTION 'MEXA-315 rollback: ledger row 00026 survived';
  END IF;
END
$$;

COMMIT;
