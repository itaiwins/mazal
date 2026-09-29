-- Mazal - user_colleges and user_safta_stats stop answering `USING (true)`
--
-- MEXA-289. Rollback: supabase/rollback/00019_college_and_safta_stats_visibility_rollback.sql
--
-- DEPENDS ON 00013 (MEXA-261): `public.is_discoverable_profile(uuid)` and
-- `public.current_app_user_id()` are created there. Both are applied live (00013 went in
-- 2026-09-28), so this file has no unmet dependency today. Do not apply it to a fresh
-- database before 00013.
--
-- INDEPENDENT OF 00016, WHICH IS STILL UNAPPLIED. 00016 revokes every privilege on every
-- table in `public` from `anon` in one statement, which subsumes the two REVOKEs below;
-- 00016 changes no policy, which is the whole of the rest of this file. So the two are
-- disjoint and either order works. Two consequences worth stating, because whoever applies
-- 00016 will read them:
--
--   * After this file, 00016's own header is out of date where it lists the three
--     `USING (true) TO public` SELECT policies `anon` can reach. Only `colleges` is left,
--     and that one is reference data and deliberate.
--   * 00016's rollback section C carries a skip list of tables a later migration closed to
--     `anon`, and asks in as many words to be extended when another one does. This file
--     closes two, so it adds both names there in the same commit.
--
-- WHY
--
-- Two SELECT policies, measured on tayiyczmacvhokdxfqvm before this file:
--
--     user_colleges."Users can view all college affiliations"  SELECT  TO public  USING (true)
--     user_safta_stats."Users can view safta stats"            SELECT  TO public  USING (true)
--
-- `USING (true)` is not "every signed-in user". With `TO public` and Supabase's schema-wide
-- SELECT grant to `anon` - which both tables still hold, because 00014 took only TRUNCATE,
-- TRIGGER, REFERENCES and MAINTAIN, and 00015 touched only `users` - it is everyone. Anyone
-- holding the publishable anon key, with no session at all, could read every row of both.
-- The anon key ships in every app binary and this repo's git history contains the old
-- project's copy, so "holds the anon key" is not a meaningful barrier.
--
-- `user_colleges` is the one that matters. A row is which school someone attends or
-- attended, their `status` (`current_student` / `alumni` / ...) and their graduation year.
-- On a dating app that is where-to-find-me data. The policy also ignored `is_active`, so a
-- deactivated account kept publishing it, and ignored blocks in both directions, so a user
-- could read the campus of someone who had blocked them - after 00013 had already hidden
-- that person's profile row and photos from them.
--
-- `user_safta_stats` is a per-user counter of safta likes. It is behind the Safta feature
-- flag and nothing renders it, but a policy on the live database does not care what the
-- client flags off, and the flag is meant to come back on.
--
-- Neither table had an own-row SELECT policy. `USING (true)` was covering the owner by
-- accident, exactly as it was on `user_prompts` and `user_badges` (MEXA-277). That is why
-- each table below gets an explicit own-row policy: `is_discoverable_profile` returns false
-- for the caller's own id on purpose (`u.auth_id IS DISTINCT FROM auth.uid()`), so a
-- cross-user policy alone would take the owner's own rows away from them.
--
-- `user_id` on both tables is a `public.users.id`, not an `auth.uid()`. The own-row test is
-- therefore `public.current_app_user_id()` (SECURITY DEFINER, `SELECT id FROM users WHERE
-- auth_id = auth.uid()`), which is what `has_block_between` uses too. The inline
-- `(SELECT id FROM users WHERE auth_id = auth.uid())` that this table's INSERT/UPDATE/DELETE
-- policies still use would work as well, but it leans on the own-row SELECT policy on
-- `users` surviving, and the function does not.
--
-- WHAT READS THESE TABLES: NOTHING. Checked before narrowing them, and the answer is not
-- what MEXA-289 was filed assuming.
--
--   user_colleges     - no read and no write anywhere in the app. The only mentions outside
--                       `src/types/supabase.generated.ts` are the `UserCollege` type alias
--                       in `src/types/database.types.ts` and this schema. There is no
--                       college screen: `app/(onboarding)/education.tsx` offers a hardcoded
--                       string list, `app/(shidduch-onboarding)/education.tsx` collects free
--                       text that `complete.tsx:234` writes to `shidduch_profiles
--                       .college_university`, and `mazal-map.tsx`'s `'college'` is a
--                       location *type*, not this table. The `colleges` reference table it
--                       points at holds 0 rows and has no reader either.
--   user_safta_stats  - no read and no write from the client. Its only writer is the
--                       `update_safta_stats` trigger on `safta_likes`, and that trigger is
--                       currently broken for an unrelated reason (SECURITY INVOKER against a
--                       table with no INSERT policy, 42501 - MEXA-297).
--
-- So there is no behaviour to preserve and nothing to regress. Both tables are also empty
-- on the live project (0 rows each, and `public.users` holds 0 rows), so nothing was
-- actually exposed - the same reason 00014 gives for being a fix rather than an incident.
-- It is being fixed now precisely because that stops being true the day Mazal has users.
--
-- TWO PLACES THIS DEPARTS FROM THE FIX AS FILED ON MEXA-289
--
-- 1. `user_colleges.is_visible`. The table carries a nullable `boolean DEFAULT true` column
--    whose only conceivable purpose is letting a user hide an affiliation, and nothing in
--    the schema or the app enforces it - `USING (true)` ignored it completely. Writing a new
--    cross-user policy in 2026 that still ignores it would re-ship a smaller copy of the bug
--    this file exists to fix, so "other people's rows" asks for it. Since nothing reads the
--    table, this costs no behaviour.
--
--    `is_visible IS NOT FALSE`, not `is_visible = true`: the column is nullable with a
--    `true` default, so NULL means "never set" and the schema's own answer for unset is
--    visible. It is written first in the USING clause so the cheap column test short-circuits
--    the SECURITY DEFINER call on hidden rows. The own-row policy deliberately does *not*
--    test it - hiding a row from other people must not hide it from its owner, who needs to
--    see it to toggle it back.
--
--    Making the column `NOT NULL` would remove the ambiguity outright and is safe on an
--    empty table, but it is a schema change and out of scope here. Noted in MIGRATIONS.md.
--
-- 2. `user_safta_stats` gets an own-row policy and NO cross-user policy, where MEXA-289
--    proposed the two-policy pair both tables were to share. The pair is right for
--    `user_colleges`, whose `is_visible` column only makes sense if other people can see the
--    row - a cross-user read is the feature. There is no such signal for a like counter:
--    nothing reads it, the Safta surface is flagged off, and "how many safta likes this
--    person has" being visible to every discoverable user is a product decision nobody has
--    made. Adding a permissive policy with no caller is how `USING (true)` got here. So this
--    follows the precedent 00016 sets for `shidduch_messages`: whoever turns the Safta
--    surface back on and finds it needs a cross-user read writes that policy then, with the
--    product argument attached, in one migration with its grants.
--
--    If that happens, the policy to add is the sibling of the one on `user_colleges`:
--
--      CREATE POLICY "Users can view other safta stats" ON public.user_safta_stats
--        FOR SELECT TO authenticated USING (public.is_discoverable_profile(user_id));
--
-- WHY `TO authenticated` AND THE REVOKE, WHEN EITHER WOULD DO
--
-- Two independent layers, on purpose. `TO authenticated` means no policy names `anon`, so
-- even holding a SELECT grant it matches no row. The REVOKE means it does not hold the grant
-- either. Each alone is sufficient today; together, neither a permissive policy added later
-- without checking the grant nor a grant handed back later without checking the policies
-- re-opens the table on its own. The verification script asserts the two separately for
-- exactly that reason.
--
-- Nothing anonymous writes to either table: `user_colleges`' INSERT policy requires a
-- `users` row for `auth.uid()`, and `user_safta_stats` has no write policy at all.
--
-- NOT TOUCHED: the INSERT, UPDATE and DELETE policies on `user_colleges`. They are already
-- own-row. They are `TO public` rather than `TO authenticated`, which the REVOKE below makes
-- moot for `anon`, and rewriting them is a separate argument from this one.

BEGIN;

-- =====================================================
-- 1. user_colleges
-- =====================================================

DROP POLICY IF EXISTS "Users can view all college affiliations" ON public.user_colleges;

CREATE POLICY "Users can view own college affiliations" ON public.user_colleges
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

CREATE POLICY "Users can view other college affiliations" ON public.user_colleges
  FOR SELECT TO authenticated
  USING (is_visible IS NOT FALSE AND public.is_discoverable_profile(user_id));

REVOKE ALL ON TABLE public.user_colleges FROM anon;

-- =====================================================
-- 2. user_safta_stats
-- =====================================================

DROP POLICY IF EXISTS "Users can view safta stats" ON public.user_safta_stats;

CREATE POLICY "Users can view own safta stats" ON public.user_safta_stats
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

REVOKE ALL ON TABLE public.user_safta_stats FROM anon;

-- =====================================================
-- 3. Assert the result, in the same transaction
-- =====================================================
--
-- A wrong policy here fails open and stays quiet, so the migration checks itself rather than
-- relying on someone re-reading pg_policies afterwards.

DO $$
DECLARE
  v_bad TEXT;
BEGIN
  -- No SELECT policy on either table may still be reachable by anon, whether through
  -- `TO public` or by naming anon directly.
  SELECT string_agg(format('%s.%s', tablename, policyname), ', ')
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('user_colleges', 'user_safta_stats')
     AND cmd = 'SELECT'
     AND ('public' = ANY (roles) OR 'anon' = ANY (roles));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-289: SELECT policy still reachable by anon: %', v_bad;
  END IF;

  -- No `USING (true)` SELECT policy may remain on either table.
  SELECT string_agg(format('%s.%s', tablename, policyname), ', ')
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('user_colleges', 'user_safta_stats')
     AND cmd = 'SELECT'
     AND qual = 'true';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-289: USING (true) SELECT policy still present: %', v_bad;
  END IF;

  -- anon holds no privilege on either table.
  SELECT string_agg(format('%s:%s', table_name, privilege_type), ', ')
    INTO v_bad
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name IN ('user_colleges', 'user_safta_stats')
     AND grantee = 'anon';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-289: anon still holds privileges: %', v_bad;
  END IF;

  -- Each table has exactly the SELECT policies this file intends: two on user_colleges,
  -- one on user_safta_stats. Catches a re-run that stacked duplicates as much as a typo.
  SELECT string_agg(format('%s=%s', tablename, n), ', ')
    INTO v_bad
    FROM (SELECT tablename, count(*) AS n
            FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename IN ('user_colleges', 'user_safta_stats')
             AND cmd = 'SELECT'
           GROUP BY tablename) t
   WHERE (tablename = 'user_colleges'    AND n <> 2)
      OR (tablename = 'user_safta_stats' AND n <> 1);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-289: unexpected SELECT policy count: %', v_bad;
  END IF;

  RAISE NOTICE 'MEXA-289: user_colleges and user_safta_stats SELECT policies are scoped.';
END
$$;

COMMIT;
