-- ROLLBACK for 00024_revoke_self_awarded_verified_badge.sql (MEXA-359 Part A)
--
-- Puts `UPDATE (is_verified)` back in `authenticated`'s hands and restores 00015's table
-- comment verbatim, so the database is byte-identical to its pre-00024 state.
--
-- WHAT THIS RESTORES IS A KNOWN HOLE. Running this file makes the trust badge
-- self-awardable again: any signed-in user can `PATCH /rest/v1/users?id=eq.<self>` with
-- `{"is_verified": true}`, and - if the client half of MEXA-359 is also reverted - the
-- app's own "Verify Your Profile" button awards it on a coin flip via mock mode. Use it
-- only to get back to a known state, and only while live has no real users. If the badge
-- ever has to come back without 00024, revert the client commit in the same breath, or the
-- app will keep attempting a write it no longer needs and nobody will know which of the
-- two halves is in force.
--
-- `is_photo_verified` IS NOT RESTORED, ON PURPOSE. 00024 revoked UPDATE on both columns,
-- but `authenticated` never held it for `is_photo_verified`: 00015 revoked table-wide
-- INSERT/UPDATE and never granted that column back, and it was already FALSE on live when
-- 00024 ran (00024's header records the measurement). So that half of 00024's REVOKE was a
-- no-op, and granting the column here would not be a rollback - it would hand out a
-- privilege no migration has ever granted. Section 2 asserts it stayed absent.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'MEXA-359 rollback: public.users does not exist';
  END IF;

  -- Refuse to run against a database that does not have 00024 applied, rather than quietly
  -- granting a privilege nobody asked for.
  IF has_column_privilege('authenticated', 'public.users', 'is_verified', 'UPDATE') THEN
    RAISE EXCEPTION
      'MEXA-359 rollback: authenticated can already UPDATE users.is_verified, so 00024 is not applied; nothing to roll back';
  END IF;

  -- The GRANT below is column-level and would be pointless noise on a database where
  -- 00015's column scoping is absent.
  IF has_table_privilege('authenticated', 'public.users', 'UPDATE') THEN
    RAISE EXCEPTION
      'MEXA-359 rollback: authenticated holds a TABLE-level UPDATE on public.users; this is not a post-00015 database';
  END IF;

  PERFORM set_config('mexa359rb.privs',
    (SELECT coalesce(string_agg(format('%s:%s:%s', grantee, privilege_type, column_name),
                                ',' ORDER BY grantee, privilege_type, column_name), '')
       FROM information_schema.column_privileges
      WHERE table_schema = 'public' AND table_name = 'users'), false);
  PERFORM set_config('mexa359rb.rows', (SELECT count(*)::text FROM public.users), false);

  -- If a server has already written real badges under 00024, this rollback re-opens them to
  -- client edits. Worth a line in the apply record.
  SELECT count(*) INTO v_n FROM public.users WHERE is_verified IS TRUE;
  RAISE NOTICE 'MEXA-359 rollback: % users have is_verified = true and become client-editable again', v_n;
END
$$;

-- =====================================================
-- 1. Undo
-- =====================================================

-- 00015's grant, restored exactly: one column, UPDATE only, `authenticated` only.
GRANT UPDATE (is_verified) ON TABLE public.users TO authenticated;

-- 00015's comment, restored verbatim. Checked character-for-character against
-- supabase/migrations/00015_scope_users_write_grants.sql.
COMMENT ON TABLE public.users IS
  'MEXA-276: INSERT and UPDATE are column-scoped for `authenticated` - see '
  'supabase/migrations/00015_scope_users_write_grants.sql for the column list and the '
  'client write path behind each one. A column with no client write path is not granted; '
  'adding a screen that writes one means adding the GRANT in the same migration. '
  '`is_verified` is granted and is self-asserted until photo verification moves '
  'server-side.';

-- 00024 inserted its own ledger row inside its transaction (MEXA-325), so the rollback
-- removes it. Leaving it would tell the next runbook 00024 is applied when it is not,
-- which is the exact failure MEXA-325 and MEXA-290 exist to stop.
DELETE FROM supabase_migrations.schema_migrations
 WHERE version = '00024' AND name = 'revoke_self_awarded_verified_badge';

-- =====================================================
-- 2. Assert we are back where we started
-- =====================================================

DO $$
DECLARE
  v_privs_before TEXT    := current_setting('mexa359rb.privs');
  v_rows_before  INTEGER := current_setting('mexa359rb.rows')::INTEGER;
  v_privs_after  TEXT;
  v_expected     TEXT;
  v_n            INTEGER;
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.users', 'is_verified', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-359 rollback: the GRANT did not take';
  END IF;

  -- The no-op half of 00024's REVOKE must stay a no-op. Granting this would be a privilege
  -- escalation dressed as a rollback.
  IF has_column_privilege('authenticated', 'public.users', 'is_photo_verified', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-359 rollback: authenticated gained UPDATE on is_photo_verified, which it never held';
  END IF;

  IF has_column_privilege('anon', 'public.users', 'is_verified', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-359 rollback: anon gained UPDATE on is_verified';
  END IF;

  IF has_column_privilege('authenticated', 'public.users', 'is_verified', 'INSERT') THEN
    RAISE EXCEPTION 'MEXA-359 rollback: authenticated gained INSERT on is_verified';
  END IF;

  -- Exactly one privilege came back, and it is the one 00024 took.
  SELECT coalesce(string_agg(format('%s:%s:%s', grantee, privilege_type, column_name),
                             ',' ORDER BY grantee, privilege_type, column_name), '')
    INTO v_privs_after
    FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND table_name = 'users';

  SELECT coalesce(string_agg(format('%s:%s:%s', grantee, privilege_type, column_name),
                             ',' ORDER BY grantee, privilege_type, column_name), '')
    INTO v_expected
    FROM (
      SELECT unnest(string_to_array(v_privs_before, ',')
                    || ARRAY['authenticated:UPDATE:is_verified']) AS e
    ) s
    CROSS JOIN LATERAL (
      SELECT split_part(s.e, ':', 1) AS grantee,
             split_part(s.e, ':', 2) AS privilege_type,
             split_part(s.e, ':', 3) AS column_name
    ) p
   WHERE s.e <> '';

  IF v_privs_after IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'MEXA-359 rollback: column privileges are not "post-00024 plus authenticated:UPDATE:is_verified"'
      USING DETAIL = format('expected: %s%sactual:   %s', v_expected, chr(10), v_privs_after);
  END IF;

  -- The comment is 00015's again, not 00024's.
  IF coalesce(obj_description('public.users'::regclass, 'pg_class'), '') NOT LIKE '%is self-asserted until photo verification moves server-side%'
     OR obj_description('public.users'::regclass, 'pg_class') LIKE '%NO LONGER client-writable%' THEN
    RAISE EXCEPTION 'MEXA-359 rollback: the users table comment is not 00015''s text';
  END IF;

  SELECT count(*) INTO v_n
    FROM supabase_migrations.schema_migrations WHERE version = '00024';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MEXA-359 rollback: the 00024 ledger row is still present';
  END IF;

  SELECT count(*) INTO v_n FROM public.users;
  IF v_n <> v_rows_before THEN
    RAISE EXCEPTION 'MEXA-359 rollback: users row count changed % -> %', v_rows_before, v_n;
  END IF;

  RAISE NOTICE 'MEXA-359 rollback: users.is_verified is client-writable again and 00015''s comment is restored';
END
$$;

COMMIT;
