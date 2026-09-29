-- ROLLBACK for 00028_pin_function_search_path.sql (MEXA-319)
--
-- Puts all seven functions back to `proconfig IS NULL`, removes the comment 00028 added to
-- `update_user_location()`, and deletes the ledger row, so `pg_proc` is byte-identical to
-- its pre-00028 state. Measured before 00028 was written: all seven had `proconfig = NULL`
-- and `obj_description(..., 'pg_proc') = NULL`
-- (`.scratch/mazal-mexa319/BEFORE.txt`, `comments.mjs`).
--
-- WHAT THIS RESTORES IS THE STATE THE ISSUE WAS FILED ABOUT. After running it:
--
--  * `notify_new_match`, `notify_new_message`, `notify_safta_like` and `notify_super_like`
--    are SECURITY DEFINER again with a mutable `search_path`, i.e. they resolve `users`,
--    `matches`, `safta_accounts` and `send_push_notification` through whatever path the
--    caller happens to have - including that caller's temp schema, which is searched for
--    relation names ahead of everything else. Supabase's `function_search_path_mutable`
--    lint goes red again for exactly those four.
--  * `update_user_location`, `users_within_radius` and `distance_between_users` go back to
--    working only for callers whose `search_path` already carries `extensions`. That is
--    true of PostgREST today, so the app keeps working; it is not true of pg_cron, of the
--    pooler with a pinned path, or of any DEFINER function pinned to `public`.
--
-- Nothing bodily is undone because 00028 changed no function body: every statement in it
-- was `ALTER FUNCTION ... SET search_path`, and every statement here is the matching
-- `RESET`. So this file is safe to run at any time, and it is reversible by re-applying
-- 00028.
--
-- `RESET search_path` and not `SET search_path = <old>`: the old state was the *absence* of
-- an entry in `proconfig`, and `SET search_path = ''` or any other value would leave a row
-- there. Section 2 asserts `proconfig IS NULL`, which is the only thing that makes this a
-- true rollback rather than a different pin.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 0a. All seven still exist. If one was dropped, this file has nothing to restore and
  -- should say so rather than half-succeed.
  SELECT string_agg(s, ', ') INTO v_bad
    FROM unnest(ARRAY[
      'public.notify_new_match()',
      'public.notify_new_message()',
      'public.notify_safta_like()',
      'public.notify_super_like()',
      'public.update_user_location()',
      'public.users_within_radius(numeric,numeric,integer)',
      'public.distance_between_users(uuid,uuid)'
    ]) s
   WHERE to_regprocedure(s) IS NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319 rollback: these functions do not exist: %', v_bad;
  END IF;

  -- 0b. Refuse to run against a database that does not have 00028 applied, rather than
  -- stripping a pin some other migration put there on purpose.
  SELECT count(*) INTO v_n
    FROM pg_proc p
   WHERE p.oid IN (
           to_regprocedure('public.notify_new_match()')::oid,
           to_regprocedure('public.notify_new_message()')::oid,
           to_regprocedure('public.notify_safta_like()')::oid,
           to_regprocedure('public.notify_super_like()')::oid,
           to_regprocedure('public.update_user_location()')::oid,
           to_regprocedure('public.users_within_radius(numeric,numeric,integer)')::oid,
           to_regprocedure('public.distance_between_users(uuid,uuid)')::oid)
     AND p.proconfig IS NOT NULL;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'MEXA-319 rollback: none of the seven pins search_path, so 00028 is not applied; nothing to roll back';
  END IF;

  -- 0c. ...and what is there is 00028's pin and not somebody else's. A different value
  -- means a later migration re-pinned one of these, and RESET would undo that instead.
  SELECT string_agg(format('%s -> %s', x.sig, array_to_string(p.proconfig, ' | ')), '; ')
    INTO v_bad
    FROM (VALUES
      ('public.notify_new_match()',                          'search_path=public, pg_temp'),
      ('public.notify_new_message()',                        'search_path=public, pg_temp'),
      ('public.notify_safta_like()',                         'search_path=public, pg_temp'),
      ('public.notify_super_like()',                         'search_path=public, pg_temp'),
      ('public.update_user_location()',                      'search_path=public, extensions, pg_temp'),
      ('public.users_within_radius(numeric,numeric,integer)','search_path=public, extensions, pg_temp'),
      ('public.distance_between_users(uuid,uuid)',           'search_path=public, extensions, pg_temp')
    ) AS x(sig, want)
    JOIN pg_proc p ON p.oid = to_regprocedure(x.sig)
   WHERE p.proconfig IS DISTINCT FROM ARRAY[x.want];
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319 rollback: not 00028''s pin - refusing to RESET: %', v_bad;
  END IF;
END
$$;

-- =====================================================
-- 1. Un-pin
-- =====================================================

ALTER FUNCTION public.notify_new_match()   RESET search_path;
ALTER FUNCTION public.notify_new_message() RESET search_path;
ALTER FUNCTION public.notify_safta_like()  RESET search_path;
ALTER FUNCTION public.notify_super_like()  RESET search_path;

ALTER FUNCTION public.update_user_location()                         RESET search_path;
ALTER FUNCTION public.users_within_radius(NUMERIC, NUMERIC, INTEGER) RESET search_path;
ALTER FUNCTION public.distance_between_users(UUID, UUID)             RESET search_path;

-- 00028 is the only migration that has ever commented this function; it had no comment
-- before, so the rollback removes it rather than restoring an earlier text.
COMMENT ON FUNCTION public.update_user_location() IS NULL;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00028';

-- =====================================================
-- 2. Assert the result, in the same transaction
-- =====================================================

DO $$
DECLARE
  v_bad TEXT;
BEGIN
  -- 2a. proconfig is absent, not merely different.
  SELECT string_agg(format('%s -> %s', p.oid::regprocedure, array_to_string(p.proconfig, ' | ')), '; ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid IN (
           to_regprocedure('public.notify_new_match()')::oid,
           to_regprocedure('public.notify_new_message()')::oid,
           to_regprocedure('public.notify_safta_like()')::oid,
           to_regprocedure('public.notify_super_like()')::oid,
           to_regprocedure('public.update_user_location()')::oid,
           to_regprocedure('public.users_within_radius(numeric,numeric,integer)')::oid,
           to_regprocedure('public.distance_between_users(uuid,uuid)')::oid)
     AND p.proconfig IS NOT NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319 rollback: search_path is still pinned: %', v_bad;
  END IF;

  -- 2b. The comment is gone.
  IF obj_description(to_regprocedure('public.update_user_location()')::oid, 'pg_proc') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319 rollback: update_user_location() still carries a comment';
  END IF;

  -- 2c. The ledger row is gone.
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00028') THEN
    RAISE EXCEPTION 'MEXA-319 rollback: ledger row 00028 survived';
  END IF;

  -- 2d. The rollback is a rollback: DEFINER/INVOKER is untouched, so re-applying 00028
  -- lands on the same database it was written against.
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad
    FROM pg_proc p
   WHERE (p.oid = to_regprocedure('public.notify_new_match()')   AND NOT p.prosecdef)
      OR (p.oid = to_regprocedure('public.notify_new_message()') AND NOT p.prosecdef)
      OR (p.oid = to_regprocedure('public.notify_safta_like()')  AND NOT p.prosecdef)
      OR (p.oid = to_regprocedure('public.notify_super_like()')  AND NOT p.prosecdef)
      OR (p.oid = to_regprocedure('public.update_user_location()')                       AND p.prosecdef)
      OR (p.oid = to_regprocedure('public.users_within_radius(numeric,numeric,integer)') AND p.prosecdef)
      OR (p.oid = to_regprocedure('public.distance_between_users(uuid,uuid)')            AND p.prosecdef);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319 rollback: prosecdef changed: %', v_bad;
  END IF;
END
$$;

COMMIT;
