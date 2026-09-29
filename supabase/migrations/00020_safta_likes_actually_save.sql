-- Mazal - a Safta like stops failing 42501, and a draft recommendation can be sent
--
-- MEXA-297. Rollback: supabase/rollback/00020_safta_likes_actually_save_rollback.sql
--
-- Two changes on one path, in the order a like travels it:
--
--   1. `update_safta_stats` becomes SECURITY DEFINER with `SET search_path = public`.
--      Today it is INVOKER and its whole body writes another user's row in
--      `user_safta_stats`, which has no INSERT and no UPDATE policy, so the write is
--      42501 and the 42501 takes the `safta_likes` INSERT down with it.
--   2. `safta_likes` gets its first UPDATE policy, admitting the owning Safta and only
--      while the row is still a draft (`sent_to_user IS NOT TRUE`).
--
-- DEPENDS ON NOTHING. It replaces one function defined in `00001` and adds one policy to a
-- table `00002` created. It is independent of `00012`, `00016` and every applied migration:
-- no file below names `update_safta_stats`' body or any policy on `safta_likes`, and it
-- deliberately changes no grant, so `00016`'s post-check (section 7c, which asserts
-- `safta_likes:UPDATE` is still granted to `authenticated`) still passes whichever order
-- the two go on in. See "WHY NO GRANT CHANGE" below.
--
-- ===================================================================================
-- MEASURED ON THE LIVE PROJECT, BEFORE THIS MIGRATION
-- ===================================================================================
--
-- `tayiyczmacvhokdxfqvm`, inside `begin … rollback`, as the real `authenticated` role with
-- `request.jwt.claims` set, seeded with three users and one `safta_accounts` row
-- (`.scratch/mazal-mexa297/verify.mjs --mode before`). Nothing left behind.
--
--   As the Safta who owns the safta_accounts row:
--     INSERT INTO safta_likes (a like for her grandchild)
--       -> 42501: new row violates row-level security policy for table "user_safta_stats"
--     after the failure:  safta_likes = 0   user_safta_stats = 0
--     UPDATE safta_likes SET sent_to_user = true  (row inserted as postgres)
--       -> no error, 0 rows
--
-- So **no Safta has ever been able to like anyone**, and the one hook that updates a
-- recommendation has never changed a row. `update_safta_stats` is an AFTER INSERT trigger,
-- so its 42501 aborts the statement that fired it: unlike `check_for_match` (MEXA-296),
-- which failed in silence, this one has always thrown.
--
-- Nothing to backfill. `users`, `safta_accounts`, `safta_likes` and `user_safta_stats` all
-- hold 0 rows on the live project, and a counter nothing ever incremented has no drift to
-- repair.
--
-- ===================================================================================
-- 1. update_safta_stats: SECURITY DEFINER
-- ===================================================================================
--
-- The body is `00001`'s, statement for statement. The only change is who runs it.
--
-- SECURITY DEFINER, because a derived counter is system bookkeeping. `user_safta_stats`
-- rows belong to the person being liked, not to the liker, and the alternative - a policy
-- or a grant letting the liker write another user's counter directly - is strictly worse:
-- it would let any client set any user's `total_safta_likes` to any number, over PostgREST,
-- with no like behind it. `00016` revokes INSERT/UPDATE/DELETE on `user_safta_stats` from
-- `authenticated` on exactly this assumption; this file is what makes that revoke correct
-- rather than merely harmless.
--
-- SET search_path = public, which every SECURITY DEFINER function needs so the owner's
-- rights cannot be pointed at a schema the caller chose. Without it the bare
-- `user_safta_stats` here resolves through the caller's search_path. Same reasoning and
-- same wording as `00017`; `docs/TRIGGER_FUNCTION_SECURITY_AUDIT.md` rule 3.
--
-- WHAT DEFINER DOES NOT HAND THE CALLER. The function takes no argument a client chooses
-- freely: every value in it comes from `NEW`, i.e. from a `safta_likes` row that had to
-- pass that table's INSERT policy (`safta_account_id` is one of the caller's own Safta
-- accounts) and its foreign keys (`liked_user_id` REFERENCES users). The only write is
-- `+1` on one row keyed by `NEW.liked_user_id`, and `UNIQUE (safta_account_id, for_user_id,
-- liked_user_id)` on `safta_likes` caps it at one increment per Safta per pair. So a caller
-- gains the ability to increment a counter by liking - which is the feature - and nothing
-- else. It is `RETURNS trigger`, which Postgres refuses to call outside a trigger context
-- and PostgREST does not expose, so unlike `00010`'s RPCs there is no endpoint to revoke.
--
-- WHAT IS STILL WRONG WITH THE COUNTER, AND IS NOT FIXED HERE. Nothing decrements it: there
-- is no DELETE or UPDATE trigger on `safta_likes`, so a deleted like leaves the count where
-- it was, and a `safta_accounts` delete cascades away every one of her likes while every
-- counter they raised stays raised. `00016` takes DELETE on `safta_likes` away from
-- `authenticated`, which closes the client-driven version of that; the cascade remains.
-- Making the counter self-correcting is a different change (a DELETE trigger, or dropping
-- the table and counting `safta_likes` in a view) and a product decision about what the
-- number means. Filed, not smuggled in here.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_safta_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_safta_stats (user_id, total_safta_likes, updated_at)
  VALUES (NEW.liked_user_id, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET total_safta_likes = user_safta_stats.total_safta_likes + 1,
      updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_safta_stats() IS
  'AFTER INSERT trigger on safta_likes: maintains the derived total_safta_likes counter. '
  'SECURITY DEFINER because the row it writes belongs to the person being liked and '
  'user_safta_stats has no INSERT or UPDATE policy, so as INVOKER every Safta like died '
  '42501 and took the like with it (MEXA-297). Running as owner is what lets 00016 revoke '
  'the client write grants on user_safta_stats instead of adding a policy. Nothing '
  'decrements this counter - see the 00020 header.';

-- The trigger is unchanged: `safta_likes_update_stats` from `00001` already points here and
-- CREATE OR REPLACE keeps the same oid. Nothing to re-create; dropping and re-adding it
-- would be a no-op.

-- ===================================================================================
-- 2. safta_likes: the first UPDATE policy, draft rows only
-- ===================================================================================
--
-- `00002` gave `safta_likes` a SELECT policy and an INSERT policy and no others, so every
-- UPDATE has always matched 0 rows. `00016` left the UPDATE grant in place on purpose,
-- citing `src/features/safta/hooks/useSaftaRecommendations.ts` as the caller waiting for
-- the policy, and asserts in its own post-check that the grant survives "until the missing
-- policies land". This is that policy.
--
-- WHAT THE CALLER ACTUALLY IS, since `00016`'s note is optimistic about it.
-- `useUpdateRecommendationStatus` sets `sent_to_user` / `sent_at` on one row by id. It is
-- exported from `src/features/safta/hooks/index.ts` and **called from no screen** - and
-- neither is `useSendRecommendation`, the insert beside it: the Safta deck's Recommend
-- button (`app/(safta-tabs)/index.tsx:388`) spends a daily-usage credit, logs
-- `console.log('Recommending profile:', …)` and advances to the next profile without
-- writing anything. So Safta likes are not "broken in the client" today, they are
-- unbuilt in the client and broken in the database, and this policy makes the hook work
-- rather than fixing a screen a user can reach. Said plainly because that is what the
-- reviewer needs to weigh, and because `00016` and MEXA-297 both read as though line 166
-- were live.
--
-- WHY IT LANDS ANYWAY. The column it writes is not speculative: `00005`'s
-- `trigger_notify_safta_like` is `AFTER INSERT OR UPDATE OF sent_to_user … WHEN
-- (NEW.sent_to_user = true)`, i.e. the schema was designed for a recommendation that is
-- created as a draft and sent later, and the UPDATE half of that trigger has never been
-- reachable. Leaving the grant dangling behind an assertion that demands it dangle is the
-- worse of the two states.
--
-- WHY `sent_to_user IS NOT TRUE` IN `USING`, WHICH IS THE WHOLE SECURITY ARGUMENT.
-- Flipping `sent_to_user` false -> true queues a push to `for_user_id` through
-- `notify_safta_like`, and `send_push_notification`'s `ON CONFLICT DO NOTHING` cannot
-- deduplicate anything: `notification_queue`'s only unique constraint is a `uuid_generate_v4()`
-- primary key, so every flip is a new queued notification. An ownership-only UPDATE policy
-- would therefore hand a Safta a push faucet - true, false, true, false on one row - aimed
-- at a `for_user_id` the INSERT policy never required her to be related to. `USING` sees
-- the OLD row, so admitting only rows that are still drafts makes the transition one-way:
-- each row can fire at most one UPDATE-side notification, ever, and `UNIQUE
-- (safta_account_id, for_user_id, liked_user_id)` caps the INSERT-side at one per pair.
--
-- `IS NOT TRUE`, not `= false`: the column is `BOOLEAN DEFAULT false` and nullable, so NULL
-- means "never set" and the schema's answer for unset is not-sent. `= false` would lock a
-- NULL row out of its own send. Same reasoning as `00019`'s `is_visible IS NOT FALSE`.
--
-- The cost of the one-way rule is that un-sending a recommendation matches 0 rows, so
-- `useUpdateRecommendationStatus({ sentToUser: false })` on a sent row raises PGRST116
-- from its `.single()`. No screen calls it, and withdrawing a recommendation the grandchild
-- has already been notified about is a product decision nobody has made - when it is made,
-- it wants its own column (`withdrawn_at`) rather than a flag that re-arms a push.
--
-- `TO authenticated`, where the SELECT and INSERT policies beside it are `TO public`. `anon`
-- still holds UPDATE on this table until `00016` goes on, and `TO public` would make this
-- policy the thing standing between the anon key and the table. It would in fact hold -
-- `auth.uid()` is NULL for `anon`, so the subquery is empty and no row is admitted - but
-- that is one layer, not two. `00019`'s reasoning; the two older policies are not rewritten
-- here because that is a separate argument.
--
-- WHAT THE POLICY DOES NOT CONSTRAIN. A draft is fully editable by its author, including
-- `note`, `liked_user_id` and `for_user_id`, and `WITH CHECK` only pins the row to one of
-- the caller's own Safta accounts. Re-pointing `for_user_id` at an unrelated user is no
-- wider than the INSERT policy already is - it checks `safta_account_id` and nothing about
-- the relationship between the Safta and the person she is recommending *to*. That gap is
-- older than this file and is filed rather than half-closed here; column-pinning an UPDATE
-- needs a BEFORE UPDATE trigger comparing OLD to NEW, which is the same migration as
-- fixing the INSERT policy.
--
-- WHY NO GRANT CHANGE. The other reading of "no caller" is `00016`'s own default: revoke
-- the verb so that adding the policy alone fails loudly. That is not available here without
-- breaking something. `00016` is unapplied and its section 7c raises if
-- `has_table_privilege('authenticated','public.safta_likes','UPDATE')` is false, so a
-- revoke in this file aborts `00016`'s apply, and a column-level `GRANT UPDATE
-- (sent_to_user, sent_at)` does the same, because `has_table_privilege` does not count
-- column privileges (measured - see the verify script's grant case). Column-scoping this
-- table the way `00015` scopes `users` is the right eventual shape and belongs in the same
-- migration that edits `00016`'s assertion.

DROP POLICY IF EXISTS "Safta can send own likes" ON public.safta_likes;

CREATE POLICY "Safta can send own likes" ON public.safta_likes
  FOR UPDATE TO authenticated
  USING (
    sent_to_user IS NOT TRUE
    AND safta_account_id IN (
      SELECT id FROM public.safta_accounts WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    safta_account_id IN (
      SELECT id FROM public.safta_accounts WHERE auth_id = auth.uid()
    )
  );

COMMENT ON TABLE public.safta_likes IS
  'A Safta''s recommendation of one user to her grandchild. Created by the owning Safta '
  '(INSERT policy, 00002) and updatable by her only while sent_to_user is not yet true '
  '(MEXA-297): the flip to true queues a push through notify_safta_like and '
  'notification_queue cannot deduplicate, so the transition is deliberately one-way. '
  'DELETE is revoked from authenticated in 00016. Rows here drive the update_safta_stats '
  'counter, which only ever increments.';

-- ===================================================================================
-- 3. Assert the result, in the same transaction
-- ===================================================================================
--
-- A wrong policy or a missed DEFINER fails quietly for as long as nobody likes anybody, so
-- the migration checks itself rather than relying on someone re-reading the catalog.

DO $$
DECLARE
  v_bad TEXT;
  v_n   INT;
BEGIN
  -- 3a. the function is DEFINER with a pinned search_path.
  SELECT string_agg(format('%s(secdef=%s, config=%s)', p.proname, p.prosecdef,
                           coalesce(array_to_string(p.proconfig, ' '), 'null')), ', ')
    INTO v_bad
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'update_safta_stats'
     AND (p.prosecdef IS NOT TRUE
          OR p.proconfig IS NULL
          OR NOT ('search_path=public' = ANY (p.proconfig)));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-297: update_safta_stats is not DEFINER with search_path=public: %', v_bad;
  END IF;

  -- 3b. the trigger still points at it. CREATE OR REPLACE keeps the oid, so this only
  -- fails if someone dropped the trigger between 00001 and here.
  SELECT count(*) INTO v_n
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE c.relname = 'safta_likes'
     AND p.proname = 'update_safta_stats'
     AND NOT t.tgisinternal;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-297: expected exactly 1 safta_likes trigger on update_safta_stats, found %', v_n;
  END IF;

  -- 3c. exactly one UPDATE policy on safta_likes, ours, unreachable by anon, and gated on
  -- the draft state. The `qual LIKE` is coarse on purpose: it catches the policy being
  -- rewritten later without the gate, which is the whole security argument, without
  -- pinning the deparsed text.
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'UPDATE';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-297: expected exactly 1 UPDATE policy on safta_likes, found %', v_n;
  END IF;

  SELECT string_agg(format('%s roles=%s qual=%s', policyname, roles::text, qual), ', ')
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'UPDATE'
     AND ('public' = ANY (roles) OR 'anon' = ANY (roles)
          OR qual NOT LIKE '%sent_to_user%'
          OR qual IS NULL OR with_check IS NULL);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-297: safta_likes UPDATE policy is not the one this file writes: %', v_bad;
  END IF;

  -- 3d. this file changed no grant. 00016 section 7c depends on safta_likes:UPDATE still
  -- being held at table level, and the counter fix depends on user_safta_stats needing no
  -- client grant at all - so both are asserted here rather than assumed.
  IF NOT has_table_privilege('authenticated', 'public.safta_likes'::regclass, 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-297: safta_likes:UPDATE is no longer granted to authenticated; 00016''s post-check will abort';
  END IF;

  -- 3e. no write policy appeared on user_safta_stats. The point of the DEFINER change is
  -- that the client never needs one; a later migration adding one would undo the argument.
  SELECT string_agg(format('%s (%s)', policyname, cmd), ', ')
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'user_safta_stats'
     AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-297: user_safta_stats has a client write policy, which the DEFINER trigger makes unnecessary: %', v_bad;
  END IF;

  RAISE NOTICE 'MEXA-297: update_safta_stats runs as owner, and a Safta can send her own draft.';
END
$$;

COMMIT;
