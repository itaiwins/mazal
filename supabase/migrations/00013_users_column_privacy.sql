-- Mazal - Stop handing every signed-in user the whole `users` row
--
-- MEXA-261. Rollback: supabase/rollback/00013_users_column_privacy_rollback.sql
--
-- WHY
--
-- RLS restricts rows, never columns. `public.users` doubles as "my account" and "other
-- people's public profile", and the SELECT policy from 00008, "Users can view other
-- profiles", let any signed-in user read the row of every active user they had not
-- blocked. The row, not a projection of it: `email`, `phone`, `current_latitude`,
-- `current_longitude`, `location`, `auth_id`, `date_of_birth`, `elo_score` and an
-- `instagram_access_token` - a bearer token for somebody's third-party account. A client
-- did not have to ask for those columns, it only had to ask for the row.
--
-- 00010 closed the RPC route to the same data (`get_orthodox_discovery_profiles` returned
-- `SETOF users`). This closes the direct table route, which is what the app actually uses.
--
-- THE SHAPE OF THE FIX
--
-- Give the two audiences two different objects, because one table cannot serve both:
--
--   * `public.users` becomes own-row-only. The cross-user SELECT policy is dropped, so
--     `select('*')` from a settings or profile screen keeps working untouched and reaches
--     exactly one row - yours.
--   * `public.user_public_profiles` is the other-people object: a view over `users` that
--     lists display columns only and carries the row rule that used to live in the
--     policy. Discovery and matches read this.
--
-- Columns held back from the view, and why each one: `email`, `phone` (contact details,
-- nothing renders them), `auth_id` (the caller's own lookup key, useless and identifying
-- for anyone else), `last_name` (a dating profile shows a first name), `current_latitude`,
-- `current_longitude`, `location`, `location_updated_at` (see DISTANCE below),
-- `gender_preference`, `shabbat_mode_*`, `shabbat_timezone`, `orthodox_subscription_status`
-- (own settings and billing state; only ever read for the signed-in user),
-- `response_rate`, `avg_response_time_hours`, `is_premium`, `shadchan_id`, `updated_at`,
-- `created_at` (internal, unrendered).
--
-- `elo_score` IS still in the view, because `useDiscoveryProfiles` sorts the deck by it
-- client-side. It is a ranking number, not personal data, so it is not what this issue is
-- about - but a client that can read it can also learn how it ranks people. Moving the
-- sort server-side is MEXA-278.
--
-- DISTANCE
--
-- The app showed "23 miles away" by downloading both sets of coordinates and running
-- haversine in JavaScript. That is the worst line in the issue: a home GPS coordinate for
-- every profile in the deck. The view computes the distance instead and publishes only the
-- result, as `distance_miles`. `public.haversine_miles` is a transcription of
-- `calculateDistanceMiles` in src/api/queries/useDiscoveryProfiles.ts - same 3959-mile
-- radius, same formula - so the number a user sees does not change.
--
-- One deliberate difference: the JavaScript guarded with `if (userLat && userLng && ...)`,
-- which treats latitude or longitude 0 as missing and hides the distance for anyone on the
-- equator or the prime meridian. The view tests IS NOT NULL, so those users now get a
-- distance like everybody else.
--
-- INSTAGRAM TOKENS
--
-- An OAuth bearer token has no business in a table any client can SELECT, and no column
-- privilege can fix it: revoking one column from `authenticated` makes `select('*')` fail
-- for that role, so the own-row reads the app is built on would break too. The two columns
-- move to `public.user_integrations`, which no client role can touch at all. Nothing in the
-- app reads or writes either column today (checked across src/ and app/; only
-- src/types/supabase.generated.ts mentions them), so this moves storage, not behaviour.
--
-- WHAT `user_photos` HAS TO DO WITH IT
--
-- `user_photos."Users can view other photos"` decided "is this profile visible to me?" with
-- a correlated subquery against `users` - and a subquery inside a policy is itself subject
-- to that table's RLS. Dropping the cross-user policy on `users` would therefore have made
-- every other user's photos disappear from discovery. The policy is rewritten to ask
-- `public.is_discoverable_profile()`, a SECURITY DEFINER function, which is the same trick
-- 00008 used with `has_block_between` to break the users <-> blocks cycle.
--
-- GRANTS
--
-- Supabase's default table grants gave `anon` and `authenticated` the full set on `users`.
-- `anon` loses all of it here: the profile row is created by `useCreateProfile` after
-- sign-up, when the caller already holds a session and is `authenticated`, and the INSERT
-- policy's `auth.uid() = auth_id` could never have been satisfied by an anonymous caller
-- anyway. `authenticated` loses DELETE, which no policy admits - account deletion runs
-- through the delete-account Edge Function as `service_role`.
--
-- TRUNCATE, TRIGGER and REFERENCES were also granted to both roles, and RLS does not filter
-- any of them. 00014 (MEXA-268) took all three off every table in `public` and was applied
-- on 2026-09-28, so they are already gone by the time this runs. Section 6 names them again
-- anyway, so that 00013 states the full intended privilege set for `users` and still closes
-- MEXA-261 on a database where 00014 has not been applied. REVOKE is idempotent.
--
-- NOT IN SCOPE, all filed rather than fixed here:
--   * `authenticated` still holds UPDATE on all of `users`, and the UPDATE policy checks
--     only the row, so a user can still write their own `is_verified` or `elo_score`.
--     Column-scoping that needs its own pass over every write path: MEXA-276.
--   * `user_prompts` and `user_badges` both have a `USING (true)` SELECT policy, so they
--     ignore is_active and blocks entirely: MEXA-277.
--   * The Orthodox, Safta and Shidduch screens read `users` cross-user, several through
--     PostgREST embedded joins that a view cannot stand in for. All are behind the feature
--     flags from 9dbc0e7, so nothing is broken today, but each one needs moving before its
--     flag is turned on: MEXA-279.

BEGIN;

-- =====================================================
-- 1. HELPERS
-- =====================================================

-- The row rule that used to be inline in two policies, in one place instead. SECURITY
-- DEFINER so that callers reach `users` and `blocks` without their own RLS applying -
-- otherwise the users policy this migration removes would be needed to evaluate it, which
-- is the cycle 00008 spent a migration removing.
CREATE OR REPLACE FUNCTION public.is_discoverable_profile(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM users u
     WHERE u.id = p_user_id
       AND u.is_active = true
       AND u.auth_id IS DISTINCT FROM auth.uid()
       AND NOT public.has_block_between(u.id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_discoverable_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_discoverable_profile(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_discoverable_profile(uuid) IS
  'MEXA-261. True when p_user_id is somebody other than the caller, is active, and has no '
  'block either way with the caller. The visibility rule for other people''s profiles and '
  'photos; SECURITY DEFINER because users/blocks RLS must not apply while evaluating it.';

-- Transcribed from calculateDistanceMiles() in src/api/queries/useDiscoveryProfiles.ts so
-- the view reports the same number the client used to compute. Keep the two in step.
CREATE OR REPLACE FUNCTION public.haversine_miles(
  p_lat1 double precision,
  p_lon1 double precision,
  p_lat2 double precision,
  p_lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  WITH t AS (
    SELECT radians(p_lat2 - p_lat1) AS d_lat,
           radians(p_lon2 - p_lon1) AS d_lon,
           radians(p_lat1) AS lat1,
           radians(p_lat2) AS lat2
  ), a AS (
    SELECT sin(d_lat / 2) * sin(d_lat / 2)
         + cos(lat1) * cos(lat2) * sin(d_lon / 2) * sin(d_lon / 2) AS v
      FROM t
  )
  -- 3959 = Earth's radius in miles, as in the JavaScript.
  SELECT 3959 * 2 * atan2(sqrt(a.v), sqrt(1 - a.v)) FROM a;
$$;

COMMENT ON FUNCTION public.haversine_miles(double precision, double precision, double precision, double precision) IS
  'MEXA-261. Great-circle distance in miles. Mirrors calculateDistanceMiles() in '
  'src/api/queries/useDiscoveryProfiles.ts; exists so clients never receive coordinates.';

-- =====================================================
-- 2. MOVE THE INSTAGRAM TOKENS OUT OF public.users
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_integrations (
  user_id                 uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  instagram_user_id       text,
  instagram_access_token  text,
  created_at              timestamptz NOT NULL DEFAULT NOW(),
  updated_at              timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_integrations IS
  'MEXA-261. Third-party OAuth material, moved off public.users because every signed-in '
  'user could read that table''s rows. No client role has any privilege here and there is '
  'no RLS policy: reachable only by service_role (Edge Functions) and the table owner.';

-- Carry across anything already stored. Empty on tayiyczmacvhokdxfqvm (0 rows in users at
-- the time of writing), but a migration should not assume the database it runs against.
INSERT INTO public.user_integrations (user_id, instagram_user_id, instagram_access_token)
SELECT u.id, u.instagram_user_id, u.instagram_access_token
  FROM public.users u
 WHERE u.instagram_user_id IS NOT NULL
    OR u.instagram_access_token IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Supabase runs ALTER DEFAULT PRIVILEGES on `public` granting everything to anon,
-- authenticated and service_role at creation time, so omitting a role from GRANT achieves
-- nothing. Say it (MIGRATIONS.md, "Writing a new SECURITY DEFINER function").
REVOKE ALL ON TABLE public.user_integrations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_integrations TO service_role;

ALTER TABLE public.users
  DROP COLUMN IF EXISTS instagram_access_token,
  DROP COLUMN IF EXISTS instagram_user_id;

-- =====================================================
-- 3. public.users BECOMES OWN-ROW-ONLY
-- =====================================================

-- The whole bug in one line. What replaces it is section 4.
DROP POLICY IF EXISTS "Users can view other profiles" ON public.users;

-- Left in place: "Users can view own profile" (auth.uid() = auth_id), "Users can create
-- own profile", "Users can update own profile".

-- =====================================================
-- 4. THE PUBLIC PROFILE VIEW
-- =====================================================

DROP VIEW IF EXISTS public.user_public_profiles;

-- security_invoker = false (the default, stated because everything here depends on it):
-- the view runs as its owner, `postgres`, which owns `users` and so is not subject to its
-- RLS. That is the point - section 3 just removed the only policy that granted cross-user
-- reads, so the view has to supply the row rule itself, which is the WHERE clause below.
-- Supabase's linter flags views like this; that is expected, not an oversight.
--
-- security_barrier = true stops a caller-supplied qual containing a leaky function from
-- being evaluated against rows the WHERE clause would have removed. Plain comparisons are
-- leakproof, so the filters PostgREST generates still push down and still use indexes.
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
-- LEFT JOIN LATERAL, not a plain join: someone who has not finished onboarding has no
-- `users` row, and they should still get an empty deck rather than an error. LIMIT 1
-- because nothing constrains auth_id to be unique, the same reason current_app_user_id()
-- has one.
LEFT JOIN LATERAL (
  SELECT m.id, m.current_latitude, m.current_longitude
    FROM public.users m
   WHERE m.auth_id = auth.uid()
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
  'MEXA-261. Other people''s profiles: display columns plus a precomputed distance_miles, '
  'for every active user the caller has not blocked and is not. Read this instead of '
  'public.users for anyone but the signed-in user - that table is now own-row-only.';

REVOKE ALL ON public.user_public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.user_public_profiles TO authenticated, service_role;

-- =====================================================
-- 5. KEEP OTHER PEOPLE'S PHOTOS VISIBLE
-- =====================================================

-- Was a correlated subquery on `users`, which section 3 just stopped from returning other
-- people's rows. Same rule, asked through a function that is not subject to users RLS.
DROP POLICY IF EXISTS "Users can view other photos" ON public.user_photos;

CREATE POLICY "Users can view other photos" ON public.user_photos
  FOR SELECT TO authenticated
  USING (public.is_discoverable_profile(user_id));

-- "Users can view own photos" still covers the caller's own rows.

-- =====================================================
-- 6. TABLE GRANTS ON public.users
-- =====================================================

-- anon has no business here at all. The profile row is inserted after sign-up, by which
-- point the caller holds a session and is `authenticated`.
REVOKE ALL ON TABLE public.users FROM anon;

-- DELETE is this migration's to take: no policy on `users` admits it, so it was already
-- dead, and account deletion goes through the delete-account Edge Function as service_role.
--
-- TRUNCATE, TRIGGER and REFERENCES are 00014's (MEXA-268) and it is already applied, so
-- these three are no-ops against tayiyczmacvhokdxfqvm. Named anyway: this line is what makes
-- 00013 a complete statement of what `users` should grant, and it keeps the fix whole on a
-- database that has not had 00014. REVOKE is idempotent.
REVOKE TRUNCATE, TRIGGER, REFERENCES, DELETE ON TABLE public.users FROM authenticated;

-- Left: SELECT, INSERT, UPDATE for `authenticated`, all of them row-limited by policy to
-- the caller's own row. Account deletion runs through the delete-account Edge Function as
-- service_role, which is why authenticated does not need DELETE.

COMMIT;
