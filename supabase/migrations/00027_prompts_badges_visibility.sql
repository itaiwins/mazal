-- Mazal - user_prompts and user_badges stop answering `USING (true)`
--
-- MEXA-277. Rollback: supabase/rollback/00027_prompts_badges_visibility_rollback.sql
--
-- DEPENDS ON 00013 (MEXA-261): `public.is_discoverable_profile(uuid)` is created there.
-- Do not apply this before 00013.
--
-- WHY
--
-- Both tables carried one SELECT policy:
--
--     user_prompts."Users can view all prompts"  FOR SELECT TO public  USING (true)
--     user_badges. "Users can view all badges"   FOR SELECT TO public  USING (true)
--
-- `USING (true)` is not "every signed-in user"; combined with `TO public` and Supabase's
-- schema-wide SELECT grant to `anon`, it is *everyone*. Measured on tayiyczmacvhokdxfqvm:
-- `anon` holds SELECT on both tables, so an unauthenticated caller holding only the
-- publishable anon key could read every prompt answer and every badge in the database.
-- Prompt answers are free text a user wrote about themselves, so that is profile content,
-- not metadata.
--
-- Two smaller consequences of the same policy, which are what MEXA-277 was filed for:
--
--   * A blocked user (either direction) kept their prompts and badges readable, while
--     00013 had already hidden their profile row and their photos.
--   * A deactivated account (`is_active = false`) kept both readable.
--
-- THE FIX
--
-- The sibling table `user_photos` already has the right shape after 00013: one policy for
-- the caller's own rows, one for other people's, both `TO authenticated`, the second asking
-- `public.is_discoverable_profile()`. This gives the two tables that same pair, so all
-- three profile-content tables answer one visibility rule instead of three.
--
-- Two policies rather than one because `is_discoverable_profile` deliberately returns false
-- for the caller's own id (`u.auth_id IS DISTINCT FROM auth.uid()`). Neither table had an
-- own-row SELECT policy before - `USING (true)` was covering the owner by accident - and
-- `fetchUserProfile` in src/api/queries/useUserProfile.ts reads both for the signed-in
-- user, so without the own-row policy the user's own profile screen would come back empty.
--
-- `user_id` on these tables is a `public.users.id`, not an `auth.uid()`. The own-row test is
-- therefore `public.current_app_user_id()` (SECURITY DEFINER, `SELECT id FROM users WHERE
-- auth_id = auth.uid()`), which is also what `has_block_between` uses. The inline
-- `(SELECT id FROM users WHERE auth_id = auth.uid())` that the INSERT/UPDATE/DELETE
-- policies here still use would work too - 00013 leaves the own-row SELECT policy on
-- `users` in place - but the function does not depend on that policy surviving.
--
-- `TO authenticated` is doing real work, not tidiness: it is what takes `anon` out of the
-- picture. The REVOKE below is belt and braces for the same thing - with no policy naming
-- `anon`, the grant is already unusable, but a permissive policy added later without
-- checking the grant would silently re-open it (MIGRATIONS.md, "Still to do on the
-- backend"). Nothing anonymous writes to either table: both INSERT policies require a
-- `users` row for `auth.uid()`, and onboarding runs after sign-in.
--
-- NOT TOUCHED: the INSERT, UPDATE and DELETE policies on both tables. They are already
-- own-row and out of scope here.

BEGIN;

-- =====================================================
-- 1. user_prompts
-- =====================================================

DROP POLICY IF EXISTS "Users can view all prompts" ON public.user_prompts;

CREATE POLICY "Users can view own prompts" ON public.user_prompts
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

CREATE POLICY "Users can view other prompts" ON public.user_prompts
  FOR SELECT TO authenticated
  USING (public.is_discoverable_profile(user_id));

REVOKE ALL ON TABLE public.user_prompts FROM anon;

-- =====================================================
-- 2. user_badges
-- =====================================================

DROP POLICY IF EXISTS "Users can view all badges" ON public.user_badges;

CREATE POLICY "Users can view own badges" ON public.user_badges
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

CREATE POLICY "Users can view other badges" ON public.user_badges
  FOR SELECT TO authenticated
  USING (public.is_discoverable_profile(user_id));

REVOKE ALL ON TABLE public.user_badges FROM anon;

-- =====================================================
-- 3. Ledger row, in this transaction (MEXA-325)
-- =====================================================

-- The apply helper's own INSERT is keyed on the numeric prefix and is
-- `ON CONFLICT DO NOTHING`, so a file whose number is already taken runs, reports success
-- and writes nothing - which is how 00003_push_tokens, 00004_safta_messages and
-- 00005_notification_triggers ended up applied with no ledger row (MEXA-287). Writing the
-- row here makes the apply and the record one transaction.
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00027', 'prompts_badges_visibility')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. Assert the result, in the same transaction
-- =====================================================
--
-- Catalog assertions only. What an `authenticated` caller actually gets back is proven by
-- executing real queries as the real role against fixture rows - see the rehearsal named in
-- supabase/MIGRATIONS.md - because a policy that exists with the right name can still admit
-- the wrong rows.

DO $$
DECLARE
  t     TEXT;
  suffix TEXT;
  v_n   INTEGER;
  v_bad TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_prompts', 'user_badges'] LOOP
    suffix := CASE t WHEN 'user_prompts' THEN 'prompts' ELSE 'badges' END;

    -- 4a. The USING (true) policy this migration exists to remove.
    IF EXISTS (SELECT 1 FROM pg_policies
                WHERE schemaname = 'public' AND tablename = t
                  AND policyname = 'Users can view all ' || suffix) THEN
      RAISE EXCEPTION 'MEXA-277: the USING (true) SELECT policy is still on public.%', t;
    END IF;

    -- 4b. Exactly two SELECT policies, both authenticated-only. A third, or one left open
    -- to `public`, would re-admit the caller this migration excludes.
    SELECT count(*) INTO v_n FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t AND cmd = 'SELECT';
    IF v_n <> 2 THEN
      RAISE EXCEPTION 'MEXA-277: public.% has % SELECT policies, expected 2', t, v_n;
    END IF;

    SELECT count(*) INTO v_n FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t AND cmd = 'SELECT'
       AND roles::text <> '{authenticated}';
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'MEXA-277: a SELECT policy on public.% is not TO authenticated', t;
    END IF;

    -- 4c. Each one asks the question it is named for. Checking the qual, not just the name,
    -- because the names are the only thing a rename would keep.
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = t
                      AND policyname = 'Users can view own ' || suffix
                      AND qual::text LIKE '%current_app_user_id%') THEN
      RAISE EXCEPTION 'MEXA-277: the own-row SELECT policy on public.% is missing or does not use current_app_user_id()', t;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = t
                      AND policyname = 'Users can view other ' || suffix
                      AND qual::text LIKE '%is_discoverable_profile%') THEN
      RAISE EXCEPTION 'MEXA-277: the cross-user SELECT policy on public.% is missing or does not use is_discoverable_profile()', t;
    END IF;

    -- 4d. anon holds nothing. `TO authenticated` alone would already give it no rows; this
    -- is the second layer, and the one a later CREATE POLICY cannot quietly undo.
    --
    -- `has_table_privilege`, not `information_schema.role_table_grants`, and the difference
    -- is not stylistic: the grantee filter sees only grants written to `anon` by name, so a
    -- `GRANT ... TO PUBLIC` - which anon holds through the pseudo-role - reads as zero rows
    -- and the assertion passes on a table anon can still read. `has_table_privilege` folds
    -- in PUBLIC and role membership. Same idiom as 00014 section 4 and 00016 section 7
    -- (Guts, MEXA-377; the weaker form was caught before on 00019, MEXA-330).
    SELECT string_agg(p.priv, ', ' ORDER BY p.priv) INTO v_bad
      FROM (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
                   ('TRUNCATE'),('TRIGGER'),('REFERENCES'),('MAINTAIN')) AS p(priv)
     WHERE has_table_privilege('anon', ('public.' || t)::regclass, p.priv);
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'MEXA-277: anon still holds % on public.%', v_bad, t;
    END IF;

    -- 4e. The write policies are not this migration's business and must come through
    -- untouched: one INSERT, one UPDATE, one DELETE, exactly as 00002 left them.
    SELECT count(*) INTO v_n FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t AND cmd <> 'SELECT';
    IF v_n <> 3 THEN
      RAISE EXCEPTION 'MEXA-277: public.% has % non-SELECT policies, expected 3 - this migration must not touch writes', t, v_n;
    END IF;
  END LOOP;

  -- 4f. The predecessor this file cannot work without.
  IF to_regprocedure('public.is_discoverable_profile(uuid)') IS NULL THEN
    RAISE EXCEPTION 'MEXA-277: public.is_discoverable_profile(uuid) does not exist - apply 00013 first';
  END IF;

  -- 4g. The ledger row this file writes, so a later reader does not have to guess.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00027') THEN
    RAISE EXCEPTION 'MEXA-277: ledger row 00027 is missing';
  END IF;
END
$$;

COMMIT;
