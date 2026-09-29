-- Mazal - Rank the discovery deck on the server, then limit it; stop publishing elo_score
--
-- MEXA-435 item 2 (was MEXA-278, MEXA-318). Rollback: supabase/rollback/00039_discovery_deck_ranked_on_server_rollback.sql
-- Requires: 00013 + 00030 (the view as it is live), 00010 (current_app_user_id).
-- The client change ships with it: src/api/queries/useDiscoveryProfiles.ts calls
-- `get_discovery_deck` instead of reading the view and sorting.
--
-- WHAT WAS WRONG
--
-- 1. `user_public_profiles` published `elo_score` to every signed-in caller, only because the
--    client sorted the deck by it. A client that can read it learns how the app ranks people.
-- 2. The client took "any 50" rows of the view, THEN dropped the ones already swiped and the
--    ones out of range, THEN sorted. So a user who had swiped a lot got a short or empty deck
--    even with plenty of people left, and the 50 were not the best 50.
--
-- WHAT THIS DOES
--
-- `get_discovery_deck(...)` filters everything first (not swiped, age, gender, background,
-- distance, onboarded), ranks, and only then takes `p_limit` rows (clamped to 1..100).
-- Rank: people who already liked you first, then elo_score, highest first, then id so the
-- order is stable between two fetches (rewindDeckPosition.ts relies on a stable order).
-- This rank-then-limit change is the product call MEXA-318 held for Itai; Lelouch
-- pre-approved it for this set on MEXA-435.
--
-- It returns rows of the view itself (SETOF public.user_public_profiles), so it cannot
-- publish a column the view does not, and it reads through the view, so the view's
-- WHERE clause (active, not you, not blocked either way, signed in) still applies. `elo_score`
-- and whether someone liked you are used for the ORDER BY and returned by neither.
--
-- WHY SECURITY DEFINER
--
-- `public.users` is own-row-only since 00013 and `swipes` shows a caller only their own
-- swipes, so an invoker function can read neither other people's elo_score nor who
-- liked the caller. The function takes no user id: the caller comes from the JWT through
-- `current_app_user_id()`, and every argument only narrows the caller's own deck.
--
-- plpgsql, not sql: a SQL-language SRF can be inlined into PostgREST's outer query, which
-- does not have to keep the inner ORDER BY. RETURN QUERY materialises the rows in order.

BEGIN;

-- =====================================================
-- 0. PRECONDITIONS
-- =====================================================
DO $$
BEGIN
  IF to_regclass('public.user_public_profiles') IS NULL THEN
    RAISE EXCEPTION 'MEXA-435: public.user_public_profiles is missing - apply 00013 and 00030 first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'user_public_profiles' AND column_name = 'age') THEN
    RAISE EXCEPTION 'MEXA-435: user_public_profiles has no age column - apply 00030 first';
  END IF;
  IF to_regprocedure('public.current_app_user_id()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-435: public.current_app_user_id() is missing';
  END IF;
  -- Nothing else may hang off the view: DROP VIEW below would take it with it (CASCADE is
  -- not used) or fail. Measured live 2026-09-29: no dependent views or functions.
  IF EXISTS (
    SELECT 1 FROM pg_depend d
      JOIN pg_rewrite r ON r.oid = d.objid
     WHERE d.refobjid = 'public.user_public_profiles'::regclass
       AND r.ev_class <> 'public.user_public_profiles'::regclass
  ) THEN
    RAISE EXCEPTION 'MEXA-435: another view depends on user_public_profiles - rebuild it here too';
  END IF;
END
$$;

-- =====================================================
-- 1. THE VIEW, WITHOUT elo_score
-- =====================================================
-- 00030's definition verbatim, minus the one column. CREATE OR REPLACE cannot drop a column.
DROP VIEW IF EXISTS public.user_public_profiles;

CREATE VIEW public.user_public_profiles
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  u.id,
  u.first_name,
  u.display_name,
  public.profile_age(u.date_of_birth) AS age,
  u.gender,
  u.bio,
  u.height_cm,
  u.occupation,
  u.company,
  u.education,
  u.school,
  u.jewish_background,
  u.observance_level,
  u.keeps_shabbat,
  u.keeps_kosher,
  u.synagogue_attendance,
  u.jewish_education,
  u.looking_for,
  u.wants_children,
  u.partner_must_be_jewish,
  u.raise_children_jewish,
  u.willing_to_relocate,
  u.current_city,
  u.current_state,
  u.current_country,
  u.is_active,
  u.onboarding_complete,
  u.is_verified,
  u.is_photo_verified,
  u.is_orthodox_only,
  u.is_orthodox_user,
  CASE
    WHEN me.current_latitude IS NOT NULL AND me.current_longitude IS NOT NULL
     AND u.current_latitude  IS NOT NULL AND u.current_longitude  IS NOT NULL
    THEN public.haversine_miles(
           me.current_latitude::double precision,
           me.current_longitude::double precision,
           u.current_latitude::double precision,
           u.current_longitude::double precision
         )
  END AS distance_miles
FROM public.users u
LEFT JOIN LATERAL (
  SELECT m.id, m.current_latitude, m.current_longitude
    FROM public.users m
   WHERE m.auth_id = auth.uid()
   ORDER BY m.created_at, m.id
   LIMIT 1
) me ON true
WHERE auth.uid() IS NOT NULL
  AND u.is_active = true
  AND u.auth_id IS DISTINCT FROM auth.uid()
  AND NOT EXISTS (
        SELECT 1
          FROM public.blocks b
         WHERE (b.blocker_id = me.id AND b.blocked_id = u.id)
            OR (b.blocked_id = me.id AND b.blocker_id = u.id)
      );

ALTER VIEW public.user_public_profiles OWNER TO postgres;

COMMENT ON VIEW public.user_public_profiles IS
  'MEXA-261, narrowed by MEXA-320 and MEXA-435. Other people''s profiles: display columns, an age '
  '(never the date of birth - that stays on public.users, which is own-row-only) and a '
  'precomputed distance_miles, for every active user the caller has not blocked and is '
  'not. No elo_score: the deck is ranked by get_discovery_deck(). Read this instead of '
  'public.users for anyone but the signed-in user.';

REVOKE ALL ON public.user_public_profiles FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.user_public_profiles TO authenticated, service_role;

-- =====================================================
-- 2. THE RANKED DECK
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_discovery_deck(
  p_age_min INTEGER DEFAULT 18,
  p_age_max INTEGER DEFAULT 99,
  p_distance_max_miles INTEGER DEFAULT 0,      -- 0 or NULL = no distance limit
  p_genders TEXT[] DEFAULT NULL,               -- NULL or empty = any
  p_backgrounds TEXT[] DEFAULT NULL,           -- NULL or empty = any
  p_limit INTEGER DEFAULT 50
)
RETURNS SETOF public.user_public_profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me UUID := public.current_app_user_id();
BEGIN
  -- No profile row yet (mid-onboarding, or a safta): nothing to swipe as, so no deck.
  IF v_me IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v.*
    FROM public.user_public_profiles v
    JOIN public.users u ON u.id = v.id
   WHERE v.onboarding_complete IS TRUE
     AND v.age BETWEEN p_age_min AND p_age_max
     AND (p_genders IS NULL OR pg_catalog.cardinality(p_genders) = 0 OR v.gender = ANY (p_genders))
     AND (p_backgrounds IS NULL OR pg_catalog.cardinality(p_backgrounds) = 0
          OR v.jewish_background = ANY (p_backgrounds))
     -- Same rule the client applied: no location on either side is not a reason to hide someone.
     AND (coalesce(p_distance_max_miles, 0) <= 0 OR v.distance_miles IS NULL
          OR pg_catalog.round(v.distance_miles) <= p_distance_max_miles)
     AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.swiper_id = v_me AND s.swiped_id = v.id)
   ORDER BY
     EXISTS (SELECT 1 FROM public.swipes s
              WHERE s.swiper_id = v.id AND s.swiped_id = v_me
                AND s.action IN ('like', 'super_like')) DESC,
     u.elo_score DESC NULLS LAST,
     v.id
   LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 100);
END;
$$;

ALTER FUNCTION public.get_discovery_deck(INTEGER, INTEGER, INTEGER, TEXT[], TEXT[], INTEGER) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_discovery_deck(INTEGER, INTEGER, INTEGER, TEXT[], TEXT[], INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_discovery_deck(INTEGER, INTEGER, INTEGER, TEXT[], TEXT[], INTEGER)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_discovery_deck(INTEGER, INTEGER, INTEGER, TEXT[], TEXT[], INTEGER) IS
  'MEXA-435 (MEXA-278/318). The caller''s discovery deck: user_public_profiles rows not yet swiped, '
  'filtered, ranked (liked you first, then elo_score, then id) and only then limited to p_limit (1..100). '
  'Returns view rows only; elo_score and incoming likes are used for ordering and never returned.';

-- =====================================================
-- 3. SELF-CHECK
-- =====================================================
DO $$
DECLARE
  v_bad TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'user_public_profiles' AND column_name = 'elo_score') THEN
    RAISE EXCEPTION 'MEXA-435: user_public_profiles still publishes elo_score';
  END IF;

  SELECT string_agg(o, ',') INTO v_bad
    FROM pg_class c, unnest(c.reloptions) o
   WHERE c.oid = 'public.user_public_profiles'::regclass;
  IF v_bad IS DISTINCT FROM 'security_invoker=false,security_barrier=true' THEN
    RAISE EXCEPTION 'MEXA-435: view options are %, expected security_invoker=false,security_barrier=true', v_bad;
  END IF;

  IF has_table_privilege('anon', 'public.user_public_profiles', 'SELECT')
     OR has_table_privilege('authenticated', 'public.user_public_profiles', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.user_public_profiles', 'SELECT') THEN
    RAISE EXCEPTION 'MEXA-435: user_public_profiles grants are not SELECT-to-authenticated-only';
  END IF;

  IF has_function_privilege('anon', 'public.get_discovery_deck(integer,integer,integer,text[],text[],integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_discovery_deck(integer,integer,integer,text[],text[],integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-435: get_discovery_deck EXECUTE is not authenticated-only';
  END IF;
END
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00039', 'discovery_deck_ranked_on_server')
ON CONFLICT (version) DO NOTHING;

COMMIT;
