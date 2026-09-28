-- Rollback for 00010_secure_definer_rpcs.sql
--
-- NOT a migration. Nothing applies this file automatically; it exists so 00010 can be
-- undone on a database that has it. Running it puts every function body, privilege and
-- policy 00010 touched back as it was at `mazal-restart` @ eac75f6 (verified against the
-- live project tayiyczmacvhokdxfqvm on 2026-09-28 before 00010 was applied). The only
-- thing it leaves behind is the function comments 00010 added, which are cosmetic.
--
-- It restores the vulnerabilities MEXA-251 describes, including two that let an
-- unauthenticated caller read the whole `users` table and write on another user's behalf.
-- Only use it to get a broken deploy back to a known state, and re-apply 00010 after.
--
-- Also remember to delete 00010 from supabase_migrations.schema_migrations, or a later
-- `supabase db push` will consider it applied:
--   DELETE FROM supabase_migrations.schema_migrations WHERE version = '00010';

-- =====================================================
-- 1. Functions 00010 replaced, back to their original bodies
--    (no SET search_path, no identity checks)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_orthodox_discovery_profiles(
  requesting_user_id UUID,
  max_distance_km INTEGER DEFAULT 100,
  min_age INTEGER DEFAULT 18,
  max_age INTEGER DEFAULT 99,
  preferred_genders TEXT[] DEFAULT ARRAY['male', 'female']
)
RETURNS SETOF public.users AS $$
BEGIN
  RETURN QUERY
  SELECT u.*
  FROM public.users u
  WHERE u.is_orthodox_user = TRUE
    AND u.id != requesting_user_id
    AND u.is_active = TRUE
    AND u.onboarding_complete = TRUE
    AND u.gender = ANY(preferred_genders)
    AND EXTRACT(YEAR FROM AGE(u.date_of_birth)) BETWEEN min_age AND max_age
    -- Exclude users already swiped
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes s
      WHERE s.swiper_id = requesting_user_id AND s.swiped_id = u.id
    )
    -- Exclude blocked users
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = u.id)
         OR (b.blocker_id = u.id AND b.blocked_id = requesting_user_id)
    )
  ORDER BY u.elo_score DESC NULLS LAST
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.get_orthodox_discovery_profiles(UUID, INTEGER, INTEGER, INTEGER, TEXT[]) RESET search_path;

CREATE OR REPLACE FUNCTION public.respond_to_suggestion(
  p_suggestion_id UUID,
  p_user_id UUID,
  p_response TEXT,
  p_decline_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_my_profile_id UUID;
  v_is_profile_a BOOLEAN;
  v_other_status TEXT;
  v_result JSONB;
BEGIN
  -- Get user's profile
  SELECT sp.id INTO v_my_profile_id
  FROM shidduch_profiles sp
  WHERE sp.user_id = p_user_id;

  -- Determine if user is profile_a or profile_b
  SELECT
    CASE WHEN ss.profile_a_id = v_my_profile_id THEN true ELSE false END,
    CASE WHEN ss.profile_a_id = v_my_profile_id THEN ss.profile_b_status ELSE ss.profile_a_status END
  INTO v_is_profile_a, v_other_status
  FROM shidduch_suggestions ss
  WHERE ss.id = p_suggestion_id;

  -- Update the appropriate status
  IF v_is_profile_a THEN
    UPDATE shidduch_suggestions ss
    SET profile_a_status = p_response,
        profile_a_response_at = NOW(),
        profile_a_decline_reason = p_decline_reason,
        is_mutual_interest = (p_response = 'interested' AND v_other_status = 'interested'),
        contact_shared_at = CASE WHEN p_response = 'interested' AND v_other_status = 'interested' THEN NOW() ELSE ss.contact_shared_at END
    WHERE ss.id = p_suggestion_id;
  ELSE
    UPDATE shidduch_suggestions ss
    SET profile_b_status = p_response,
        profile_b_response_at = NOW(),
        profile_b_decline_reason = p_decline_reason,
        is_mutual_interest = (p_response = 'interested' AND v_other_status = 'interested'),
        contact_shared_at = CASE WHEN p_response = 'interested' AND v_other_status = 'interested' THEN NOW() ELSE ss.contact_shared_at END
    WHERE ss.id = p_suggestion_id;
  END IF;

  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'is_mutual', (p_response = 'interested' AND v_other_status = 'interested'),
    'other_status', v_other_status
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.respond_to_suggestion(UUID, UUID, TEXT, TEXT) RESET search_path;

CREATE OR REPLACE FUNCTION public.get_shidduch_suggestions(p_user_id UUID)
RETURNS TABLE (
  out_suggestion_id UUID,
  out_other_profile JSONB,
  out_suggested_by TEXT,
  out_suggestion_reason TEXT,
  out_my_status TEXT,
  out_their_status TEXT,
  out_created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_my_profile_id UUID;
BEGIN
  -- Get user's shidduch profile id
  SELECT sp.id INTO v_my_profile_id
  FROM shidduch_profiles sp
  WHERE sp.user_id = p_user_id;

  RETURN QUERY
  SELECT
    s.id AS out_suggestion_id,
    CASE
      WHEN s.profile_a_id = v_my_profile_id THEN
        jsonb_build_object(
          'id', sp_b.id,
          'first_name', u_b.first_name,
          'age', DATE_PART('year', AGE(u_b.date_of_birth)),
          'community', sp_b.community,
          'city', u_b.current_city
        )
      ELSE
        jsonb_build_object(
          'id', sp_a.id,
          'first_name', u_a.first_name,
          'age', DATE_PART('year', AGE(u_a.date_of_birth)),
          'community', sp_a.community,
          'city', u_a.current_city
        )
    END AS out_other_profile,
    s.suggested_by_type AS out_suggested_by,
    s.suggestion_reason AS out_suggestion_reason,
    CASE WHEN s.profile_a_id = v_my_profile_id THEN s.profile_a_status ELSE s.profile_b_status END AS out_my_status,
    CASE WHEN s.profile_a_id = v_my_profile_id THEN s.profile_b_status ELSE s.profile_a_status END AS out_their_status,
    s.created_at AS out_created_at
  FROM shidduch_suggestions s
  LEFT JOIN shidduch_profiles sp_b ON sp_b.id = s.profile_b_id
  LEFT JOIN users u_b ON u_b.id = sp_b.user_id
  LEFT JOIN shidduch_profiles sp_a ON sp_a.id = s.profile_a_id
  LEFT JOIN users u_a ON u_a.id = sp_a.user_id
  WHERE s.profile_a_id = v_my_profile_id OR s.profile_b_id = v_my_profile_id
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.get_shidduch_suggestions(UUID) RESET search_path;

CREATE OR REPLACE FUNCTION public.register_orthodox_email(user_email TEXT, user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.orthodox_emails (email, user_id)
  VALUES (LOWER(user_email), user_uuid)
  ON CONFLICT (email) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.register_orthodox_email(TEXT, UUID) RESET search_path;

CREATE OR REPLACE FUNCTION public.increment_safta_recommendation(safta_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO public.safta_daily_usage (safta_account_id, usage_date, recommendations_count)
  VALUES (safta_id, CURRENT_DATE, 1)
  ON CONFLICT (safta_account_id, usage_date)
  DO UPDATE SET
    recommendations_count = safta_daily_usage.recommendations_count + 1,
    updated_at = NOW()
  RETURNING recommendations_count INTO new_count;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.increment_safta_recommendation(UUID) RESET search_path;

CREATE OR REPLACE FUNCTION public.get_profile_stats(p_profile_id UUID)
RETURNS TABLE (
  profile_views BIGINT,
  unique_viewers BIGINT,
  suggestions_received BIGINT,
  interested_responses BIGINT,
  mutual_matches BIGINT,
  last_view_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM shidduch_profile_views WHERE profile_id = p_profile_id) AS profile_views,
    (SELECT COUNT(DISTINCT viewer_profile_id) FROM shidduch_profile_views WHERE profile_id = p_profile_id AND viewer_profile_id IS NOT NULL) AS unique_viewers,
    (SELECT COUNT(*) FROM shidduch_suggestions WHERE profile_a_id = p_profile_id OR profile_b_id = p_profile_id) AS suggestions_received,
    (SELECT COUNT(*) FROM shidduch_suggestions
     WHERE (profile_a_id = p_profile_id AND profile_b_status = 'interested')
        OR (profile_b_id = p_profile_id AND profile_a_status = 'interested')) AS interested_responses,
    (SELECT COUNT(*) FROM shidduch_suggestions
     WHERE (profile_a_id = p_profile_id OR profile_b_id = p_profile_id)
       AND profile_a_status = 'interested'
       AND profile_b_status = 'interested') AS mutual_matches,
    (SELECT MAX(viewed_at) FROM shidduch_profile_views WHERE profile_id = p_profile_id) AS last_view_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.get_profile_stats(UUID) RESET search_path;

CREATE OR REPLACE FUNCTION public.get_safta_daily_recommendations(safta_id UUID)
RETURNS INTEGER AS $$
DECLARE
  rec_count INTEGER;
BEGIN
  SELECT COALESCE(recommendations_count, 0) INTO rec_count
  FROM public.safta_daily_usage
  WHERE safta_account_id = safta_id AND usage_date = CURRENT_DATE;

  RETURN COALESCE(rec_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.get_safta_daily_recommendations(UUID) RESET search_path;

CREATE OR REPLACE FUNCTION public.can_safta_recommend(safta_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sub_plan TEXT;
  daily_count INTEGER;
  daily_limit INTEGER := 10; -- Free tier limit
BEGIN
  -- Get subscription plan
  SELECT subscription_plan INTO sub_plan FROM public.safta_accounts WHERE id = safta_id;

  -- Pro users have unlimited
  IF sub_plan = 'safta_pro' THEN
    RETURN TRUE;
  END IF;

  -- Check daily count for free tier
  daily_count := public.get_safta_daily_recommendations(safta_id);

  RETURN daily_count < daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.can_safta_recommend(UUID) RESET search_path;

CREATE OR REPLACE FUNCTION public.get_safta_connection_count(safta_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM public.safta_connections
    WHERE safta_account_id = safta_id AND status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.get_safta_connection_count(UUID) RESET search_path;

CREATE OR REPLACE FUNCTION public.can_safta_add_connection(safta_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sub_plan TEXT;
  connection_count INTEGER;
  connection_limit INTEGER := 1; -- Free tier limit
BEGIN
  -- Get subscription plan
  SELECT subscription_plan INTO sub_plan FROM public.safta_accounts WHERE id = safta_id;

  -- Pro users have unlimited
  IF sub_plan = 'safta_pro' THEN
    RETURN TRUE;
  END IF;

  -- Check connection count for free tier
  connection_count := public.get_safta_connection_count(safta_id);

  RETURN connection_count < connection_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.can_safta_add_connection(UUID) RESET search_path;

CREATE OR REPLACE FUNCTION public.is_orthodox_email(check_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.orthodox_emails WHERE email = LOWER(check_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.is_orthodox_email(TEXT) RESET search_path;

CREATE OR REPLACE FUNCTION public.get_profiles_by_creator(p_creator_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  single_first_name TEXT,
  single_last_name TEXT,
  hebrew_name TEXT,
  community TEXT,
  created_by_type TEXT,
  profile_visible BOOLEAN,
  accepting_suggestions BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.user_id,
    sp.single_first_name,
    sp.single_last_name,
    sp.hebrew_name,
    sp.community,
    sp.created_by_type,
    sp.profile_visible,
    sp.accepting_suggestions,
    sp.created_at,
    sp.updated_at
  FROM shidduch_profiles sp
  WHERE sp.created_by_user_id = p_creator_id
  ORDER BY sp.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.get_profiles_by_creator(UUID) RESET search_path;

CREATE OR REPLACE FUNCTION public.get_creator_profile_count(p_creator_id UUID)
RETURNS INTEGER AS $$
DECLARE
  profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count
  FROM shidduch_profiles
  WHERE created_by_user_id = p_creator_id;

  RETURN profile_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.get_creator_profile_count(UUID) RESET search_path;

-- Bodies 00010 did not change, only the search_path pin.
ALTER FUNCTION public.send_push_notification(UUID, TEXT, TEXT, JSONB) RESET search_path;
ALTER FUNCTION public.browse_shidduch_profiles(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, INTEGER, INTEGER) RESET search_path;
ALTER FUNCTION public.cleanup_old_push_tokens() RESET search_path;

-- =====================================================
-- 2. Privileges, back to Supabase's defaults
--
-- Pre-00010 these functions had `proacl = {=X/postgres, postgres=X/postgres,
-- anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}` - the PUBLIC
-- grant from `CREATE FUNCTION` plus the three client roles from Supabase's
-- ALTER DEFAULT PRIVILEGES.
-- =====================================================

GRANT EXECUTE ON FUNCTION public.get_orthodox_discovery_profiles(UUID, INTEGER, INTEGER, INTEGER, TEXT[]) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_suggestion(UUID, UUID, TEXT, TEXT) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_push_notification(UUID, TEXT, TEXT, JSONB) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_shidduch_suggestions(UUID) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_orthodox_email(TEXT, UUID) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_safta_recommendation(UUID) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_profile_stats(UUID) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_safta_daily_recommendations(UUID) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_safta_recommend(UUID) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_safta_connection_count(UUID) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_safta_add_connection(UUID) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_orthodox_email(TEXT) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_creator(UUID) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_creator_profile_count(UUID) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.browse_shidduch_profiles(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, INTEGER, INTEGER) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_push_tokens() TO PUBLIC, anon, authenticated, service_role;

-- The 00008 / 00009 helpers had no PUBLIC grant (their migrations revoke it) but did have
-- the three client-role grants.
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_block_between(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_shidduch_profile_ids() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.suggested_shidduch_profile_ids() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.family_connected_shidduch_profile_ids() TO anon, authenticated, service_role;

-- =====================================================
-- 3. The two helpers 00010 introduced
-- =====================================================

DROP FUNCTION IF EXISTS public.manageable_shidduch_profile_ids();
DROP FUNCTION IF EXISTS public.owns_safta_account(UUID);

-- =====================================================
-- 4. shidduch_profiles policies, back to their pre-00010 form
--
-- SELECT is 00009's version (auth.uid(), TO authenticated). UPDATE and INSERT are
-- 20250114_add_creator_tracking.sql's, which had no role clause.
-- =====================================================

DROP POLICY IF EXISTS "Users can view profiles they own or created" ON shidduch_profiles;

CREATE POLICY "Users can view profiles they own or created"
  ON shidduch_profiles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR created_by_user_id = auth.uid()
    OR profile_visible = true
  );

DROP POLICY IF EXISTS "Users can update profiles they own or created" ON shidduch_profiles;

CREATE POLICY "Users can update profiles they own or created"
  ON shidduch_profiles FOR UPDATE
  USING (
    user_id = auth.uid()
    OR created_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can insert profiles" ON shidduch_profiles;

CREATE POLICY "Users can insert profiles"
  ON shidduch_profiles FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR created_by_user_id = auth.uid()
  );
