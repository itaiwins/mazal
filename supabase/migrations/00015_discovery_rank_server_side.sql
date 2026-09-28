-- Mazal - Rank the discovery deck in the database, stop publishing elo_score
--
-- MEXA-278. Rollback: supabase/rollback/00015_discovery_rank_server_side_rollback.sql
-- Requires 00013_users_column_privacy.sql (this replaces the view it creates).
--
-- WHY
--
-- 00013 moved other people's profiles into `public.user_public_profiles` but kept
-- `elo_score` in it, because `fetchDiscoveryProfiles` sorted the deck client-side:
--
--     profiles.sort((a, b) => {
--       if (a.has_liked_me && !b.has_liked_me) return -1;
--       if (!a.has_liked_me && b.has_liked_me) return 1;
--       return (b.elo_score ?? 0) - (a.elo_score ?? 0);
--     });
--
-- elo_score is not personal data, so it was not the MEXA-261 leak, but a client that can
-- read it learns how the app ranks people - and it has no other caller. Rank server-side,
-- return the page already ordered, and the column can go.
--
-- WHY AN RPC AND NOT `ORDER BY` IN THE VIEW
--
-- Two reasons, and only the second is fatal:
--
--   1. PostgREST keeps a view's own ordering only while the request sends no `order=`.
--      That is a property of the caller, not of the database.
--   2. The primary sort key is "did this person like me", which needs `public.swipes` rows
--      where `swiped_id` is the caller. The view could read them - it is
--      `security_invoker = false` - but it cannot both keep the caller's `.limit(50)`
--      semantics (see ORDER below) and be ordered, because PostgREST applies its LIMIT
--      after the view's ORDER BY. The RPC takes the limit as an argument and applies it
--      where the client used to.
--
-- WHY `SECURITY DEFINER`
--
-- Not a choice. The only SELECT policy on `swipes` (00002) is
-- `swiper_id = (SELECT id FROM users WHERE auth_id = auth.uid())`, so a caller cannot read
-- a row in which they are the *swipee*. A SECURITY INVOKER function would therefore see no
-- incoming likes at all. It follows the 00010 pattern for that reason: identity comes from
-- `public.current_app_user_id()` and nothing else, there is no user-id argument to forge,
-- `search_path` is pinned, and EXECUTE is revoked from PUBLIC and anon before it is granted.
--
-- Everything it returns about another person is already in the view that `authenticated`
-- may SELECT, plus one boolean about the caller's own inbox. Nothing new is published.
--
-- >>> THE INCOMING-LIKE KEY HAS NEVER WORKED, AND THIS TURNS IT ON <<<
--
-- Because of that same `swipes` policy, the client's own incoming-likes query
-- (`.eq('swiped_id', userId).in('action', ['like','super_like'])`) has always come back
-- empty under RLS. `has_liked_me` is therefore `false` for everyone in the app today, and
-- the deck's real order is elo alone. This migration makes the key work, so people who
-- liked you move to the front of the deck - which is what the code always said it did, and
-- a visible change against what the app does right now. Called out on MEXA-278 rather than
-- shipped quietly. Two other reads are broken by the same policy and are not fixed here:
-- `useSwipe.ts`'s reciprocal-like check and `useMatchesSubscription.ts`'s realtime filter,
-- so the "It's a Match!" screen and the incoming-like notification never fire. The match
-- row itself is still created, by the `swipes_check_match` trigger from 00001, which runs
-- as its owner. Filed as MEXA-280.
--
-- ORDER
--
-- Deliberately bug-for-bug, minus the line above. The client took `.limit(50)` *before* it
-- filtered or sorted, so the deck is "any 50 candidates, then ranked", not "the top 50" -
-- and the already-swiped and distance filters ran on that 50, which is why a user who has
-- swiped can get a short or empty deck. `p_limit` sits in the same place, inside
-- `candidates`, so the same people come back. Rank-then-limit is the better product and a
-- product decision; it is not made here.
--
-- Three more transcriptions worth naming:
--   * The age window arrives as the two dates the client already computes, rather than as
--     ages. The client builds them from the device clock in local time and then takes the
--     UTC date, so `current_date` on the server is not always the same day. Passing the
--     dates keeps the boundary exactly where it is today.
--   * `coalesce(elo_score, 0)`, not `elo_score DESC NULLS LAST`, because `?? 0` is what the
--     JavaScript did. The column is nullable (`INTEGER DEFAULT 1000`). For scores that are
--     never negative the two agree; for a negative score they would not.
--   * The distance filter compares the *rounded* miles, as the client did.
--
-- Ties keep whatever order `candidates` produced, which is arbitrary in both versions:
-- neither the old PostgREST query nor this one has a tiebreak, and Array.sort's stability
-- only preserved an order that was itself undefined.

BEGIN;

-- =====================================================
-- 1. DROP elo_score FROM THE PUBLIC PROFILE VIEW
-- =====================================================

-- CREATE OR REPLACE VIEW cannot remove a column, so the body is restated. It is
-- 00013's view verbatim with one line gone; keep the two in step, and if this file and
-- 00013 ever disagree, this one is the current definition.
DROP VIEW IF EXISTS public.user_public_profiles;

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
  -- elo_score was here until MEXA-278. It is read by public.get_discovery_deck(), which
  -- reaches public.users for it as its owner and never returns it.
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
  'MEXA-261/278. Other people''s profiles: display columns plus a precomputed '
  'distance_miles, for every active user the caller has not blocked and is not. Read this '
  'instead of public.users for anyone but the signed-in user - that table is own-row-only. '
  'No elo_score: the discovery deck is ranked by public.get_discovery_deck().';

-- Restated because the view object is new. A dropped view takes its ACL with it, and
-- Supabase's ALTER DEFAULT PRIVILEGES on `public` hands the replacement straight back to
-- anon (MIGRATIONS.md, "Writing a new SECURITY DEFINER function") - so the REVOKE is the
-- line that matters here, not the GRANT.
REVOKE ALL ON public.user_public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.user_public_profiles TO authenticated, service_role;

-- =====================================================
-- 2. THE RANKED DECK
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_discovery_deck(
  p_min_birth_date     date,
  p_max_birth_date     date,
  p_distance_max_miles integer DEFAULT 0,
  p_gender_preference  text[]  DEFAULT NULL,
  p_jewish_backgrounds text[]  DEFAULT NULL,
  p_limit              integer DEFAULT 50
)
RETURNS TABLE (
  id                     uuid,
  first_name             text,
  display_name           text,
  date_of_birth          date,
  gender                 text,
  bio                    text,
  height_cm              integer,
  occupation             text,
  company                text,
  education              text,
  school                 text,
  jewish_background      text,
  observance_level       text,
  keeps_shabbat          text,
  keeps_kosher           text,
  synagogue_attendance   text,
  jewish_education       text,
  looking_for            text,
  wants_children         text,
  partner_must_be_jewish boolean,
  raise_children_jewish  boolean,
  willing_to_relocate    boolean,
  current_city           text,
  current_state          text,
  current_country        text,
  is_active              boolean,
  onboarding_complete    boolean,
  is_verified            boolean,
  is_photo_verified      boolean,
  is_orthodox_only       boolean,
  is_orthodox_user       boolean,
  distance_miles         double precision,
  has_liked_me           boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    -- The only source of identity in here. No argument names a user.
    SELECT public.current_app_user_id() AS id
  ),
  candidates AS (
    -- The caller's page, taken before any of the filters below it, because that is where
    -- the client's .limit(50) sat. Reading the view rather than `users` keeps one copy of
    -- the "who may I see" rule (active, not me, no block either way) and of the distance
    -- computation. `me.id IS NOT NULL` fails closed for a caller with no profile row.
    SELECT p.*
      FROM public.user_public_profiles p
     CROSS JOIN me
     WHERE me.id IS NOT NULL
       AND p.is_active = true
       AND p.onboarding_complete = true
       AND p.id IS DISTINCT FROM me.id
       AND p.date_of_birth >= p_min_birth_date
       AND p.date_of_birth <= p_max_birth_date
       AND (
             p_gender_preference IS NULL
          OR cardinality(p_gender_preference) = 0
          OR p.gender = ANY (p_gender_preference)
       )
       AND (
             p_jewish_backgrounds IS NULL
          OR cardinality(p_jewish_backgrounds) = 0
          OR p.jewish_background = ANY (p_jewish_backgrounds)
       )
     LIMIT least(greatest(coalesce(p_limit, 50), 0), 200)
  ),
  ranked AS (
    SELECT c.*,
           EXISTS (
             SELECT 1
               FROM public.swipes s
              WHERE s.swiper_id = c.id
                AND s.swiped_id = me.id
                AND s.action IN ('like', 'super_like')
           ) AS liked_me,
           -- `?? 0`, not NULLS LAST. See ORDER in the header.
           coalesce(u.elo_score, 0) AS sort_elo
      FROM candidates c
      JOIN public.users u ON u.id = c.id
     CROSS JOIN me
     WHERE NOT EXISTS (
             SELECT 1
               FROM public.swipes s2
              WHERE s2.swiper_id = me.id
                AND s2.swiped_id = c.id
           )
       AND (
             coalesce(p_distance_max_miles, 0) <= 0
          OR c.distance_miles IS NULL
          OR round(c.distance_miles) <= p_distance_max_miles
       )
  )
  SELECT
    r.id,
    r.first_name,
    r.display_name,
    r.date_of_birth,
    r.gender,
    r.bio,
    r.height_cm,
    r.occupation,
    r.company,
    r.education,
    r.school,
    r.jewish_background,
    r.observance_level,
    r.keeps_shabbat,
    r.keeps_kosher,
    r.synagogue_attendance,
    r.jewish_education,
    r.looking_for,
    r.wants_children,
    r.partner_must_be_jewish,
    r.raise_children_jewish,
    r.willing_to_relocate,
    r.current_city,
    r.current_state,
    r.current_country,
    r.is_active,
    r.onboarding_complete,
    r.is_verified,
    r.is_photo_verified,
    r.is_orthodox_only,
    r.is_orthodox_user,
    r.distance_miles,
    r.liked_me
    FROM ranked r
   ORDER BY r.liked_me DESC, r.sort_elo DESC;
$$;

COMMENT ON FUNCTION public.get_discovery_deck(date, date, integer, text[], text[], integer) IS
  'MEXA-278. The discovery deck for the calling user, already ranked: people who have liked '
  'the caller first, then by elo_score descending. Identity is taken from '
  'current_app_user_id() only; SECURITY DEFINER because the swipes SELECT policy hides rows '
  'in which the caller is the swipee, so no invoker could see an incoming like. Returns the '
  'same columns as public.user_public_profiles plus has_liked_me, and never elo_score.';

REVOKE EXECUTE ON FUNCTION public.get_discovery_deck(date, date, integer, text[], text[], integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_discovery_deck(date, date, integer, text[], text[], integer) TO authenticated, service_role;

COMMIT;

-- NOT FIXED HERE, ON PURPOSE
--
--   * `public.get_orthodox_discovery_profiles` (00010) still RETURNS SETOF public.users, so
--     it hands a caller elo_score along with every other column of somebody else's row -
--     email, phone, coordinates. It is a bigger hole than this issue and it belongs to
--     MEXA-279, which covers the Orthodox/Safta/Shidduch screens that read `users`
--     cross-user. It is behind the Orthodox feature flag, so nothing calls it today.
--   * `authenticated` still holds UPDATE on all of `public.users`, so a user can still
--     write their own elo_score: MEXA-276. This migration only stops them reading anyone
--     else's, and does not touch the grants MEXA-276 has to change.
--   * src/lib/demo/demoProfiles.ts still carries elo_score on its fixtures. Harmless -
--     demo mode never reaches the database and nothing sorts those five profiles.
