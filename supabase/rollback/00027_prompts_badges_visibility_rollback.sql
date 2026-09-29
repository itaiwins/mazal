-- Rollback for 00027_prompts_badges_visibility.sql (MEXA-277).
--
-- Restores the two `USING (true)` SELECT policies exactly as they stood on
-- tayiyczmacvhokdxfqvm before 00027, and puts back the `anon` grants that Supabase's
-- schema-wide defaults had handed out.
--
-- READ THIS BEFORE RUNNING IT. Going back re-opens the hole 00027 closed: every prompt
-- answer and every badge in the database becomes readable by anyone holding the anon key,
-- signed in or not, blocked or not, deactivated or not. Run it only to unbreak the app,
-- and only until the real cause is found.
--
-- Independent of 00013's rollback in both directions: this file names no object that 00013
-- creates, so it can be run before or after that one.

BEGIN;

-- =====================================================
-- 0. Refuse to run where 00027 was never applied
-- =====================================================

DO $$
BEGIN
  -- Without this, running the file against a database that never had 00027 would *create*
  -- the world-readable policies rather than restore them, and delete a ledger row this
  -- file did not write.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00027') THEN
    RAISE EXCEPTION 'MEXA-277 rollback: no ledger row for 00027 - it is not applied here';
  END IF;
END
$$;

-- =====================================================
-- 1. user_prompts
-- =====================================================

DROP POLICY IF EXISTS "Users can view other prompts" ON public.user_prompts;
DROP POLICY IF EXISTS "Users can view own prompts" ON public.user_prompts;

CREATE POLICY "Users can view all prompts" ON public.user_prompts
  FOR SELECT
  USING (true);

-- The pre-00027 state, which is Supabase's `ALTER DEFAULT PRIVILEGES` grant for `public`.
-- 00014 revokes TRUNCATE/TRIGGER/REFERENCES/MAINTAIN schema-wide, so re-granting them here
-- would undo that migration as a side effect. Only the four RLS-filtered verbs come back.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_prompts TO anon;

-- =====================================================
-- 2. user_badges
-- =====================================================

DROP POLICY IF EXISTS "Users can view other badges" ON public.user_badges;
DROP POLICY IF EXISTS "Users can view own badges" ON public.user_badges;

CREATE POLICY "Users can view all badges" ON public.user_badges
  FOR SELECT
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_badges TO anon;

-- =====================================================
-- 3. Ledger row and post-check, in the same transaction
-- =====================================================

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00027';

DO $$
DECLARE
  t   TEXT;
  suffix TEXT;
  v_n INTEGER;
  v_bad TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_prompts', 'user_badges'] LOOP
    suffix := CASE t WHEN 'user_prompts' THEN 'prompts' ELSE 'badges' END;

    -- Exactly the pre-00027 shape: one SELECT policy, TO public, USING (true).
    SELECT count(*) INTO v_n FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t AND cmd = 'SELECT';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'MEXA-277 rollback: public.% has % SELECT policies, expected 1', t, v_n;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = t
                      AND policyname = 'Users can view all ' || suffix
                      AND cmd = 'SELECT'
                      AND roles::text = '{public}'
                      AND qual::text = 'true') THEN
      RAISE EXCEPTION 'MEXA-277 rollback: public.% does not carry the original USING (true) policy', t;
    END IF;

    -- The four RLS-filtered verbs back, and not the four 00014 revoked live.
    -- `has_table_privilege` rather than `information_schema.role_table_grants` for the same
    -- reason as the migration's 4d: the grantee filter cannot see a grant made to PUBLIC,
    -- which anon holds through the pseudo-role (Guts, MEXA-377).
    SELECT string_agg(p.priv, ', ' ORDER BY p.priv) INTO v_bad
      FROM (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) AS p(priv)
     WHERE NOT has_table_privilege('anon', ('public.' || t)::regclass, p.priv);
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'MEXA-277 rollback: anon is still missing % on public.%', v_bad, t;
    END IF;

    SELECT string_agg(p.priv, ', ' ORDER BY p.priv) INTO v_bad
      FROM (VALUES ('TRUNCATE'),('TRIGGER'),('REFERENCES'),('MAINTAIN')) AS p(priv)
     WHERE has_table_privilege('anon', ('public.' || t)::regclass, p.priv);
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'MEXA-277 rollback: re-granted % on public.%, which 00014 revoked', v_bad, t;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00027') THEN
    RAISE EXCEPTION 'MEXA-277 rollback: ledger row 00027 is still present';
  END IF;
END
$$;

COMMIT;
