-- ROLLBACK for 00030_public_profiles_publish_age_not_dob.sql (MEXA-320)
--
-- DO NOT put this file in supabase/migrations/. It undoes a migration; anything in that
-- directory is eventually applied in name order by some tool, and `00030_..._rollback.sql`
-- sorts right next to the file it exists to undo.
--
-- WHAT IT RESTORES
--
-- `public.user_public_profiles` exactly as 00013 left it - `u.date_of_birth` back in the
-- fourth column, no `age` - and `public.profile_age()` dropped. It is a bit-exact inverse,
-- including the grants: the rebuilt view picks up Supabase's default privileges at CREATE
-- time and then this file replays 00013's `REVOKE ALL ... FROM PUBLIC, anon` and nothing
-- more, which leaves `authenticated` and `service_role` holding the same inert INSERT,
-- UPDATE and DELETE they held before 00030 tightened them. That is deliberate: a rollback
-- returns the database to the state the pre-apply backup describes, and 00030's note on why
-- those grants are inert (the view is not auto-updatable; a write raises 55000) is as true
-- afterwards as before.
--
-- AFTER RUNNING THIS, THE APP IS THE OLD APP
--
-- The clients that ship with 00030 read `age` and filter on `age`. Rolling the database
-- back without also rolling the app back gives every cross-user screen a missing column:
-- the discovery deck and the safta deck 400 on the filter, and every card renders an
-- undefined age. Roll back the commit as well, or expect that.
--
-- IT REFUSES TO RUN IF 00026 IS APPLIED
--
-- `public.get_who_liked_me()` selects `age` out of this view once MEXA-320's version of
-- 00026 is applied. Putting `date_of_birth` back would leave that function raising on every
-- call, so section 0 stops rather than doing it. Roll 00026 back first
-- (supabase/rollback/00026_who_liked_me_rollback.sql), then run this.

BEGIN;

-- =====================================================
-- 0. REFUSE IF 00026 IS ON TOP
-- =====================================================

DO $$
BEGIN
  IF to_regproc('public.get_who_liked_me') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-320 rollback: public.get_who_liked_me() exists - it reads the `age` column this file is about to remove. Run supabase/rollback/00026_who_liked_me_rollback.sql first';
  END IF;

  IF to_regclass('public.user_public_profiles') IS NULL THEN
    RAISE EXCEPTION 'MEXA-320 rollback: public.user_public_profiles is missing - there is nothing here to undo';
  END IF;
END
$$;

-- =====================================================
-- 1. 00013'S VIEW, VERBATIM
-- =====================================================

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
  'MEXA-261. Other people''s profiles: display columns plus a precomputed distance_miles, '
  'for every active user the caller has not blocked and is not. Read this instead of '
  'public.users for anyone but the signed-in user - that table is now own-row-only.';

REVOKE ALL ON public.user_public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.user_public_profiles TO authenticated, service_role;

-- =====================================================
-- 2. THE AGE FUNCTION
-- =====================================================

-- RESTRICT (the default). Nothing should depend on it once the view above is back; if
-- something does, this raises instead of quietly dropping that too.
DROP FUNCTION IF EXISTS public.profile_age(date);

-- =====================================================
-- 3. LEDGER
-- =====================================================

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00030';

-- =====================================================
-- 4. ASSERT THE UNDO
-- =====================================================

DO $$
DECLARE
  v_bad TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user_public_profiles'
       AND column_name = 'date_of_birth'
  ) THEN
    RAISE EXCEPTION 'MEXA-320 rollback: date_of_birth is not back in the view';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user_public_profiles'
       AND column_name = 'age'
  ) THEN
    RAISE EXCEPTION 'MEXA-320 rollback: the view still carries `age`';
  END IF;

  IF to_regproc('public.profile_age') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-320 rollback: public.profile_age() is still there';
  END IF;

  -- The pre-00030 grant list, which is wider than 00030's by three inert write verbs on
  -- each of the two roles. See the header.
  SELECT string_agg(grantee || ':' || privilege_type, ', ' ORDER BY grantee, privilege_type)
    INTO v_bad
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'user_public_profiles'
     AND grantee <> 'postgres';
  IF v_bad IS DISTINCT FROM 'authenticated:DELETE, authenticated:INSERT, authenticated:SELECT, authenticated:UPDATE, service_role:DELETE, service_role:INSERT, service_role:REFERENCES, service_role:SELECT, service_role:TRIGGER, service_role:TRUNCATE, service_role:UPDATE' THEN
    RAISE EXCEPTION 'MEXA-320 rollback: grants are [%], which is not the pre-00030 set', v_bad;
  END IF;

  IF has_table_privilege('anon', 'public.user_public_profiles', 'SELECT') THEN
    RAISE EXCEPTION 'MEXA-320 rollback: anon can read the restored view';
  END IF;

  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00030') THEN
    RAISE EXCEPTION 'MEXA-320 rollback: ledger row 00030 is still there';
  END IF;
END
$$;

COMMIT;
