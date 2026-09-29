-- Rollback for 00037_shadchan_notes_belong_to_their_shadchan.sql (MEXA-419)
--
-- =====================================================
-- WHAT THIS RESTORES, NAMED
-- =====================================================
--
-- The exact pre-apply state of `public.shadchan_notes`, measured on
-- `tayiyczmacvhokdxfqvm` (PG 17.6) on 2026-09-29 before the apply
-- (`.scratch/mazal-mexa419/SCHEMA.txt`). Not "undoes 00037" - these five facts:
--
--   1. One policy, and only one:
--        "shadchan_notes_select_own"  FOR ALL  TO public
--          USING (true)   WITH CHECK NULL
--   2. `relacl` = {postgres=arwdDxtm/postgres,anon=arwd/postgres,
--                  authenticated=arwd/postgres,service_role=arwdDxtm/postgres}
--      i.e. `anon` holds INSERT, SELECT, UPDATE and DELETE again. Section 6c checks this as
--      a set, not as that string: a REVOKE-then-GRANT round trip restores the same four
--      entries in a different array order.
--   3. No foreign key on `shadchan_notes.shadchan_id`, and no comment on that column.
--   4. No `public.current_shadchan_ids()`.
--   5. No comment on the table (it was NULL).
--
-- Plus the ledger row `00037`, removed.
--
-- =====================================================
-- READ THIS BEFORE RUNNING IT
-- =====================================================
--
-- **Running this re-opens the hole.** It is not a neutral undo. After it, any signed-in
-- user - and any holder of the anon key, which ships in the app binary - can read, rewrite,
-- delete and forge every matchmaker note, which is MEXA-419 exactly as filed and measured.
-- Run it only to get back to a known state before re-applying a corrected 00037, and say on
-- the issue that the table is open again in the meantime.
--
-- It is safe on data: `shadchan_notes` had 0 rows at apply time and this file touches none.
-- If the table has acquired rows since, section 1 warns rather than blocks - dropping a
-- foreign key never strands anything - but a row whose `shadchan_id` is not a `shadchanim.id`
-- can exist again afterwards, and 00037's guard 0f will refuse to re-apply until that is
-- settled. That is deliberate.
--
-- It refuses to run twice, and refuses to run against a shape it does not recognise.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  IF to_regclass('public.shadchan_notes') IS NULL THEN
    RAISE EXCEPTION 'MEXA-419 rollback: public.shadchan_notes does not exist';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00037') THEN
    RAISE EXCEPTION 'MEXA-419 rollback: there is no 00037 ledger row - 00037 is not applied, or this rollback has already run';
  END IF;

  -- The four policies 00037 wrote, and nothing else. A different set means something has
  -- changed this table since, and restoring `USING (true)` on top of it would be a guess.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'shadchan_notes';
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'MEXA-419 rollback: expected the 4 policies 00037 wrote on shadchan_notes, found % - inspect them before running this', v_n;
  END IF;
  IF (SELECT string_agg(policyname, ', ' ORDER BY policyname) FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'shadchan_notes')
     <> 'shadchan_notes_delete_own, shadchan_notes_insert_own, shadchan_notes_select_own, shadchan_notes_update_own' THEN
    RAISE EXCEPTION 'MEXA-419 rollback: the policies on shadchan_notes are not the four 00037 wrote';
  END IF;

  PERFORM set_config('mexa419rb.rows', (SELECT count(*)::text FROM public.shadchan_notes), false);
  PERFORM set_config('mexa419rb.policies',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public'), false);

  IF (SELECT count(*) FROM public.shadchan_notes) > 0 THEN
    RAISE WARNING 'MEXA-419 rollback: shadchan_notes holds % row(s). They are untouched, but after this file every signed-in caller and every anon-key holder can read and rewrite them',
      (SELECT count(*) FROM public.shadchan_notes);
  END IF;
END
$$;

-- =====================================================
-- 1. The policy set, back to the single FOR ALL USING (true)
-- =====================================================
--
-- Restored verbatim from 20250114_shidduch_system_fixed.sql:459, trailing comment included,
-- so that a diff against that file after a rollback is empty.

DROP POLICY "shadchan_notes_select_own" ON public.shadchan_notes;
DROP POLICY "shadchan_notes_insert_own" ON public.shadchan_notes;
DROP POLICY "shadchan_notes_update_own" ON public.shadchan_notes;
DROP POLICY "shadchan_notes_delete_own" ON public.shadchan_notes;

-- Shadchan notes: only the shadchan can see their own notes
CREATE POLICY "shadchan_notes_select_own"
  ON public.shadchan_notes FOR ALL
  USING (true); -- Simplified - adjust based on your shadchanim table structure

-- =====================================================
-- 2. The foreign key and the column comment
-- =====================================================

ALTER TABLE public.shadchan_notes
  DROP CONSTRAINT IF EXISTS shadchan_notes_shadchan_id_fkey;

COMMENT ON COLUMN public.shadchan_notes.shadchan_id IS NULL;

-- =====================================================
-- 3. The helper
-- =====================================================
--
-- Nothing else references it: 00037 created it and only 00037's four policies used it, all
-- dropped in section 1. Guard 3a proves that rather than assuming it, because a DROP that
-- another policy depends on would fail here rather than leave a half-rolled-back table.

DO $$
DECLARE
  v_bad TEXT;
BEGIN
  SELECT string_agg(format('%s.%s', schemaname, policyname), ', ') INTO v_bad
    FROM pg_policies
   WHERE (qual LIKE '%current_shadchan_ids%' OR with_check LIKE '%current_shadchan_ids%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419 rollback: these policies still use current_shadchan_ids(): %', v_bad;
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.current_shadchan_ids();

-- =====================================================
-- 4. anon's grants, and the table comment
-- =====================================================
--
-- Exactly the four 00037 revoked, no more: `anon` held `arwd` and nothing else (no
-- TRUNCATE, no TRIGGER, no REFERENCES, no MAINTAIN), and no column-level grant.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shadchan_notes TO anon;

COMMENT ON TABLE public.shadchan_notes IS NULL;

-- =====================================================
-- 5. The ledger row
-- =====================================================

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00037';

-- =====================================================
-- 6. Assert the restore, in the same transaction
-- =====================================================

DO $$
DECLARE
  v_rows_before INTEGER := current_setting('mexa419rb.rows')::INTEGER;
  v_pols_before INTEGER := current_setting('mexa419rb.policies')::INTEGER;
  v_cmd  TEXT;
  v_qual TEXT;
  v_chk  TEXT;
  v_roles TEXT;
  v_bad  TEXT;
BEGIN
  -- 6a. One policy, the original shape, TO public.
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shadchan_notes') <> 1 THEN
    RAISE EXCEPTION 'MEXA-419 rollback: shadchan_notes does not have exactly 1 policy';
  END IF;
  SELECT cmd, qual, with_check, roles::text INTO v_cmd, v_qual, v_chk, v_roles
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shadchan_notes';
  IF v_cmd <> 'ALL' OR v_qual IS DISTINCT FROM 'true' OR v_chk IS NOT NULL OR v_roles <> '{public}' THEN
    RAISE EXCEPTION 'MEXA-419 rollback: the restored policy is not the original (cmd=%, qual=%, check=%, roles=%)', v_cmd, v_qual, v_chk, v_roles;
  END IF;

  -- 6b. The FK, the column comment, the table comment and the helper are all gone again.
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conrelid = 'public.shadchan_notes'::regclass AND conname = 'shadchan_notes_shadchan_id_fkey') THEN
    RAISE EXCEPTION 'MEXA-419 rollback: shadchan_notes_shadchan_id_fkey is still there';
  END IF;
  IF col_description('public.shadchan_notes'::regclass,
       (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.shadchan_notes'::regclass AND attname = 'shadchan_id')) IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419 rollback: the shadchan_id column comment is still set';
  END IF;
  IF obj_description('public.shadchan_notes'::regclass, 'pg_class') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419 rollback: the table comment is still set';
  END IF;
  IF to_regprocedure('public.current_shadchan_ids()') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419 rollback: public.current_shadchan_ids() still exists';
  END IF;

  -- 6c. relacl holds exactly the four entries it held before the apply.
  --
  -- Compared as a sorted SET of aclitems, not as the `relacl::text` string. A REVOKE
  -- followed by a GRANT appends the restored entry at the end of the array, so the string
  -- comes back as `{postgres,authenticated,service_role,anon}` where it began
  -- `{postgres,anon,authenticated,service_role}` - identical privileges, different order.
  -- Written as a string comparison first, this assertion aborted a correct rollback in
  -- rehearsal. An aclitem array is a set; comparing it as text is comparing a rendering.
  SELECT string_agg(a::text, ',' ORDER BY a::text) INTO v_bad
    FROM unnest((SELECT relacl FROM pg_class WHERE oid = 'public.shadchan_notes'::regclass)) AS a;
  IF v_bad IS DISTINCT FROM 'anon=arwd/postgres,authenticated=arwd/postgres,postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres' THEN
    RAISE EXCEPTION 'MEXA-419 rollback: relacl is {%}, not the measured pre-apply set', v_bad;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute
              WHERE attrelid = 'public.shadchan_notes'::regclass AND attnum > 0
                AND NOT attisdropped AND attacl IS NOT NULL) THEN
    RAISE EXCEPTION 'MEXA-419 rollback: a column-level grant is present; the pre-apply state had none';
  END IF;

  -- 6d. No rows touched, and the rest of the schema's policy count is back (-4 +1).
  IF (SELECT count(*) FROM public.shadchan_notes) <> v_rows_before THEN
    RAISE EXCEPTION 'MEXA-419 rollback: the row count changed';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') <> v_pols_before - 3 THEN
    RAISE EXCEPTION 'MEXA-419 rollback: expected % policies in public, found %',
      v_pols_before - 3, (SELECT count(*) FROM pg_policies WHERE schemaname = 'public');
  END IF;

  -- 6e. The ledger row is gone, so a re-apply of 00037 is possible.
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00037') THEN
    RAISE EXCEPTION 'MEXA-419 rollback: the 00037 ledger row is still there';
  END IF;

  v_bad := NULL;
  SELECT string_agg(p.priv, ', ' ORDER BY p.priv) INTO v_bad
    FROM (VALUES ('INSERT'),('SELECT'),('UPDATE'),('DELETE')) AS p(priv)
   WHERE NOT has_table_privilege('anon', 'public.shadchan_notes'::regclass, p.priv);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419 rollback: anon did not get % back', v_bad;
  END IF;

  RAISE WARNING 'MEXA-419 rollback complete: shadchan_notes is open again - FOR ALL USING (true), anon holds arwd. That is the filed defect.';
END
$$;

COMMIT;
