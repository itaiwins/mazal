-- Mazal - Publish an age, not an exact date of birth
--
-- MEXA-320. Rollback: supabase/rollback/00030_public_profiles_publish_age_not_dob_rollback.sql
--
-- WHY
--
-- `public.user_public_profiles` (00013, MEXA-261) is the object every signed-in caller
-- reads to see other people. It publishes `u.date_of_birth` - the exact birthdate of every
-- active user - and the app has never rendered one. Every screen that shows something about
-- a birthdate shows an age, computed on the device:
--
--   src/api/queries/useDiscoveryProfiles.ts   age = calculateAge(user.date_of_birth)
--   src/api/queries/useMatches.ts             age: calculateAge(otherUser.date_of_birth)
--   src/api/queries/useWhoLikedMe.ts          age: calculateAge(liker.date_of_birth)
--   app/(orthodox-tabs)/index.tsx             age from date_of_birth
--   app/(shidduch-tabs)/index.tsx, browse.tsx age from date_of_birth
--   app/(safta-tabs)/index.tsx, profile.tsx   age from date_of_birth
--
-- So the precision published is strictly greater than the precision used. An exact DOB is a
-- strong identity element - it is what identity-verification and account-recovery flows key
-- on - and here it arrives attached to a real first name, a face and a city, for every
-- active user at once. Anyone holding a session can harvest the set; nothing about the
-- product needs them to be able to.
--
-- This is not a regression: `date_of_birth` was in the bytes Guts reviewed on MEXA-286 and
-- in what Lelouch approved on MEXA-301. It is the remaining over-exposure in a view whose
-- email, phone, `auth_id`, coordinates and Instagram token 00013 already closed.
--
-- WHAT REPLACES IT
--
-- An `age` integer, computed in the database by `public.profile_age()`. Callers filter and
-- render on that. `date_of_birth` leaves the view entirely; it stays on `public.users`,
-- which has been own-row-only since 00013, so a user can still read and edit their own.
--
-- WHY THE COLUMN COULD NOT JUST BE DROPPED
--
-- The age *filter* on the discovery deck is server-side on the same column:
--
--   src/api/queries/useDiscoveryProfiles.ts  .gte('date_of_birth', minBirthDate)
--                                            .lte('date_of_birth', maxBirthDate)
--   app/(safta-tabs)/index.tsx               the same pair
--
-- PostgREST can only filter on a column the view exposes, so dropping `date_of_birth`
-- without putting something in its place would have emptied the deck rather than narrowed
-- it. The clients move to `.gte('age', min).lte('age', max)` in the same commit.
--
-- THE INDEX QUESTION, MEASURED
--
-- MEXA-320 flagged that an age expression cannot be indexed, because it changes with the
-- clock, and asked whether the filter would lose an index. Measured on
-- `tayiyczmacvhokdxfqvm` on 2026-09-29: there is no index on `users.date_of_birth` and
-- never has been. The whole index set on that table is `users_pkey`, `users_email_key`,
-- `users_phone_key`, `idx_users_location` (gist), `idx_users_active`, `idx_users_auth_id`
-- and `idx_users_orthodox`. The date filter was already a sequential scan with a filter, so
-- the age filter is the same plan, not a worse one, and there is nothing to keep
-- `date_of_birth` in the view for. If the deck ever needs an index, the shape that works is
-- a btree on `date_of_birth` (the base column, which is immutable and still there) with the
-- planner reaching it through the view's `age` expression rewritten as a date range - which
-- is a query change, not a schema change, and it does not need the column to be published.
--
-- WHAT THIS DOES AND DOES NOT PROTECT
--
-- Publishing an age is not the same as publishing nothing. An observer who reads the same
-- profile every day learns the birthday to the day - it is the day `age` increments - so
-- this is a large reduction in exposure, not an elimination. Eliminating it would mean not
-- publishing an age either, and the product is a dating app: the age is on the card. What
-- this does remove is the bulk harvest, which is the part that needed no effort at all:
-- one `select *` no longer hands over the exact birthdate of every user on the platform.
--
-- 00026 (`get_who_liked_me`, MEXA-315) SELECTS `date_of_birth` OUT OF THIS VIEW
--
-- That file is on `mazal-restart` and is **not applied** (checked on the live ledger,
-- 2026-09-29: no `00026` row and `to_regproc('public.get_who_liked_me')` is null). Its
-- guard 0d requires the view to carry `date_of_birth` and its body returns it, so leaving
-- it alone would either break it or reopen exactly this hole through a SECURITY DEFINER
-- function granted to `authenticated`. It is changed in the same commit to select the
-- view's `age` instead, and **it now has to be applied after this file** - which is why
-- supabase/MIGRATIONS.md lists `00030` ahead of `00026` in the order. That runbook has
-- never been in numeric order (two `00003`s, two `00004`s, two `00005`s), and 00026 fails
-- loudly with "user_public_profiles has no column(s) [age]" if anyone applies it first, so
-- the worst case of getting the order wrong is a clear error and no damage.
--
-- NOT IN SCOPE
--   * `date_of_birth` on `public.users` itself. It has to stay - it is what the age is
--     computed from, it is what onboarding writes, and the table is own-row-only.
--   * The client-side `calculateAge()` helpers. They still serve the *own* profile, which
--     reads `public.users`, so they stay; only cross-user readers move to `age`.
--   * `elo_score`, still in the view - MEXA-278.

BEGIN;

-- =====================================================
-- 0. PRE-FLIGHT
-- =====================================================

DO $$
DECLARE
  v_bad TEXT;
BEGIN
  -- 0a. The object this file reshapes. If it is missing, 00013 was never applied and the
  -- app has no source for other people's profiles at all.
  IF to_regclass('public.user_public_profiles') IS NULL THEN
    RAISE EXCEPTION 'MEXA-320: public.user_public_profiles is missing - apply 00013 first';
  END IF;

  -- 0b. The base column the age is computed from.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'date_of_birth'
  ) THEN
    RAISE EXCEPTION 'MEXA-320: public.users.date_of_birth is gone - there is nothing to compute an age from';
  END IF;

  -- 0c. Every column section 1 carries over from the current view definition still exists on
  -- `public.users` under that name. The view is rewritten from scratch below rather than
  -- with CREATE OR REPLACE (which cannot drop a column), so a rename that landed since 00013
  -- would otherwise surface as a syntax-level failure halfway through the rewrite.
  SELECT string_agg(c.want, ', ' ORDER BY c.want)
    INTO v_bad
    FROM unnest(ARRAY['id','first_name','display_name','date_of_birth','gender','bio',
                      'height_cm','occupation','company','education','school',
                      'jewish_background','observance_level','keeps_shabbat','keeps_kosher',
                      'synagogue_attendance','jewish_education','looking_for',
                      'wants_children','partner_must_be_jewish','raise_children_jewish',
                      'willing_to_relocate','current_city','current_state','current_country',
                      'is_active','onboarding_complete','is_verified','is_photo_verified',
                      'is_orthodox_only','is_orthodox_user','elo_score','current_latitude',
                      'current_longitude','auth_id','created_at']) AS c(want)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public'
        AND ic.table_name = 'users'
        AND ic.column_name = c.want
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-320: public.users has no column(s) [%] - the view rewrite below reads them', v_bad;
  END IF;

  -- 0d. The helpers the view body calls, both from 00013.
  IF to_regproc('public.haversine_miles') IS NULL THEN
    RAISE EXCEPTION 'MEXA-320: public.haversine_miles() is missing - it is 00013''s and the view computes distance_miles with it';
  END IF;

  -- 0e. Apply order against 00026. If `get_who_liked_me` already exists and still declares a
  -- `date_of_birth` output, 00026 was applied from its pre-MEXA-320 bytes; dropping the
  -- column out from under it would leave a function that raises on every call.
  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'get_who_liked_me'
       AND 'date_of_birth' = ANY (p.proargnames)
  ) THEN
    RAISE EXCEPTION 'MEXA-320: public.get_who_liked_me() still returns date_of_birth - 00026 was applied from pre-MEXA-320 bytes. Run: DROP FUNCTION public.get_who_liked_me(integer, integer); then re-apply 00026 from mazal-restart after this file';
  END IF;
END
$$;

-- =====================================================
-- 1. THE AGE FUNCTION
-- =====================================================

-- One canonical definition, the same way 00013 put `haversine_miles()` in the database so
-- that the number a user sees does not depend on which client computed it. This is a
-- transcription of `calculateAge()` in src/api/queries/useDiscoveryProfiles.ts (and its four
-- copies elsewhere in the app): completed years, so somebody whose birthday is tomorrow is
-- still the younger number today. Keep the two in step.
--
-- `now() AT TIME ZONE 'UTC'` rather than `current_date`: `current_date` is evaluated in the
-- session's TimeZone, and a PostgREST connection's TimeZone is Supabase's configuration
-- rather than ours. Pinning it means two callers never disagree about somebody's age
-- because of where the pooler happened to put them.
--
-- STABLE, not IMMUTABLE: the answer changes with the clock, which is also why it cannot be
-- indexed - see THE INDEX QUESTION in the header, where that turns out to cost nothing.
--
-- A date of birth in the future returns a negative number rather than raising. Onboarding
-- refuses one (`app/(onboarding)/basics.tsx`), and a view is the wrong place to discover
-- that a row is invalid: a hard failure here would take out the whole deck for everybody.
CREATE OR REPLACE FUNCTION public.profile_age(p_date_of_birth date)
RETURNS integer
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT date_part('year', age((now() AT TIME ZONE 'UTC')::date, p_date_of_birth))::integer;
$$;

COMMENT ON FUNCTION public.profile_age(date) IS
  'MEXA-320. Age in completed years, in UTC. Mirrors calculateAge() in the app; exists so '
  'that public.user_public_profiles can publish an age instead of an exact date of birth.';

REVOKE ALL ON FUNCTION public.profile_age(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_age(date) TO authenticated, service_role;

-- =====================================================
-- 2. THE VIEW, WITHOUT date_of_birth
-- =====================================================

-- CREATE OR REPLACE VIEW can add a column at the end; it cannot remove one. So the view is
-- dropped and rebuilt. Everything below is 00013's definition verbatim except the one line
-- where `u.date_of_birth` becomes `public.profile_age(u.date_of_birth) AS age`, which is
-- deliberately in the same position so a reader can diff the two files. Nothing depends on
-- the view in the catalog (checked: no rule, view or matview references it on
-- tayiyczmacvhokdxfqvm), so the DROP is RESTRICT - no CASCADE anywhere in this file.
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

-- =====================================================
-- 3. LEDGER ROW, IN THIS TRANSACTION (MEXA-325)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00030', 'public_profiles_publish_age_not_dob')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. ASSERT THE RESULT, IN THE SAME TRANSACTION
-- =====================================================
--
-- Catalog assertions only. That a real `authenticated` caller gets an age and cannot get a
-- date of birth is proven by executing it - see the rehearsal named in
-- supabase/MIGRATIONS.md - because a view with the right column list can still be reachable
-- by the wrong role.

DO $$
DECLARE
  v_bad TEXT;
BEGIN
  -- 4a. The column is gone and the replacement is there, with the right type.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user_public_profiles'
       AND column_name = 'date_of_birth'
  ) THEN
    RAISE EXCEPTION 'MEXA-320: user_public_profiles still publishes date_of_birth';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user_public_profiles'
       AND column_name = 'age' AND data_type = 'integer'
  ) THEN
    RAISE EXCEPTION 'MEXA-320: user_public_profiles has no integer `age` column';
  END IF;

  -- 4b. Nothing else moved. Every other column 00013 published is still published, so this
  -- migration is a substitution rather than a reshape, and no screen loses a field.
  SELECT string_agg(c.want, ', ' ORDER BY c.want)
    INTO v_bad
    FROM unnest(ARRAY['id','first_name','display_name','gender','bio','height_cm',
                      'occupation','company','education','school','jewish_background',
                      'observance_level','keeps_shabbat','keeps_kosher',
                      'synagogue_attendance','jewish_education','looking_for',
                      'wants_children','partner_must_be_jewish','raise_children_jewish',
                      'willing_to_relocate','current_city','current_state','current_country',
                      'is_active','onboarding_complete','is_verified','is_photo_verified',
                      'is_orthodox_only','is_orthodox_user','elo_score','distance_miles']) AS c(want)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public'
        AND ic.table_name = 'user_public_profiles'
        AND ic.column_name = c.want
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-320: the rebuilt view lost column(s) [%]', v_bad;
  END IF;

  -- 4c. And nothing was added. A column list that only grows is how a view like this
  -- becomes the next MEXA-261.
  SELECT count(*)::text INTO v_bad
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'user_public_profiles';
  IF v_bad <> '33' THEN
    RAISE EXCEPTION 'MEXA-320: the rebuilt view has % columns, expected 33', v_bad;
  END IF;

  -- 4d. The two options 00026 asserts, and the whole reason the WHERE clause is the row rule.
  IF EXISTS (
    SELECT 1 FROM pg_class c, unnest(c.reloptions) AS t(o)
     WHERE c.oid = 'public.user_public_profiles'::regclass
       AND lower(t.o) = 'security_invoker=true'
  ) THEN
    RAISE EXCEPTION 'MEXA-320: the rebuilt view is security_invoker - its WHERE clause would no longer be the row rule';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c, unnest(c.reloptions) AS t(o)
     WHERE c.oid = 'public.user_public_profiles'::regclass
       AND lower(t.o) = 'security_barrier=true'
  ) THEN
    RAISE EXCEPTION 'MEXA-320: the rebuilt view has lost security_barrier=true';
  END IF;

  -- 4e. Owner, because security_invoker = false means the owner is who the view runs as.
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class
       WHERE oid = 'public.user_public_profiles'::regclass) <> 'postgres' THEN
    RAISE EXCEPTION 'MEXA-320: the rebuilt view is not owned by postgres';
  END IF;

  -- 4f. Grants: exactly SELECT, exactly to the two roles. This is the assertion that catches
  -- the default-privileges trap, which is live every time a view in `public` is recreated.
  SELECT string_agg(grantee || ':' || privilege_type, ', ' ORDER BY grantee, privilege_type)
    INTO v_bad
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'user_public_profiles'
     AND grantee <> 'postgres';
  IF v_bad IS DISTINCT FROM 'authenticated:SELECT, service_role:SELECT' THEN
    RAISE EXCEPTION 'MEXA-320: grants on the rebuilt view are [%], expected [authenticated:SELECT, service_role:SELECT]', v_bad;
  END IF;

  IF has_table_privilege('anon', 'public.user_public_profiles', 'SELECT') THEN
    RAISE EXCEPTION 'MEXA-320: anon can still read user_public_profiles';
  END IF;

  -- 4g. The age function: reachable by the roles that read the view, and by nobody else.
  -- PUBLIC holds EXECUTE on a function by default, so an empty proacl is the open case.
  IF (SELECT proacl FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'profile_age') IS NULL THEN
    RAISE EXCEPTION 'MEXA-320: public.profile_age() has no explicit ACL, so EXECUTE is still granted to PUBLIC';
  END IF;

  SELECT string_agg(DISTINCT a.grantee::regrole::text, ', ')
    INTO v_bad
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   CROSS JOIN LATERAL aclexplode(p.proacl) a
   WHERE n.nspname = 'public' AND p.proname = 'profile_age'
     AND a.privilege_type = 'EXECUTE'
     AND a.grantee::regrole::text NOT IN ('postgres', 'authenticated', 'service_role');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-320: public.profile_age() grants EXECUTE to [%]', v_bad;
  END IF;

  -- 4h. The ledger row this file writes, so a later reader does not have to guess.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00030') THEN
    RAISE EXCEPTION 'MEXA-320: ledger row 00030 is missing';
  END IF;
END
$$;

COMMIT;
