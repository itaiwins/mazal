-- ROLLBACK for supabase/migrations/00020_safta_likes_actually_save.sql (MEXA-297)
--
-- DO NOT put this file in supabase/migrations/. It sorts ahead of nothing useful and some
-- tool will eventually apply everything in that directory in name order.
--
-- A bit-exact inverse of both halves, and running the whole file puts both defects back:
-- every Safta like fails 42501 again, and every UPDATE on `safta_likes` matches 0 rows
-- again. That is the point of an undo script, but it is almost never what you want here -
-- section 1 is a one-line security property with no behaviour to regress, so if section 2
-- is what is in your way, run **section B only**.
--
-- SPLIT INTO TWO INDEPENDENT SECTIONS, smallest first. They share nothing: A replaces a
-- function, B drops a policy.
--
--   B - the safta_likes UPDATE policy (and the table comment). Run this if the one-way
--       draft rule turns out to block a flow, or if the policy is being replaced by a
--       better one. Dropping it returns UPDATE to matching 0 rows, silently.
--   A - update_safta_stats back to SECURITY INVOKER. Run this only if the DEFINER change
--       itself is the problem. It re-breaks Safta likes outright.
--
-- CHANGES NO GRANT, because the migration changed none. In particular it does not touch
-- `safta_likes:UPDATE` or `user_safta_stats`' client write grants, so `00016`'s post-check
-- behaves the same before and after this file.

BEGIN;

-- ===================================================================================
-- B. Drop the safta_likes UPDATE policy
-- ===================================================================================
--
-- `00002` created no UPDATE policy on this table, so "before 00020" is no policy at all,
-- not a different one. There is nothing to restore.

DROP POLICY IF EXISTS "Safta can send own likes" ON public.safta_likes;

-- `00001` and `00002` set no comment on this table. NULL is the pre-00020 value.
COMMENT ON TABLE public.safta_likes IS NULL;

-- ===================================================================================
-- A. update_safta_stats back to SECURITY INVOKER
-- ===================================================================================
--
-- Character for character `00001`'s definition, including its `LANGUAGE plpgsql` trailer
-- position and its lack of a pinned `search_path`. `CREATE OR REPLACE` keeps the oid, so
-- `safta_likes_update_stats` continues to point at it - and immediately starts failing
-- 42501 on every insert again, which is the state `00020` found.

CREATE OR REPLACE FUNCTION public.update_safta_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_safta_stats (user_id, total_safta_likes, updated_at)
  VALUES (NEW.liked_user_id, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET total_safta_likes = user_safta_stats.total_safta_likes + 1,
      updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- `CREATE OR REPLACE FUNCTION` does not clear `proconfig`, so the `SET search_path = public`
-- that 00020 attached survives a plain replace and has to be reset explicitly. Without this
-- line the rollback is not bit-exact: `prosecdef` would be false but `proconfig` would still
-- read `{search_path=public}`, which 00001 never set.
ALTER FUNCTION public.update_safta_stats() RESET search_path;

-- 00001 set no comment either.
COMMENT ON FUNCTION public.update_safta_stats() IS NULL;

-- ===================================================================================
-- Assert the undo landed, in the same transaction
-- ===================================================================================

DO $$
DECLARE
  v_bad TEXT;
  v_n   INT;
BEGIN
  SELECT string_agg(format('secdef=%s config=%s', p.prosecdef,
                           coalesce(array_to_string(p.proconfig, ' '), 'null')), ', ')
    INTO v_bad
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'update_safta_stats'
     AND (p.prosecdef IS NOT FALSE OR p.proconfig IS NOT NULL);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-297 rollback: update_safta_stats is not back to plain INVOKER: %', v_bad;
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd = 'UPDATE';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MEXA-297 rollback: % UPDATE policy left on safta_likes', v_n;
  END IF;

  -- The two policies 00002 wrote are untouched: this file must not take SELECT or INSERT
  -- with it.
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_likes' AND cmd IN ('SELECT', 'INSERT');
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'MEXA-297 rollback: expected 00002''s 2 safta_likes policies, found %', v_n;
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.safta_likes'::regclass, 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-297 rollback: safta_likes:UPDATE grant went missing; neither 00020 nor this file touches grants';
  END IF;

  RAISE NOTICE 'MEXA-297 rollback: both defects are back exactly as 00020 found them.';
END
$$;

COMMIT;
