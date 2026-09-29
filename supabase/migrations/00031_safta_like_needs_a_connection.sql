-- Mazal - a Safta can only recommend to a grandchild who accepted her
--
-- MEXA-361. Rollback: supabase/rollback/00031_safta_like_needs_a_connection_rollback.sql
--
-- Three changes on one table, `safta_likes`, in the order a recommendation travels:
--
--   1. INSERT ("Safta can create likes") may only create a *draft* - `sent_to_user IS NOT
--      TRUE` and `sent_at IS NULL` - and only `for_user_id` a grandchild who has an
--      `accepted` connection to the inserting Safta. Today the check pins
--      `safta_account_id` to one of the caller's own Safta accounts and says nothing about
--      `for_user_id`, `liked_user_id` or `sent_to_user`.
--   2. UPDATE ("Safta can send own likes", `00020`) keeps its one-way `USING` and gains the
--      same accepted-connection requirement in `WITH CHECK`, so consent has to still hold
--      at the moment the push is sent, not only when the draft was written.
--   3. A `BEFORE UPDATE` trigger makes `id`, `safta_account_id`, `for_user_id`,
--      `liked_user_id` and `created_at` immutable, and takes `sent_at` out of the client's
--      hands. `WITH CHECK` cannot see OLD, so pinning a column across an UPDATE needs a
--      trigger; a policy alone cannot express it. It is a second layer, not the load-bearing
--      one - section 3's own header says exactly what it does and does not add.
--
-- The INSERT policy also moves from `TO public` to `TO authenticated`, which is where every
-- policy written since `00019` sits. `anon` still holds INSERT on this table until `00016`
-- goes on, so under `TO public` this policy was the only thing between the anon key and the
-- table. It did hold - `auth.uid()` is NULL for `anon`, so the subquery is empty - but that
-- is one layer, not two. The SELECT policy beside it stays `TO public`: narrowing a read is
-- a different argument and is not smuggled in here.
--
-- DEPENDS ON `00023` (MEXA-357), and this is a hard dependency, asserted in section 0.
-- Sections 1 and 2 treat `safta_connections.status = 'accepted'` as consent. That is only
-- true because `00023` stopped a Safta writing `'accepted'` on her own INSERT; before it,
-- an attacker forged the connection first and the predicate below was decorative. `00023`
-- is applied on live (ledger row `00023`, and the `safta_connections` INSERT check reads
-- `status = 'pending'`) - measured, not assumed.
--
-- Also depends on `00002` (the INSERT policy it replaces) and `00020` (the UPDATE policy it
-- replaces, and the DEFINER `update_safta_stats`). Independent of everything in flight:
-- `00016` names `safta_likes` only to REVOKE DELETE from `authenticated`, and its
-- post-check (section 7c) reads grants, never policies - this file changes no grant at all
-- and asserts so in section 5, including that `safta_likes:UPDATE` is still held at table
-- level, which is what `00016` raises on. `00022`, `00024`-`00030` name no policy and no
-- trigger on this table.
--
-- ===================================================================================
-- THE DEFECT, MEASURED ON THE LIVE PROJECT
-- ===================================================================================
--
-- `tayiyczmacvhokdxfqvm`, inside `begin … rollback`, as the real `authenticated` role with
-- `request.jwt.claims` set (`.scratch/mazal-mexa361/verify.mjs --mode before`). Nothing
-- left behind. Fixtures: a victim V with a normal user account and a push token, an
-- attacker A who also holds a `safta_accounts` row of her own, and a real grandchild G with
-- an `accepted` connection to A.
--
--   As A, who has never met V and holds no connection to her:
--     INSERT INTO safta_likes (safta_account_id, for_user_id, liked_user_id, sent_to_user)
--       VALUES (<A's own safta account>, <V's users.id>, <any users.id>, true)  ->  1 row
--     SELECT title, body FROM notification_queue WHERE user_id = <V>
--       ->  'Your family found someone!'  '<A's display_name> thinks you should meet …'
--     SELECT total_safta_likes FROM user_safta_stats WHERE user_id = <liked>  ->  1
--
--   As A, on a legitimate draft to her real grandchild G:
--     UPDATE safta_likes SET for_user_id = <V's users.id>, sent_to_user = true
--       WHERE id = <the draft>                                                ->  1 row
--       ->  a second queued push at V
--
-- So any signed-in account can queue a push notification at any user of this dating app,
-- under a display name of the attacker's choosing, with no relationship to that person and
-- no action by them - and can raise a stranger's public `total_safta_likes` counter while
-- doing it. `notification_queue`'s only unique constraint is its `uuid_generate_v4()`
-- primary key, so `send_push_notification`'s `ON CONFLICT DO NOTHING` deduplicates nothing;
-- `UNIQUE (safta_account_id, for_user_id, liked_user_id)` caps it at one row per triple,
-- which an attacker walks around by varying `liked_user_id` - one push per user in the
-- table, per victim. Nothing ever decrements `total_safta_likes` (`00020`'s header).
--
-- `00020`'s header filed exactly this and deliberately did not close it: "Re-pointing
-- `for_user_id` at an unrelated user is no wider than the INSERT policy already is … That
-- gap is older than this file and is filed rather than half-closed here; column-pinning an
-- UPDATE needs a BEFORE UPDATE trigger comparing OLD to NEW, which is the same migration as
-- fixing the INSERT policy." This is that migration.
--
-- HOW WIDE THIS IS. `"Safta can create account"` (`00002`) is `WITH CHECK (auth_id =
-- auth.uid())`, so becoming a Safta is one INSERT with no vetting, and `for_user_id` is any
-- `public.users.id` - discoverable through `user_public_profiles`, which `00013` opens to
-- every signed-in account. `EXPO_PUBLIC_FEATURE_SAFTA_MODE` is a client-bundle constant: it
-- decides which React screens render, not what PostgREST accepts, so the flag being off
-- does not close any of this.
--
-- WHAT LIMITS IT TODAY, AND IS THE ONLY REASON THIS IS NOT URGENT. `safta_likes`,
-- `safta_connections`, `safta_accounts`, `users` and `notification_queue` all hold 0 rows on
-- live, and no screen inserts here: `useSendRecommendation` is exported from
-- `src/features/safta/hooks/index.ts` and called from nowhere, and the Safta deck's
-- Recommend button (`app/(safta-tabs)/index.tsx:388`) spends a daily-usage credit,
-- `console.log`s and advances. The hole is reachable over PostgREST with any user JWT and
-- the public anon key; it is not reachable through the app.
--
-- ===================================================================================
-- WHY SECTION 1 IS NOT A FIX BY ITSELF
-- ===================================================================================
--
-- Section 1 alone does nothing at all. With `00020`'s UPDATE `WITH CHECK` pinning only
-- `safta_account_id`, a Safta inserts a draft that passes the new accepted-connection check
-- against her real grandchild, then in one statement sets `for_user_id = <a stranger>` and
-- `sent_to_user = true`: `USING` sees the OLD row (still a draft, still hers, admitted),
-- `WITH CHECK` sees a NEW row that still names her own Safta account, and the push fires at
-- the stranger. Measured above, as the second `before` case.
--
-- SECTION 3 IS WHAT CLOSES THAT, and the rehearsal says so in its own words: the re-aim
-- comes back `42501: safta_likes: id, safta_account_id, for_user_id, liked_user_id and
-- created_at are immutable`, i.e. from the trigger, which is BEFORE UPDATE and therefore
-- runs before any policy's `WITH CHECK` is evaluated. Section 2's `EXISTS` would also refuse
-- that statement - the NEW row names a `for_user_id` who has accepted nobody - but it never
-- gets the chance, so this file does not claim it as the mechanism.
--
-- SECTION 2 THEN COVERS WHAT SECTION 3 CANNOT SEE. Once the triple is pinned, the only way
-- the connection behind a draft can stop being `accepted` is the grandchild changing her
-- answer, and a trigger comparing OLD to NEW on `safta_likes` cannot notice that another
-- table moved. So section 2's `EXISTS` is exactly the consent-withdrawal rule: measured as
-- "after the grandchild rejects, an unsent draft can no longer be sent", which comes back
-- `42501: new row violates row-level security policy` - from the policy, with the trigger
-- permitting the statement. The two sections are complementary, and each one is the sole
-- refuser of a case the rehearsal exercises separately.
--
-- Section 3 alone would do nothing either: it would pin `for_user_id` to whatever the INSERT
-- was allowed to write, and without section 1 the INSERT is allowed to write any user id
-- at all - with `sent_to_user = true` in the same statement, so the push fires before any
-- UPDATE is needed.
--
-- ===================================================================================
-- WHAT THIS FILE DOES NOT FIX, SAID PLAINLY
-- ===================================================================================
--
-- `liked_user_id` stays any `users.id`, and that is deliberate: recommending a stranger to
-- your grandchild *is* the feature - the person recommended has no say in being recommended,
-- the same way they have no say in being swiped on. What changes is that the recommendation
-- can now only be delivered to someone who agreed to hear from this Safta, so the only
-- person who receives anything is a consenting one. The side effect on the person
-- recommended is the `update_safta_stats` increment on their public `total_safta_likes`;
-- after this file a Safta can still raise it by one for every user in the table, but only
-- by writing a real recommendation to a grandchild who accepted her, which is one accepted
-- connection away from being a real product action rather than an anonymous poke. Capping
-- how many recommendations a Safta may send is a rate-limit and a product decision, not a
-- policy predicate, and `SaftaUsageLimits` already exists client-side to hold it. Filed as a
-- follow-up, not half-built here.
--
-- Nothing decrements `total_safta_likes`. Unchanged from `00020`, which filed it; a
-- `safta_accounts` delete still cascades away her likes and leaves every counter they raised
-- raised. A DELETE trigger, or replacing the table with a view over `safta_likes`, is a
-- different change.
--
-- Anyone may still INSERT a `pending` `safta_connections` row pointing at any user id -
-- `00023`'s own filed gap, the invite flow. That gap cannot be used to get past this file:
-- a `pending` row is not `accepted`, and only the grandchild named in it can move it
-- (`00023` section 2, plus its immutability trigger), so a Safta cannot manufacture her own
-- consent.
--
-- `sent_to_user` and `sent_at` stay nullable. `SET NOT NULL` would be an ALTER TABLE on the
-- columns this file's argument rests on and buys nothing: `IS NOT TRUE` already treats NULL
-- as not-sent, which is what `BOOLEAN DEFAULT false` nullable means, and section 3 derives
-- `sent_at` rather than trusting it.
--
-- ===================================================================================
-- THE CLIENT CHANGE THAT COMES WITH THIS
-- ===================================================================================
--
-- `useSendRecommendation` inserts with `sent_to_user: true` and `sent_at: now()` in one
-- statement, so after section 1 that insert is 42501. It is changed in the same commit to
-- insert a draft and then send it, which is the shape `00005`'s
-- `trigger_notify_safta_like` was designed for - `AFTER INSERT OR UPDATE OF sent_to_user`,
-- a draft created and sent later - and the shape `00020`'s UPDATE policy exists to serve.
-- No screen calls the hook, so nothing a tester can reach changes either way; the hook is
-- fixed because shipping a policy that guarantees the one insert path in the repo throws
-- 42501 is not shipping a fix.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================
--
-- Capture what must not move, and refuse to run against a table somebody has already
-- reshaped, or against a database where `accepted` does not yet mean consent. Deliberately
-- not idempotent: the ledger row in section 4 is what stops a re-apply, and a second run
-- finding its own policies in place should say so loudly rather than quietly re-writing
-- them.

DO $$
DECLARE
  v_n     INTEGER;
  v_check TEXT;
BEGIN
  IF to_regclass('public.safta_likes') IS NULL THEN
    RAISE EXCEPTION 'MEXA-361: public.safta_likes does not exist';
  END IF;

  IF to_regclass('public.safta_connections') IS NULL THEN
    RAISE EXCEPTION 'MEXA-361: public.safta_connections does not exist, so the accepted-connection check below could not be evaluated';
  END IF;

  -- THE 00023 DEPENDENCY, asserted rather than trusted. Without 00023 a Safta writes
  -- `status = 'accepted'` on her own connection INSERT, so sections 1 and 2 would check a
  -- box the attacker ticks herself and this file would read as a fix while changing
  -- nothing. Two independent signals: the ledger row, and the policy 00023 actually wrote.
  IF NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00023'
  ) THEN
    RAISE EXCEPTION 'MEXA-361: 00023 (safta_connection_consent) is not in the ledger. This file treats safta_connections.status = ''accepted'' as consent, which is only true after 00023. Apply 00023 first.';
  END IF;

  SELECT with_check INTO v_check FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'INSERT';
  IF v_check IS NULL OR v_check NOT LIKE '%pending%' THEN
    RAISE EXCEPTION 'MEXA-361: the safta_connections INSERT check is "%", which does not pin status to pending - 00023 is not in force, so ''accepted'' is self-awarded and this file would be decorative', v_check;
  END IF;

  -- One INSERT policy and one UPDATE policy: 00002's and 00020's. More than one of either
  -- means a policy this file does not know about is also deciding these writes, and
  -- dropping only the named one would leave it deciding them alone.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'INSERT';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-361: expected exactly 1 INSERT policy on safta_likes, found %', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'UPDATE';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-361: expected exactly 1 UPDATE policy on safta_likes, found % (00020 wrote one)', v_n;
  END IF;

  -- The defect, as it is on live right now. If it is already absent, this file has been
  -- applied (or superseded) and must not run again.
  SELECT with_check INTO v_check FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'INSERT';
  IF v_check IS NULL OR v_check LIKE '%sent_to_user%' OR v_check LIKE '%safta_connections%' THEN
    RAISE EXCEPTION 'MEXA-361: the safta_likes INSERT check already constrains the draft state or the connection ("%"); 00031 looks applied', v_check;
  END IF;

  SELECT with_check INTO v_check FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'UPDATE';
  IF v_check IS NULL OR v_check LIKE '%safta_connections%' THEN
    RAISE EXCEPTION 'MEXA-361: the safta_likes UPDATE check already names safta_connections ("%"); 00031 looks applied', v_check;
  END IF;

  -- Exactly the two triggers 00001 and 00005 put here, and no third. This file adds one; if
  -- something else already added one, it has to be read before a second goes on beside it.
  SELECT count(*) INTO v_n
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'safta_likes' AND NOT t.tgisinternal;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'MEXA-361: expected exactly 2 triggers on safta_likes (safta_likes_update_stats, trigger_notify_safta_like), found %', v_n;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relname = 'safta_likes' AND t.tgname = 'trigger_notify_safta_like'
  ) THEN
    RAISE EXCEPTION 'MEXA-361: trigger_notify_safta_like is missing. It is the faucet this file exists to aim, so its absence means the schema is not the one this migration was written against.';
  END IF;

  -- Grants, row count and schema-wide policy count, to prove in section 5 that this file
  -- moved none of them.
  PERFORM set_config('mexa361.grants',
    (SELECT coalesce(string_agg(format('%s:%s', grantee, privilege_type), ',' ORDER BY grantee, privilege_type), '')
       FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'safta_likes'), false);
  PERFORM set_config('mexa361.rows',
    (SELECT count(*)::text FROM public.safta_likes), false);
  PERFORM set_config('mexa361.policies',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public'), false);
END
$$;

-- ===================================================================================
-- 1. INSERT: a draft, to a grandchild who said yes
-- ===================================================================================
--
-- `sent_to_user IS NOT TRUE AND sent_at IS NULL` makes every row a draft at birth, so the
-- INSERT half of `trigger_notify_safta_like` can never fire again and the only route to a
-- push is the UPDATE in section 2 - which `00020` already made one-way per row (`USING
-- (sent_to_user IS NOT TRUE)`). One funnel instead of two, and it is the funnel `00020`'s
-- security argument was written about. Today that argument is half true: a client that
-- inserts `sent_to_user = true` outright, which is exactly what the app's own hook does,
-- never passes through the one-way gate at all.
--
-- `IS NOT TRUE`, not `= false`: the column is `BOOLEAN DEFAULT false` and nullable, so NULL
-- means "never set" and the schema's answer for unset is not-sent. `= false` would refuse a
-- client that simply omits the column. Same reasoning as `00019`'s `is_visible IS NOT FALSE`
-- and `00020`'s own `USING`.
--
-- THE EXISTS CLAUSE IS THE FIX. `for_user_id` must be a user who holds an `accepted`
-- `safta_connections` row to *this* Safta account. That is consent, and it is only consent
-- because `00023` (MEXA-357) took `'accepted'` out of the Safta's own hands: she INSERTs
-- `pending`, and only the grandchild named in the row may move it to `accepted`, on a row
-- whose pair `00023`'s trigger has pinned. So the predicate cannot be satisfied by anything
-- the caller can do alone - it needs a deliberate act by the person who will receive the
-- push. Asserted in section 0 rather than trusted.
--
-- Both columns in the subquery are qualified `safta_likes.…` on purpose:
-- `safta_connections` has a `safta_account_id` column of its own, so an unqualified
-- reference would resolve to the subquery's table and the correlation would silently
-- collapse into `sc.safta_account_id = sc.safta_account_id`, i.e. always true. A policy
-- that fails open is the failure mode this whole file is about, so it is spelled out.
--
-- The subquery reads `safta_connections` as the caller, under that table's own RLS.
-- `"Safta can view own connections"` (`00002`) admits `safta_account_id IN (the caller's
-- own accounts)`, which is precisely the row being looked for, so the Safta can see it -
-- measured live, not assumed (`verify.mjs --mode after`, the "real safta can draft" case).
-- If that SELECT policy is ever narrowed, this INSERT stops working rather than opening:
-- an invisible connection reads as no connection, which fails closed.
--
-- `safta_account_id IN (…)` is `00002`'s clause, unchanged: the row must point at a Safta
-- account the caller owns.

DROP POLICY IF EXISTS "Safta can create likes" ON public.safta_likes;

CREATE POLICY "Safta can create likes" ON public.safta_likes
  FOR INSERT TO authenticated
  WITH CHECK (
    sent_to_user IS NOT TRUE
    AND sent_at IS NULL
    AND safta_account_id IN (
      SELECT id FROM public.safta_accounts WHERE auth_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.safta_connections sc
       WHERE sc.safta_account_id = safta_likes.safta_account_id
         AND sc.connected_user_id = safta_likes.for_user_id
         AND sc.status = 'accepted'
    )
  );

-- ===================================================================================
-- 2. UPDATE: consent has to still hold when the push goes out
-- ===================================================================================
--
-- `USING` is `00020`'s, unchanged, and it is still the one-way rule: only a row that is not
-- yet sent may be updated, so each row fires at most one UPDATE-side notification ever.
--
-- `WITH CHECK` gains the same `EXISTS` as section 1. Without it, the accepted connection
-- would only ever be checked at the moment the draft was written, and a grandchild who
-- rejects her Safta a week later would still receive every draft written before she did.
-- `status IN ('accepted','rejected')` on `safta_connections` (`00023` section 2) is
-- deliberately re-enterable in both directions, precisely so "I changed my mind about my
-- grandmother" is always available; a recommendation pipeline that ignores the second
-- answer would make that promise hollow. The cost is that rejecting a connection freezes
-- her Safta's unsent drafts instead of deleting them, which is the conservative half of the
-- trade: the rows stay readable to the Safta (`"Safta can view own likes"`) and inert.
--
-- The `safta_account_id` clause stays `00020`'s. Pinning it across the UPDATE, which
-- `WITH CHECK` cannot do, is section 3.

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
    AND EXISTS (
      SELECT 1 FROM public.safta_connections sc
       WHERE sc.safta_account_id = safta_likes.safta_account_id
         AND sc.connected_user_id = safta_likes.for_user_id
         AND sc.status = 'accepted'
    )
  );

-- ===================================================================================
-- 3. Who a recommendation is about, and who it is for, are fixed at insert
-- ===================================================================================
--
-- `WITH CHECK` sees only NEW, so no policy can say "this column did not change".
--
-- THIS IS THE SECTION THAT REFUSES THE REPORTED RE-AIM, measured: a Safta who sets
-- `for_user_id = <a stranger>` and `sent_to_user = true` in one statement gets this
-- function's 42501, because BEFORE UPDATE runs before any policy's `WITH CHECK`. Section 2's
-- `EXISTS` would refuse the same statement on its own, but never sees it.
--
-- It also covers ground no policy on this table reaches. `liked_user_id` is not constrained
-- by section 1 or section 2 at all - any user may be recommended, which is the feature - so
-- without this trigger it is freely mutable on a draft, and moving it re-aims the
-- `data.userId` a delivered push carries while leaving the `user_safta_stats` increment the
-- row already made on the *previous* user. Nothing decrements that counter (`00020`), so a
-- mutable `liked_user_id` lets one row raise two people's public numbers.
--
-- And it makes the rule a schema fact rather than a property of a correlated subquery inside
-- a policy: `UNIQUE (safta_account_id, for_user_id, liked_user_id)` already says a row is
-- identified by its triple, and the next person to rewrite these policies should have to
-- fight a trigger rather than quietly drop an `EXISTS`. It is the shape `00023` established
-- one table over, so a reviewer reads one pattern instead of two.
--
-- IT APPLIES TO EVERYONE, INCLUDING `postgres` AND `service_role`. Not an oversight, and
-- the same rule `00023` took on `safta_connections`: a `safta_likes` row records *which
-- three people* a recommendation is between, and re-pointing it at a fourth is not an edit
-- of that fact, it is a forgery of it - and here it silently re-aims a push notification.
-- `UNIQUE (safta_account_id, for_user_id, liked_user_id)` says the same thing in the schema:
-- a row is identified by its triple. An operator who genuinely needs the triple changed
-- deletes the row and inserts another, which is the honest version of the same operation.
-- `ALTER TABLE … DISABLE TRIGGER` remains available to the owner for a genuine repair.
--
-- `sent_at` is assigned here rather than checked, because it is derived, not chosen: it
-- means "when the push went out", there is exactly one correct value for it given
-- `sent_to_user`, and the client has no business supplying one - today it supplies
-- `new Date().toISOString()` from the device clock, which is both unverified and
-- trivially backdated. Section 1 forces it NULL at insert, so after this file the only
-- writer of `sent_at` is this function. `COALESCE(OLD.sent_at, now())` keeps the first send
-- rather than refreshing it, and anything that is not sent clears it, so a row cannot carry
-- a timestamp claiming a push that never went out. Assignment in a BEFORE trigger happens
-- before the policy's `WITH CHECK` runs, so section 2 sees the value this function wrote.
--
-- IT DOES NOT RE-ARM THE PUSH. `trigger_notify_safta_like` is `AFTER INSERT OR UPDATE OF
-- sent_to_user`, and this function never writes `sent_to_user`, so it adds no path to a
-- notification. Section 2's `USING` still means a row can only make the false -> true trip
-- once.
--
-- `SECURITY INVOKER`, the default, stated because it is a deliberate choice: this function
-- reads nothing but OLD and NEW and writes nothing, so it needs no privilege of its own, and
-- `docs/TRIGGER_FUNCTION_SECURITY_AUDIT.md` rule 3 (pin `search_path` on anything that runs
-- as owner) is satisfied here by not running as owner at all. `SET search_path = public`
-- goes on anyway: it costs nothing and it is one less thing for the next audit to reason
-- about. Same shape as `00023`'s `enforce_safta_connection_immutable`.

CREATE OR REPLACE FUNCTION public.enforce_safta_like_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.safta_account_id IS DISTINCT FROM OLD.safta_account_id
     OR NEW.for_user_id IS DISTINCT FROM OLD.for_user_id
     OR NEW.liked_user_id IS DISTINCT FROM OLD.liked_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'safta_likes: id, safta_account_id, for_user_id, liked_user_id and created_at are immutable; delete the row and create a new one (MEXA-361)'
      USING ERRCODE = '42501';
  END IF;

  NEW.sent_at := CASE
    WHEN NEW.sent_to_user IS TRUE THEN COALESCE(OLD.sent_at, now())
    ELSE NULL
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_safta_like_immutable() IS
  'BEFORE UPDATE trigger on safta_likes: the triple (safta_account_id, for_user_id, '
  'liked_user_id) and the row identity are immutable, and sent_at is derived from '
  'sent_to_user rather than supplied. Added by 00031 (MEXA-361) because a policy WITH CHECK '
  'cannot see OLD, so a Safta could re-aim a draft - and the push notification it fires - '
  'at a user who had never connected to her.';

DROP TRIGGER IF EXISTS safta_likes_immutable ON public.safta_likes;

CREATE TRIGGER safta_likes_immutable
  BEFORE UPDATE ON public.safta_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_safta_like_immutable();

COMMENT ON TABLE public.safta_likes IS
  'A Safta''s recommendation of one user (liked_user_id) to a grandchild (for_user_id). '
  'Created as a draft by the owning Safta, and only for a grandchild who holds an accepted '
  'safta_connections row to her - that is consent, and 00023 is what makes it mean consent '
  '(MEXA-361). Sent by flipping sent_to_user, which queues a push through '
  'notify_safta_like; notification_queue cannot deduplicate, so 00020 made that transition '
  'one-way and 00031 re-checks the connection at send time. The triple and sent_at are '
  'fixed by the safta_likes_immutable trigger, not by the client. DELETE has no policy, so '
  'it matches 0 rows, and 00016 revokes the grant as well. Rows here drive the '
  'update_safta_stats counter, which only ever increments.';

-- =====================================================
-- 4. Ledger row, in this transaction (MEXA-325)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00031', 'safta_like_needs_a_connection')
ON CONFLICT DO NOTHING;

-- ===================================================================================
-- 5. Assert the result, in the same transaction
-- ===================================================================================
--
-- A policy that is too wide fails open and stays quiet, and this table holds 0 rows, so
-- nothing would ever notice. These checks are what make the claims above true of the
-- objects that actually landed rather than of the ones this file describes. The behaviour
-- itself - a stranger's push refused, a re-pointed draft refused, a real recommendation
-- still sending - is measured as the real `authenticated` role in
-- `.scratch/mazal-mexa361/verify.mjs`, which a policy catalog cannot do.

DO $$
DECLARE
  v_grants_before TEXT    := current_setting('mexa361.grants');
  v_rows_before   INTEGER := current_setting('mexa361.rows')::INTEGER;
  v_pols_before   INTEGER := current_setting('mexa361.policies')::INTEGER;
  v_bad           TEXT;
  v_n             INTEGER;
BEGIN
  -- 5a. The INSERT policy: one of them, ours, draft-only, connection-gated, out of anon's
  -- reach. The `safta_likes.for_user_id` literal is checked because it is the correlation
  -- that makes the EXISTS mean anything - a deparsed `sc.for_user_id` would mean the
  -- subquery decorrelated.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'INSERT';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-361: expected exactly 1 INSERT policy on safta_likes, found %', v_n;
  END IF;

  SELECT format('%s roles=%s check=%s', policyname, roles::text, with_check) INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'INSERT'
     AND ('public' = ANY (roles) OR 'anon' = ANY (roles)
          OR with_check IS NULL
          OR with_check NOT LIKE '%sent_to_user IS NOT TRUE%'
          OR with_check NOT LIKE '%sent_at IS NULL%'
          OR with_check NOT LIKE '%safta_accounts%'
          OR with_check NOT LIKE '%safta_connections%'
          OR with_check NOT LIKE '%safta_likes.for_user_id%'
          OR with_check NOT LIKE '%safta_likes.safta_account_id%'
          OR with_check NOT LIKE '%accepted%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-361: the safta_likes INSERT policy is not the one this file writes: %', v_bad;
  END IF;

  -- 5b. The UPDATE policy: one of them, ours, still one-way in USING - which is 00020's
  -- whole security argument and must not be lost while rewriting the policy - and now
  -- connection-gated in WITH CHECK.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'UPDATE';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-361: expected exactly 1 UPDATE policy on safta_likes, found %', v_n;
  END IF;

  SELECT format('%s roles=%s qual=%s check=%s', policyname, roles::text, qual, with_check) INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'UPDATE'
     AND ('public' = ANY (roles) OR 'anon' = ANY (roles)
          OR qual IS NULL OR with_check IS NULL
          OR qual NOT LIKE '%sent_to_user IS NOT TRUE%'
          OR qual NOT LIKE '%safta_accounts%'
          OR with_check NOT LIKE '%safta_accounts%'
          OR with_check NOT LIKE '%safta_connections%'
          OR with_check NOT LIKE '%safta_likes.for_user_id%'
          OR with_check NOT LIKE '%accepted%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-361: the safta_likes UPDATE policy is not the one this file writes: %', v_bad;
  END IF;

  -- 5c. The SELECT policy is untouched, and no DELETE policy appeared. This file narrows
  -- writes; if it had widened the read, every Safta's recommendations would be visible to
  -- everyone, and a DELETE policy would open the delete-and-reinsert loop that UNIQUE on
  -- the triple currently closes.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'SELECT';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-361: safta_likes has % SELECT policies, expected exactly 1', v_n;
  END IF;

  SELECT string_agg(format('%s (%s)', policyname, cmd), ', ') INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd IN ('DELETE', 'ALL');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-361: safta_likes gained a DELETE or ALL policy: %', v_bad;
  END IF;

  -- 5d. Three triggers now: 00001's stats trigger, 00005's notifier, and ours - BEFORE
  -- UPDATE, FOR EACH ROW, on the function this file defines, with a pinned search_path.
  -- The two older ones are named individually because losing either silently would change
  -- what the policies above are protecting.
  SELECT count(*) INTO v_n
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'safta_likes' AND NOT t.tgisinternal;
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'MEXA-361: expected exactly 3 triggers on safta_likes, found %', v_n;
  END IF;

  SELECT string_agg(n, ', ') INTO v_bad FROM (
    SELECT unnest(ARRAY['safta_likes_update_stats', 'trigger_notify_safta_like', 'safta_likes_immutable']) AS n
  ) w
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'safta_likes' AND NOT t.tgisinternal AND t.tgname = w.n
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-361: trigger(s) missing from safta_likes: %', v_bad;
  END IF;

  SELECT format('%s tgtype=%s fn=%s', t.tgname, t.tgtype, p.proname) INTO v_bad
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE c.relname = 'safta_likes' AND NOT t.tgisinternal
     AND t.tgname = 'safta_likes_immutable'
     AND (p.proname <> 'enforce_safta_like_immutable'
          OR (t.tgtype & 1) = 0            -- FOR EACH ROW
          OR (t.tgtype & 2) = 0            -- BEFORE
          OR (t.tgtype & 16) = 0);         -- UPDATE
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-361: safta_likes_immutable is not a BEFORE UPDATE FOR EACH ROW on enforce_safta_like_immutable: %', v_bad;
  END IF;

  SELECT format('%s(secdef=%s, config=%s)', p.proname, p.prosecdef,
                coalesce(array_to_string(p.proconfig, ' '), 'null')) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'enforce_safta_like_immutable'
     AND (p.proconfig IS NULL OR NOT ('search_path=public' = ANY (p.proconfig)));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-361: enforce_safta_like_immutable has no pinned search_path: %', v_bad;
  END IF;

  -- 5e. 00020's DEFINER counter function is still DEFINER with a pinned search_path. This
  -- file does not touch it, and says so by checking: if it were INVOKER again, every insert
  -- admitted by section 1 would die 42501 on user_safta_stats (MEXA-297) and the "a real
  -- Safta can still recommend" half of this change would be false.
  SELECT format('%s(secdef=%s, config=%s)', p.proname, p.prosecdef,
                coalesce(array_to_string(p.proconfig, ' '), 'null')) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'update_safta_stats'
     AND (p.prosecdef IS NOT TRUE
          OR p.proconfig IS NULL OR NOT ('search_path=public' = ANY (p.proconfig)));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-361: update_safta_stats is no longer DEFINER with search_path=public: %', v_bad;
  END IF;

  -- 5f. No grant moved, no row moved, and the schema-wide policy count is where it started
  -- - two dropped, two created. 00016's section 7c reads these grants and raises if
  -- safta_likes:UPDATE is no longer held at table level, so it is checked by name.
  SELECT coalesce(string_agg(format('%s:%s', grantee, privilege_type), ',' ORDER BY grantee, privilege_type), '')
    INTO v_bad
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'safta_likes';
  IF v_bad IS DISTINCT FROM v_grants_before THEN
    RAISE EXCEPTION 'MEXA-361: grants on safta_likes changed: "%" -> "%"', v_grants_before, v_bad;
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.safta_likes'::regclass, 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-361: safta_likes:UPDATE is no longer granted to authenticated; 00016''s post-check will abort';
  END IF;

  SELECT count(*) INTO v_n FROM public.safta_likes;
  IF v_n <> v_rows_before THEN
    RAISE EXCEPTION 'MEXA-361: safta_likes row count changed % -> %', v_rows_before, v_n;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'public';
  IF v_n <> v_pols_before THEN
    RAISE EXCEPTION 'MEXA-361: public policy count changed % -> %, expected 2 replaced in place', v_pols_before, v_n;
  END IF;

  RAISE NOTICE 'MEXA-361: a recommendation is a draft to a grandchild who accepted, its three people are fixed, and only she can be pushed.';
END
$$;

COMMIT;
