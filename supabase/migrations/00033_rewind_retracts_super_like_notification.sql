-- Mazal - A rewind retracts the super-like push it queued, if that push is still unsent
--
-- MEXA-401, decided on MEXA-372. `00025_rewind_undo_last_swipe.sql` deliberately left this
-- out and said so in its own header ("No retraction of a queued super-like notification
-- ... Filed separately"). This is that file. It replaces `public.undo_last_swipe()` once
-- more and adds exactly one statement to it.
--
-- =====================================================
-- What is wrong today
-- =====================================================
--
-- `trigger_notify_super_like` (00005) is `AFTER INSERT ON swipes FOR EACH ROW`. On a
-- `super_like` it calls `send_push_notification`, which INSERTs into
-- `public.notification_queue`. `undo_last_swipe()` deletes the swipe and leaves that row
-- sitting at `status = 'pending'`. Measured on `tayiyczmacvhokdxfqvm` 2026-09-29: the
-- trigger, the function body and the payload shape are all still exactly that.
--
-- =====================================================
-- Why retract, rather than "a rewind undoes the swipe, not the notification"
-- =====================================================
--
-- The case for leaving it alone was that the notification is anonymous and therefore
-- harmless. **It is not anonymous.** 00005 builds the body as
-- `swiper_name || ' thinks you are special!'` and the payload as
-- `jsonb_build_object('type', 'super_like', 'userId', NEW.swiper_id)`. It names the person
-- and carries their id.
--
-- Delivered after a rewind, that push makes a specific claim the app then contradicts:
--
--   * the named person is **not** in "See who likes you" - `get_who_liked_me` (00026)
--     reads `swipes`, and the row is gone;
--   * the named person is back in the recipient's deck as an ordinary card, with no sign
--     they ever did anything.
--
-- Retracting a *pending* row is not "unsending" anything - nothing has been sent. And it is
-- tightly bounded by construction: the rewind window is 30 seconds, so the row is at most
-- 30 seconds old, and `status = 'pending'` means no worker has taken it. A `sent` row is a
-- fact about the world and this file does not touch one.
--
-- =====================================================
-- Why it goes in the function and not in the client
-- =====================================================
--
-- `notification_queue` is not client-reachable and must not become so. It has RLS enabled
-- and **zero policies** (measured), which denies every client verb regardless of the
-- table-level grants `anon` and `authenticated` still hold - and 00016 (reviewed, PASSed,
-- unapplied) removes those grants as well. Giving Rewind a client DELETE would mean a
-- policy plus a grant on the one table that holds the title and body of every push,
-- including match names and message previews, which is precisely what 00007 and 00016 are
-- for.
--
-- `undo_last_swipe()` is already SECURITY DEFINER with `search_path = public`, owned by
-- `postgres`, which owns `notification_queue`, has `rolbypassrls`, and holds DELETE on it.
-- `relforcerowsecurity` is false on that table, so the owner is not filtered by its own
-- (empty) policy set. All four facts are asserted in section 0 rather than assumed: if any
-- one of them stopped holding, the DELETE below would match zero rows and retract nothing
-- while still reporting a successful rewind - the same silent lie 00025 exists to fix.
--
-- =====================================================
-- What a caller can and cannot reach with this
-- =====================================================
--
-- This widens what a client-triggered DEFINER function may delete, onto a table it could
-- not previously touch, so the bound is worth stating precisely. The DELETE's predicates:
--
--   user_id      = v_swipe.swiped_id            the person the caller just swiped on
--   data->>'userId' = v_swipe.swiper_id::text   the caller, always
--   data->>'type'   = 'super_like'
--   status          = 'pending'
--   created_at   >= v_swipe.created_at
--
-- `v_swipe` is selected `WHERE s.swiper_id = v_caller`, and `v_caller` is
-- `current_app_user_id()`, so `v_swipe.swiper_id` **is** the caller - there is no argument
-- to aim anywhere. Every row this can delete is therefore a row the caller's own super-like
-- created. A caller cannot reach another person's queued push, of any type, ever: the only
-- rows carrying `userId = <caller>` under `type = 'super_like'` are the ones
-- `notify_super_like` wrote from that caller's own INSERT, and `swipes`'s INSERT policy
-- (00002) pins `swiper_id` to the caller.
--
-- Three narrower questions, because "only their own rows" is not by itself enough:
--
--  1. **Can a caller retract an old super-like of their own, outside the 30-second
--     window?** No. To get `v_swipe.swiped_id = B` the caller needs a fresh swipe on B, and
--     `swipes` carries `UNIQUE (swiper_id, swiped_id)`, so the old row blocks a second one.
--     They cannot remove the old row either: `authenticated` holds the DELETE and UPDATE
--     *grants* on `swipes` but there is no DELETE or UPDATE policy, so RLS matches zero
--     rows (that is the bug 00025's header opens with).
--  2. **`swipes.created_at` is client-settable** - `authenticated` holds a column-level
--     INSERT grant on it and the INSERT policy constrains only `swiper_id`. It does not
--     widen this DELETE. A *future* `created_at` makes `created_at >= v_swipe.created_at`
--     false, so the retraction simply does not fire; a *past* one makes 00025's `too_old`
--     branch refuse the rewind before this statement is reached. Both directions fail
--     safe. (That the window itself can be pushed out with a future `created_at` is a
--     pre-existing 00025 hole, not one this file opens or closes; filed separately.)
--  3. **`created_at >= v_swipe.created_at` is exact, not approximate.** `swipes.created_at`
--     defaults to `now()` and `send_push_notification` inserts with `NOW()`; the trigger is
--     `AFTER INSERT` in the same transaction, so both are `transaction_timestamp()` and the
--     two values are equal. `>=` rather than `>` is what makes that equality a hit. The
--     bound is insurance the `UNIQUE (swiper_id, swiped_id)` argument above already makes
--     redundant - it is here so that if that constraint is ever dropped, this cannot reach
--     back to an older pending row.
--
-- =====================================================
-- Two things about `pending` that the next person needs
-- =====================================================
--
--  * **`status` is nullable** (`DEFAULT 'pending'`, no NOT NULL), so `status = 'pending'`
--    is not the same as "not sent". A NULL-status row is left alone on purpose: the partial
--    index `idx_notification_queue_pending` is `WHERE status = 'pending'` and the CHECK
--    admits only pending/sent/failed, so 'pending' is the value a drainer will key on, and
--    a row outside that set is not this file's to guess about.
--  * **There is no drainer today, and `send-notification` is not one.**
--    `supabase/functions/send-notification/index.ts` takes `{userId, title, body, data}`
--    from an HTTP request body and pushes it to Expo. It never reads
--    `notification_queue` and never writes `status` or `sent_at`. So nothing has ever moved
--    a row out of `pending`, and nothing in that queue has ever been delivered. 00016's
--    comment ("drained by the send-notification Edge Function") and its line 165 ("Who
--    reads it: supabase/functions/send-notification") are both wrong about this; filed
--    separately. **Whoever writes the real drainer must flip `pending` -> `sent` before or
--    as it pushes.** If a drainer ever leaves rows at `pending` after sending them, this
--    retraction becomes a delete of a delivered notification, which is the one thing it is
--    not allowed to be.
--
-- =====================================================
-- What this file deliberately does NOT do
-- =====================================================
--
--  * **No change to any grant or policy, on any table.** `notification_queue` keeps its
--    zero policies and whatever grants it has; `swipes` is untouched. Post-checks assert
--    both. This is what keeps 00033 compatible with 00016 in either order: 00016 revokes
--    from PUBLIC/anon/authenticated and grants to service_role, and the owner `postgres`
--    keeps everything either way.
--  * **No new return column.** `CREATE OR REPLACE FUNCTION` cannot change a function's
--    return type, and the retraction is not information the client needs: Rewind already
--    reports `ok`, and "and your push was pulled" is not a separate outcome a user can act
--    on. The count is deliberately not surfaced.
--  * **No `COMMENT ON TABLE public.notification_queue`.** That comment is currently NULL and
--    00016 (unapplied) writes it while 00016's rollback sets it back to NULL - so a string
--    written here would be silently replaced by one migration and then destroyed by
--    another's undo. That is the exact trap already filed against the `swipes` comment. The
--    fact lives in this file, in `undo_last_swipe()`'s own COMMENT, and in 00016's literal,
--    which this commit amends so it is true when 00016 lands.
--  * **No retraction for `like` or `pass`.** Only `super_like` queues anything; the guard
--    is on `v_swipe.action` so the DELETE is not even planned for the other two.
--  * **No touching of `matches` notifications.** A rewind refuses outright once the pair has
--    matched (00025, `reason = 'matched'`), so "Mazal Tov! New Match!" is never in scope
--    here. That refusal is what makes this file's scope exactly one push.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================

DO $$
DECLARE
  v_bad  TEXT;
  v_n    INTEGER;
  v_src  TEXT;
BEGIN
  -- 0a. 00025 is applied, and what is live is 00025's function and not somebody's newer
  -- replacement. `CREATE OR REPLACE` would overwrite a newer body without a word, so the
  -- body is pinned by hash. If this fires, do not delete the gate: merge this file's one
  -- statement into whatever replaced 00025 and re-pin.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00025') THEN
    RAISE EXCEPTION 'MEXA-401: 00025 (rewind_undo_last_swipe) is not in the ledger - apply it first';
  END IF;

  IF to_regprocedure('public.undo_last_swipe()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-401: public.undo_last_swipe() does not exist, though the ledger claims 00025 - reconcile before applying';
  END IF;

  SELECT p.prosrc INTO v_src FROM pg_proc p WHERE p.oid = to_regprocedure('public.undo_last_swipe()');

  IF v_src LIKE '%notification_queue%' THEN
    RAISE EXCEPTION 'MEXA-401: public.undo_last_swipe() already deletes from notification_queue - 00033 is already applied';
  END IF;

  IF md5(v_src) IS DISTINCT FROM '33f97d655e9e1219d7f1456c57db7aea' THEN
    RAISE EXCEPTION 'MEXA-401: the live undo_last_swipe() body is not 00025''s (md5 %, length %) - something replaced it since 2026-09-29; merge rather than overwrite',
      md5(v_src), length(v_src);
  END IF;

  -- 0b. The flags the argument in the header rests on. `CREATE OR REPLACE` does not clear
  -- `proconfig`, but the replacement below re-states `SET search_path = public` anyway, and
  -- this asserts the starting point.
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
    RAISE EXCEPTION 'MEXA-401: undo_last_swipe() does not have 00025''s flags: %', v_bad;
  END IF;

  -- 0c. Not already recorded.
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00033') THEN
    RAISE EXCEPTION 'MEXA-401: ledger row 00033 already exists';
  END IF;

  -- 0d. `notification_queue` is the shape this DELETE filters on. A renamed or retyped
  -- column would not error - `data->>'type'` on a missing key is just NULL - it would
  -- silently match nothing.
  SELECT string_agg(column_name || ' ' || data_type, ', ' ORDER BY ordinal_position)
    INTO v_bad
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'notification_queue'
     AND column_name IN ('user_id', 'status', 'data', 'created_at');
  IF v_bad IS DISTINCT FROM 'user_id uuid, data jsonb, status text, created_at timestamp with time zone' THEN
    RAISE EXCEPTION 'MEXA-401: public.notification_queue''s filtered columns are [%], not the expected user_id uuid, data jsonb, status text, created_at timestamptz', v_bad;
  END IF;

  -- 0e. 'pending' is still a real status and still the one that means undelivered.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.notification_queue'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) = 'CHECK ((status = ANY (ARRAY[''pending''::text, ''sent''::text, ''failed''::text])))'
  ) THEN
    RAISE EXCEPTION 'MEXA-401: public.notification_queue''s status CHECK is not the pending/sent/failed one - "pending means undelivered" is no longer a given';
  END IF;

  -- 0f. The payload shape. This is the single fact the whole DELETE keys on, so it is
  -- checked against the live function body rather than against 00005 on disk.
  SELECT p.prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'notify_super_like';
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'MEXA-401: public.notify_super_like() is missing - apply 00005 first';
  END IF;
  IF v_src NOT LIKE '%jsonb_build_object(''type'', ''super_like'', ''userId'', NEW.swiper_id)%' THEN
    RAISE EXCEPTION 'MEXA-401: notify_super_like() no longer builds the payload as (type=super_like, userId=NEW.swiper_id) - the DELETE below would match nothing';
  END IF;
  IF v_src NOT LIKE '%NEW.swiped_id,%' THEN
    RAISE EXCEPTION 'MEXA-401: notify_super_like() no longer addresses the push to NEW.swiped_id - the user_id predicate below would be wrong';
  END IF;

  -- 0f-bis. `notify_super_like()` only names the *recipient argument*. What turns that
  -- argument into `notification_queue.user_id` is `send_push_notification()`, one call
  -- deeper, and the check above cannot see it: an edit to that helper alone - leaving
  -- `notify_super_like` untouched - could remap the column and every other guard here would
  -- still pass while the DELETE silently filtered on the wrong person. Guts raised exactly
  -- this seam on MEXA-408 (advisory on an otherwise-PASS review). So pin the mapping too.
  --
  -- Low risk in practice: four stable triggers share this helper. But "low risk" is not the
  -- same as "checked", and this is the one hop between the payload shape and the column the
  -- DELETE keys on.
  SELECT p.prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'send_push_notification'
     AND pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid, p_title text, p_body text, p_data jsonb';
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'MEXA-401: public.send_push_notification(uuid, text, text, jsonb) is missing - apply 00005/00010 first';
  END IF;
  IF v_src NOT LIKE '%INSERT INTO notification_queue (user_id, title, body, data, created_at)%' THEN
    RAISE EXCEPTION 'MEXA-401: send_push_notification() no longer inserts into notification_queue (user_id, title, body, data, created_at) - the column the DELETE filters on may have moved';
  END IF;
  IF v_src NOT LIKE '%VALUES (p_user_id, p_title, p_body, p_data, NOW())%' THEN
    RAISE EXCEPTION 'MEXA-401: send_push_notification() no longer maps p_user_id onto notification_queue.user_id in that column order - the user_id predicate below would filter on the wrong person';
  END IF;

  -- 0g. And the trigger that runs it is still per-row AFTER INSERT on `swipes`, so the
  -- queue row really is created inside the swipe's own transaction, which is what makes
  -- `created_at >= v_swipe.created_at` exact.
  -- `tgtype` is a bitmask: 1 = FOR EACH ROW, 2 = BEFORE, 4 = INSERT. The live value is 5,
  -- i.e. row-level AFTER INSERT. Anything else and the queue row is not written once per
  -- swipe inside that swipe's transaction, which both the `user_id` predicate and the
  -- `created_at` bound assume.
  SELECT string_agg(format('%s tgtype=%s', t.tgname, t.tgtype), ', ')
    INTO v_bad
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.swipes'::regclass
     AND t.tgname = 'trigger_notify_super_like'
     AND t.tgtype <> 5;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.swipes'::regclass AND tgname = 'trigger_notify_super_like') THEN
    RAISE EXCEPTION 'MEXA-401: trigger_notify_super_like is missing from public.swipes - nothing queues the push this file retracts';
  END IF;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-401: trigger_notify_super_like is not a row-level AFTER INSERT (tgtype should be 5): %', v_bad;
  END IF;

  -- 0h. The DEFINER role can actually delete from the table. All four of these have to
  -- hold or the new statement is a no-op that still reports a successful rewind:
  --   owner match + no FORCE RLS  -> the empty policy set does not filter the owner
  --   BYPASSRLS                   -> belt and braces on the same point
  --   DELETE privilege            -> the grant itself
  SELECT string_agg(format('fn_owner=%s table_owner=%s force_rls=%s bypassrls=%s can_delete=%s',
                           pg_get_userbyid(p.proowner),
                           pg_get_userbyid(c.relowner),
                           c.relforcerowsecurity,
                           r.rolbypassrls,
                           has_table_privilege(p.proowner, c.oid, 'DELETE')), ', ')
    INTO v_bad
    FROM pg_proc p
   CROSS JOIN pg_class c
    JOIN pg_roles r ON r.oid = p.proowner
   WHERE p.oid = to_regprocedure('public.undo_last_swipe()')
     AND c.oid = 'public.notification_queue'::regclass
     AND (p.proowner <> c.relowner
          OR c.relforcerowsecurity
          OR NOT has_table_privilege(p.proowner, c.oid, 'DELETE'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-401: undo_last_swipe()''s owner cannot delete from notification_queue unfiltered: %', v_bad;
  END IF;

  -- 0i. And the table is not client-reachable, which is the reason this write belongs in a
  -- DEFINER function rather than in the client. Zero policies with RLS on denies every
  -- verb to every non-bypassing role.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notification_queue'::regclass) THEN
    RAISE EXCEPTION 'MEXA-401: RLS is not enabled on public.notification_queue - clients would reach it directly and this file is the wrong fix for that';
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_queue';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MEXA-401: public.notification_queue now has % polic(ies) - somebody opened it to clients; reconcile before applying 00033', v_n;
  END IF;
END
$$;

-- =====================================================
-- 1. public.undo_last_swipe(), with the retraction
-- =====================================================
--
-- Byte-for-byte 00025's body plus one guarded DELETE, marked below. The signature, the
-- return type, the flags, the four `reason` values and the grants are all unchanged -
-- `CREATE OR REPLACE` could not change the return type even if this file wanted to.
--
-- `SET search_path = public` is re-stated because `CREATE OR REPLACE` does not clear or
-- refresh `proconfig`, so leaving it off here would be relying on 00025's setting still
-- being there rather than saying so.
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

  -- ------------------------------------------------------------------ MEXA-401 starts
  -- The swipe is gone. Pull the push it queued, if it is still queued.
  --
  -- **Placement is load-bearing, twice over.** It is after the swipe's DELETE so a rewind
  -- that refused or matched nothing retracts nothing - and it is after that DELETE's
  -- `IF NOT FOUND` check, because a DELETE sets FOUND and this one would otherwise
  -- overwrite the answer the check above needs. Nothing below reads FOUND, so this
  -- statement is the last word on it; if a future edit adds a FOUND check after this
  -- point, it is reading *this* DELETE, not the swipe's.
  --
  -- Bounded to rows the caller's own super-like created, still pending, not older than the
  -- swipe. See the header for why each predicate is there and what it rules out. There is
  -- no `IF NOT FOUND` on it on purpose: matching zero rows is the normal case (the queue is
  -- append-only until a drainer exists, and most rewinds are of a plain like), and a rewind
  -- must not start failing because a push had already been marked sent.
  IF v_swipe.action = 'super_like' THEN
    DELETE FROM public.notification_queue
     WHERE user_id = v_swipe.swiped_id
       AND status = 'pending'
       AND data->>'type' = 'super_like'
       AND data->>'userId' = v_swipe.swiper_id::text
       AND created_at >= v_swipe.created_at;
  END IF;
  -- ------------------------------------------------------------------ MEXA-401 ends

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_swipe.id, v_swipe.swiped_id, v_swipe.action, v_swipe.created_at;
END;
$$;

COMMENT ON FUNCTION public.undo_last_swipe() IS
  'Rewind: deletes the calling user''s most recent swipe if it is under 30 seconds old and the pair has not matched (MEXA-314). SECURITY DEFINER and argument-less, so identity comes from current_app_user_id() and a caller cannot aim it at anyone else - which is why public.swipes needs no DELETE policy and no DELETE grant for authenticated. Returns one row: ok, plus reason in (no_swipe, too_old, matched) when it refuses. On a rewound super_like it also deletes the still-pending public.notification_queue row that trigger_notify_super_like queued for the swiped user (MEXA-401) - only status=''pending'', only rows whose data->>''userId'' is the caller, and never a sent one. That DELETE is the only client-reachable write to notification_queue; do not give the table a client grant or policy instead.';

-- =====================================================
-- 2. Ledger row, in this transaction (MEXA-325)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00033', 'rewind_retracts_super_like_notification')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. Assert the result, in the same transaction
-- =====================================================
--
-- Catalog assertions only. That a real caller's rewind actually removes the queue row is
-- proven by executing it - see the rehearsal named on MEXA-401 - because a function that
-- compiles with the right flags can still filter the wrong rows.

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
  v_src TEXT;
BEGIN
  -- 3a. Same flags as before. A `CREATE OR REPLACE` that lost `search_path` would leave a
  -- DEFINER function that a caller's `pg_temp` could shadow.
  SELECT string_agg(format('secdef=%s config=%s volatile=%s nargs=%s',
                           p.prosecdef, p.proconfig, p.provolatile, p.pronargs), ', ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.undo_last_swipe()')
     AND (p.prosecdef IS NOT TRUE
          OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']
          OR p.provolatile <> 'v'
          OR p.pronargs <> 0);
  IF to_regprocedure('public.undo_last_swipe()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-401: public.undo_last_swipe() is gone';
  END IF;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-401: undo_last_swipe() has the wrong flags after the replace: %', v_bad;
  END IF;

  -- 3b. Still one function of that name, still the same six output columns in the same
  -- order. `CREATE OR REPLACE` cannot change a return type, but it *can* silently create a
  -- second function if the argument list differs, and that would be a second endpoint.
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname = 'undo_last_swipe';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-401: % functions named undo_last_swipe in public, expected 1', v_n;
  END IF;

  SELECT pg_get_function_result(to_regprocedure('public.undo_last_swipe()')) INTO v_bad;
  IF v_bad IS DISTINCT FROM 'TABLE(ok boolean, reason text, swipe_id uuid, swiped_id uuid, action text, swiped_at timestamp with time zone)' THEN
    RAISE EXCEPTION 'MEXA-401: undo_last_swipe() now returns [%] - the client contract changed', v_bad;
  END IF;

  -- 3c. The body is the one intended: the retraction is in, and none of 00025's four
  -- outcomes was dropped on the way through.
  SELECT p.prosrc INTO v_src FROM pg_proc p WHERE p.oid = to_regprocedure('public.undo_last_swipe()');
  IF v_src NOT LIKE '%DELETE FROM public.notification_queue%' THEN
    RAISE EXCEPTION 'MEXA-401: undo_last_swipe() does not delete from notification_queue - the replace did not take';
  END IF;
  IF v_src NOT LIKE '%v_swipe.action = ''super_like''%' THEN
    RAISE EXCEPTION 'MEXA-401: the retraction is not guarded on action = super_like';
  END IF;
  IF v_src NOT LIKE '%status = ''pending''%' THEN
    RAISE EXCEPTION 'MEXA-401: the retraction is not restricted to pending rows - it could delete a sent notification';
  END IF;
  IF v_src NOT LIKE '%data->>''userId'' = v_swipe.swiper_id::text%' THEN
    RAISE EXCEPTION 'MEXA-401: the retraction is not pinned to the caller''s own id - it could reach another user''s queued push';
  END IF;
  IF v_src NOT LIKE '%DELETE FROM public.swipes WHERE id = v_swipe.id%'
     OR v_src NOT LIKE '%''too_old''%'
     OR v_src NOT LIKE '%''matched''%'
     OR v_src NOT LIKE '%''no_swipe''%' THEN
    RAISE EXCEPTION 'MEXA-401: 00025''s swipe DELETE or one of its refusal reasons is missing from the replaced body';
  END IF;

  -- 3d. Nothing about who may call it changed: `authenticated` and the owner, nobody else.
  IF (SELECT p.proacl FROM pg_proc p WHERE p.oid = to_regprocedure('public.undo_last_swipe()')) IS NULL THEN
    RAISE EXCEPTION 'MEXA-401: undo_last_swipe() has no explicit ACL, which for a function means EXECUTE TO PUBLIC';
  END IF;

  SELECT string_agg(CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END, ', '
                    ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END)
    INTO v_bad
    FROM pg_proc p
   CROSS JOIN aclexplode(p.proacl) a
   WHERE p.oid = to_regprocedure('public.undo_last_swipe()')
     AND a.privilege_type = 'EXECUTE'
     AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) <> 'authenticated')
     AND a.grantee <> p.proowner;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-401: EXECUTE on undo_last_swipe() is held by [%] besides authenticated and the owner', v_bad;
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.undo_last_swipe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-401: authenticated cannot EXECUTE undo_last_swipe() - Rewind would 403 for every real caller';
  END IF;
  IF has_function_privilege('anon', 'public.undo_last_swipe()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.undo_last_swipe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-401: anon or service_role regained EXECUTE on undo_last_swipe()';
  END IF;

  -- 3e. `notification_queue` did not become client-reachable. This file adds a DEFINER
  -- write, not an access path: still RLS on, still zero policies.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notification_queue'::regclass) THEN
    RAISE EXCEPTION 'MEXA-401: RLS is no longer enabled on public.notification_queue';
  END IF;
  SELECT count(*) INTO v_n
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_queue';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MEXA-401: public.notification_queue has % polic(ies) - 00033 must not add one', v_n;
  END IF;

  -- 3f. `swipes` is untouched: still exactly 00002's two policies. Same assertion 00025
  -- makes, for the same reason - this file must not quietly become the policy route.
  SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname)
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'swipes';
  IF v_bad IS DISTINCT FROM 'Users can create swipes:INSERT, Users can view own swipes:SELECT' THEN
    RAISE EXCEPTION 'MEXA-401: public.swipes policies are now [%] - 00033 must not change them', v_bad;
  END IF;

  -- 3g. The ledger row this file writes.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00033') THEN
    RAISE EXCEPTION 'MEXA-401: ledger row 00033 is missing';
  END IF;

  -- 3h. The function comment carries the rule, so the next person reaching for a client
  -- grant on notification_queue reads why not.
  IF obj_description(to_regprocedure('public.undo_last_swipe()'), 'pg_proc') NOT LIKE '%notification_queue%' THEN
    RAISE EXCEPTION 'MEXA-401: undo_last_swipe()''s comment does not mention notification_queue';
  END IF;
END
$$;

COMMIT;
