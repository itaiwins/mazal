-- Mazal - Make Rewind (undo last swipe) actually undo something, and fail out loud
--
-- MEXA-314. `public.swipes` has RLS enabled and exactly two policies, both from
-- `00002_rls_policies.sql`: `Users can create swipes` (INSERT) and `Users can view own
-- swipes` (SELECT). There is **no DELETE policy**, and `authenticated` does hold the
-- DELETE *grant*, so the statement `useUndoSwipe` runs -
--
--   supabase.from('swipes').delete().eq('id', lastSwipe.id)
--
-- - is allowed to execute and matches zero rows. A DELETE filtered to zero rows by RLS is
-- not an error: `deleteError` is null, the hook returns `{ undoneSwipe: lastSwipe }`, it
-- invalidates the discovery deck, and the UI reports a successful rewind while the swipe
-- row is still there. Rewind is sold as a Gold/Platinum feature
-- (`src/lib/config/revenuecat.ts:330`, `:395`), so this is a paid feature that silently
-- does nothing. Measured on this project 2026-09-29: `pg_policies` for `swipes` returns
-- those two rows and nothing else.
--
-- =====================================================
-- Why an RPC and not a DELETE policy
-- =====================================================
--
-- MEXA-314 proposed `CREATE POLICY ... FOR DELETE USING (swiper_id =
-- public.current_app_user_id())`. A policy alone cannot carry this feature, for three
-- reasons that all point at the same shape - the one 00010 and 00017 already use, where
-- the answer comes from an object that runs as its owner:
--
--  1. **The policy route collides with `00016`, which is on this branch and unapplied.**
--     `00016_client_role_write_privileges.sql` contains
--     `REVOKE UPDATE, DELETE ON TABLE public.swipes FROM authenticated;` and its
--     post-check section 7b asserts `['swipes','DELETE']` is revoked. So policy + grant
--     would either be undone the moment 00016 is applied, or make 00016 abort. 00016's
--     own comment says as much: "To build Rewind for real: add a DELETE policy AND
--     `GRANT DELETE ON swipes TO authenticated` in the same migration." This file takes
--     the other branch of that instruction: `swipes` stays append-only for clients, no
--     table grant is added or removed, and 00016 applies afterwards unchanged.
--  2. **The 30-second window cannot be enforced against the client's clock.** The window
--     is currently checked in JS as `Date.now() - new Date(created_at).getTime() >
--     30000`, i.e. device time against a server timestamp. A device clock that is a
--     minute slow makes a two-minute-old swipe look fresh; one that is fast refuses a
--     legitimate rewind. Inside the function, `now() - created_at` is one server-side
--     subtraction and the device clock is out of the loop entirely.
--  3. **A zero-row DELETE can't say why.** Not-yours, too-old and already-matched are
--     three different answers and the client needs to show three different things. This
--     function returns a `reason`, so the client never has to guess, and
--     `ok = false` is a thrown error rather than a silent success.
--
-- =====================================================
-- Why a rewind refuses once the pair has matched
-- =====================================================
--
-- Since `00017_matching_actually_matches.sql`, `swipes_check_match` is SECURITY DEFINER
-- and does create the `matches` row when a like is mutual - so inside the 30-second
-- window a like can already have produced a match. Deleting the swipe would leave that
-- match row behind: both people keep seeing the match, `messages` keeps accepting posts
-- into it (its INSERT policy only asks `is_active`), and the swiped person is back in the
-- rewinder's deck. Making the delete work without this rule would ship a *new* broken
-- state that the silent no-op was accidentally protecting us from.
--
-- Deleting the match instead is worse, and not this feature:
--
--  * `trigger_notify_new_match` on `matches` has already queued a push to **both** people
--    ("Mazal Tov! New Match!"). You cannot unsend that, and the other person did nothing.
--  * `messages.match_id REFERENCES matches(id) ON DELETE CASCADE`, so tearing the match
--    down destroys anything the other person has already sent.
--  * Mazal already has a first-class way out: `matches.user1_unmatched` /
--    `user2_unmatched` / `is_active`, an UPDATE, with a policy for it since 00002. Rewind
--    is "I mis-swiped on someone I will never see again"; unmatching a live match is
--    `unmatch`. One feature should not silently become the other.
--
-- So a swipe whose pair has a `matches` row is not rewindable, and the caller is told
-- `reason = 'matched'` so the client can point at unmatch. `is_active` is deliberately not
-- consulted: the existence of the row is what proves the trigger fired and the
-- notifications went out.
--
-- The lookup is `user1_id = LEAST(...) AND user2_id = GREATEST(...)`, which is exact
-- rather than a scan, because `matches` carries `CHECK (user1_id < user2_id)` and
-- `UNIQUE (user1_id, user2_id)`. And `swipes` carries `UNIQUE (swiper_id, swiped_id)`, so
-- there is at most one swipe per pair and "a match exists for this pair" cannot be about
-- some other swipe.
--
-- =====================================================
-- What this file deliberately does NOT do
-- =====================================================
--
--  * **No DELETE policy on `swipes`, and no change to any grant on it.** See above. A
--    post-check asserts the table still has exactly its two 00002 policies, so this file
--    and the policy route cannot both land by accident.
--  * **No server-side premium check.** Rewind is gated only by `useCanRewind()` on the
--    device (`src/features/premium/hooks/usePremium.ts:280`), which reads the RevenueCat
--    SDK. There is no server-side entitlement to check: `public.subscriptions` has a
--    SELECT policy and no writer anywhere in the repo, so it is empty and would refuse
--    every paying user. The 30-second window is the abuse bound in the meantime - it caps
--    a free user at undoing the swipe they just made, not at clearing their swipe history.
--    Filed as its own issue.
--  * **No retraction of a queued super-like notification.** `trigger_notify_super_like`
--    inserts "Someone Super Liked you!" into `notification_queue` on the INSERT, and
--    rewinding the swipe leaves it there. Whether a rewind retracts an unsent
--    notification is a product decision, and today it is moot - `send-notification` is
--    not deployed, so nothing in that queue has ever been delivered. Filed separately.
--  * **No trigger on `swipes`.** A BEFORE DELETE trigger that raised on a matched swipe
--    would also fire on the `ON DELETE CASCADE` from `users`, i.e. it would block account
--    deletion. The rule belongs in the one function that performs a client rewind.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================
--
-- Everything below is a fact this function's body relies on. Checking them here means a
-- database that does not match gets an abort instead of a function that compiles and then
-- misbehaves on its first real call.

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 0a. Not already applied. Re-running would be harmless (CREATE OR REPLACE), but a
  -- second apply means somebody lost track of which state live is in, and 00025's rollback
  -- would then be run against a database whose ledger row it did not write.
  IF to_regprocedure('public.undo_last_swipe()') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-314: public.undo_last_swipe() already exists - 00025 is already applied';
  END IF;

  -- 0b. The identity helper from 00010. Never trust an id passed in as an argument; this
  -- function takes none, and this is where the caller's identity comes from.
  SELECT string_agg(format('secdef=%s config=%s', p.prosecdef, p.proconfig), ', ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.current_app_user_id()')
     AND (p.prosecdef IS NOT TRUE OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']);
  IF to_regprocedure('public.current_app_user_id()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-314: public.current_app_user_id() is missing - apply 00010 first';
  END IF;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-314: current_app_user_id() is not DEFINER with search_path=public: %', v_bad;
  END IF;

  -- 0c. `swipes` is the shape this file reads: the five columns by name, and one swipe per
  -- pair, which is what makes the `matches` lookup in section 1 unambiguous.
  SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
    INTO v_bad
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'swipes';
  IF v_bad IS DISTINCT FROM 'id,swiper_id,swiped_id,action,created_at' THEN
    RAISE EXCEPTION 'MEXA-314: public.swipes columns are %, not the expected id,swiper_id,swiped_id,action,created_at', v_bad;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.swipes'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) = 'UNIQUE (swiper_id, swiped_id)'
  ) THEN
    RAISE EXCEPTION 'MEXA-314: public.swipes has no UNIQUE (swiper_id, swiped_id) - the "a match for this pair is about this swipe" step is no longer sound';
  END IF;

  -- 0d. `matches` stores the pair ordered, which is what LEAST/GREATEST leans on.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.matches'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) = 'CHECK ((user1_id < user2_id))'
  ) THEN
    RAISE EXCEPTION 'MEXA-314: public.matches has no CHECK (user1_id < user2_id) - the LEAST/GREATEST lookup would miss half the rows';
  END IF;

  -- 0e. 00017 is applied, so a match really can exist inside the rewind window. If
  -- `check_for_match` were still SECURITY INVOKER no match would ever be created and the
  -- 'matched' branch below would be dead code documenting a rule nobody enforces.
  SELECT string_agg(format('%s(secdef=%s)', p.proname, p.prosecdef), ', ')
    INTO v_bad
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE t.tgrelid = 'public.swipes'::regclass
     AND t.tgname = 'swipes_check_match'
     AND p.prosecdef IS NOT TRUE;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.swipes'::regclass AND tgname = 'swipes_check_match') THEN
    RAISE EXCEPTION 'MEXA-314: trigger swipes_check_match is missing from public.swipes';
  END IF;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-314: swipes_check_match is not SECURITY DEFINER - apply 00017 first: %', v_bad;
  END IF;

  -- 0f. RLS is on and nobody has already taken the DELETE-policy route. If a DELETE policy
  -- exists, this file is the wrong fix for whatever state the database is in.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.swipes'::regclass) THEN
    RAISE EXCEPTION 'MEXA-314: RLS is not enabled on public.swipes';
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'swipes' AND cmd IN ('DELETE', 'ALL');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'MEXA-314: public.swipes already has % DELETE-capable polic(ies) - somebody took the policy route; reconcile before applying 00025', v_n;
  END IF;
END
$$;

-- =====================================================
-- 1. public.undo_last_swipe()
-- =====================================================
--
-- SECURITY DEFINER, so it runs as `postgres` and is not subject to the `swipes` policies -
-- which is the whole point: `authenticated` never needs DELETE on the table. It therefore
-- has to check identity itself, and it does: the only row it will ever touch is
-- `swiper_id = public.current_app_user_id()`. It takes **no arguments**, so there is
-- nothing a caller can point at somebody else.
--
-- `SET search_path = public` per supabase/MIGRATIONS.md. `LEAST`, `GREATEST` and `now()`
-- are pg_catalog/SQL syntax and resolve regardless.
--
-- Returns one row, always, rather than raising on the expected refusals:
--
--   ok=true,  reason=NULL        the swipe is gone
--   ok=false, reason='no_swipe'  this user has no swipe to undo (or lost a race for it)
--   ok=false, reason='too_old'   outside the 30-second window
--   ok=false, reason='matched'   the pair has matched; unmatch is the way out
--
-- A refusal is data, not an exception, because PostgREST's mapping from SQLSTATE to HTTP
-- status is not something this file should be betting the client's error handling on, and
-- because the client wants the swipe's identity back in the refusal cases too. The one
-- exception it does raise is `42501` for a session with no app user, which is a bug or an
-- attack, not a refusal.
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

COMMENT ON FUNCTION public.undo_last_swipe() IS
  'Rewind: deletes the calling user''s most recent swipe if it is under 30 seconds old and the pair has not matched (MEXA-314). SECURITY DEFINER and argument-less, so identity comes from current_app_user_id() and a caller cannot aim it at anyone else - which is why public.swipes needs no DELETE policy and no DELETE grant for authenticated. Returns one row: ok, plus reason in (no_swipe, too_old, matched) when it refuses.';

-- PostgREST publishes every non-trigger function in `public` at /rest/v1/rpc/<name>, and
-- Supabase's ALTER DEFAULT PRIVILEGES has already granted EXECUTE to anon, authenticated
-- and service_role at CREATE time. Say it explicitly (supabase/MIGRATIONS.md).
--
-- `service_role` is left out on purpose, unlike the template: this function acts as "the
-- signed-in person", and service_role has no `public.users` row, so every call would raise
-- 42501. It also holds BYPASSRLS and DELETE on the table, so anything server-side that
-- needs to remove a swipe can do it directly and is not bound by the 30-second window.
REVOKE EXECUTE ON FUNCTION public.undo_last_swipe() FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION public.undo_last_swipe() TO authenticated;

COMMENT ON TABLE public.swipes IS
  'Append-only record of a swipe. Clients hold INSERT and SELECT only; there is no DELETE '
  'policy on purpose (MEXA-314). Rewind goes through public.undo_last_swipe(), a '
  'SECURITY DEFINER function that enforces ownership, the 30-second window and the '
  '"already matched" rule in one place. Do not add a DELETE policy or a client DELETE '
  'grant here: 00016 revokes that grant and asserts it stayed revoked.';

-- =====================================================
-- 2. Ledger row, in this transaction (MEXA-325)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00025', 'rewind_undo_last_swipe')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. Assert the result, in the same transaction
-- =====================================================
--
-- Catalog assertions only. What a real `authenticated` caller actually gets back is proven
-- by executing it - see the rehearsal named in supabase/MIGRATIONS.md - because a function
-- that exists with the right flags can still return the wrong answer.

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 3a. The function exists with the flags the argument above depends on. `provolatile`
  -- must be 'v': a STABLE function is not allowed to write, and PostgREST would publish it
  -- on GET.
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
    RAISE EXCEPTION 'MEXA-314: public.undo_last_swipe() was not created';
  END IF;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-314: undo_last_swipe() has the wrong flags: %', v_bad;
  END IF;

  -- 3b. No overloads. A second signature would be a second endpoint, and the REVOKE above
  -- only covers this one.
  SELECT count(*) INTO v_n
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname = 'undo_last_swipe';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-314: % functions named undo_last_swipe in public, expected 1', v_n;
  END IF;

  -- 3c. The endpoint is reachable by exactly one role.
  --
  -- PUBLIC is checked off `proacl`, not with `has_function_privilege('public', ...)`:
  -- there is no role named `public`, so that call raises `undefined_object` instead of
  -- answering. `aclexplode` reports the PUBLIC entry as `grantee = 0`. A NULL `proacl`
  -- has to fail too - for a function the built-in default is EXECUTE **to PUBLIC**, so
  -- "no explicit ACL" is the open case, not the closed one.
  IF (SELECT p.proacl FROM pg_proc p WHERE p.oid = to_regprocedure('public.undo_last_swipe()')) IS NULL THEN
    RAISE EXCEPTION 'MEXA-314: undo_last_swipe() has no explicit ACL, which for a function means EXECUTE TO PUBLIC';
  END IF;

  -- `ORDER BY 1` inside an aggregate is the constant 1, not a positional reference, so the
  -- expression has to be repeated for the list to be ordered at all.
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
    RAISE EXCEPTION 'MEXA-314: EXECUTE on undo_last_swipe() is held by [%] besides authenticated and the owner - /rest/v1/rpc/undo_last_swipe is wider than intended', v_bad;
  END IF;

  IF has_function_privilege('anon', 'public.undo_last_swipe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-314: anon still holds EXECUTE on undo_last_swipe()';
  END IF;
  IF has_function_privilege('service_role', 'public.undo_last_swipe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-314: service_role still holds EXECUTE on undo_last_swipe() - see the note above the REVOKE';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.undo_last_swipe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-314: authenticated cannot EXECUTE undo_last_swipe() - Rewind would 404/403 for every real caller';
  END IF;

  -- 3d. `swipes` is untouched: still exactly 00002's two policies, still no DELETE policy,
  -- and no grant changed. This is what keeps 00025 and 00016 compatible in either order.
  SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname)
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'swipes';
  IF v_bad IS DISTINCT FROM 'Users can create swipes:INSERT, Users can view own swipes:SELECT' THEN
    RAISE EXCEPTION 'MEXA-314: public.swipes policies are now [%] - 00025 must not add one', v_bad;
  END IF;

  -- 3e. The ledger row this file writes, so a later reader does not have to guess.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00025') THEN
    RAISE EXCEPTION 'MEXA-314: ledger row 00025 is missing';
  END IF;

  -- 3f. The table comment carries the instruction, so the next person to reach for a
  -- DELETE policy reads why not.
  IF obj_description('public.swipes'::regclass, 'pg_class') NOT LIKE '%undo_last_swipe()%' THEN
    RAISE EXCEPTION 'MEXA-314: the public.swipes comment does not name undo_last_swipe()';
  END IF;
END
$$;

COMMIT;
