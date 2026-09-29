-- Mazal - Build "See who likes you", the Gold/Platinum feature the paywall already sells
--
-- MEXA-315. The feature is advertised in three places in the client today -
-- `src/components/premium/FeatureGate.tsx` ("See who likes you, unlimited swipes & more"),
-- `PREMIUM_FEATURES[mazal_gold].features` and `PLAN_COMPARISON` in
-- `src/lib/config/revenuecat.ts` - and behind it there is **a React Query key and nothing
-- else**. `queryKeys.swipes.whoLikedMe()` had exactly one reference in the repo, an
-- `invalidateQueries` inside `useLikesSubscription`, and MEXA-294 deleted that hook because
-- it subscribed to `swipes` cross-side and could never fire. No query function, no hook, no
-- screen, no route. Nothing has ever read "who liked me".
--
-- =====================================================
-- Why this cannot be a policy on `swipes`
-- =====================================================
--
-- The question is `SELECT swiper_id FROM swipes WHERE swiped_id = <me> AND action IN
-- ('like','super_like')`, and no client can run it: since `00002_rls_policies.sql` the only
-- SELECT policy on `swipes` is `Users can view own swipes`, `swiper_id = <me>`. MEXA-294
-- and `00017` both deliberately declined to widen it, for one reason that has not changed:
--
--   **a policy admitting `swiped_id = <me>` publishes `pass` too.** RLS restricts rows, not
--   columns and not values, so "who liked you" and "who rejected you" arrive in the same
--   policy. There is no version of that policy that hands over one and withholds the other.
--
-- So the row rule and the value rule both have to live in something that runs as its owner
-- and answers a narrower question than "your swipes". That is this file: two SECURITY
-- DEFINER functions over a shared internal one, following `00010`'s two rules - identity
-- comes from `public.current_app_user_id()` inside the function and never from an argument,
-- and privileges are stated explicitly because Supabase's `ALTER DEFAULT PRIVILEGES` grants
-- EXECUTE to `anon` on every new function in `public` at creation time.
--
-- `public.swipes` keeps exactly the two policies `00002` gave it. Section 3 asserts that.
--
-- =====================================================
-- What counts as a like you have not answered yet
-- =====================================================
--
-- `public.pending_likers()` is the one place the predicate lives, so the list and the count
-- cannot drift apart. A row survives when all of this holds:
--
--  1. `swiped_id = current_app_user_id()` and `action IN ('like','super_like')`. `pass` is
--     never selected, never counted, and never returned - see above.
--  2. The liker is in `public.user_public_profiles`. That view is the whole of the
--     "may I see this person" rule and this file does not restate any of it: it is
--     `security_invoker = false`, so it runs as `postgres` and applies its own WHERE -
--     `auth.uid() IS NOT NULL`, `is_active = true`, not the caller, and no `blocks` row in
--     either direction. Joining it is what excludes blocked and deactivated likers, and it
--     keeps this feature honest with the deck for free if that rule is ever changed.
--     `auth.uid()` is read from the `request.jwt.claims` GUC, which SECURITY DEFINER does
--     not touch - it changes the role, not the session settings - so the view still sees
--     the caller from inside these functions.
--  3. `onboarding_complete = true`, the same filter `useDiscoveryProfiles` puts on the
--     deck. Somebody mid-onboarding has no photo and no bio; their card would render
--     empty. The column only ever goes false -> true, so this hides nobody permanently.
--  4. The caller has not swiped on them. `swipes` carries `UNIQUE (swiper_id, swiped_id)`,
--     so the caller has at most one swipe per person and its existence means the decision
--     is made: a like back has already produced a match (`swipes_check_match`, DEFINER
--     since `00017`), and a pass is an answer. This list is "people waiting on you",
--     which is the only list with an action attached to it.
--  5. No `matches` row for the pair. Redundant with (4) today - a match requires the
--     caller's own like - but it is one exact lookup on `UNIQUE (user1_id, user2_id)` with
--     `CHECK (user1_id < user2_id)`, and it means a match created by anything other than
--     the caller's swipe row can never surface here as an unanswered like. `is_active` is
--     deliberately not consulted: unmatching does not put somebody back in this list, the
--     same rule `00025` applies to rewind.
--
-- =====================================================
-- The count is free and the list is paid
-- =====================================================
--
-- `count_who_liked_me()` and `get_who_liked_me()` are separate endpoints on purpose, and
-- the split is the product, not just paging:
--
--   * The **count** is the upsell. "12 people like you" is what makes the paywall worth
--     tapping, so it is deliberately available to every signed-in caller, free or paid.
--     It returns an integer and names nobody.
--   * The **list** is the paid surface, and a badge that had to download 200 profiles to
--     render a number would be the wrong shape anyway.
--
-- **Neither function checks an entitlement, because there is nothing server-side to check.**
-- `public.subscriptions` is RevenueCat's webhook table, no webhook is deployed, and
-- `00016` confirms the client holds no write on it - so it is empty and a server-side gate
-- would refuse every paying user. `users.orthodox_subscription_status` has no purchase
-- behind it either (MEXA-292). The gate is `useCanSeeLikes()` on the device, reading the
-- RevenueCat SDK, exactly as Rewind is gated (`00025` section "What this file deliberately
-- does NOT do"). That means a free user who calls `/rest/v1/rpc/get_who_liked_me` directly
-- gets the list. **That is a revenue leak and not a privacy leak**, and the distinction is
-- the reason this ships that way:
--
--   * The only thing it discloses is inbound likes aimed at the caller. Liking somebody on
--     a dating app is an act directed at that person, and Mazal already shows it to them
--     for free the moment it is mutual. Nobody's data reaches a third party.
--   * `pass` never leaves the database whatever the caller has paid, so the one disclosure
--     the policy route would have created does not exist here either.
--   * Every other row rule - blocks, deactivation, the caller's own identity - is enforced
--     server-side by (1)-(5) above and by the view, and none of it depends on the device.
--
-- Closing the revenue side is **MEXA-373** (premium entitlements are enforced on the device
-- only, because `public.subscriptions` has no writer). When that lands, the gate goes in
-- `get_who_liked_me()` and nowhere else: `count_who_liked_me()` stays free by design.
--
-- =====================================================
-- What this file deliberately does NOT do
-- =====================================================
--
--  * **No new policy and no new grant on `public.swipes`.** See the top. Section 3 asserts
--    the table still carries exactly `00002`'s two policies.
--  * **No realtime publication change.** A badge fed by a `postgres_changes` subscription
--    on `swipes` is what MEXA-294 removed and MEXA-313 explains: the caller cannot read the
--    row cross-side, so the event is filtered away before it reaches them, and publishing
--    `swipes` would hand the replication stream `pass` rows as well. The count is polled by
--    the client and invalidated on a swipe. There is no subscription here.
--  * **No new column on any table.** `is_super_like` is derived from `swipes.action` and
--    `liked_at` is `swipes.created_at`; nothing is denormalised and nothing is backfilled.
--  * **No claim on the `public.swipes` comment.** Three files now write it - `00016`,
--    `00025` and this one - and whichever ran last owns the text. `00016` is still
--    unapplied, so applying it after this file will overwrite the sentence below and drop
--    the mention of `get_who_liked_me()`. That is cosmetic and nothing checks for it after
--    apply time; this file's rollback reads the ledger rather than hardcoding one string,
--    the same way `00025`'s does. The rewind sentence here is a forward reference when
--    `00025` is not applied yet - it describes the design, which is where Rewind goes when
--    it lands, and `00026` has no dependency on `00025` in either direction.
--  * **No "seen" state.** A read/unread marker on an incoming like needs a writable table
--    and a product decision about whether the badge should ever go back to zero on its own.
--    The badge is "people waiting on you", which drops when you answer them. Filed
--    separately rather than invented here.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================
--
-- Everything below is a fact the three function bodies rely on. Checking it here means a
-- database that does not match gets an abort rather than functions that compile and then
-- answer the wrong question.

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 0a. Not already applied. Re-running is harmless in itself (CREATE OR REPLACE), but a
  -- second apply means somebody lost track of which state live is in, and 00026's rollback
  -- would then run against a database whose ledger row it did not write.
  IF to_regprocedure('public.pending_likers()') IS NOT NULL
     OR to_regprocedure('public.count_who_liked_me()') IS NOT NULL
     OR to_regprocedure('public.get_who_liked_me(integer,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-315: a who-liked-me function already exists - 00026 is already applied';
  END IF;

  -- 0b. The identity helper from 00010/00008. This is where the caller comes from; no
  -- function in this file takes a user id.
  IF to_regprocedure('public.current_app_user_id()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-315: public.current_app_user_id() is missing - apply 00008/00010 first';
  END IF;

  SELECT string_agg(format('secdef=%s config=%s', p.prosecdef, p.proconfig), ', ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.current_app_user_id()')
     AND (p.prosecdef IS NOT TRUE OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-315: current_app_user_id() is not DEFINER with search_path=public: %', v_bad;
  END IF;

  -- 0c. The view from 00013 exists and is still the "runs as its owner, applies its own
  -- WHERE" shape. If it were ever flipped to security_invoker, the join in section 1 would
  -- be evaluated as `postgres` - which has BYPASSRLS - and the block and is_active rules
  -- this file leans on would quietly stop applying.
  --
  -- Asserted as "security_invoker is not on" rather than "security_invoker=false is
  -- present", because the default is off and a future ALTER VIEW ... RESET would drop the
  -- option from reloptions without changing the behaviour.
  IF to_regclass('public.user_public_profiles') IS NULL THEN
    RAISE EXCEPTION 'MEXA-315: public.user_public_profiles is missing - apply 00013 first';
  END IF;

  SELECT string_agg(t.o, ', ')
    INTO v_bad
    FROM pg_class c
   CROSS JOIN unnest(coalesce(c.reloptions, '{}'::text[])) AS t(o)
   WHERE c.oid = 'public.user_public_profiles'::regclass
     AND lower(t.o) LIKE 'security_invoker=%'
     AND lower(t.o) <> 'security_invoker=false';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-315: user_public_profiles is security_invoker (%) - its WHERE clause would no longer be the row rule this file relies on', v_bad;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_class c
     CROSS JOIN unnest(coalesce(c.reloptions, '{}'::text[])) AS t(o)
     WHERE c.oid = 'public.user_public_profiles'::regclass
       AND lower(t.o) = 'security_barrier=true'
  ) THEN
    RAISE EXCEPTION 'MEXA-315: user_public_profiles has lost security_barrier=true - a leaky qual could then be evaluated against rows its WHERE clause removes';
  END IF;

  -- 0d. Every column section 2 selects out of the view is still there and still called
  -- what it is called here. A rename would otherwise be a runtime error on the first call.
  SELECT string_agg(c.want, ', ' ORDER BY c.want)
    INTO v_bad
    FROM unnest(ARRAY['id','first_name','display_name','date_of_birth','bio','occupation',
                      'current_city','current_state','is_verified','is_photo_verified',
                      'onboarding_complete','distance_miles']) AS c(want)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public'
        AND ic.table_name = 'user_public_profiles'
        AND ic.column_name = c.want
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-315: user_public_profiles has no column(s) [%] - 00026 reads them', v_bad;
  END IF;

  -- 0e. `swipes` is the shape this file reads, and one swipe per pair - which is what makes
  -- rule (4) ("the caller has already answered") exact rather than a scan.
  SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
    INTO v_bad
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'swipes';
  IF v_bad IS DISTINCT FROM 'id,swiper_id,swiped_id,action,created_at' THEN
    RAISE EXCEPTION 'MEXA-315: public.swipes columns are %, not the expected id,swiper_id,swiped_id,action,created_at', v_bad;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.swipes'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) = 'UNIQUE (swiper_id, swiped_id)'
  ) THEN
    RAISE EXCEPTION 'MEXA-315: public.swipes has no UNIQUE (swiper_id, swiped_id) - rule (4) is no longer sound';
  END IF;

  -- 0f. `action` still has exactly the three values this file sorts into "a like" and "not
  -- a like". A fourth value added without touching this file would default to invisible
  -- here, which is the safe direction, but it should be a deliberate choice.
  SELECT pg_get_constraintdef(oid)
    INTO v_bad
    FROM pg_constraint
   WHERE conrelid = 'public.swipes'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%action%';
  IF v_bad IS NULL
     OR v_bad NOT LIKE '%''like''%'
     OR v_bad NOT LIKE '%''super_like''%'
     OR v_bad NOT LIKE '%''pass''%' THEN
    RAISE EXCEPTION 'MEXA-315: public.swipes.action is not the expected like/super_like/pass check: %', coalesce(v_bad, '<none>');
  END IF;

  -- 0g. `matches` stores the pair ordered, which is what rule (5)'s LEAST/GREATEST lookup
  -- leans on. Without it that lookup would miss half the rows.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.matches'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) = 'CHECK ((user1_id < user2_id))'
  ) THEN
    RAISE EXCEPTION 'MEXA-315: public.matches has no CHECK (user1_id < user2_id)';
  END IF;

  -- 0h. RLS is on and nobody has already taken the cross-side-policy route on `swipes`. If
  -- a policy admitting `swiped_id = <me>` exists, "who passed on you" is already published
  -- and this file is the wrong fix for whatever state the database is in.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.swipes'::regclass) THEN
    RAISE EXCEPTION 'MEXA-315: RLS is not enabled on public.swipes';
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'swipes';
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'MEXA-315: public.swipes has % policies, expected 00002''s two - reconcile before applying 00026', v_n;
  END IF;
END
$$;

-- =====================================================
-- 1. public.pending_likers() - the predicate, once
-- =====================================================
--
-- Internal. The list and the count both go through this, so they cannot disagree about who
-- is in it, and the five rules in the header are written down in exactly one place.
--
-- **Not reachable from outside the database.** PostgREST publishes every non-trigger
-- function in `public` at /rest/v1/rpc/<name>, so the endpoint exists; section 3c asserts
-- that no role but the owner can EXECUTE it, which makes every call a 403. It is SECURITY
-- DEFINER and owned by `postgres` anyway, so the two callers - also owned by `postgres` -
-- reach it as the owner regardless of what the client roles hold.
--
-- `STABLE`, not `VOLATILE`: it only reads. `SET search_path = public` per
-- supabase/MIGRATIONS.md; `LEAST` and `GREATEST` are SQL syntax and resolve regardless.
--
-- A caller with no `public.users` row (a Safta account, or mid-signup) makes
-- `current_app_user_id()` NULL, and `s.swiped_id = NULL` is never true, so this returns
-- zero rows. It fails closed, which is why - unlike 00025's writer - it does not need to
-- raise 42501 to stay safe. Being LANGUAGE sql it could not raise anyway.
CREATE OR REPLACE FUNCTION public.pending_likers()
RETURNS TABLE (
  liker_id UUID,
  action   TEXT,
  liked_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.swiper_id, s.action, s.created_at
    FROM public.swipes s
    -- Rule (2) and rule (3). The join is the visibility rule: the view excludes deactivated
    -- users, the caller themselves, and anyone on either side of a `blocks` row.
    JOIN public.user_public_profiles p
      ON p.id = s.swiper_id
     AND p.onboarding_complete = true
   -- Rule (1). Note this is the only place `action` is read, and `pass` is not in the list.
   WHERE s.swiped_id = public.current_app_user_id()
     AND s.action IN ('like', 'super_like')
     -- Rule (4): the caller has already answered this person.
     AND NOT EXISTS (
           SELECT 1
             FROM public.swipes mine
            WHERE mine.swiper_id = s.swiped_id
              AND mine.swiped_id = s.swiper_id
         )
     -- Rule (5): the pair has matched. Exact on UNIQUE (user1_id, user2_id).
     AND NOT EXISTS (
           SELECT 1
             FROM public.matches m
            WHERE m.user1_id = LEAST(s.swiper_id, s.swiped_id)
              AND m.user2_id = GREATEST(s.swiper_id, s.swiped_id)
         );
$$;

COMMENT ON FUNCTION public.pending_likers() IS
  'Internal (MEXA-315): the likes aimed at the calling user that they have not answered - never a pass, never a blocked or deactivated liker, never someone already swiped on or matched with. SECURITY DEFINER and argument-less; identity comes from current_app_user_id(). No client role holds EXECUTE: reach it through count_who_liked_me() or get_who_liked_me(). Changing who is in this list changes both of those at once, which is the point.';

-- Supabase's ALTER DEFAULT PRIVILEGES has already granted EXECUTE to anon, authenticated
-- and service_role at CREATE time (00010's rule 2). Take it back from all of them: the
-- only callers are the two functions below, which run as the owner.
REVOKE EXECUTE ON FUNCTION public.pending_likers() FROM PUBLIC, anon, authenticated, service_role;

-- =====================================================
-- 2a. public.count_who_liked_me() - the free teaser
-- =====================================================
--
-- Returns a number and names nobody, so it is granted to every signed-in caller whatever
-- they have paid. It is what the badge on the Matches tab renders and what makes the
-- paywall worth tapping. See the header for why this one is deliberately not gated.
--
-- INTEGER rather than BIGINT: `count(*)` is bigint, which PostgREST serialises as a JSON
-- number either way, but the generated TypeScript for a bigint return is `number` with a
-- comment nobody reads, and this count cannot reach 2^31.
CREATE OR REPLACE FUNCTION public.count_who_liked_me()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::INTEGER FROM public.pending_likers();
$$;

COMMENT ON FUNCTION public.count_who_liked_me() IS
  'How many people have liked the calling user without an answer yet (MEXA-315). Free for every signed-in caller on purpose: it is the upsell for Gold, it names nobody, and it never counts a pass. The list behind it is get_who_liked_me().';

REVOKE EXECUTE ON FUNCTION public.count_who_liked_me() FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION public.count_who_liked_me() TO authenticated;

-- =====================================================
-- 2b. public.get_who_liked_me(limit, offset) - the paid list
-- =====================================================
--
-- The columns are a deliberate subset of the view, not `p.*`: this list renders a card with
-- a photo, a name, an age, a place, the two verification ticks and a distance, and a
-- feature should not ship a wider row than its screen draws. Photos are a second query on
-- `user_photos` (`src/api/queries/primaryPhotos.ts`), the same shape the deck and the
-- matches list already use - the view is not a table, so it cannot be embedded.
--
-- **The two arguments are paging only.** Neither names a user, so there is nothing here a
-- caller can point at somebody else; that is 00010's rule 1 and the reason this signature
-- is acceptable where `get_orthodox_discovery_profiles(requesting_user_id, ...)` was not.
-- Both are clamped rather than validated: a limit of 10 million is a denial-of-service on
-- our own database, not a client error worth a round trip, and a negative offset is a
-- syntax error in OFFSET. NULL is treated as "not supplied" so a caller that omits one
-- through PostgREST behaves like the default.
--
-- ORDER BY is (super likes first, newest first, id) and the `liker_id` tiebreak is not
-- decoration: without a total order, two rows sharing `created_at` can swap between pages
-- and the client shows one twice and misses the other.
CREATE OR REPLACE FUNCTION public.get_who_liked_me(
  p_limit  INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id                 UUID,
  first_name         TEXT,
  display_name       TEXT,
  date_of_birth      DATE,
  bio                TEXT,
  occupation         TEXT,
  current_city       TEXT,
  current_state      TEXT,
  is_verified        BOOLEAN,
  is_photo_verified  BOOLEAN,
  distance_miles     DOUBLE PRECISION,
  liked_at           TIMESTAMPTZ,
  is_super_like      BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.first_name,
    p.display_name,
    p.date_of_birth,
    p.bio,
    p.occupation,
    p.current_city,
    p.current_state,
    p.is_verified,
    p.is_photo_verified,
    p.distance_miles,
    l.liked_at,
    l.action = 'super_like' AS is_super_like
  FROM public.pending_likers() l
  JOIN public.user_public_profiles p ON p.id = l.liker_id
  ORDER BY (l.action = 'super_like') DESC, l.liked_at DESC, p.id
  LIMIT  LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.get_who_liked_me(INTEGER, INTEGER) IS
  'The "See who likes you" list (MEXA-315): profiles of people who liked or super-liked the calling user and are still waiting on an answer, super likes first then newest. SECURITY DEFINER over public.pending_likers(); the two arguments are paging only (clamped to 1..100 and >=0) and neither names a user, so identity still comes from current_app_user_id() alone. A pass is never returned. NOT gated on an entitlement - there is no server-side one to read (public.subscriptions has no writer, MEXA-373); the Gold gate is useCanSeeLikes() on the device.';

REVOKE EXECUTE ON FUNCTION public.get_who_liked_me(INTEGER, INTEGER) FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION public.get_who_liked_me(INTEGER, INTEGER) TO authenticated;

-- The instruction, where the next person to reach for a cross-side policy will read it.
COMMENT ON TABLE public.swipes IS
  'Append-only record of a swipe. Clients hold INSERT and SELECT only, and the SELECT '
  'policy is own-swiper-only on purpose: a policy admitting swiped_id = <me> would publish '
  '"who passed on you" along with "who liked you" (00017, MEXA-294). Rewind goes through '
  'public.undo_last_swipe() (00025); "see who likes you" goes through '
  'public.get_who_liked_me() and public.count_who_liked_me() (00026), which read the like '
  'side and never the pass side. Do not add a DELETE policy, a cross-side SELECT policy or '
  'a client write grant here: 00016 revokes those grants and asserts they stayed revoked.';

-- =====================================================
-- 3. Ledger row, in this transaction (MEXA-325)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00026', 'who_liked_me')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. Assert the result, in the same transaction
-- =====================================================
--
-- Catalog assertions only. What a real `authenticated` caller gets back is proven by
-- executing the functions against fixture rows - see the rehearsal named in
-- supabase/MIGRATIONS.md - because a function that exists with the right flags can still
-- answer the wrong question.

DO $$
DECLARE
  v_bad  TEXT;
  v_n    INTEGER;
  v_func TEXT;
  v_sig  TEXT;
BEGIN
  -- 4a. All three exist with the flags the argument above depends on. `provolatile` must be
  -- 's': a VOLATILE function is re-planned per row when used in a join and PostgREST will
  -- not serve it over GET, and these are pure reads.
  FOREACH v_sig IN ARRAY ARRAY['public.pending_likers()',
                               'public.count_who_liked_me()',
                               'public.get_who_liked_me(integer,integer)'] LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      RAISE EXCEPTION 'MEXA-315: % was not created', v_sig;
    END IF;

    SELECT string_agg(format('%s: secdef=%s config=%s volatile=%s',
                             v_sig, p.prosecdef, p.proconfig, p.provolatile), ', ')
      INTO v_bad
      FROM pg_proc p
     WHERE p.oid = to_regprocedure(v_sig)
       AND (p.prosecdef IS NOT TRUE
            OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']
            OR p.provolatile <> 's');
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'MEXA-315: wrong flags - %', v_bad;
    END IF;
  END LOOP;

  -- 4b. No overloads. A second signature is a second endpoint, and the REVOKEs above cover
  -- only the ones named here.
  FOREACH v_func IN ARRAY ARRAY['pending_likers', 'count_who_liked_me', 'get_who_liked_me'] LOOP
    SELECT count(*) INTO v_n
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
     WHERE p.proname = v_func;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'MEXA-315: % functions named % in public, expected 1', v_n, v_func;
    END IF;
  END LOOP;

  -- 4c. Each endpoint is reachable by exactly the roles intended, and no others.
  --
  -- PUBLIC is checked off `proacl` rather than with has_function_privilege('public', ...):
  -- there is no role named `public`, so that call raises undefined_object instead of
  -- answering. `aclexplode` reports the PUBLIC entry as `grantee = 0`. A NULL `proacl` has
  -- to fail too - for a function the built-in default is EXECUTE **to PUBLIC**, so "no
  -- explicit ACL" is the open case, not the closed one.
  FOREACH v_sig IN ARRAY ARRAY['public.pending_likers()',
                               'public.count_who_liked_me()',
                               'public.get_who_liked_me(integer,integer)'] LOOP
    IF (SELECT p.proacl FROM pg_proc p WHERE p.oid = to_regprocedure(v_sig)) IS NULL THEN
      RAISE EXCEPTION 'MEXA-315: % has no explicit ACL, which for a function means EXECUTE TO PUBLIC', v_sig;
    END IF;
  END LOOP;

  -- pending_likers(): nobody but the owner.
  SELECT string_agg(CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END, ', '
                    ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END)
    INTO v_bad
    FROM pg_proc p
   CROSS JOIN aclexplode(p.proacl) a
   WHERE p.oid = to_regprocedure('public.pending_likers()')
     AND a.privilege_type = 'EXECUTE'
     AND a.grantee <> p.proowner;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-315: EXECUTE on pending_likers() is held by [%] - it is internal and /rest/v1/rpc/pending_likers must 403 for everyone', v_bad;
  END IF;

  -- The two published ones: authenticated and nobody else.
  FOREACH v_sig IN ARRAY ARRAY['public.count_who_liked_me()',
                               'public.get_who_liked_me(integer,integer)'] LOOP
    SELECT string_agg(CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END, ', '
                      ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END)
      INTO v_bad
      FROM pg_proc p
     CROSS JOIN aclexplode(p.proacl) a
     WHERE p.oid = to_regprocedure(v_sig)
       AND a.privilege_type = 'EXECUTE'
       AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) <> 'authenticated')
       AND a.grantee <> p.proowner;
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'MEXA-315: EXECUTE on % is held by [%] besides authenticated and the owner', v_sig, v_bad;
    END IF;

    IF has_function_privilege('anon', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'MEXA-315: anon still holds EXECUTE on %', v_sig;
    END IF;
    IF NOT has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'MEXA-315: authenticated cannot EXECUTE % - the feature would 403 for every real caller', v_sig;
    END IF;
  END LOOP;

  -- service_role is left out of the GRANTs on purpose, like 00025's: these functions act as
  -- "the signed-in person", service_role has no public.users row, so current_app_user_id()
  -- is NULL and every call would return an empty list that looks like "nobody likes you".
  -- It holds BYPASSRLS and can read `swipes` directly if something server-side ever needs
  -- this.
  IF has_function_privilege('service_role', 'public.get_who_liked_me(integer,integer)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.count_who_liked_me()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.pending_likers()', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-315: service_role still holds EXECUTE on a who-liked-me function - see the note above';
  END IF;

  -- 4d. `swipes` is untouched: still exactly 00002's two policies, still no cross-side
  -- SELECT. This is the assertion that keeps the whole argument at the top of this file
  -- true, and the one to re-run if anybody proposes "just widen the policy".
  SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname)
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'swipes';
  IF v_bad IS DISTINCT FROM 'Users can create swipes:INSERT, Users can view own swipes:SELECT' THEN
    RAISE EXCEPTION 'MEXA-315: public.swipes policies are now [%] - 00026 must not add one', v_bad;
  END IF;

  -- 4e. No realtime publication change: `swipes` must still not be published. A badge fed
  -- by a subscription on this table is what MEXA-294 removed; see the header.
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'swipes'
  ) THEN
    RAISE EXCEPTION 'MEXA-315: public.swipes is in supabase_realtime - 00026 must not publish it';
  END IF;

  -- 4f. The ledger row this file writes, so a later reader does not have to guess.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00026') THEN
    RAISE EXCEPTION 'MEXA-315: ledger row 00026 is missing';
  END IF;

  -- 4g. The table comment carries the instruction, and still names 00025's function as well
  -- as this one - rewriting it must not drop the rewind sentence.
  v_bad := obj_description('public.swipes'::regclass, 'pg_class');
  IF v_bad IS NULL
     OR v_bad NOT LIKE '%get_who_liked_me()%'
     OR v_bad NOT LIKE '%undo_last_swipe()%' THEN
    RAISE EXCEPTION 'MEXA-315: the public.swipes comment does not name both undo_last_swipe() and get_who_liked_me()';
  END IF;
END
$$;

COMMIT;
