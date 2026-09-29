-- ROLLBACK for 00034_messages_are_not_rewritable.sql  (MEXA-406)
--
-- Restores `public.messages` to the state measured on `tayiyczmacvhokdxfqvm` on
-- 2026-09-29, immediately before 00034 was applied. That state is the vulnerable one:
-- after running this file, either participant in a match can again rewrite the other
-- person's message body and reassign its authorship. Run it only to get out of a bad
-- apply, and re-close the hole afterwards.
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
--   policy "Users can update messages"
--                             FOR UPDATE, PERMISSIVE, TO PUBLIC,
--                             USING (<the expression in section 2>), WITH CHECK NULL
--   col_description           NULL on all nine columns
--   obj_description (table)   NULL
--
-- WHY THE POLICY IS DROPPED AND RECREATED
--
-- `ALTER POLICY` can set a WITH CHECK but cannot remove one - there is no
-- `WITH CHECK NULL`. So restoring "with_check IS NULL" means DROP + CREATE, and the USING
-- expression below is a verbatim copy of what `pg_get_expr(polqual, …, true)` returned on
-- live before the apply. Section 4 asserts the recreated policy's rendered `qual` matches
-- what was there, which is what catches a transcription slip.
--
-- `anon` IS CONDITIONAL, AND THAT IS THE POINT
--
-- 00034 revoked `anon`'s table-wide UPDATE. `00016_client_role_write_privileges.sql`
-- (reviewed, on `mazal-restart`, NOT applied as of 2026-09-29) revokes every `anon` table
-- privilege in `public` and asserts in its section 7a that `anon` holds nothing. If 00016
-- has been applied by the time this rollback runs, blindly re-granting to `anon` would
-- hand back a privilege a *different* migration deliberately took - on a dating app's chat
-- table, to a role whose key ships inside the app binary. Section 1 therefore branches on
-- the live ledger, and section 4 asserts the branch it took was the right one.

BEGIN;

-- =====================================================
-- 0. Pre-flight: refuse unless 00034 is actually what is on this database
-- =====================================================

DO $$
DECLARE
  v_check TEXT;
BEGIN
  IF to_regclass('public.messages') IS NULL THEN
    RAISE EXCEPTION 'MEXA-406 rollback: public.messages does not exist';
  END IF;

  SELECT with_check INTO v_check
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'messages'
     AND policyname = 'Users can update messages';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEXA-406 rollback: the UPDATE policy "Users can update messages" is not on public.messages';
  END IF;
  IF v_check IS NULL THEN
    RAISE EXCEPTION 'MEXA-406 rollback: with_check is already NULL; 00034 is not applied here';
  END IF;

  IF has_table_privilege('authenticated', 'public.messages', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-406 rollback: authenticated already holds a TABLE-level UPDATE on public.messages; 00034 is not applied here';
  END IF;

  -- Remember which way section 1 must branch, and prove it in section 4.
  PERFORM set_config('mexa406rb.has_00016',
    (SELECT (count(*) > 0)::text FROM supabase_migrations.schema_migrations WHERE version = '00016'), false);
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
-- 2. The policy back to a NULL with_check
-- =====================================================
--
-- The USING expression is the verbatim pre-00034 text. Do not "tidy" it: section 4
-- compares the rendered result against this shape.

DROP POLICY "Users can update messages" ON public.messages;

CREATE POLICY "Users can update messages" ON public.messages
  AS PERMISSIVE
  FOR UPDATE
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1
        FROM matches m
       WHERE m.id = messages.match_id
         AND (m.user1_id = (SELECT users.id FROM users WHERE users.auth_id = auth.uid())
           OR m.user2_id = (SELECT users.id FROM users WHERE users.auth_id = auth.uid()))
    )
  );

-- =====================================================
-- 3. Comments back to NULL
-- =====================================================
--
-- All nine columns had a NULL comment before 00034, and the table comment was NULL too
-- (00016 writes that one and is not applied, so this file must not invent it).

COMMENT ON COLUMN public.messages.content   IS NULL;
COMMENT ON COLUMN public.messages.sender_id IS NULL;
COMMENT ON COLUMN public.messages.is_read   IS NULL;
COMMENT ON COLUMN public.messages.read_at   IS NULL;

-- =====================================================
-- 4. Ledger row out, and assert the restore
-- =====================================================

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00034';

DO $$
DECLARE
  v_16    BOOLEAN := current_setting('mexa406rb.has_00016')::BOOLEAN;
  v_rows  INTEGER := current_setting('mexa406rb.rows')::INTEGER;
  v_qual  TEXT;
  v_check TEXT;
  v_bad   TEXT;
  v_n     INTEGER;
BEGIN
  -- 4a. authenticated is back to a table-wide UPDATE with no column ACL left behind.
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

  -- 4b. anon is where the ledger says it should be. Both directions are asserted, so the
  -- branch cannot silently have gone the wrong way.
  IF v_16 AND has_table_privilege('anon', 'public.messages', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-406 rollback: 00016 is applied but anon was re-granted UPDATE on public.messages';
  END IF;
  IF NOT v_16 AND NOT has_table_privilege('anon', 'public.messages', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-406 rollback: 00016 is not applied, so anon''s UPDATE should have been restored and was not';
  END IF;

  -- 4c. The policy is back, with a NULL with_check and the original row filter.
  SELECT qual, with_check INTO v_qual, v_check
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'messages'
     AND policyname = 'Users can update messages';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEXA-406 rollback: the UPDATE policy was dropped and not recreated';
  END IF;
  IF v_check IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-406 rollback: with_check is still set: %', v_check;
  END IF;
  IF v_qual NOT LIKE '%m.id = messages.match_id%'
     OR v_qual NOT LIKE '%m.user1_id%' OR v_qual NOT LIKE '%m.user2_id%'
     OR v_qual NOT LIKE '%users.auth_id = auth.uid()%' THEN
    RAISE EXCEPTION 'MEXA-406 rollback: the recreated USING clause is not the pre-00034 expression: %', v_qual;
  END IF;

  -- 4d. Exactly the three policies that were there, and RLS still on. A DROP + CREATE is
  -- the one statement pair in this file that could leave the table unprotected.
  SELECT coalesce(string_agg(policyname || ':' || cmd, ',' ORDER BY policyname), '')
    INTO v_bad FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages';
  IF v_bad IS DISTINCT FROM 'Users can send messages:INSERT,Users can update messages:UPDATE,Users can view messages in own matches:SELECT' THEN
    RAISE EXCEPTION 'MEXA-406 rollback: the policy set on public.messages is "%"', v_bad;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.messages'::regclass) THEN
    RAISE EXCEPTION 'MEXA-406 rollback: row level security is off on public.messages';
  END IF;

  -- 4e. Comments cleared, ledger row gone, no row touched.
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
