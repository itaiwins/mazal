-- Rollback for 00019_college_and_safta_stats_visibility.sql (MEXA-289)
--
-- READ THIS BEFORE RUNNING IT. 00019 restricts two SELECT policies and nothing else. It
-- changes no column, no table and no function, and the two tables it touches have no reader
-- and no writer in the app, so the set of things this rollback can fix is small and the
-- thing it gives back is large: running section B republishes every user's school, status
-- and graduation year to anyone holding the anon key.
--
-- SPLIT IN TWO, DELIBERATELY. Run the smallest section that unblocks you, the way 00014's
-- and 00016's rollbacks are split.
--
--   Section A - the policies come back as `USING (true) TO public`. This is what to run if
--               something turned out to need a cross-user read of either table. It restores
--               the pre-00019 policy exactly, which means it restores the defect: no
--               `is_active`, no blocks, no `is_visible`. Prefer writing the narrow policy you
--               actually need over running this.
--   Section B - `anon` gets its four table privileges back. Almost certainly not what broke
--               you, and it is the part that re-opens the tables to the whole internet.
--               Section A alone leaves both tables readable cross-user by signed-in callers
--               and still shut to `anon`, which is the sane halfway state.
--
-- IF 00016 HAS BEEN APPLIED, DO NOT RUN SECTION B. 00016 revokes every privilege on every
-- table in `public` from `anon`; section B would silently undo that for these two tables.
-- Check first:
--
--   SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00016';
--
-- Section B guards itself against this, but the guard is a convenience, not a substitute for
-- knowing which state you are in.

BEGIN;

-- ===================================================================================
-- SECTION A - the policies
-- ===================================================================================

DROP POLICY IF EXISTS "Users can view own college affiliations"   ON public.user_colleges;
DROP POLICY IF EXISTS "Users can view other college affiliations" ON public.user_colleges;

CREATE POLICY "Users can view all college affiliations" ON public.user_colleges
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Users can view own safta stats" ON public.user_safta_stats;

CREATE POLICY "Users can view safta stats" ON public.user_safta_stats
  FOR SELECT TO public
  USING (true);

-- ===================================================================================
-- SECTION B - `anon`'s table privileges
-- ===================================================================================
--
-- Comment this block out to run section A alone.
--
-- `SELECT, INSERT, UPDATE, DELETE` and never `GRANT ALL`: 00014 took TRUNCATE, TRIGGER,
-- REFERENCES and MAINTAIN away from both client roles on purpose, and a flat `GRANT ALL`
-- here would hand them back and silently undo part of it. Same trap 00014's and 00016's
-- rollbacks call out, and the same one Alucard caught in 00014's (MEXA-275). The four verbs
-- below are exactly what `anon` held on these two tables before 00019, measured live.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00016') THEN
    RAISE NOTICE 'MEXA-289 rollback: 00016 is applied, so section B is skipped - it would '
                 'undo 00016''s REVOKE for these two tables. Re-grant by hand if you really '
                 'mean to.';
  ELSE
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_colleges    TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_safta_stats TO anon;
    RAISE NOTICE 'MEXA-289 rollback: anon can read user_colleges and user_safta_stats again.';
  END IF;
END
$$;

-- ===================================================================================
-- Assert the pre-00019 policy shape is back
-- ===================================================================================
--
-- Only section A is checked. Section B is conditional by design, so its outcome is not an
-- invariant; read the NOTICE it raises.

DO $$
DECLARE
  v_n integer;
BEGIN
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public'
     AND cmd = 'SELECT'
     AND qual = 'true'
     AND 'public' = ANY (roles)
     AND (tablename, policyname) IN (
           ('user_colleges',    'Users can view all college affiliations'),
           ('user_safta_stats', 'Users can view safta stats'));
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'MEXA-289 rollback: expected 2 restored USING (true) policies, found %', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public'
     AND cmd = 'SELECT'
     AND tablename IN ('user_colleges', 'user_safta_stats')
     AND policyname IN ('Users can view own college affiliations',
                        'Users can view other college affiliations',
                        'Users can view own safta stats');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MEXA-289 rollback: % of 00019''s policies survived', v_n;
  END IF;

  RAISE NOTICE 'MEXA-289 rollback: section A done, pre-00019 SELECT policies restored.';
END
$$;

COMMIT;
