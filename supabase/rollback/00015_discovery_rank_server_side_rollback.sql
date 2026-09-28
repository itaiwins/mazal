-- ROLLBACK for 00015_discovery_rank_server_side.sql (MEXA-278)
--
-- DO NOT put this file in supabase/migrations/. See supabase/MIGRATIONS.md.
--
-- A bit-exact inverse: it drops public.get_discovery_deck() and restores
-- public.user_public_profiles to 00013's definition, elo_score and all. Safe to run
-- against a database where 00015 was applied and 00013 was applied before it.
--
-- WHAT ELSE HAS TO GO BACK
--
-- The client half of MEXA-278 is not undone by SQL. If the app has shipped with
-- `fetchDiscoveryProfiles` calling the RPC, running this alone leaves it calling a function
-- that no longer exists and the deck breaks with a PostgREST 404. Revert
-- src/api/queries/useDiscoveryProfiles.ts and src/types/database.types.ts to their 00013
-- state in the same move.
--
-- WHAT IT DOES NOT PUT BACK
--
-- Nothing. The view had no dependent objects at 00015 (checked: no other view, policy or
-- function referenced it), so restating it here is the whole ACL and the whole definition.
-- If something has come to depend on it since, `DROP VIEW` below will refuse rather than
-- cascade - deliberately; fix the dependency by hand rather than adding CASCADE.

BEGIN;

DROP FUNCTION IF EXISTS public.get_discovery_deck(date, date, integer, text[], text[], integer);

DROP VIEW IF EXISTS public.user_public_profiles;

-- Verbatim from 00013_users_column_privacy.sql, section 4.
CREATE VIEW public.user_public_profiles
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  u.id,
  u.first_name,
  u.display_name,
  u.date_of_birth,
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
  u.elo_score,
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
  'MEXA-261. Other people''s profiles: display columns plus a precomputed distance_miles, '
  'for every active user the caller has not blocked and is not. Read this instead of '
  'public.users for anyone but the signed-in user - that table is now own-row-only.';

REVOKE ALL ON public.user_public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.user_public_profiles TO authenticated, service_role;

COMMIT;
