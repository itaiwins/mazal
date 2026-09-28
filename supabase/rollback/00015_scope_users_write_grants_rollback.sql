-- Rollback for 00015_scope_users_write_grants.sql (MEXA-276)
--
-- Puts `public.users` back to table-wide INSERT and UPDATE for `authenticated` and drops
-- the explicit WITH CHECK from the UPDATE policy. Run this if scoping the write grants
-- turns out to break a client path that was missed.
--
-- NOT A BIT-EXACT INVERSE, in one place, on purpose:
--
--   00015 revokes INSERT and UPDATE from `anon` as well as `authenticated`. This script
--   does NOT grant them back to `anon`. There has never been a caller: the profile row is
--   written after sign-up, when the caller holds a session and is `authenticated`, and the
--   INSERT policy's `auth.uid() = auth_id` cannot be satisfied by an anonymous caller. Nor
--   should it be undone blind - 00013 (MEXA-261) revokes everything on this table from
--   `anon`, and if 00013 has been applied, restoring `anon` here would silently reopen it.
--
-- Everything else below is the exact inverse. The two column lists are the same lists, in
-- the same order, as the two GRANTs in the migration; if you edit one, edit both.

BEGIN;

-- =====================================================
-- 1. DROP THE COLUMN-LEVEL GRANTS
-- =====================================================

-- Named rather than blanket-revoked so this file and the migration can be diffed against
-- each other. Section 2's table-level GRANT would supersede these anyway.

REVOKE UPDATE (
  first_name,
  last_name,
  display_name,
  email,
  date_of_birth,
  gender,
  gender_preference,
  bio,
  occupation,
  company,
  education,
  school,
  height_cm,
  jewish_background,
  observance_level,
  keeps_shabbat,
  keeps_kosher,
  synagogue_attendance,
  jewish_education,
  looking_for,
  wants_children,
  partner_must_be_jewish,
  raise_children_jewish,
  willing_to_relocate,
  current_latitude,
  current_longitude,
  current_city,
  current_state,
  current_country,
  is_active,
  onboarding_complete,
  is_orthodox_user,
  shabbat_mode_enabled
) ON TABLE public.users FROM authenticated;

REVOKE UPDATE (is_verified) ON TABLE public.users FROM authenticated;

REVOKE INSERT (
  auth_id,
  first_name,
  last_name,
  display_name,
  email,
  date_of_birth,
  gender,
  gender_preference,
  bio,
  occupation,
  company,
  education,
  school,
  height_cm,
  jewish_background,
  observance_level,
  keeps_shabbat,
  keeps_kosher,
  synagogue_attendance,
  jewish_education,
  looking_for,
  wants_children,
  partner_must_be_jewish,
  raise_children_jewish,
  willing_to_relocate,
  current_latitude,
  current_longitude,
  current_city,
  current_state,
  current_country,
  is_active,
  onboarding_complete,
  is_orthodox_only
) ON TABLE public.users FROM authenticated;

-- =====================================================
-- 2. RESTORE THE TABLE-WIDE WRITE PRIVILEGES
-- =====================================================

-- This is the hole MEXA-276 was filed about. It is back after this line: `authenticated`
-- can write any column of its own row, including `elo_score`, `is_photo_verified`,
-- `is_premium` and `orthodox_subscription_status`.
GRANT INSERT, UPDATE ON TABLE public.users TO authenticated;

-- =====================================================
-- 3. RESTORE THE POLICY AS IT WAS
-- =====================================================

-- Back to no explicit WITH CHECK. Note this changes nothing in practice either way:
-- Postgres applies the USING expression to the new row when an UPDATE policy has no
-- WITH CHECK.
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_id);

COMMENT ON TABLE public.users IS NULL;

COMMIT;

-- THE APP-SIDE CHANGES IN THE SAME COMMIT DO NOT NEED REVERTING.
--
-- 00015 also removed four client writes (`auth_id` from the onboarding UPDATE payload,
-- `updated_at` and `location_updated_at` from src/api/mutations/useProfile.ts, and
-- `orthodox_subscription_status` from the Orthodox paywall's development stub). The first
-- three are redundant under either set of grants - BEFORE triggers on `users` set both
-- timestamps, and the PATCH already filters on auth_id - so leaving them out is correct
-- with the table-wide grant restored. The fourth was a client writing its own
-- paid-subscription state and should not come back.
