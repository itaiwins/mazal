-- ROLLBACK for 00033_rewind_retracts_super_like_notification.sql (MEXA-401)
--
-- NOT A MIGRATION. This lives in supabase/rollback/ and is never applied by name order.
--
-- =====================================================
-- What it restores, by name
-- =====================================================
--
-- It puts `public.undo_last_swipe()` back to **00025's** body - the one written by
-- `supabase/migrations/00025_rewind_undo_last_swipe.sql` (MEXA-314), md5 of `prosrc`
-- `33f97d655e9e1219d7f1456c57db7aea`, and it asserts that hash afterwards rather than
-- merely asserting the function exists. That is the whole difference between this file and
-- a `CREATE OR REPLACE` that hopes.
--
-- 00025 is the only migration this can restore, and that is deliberate: 00033's own guard
-- 0a refuses to apply unless the live body *is* 00025's, so there is no other predecessor
-- for this to have to choose between. If some future migration replaces `undo_last_swipe()`
-- again, it owns its own rollback and this file becomes wrong - guard 0b below is what
-- catches that, by refusing to run unless the live body is 00033's.
--
-- It also restores 00025's `COMMENT ON FUNCTION`, byte for byte, and deletes 00033's
-- ledger row. It touches nothing else: no table, no policy, no grant, because 00033 changed
-- none of those.
--
-- =====================================================
-- What rolling this back re-opens
-- =====================================================
--
-- MEXA-401 in full: a rewound Super Like leaves a `pending` row in
-- `public.notification_queue` naming the person who swiped, and that row is delivered the
-- day a drainer exists. Read 00033's header before deciding this is what you want -
-- "moot because nothing drains the queue" is true only until it is not.
--
-- What it does **not** re-open: nothing about access. 00033 added no grant and no policy,
-- so there is no privilege to give back and no window where the table is wider than it was.
-- Undoing it is purely behavioural.
--
-- =====================================================
-- Rows already retracted are not coming back
-- =====================================================
--
-- This restores the code, not the data. Any `notification_queue` row 00033 deleted while it
-- was applied is gone; the table has no soft delete and no audit trail. That is not a
-- reason to hesitate - the rows in question were pending pushes about swipes that no longer
-- exist - but it means "roll back and we are where we were" is true of the schema and false
-- of the queue. On `tayiyczmacvhokdxfqvm` as of 2026-09-29 the table holds 0 rows, so at the
-- time of writing there is nothing to lose.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================

DO $$
DECLARE
  v_src TEXT;
  v_bad TEXT;
BEGIN
  -- 0a. There is something to roll back.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00033') THEN
    RAISE EXCEPTION 'MEXA-401 rollback: ledger row 00033 is absent - 00033 is not applied';
  END IF;

  IF to_regprocedure('public.undo_last_swipe()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-401 rollback: public.undo_last_swipe() does not exist - 00025 has been rolled back under 00033; run 00025''s rollback''s ledger step instead';
  END IF;

  SELECT p.prosrc INTO v_src FROM pg_proc p WHERE p.oid = to_regprocedure('public.undo_last_swipe()');

  -- 0b. What is live is 00033's function and not a later one. Without this, a third
  -- migration's body would be silently reverted to 00025's - the mistake this file's header
  -- exists to prevent.
  IF v_src NOT LIKE '%DELETE FROM public.notification_queue%' THEN
    RAISE EXCEPTION 'MEXA-401 rollback: the live undo_last_swipe() does not contain 00033''s retraction (md5 %) - it is not 00033''s body; do not overwrite it with 00025''s', md5(v_src);
  END IF;

  -- 0c. And it is not a *modified* 00033 either. If somebody edited the function in place,
  -- restoring 00025 would throw their change away without saying so. A NOTICE rather than
  -- an EXCEPTION: 0b already proved this is 00033's shape, and a rollback that refuses to
  -- run because a comment was reflowed is a rollback nobody can use in a hurry. The hash is
  -- 00033's `prosrc` as measured in the MEXA-401 rehearsal (length 3505).
  IF md5(v_src) IS DISTINCT FROM 'b547a17b139484d193a9a69af1bb007a' THEN
    RAISE NOTICE 'MEXA-401 rollback: the live body is not the exact 00033 body recorded here (md5 %, length %). Restoring 00025 anyway - read the diff first if that surprises you.',
      md5(v_src), length(v_src);
  END IF;

  -- 0d. 00025 is still the thing being restored to. If its ledger row has gone, the
  -- database is in a state this file cannot reason about.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00025') THEN
    RAISE EXCEPTION 'MEXA-401 rollback: 00025 is not in the ledger, so there is no 00025 state to restore to - reconcile first';
  END IF;

  -- 0e. The flags 00025's function is supposed to carry, checked on the way in so a
  -- surprise here is reported as a surprise and not silently baked into the replacement.
  SELECT string_agg(format('secdef=%s config=%s volatile=%s nargs=%s',
                           p.prosecdef, p.proconfig, p.provolatile, p.pronargs), ', ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.undo_last_swipe()')
     AND (p.prosecdef IS NOT TRUE
          OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']
          OR p.provolatile <> 'v'
          OR p.pronargs <> 0);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-401 rollback: undo_last_swipe() has unexpected flags before the restore: %', v_bad;
  END IF;
END
$$;

-- =====================================================
-- 1. 00025's function, byte for byte
-- =====================================================
--
-- Copied from supabase/migrations/00025_rewind_undo_last_swipe.sql section 1, unchanged,
-- including its comments - the `prosrc` hash asserted in section 3 is a hash of the
-- comments too, so a "tidy-up" here breaks the assertion on purpose.

CREATE OR REPLACE FUNCTION public.undo_last_swipe()
RETURNS TABLE (
  ok        BOOLEAN,
  reason    TEXT,
  swipe_id  UUID,
  swiped_id UUID,
  action    TEXT,
  swiped_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- The advertised window ("Rewind last swipe"). Server-side, so it is 30 seconds of real
  -- elapsed time and not 30 seconds of whatever the phone thinks the time is.
  c_window CONSTANT INTERVAL := INTERVAL '30 seconds';
  v_caller UUID := public.current_app_user_id();
  v_swipe  public.swipes;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'undo_last_swipe: no public.users row for this session'
      USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE so two taps in flight at once cannot both be told they won. `id DESC`
  -- breaks ties: `created_at` defaults to NOW() and two swipes in one transaction share it.
  SELECT s.* INTO v_swipe
    FROM public.swipes s
   WHERE s.swiper_id = v_caller
   ORDER BY s.created_at DESC, s.id DESC
   LIMIT 1
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'no_swipe'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_swipe.created_at <= now() - c_window THEN
    RETURN QUERY SELECT FALSE, 'too_old'::TEXT, v_swipe.id, v_swipe.swiped_id, v_swipe.action, v_swipe.created_at;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.matches m
     WHERE m.user1_id = LEAST(v_swipe.swiper_id, v_swipe.swiped_id)
       AND m.user2_id = GREATEST(v_swipe.swiper_id, v_swipe.swiped_id)
  ) THEN
    RETURN QUERY SELECT FALSE, 'matched'::TEXT, v_swipe.id, v_swipe.swiped_id, v_swipe.action, v_swipe.created_at;
    RETURN;
  END IF;

  DELETE FROM public.swipes WHERE id = v_swipe.id;

  -- Belt and braces on top of FOR UPDATE: if this ever deletes nothing, say so instead of
  -- reporting a rewind that did not happen. That silent lie is the bug this file exists to
  -- fix, and it should not be reintroducible by a race.
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'no_swipe'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_swipe.id, v_swipe.swiped_id, v_swipe.action, v_swipe.created_at;
END;
$$;

-- 00025's comment, byte for byte. 00033 replaced it; nothing else writes it.
COMMENT ON FUNCTION public.undo_last_swipe() IS
  'Rewind: deletes the calling user''s most recent swipe if it is under 30 seconds old and the pair has not matched (MEXA-314). SECURITY DEFINER and argument-less, so identity comes from current_app_user_id() and a caller cannot aim it at anyone else - which is why public.swipes needs no DELETE policy and no DELETE grant for authenticated. Returns one row: ok, plus reason in (no_swipe, too_old, matched) when it refuses.';

-- =====================================================
-- 2. Ledger
-- =====================================================

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00033';

-- =====================================================
-- 3. Assert the restore, in the same transaction
-- =====================================================

DO $$
DECLARE
  v_src TEXT;
  v_bad TEXT;
BEGIN
  SELECT p.prosrc INTO v_src FROM pg_proc p WHERE p.oid = to_regprocedure('public.undo_last_swipe()');

  -- 3a. Byte-exact 00025. This is the assertion that makes the header's claim checkable
  -- rather than aspirational.
  IF md5(v_src) IS DISTINCT FROM '33f97d655e9e1219d7f1456c57db7aea' THEN
    RAISE EXCEPTION 'MEXA-401 rollback: the restored undo_last_swipe() body is not 00025''s (md5 %, length %, expected 33f97d655e9e1219d7f1456c57db7aea / 2018)',
      md5(v_src), length(v_src);
  END IF;

  -- 3b. And the retraction really is gone, not merely "the hash looks right".
  IF v_src LIKE '%notification_queue%' THEN
    RAISE EXCEPTION 'MEXA-401 rollback: undo_last_swipe() still mentions notification_queue';
  END IF;

  -- 3c. Flags and return type unchanged by the restore.
  SELECT string_agg(format('secdef=%s config=%s volatile=%s nargs=%s',
                           p.prosecdef, p.proconfig, p.provolatile, p.pronargs), ', ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.undo_last_swipe()')
     AND (p.prosecdef IS NOT TRUE
          OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']
          OR p.provolatile <> 'v'
          OR p.pronargs <> 0);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-401 rollback: undo_last_swipe() has the wrong flags after the restore: %', v_bad;
  END IF;

  IF pg_get_function_result(to_regprocedure('public.undo_last_swipe()'))
     IS DISTINCT FROM 'TABLE(ok boolean, reason text, swipe_id uuid, swiped_id uuid, action text, swiped_at timestamp with time zone)' THEN
    RAISE EXCEPTION 'MEXA-401 rollback: undo_last_swipe() returns [%] after the restore',
      pg_get_function_result(to_regprocedure('public.undo_last_swipe()'));
  END IF;

  -- 3d. 00025's comment is back, by content and not merely non-NULL. A comment that still
  -- promised the retraction would be a lie about live.
  v_bad := obj_description(to_regprocedure('public.undo_last_swipe()'), 'pg_proc');
  IF v_bad IS NULL OR v_bad LIKE '%notification_queue%' OR v_bad NOT LIKE '%MEXA-314%' THEN
    RAISE EXCEPTION 'MEXA-401 rollback: undo_last_swipe()''s comment is not 00025''s: [%]', v_bad;
  END IF;

  -- 3e. Ledger row gone.
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00033') THEN
    RAISE EXCEPTION 'MEXA-401 rollback: ledger row 00033 is still there';
  END IF;

  -- 3f. Nothing was collaterally changed. 00033 touched no table, and neither does this.
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_queue') <> 0 THEN
    RAISE EXCEPTION 'MEXA-401 rollback: public.notification_queue has policies - this file did not add them, but reconcile before trusting anything above';
  END IF;

  SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname)
    INTO v_bad
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'swipes';
  IF v_bad IS DISTINCT FROM 'Users can create swipes:INSERT, Users can view own swipes:SELECT' THEN
    RAISE EXCEPTION 'MEXA-401 rollback: public.swipes policies are [%]', v_bad;
  END IF;
END
$$;

COMMIT;
