-- Mazal - the swipe and super-like caps, and the Rewind gate, enforced on the server
--
-- MEXA-373 Phase 1, Gojo's items 2, 3 and 5. `00032` created `public.has_entitlement(text)`,
-- the thing to check. This file is the first code that checks it.
--
-- Before this, the whole of Mazal's paid enforcement was a zustand store on the device:
-- `useSwipeLimits()` decides `canSwipe`, `useCanRewind()` decides whether the Rewind button
-- does anything, and the `swipes` INSERT policy's entire `WITH CHECK` is `swiper_id = me`.
-- A patched client, or anything holding the anon key and a real session, had unlimited
-- swipes, unlimited super-likes and unlimited rewinds.
--
-- =====================================================
-- The numbers, and where they come from
-- =====================================================
--
-- `FEATURE_LIMITS` in `src/lib/config/revenuecat.ts`, which is what `premiumStore` actually
-- counts against:
--
--   free            dailySwipes 25     superLikesPerWeek 1
--   mazal_gold      dailySwipes Inf    superLikesPerWeek 5
--   mazal_platinum  dailySwipes Inf    superLikesPerWeek 5
--
-- **Not** `FREE_TIER` in `src/lib/constants/app.ts`. That constant says `dailyLikes: 25` and
-- `superLikesPerDay: 1`, and `git grep FREE_TIER` finds **only its own definition** - nothing
-- imports it. Gojo's scope quoted it by mistake and corrected himself on MEXA-373. The same
-- commit as this migration tombstones it so nobody quotes it a third time.
--
-- **Passes count against the daily cap**, because the device counts them: all five swipe
-- handlers in `app/(tabs)/index.tsx` call `useSwipeLimit()` before dispatching, including the
-- two `action: 'pass'` ones. The constant is `dailySwipes`, not `dailyLikes`.
--
-- =====================================================
-- READ THIS BEFORE APPROVING: the daily cap is NOT "what the device already enforces"
-- =====================================================
--
-- Gojo's instruction was "the server enforces exactly what the device already enforces, so
-- the client just stops being the only thing enforcing it - nothing a user sees changes".
-- For super-likes that is true. For the daily swipe cap it is **not**, and the difference is
-- a real one that wants a decision rather than a quiet choice by me.
--
-- Measured in `src/stores/premiumStore.ts`:
--
--   * `resetDailySwipes()` is **declared and defined and never called** - `grep -rn` finds
--     only the interface line and the implementation. Nothing resets the daily counter.
--   * `checkAndResetLimits()` only compares `weekStartDate`, and the `resetWeeklyLimits()`
--     it calls sets `superLikesRemaining`, `boostsRemaining` and `weekStartDate` - it does
--     **not** touch `dailySwipesRemaining`.
--   * `premiumStore`'s own `getDayStart()` (line 62) is dead; only `saftaPremiumStore` has a
--     live one.
--   * What *does* reset it is `setEntitlements()`, which `usePremium()` runs from a mount
--     effect via `loadCustomerInfo()`. So in practice the free allowance refills **every time
--     the premium hook mounts** - roughly, every app launch.
--
-- So today a free user gets 25 swipes, relaunches, and gets 25 more, indefinitely. The
-- device's cap is "25 per app session". A server cannot express that - there is no session -
-- and it should not try to.
--
-- This file therefore enforces **25 per UTC day**, which is the rule Gojo stated in words
-- ("25 swipes a day") and the meaning of the constant's name. Consequences, stated plainly:
--
--   * For a free user who swipes more than 25 times a day across several launches, this is a
--     **real tightening**, and it is the only part of Phase 1 that is. There are 0 users and
--     no TestFlight build, so nothing is being taken from anybody today.
--   * The device will keep refusing at 25-per-session, which is stricter than 25-per-day in
--     a single session, so the server cap only ever bites a client that is not enforcing -
--     which is the point.
--   * If the answer is "no, match the session behaviour", the honest server equivalent is
--     *no daily cap at all*, and then item 2 is only the super-like cap. Say so and I will
--     cut it down; the trigger is one `IF` away from that.
--
-- The client-side reset bug is filed separately rather than fixed here, because fixing it
-- makes the device stricter and that is a product change, not a migration.
--
-- =====================================================
-- Windows, and why the week is shifted 14 hours
-- =====================================================
--
-- The day is `date_trunc('day', now())` in **UTC**. The device has no daily reset at all (see
-- above), so there is no device behaviour to match and UTC is simply the unambiguous choice.
--
-- The week is the ISO week (Monday) in UTC, **minus 14 hours**. The device's
-- `getWeekStart()` is Monday 00:00 in the *device's local time*, which the server cannot
-- know. Monday 00:00 local falls anywhere from Sunday 10:00 UTC (UTC+14) to Monday 12:00 UTC
-- (UTC-12). Taking the earliest of those - Monday-00:00-UTC minus 14 hours - guarantees the
-- server's window has **already reset whenever any device's has**, so the server can never
-- refuse a super-like that the user's own app is offering them. It is deliberately the
-- generous end: this cap exists to stop a patched client taking thousands, not to be a second
-- precise accountant.
--
-- =====================================================
-- Why a BEFORE INSERT trigger, and why it takes a lock
-- =====================================================
--
-- The cap has to live on the `swipes` INSERT path, because that is the path the client uses
-- (`performSwipe` in `src/api/mutations/useSwipe.ts` inserts directly) and `00016` keeps
-- `swipes` append-only for clients. A policy `WITH CHECK` cannot do it: it would have to
-- count rows in the table it is gating, and it could not report *which* cap was hit.
--
-- **Count-then-insert is not safe on its own.** Two concurrent inserts both count 24 and both
-- proceed, which is how 19 got past a cap of 10 on the dashboard. So the trigger takes
-- `pg_advisory_xact_lock` on the swiper first, once, before any counting - transaction-scoped,
-- so it is released at COMMIT or ROLLBACK with no unlock path to forget. It serialises only
-- that one user's inserts. Section 3's rehearsal fires a parallel burst, not a sequential
-- loop, because a sequential test cannot fail this way and so cannot prove anything about it.
--
-- `BEFORE INSERT` specifically, and only INSERT: `public.swipes` cascades from
-- `public.users`, and a trigger that RAISEs on DELETE would block account deletion. This one
-- never fires on DELETE, so `undo_last_swipe()` and the account-deletion cascade are
-- untouched. A rewind deleting the row also gives the swipe back to the allowance for free,
-- because the cap counts rows rather than keeping a counter.
--
-- =====================================================
-- One predicate, two entry points
-- =====================================================
--
-- The trigger cannot use `has_entitlement(text)`: that function answers about **the caller**,
-- deliberately taking no user id, and the quota belongs to `NEW.swiper_id` - the row's owner,
-- who is the caller today only because the INSERT policy says so. Writing the predicate out a
-- second time is how the two drift apart (`00026` makes the same argument about
-- `pending_likers()`), so instead:
--
--   * `public.user_has_entitlement(uuid, text)` is the predicate, and it is the only copy.
--     EXECUTE is revoked from PUBLIC, `anon`, `authenticated` **and** `service_role` - it
--     takes a user id, so it must never be reachable by a client. It is called only from
--     other SECURITY DEFINER functions, which run as the owner.
--   * `public.has_entitlement(text)` is re-created as a one-line wrapper over it, same
--     signature, same flags, same grants, same external behaviour. `00032`'s own rehearsal
--     probes are re-run against the wrapper in section 3 to prove the contract did not move.
--
-- =====================================================
-- What this file deliberately does NOT do
-- =====================================================
--
--  * **It does not touch `public.subscriptions`** - not the CHECK, not the grants, not the
--    policy. Section 0 re-asserts `00032`'s guard 0f (no client-write policy) because this
--    file makes that invariant load-bearing in a second place: an entitlement now lifts a
--    cap, so a self-granted row would now buy something.
--  * **No boost cap and no read-receipt gate.** Boost has no server side at all and read
--    receipts cannot be gated as built - both measured on MEXA-373 and both on Lelouch's
--    "Waiting on Itai" line.
--  * **No `get_who_liked_me()` gate.** `00026` is still unapplied; its header specifies that
--    the gate goes there and that `count_who_liked_me()` stays free.
--  * **No change to prices, tiers or anything on the paywall.** The scope fence.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 0a. Not already applied.
  IF to_regprocedure('public.swipes_enforce_quota()') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373: public.swipes_enforce_quota() already exists - 00035 is already applied';
  END IF;

  -- 0b. 00032 is applied and is the shape this file re-creates.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00032') THEN
    RAISE EXCEPTION 'MEXA-373: 00032 (has_entitlement) is not in the ledger - apply it first';
  END IF;
  IF to_regprocedure('public.has_entitlement(text)') IS NULL THEN
    RAISE EXCEPTION 'MEXA-373: public.has_entitlement(text) is missing though 00032 is in the ledger';
  END IF;

  -- 0c. **00033 is a hard dependency, and this is the guard that earns its place.** This file
  -- CREATE OR REPLACEs `undo_last_swipe()`, and the body it replaces it with is 00033's -
  -- including MEXA-401's retraction of the still-pending super-like push. Applying 00035 to a
  -- database where 00033 has not run would install that retraction early (harmless: it
  -- deletes rows that match nothing until 00033's own index exists). Applying 00033 AFTER
  -- 00035 would silently drop this file's entitlement gate, because 00033's body does not
  -- have it. Order is therefore not cosmetic, and an out-of-order apply must abort rather
  -- than quietly un-gate a paid feature.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00033') THEN
    RAISE EXCEPTION 'MEXA-373: 00033 (rewind_retracts_super_like_notification) is not in the ledger. 00035 rewrites undo_last_swipe() on top of 00033''s body; applying them the other way round would drop this file''s entitlement gate. Apply 00033 first.';
  END IF;

  -- 0d. 00025's function is there to be replaced, and it still returns the shape the client
  -- reads. Adding a `reason` value is compatible; changing the column list would not be.
  IF to_regprocedure('public.undo_last_swipe()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-373: public.undo_last_swipe() is missing - apply 00025 first';
  END IF;

  SELECT string_agg(a, ', ' ORDER BY o) INTO v_bad
    FROM unnest(
      ARRAY['ok','reason','swipe_id','swiped_id','action','swiped_at'],
      ARRAY[1,2,3,4,5,6]
    ) AS t(a, o)
   WHERE NOT EXISTS (
     SELECT 1 FROM unnest((SELECT proargnames FROM pg_proc WHERE oid = to_regprocedure('public.undo_last_swipe()'))) AS n
      WHERE n = t.a
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373: undo_last_swipe() does not return the expected column(s) [%] - the client reads them by name', v_bad;
  END IF;

  -- 0e. `swipes` is the shape the trigger counts over.
  IF to_regclass('public.swipes') IS NULL THEN
    RAISE EXCEPTION 'MEXA-373: public.swipes is missing';
  END IF;

  SELECT string_agg(c.n, ', ') INTO v_bad
    FROM (VALUES ('swiper_id'), ('action'), ('created_at')) AS c(n)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public' AND ic.table_name = 'swipes' AND ic.column_name = c.n
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373: public.swipes has no column(s) [%]', v_bad;
  END IF;

  -- `super_like` has to be a value the column can hold, or the super-like branch is dead code.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.swipes'::regclass AND conname = 'swipes_action_check'
       AND pg_get_constraintdef(oid) LIKE '%''super_like''%'
  ) THEN
    RAISE EXCEPTION 'MEXA-373: swipes_action_check no longer admits ''super_like''';
  END IF;

  -- 0f. No BEFORE INSERT trigger already on the table. The two known ones are AFTER INSERT
  -- (`swipes_check_match`, `trigger_notify_super_like`) and this file must not disturb them:
  -- a BEFORE trigger that refuses stops them firing, which is correct, but a *second* BEFORE
  -- trigger would make the order of two refusals undefined.
  SELECT string_agg(tgname, ', '), count(*) INTO v_bad, v_n
    FROM pg_trigger
   WHERE tgrelid = 'public.swipes'::regclass AND NOT tgisinternal
     AND (tgtype & 2) <> 0;   -- BEFORE
  IF v_n > 0 THEN
    RAISE EXCEPTION 'MEXA-373: public.swipes already has % BEFORE trigger(s) [%] - resolve the ordering before adding another', v_n, v_bad;
  END IF;

  SELECT count(*) INTO v_n FROM pg_trigger
   WHERE tgrelid = 'public.swipes'::regclass AND NOT tgisinternal;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'MEXA-373: expected exactly 2 existing triggers on public.swipes (check_match, notify_super_like), found %', v_n;
  END IF;

  -- 0g. 00032's guard 0f, restated. This file gives an entitlement the power to lift a cap,
  -- so a client that could write its own subscriptions row would now be buying something.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'subscriptions' AND cmd <> 'SELECT';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'MEXA-373: public.subscriptions has % client-write polic(ies) - a client could grant itself premium and lift its own cap; fix that before making entitlements load-bearing', v_n;
  END IF;
END $$;

-- =====================================================
-- 1. One predicate, two entry points
-- =====================================================

CREATE OR REPLACE FUNCTION public.user_has_entitlement(p_user_id UUID, p_entitlement TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.subscriptions s
     WHERE s.user_id    = p_user_id
       AND s.plan_type  = p_entitlement
       AND s.status     = 'active'
       AND s.expires_at > now()
  );
$$;

COMMENT ON FUNCTION public.user_has_entitlement(UUID, TEXT) IS
  'MEXA-373. The entitlement predicate, and the only copy of it. Answers about the user id '
  'passed in, so it is INTERNAL: EXECUTE is revoked from PUBLIC, anon, authenticated and '
  'service_role, and it is called only from other SECURITY DEFINER functions. Clients use '
  'public.has_entitlement(text), which takes no user id and asks about the caller. '
  'Do not grant this to a client role.';

-- It takes a user id, so no client may call it. Supabase's ALTER DEFAULT PRIVILEGES grants
-- EXECUTE on every new function in public to anon, authenticated and service_role at CREATE
-- time, so this REVOKE is doing real work, not documenting an absence.
REVOKE EXECUTE ON FUNCTION public.user_has_entitlement(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;

-- `has_entitlement(text)` keeps its signature, flags, comment and grants; only its body
-- changes, to delegate. CREATE OR REPLACE preserves the ACL, and section 3 asserts that
-- rather than assuming it. It also does not clear proconfig, so the pin is restated
-- explicitly and asserted.
CREATE OR REPLACE FUNCTION public.has_entitlement(p_entitlement TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.user_has_entitlement(public.current_app_user_id(), p_entitlement);
$$;

-- =====================================================
-- 2. The quota trigger
-- =====================================================

CREATE OR REPLACE FUNCTION public.swipes_enforce_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- FEATURE_LIMITS in src/lib/config/revenuecat.ts. See the header for why these and not
  -- FREE_TIER, and for the `Infinity` that becomes "no check at all" below.
  c_free_daily_swipes   CONSTANT INTEGER  := 25;
  c_free_weekly_supers  CONSTANT INTEGER  := 1;
  c_paid_weekly_supers  CONSTANT INTEGER  := 5;
  -- Monday 00:00 UTC is later than Monday 00:00 in every timezone east of UTC; 14 hours is
  -- the largest such offset (UTC+14). See the header.
  c_week_backstop       CONSTANT INTERVAL := INTERVAL '14 hours';

  v_role      TEXT := COALESCE(current_setting('role', true), 'none');
  v_entitled  BOOLEAN;
  v_window    TIMESTAMPTZ;
  v_used      INTEGER;
  v_cap       INTEGER;
BEGIN
  -- `service_role` is the platform, not a person: backfills, seeds and anything server-side
  -- are not somebody's daily allowance. Measured rather than assumed - inside a SECURITY
  -- DEFINER function `current_user` and `session_user` both report the *definer* (postgres),
  -- so neither identifies the caller; `current_setting('role')` returns what PostgREST's
  -- `SET LOCAL ROLE` put there, which is derived from the verified JWT and is not a
  -- client-supplied value. A user cannot reach this branch without the service key.
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- The quota belongs to the row's swiper, not to whoever ran the INSERT. For a client those
  -- are the same - the INSERT policy's WITH CHECK is `swiper_id = me` - but this function
  -- must not depend on that policy still being there to be correct.
  v_entitled := public.user_has_entitlement(NEW.swiper_id, 'mazal_gold')
             OR public.user_has_entitlement(NEW.swiper_id, 'mazal_platinum');

  -- Serialise this swiper before counting anything. Count-then-insert without this lets a
  -- parallel burst straight through both caps below. Transaction-scoped: released on COMMIT
  -- or ROLLBACK, with no unlock call to forget. Keyed on the swiper only, so two different
  -- users never contend.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.swiper_id::TEXT, 0));

  -- ---------------------------------------------------------------- super-likes, per week
  IF NEW.action = 'super_like' THEN
    v_cap    := CASE WHEN v_entitled THEN c_paid_weekly_supers ELSE c_free_weekly_supers END;
    v_window := (date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') - c_week_backstop;

    SELECT count(*) INTO v_used
      FROM public.swipes s
     WHERE s.swiper_id  = NEW.swiper_id
       AND s.action     = 'super_like'
       AND s.created_at >= v_window;

    IF v_used >= v_cap THEN
      RAISE EXCEPTION
        'Super Like limit reached: % of % used this week', v_used, v_cap
        USING ERRCODE = 'P0001',
              DETAIL  = 'super_like_weekly_cap',
              HINT    = 'Gold and Platinum get 5 Super Likes a week.';
    END IF;
  END IF;

  -- ---------------------------------------------------------------- all swipes, per day
  -- Entitled plans are `dailySwipes: Infinity`, so there is no cap to check rather than a
  -- very large one - no counting, no lock contention, no arbitrary ceiling to discover later.
  IF NOT v_entitled THEN
    v_window := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

    -- Every action, `pass` included, because the device counts passes. See the header.
    SELECT count(*) INTO v_used
      FROM public.swipes s
     WHERE s.swiper_id  = NEW.swiper_id
       AND s.created_at >= v_window;

    IF v_used >= c_free_daily_swipes THEN
      RAISE EXCEPTION
        'Daily swipe limit reached: % of % used today', v_used, c_free_daily_swipes
        USING ERRCODE = 'P0001',
              DETAIL  = 'swipe_daily_cap',
              HINT    = 'Gold and Platinum have unlimited swipes.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.swipes_enforce_quota() IS
  'MEXA-373. BEFORE INSERT on public.swipes: enforces FEATURE_LIMITS server-side. Free = 25 '
  'swipes per UTC day (every action, passes included) and 1 super like per week; '
  'mazal_gold/mazal_platinum = unlimited swipes and 5 super likes per week. The week starts '
  'at Monday 00:00 UTC minus 14 hours so it has always reset before any device timezone''s '
  'Monday. Takes pg_advisory_xact_lock on the swiper before counting, because count-then-'
  'insert alone lets a parallel burst past the cap. service_role is exempt. Refusals are '
  'RAISE with ERRCODE P0001 and a stable token in DETAIL: swipe_daily_cap or '
  'super_like_weekly_cap - the client branches on DETAIL, not on the HTTP status.';

REVOKE EXECUTE ON FUNCTION public.swipes_enforce_quota() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER swipes_enforce_quota
  BEFORE INSERT ON public.swipes
  FOR EACH ROW
  EXECUTE FUNCTION public.swipes_enforce_quota();

-- =====================================================
-- 3. Rewind checks the entitlement
-- =====================================================
--
-- This is 00033's body with one block added. Everything else is byte-for-byte 00033's, and
-- guard 0c refuses to run if 00033 is not applied, so the MEXA-401 retraction below cannot be
-- lost by applying these two out of order.
--
-- The gate is placed immediately after the caller check and before the swipe is read: a
-- caller with no entitlement gets the same answer whether or not they have a recent swipe, so
-- the refusal discloses nothing, and it costs no row read.
--
-- `FEATURE_LIMITS.free.canRewind` is false and `useCanRewind()` is
-- `plan === 'mazal_gold' || 'mazal_platinum'`, so this takes nothing from anybody the button
-- already serves. It does change `DEV_BYPASS_PREMIUM` builds, where `__DEV__` shows the
-- button: the server will now refuse them unless the test account has a subscriptions row.

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

  -- ------------------------------------------------------------------ MEXA-373 starts
  -- Rewind is a paid feature (FEATURE_LIMITS.free.canRewind = false). Reported as data, like
  -- every other refusal here, so the client gets a reason rather than an exception to parse.
  IF NOT (public.has_entitlement('mazal_gold') OR public.has_entitlement('mazal_platinum')) THEN
    RETURN QUERY SELECT FALSE, 'not_entitled'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  -- ------------------------------------------------------------------ MEXA-373 ends

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
  -- swipe. See 00033's header for why each predicate is there and what it rules out. There is
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
  'Rewind: deletes the calling user''s most recent swipe if it is under 30 seconds old and the pair has not matched (MEXA-314). SECURITY DEFINER and argument-less, so identity comes from current_app_user_id() and a caller cannot aim it at anyone else - which is why public.swipes needs no DELETE policy and no DELETE grant for authenticated. Rewind is a paid feature: it refuses with reason ''not_entitled'' unless public.has_entitlement() reports mazal_gold or mazal_platinum (MEXA-373). Returns one row: ok, plus reason in (not_entitled, no_swipe, too_old, matched) when it refuses. On a rewound super_like it also deletes the still-pending public.notification_queue row that trigger_notify_super_like queued for the swiped user (MEXA-401) - only status=''pending'', only rows whose data->>''userId'' is the caller, and never a sent one. That DELETE is the only client-reachable write to notification_queue; do not give the table a client grant or policy instead.';

-- =====================================================
-- 4. Ledger row, in this transaction (MEXA-325)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00035', 'server_side_swipe_quota')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. Assert the result, in the same transaction
-- =====================================================
--
-- Catalog assertions only. What a real capped caller actually gets is proven by executing
-- it - including a parallel burst, which is the only thing that can catch the race the
-- advisory lock exists for. See the rehearsal named in supabase/MIGRATIONS.md.

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 5a. The trigger exists, is BEFORE INSERT, FOR EACH ROW, and is the only BEFORE trigger.
  SELECT count(*) INTO v_n FROM pg_trigger
   WHERE tgrelid = 'public.swipes'::regclass AND NOT tgisinternal AND tgname = 'swipes_enforce_quota'
     AND (tgtype & 2) <> 0 AND (tgtype & 4) <> 0 AND (tgtype & 1) <> 0;  -- BEFORE, INSERT, ROW
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-373 5a: swipes_enforce_quota is not a single BEFORE INSERT FOR EACH ROW trigger (found %)', v_n;
  END IF;

  -- The two AFTER triggers are still there and still AFTER. A BEFORE trigger that refused
  -- would stop them firing, which is intended; losing them would not be.
  SELECT count(*) INTO v_n FROM pg_trigger
   WHERE tgrelid = 'public.swipes'::regclass AND NOT tgisinternal
     AND tgname IN ('swipes_check_match', 'trigger_notify_super_like') AND (tgtype & 2) = 0;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'MEXA-373 5a: the two AFTER INSERT triggers on public.swipes are not both intact (found %)', v_n;
  END IF;

  -- 5b. All three functions are DEFINER and pinned with pg_temp last, except undo_last_swipe,
  -- which keeps 00025/00033's `public` pin - changing it is MEXA-319's job, not a passenger
  -- on this file, and its body schema-qualifies every relation it names.
  SELECT string_agg(format('%s(secdef=%s config=%s)', p.proname, p.prosecdef, p.proconfig), ', ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid IN (to_regprocedure('public.user_has_entitlement(uuid,text)'),
                   to_regprocedure('public.has_entitlement(text)'),
                   to_regprocedure('public.swipes_enforce_quota()'))
     AND (p.prosecdef IS NOT TRUE
          OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373 5b: not DEFINER with search_path=public, pg_temp: %', v_bad;
  END IF;

  -- 5c. `user_has_entitlement` is reachable by no client role. It takes a user id, so this is
  -- the assertion that keeps 00032's "nobody can ask about anybody else" true.
  FOREACH v_bad IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_function_privilege(v_bad, 'public.user_has_entitlement(uuid,text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'MEXA-373 5c: % can EXECUTE user_has_entitlement(uuid,text)', v_bad;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
     WHERE p.oid = to_regprocedure('public.user_has_entitlement(uuid,text)')
       AND a.privilege_type = 'EXECUTE' AND a.grantee = 0
  ) THEN
    RAISE EXCEPTION 'MEXA-373 5c: PUBLIC holds EXECUTE on user_has_entitlement(uuid,text)';
  END IF;
  IF (SELECT proacl FROM pg_proc WHERE oid = to_regprocedure('public.user_has_entitlement(uuid,text)')) IS NULL THEN
    RAISE EXCEPTION 'MEXA-373 5c: user_has_entitlement has no explicit ACL, which means EXECUTE TO PUBLIC';
  END IF;

  -- The trigger function likewise: it is only ever called by the trigger.
  FOREACH v_bad IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_function_privilege(v_bad, 'public.swipes_enforce_quota()', 'EXECUTE') THEN
      RAISE EXCEPTION 'MEXA-373 5c: % can EXECUTE swipes_enforce_quota()', v_bad;
    END IF;
  END LOOP;

  -- 5d. **has_entitlement's public contract did not move.** CREATE OR REPLACE preserves the
  -- ACL, but that is a thing to assert, not to assume - this file rewrote a function that is
  -- already applied and already reviewed.
  IF has_function_privilege('authenticated', 'public.has_entitlement(text)', 'EXECUTE') IS NOT TRUE THEN
    RAISE EXCEPTION 'MEXA-373 5d: authenticated lost EXECUTE on has_entitlement(text)';
  END IF;
  IF has_function_privilege('anon', 'public.has_entitlement(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-373 5d: anon gained EXECUTE on has_entitlement(text)';
  END IF;
  IF has_function_privilege('service_role', 'public.has_entitlement(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-373 5d: service_role gained EXECUTE on has_entitlement(text)';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'has_entitlement') <> 1 THEN
    RAISE EXCEPTION 'MEXA-373 5d: has_entitlement no longer has exactly one signature';
  END IF;
  -- Still fail-closed against an empty table, as the migration role (no public.users row).
  IF public.has_entitlement('mazal_gold') OR public.has_entitlement(NULL) THEN
    RAISE EXCEPTION 'MEXA-373 5d: has_entitlement returned true for a caller with no row';
  END IF;

  -- 5e. undo_last_swipe still returns the six columns the client reads by name, and its
  -- comment names the new reason.
  SELECT string_agg(a, ', ') INTO v_bad
    FROM unnest(ARRAY['ok','reason','swipe_id','swiped_id','action','swiped_at']) AS t(a)
   WHERE NOT EXISTS (
     SELECT 1 FROM unnest((SELECT proargnames FROM pg_proc WHERE oid = to_regprocedure('public.undo_last_swipe()'))) AS n
      WHERE n = t.a
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-373 5e: undo_last_swipe() lost return column(s) [%]', v_bad;
  END IF;
  IF obj_description(to_regprocedure('public.undo_last_swipe()'), 'pg_proc') NOT LIKE '%not_entitled%' THEN
    RAISE EXCEPTION 'MEXA-373 5e: undo_last_swipe()''s comment does not name the not_entitled reason';
  END IF;
  -- MEXA-401's retraction survived the rewrite. This is the assertion guard 0c exists for.
  IF (SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.undo_last_swipe()'))
       NOT LIKE '%notification_queue%' THEN
    RAISE EXCEPTION 'MEXA-373 5e: undo_last_swipe() no longer retracts the super-like push - 00033 was overwritten';
  END IF;

  -- 5f. public.subscriptions and public.swipes are untouched: this file adds a trigger and
  -- functions, no policy and no grant on either table.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'subscriptions';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-373 5f: public.subscriptions has % policies, expected exactly 1', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'swipes';
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'MEXA-373 5f: public.swipes has % policies, expected exactly 2 (00002''s INSERT and SELECT)', v_n;
  END IF;

  -- 5g. The ledger row this file's rollback keys on.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00035') THEN
    RAISE EXCEPTION 'MEXA-373 5g: the 00035 ledger row was not written';
  END IF;
END $$;

COMMIT;
