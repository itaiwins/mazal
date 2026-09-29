-- ROLLBACK for 00034_messages_are_not_rewritable.sql  (MEXA-406)
--
-- Restores `public.messages` to the state measured on `tayiyczmacvhokdxfqvm` on
-- 2026-09-29, immediately before 00034 was applied. That state is the vulnerable one:
-- after running this file, either participant in a match can again rewrite the other
-- person's message body and reassign its authorship. Run it only to get out of a bad
-- apply, and re-close the hole afterwards. The file ends in a `RAISE WARNING` saying so.
--
-- WHAT IT RESTORES, NAMED RATHER THAN DERIVED
--
-- A rollback is the one file nobody runs until the day it matters, so it enumerates its
-- target state instead of computing it (MEXA-364/MEXA-399: a "re-grant everything except a
-- skip list" rollback fails open by construction and goes stale in someone else's
-- migration). Measured pre-00034, project `tayiyczmacvhokdxfqvm`, 2026-09-29:
--
--   relacl                    {postgres=arwdDxtm/postgres, anon=arwd/postgres,
--                              authenticated=arwd/postgres, service_role=arwdDxtm/postgres}
--   pg_attribute.attacl       NULL on all nine columns - there were no column-level
--                             grants on this table at all
--   col_description           NULL on all nine columns
--   obj_description (table)   NULL
--
-- NO POLICY IS TOUCHED, BECAUSE 00034 TOUCHES NONE
--
-- An earlier draft of 00034 added a `WITH CHECK` mirroring the policy's `USING` clause, and
-- this file dropped and recreated the policy to remove it. Both were deleted once the
-- semantics were settled by execution (`.scratch/mazal-mexa406/semantics.mjs`, PG 17.6): for
-- an UPDATE policy a NULL `with_check` means the `USING` expression **is** applied to the
-- new row, so the mirror was a measured no-op. 00034 is now a grant change and four column
-- comments, and this file is its exact inverse. Section 3a asserts the policy is byte-for-
-- byte what it was, which is the cheapest way to notice if that ever stops being true.
--
-- `anon` IS CONDITIONAL, AND THAT IS THE POINT
--
-- 00034 revoked `anon`'s table-wide UPDATE. `00016_client_role_write_privileges.sql`
-- (reviewed, on `mazal-restart`, NOT applied as of 2026-09-29) revokes every `anon` table
-- privilege in `public` and asserts in its section 7a that `anon` holds nothing. If 00016
-- has been applied by the time this rollback runs, blindly re-granting to `anon` would
-- hand back a privilege a *different* migration deliberately took - on a dating app's chat
-- table, to a role whose key ships inside the app binary. Section 1 therefore branches on
-- the live ledger, and section 3 asserts the branch it took was the right one. Both
-- branches are exercised in `.scratch/mazal-mexa406/guards_00034.mjs`.

BEGIN;

-- =====================================================
-- 0. Pre-flight: refuse unless 00034 is actually what is on this database
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.messages') IS NULL THEN
    RAISE EXCEPTION 'MEXA-406 rollback: public.messages does not exist';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00034') THEN
    RAISE EXCEPTION 'MEXA-406 rollback: 00034 is not in the ledger; refusing to undo a migration this database never had';
  END IF;

  IF has_table_privilege('authenticated', 'public.messages', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-406 rollback: authenticated already holds a TABLE-level UPDATE on public.messages; 00034 is not in effect here';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.messages', 'is_read', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-406 rollback: authenticated has no UPDATE on messages.is_read either; this is not the state 00034 leaves behind';
  END IF;

  -- Remember which way section 1 must branch, and what must not move, and prove both in
  -- section 3.
  PERFORM set_config('mexa406rb.has_00016',
    (SELECT (count(*) > 0)::text FROM supabase_migrations.schema_migrations WHERE version = '00016'), false);
  PERFORM set_config('mexa406rb.pol',
    (SELECT coalesce(qual, '') || '||' || coalesce(with_check, '<null>')
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages'
        AND policyname = 'Users can update messages'), false);
  PERFORM set_config('mexa406rb.rows', (SELECT count(*)::text FROM public.messages), false);
END
$$;

-- =====================================================
-- 1. Privileges back
-- =====================================================
--
-- Column grant first, then the table grant. Removing the attribute ACL entry is what
-- restores `pg_attribute.attacl = NULL`; doing it afterwards would be a no-op against the
-- table-wide grant (a column REVOKE cannot cut a table grant - MEXA-359).

REVOKE UPDATE (is_read, read_at) ON TABLE public.messages FROM authenticated;
GRANT UPDATE ON TABLE public.messages TO authenticated;

DO $$
BEGIN
  IF current_setting('mexa406rb.has_00016')::BOOLEAN THEN
    RAISE NOTICE 'MEXA-406 rollback: 00016 is applied, so anon''s UPDATE on public.messages is NOT restored - 00016 section 7a asserts anon holds nothing.';
  ELSE
    GRANT UPDATE ON TABLE public.messages TO anon;
  END IF;
END
$$;

-- =====================================================
-- 2. Comments back to NULL, and the ledger row out
-- =====================================================
--
-- All nine columns had a NULL comment before 00034, and the table comment was NULL too
-- (00016 writes that one and is not applied, so this file must not invent it).

COMMENT ON COLUMN public.messages.content   IS NULL;
COMMENT ON COLUMN public.messages.sender_id IS NULL;
COMMENT ON COLUMN public.messages.is_read   IS NULL;
COMMENT ON COLUMN public.messages.read_at   IS NULL;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00034';

-- =====================================================
-- 3. Assert the restore
-- =====================================================

DO $$
DECLARE
  v_16    BOOLEAN := current_setting('mexa406rb.has_00016')::BOOLEAN;
  v_pol   TEXT    := current_setting('mexa406rb.pol');
  v_rows  INTEGER := current_setting('mexa406rb.rows')::INTEGER;
  v_bad   TEXT;
  v_n     INTEGER;
BEGIN
  -- 3a. No policy moved, in either direction. 00034 writes none and neither does this file.
  SELECT coalesce(qual, '') || '||' || coalesce(with_check, '<null>')
    INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'messages'
     AND policyname = 'Users can update messages';
  IF v_bad IS DISTINCT FROM v_pol THEN
    RAISE EXCEPTION 'MEXA-406 rollback: the UPDATE policy on public.messages changed; neither file touches it'
      USING DETAIL = format('before: %s%safter:  %s', v_pol, chr(10), v_bad);
  END IF;

  SELECT coalesce(string_agg(policyname || ':' || cmd, ',' ORDER BY policyname), '')
    INTO v_bad FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages';
  IF v_bad IS DISTINCT FROM 'Users can send messages:INSERT,Users can update messages:UPDATE,Users can view messages in own matches:SELECT' THEN
    RAISE EXCEPTION 'MEXA-406 rollback: the policy set on public.messages is "%"', v_bad;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.messages'::regclass) THEN
    RAISE EXCEPTION 'MEXA-406 rollback: row level security is off on public.messages';
  END IF;

  -- 3b. authenticated is back to a table-wide UPDATE with no column ACL left behind.
  IF NOT has_table_privilege('authenticated', 'public.messages', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-406 rollback: authenticated did not get the table-level UPDATE back';
  END IF;
  SELECT string_agg(attname, ', ') INTO v_bad
    FROM pg_attribute
   WHERE attrelid = 'public.messages'::regclass AND attnum > 0 AND NOT attisdropped
     AND attacl IS NOT NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-406 rollback: column-level ACLs survive on public.messages (%); the measured pre-state had none', v_bad;
  END IF;

  -- 3c. anon is where the ledger says it should be. Both directions are asserted, so the
  -- branch cannot silently have gone the wrong way.
  IF v_16 AND has_table_privilege('anon', 'public.messages', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-406 rollback: 00016 is applied but anon was re-granted UPDATE on public.messages';
  END IF;
  IF NOT v_16 AND NOT has_table_privilege('anon', 'public.messages', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-406 rollback: 00016 is not applied, so anon''s UPDATE should have been restored and was not';
  END IF;

  -- 3d. Comments cleared, ledger row gone, no row touched.
  SELECT string_agg(attname, ', ') INTO v_bad
    FROM pg_attribute
   WHERE attrelid = 'public.messages'::regclass AND attnum > 0 AND NOT attisdropped
     AND col_description(attrelid, attnum) IS NOT NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-406 rollback: column comments survive on public.messages: %', v_bad;
  END IF;
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00034') THEN
    RAISE EXCEPTION 'MEXA-406 rollback: the 00034 ledger row is still there';
  END IF;
  SELECT count(*) INTO v_n FROM public.messages;
  IF v_n <> v_rows THEN
    RAISE EXCEPTION 'MEXA-406 rollback: messages row count changed % -> %', v_rows, v_n;
  END IF;

  RAISE WARNING 'MEXA-406 rollback: public.messages is back to its pre-00034 state - which means a match participant can again rewrite the other person''s messages. Re-close it.';
END
$$;

COMMIT;
