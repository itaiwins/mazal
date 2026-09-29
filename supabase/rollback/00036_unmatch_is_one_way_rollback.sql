-- ROLLBACK for 00036_unmatch_is_one_way.sql  (MEXA-418)
--
-- Restores `public.matches` to the state measured on `tayiyczmacvhokdxfqvm` immediately
-- before 00036 was applied. That state is the vulnerable one: after running this file, the
-- person who was unmatched can again set `is_active` back to true, clear the other side's
-- `*_unmatched` flag, and resume the thread. Run it only to get out of a bad apply, and
-- re-close the hole afterwards. The file ends in a `RAISE WARNING` saying so.
--
-- READ THIS FIRST: THE CLIENT GOES WITH IT
--
-- 00036 is a database change **and** a client change in the same commit: `useUnmatch` and
-- `useBlockUser` (src/api/mutations/useMatch.ts) call `supabase.rpc('unmatch', …)` instead
-- of writing the columns. This file drops that function, so any build shipped after that
-- commit loses unmatching and blocking entirely (PostgREST answers 404 for a missing RPC).
--
-- There is no TestFlight or store build of Mazal, so today the only client is a dev build
-- on somebody's machine. If that ever stops being true, roll the app back to the commit
-- before `useMatch.ts` changed, or do not run this file.
--
-- WHAT IT RESTORES, NAMED RATHER THAN DERIVED
--
-- A rollback is the one file nobody runs until the day it matters, so it enumerates its
-- target state instead of computing it (MEXA-364/MEXA-399: a "re-grant everything except a
-- skip list" rollback fails open by construction and goes stale in someone else's
-- migration). Measured pre-00036, project `tayiyczmacvhokdxfqvm`, 2026-09-29:
--
--   relacl                    {postgres=arwdDxtm/postgres, anon=arwd/postgres,
--                              authenticated=arwd/postgres, service_role=arwdDxtm/postgres}
--   pg_attribute.attacl       NULL on all eight columns - there were no column-level
--                             grants on this table at all
--   col_description           NULL on all eight columns
--   obj_description (table)   NULL
--   public.unmatch            did not exist, under any signature
--
-- NO POLICY IS TOUCHED, BECAUSE 00036 TOUCHES NONE
--
-- 00036 is a grant change, a function and four column comments. Section 4a asserts the two
-- 00002 policies are byte-for-byte what they were, which is the cheapest way to notice if
-- that ever stops being true.
--
-- `anon` IS CONDITIONAL, AND THAT IS THE POINT
--
-- 00036 revoked `anon`'s table-wide UPDATE. `00016_client_role_write_privileges.sql`
-- (reviewed, on `mazal-restart`, NOT applied as of 2026-09-29) revokes every `anon` table
-- privilege in `public` and asserts in its section 7a that `anon` holds nothing. If 00016
-- has been applied by the time this rollback runs, blindly re-granting to `anon` would hand
-- back a privilege a *different* migration deliberately took. Section 2 therefore branches
-- on the live ledger, and section 4 asserts the branch it took was the right one. This is
-- 00034's rollback's handling of the same collision.

BEGIN;

-- =====================================================
-- 0. Pre-flight: refuse unless 00036 is actually what is on this database
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.matches') IS NULL THEN
    RAISE EXCEPTION 'MEXA-418 rollback: public.matches does not exist';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00036') THEN
    RAISE EXCEPTION 'MEXA-418 rollback: 00036 is not in the ledger; refusing to undo a migration this database never had';
  END IF;

  IF has_table_privilege('authenticated', 'public.matches', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-418 rollback: authenticated already holds a TABLE-level UPDATE on public.matches; 00036 is not in effect here';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.matches', 'last_message_at', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-418 rollback: authenticated has no UPDATE on matches.last_message_at either; this is not the state 00036 leaves behind';
  END IF;

  IF to_regprocedure('public.unmatch(uuid)') IS NULL THEN
    RAISE EXCEPTION 'MEXA-418 rollback: public.unmatch(uuid) does not exist; this is not the state 00036 leaves behind';
  END IF;

  -- Remember which way section 2 must branch, and what must not move, and prove both in
  -- section 4.
  PERFORM set_config('mexa418rb.has_00016',
    (SELECT (count(*) > 0)::text FROM supabase_migrations.schema_migrations WHERE version = '00016'), false);
  PERFORM set_config('mexa418rb.pol',
    (SELECT coalesce(string_agg(policyname || '|' || cmd || '|' || coalesce(qual, '<null>')
                                || '|' || coalesce(with_check, '<null>'), ';;' ORDER BY policyname), '')
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matches'), false);
  PERFORM set_config('mexa418rb.rows', (SELECT count(*)::text FROM public.matches), false);
  PERFORM set_config('mexa418rb.active',
    (SELECT count(*)::text FROM public.matches WHERE is_active), false);
END
$$;

-- =====================================================
-- 1. The function goes
-- =====================================================
--
-- Dropped, not left in place. Leaving it would be the kinder half-rollback, but it would
-- also leave a SECURITY DEFINER writer on a table that is simultaneously client-writable,
-- i.e. a state no migration on this branch ever produced and nobody has reviewed. The
-- pre-00036 state had no such function; this file restores that.

DROP FUNCTION IF EXISTS public.unmatch(UUID);

-- =====================================================
-- 2. Privileges back
-- =====================================================
--
-- Column grant first, then the table grant. Removing the attribute ACL entry is what
-- restores `pg_attribute.attacl = NULL`; doing it afterwards would be a no-op against the
-- table-wide grant (a column REVOKE cannot cut a table grant - MEXA-359).

REVOKE UPDATE (last_message_at) ON TABLE public.matches FROM authenticated;
GRANT UPDATE ON TABLE public.matches TO authenticated;

DO $$
BEGIN
  IF current_setting('mexa418rb.has_00016')::BOOLEAN THEN
    RAISE NOTICE 'MEXA-418 rollback: 00016 is applied, so anon''s UPDATE on public.matches is NOT restored - 00016 section 7a asserts anon holds nothing.';
  ELSE
    GRANT UPDATE ON TABLE public.matches TO anon;
  END IF;
END
$$;

-- =====================================================
-- 3. Comments back to NULL, and the ledger row out
-- =====================================================
--
-- All eight columns had a NULL comment before 00036, and the table comment was NULL too
-- (00016 writes that one and is not applied, so this file must not invent it).

COMMENT ON COLUMN public.matches.is_active       IS NULL;
COMMENT ON COLUMN public.matches.user1_unmatched IS NULL;
COMMENT ON COLUMN public.matches.user2_unmatched IS NULL;
COMMENT ON COLUMN public.matches.last_message_at IS NULL;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00036';

-- =====================================================
-- 4. Assert the restore
-- =====================================================

DO $$
DECLARE
  v_16     BOOLEAN := current_setting('mexa418rb.has_00016')::BOOLEAN;
  v_pol    TEXT    := current_setting('mexa418rb.pol');
  v_rows   INTEGER := current_setting('mexa418rb.rows')::INTEGER;
  v_active INTEGER := current_setting('mexa418rb.active')::INTEGER;
  v_bad    TEXT;
  v_n      INTEGER;
BEGIN
  -- 4a. No policy moved, in either direction. 00036 writes none and neither does this file.
  SELECT coalesce(string_agg(policyname || '|' || cmd || '|' || coalesce(qual, '<null>')
                             || '|' || coalesce(with_check, '<null>'), ';;' ORDER BY policyname), '')
    INTO v_bad FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matches';
  IF v_bad IS DISTINCT FROM v_pol THEN
    RAISE EXCEPTION 'MEXA-418 rollback: the policies on public.matches changed; neither file touches them'
      USING DETAIL = format('before: %s%safter:  %s', v_pol, chr(10), v_bad);
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.matches'::regclass) THEN
    RAISE EXCEPTION 'MEXA-418 rollback: row level security is off on public.matches';
  END IF;

  -- 4b. authenticated is back to a table-wide UPDATE with no column ACL left behind.
  IF NOT has_table_privilege('authenticated', 'public.matches', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-418 rollback: authenticated did not get the table-level UPDATE back';
  END IF;
  SELECT string_agg(attname, ', ') INTO v_bad
    FROM pg_attribute
   WHERE attrelid = 'public.matches'::regclass AND attnum > 0 AND NOT attisdropped
     AND attacl IS NOT NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-418 rollback: column-level ACLs survive on public.matches (%); the measured pre-state had none', v_bad;
  END IF;

  -- 4c. anon is where the ledger says it should be. Both directions are asserted, so the
  -- branch cannot silently have gone the wrong way.
  IF v_16 AND has_table_privilege('anon', 'public.matches', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-418 rollback: 00016 is applied but anon was re-granted UPDATE on public.matches';
  END IF;
  IF NOT v_16 AND NOT has_table_privilege('anon', 'public.matches', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-418 rollback: 00016 is not applied, so anon''s UPDATE should have been restored and was not';
  END IF;

  -- 4d. The function is gone under every signature, not just the one this file named.
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname = 'unmatch';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-418 rollback: public.unmatch still exists: %', v_bad;
  END IF;

  -- 4e. Comments cleared, ledger row gone, no row touched - and in particular no match was
  -- reactivated or deactivated on the way through. A rollback that quietly flipped
  -- `is_active` would be undoing people's unmatches, which is the one thing worse than the
  -- bug.
  SELECT string_agg(attname, ', ') INTO v_bad
    FROM pg_attribute
   WHERE attrelid = 'public.matches'::regclass AND attnum > 0 AND NOT attisdropped
     AND col_description(attrelid, attnum) IS NOT NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-418 rollback: column comments survive on public.matches: %', v_bad;
  END IF;
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00036') THEN
    RAISE EXCEPTION 'MEXA-418 rollback: the 00036 ledger row is still there';
  END IF;
  SELECT count(*) INTO v_n FROM public.matches;
  IF v_n <> v_rows THEN
    RAISE EXCEPTION 'MEXA-418 rollback: matches row count changed % -> %', v_rows, v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.matches WHERE is_active;
  IF v_n <> v_active THEN
    RAISE EXCEPTION 'MEXA-418 rollback: the number of active matches changed % -> %', v_active, v_n;
  END IF;

  RAISE WARNING 'MEXA-418 rollback: public.matches is back to its pre-00036 state - which means the person who was unmatched can again set is_active back to true and resume the thread, and the app''s unmatch and block both call an RPC that no longer exists. Re-close it.';
END
$$;

COMMIT;
