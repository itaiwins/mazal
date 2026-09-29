-- ROLLBACK for 00039_discovery_deck_ranked_on_server.sql  (MEXA-435 item 2)
--
-- Drops get_discovery_deck and puts elo_score back on user_public_profiles. The view body
-- below is 00030's, copied verbatim (the state measured live before 00039, 2026-09-29).
--
-- THE CLIENT GOES WITH IT. A build whose useDiscoveryProfiles.ts calls
-- `rpc('get_discovery_deck')` gets a 404 for its whole deck after this runs. Roll the app
-- back to the commit before that change, or do not run this file.

BEGIN;

DROP FUNCTION IF EXISTS public.get_discovery_deck(INTEGER, INTEGER, INTEGER, TEXT[], TEXT[], INTEGER);

DROP VIEW IF EXISTS public.user_public_profiles;

-- security_invoker = false and security_barrier = true carry over from 00013 unchanged, and
-- 00026's guards 0b/0c assert both. The view runs as its owner, `postgres`, so the WHERE
-- clause below is the row rule - `public.users` itself has had no cross-user SELECT policy
-- since 00013.
CREATE VIEW public.user_public_profiles
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  u.id,
  u.first_name,
  u.display_name,
  -- MEXA-320: was `u.date_of_birth`. The app renders an age and filters on an age; this is
  -- the whole of what it needed.
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
  -- Coarse location is the whole point: cards render "Brooklyn, NY".
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
  -- Precomputed so coordinates stay server-side. NULL when either party has no location,
  -- which is what the client did with an undefined distance before.
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
-- LEFT JOIN LATERAL, not a plain join: a safta signs in against `safta_accounts` and has no
-- `users` row at all, and somebody mid-onboarding has none yet either. Both should get a
-- deck rather than an error, with a null distance because there is no location to measure
-- from. LIMIT 1 because no constraint names auth_id as unique; the ORDER BY makes which row
-- wins deterministic rather than planner-dependent (Guts, MEXA-286).
LEFT JOIN LATERAL (
  SELECT m.id, m.current_latitude, m.current_longitude
    FROM public.users m
   WHERE m.auth_id = auth.uid()
   ORDER BY m.created_at, m.id
   LIMIT 1
) me ON true
WHERE auth.uid() IS NOT NULL          -- fails closed: an anonymous caller gets nothing
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
  'MEXA-261, narrowed by MEXA-320. Other people''s profiles: display columns, an age '
  '(never the date of birth - that stays on public.users, which is own-row-only) and a '
  'precomputed distance_miles, for every active user the caller has not blocked and is '
  'not. Read this instead of public.users for anyone but the signed-in user.';

-- Supabase's ALTER DEFAULT PRIVILEGES on `public` grants all four verbs on any new object to
-- anon, authenticated and service_role, and the CREATE VIEW above has just made a new
-- object - so this is not housekeeping, it is the difference between the view being
-- readable by the publishable anon key and not. 00013 revoked from PUBLIC and anon only, and
-- `authenticated` and `service_role` consequently kept INSERT, UPDATE and DELETE on it;
-- those are inert (the view has a LATERAL join, so it is not auto-updatable and a write
-- raises 55000) but they are wider than anything grants them for, and naming them costs
-- nothing while the REVOKE is being written anyway.
REVOKE ALL ON public.user_public_profiles FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.user_public_profiles TO authenticated, service_role;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00039';

COMMIT;
