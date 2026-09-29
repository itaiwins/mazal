-- ROLLBACK for 00035_server_side_swipe_quota.sql (MEXA-373 items 2, 3, 5)
--
-- Puts the database back to its post-00033, post-00032 state: drops the quota trigger and its
-- function, drops `public.user_has_entitlement(uuid, text)`, restores `has_entitlement(text)`
-- to 00032's own body, restores `undo_last_swipe()` to 00033's body and comment, and deletes
-- 00035's ledger row.
--
-- WHAT THIS RESTORES IS THE FINDING, in full. With the trigger gone, `public.swipes` has no
-- cap of any kind again - its INSERT policy's whole `WITH CHECK` is `swiper_id = me` - so a
-- patched client, or anything with the anon key and a real session, gets unlimited swipes and
-- unlimited super-likes. Every super-like also queues a push at the person swiped on, so an
-- uncapped super-like is an uncapped notification too. And Rewind stops checking the
-- entitlement, so a free client that calls `undo_last_swipe()` directly gets the paid feature
-- back, bounded only by the 30-second window. That is MEXA-373 as originally filed.
--
-- THE CLIENT HALF GOES WITH IT, OR NOTHING WILL MAKE SENSE. If the client from this commit is
-- still deployed it will keep a `not_entitled` branch that the server can no longer return and
-- keep mapping a `swipe_daily_cap` DETAIL that no longer arrives. Both are dead code rather
-- than misbehaviour - the client's own device-side limits still run - but revert both halves
-- together or say clearly which one is in force.
--
-- WHY THE RESTORED `undo_last_swipe()` IS 00033's AND NOT 00025's. 00035's guard 0c refuses to
-- apply unless `00033` is in the ledger, so at rollback time 00033 is necessarily applied and
-- 00033's body is unambiguously the thing to go back to. That is the whole reason that guard
-- is a hard abort rather than a warning: it makes this file's job deterministic instead of a
-- branch on which of two migrations happened to run. Section 0b re-checks it anyway, because a
-- rollback that assumes its own migration's guard held is a rollback that has never been
-- tested against the case where somebody applied things by hand.
--
-- NOTHING IS RE-GRANTED. 00035 added no policy and changed no table privilege on `swipes` or
-- `subscriptions`; the two functions it created were revoked from every client role at birth
-- and go away entirely. `has_entitlement(text)` keeps the grants it has had since 00032 -
-- CREATE OR REPLACE below preserves its ACL, and section 3 asserts that rather than assuming
-- it.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  -- 0a. There is something to roll back.
  IF to_regprocedure('public.swipes_enforce_quota()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-373 rollback: public.swipes_enforce_quota() is not on this database - 00035 is not applied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00035') THEN
    RAISE EXCEPTION 'MEXA-373 rollback: no 00035 ledger row - the trigger exists but this database did not record the apply; investigate before undoing it';
  END IF;

  -- 0b. 00033 is applied, so the body restored below is the right one. See the header.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00033') THEN
    RAISE EXCEPTION 'MEXA-373 rollback: 00033 is not in the ledger, so this file cannot know which undo_last_swipe() body to restore. 00035 should not have been applicable in the first place; resolve by hand.';
  END IF;

  -- 0c. 00032 is applied. This file restores its function body, so if 00032 has itself been
  -- rolled back there is nothing to restore it to and `has_entitlement` should simply be gone.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00032') THEN
    RAISE EXCEPTION 'MEXA-373 rollback: 00032 is not in the ledger. Roll 00035 back before 00032, not after; restoring has_entitlement() here would leave a function 00032''s rollback has already disowned.';
  END IF;

  -- 0d. Nothing outside 00035 has come to depend on user_has_entitlement. Its only callers
  -- are the two functions this file rewrites; a third means somebody built on it and this
  -- file would strand them. A string-body call leaves no pg_depend edge, so grep prosrc.
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.prosrc LIKE '%user_has_entitlement%'
     AND p.oid NOT IN (to_regprocedure('public.has_entitlement(text)'),
                       to_regprocedure('public.swipes_enforce_quota()'),
                       to_regprocedure('public.user_has_entitlement(uuid,text)'));
  IF v_n > 0 THEN
    RAISE EXCEPTION 'MEXA-373 rollback: % other function(s) call user_has_entitlement() - roll back whatever added them first', v_n;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE COALESCE(qual, '') LIKE '%user_has_entitlement%'
        OR COALESCE(with_check, '') LIKE '%user_has_entitlement%'
  ) THEN
    RAISE EXCEPTION 'MEXA-373 rollback: an RLS policy references user_has_entitlement() - roll back whatever added it first';
  END IF;
END $$;

-- =====================================================
-- 1. The cap goes
-- =====================================================

DROP TRIGGER swipes_enforce_quota ON public.swipes;
DROP FUNCTION public.swipes_enforce_quota();

-- =====================================================
-- 2. has_entitlement(text) goes back to 00032's own body
-- =====================================================
--
-- Byte-for-byte 00032's, including the comment about why the body is schema-qualified as well
-- as pinned. CREATE OR REPLACE keeps the ACL and does not clear proconfig; the pin is restated
-- so the restored function is not relying on the replaced one's leftovers.

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

DROP FUNCTION public.user_has_entitlement(UUID, TEXT);

-- =====================================================
-- 3. undo_last_swipe() goes back to 00033's body and comment
-- =====================================================

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
  c_window CONSTANT INTERVAL := INTERVAL '30 seconds';
  v_caller UUID := public.current_app_user_id();
  v_swipe  public.swipes;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'undo_last_swipe: no public.users row for this session'
      USING ERRCODE = '42501';
  END IF;

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

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'no_swipe'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- MEXA-401, restored verbatim: retract the still-pending super-like push.
  IF v_swipe.action = 'super_like' THEN
    DELETE FROM public.notification_queue
     WHERE user_id = v_swipe.swiped_id
       AND status = 'pending'
       AND data->>'type' = 'super_like'
       AND data->>'userId' = v_swipe.swiper_id::text
       AND created_at >= v_swipe.created_at;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_swipe.id, v_swipe.swiped_id, v_swipe.action, v_swipe.created_at;
END;
$$;

COMMENT ON FUNCTION public.undo_last_swipe() IS
  'Rewind: deletes the calling user''s most recent swipe if it is under 30 seconds old and the pair has not matched (MEXA-314). SECURITY DEFINER and argument-less, so identity comes from current_app_user_id() and a caller cannot aim it at anyone else - which is why public.swipes needs no DELETE policy and no DELETE grant for authenticated. Returns one row: ok, plus reason in (no_swipe, too_old, matched) when it refuses. On a rewound super_like it also deletes the still-pending public.notification_queue row that trigger_notify_super_like queued for the swiped user (MEXA-401) - only status=''pending'', only rows whose data->>''userId'' is the caller, and never a sent one. That DELETE is the only client-reachable write to notification_queue; do not give the table a client grant or policy instead.';

-- =====================================================
-- 4. Ledger
-- =====================================================

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00035';

-- =====================================================
-- 5. Assert the undo, in the same transaction
-- =====================================================

DO $$
DECLARE
  v_n   INTEGER;
  v_r   TEXT;
BEGIN
  IF to_regprocedure('public.swipes_enforce_quota()') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373 rollback 5a: swipes_enforce_quota() is still present';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.swipes'::regclass
              AND NOT tgisinternal AND tgname = 'swipes_enforce_quota') THEN
    RAISE EXCEPTION 'MEXA-373 rollback 5a: the swipes_enforce_quota trigger is still on public.swipes';
  END IF;
  IF to_regprocedure('public.user_has_entitlement(uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373 rollback 5a: user_has_entitlement(uuid,text) is still present';
  END IF;

  -- The two AFTER triggers 00035 was careful not to disturb are still there.
  SELECT count(*) INTO v_n FROM pg_trigger
   WHERE tgrelid = 'public.swipes'::regclass AND NOT tgisinternal;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'MEXA-373 rollback 5b: public.swipes has % triggers, expected exactly the 2 from 00017/00005', v_n;
  END IF;

  -- has_entitlement is back to reading subscriptions itself, still DEFINER, still pinned,
  -- still granted to authenticated only.
  IF (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.has_entitlement(text)'))
       LIKE '%user_has_entitlement%' THEN
    RAISE EXCEPTION 'MEXA-373 rollback 5c: has_entitlement still delegates to the dropped helper';
  END IF;
  SELECT string_agg(format('secdef=%s config=%s', p.prosecdef, p.proconfig), ', ') INTO v_r
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.has_entitlement(text)')
     AND (p.prosecdef IS NOT TRUE OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']);
  IF v_r IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373 rollback 5c: has_entitlement lost its DEFINER/search_path pin: %', v_r;
  END IF;
  IF has_function_privilege('authenticated', 'public.has_entitlement(text)', 'EXECUTE') IS NOT TRUE
     OR has_function_privilege('anon', 'public.has_entitlement(text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.has_entitlement(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-373 rollback 5c: has_entitlement''s grants are not 00032''s (authenticated only)';
  END IF;

  -- undo_last_swipe has lost the gate and kept MEXA-401's retraction.
  SELECT prosrc INTO v_r FROM pg_proc WHERE oid = to_regprocedure('public.undo_last_swipe()');
  IF v_r LIKE '%not_entitled%' THEN
    RAISE EXCEPTION 'MEXA-373 rollback 5d: undo_last_swipe() still carries the entitlement gate';
  END IF;
  IF v_r NOT LIKE '%notification_queue%' THEN
    RAISE EXCEPTION 'MEXA-373 rollback 5d: undo_last_swipe() lost MEXA-401''s retraction - 00033 has been undone by accident';
  END IF;
  IF obj_description(to_regprocedure('public.undo_last_swipe()'), 'pg_proc') LIKE '%not_entitled%' THEN
    RAISE EXCEPTION 'MEXA-373 rollback 5d: undo_last_swipe()''s comment still names not_entitled';
  END IF;

  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00035') THEN
    RAISE EXCEPTION 'MEXA-373 rollback 5e: the 00035 ledger row is still present';
  END IF;
END $$;

COMMIT;
