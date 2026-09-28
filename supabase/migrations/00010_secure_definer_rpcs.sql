-- Mazal - Lock down the SECURITY DEFINER RPCs
--
-- Fixes the findings from the MEXA-248 security review of the RLS work in 00007-00009
-- (action list in MEXA-251, built in MEXA-252). Nothing here changes a table, a column
-- or a function signature: every function keeps the arguments and return type it has
-- today, so no generated type and no caller has to change.
--
-- The problem 00007-00009 did not cover: RLS is not the only boundary. A
-- `SECURITY DEFINER` function runs as `postgres`, which has BYPASSRLS, so it ignores
-- every policy on every table it touches. Most of the pre-existing SECURITY DEFINER
-- functions in this schema take a caller-supplied id (`requesting_user_id`, `p_user_id`,
-- `safta_id`, `p_profile_id`) and trust it, and PostgREST exposes all of them at
-- `/rest/v1/rpc/<name>` to anyone holding the (public by design) anon key. So a caller
-- could route around the `users` and `shidduch_profiles` policies just fixed in 00008
-- and 00009 by asking a function for someone else's data instead - and in the case of
-- `respond_to_suggestion` and `send_push_notification`, could also write on another
-- user's behalf. `FEATURE_ORTHODOX_MODE` does not help: it is a client-side flag, the
-- RPC endpoints are live regardless.
--
-- Two rules applied to every function below.
--
-- 1. Identity comes from `auth.uid()` / `public.current_app_user_id()` inside the
--    function. Where an id parameter has to stay (to keep the signature), the function
--    now checks it against the caller and raises `42501 insufficient_privilege` rather
--    than answering for someone else. PostgREST turns that into a 403.
--
-- 2. Privileges are stated explicitly, `REVOKE EXECUTE ... FROM PUBLIC, anon` first and
--    then only the grants the function needs. Leaving `anon` out of a `GRANT` does NOT
--    keep it out on this project: Supabase ships `ALTER DEFAULT PRIVILEGES` on the
--    `public` schema that grants EXECUTE to `anon`, `authenticated` and `service_role`
--    on every new function at creation time. MEXA-248 proved it live - 00009's own three
--    helpers were granted to `authenticated, service_role` only and still showed
--    `anon=X` in `pg_proc.proacl`. Anything added later must follow the same pattern.
--
-- Every function that is replaced also gains `SET search_path = public`, which a
-- SECURITY DEFINER function should always have (00008/00009 already did this) so the
-- owner's rights cannot be pointed at a caller-controlled schema.
--
-- The four `notify_*` functions are deliberately left alone: they are real
-- `RETURNS trigger` functions, which Postgres refuses to invoke outside a trigger
-- context and PostgREST does not expose. They call `send_push_notification` while
-- running as its owner, so revoking EXECUTE from the client roles below does not stop
-- them (verified on the live project).

-- =====================================================
-- HELPERS
-- =====================================================

-- The shidduch profiles the caller may act on: the ones belonging to them, plus the ones
-- they created for someone else (the parent/grandparent/shadchan flow in CLAUDE.md).
-- Mirrors the `shidduch_profiles` policy fix at the bottom of this file, so the functions
-- and the table agree on who manages a profile.
CREATE OR REPLACE FUNCTION public.manageable_shidduch_profile_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.id
  FROM shidduch_profiles sp
  WHERE sp.user_id = public.current_app_user_id()
     OR sp.created_by_user_id = public.current_app_user_id();
$$;

COMMENT ON FUNCTION public.manageable_shidduch_profile_ids() IS
  'shidduch_profiles ids the caller owns or created. SECURITY DEFINER so it can be used inside other definer functions and in policies without recursing into shidduch_profiles.';

REVOKE EXECUTE ON FUNCTION public.manageable_shidduch_profile_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manageable_shidduch_profile_ids() TO authenticated, service_role;

-- True when the caller signed in as the given Safta account. safta_accounts.auth_id is an
-- auth.users id (00001_initial_schema.sql), so this compares against auth.uid() directly.
CREATE OR REPLACE FUNCTION public.owns_safta_account(p_safta_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM safta_accounts sa
    WHERE sa.id = p_safta_id
      AND sa.auth_id IS NOT NULL
      AND sa.auth_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.owns_safta_account(UUID) IS
  'True when the caller is signed in as the given Safta account. Ownership gate for the safta_* helper functions, which are SECURITY DEFINER and therefore bypass RLS.';

REVOKE EXECUTE ON FUNCTION public.owns_safta_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_safta_account(UUID) TO authenticated, service_role;

-- =====================================================
-- CRITICAL
-- =====================================================

-- `RETURNS SETOF users` + `SELECT u.*` for a caller-supplied `requesting_user_id` that
-- was never checked: a full dump of the primary user table to anyone with the anon key,
-- bypassing every policy on `users`. The signature stays (nothing calls it yet, but the
-- generated types describe it), and `requesting_user_id` now has to be the caller.
CREATE OR REPLACE FUNCTION public.get_orthodox_discovery_profiles(
  requesting_user_id UUID,
  max_distance_km INTEGER DEFAULT 100,
  min_age INTEGER DEFAULT 18,
  max_age INTEGER DEFAULT 99,
  preferred_genders TEXT[] DEFAULT ARRAY['male', 'female']
)
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := public.current_app_user_id();
BEGIN
  IF v_caller_id IS NULL OR requesting_user_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'get_orthodox_discovery_profiles: requesting_user_id must be the calling user'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.*
  FROM public.users u
  WHERE u.is_orthodox_user = TRUE
    AND u.id != v_caller_id
    AND u.is_active = TRUE
    AND u.onboarding_complete = TRUE
    AND u.gender = ANY(preferred_genders)
    AND EXTRACT(YEAR FROM AGE(u.date_of_birth)) BETWEEN min_age AND max_age
    -- Exclude users already swiped
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes s
      WHERE s.swiper_id = v_caller_id AND s.swiped_id = u.id
    )
    -- Exclude blocked users
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = v_caller_id AND b.blocked_id = u.id)
         OR (b.blocker_id = u.id AND b.blocked_id = v_caller_id)
    )
  ORDER BY u.elo_score DESC NULLS LAST
  LIMIT 50;
END;
$$;

COMMENT ON FUNCTION public.get_orthodox_discovery_profiles(UUID, INTEGER, INTEGER, INTEGER, TEXT[]) IS
  'Orthodox discovery deck for the calling user. requesting_user_id must equal current_app_user_id(); SECURITY DEFINER, so it bypasses RLS and has to check identity itself (MEXA-251).';

REVOKE EXECUTE ON FUNCTION public.get_orthodox_discovery_profiles(UUID, INTEGER, INTEGER, INTEGER, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_orthodox_discovery_profiles(UUID, INTEGER, INTEGER, INTEGER, TEXT[]) TO authenticated, service_role;

-- `p_user_id` was trusted, so anyone could answer a suggestion for anyone: flip
-- `is_mutual_interest` and set `contact_shared_at` between two other people, or decline
-- on their behalf. Worse, when the caller had no shidduch profile the old body left
-- `v_my_profile_id` NULL, `v_is_profile_a` false, and wrote the profile_b side of an
-- arbitrary suggestion anyway. Now the caller has to manage one of the two profiles in
-- the suggestion, and the write goes to that side.
CREATE OR REPLACE FUNCTION public.respond_to_suggestion(
  p_suggestion_id UUID,
  p_user_id UUID,
  p_response TEXT,
  p_decline_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := public.current_app_user_id();
  v_is_profile_a BOOLEAN;
  v_other_status TEXT;
  v_result JSONB;
BEGIN
  IF v_caller_id IS NULL OR p_user_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'respond_to_suggestion: p_user_id must be the calling user'
      USING ERRCODE = '42501';
  END IF;

  -- Which side of the suggestion the caller is on, and the other side's current status.
  -- The WHERE clause is the authorization check: no row means the suggestion does not
  -- exist or does not involve a profile the caller manages.
  SELECT
    ss.profile_a_id IN (SELECT public.manageable_shidduch_profile_ids()),
    CASE
      WHEN ss.profile_a_id IN (SELECT public.manageable_shidduch_profile_ids())
      THEN ss.profile_b_status
      ELSE ss.profile_a_status
    END
  INTO v_is_profile_a, v_other_status
  FROM shidduch_suggestions ss
  WHERE ss.id = p_suggestion_id
    AND (
      ss.profile_a_id IN (SELECT public.manageable_shidduch_profile_ids())
      OR ss.profile_b_id IN (SELECT public.manageable_shidduch_profile_ids())
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'respond_to_suggestion: no suggestion % for a profile you manage', p_suggestion_id
      USING ERRCODE = '42501';
  END IF;

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
$$;

COMMENT ON FUNCTION public.respond_to_suggestion(UUID, UUID, TEXT, TEXT) IS
  'Record the calling user''s response to a shidduch suggestion. p_user_id must be the caller and the suggestion must involve a profile they own or created (MEXA-251).';

REVOKE EXECUTE ON FUNCTION public.respond_to_suggestion(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_suggestion(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;

-- =====================================================
-- HIGH
-- =====================================================

-- Push-notification injection. The body is fine for its intended caller - the notify_*
-- triggers - but it was also a plain RPC endpoint, so anyone with the anon key could put
-- arbitrary title/body text in another user's notification queue. It is not replaced,
-- because it must keep working from the triggers, which run as the function owner and are
-- therefore unaffected by client-role privileges. Direct calls are simply taken away.
-- 00007 left notification_queue policy-free on the assumption that only this function
-- writes to it; that assumption is now actually true.
REVOKE EXECUTE ON FUNCTION public.send_push_notification(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_push_notification(UUID, TEXT, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION public.send_push_notification(UUID, TEXT, TEXT, JSONB) IS
  'Queue a push notification. Trigger-internal and service_role only: EXECUTE is revoked from anon and authenticated so it cannot be used as an RPC to spoof notifications (MEXA-251).';

-- Leaked the other party's first name, age, community and city for any p_user_id.
CREATE OR REPLACE FUNCTION public.get_shidduch_suggestions(p_user_id UUID)
RETURNS TABLE (
  out_suggestion_id UUID,
  out_other_profile JSONB,
  out_suggested_by TEXT,
  out_suggestion_reason TEXT,
  out_my_status TEXT,
  out_their_status TEXT,
  out_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := public.current_app_user_id();
  v_my_profile_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'get_shidduch_suggestions: no authenticated user'
      USING ERRCODE = '42501';
  END IF;

  -- The caller may ask about themselves, or about a single whose profile they created.
  IF p_user_id IS DISTINCT FROM v_caller_id
     AND NOT EXISTS (
       SELECT 1 FROM shidduch_profiles sp
       WHERE sp.user_id = p_user_id
         AND sp.created_by_user_id = v_caller_id
     )
  THEN
    RAISE EXCEPTION 'get_shidduch_suggestions: p_user_id must be you or a single whose profile you created'
      USING ERRCODE = '42501';
  END IF;

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
$$;

COMMENT ON FUNCTION public.get_shidduch_suggestions(UUID) IS
  'Shidduch suggestions for a user. p_user_id must be the caller or a single whose profile the caller created (MEXA-251).';

REVOKE EXECUTE ON FUNCTION public.get_shidduch_suggestions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shidduch_suggestions(UUID) TO authenticated, service_role;

-- =====================================================
-- MEDIUM
-- =====================================================

-- Two bugs in one function. Security: `user_uuid` was never checked, so an attacker could
-- claim a victim's email on the Orthodox allowlist before the victim registered (the
-- insert is ON CONFLICT (email) DO NOTHING, so the first writer wins), or bind their own
-- email to someone else's uuid. Correctness: the app passes the *auth* user id
-- (`session.user.id`, see app/(orthodox-auth)/register.tsx) but `orthodox_emails.user_id`
-- references `public.users(id)`, so every call failed the foreign key and the app - which
-- does not check the RPC's error - silently registered nothing. Identity now comes from
-- the JWT: `user_uuid` must be `auth.uid()`, the email must be the caller's own, and the
-- row stores `current_app_user_id()` (NULL if the users row does not exist yet, which is
-- the case during sign-up; the email uniqueness that blocks cross-registration still
-- holds).
CREATE OR REPLACE FUNCTION public.register_orthodox_email(user_email TEXT, user_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_email TEXT := LOWER(NULLIF(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL OR user_uuid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'register_orthodox_email: user_uuid must be the calling auth user'
      USING ERRCODE = '42501';
  END IF;

  IF v_auth_email IS NULL OR LOWER(user_email) IS DISTINCT FROM v_auth_email THEN
    RAISE EXCEPTION 'register_orthodox_email: user_email must be the calling user''s own email'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.orthodox_emails (email, user_id)
  VALUES (v_auth_email, public.current_app_user_id())
  ON CONFLICT (email) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.register_orthodox_email(TEXT, UUID) IS
  'Claim the calling user''s own email on the Orthodox allowlist. user_uuid must be auth.uid() and user_email must match the JWT email; the stored user_id is the public.users id (MEXA-251).';

REVOKE EXECUTE ON FUNCTION public.register_orthodox_email(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_orthodox_email(TEXT, UUID) TO authenticated, service_role;

-- No ownership check: anyone could pump another Safta account's daily counter to its free
-- tier limit.
CREATE OR REPLACE FUNCTION public.increment_safta_recommendation(safta_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  IF NOT public.owns_safta_account(safta_id) THEN
    RAISE EXCEPTION 'increment_safta_recommendation: not your Safta account'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.safta_daily_usage (safta_account_id, usage_date, recommendations_count)
  VALUES (safta_id, CURRENT_DATE, 1)
  ON CONFLICT (safta_account_id, usage_date)
  DO UPDATE SET
    recommendations_count = safta_daily_usage.recommendations_count + 1,
    updated_at = NOW()
  RETURNING recommendations_count INTO new_count;

  RETURN new_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_safta_recommendation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_safta_recommendation(UUID) TO authenticated, service_role;

-- =====================================================
-- LOW - same pattern, less sensitive data
-- =====================================================

-- View counts and match counts for any profile id. Called from
-- app/(shidduch-tabs)/my-profiles.tsx with a profile the signed-in user manages, so the
-- gate is the manageable set (owned or created), not just owned.
CREATE OR REPLACE FUNCTION public.get_profile_stats(p_profile_id UUID)
RETURNS TABLE (
  profile_views BIGINT,
  unique_viewers BIGINT,
  suggestions_received BIGINT,
  interested_responses BIGINT,
  mutual_matches BIGINT,
  last_view_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_profile_id IS NULL
     OR p_profile_id NOT IN (SELECT public.manageable_shidduch_profile_ids())
  THEN
    RAISE EXCEPTION 'get_profile_stats: not a profile you own or created'
      USING ERRCODE = '42501';
  END IF;

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
$$;

COMMENT ON FUNCTION public.get_profile_stats(UUID) IS
  'Engagement stats for a shidduch profile the caller owns or created (MEXA-251).';

REVOKE EXECUTE ON FUNCTION public.get_profile_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_stats(UUID) TO authenticated, service_role;

-- The four Safta quota/limit readers: subscription tier, daily usage and connection
-- counts for any Safta account id. Same ownership gate for all four.
CREATE OR REPLACE FUNCTION public.get_safta_daily_recommendations(safta_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec_count INTEGER;
BEGIN
  IF NOT public.owns_safta_account(safta_id) THEN
    RAISE EXCEPTION 'get_safta_daily_recommendations: not your Safta account'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(recommendations_count, 0) INTO rec_count
  FROM public.safta_daily_usage
  WHERE safta_account_id = safta_id AND usage_date = CURRENT_DATE;

  RETURN COALESCE(rec_count, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_safta_daily_recommendations(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_safta_daily_recommendations(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_safta_recommend(safta_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_plan TEXT;
  daily_count INTEGER;
  daily_limit INTEGER := 10; -- Free tier limit
BEGIN
  IF NOT public.owns_safta_account(safta_id) THEN
    RAISE EXCEPTION 'can_safta_recommend: not your Safta account'
      USING ERRCODE = '42501';
  END IF;

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
$$;

REVOKE EXECUTE ON FUNCTION public.can_safta_recommend(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_safta_recommend(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_safta_connection_count(safta_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.owns_safta_account(safta_id) THEN
    RAISE EXCEPTION 'get_safta_connection_count: not your Safta account'
      USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COUNT(*) FROM public.safta_connections
    WHERE safta_account_id = safta_id AND status = 'accepted'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_safta_connection_count(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_safta_connection_count(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_safta_add_connection(safta_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_plan TEXT;
  connection_count INTEGER;
  connection_limit INTEGER := 1; -- Free tier limit
BEGIN
  IF NOT public.owns_safta_account(safta_id) THEN
    RAISE EXCEPTION 'can_safta_add_connection: not your Safta account'
      USING ERRCODE = '42501';
  END IF;

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
$$;

REVOKE EXECUTE ON FUNCTION public.can_safta_add_connection(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_safta_add_connection(UUID) TO authenticated, service_role;

-- Allowlist membership probe: "does this email have an Orthodox account here" for any
-- address. Nothing in the app calls it (the pre-registration check in
-- app/(orthodox-auth)/register.tsx queries `users` directly), so restrict it to the
-- caller's own address rather than leaving an oracle for other people's addresses.
CREATE OR REPLACE FUNCTION public.is_orthodox_email(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_email TEXT := LOWER(NULLIF(auth.jwt() ->> 'email', ''));
BEGIN
  IF v_auth_email IS NULL OR LOWER(check_email) IS DISTINCT FROM v_auth_email THEN
    RAISE EXCEPTION 'is_orthodox_email: you can only check your own email'
      USING ERRCODE = '42501';
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.orthodox_emails WHERE email = v_auth_email
  );
END;
$$;

COMMENT ON FUNCTION public.is_orthodox_email(TEXT) IS
  'Whether the calling user''s own email is on the Orthodox allowlist. Other addresses are refused, so this is not an allowlist oracle (MEXA-251).';

REVOKE EXECUTE ON FUNCTION public.is_orthodox_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_orthodox_email(TEXT) TO authenticated, service_role;

-- =====================================================
-- SAME PATTERN, NOT ON THE MEXA-251 LIST
--
-- Found while enumerating pg_proc on the live project for this migration. Identical
-- shape - SECURITY DEFINER, anon-executable, caller-supplied id - so they are fixed here
-- rather than left as a second round.
-- =====================================================

-- 20250114_add_creator_tracking.sql: every profile created by any user id you name.
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := public.current_app_user_id();
BEGIN
  IF v_caller_id IS NULL OR p_creator_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'get_profiles_by_creator: p_creator_id must be the calling user'
      USING ERRCODE = '42501';
  END IF;

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
  WHERE sp.created_by_user_id = v_caller_id
  ORDER BY sp.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profiles_by_creator(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_creator(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_creator_profile_count(p_creator_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := public.current_app_user_id();
  profile_count INTEGER;
BEGIN
  IF v_caller_id IS NULL OR p_creator_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'get_creator_profile_count: p_creator_id must be the calling user'
      USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO profile_count
  FROM shidduch_profiles
  WHERE created_by_user_id = v_caller_id;

  RETURN profile_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_creator_profile_count(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_profile_count(UUID) TO authenticated, service_role;

-- browse_shidduch_profiles ignores p_viewer_id entirely and only returns profiles that
-- are already `profile_visible AND accepting_suggestions`, so there is no cross-user
-- leak in the body - but it is the same browse that 00009 restricted to `authenticated`
-- at the table level, and as an anon-callable definer function it walked straight around
-- that. Body unchanged; the fix is the privilege, plus the search_path pin below.
REVOKE EXECUTE ON FUNCTION public.browse_shidduch_profiles(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.browse_shidduch_profiles(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, INTEGER, INTEGER) TO authenticated, service_role;

-- 00003_push_tokens.sql. A bare maintenance DELETE with no arguments: no data leaked,
-- but any anonymous caller could fire it on demand. Maintenance only.
REVOKE EXECUTE ON FUNCTION public.cleanup_old_push_tokens() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_push_tokens() TO service_role;

-- The three functions above keep their bodies, so pin their search_path the way every
-- replaced function in this migration does. Everything they touch is in `public`.
ALTER FUNCTION public.send_push_notification(UUID, TEXT, TEXT, JSONB) SET search_path = public;
ALTER FUNCTION public.browse_shidduch_profiles(UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, INTEGER, INTEGER) SET search_path = public;
ALTER FUNCTION public.cleanup_old_push_tokens() SET search_path = public;

-- =====================================================
-- LEAST PRIVILEGE ON THE 00008 / 00009 HELPERS
--
-- All five are safe for anon (they reduce to auth.uid(), which is NULL, so they return
-- nothing), but nothing calls them as anon and MEXA-248 asked for the grant to be
-- dropped. They are used inside RLS policies, which are evaluated with the privileges of
-- the policy, not the caller, so revoking the client-role grants does not affect them.
-- =====================================================

REVOKE EXECUTE ON FUNCTION public.current_app_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_block_between(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_block_between(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_shidduch_profile_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_shidduch_profile_ids() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.suggested_shidduch_profile_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggested_shidduch_profile_ids() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.family_connected_shidduch_profile_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_connected_shidduch_profile_ids() TO authenticated, service_role;

-- =====================================================
-- shidduch_profiles: the id-space mismatch
--
-- Not a hole - it fails closed - but a dead feature. `user_id` and `created_by_user_id`
-- hold `public.users.id`; `auth.uid()` is an `auth.users.id`. The three creator-tracking
-- policies compare the two, so both branches are always false and the
-- create-a-profile-for-someone-else path (parent, grandparent, shadchan) cannot insert,
-- read-as-creator or update-as-creator. The profile owner's own access still works
-- through 00009's `shidduch_profiles_*_own` policies, which is why nothing looked broken.
-- Fix is 00009's: go through current_app_user_id(). Also pin all three to
-- `authenticated`, as 00009 did for the SELECT - they had no role clause, so they also
-- applied to anon.
-- =====================================================

DROP POLICY IF EXISTS "Users can view profiles they own or created" ON shidduch_profiles;

CREATE POLICY "Users can view profiles they own or created"
  ON shidduch_profiles FOR SELECT
  TO authenticated
  USING (
    user_id = public.current_app_user_id()
    OR created_by_user_id = public.current_app_user_id()
    OR profile_visible = true
  );

DROP POLICY IF EXISTS "Users can update profiles they own or created" ON shidduch_profiles;

-- No WITH CHECK on purpose: Postgres then applies the USING expression to the new row as
-- well, so an update cannot hand the profile to someone else.
CREATE POLICY "Users can update profiles they own or created"
  ON shidduch_profiles FOR UPDATE
  TO authenticated
  USING (
    user_id = public.current_app_user_id()
    OR created_by_user_id = public.current_app_user_id()
  );

DROP POLICY IF EXISTS "Users can insert profiles" ON shidduch_profiles;

CREATE POLICY "Users can insert profiles"
  ON shidduch_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = public.current_app_user_id()
    OR created_by_user_id = public.current_app_user_id()
  );
