-- Rollback for 00031_safta_like_needs_a_connection.sql
--
-- NOT a migration. Nothing applies this file automatically; it exists so 00031 can be
-- undone on a database that has it. Running it puts `safta_likes` back exactly as
-- `00002_rls_policies.sql` and `00020_safta_likes_actually_save.sql` left it - both policies
-- byte for byte as `pg_policies` reported them on the live project `tayiyczmacvhokdxfqvm` on
-- 2026-09-29, before 00031 was applied - drops 00031's trigger and its function, restores
-- 00020's table comment, and deletes 00031's ledger row.
--
-- WHAT RUNNING THIS COSTS YOU
--
-- It re-opens MEXA-361 in full. Afterwards, any signed-in account can create a
-- `safta_accounts` row for itself (no vetting) and INSERT one `safta_likes` row naming any
-- other user's `users.id` as `for_user_id` with `sent_to_user = true`, which fires
-- `00005`'s `trigger_notify_safta_like` and queues a push notification - 'Your family found
-- someone!', under a `display_name` the attacker chose - at a person who has never heard of
-- them. `notification_queue` has no unique constraint but its primary key, so nothing
-- deduplicates, and `UNIQUE (safta_account_id, for_user_id, liked_user_id)` is walked around
-- by varying `liked_user_id`: one push per user in the table, per victim. Each row also
-- increments the `total_safta_likes` of whoever it names as `liked_user_id` - a public
-- counter, on a third party who was never involved, that nothing decrements. A
-- Safta holding one legitimate draft can also re-point it at a stranger and send it.
--
-- The only reason to run this file is to get a half-applied deploy back to a known state,
-- and 00031 should go straight back on afterwards.
--
-- WHAT IT DOES NOT RESTORE
--
-- `sent_at` values that 00031's trigger normalised while it was applied. The trigger clears
-- `sent_at` on any row updated to a non-sent state and stamps it on the first send; those
-- writes are ordinary column values and this file does not try to guess what was there
-- before. `safta_likes` held 0 rows on live when 00031 was written, so on that database
-- there is nothing to restore. On any other, read section 1's notice before deciding.
--
-- Nor does it restore rows that 00031 refused. 00031 never rewrote a row, so nothing was
-- changed by applying it - but recommendations a Safta could not write while it was on do
-- not appear retroactively, and the `user_safta_stats` increments they would have made never
-- happened. That is the intended behaviour of the migration, not damage to undo.
--
-- WHAT IT DELIBERATELY LEAVES ALONE
--
-- `00023` (`safta_connections` consent). This file only names `safta_likes`. Rolling 00031
-- back does not need 00023 rolled back, and 00023 should stay on: it is a separate, wider
-- fix, and nothing in 00031 depends on it in the reverse direction.

BEGIN;

-- =====================================================
-- 1. Pre-flight
-- =====================================================

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  IF to_regclass('public.safta_likes') IS NULL THEN
    RAISE EXCEPTION 'MEXA-361 rollback: public.safta_likes does not exist';
  END IF;

  -- Refuse to run against a database that never had 00031: this file would then be
  -- *installing* the old, vulnerable policies over whatever is actually there.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'safta_likes'
       AND cmd = 'INSERT' AND with_check LIKE '%safta_connections%'
  ) THEN
    RAISE EXCEPTION 'MEXA-361 rollback: the safta_likes INSERT policy does not name safta_connections, so 00031 is not applied here. Nothing to roll back.';
  END IF;

  SELECT count(*) INTO v_n FROM public.safta_likes WHERE sent_at IS NOT NULL;
  IF v_n > 0 THEN
    RAISE NOTICE 'MEXA-361 rollback: % row(s) carry a sent_at that 00031''s trigger may have written. This file does not restore prior values.', v_n;
  END IF;
END
$$;

-- =====================================================
-- 2. The trigger and its function
-- =====================================================
--
-- The trigger goes first so the function has no dependent when it is dropped; both are
-- named, no CASCADE, so a surprise dependency raises instead of being swept up. The other
-- two triggers on this table (`safta_likes_update_stats` from 00001, `trigger_notify_safta_like`
-- from 00005) are not 00031's and are left exactly where they are - section 5 checks that.

DROP TRIGGER IF EXISTS safta_likes_immutable ON public.safta_likes;
DROP FUNCTION IF EXISTS public.enforce_safta_like_immutable();

-- =====================================================
-- 3. The two policies, as 00002 and 00020 wrote them
-- =====================================================
--
-- The INSERT policy's `TO public` and its lack of any draft or connection clause are
-- restored deliberately: this is 00002's text, not an improved version of it. A rollback
-- that leaves behind a different policy from the one it claims to restore is not a
-- rollback.

DROP POLICY IF EXISTS "Safta can create likes" ON public.safta_likes;

CREATE POLICY "Safta can create likes"
  ON public.safta_likes FOR INSERT
  WITH CHECK (
    safta_account_id IN (SELECT id FROM public.safta_accounts WHERE auth_id = auth.uid())
  );

-- 00020's policy, restored verbatim - `TO authenticated`, the one-way `USING`, and a
-- `WITH CHECK` that pins only the Safta account. Note that this is the state in which
-- MEXA-361's second attack (re-point a draft at a stranger, then send it) works.

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

-- 00020 set this comment; 00031 replaced it. Put 00020's back rather than leave a comment
-- describing rules that are no longer enforced.
COMMENT ON TABLE public.safta_likes IS
  'A Safta''s recommendation of one user to her grandchild. Created by the owning Safta '
  '(INSERT policy, 00002) and updatable by her only while sent_to_user is not yet true '
  '(MEXA-297): the flip to true queues a push through notify_safta_like and '
  'notification_queue cannot deduplicate, so the transition is deliberately one-way. '
  'DELETE is revoked from authenticated in 00016. Rows here drive the update_safta_stats '
  'counter, which only ever increments.';

-- =====================================================
-- 4. The ledger row
-- =====================================================
--
-- 00031 writes it inside its own transaction, so the inverse belongs inside this one.
-- Leaving it would let an apply script consider 00031 applied and never put it back.

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00031';

-- =====================================================
-- 5. Post-check
-- =====================================================

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 5a. 00031's trigger and function are gone, and the two that were here before it are not.
  IF EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relname = 'safta_likes' AND t.tgname = 'safta_likes_immutable'
  ) THEN
    RAISE EXCEPTION 'MEXA-361 rollback: safta_likes_immutable is still on safta_likes';
  END IF;

  IF to_regprocedure('public.enforce_safta_like_immutable()') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-361 rollback: enforce_safta_like_immutable() still exists';
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'safta_likes' AND NOT t.tgisinternal;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'MEXA-361 rollback: safta_likes carries % trigger(s), expected the 2 that predate 00031', v_n;
  END IF;

  SELECT string_agg(n, ', ') INTO v_bad FROM (
    SELECT unnest(ARRAY['safta_likes_update_stats', 'trigger_notify_safta_like']) AS n
  ) w
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'safta_likes' AND NOT t.tgisinternal AND t.tgname = w.n
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-361 rollback: trigger(s) that predate 00031 are missing: %', v_bad;
  END IF;

  -- 5b. The INSERT policy is 00002's, deparsed text for deparsed text.
  SELECT with_check INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'INSERT';
  IF v_bad IS DISTINCT FROM '(safta_account_id IN ( SELECT safta_accounts.id
   FROM safta_accounts
  WHERE (safta_accounts.auth_id = auth.uid())))' THEN
    RAISE EXCEPTION 'MEXA-361 rollback: the restored INSERT check is "%", not 00002''s', v_bad;
  END IF;

  -- 5c. The UPDATE policy is 00020's: the one-way USING intact, and a WITH CHECK that names
  -- no connection.
  SELECT qual INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'UPDATE';
  IF v_bad IS DISTINCT FROM '((sent_to_user IS NOT TRUE) AND (safta_account_id IN ( SELECT safta_accounts.id
   FROM safta_accounts
  WHERE (safta_accounts.auth_id = auth.uid()))))' THEN
    RAISE EXCEPTION 'MEXA-361 rollback: the restored UPDATE qual is "%", not 00020''s', v_bad;
  END IF;

  SELECT with_check INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'UPDATE';
  IF v_bad IS DISTINCT FROM '(safta_account_id IN ( SELECT safta_accounts.id
   FROM safta_accounts
  WHERE (safta_accounts.auth_id = auth.uid())))' THEN
    RAISE EXCEPTION 'MEXA-361 rollback: the restored UPDATE check is "%", not 00020''s', v_bad;
  END IF;

  -- 5d. Still exactly one policy per write verb, and the SELECT policy untouched.
  SELECT string_agg(format('%s:%s', cmd, n), ', ') INTO v_bad FROM (
    SELECT cmd, count(*) AS n FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'safta_likes' GROUP BY cmd
  ) g
   WHERE NOT (cmd IN ('SELECT', 'INSERT', 'UPDATE') AND n = 1);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-361 rollback: safta_likes policy shape is wrong (%); expected exactly one each of SELECT, INSERT, UPDATE and nothing else', v_bad;
  END IF;

  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00031') THEN
    RAISE EXCEPTION 'MEXA-361 rollback: the 00031 ledger row survived';
  END IF;

  RAISE NOTICE 'MEXA-361 rollback: 00002''s and 00020''s policies are back, the trigger is gone, and so is the consent rule.';
END
$$;

COMMIT;
