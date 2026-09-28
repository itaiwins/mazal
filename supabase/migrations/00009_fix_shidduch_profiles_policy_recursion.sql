-- Mazal - Fix infinite recursion in the shidduch_profiles RLS policies
--
-- Same class of bug as 00008, in 20250114_shidduch_system_fixed.sql this time.
-- `shidduch_profiles_select_suggested` is a SELECT policy on shidduch_profiles whose
-- USING clause reads shidduch_profiles again, and it also reads shidduch_suggestions,
-- whose own policy reads shidduch_profiles. On top of that
-- `shidduch_profiles_select_family` reads family_connections, whose policy reads
-- shidduch_profiles. Three separate loops, all reported as
-- 42P17 "infinite recursion detected in policy for relation shidduch_profiles":
--
--   shidduch_profiles -> shidduch_profiles
--   shidduch_profiles -> shidduch_suggestions -> shidduch_profiles
--   shidduch_profiles -> family_connections  -> shidduch_profiles
--
-- Each one is broken on the shidduch_profiles side, so the other tables' policies stay
-- exactly as their original migration wrote them.
--
-- It surfaced as a 500 on any request that touches a table whose policy joins through
-- shidduch_profiles (shabbat_schedules and shidduch_daily_activity, locked down in
-- 00007). Nothing leaked - the request failed - but the shidduch feature cannot work
-- like this, so fix it now rather than leaving a landmine for whoever turns
-- FEATURE_ORTHODOX_MODE back on (docs/ROADMAP.md).

CREATE OR REPLACE FUNCTION public.current_shidduch_profile_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.id
  FROM shidduch_profiles sp
  JOIN users u ON u.id = sp.user_id
  WHERE u.auth_id = auth.uid();
$$;

COMMENT ON FUNCTION public.current_shidduch_profile_ids() IS
  'The shidduch_profiles ids owned by the caller. SECURITY DEFINER so RLS policies on shidduch_profiles can use it without recursing.';

REVOKE ALL ON FUNCTION public.current_shidduch_profile_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_shidduch_profile_ids() TO authenticated, service_role;

-- The counterpart lookup has to be SECURITY DEFINER too. Reading shidduch_suggestions
-- under RLS re-enters its own policy, which reads shidduch_profiles, which lands back
-- here - the shidduch_profiles <-> shidduch_suggestions cycle.
CREATE OR REPLACE FUNCTION public.suggested_shidduch_profile_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ss.profile_a_id
  FROM shidduch_suggestions ss
  WHERE ss.profile_b_id IN (SELECT public.current_shidduch_profile_ids())
  UNION
  SELECT ss.profile_b_id
  FROM shidduch_suggestions ss
  WHERE ss.profile_a_id IN (SELECT public.current_shidduch_profile_ids());
$$;

COMMENT ON FUNCTION public.suggested_shidduch_profile_ids() IS
  'Profile ids on the other side of a shidduch suggestion involving the caller. SECURITY DEFINER to break the shidduch_profiles <-> shidduch_suggestions policy cycle.';

REVOKE ALL ON FUNCTION public.suggested_shidduch_profile_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggested_shidduch_profile_ids() TO authenticated, service_role;

DROP POLICY IF EXISTS "shidduch_profiles_select_suggested" ON shidduch_profiles;

CREATE POLICY "shidduch_profiles_select_suggested"
  ON shidduch_profiles FOR SELECT
  TO authenticated
  USING (shidduch_profiles.id IN (SELECT public.suggested_shidduch_profile_ids()));

-- Third loop: shidduch_profiles -> family_connections -> shidduch_profiles.
CREATE OR REPLACE FUNCTION public.family_connected_shidduch_profile_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fc.single_profile_id
  FROM family_connections fc
  JOIN users u ON u.id = fc.family_user_id
  WHERE u.auth_id = auth.uid()
    AND fc.status = 'active';
$$;

COMMENT ON FUNCTION public.family_connected_shidduch_profile_ids() IS
  'Profile ids the caller can see through an active family connection. SECURITY DEFINER to break the shidduch_profiles <-> family_connections policy cycle.';

REVOKE ALL ON FUNCTION public.family_connected_shidduch_profile_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_connected_shidduch_profile_ids() TO authenticated, service_role;

DROP POLICY IF EXISTS "shidduch_profiles_select_family" ON shidduch_profiles;

CREATE POLICY "shidduch_profiles_select_family"
  ON shidduch_profiles FOR SELECT
  TO authenticated
  USING (shidduch_profiles.id IN (SELECT public.family_connected_shidduch_profile_ids()));

-- Not recursion, but the same table and worth closing while we are here.
-- 20250114_add_creator_tracking.sql added this policy with no role clause and a bare
-- `profile_visible = true` branch, so once the recursion above stopped masking it,
-- anyone holding only the anon key could list every visible shidduch profile.
-- Restricting it to `authenticated` keeps the intent (a signed-in user browsing visible
-- profiles) and closes the anonymous read. The matching INSERT and UPDATE policies from
-- that migration are left alone: both of their checks reduce to auth.uid(), which is NULL
-- for an anonymous caller, so they already deny anon.
DROP POLICY IF EXISTS "Users can view profiles they own or created" ON shidduch_profiles;

CREATE POLICY "Users can view profiles they own or created"
  ON shidduch_profiles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR created_by_user_id = auth.uid()
    OR profile_visible = true
  );
