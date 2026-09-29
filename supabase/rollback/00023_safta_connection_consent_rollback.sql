-- Rollback for 00023_safta_connection_consent.sql
--
-- NOT a migration. Nothing applies this file automatically; it exists so 00023 can be
-- undone on a database that has it. Running it puts `safta_connections` back exactly as
-- `00002_rls_policies.sql` left it - both policies byte for byte as `pg_policies` reported
-- them on the live project `tayiyczmacvhokdxfqvm` on 2026-09-29, before 00023 was applied -
-- drops the trigger and its function, and deletes 00023's ledger row.
--
-- WHAT RUNNING THIS COSTS YOU
--
-- It re-opens MEXA-357 in full. Afterwards, any signed-in account can create a
-- `safta_accounts` row for itself (no vetting), INSERT a `safta_connections` row naming any
-- other user's `users.id` with `status = 'accepted'` outright, and message that person
-- through `safta_messages`, whose only connection-side gate is `sc.status = 'accepted'`.
-- No invite, no code, no action by the person on the other end. A grandchild holding any
-- connection row can also re-point it at an arbitrary `safta_accounts.id` and accept it.
--
-- **Do not leave this rolled back with `00022` applied.** `safta_public_profiles`
-- (MEXA-302) publishes a Safta's `display_name` and `relationship` to the
-- `connected_user_id` of any `accepted` row, on the stated premise that accepting is how
-- the grandchild consents. With 00023 off, that premise is false and the attacker above
-- gets to choose the name her forged messages arrive under. If both are on and you must
-- undo one, undo `00022` first.
--
-- The only reason to run this file is to get a half-applied deploy back to a known state,
-- and 00023 should go straight back on afterwards.
--
-- WHAT IT DOES NOT RESTORE
--
-- `accepted_at` values that 00023's trigger normalised while it was applied. The trigger
-- clears `accepted_at` on any row updated to a non-`accepted` status and stamps it on the
-- first move to `accepted`; those writes are ordinary column values and this file does not
-- try to guess what was there before. `safta_connections` held 0 rows on live when 00023
-- was written, so on that database there is nothing to restore. On any other, read section
-- 1's notice before deciding.
--
-- Nor does it restore `status` values: 00023 refuses `'accepted'` on INSERT, it never
-- rewrites a row, so no status was changed by applying it.

BEGIN;

-- =====================================================
-- 1. Pre-flight
-- =====================================================

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  IF to_regclass('public.safta_connections') IS NULL THEN
    RAISE EXCEPTION 'MEXA-357 rollback: public.safta_connections does not exist';
  END IF;

  -- Refuse to run against a database that never had 00023: this file would then be
  -- *installing* the old, vulnerable policies over whatever is actually there.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'safta_connections'
       AND cmd = 'INSERT' AND with_check LIKE '%pending%'
  ) THEN
    RAISE EXCEPTION 'MEXA-357 rollback: the safta_connections INSERT policy does not constrain status, so 00023 is not applied here. Nothing to roll back.';
  END IF;

  SELECT count(*) INTO v_n FROM public.safta_connections WHERE accepted_at IS NOT NULL;
  IF v_n > 0 THEN
    RAISE NOTICE 'MEXA-357 rollback: % row(s) carry an accepted_at that 00023''s trigger may have written. This file does not restore prior values.', v_n;
  END IF;
END
$$;

-- =====================================================
-- 2. The trigger and its function
-- =====================================================
--
-- The trigger goes first so the function has no dependent when it is dropped; both are
-- named, no CASCADE, so a surprise dependency raises instead of being swept up.

DROP TRIGGER IF EXISTS safta_connections_immutable ON public.safta_connections;
DROP FUNCTION IF EXISTS public.enforce_safta_connection_immutable();

-- =====================================================
-- 3. The two policies, as 00002 wrote them
-- =====================================================
--
-- `TO public` and the inline `users` subquery are restored deliberately: this is 00002's
-- text, not an improved version of it. A rollback that leaves behind a different policy
-- from the one it claims to restore is not a rollback.

DROP POLICY IF EXISTS "Safta can create connections" ON public.safta_connections;

CREATE POLICY "Safta can create connections"
  ON public.safta_connections FOR INSERT
  WITH CHECK (
    safta_account_id IN (SELECT id FROM public.safta_accounts WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update connection status" ON public.safta_connections;

CREATE POLICY "Users can update connection status"
  ON public.safta_connections FOR UPDATE
  USING (
    connected_user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- 00002 set no COMMENT on this table; 00023 added one. Remove it rather than leave a
-- comment describing rules that are no longer enforced.
COMMENT ON TABLE public.safta_connections IS NULL;

-- =====================================================
-- 4. The ledger row
-- =====================================================
--
-- 00023 writes it inside its own transaction, so the inverse belongs inside this one.
-- Leaving it would let an apply script consider 00023 applied and never put it back.

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00023';

-- =====================================================
-- 5. Post-check
-- =====================================================

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  SELECT count(*) INTO v_n
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'safta_connections' AND NOT t.tgisinternal;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MEXA-357 rollback: % trigger(s) remain on safta_connections', v_n;
  END IF;

  IF to_regprocedure('public.enforce_safta_connection_immutable()') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-357 rollback: enforce_safta_connection_immutable() still exists';
  END IF;

  SELECT with_check INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'INSERT';
  IF v_bad IS DISTINCT FROM '(safta_account_id IN ( SELECT safta_accounts.id
   FROM safta_accounts
  WHERE (safta_accounts.auth_id = auth.uid())))' THEN
    RAISE EXCEPTION 'MEXA-357 rollback: the restored INSERT check is "%", not 00002''s', v_bad;
  END IF;

  SELECT qual INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'UPDATE';
  IF v_bad IS DISTINCT FROM '(connected_user_id = ( SELECT users.id
   FROM users
  WHERE (users.auth_id = auth.uid())))' THEN
    RAISE EXCEPTION 'MEXA-357 rollback: the restored UPDATE qual is "%", not 00002''s', v_bad;
  END IF;

  SELECT with_check INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'UPDATE';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-357 rollback: the restored UPDATE policy still has a WITH CHECK ("%")', v_bad;
  END IF;

  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00023') THEN
    RAISE EXCEPTION 'MEXA-357 rollback: the 00023 ledger row survived';
  END IF;

  RAISE NOTICE 'MEXA-357 rollback: 00002''s policies are back, the trigger is gone, and so is the consent rule.';
END
$$;

COMMIT;
