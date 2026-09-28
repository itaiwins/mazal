-- Mazal - Column-scope what a signed-in user may write to their own `users` row
--
-- MEXA-276. Rollback: supabase/rollback/00015_scope_users_write_grants_rollback.sql
--
-- WHY
--
-- `authenticated` held table-wide INSERT and UPDATE on `public.users`, and the UPDATE
-- policy checked only *which row*:
--
--   "Users can update own profile" [UPDATE] USING (auth.uid() = auth_id)
--
-- Which row, never which column. So `PATCH /rest/v1/users?id=eq.<self>` could set any of
-- the 55 columns of the caller's own row, including the ones the server is supposed to
-- own: `elo_score` (the discovery ranking - set it to 9999 and you are top of everyone's
-- deck), `is_verified` and `is_photo_verified` (trust badges rendered to other users at
-- SwipeableCard.tsx:340 and ProfileStory.tsx:238), `response_rate`,
-- `avg_response_time_hours`, `is_premium` and `orthodox_subscription_status`.
--
-- RLS cannot fix this. A policy is a row predicate; column privileges are the only
-- mechanism Postgres has here. 00013 did the same job for reads.
--
-- A column-level UPDATE/INSERT grant is safe in a way a column-level SELECT grant is not:
-- `select('*')` keeps working untouched, because nothing about SELECT changes here.
--
-- THE COLUMN LIST
--
-- Derived from every client write path to `public.users`, not from the column list. Two
-- routes reach the table and both were walked:
--
--   * supabase-js `.from('users').update(...)` / `.insert(...)`
--   * `src/api/supabase/directApi.ts` - `insertUser()` (POST /users) and `updateUser()`
--     (PATCH /users?auth_id=eq.<id>), raw PostgREST. This one does not match a
--     `.from('users')` grep and is what the real onboarding uses; `useCreateProfile()` in
--     src/api/mutations/useProfile.ts is exported but has no caller.
--
-- No function in `public` writes `users` at all (checked against tayiyczmacvhokdxfqvm:
-- zero rows from pg_proc where the body matches insert/update/delete on users), so no RPC
-- depends on the caller's grants and nothing had to move to SECURITY DEFINER.
--
-- UPDATE, column by column, with the write path that justifies it:
--
--   first_name              app/(orthodox-onboarding)/basics.tsx:80,
--                           app/(onboarding)/complete.tsx:284,
--                           app/(shidduch-onboarding)/complete.tsx:138
--   last_name               app/(orthodox-onboarding)/basics.tsx:81,
--                           app/(shidduch-onboarding)/complete.tsx:139
--   display_name            app/(onboarding)/complete.tsx:285
--   email                   app/(onboarding)/complete.tsx:283  (profile contact column;
--                           it is not the auth identity, which lives in auth.users)
--   date_of_birth           app/(orthodox-onboarding)/basics.tsx:83,
--                           app/(onboarding)/complete.tsx:286,
--                           app/(shidduch-onboarding)/complete.tsx:140
--   gender                  app/(orthodox-onboarding)/basics.tsx:82,
--                           app/(onboarding)/complete.tsx:287,
--                           app/(shidduch-onboarding)/complete.tsx:141
--   gender_preference       app/(onboarding)/complete.tsx:288
--   bio                     app/profile/edit.tsx:229 (via useUpdateProfile),
--                           app/(onboarding)/complete.tsx:310
--   occupation              app/profile/edit.tsx:230, app/(onboarding)/complete.tsx:302
--   company                 app/profile/edit.tsx:231, app/(onboarding)/complete.tsx:303
--   education               app/profile/edit.tsx:232, app/(onboarding)/complete.tsx:300
--   school                  app/(onboarding)/complete.tsx:301
--   height_cm               app/(onboarding)/complete.tsx:304
--   jewish_background       app/(orthodox-onboarding)/background.tsx:64,
--                           app/(onboarding)/complete.tsx:289
--   observance_level        app/(onboarding)/complete.tsx:290
--   keeps_shabbat           app/(onboarding)/complete.tsx:291
--   keeps_kosher            app/(onboarding)/complete.tsx:292
--   synagogue_attendance    app/(onboarding)/complete.tsx:293
--   jewish_education        app/(onboarding)/complete.tsx:294
--   looking_for             app/(onboarding)/complete.tsx:305
--   wants_children          app/(onboarding)/complete.tsx:306
--   partner_must_be_jewish  app/(onboarding)/complete.tsx:307
--   raise_children_jewish   app/(onboarding)/complete.tsx:308
--   willing_to_relocate     app/(onboarding)/complete.tsx:309
--   current_latitude        app/settings/location.tsx:94,
--                           src/api/mutations/useProfile.ts:210,
--                           app/(onboarding)/complete.tsx:295
--   current_longitude       app/settings/location.tsx:95,
--                           src/api/mutations/useProfile.ts:211,
--                           app/(onboarding)/complete.tsx:296
--   current_city            app/settings/location.tsx:93,
--                           src/api/mutations/useProfile.ts:212,
--                           app/(onboarding)/complete.tsx:297,
--                           app/(shidduch-onboarding)/complete.tsx:142
--   current_state           src/api/mutations/useProfile.ts:213,
--                           app/(onboarding)/complete.tsx:298,
--                           app/(shidduch-onboarding)/complete.tsx:143
--   current_country         src/api/mutations/useProfile.ts:214,
--                           app/(onboarding)/complete.tsx:299,
--                           app/(shidduch-onboarding)/complete.tsx:144
--   is_active               src/api/mutations/useProfile.ts:281 - useDeactivateAccount(),
--                           the "Deactivate account" (non-permanent) path in settings;
--                           and set true at app/(onboarding)/complete.tsx:312 and
--                           app/(orthodox-onboarding)/complete.tsx:65
--   onboarding_complete     app/(onboarding)/complete.tsx:311,
--                           app/(orthodox-onboarding)/complete.tsx:64 - the screen that
--                           ends onboarding
--   is_orthodox_user        app/(orthodox-auth)/register.tsx:151 and :225,
--                           app/(orthodox-auth)/login.tsx:199,
--                           app/(orthodox-auth)/paywall.tsx:110. A UI mode flag, not an
--                           entitlement - `orthodox_subscription_status` is the
--                           entitlement and it is NOT granted (see below)
--   shabbat_mode_enabled    app/(orthodox-tabs)/profile.tsx:111
--   is_verified             src/api/services/verificationService.ts:492 - see below
--
-- INSERT is the UPDATE list plus `auth_id` and `is_orthodox_only`, minus the three
-- columns nothing ever inserts (`is_verified`, `is_orthodox_user`,
-- `shabbat_mode_enabled`). Both inserters are listed on the GRANT itself.
--
-- `is_verified` IS STILL CLIENT-WRITABLE, DELIBERATELY
--
-- Gojo's call on this issue (option 3b). AWS Rekognition runs *on the device* and
-- `updateUserVerificationStatus()` (src/api/services/verificationService.ts:484-504) then
-- writes the flag, so the badge other users see is self-asserted today and revoking the
-- grant would break photo verification outright rather than harden it. The real fix is an
-- Edge Function that calls Rekognition and writes the flag as `service_role`; that is its
-- own issue and blocks the wider beta, not internal TestFlight. The grant below says so
-- again, next to the column.
--
-- WHAT IS NO LONGER WRITABLE, AND WHAT THAT BREAKS
--
-- Nothing on this list keeps a live write path after this migration, but four client
-- writes had to be removed from the app in the same commit or they would start returning
-- 42501. Each one was writing a column it has no business writing:
--
--   auth_id                       app/(onboarding)/complete.tsx built one `profileData`
--                                 and sent it to both insertUser() and updateUser(), so
--                                 the UPDATE path re-sent `auth_id` (line 282). Removed
--                                 from the update payload; still sent on INSERT, where
--                                 the policy's WITH CHECK (auth.uid() = auth_id) requires
--                                 it.
--   updated_at                    src/api/mutations/useProfile.ts:66. The
--                                 `users_updated_at` BEFORE UPDATE trigger
--                                 (00001_initial_schema.sql:377) already sets it. Removed.
--   location_updated_at           src/api/mutations/useProfile.ts:215. The
--                                 `users_location_update` BEFORE trigger
--                                 (00001_initial_schema.sql:388) already sets it, and
--                                 `location` with it. Removed.
--   orthodox_subscription_status  app/(orthodox-auth)/paywall.tsx:109. That screen has no
--                                 payment in it - the header comment says "For
--                                 development, simulate subscription" and lists the four
--                                 things production would do. It was letting a client
--                                 write its own paid-subscription state. Removed; the
--                                 screen still flips the local UI store, so the dev flow
--                                 is unchanged, and "Restore purchases" now correctly
--                                 finds nothing until a server writes the column.
--
-- A BEFORE trigger's assignments to NEW are not privilege-checked - only the columns
-- named in the statement's SET/column list are - so `location`, `location_updated_at` and
-- `updated_at` still get written on every update without being granted.
--
-- Never had a client write path, confirmed by grep across app/ and src/ (matches are
-- src/lib/demo/demoProfiles.ts, which never touches the database, and local component
-- state): `elo_score`, `response_rate`, `avg_response_time_hours`, `is_premium`,
-- `is_photo_verified`, `shadchan_id` (the only write is to `shadchan_connections`,
-- app/(orthodox-tabs)/shadchan.tsx:132), `show_instagram_friends`, `shabbat_mode_start`,
-- `shabbat_mode_end`, `shabbat_timezone`, `phone`, `id`, `created_at`.
--
-- `phone`, `shabbat_mode_start`, `shabbat_mode_end`, `shabbat_timezone` and
-- `show_instagram_friends` are ordinary user settings with no UI today. They are left out
-- because the rule here is "grant what is used"; whoever builds those screens adds a
-- one-line GRANT in the same migration as the screen.
--
-- THE WITH CHECK
--
-- Added explicitly. It is NOT a behaviour change on its own: for an UPDATE policy with no
-- WITH CHECK, Postgres uses the USING expression as the check on the new row, so
-- `auth.uid() = auth_id` was already being applied to the post-update row and a user could
-- not already re-point their row at someone else. Writing it out makes the rule legible
-- rather than implied. What actually stops `auth_id` and `id` being rewritten is that
-- neither is in the UPDATE grant below.
--
-- ORDER
--
-- Independent of 00013 and 00014. It names no column 00013 drops
-- (`instagram_user_id`, `instagram_access_token` are not in any list here), and 00014's
-- schema-wide REVOKE of TRUNCATE/TRIGGER/REFERENCES/MAINTAIN does not touch INSERT or
-- UPDATE. Either order works.

BEGIN;

-- =====================================================
-- 1. TAKE BACK THE TABLE-WIDE WRITE PRIVILEGES
-- =====================================================

-- Revoking a table-level privilege also revokes the matching column-level privileges, so
-- this is the clean slate section 2 grants onto.
--
-- `anon` is included for the same reason 00013 revokes everything from it: the profile row
-- is written after sign-up, when the caller holds a session and is `authenticated`, and
-- the INSERT policy's `auth.uid() = auth_id` can never be satisfied by an anonymous
-- caller anyway. Harmless to repeat if 00013 has already run.
REVOKE INSERT, UPDATE ON TABLE public.users FROM anon, authenticated;

-- =====================================================
-- 2. GRANT BACK, COLUMN BY COLUMN
-- =====================================================

-- Profile columns a user edits: onboarding (app/(onboarding)/complete.tsx,
-- app/(orthodox-onboarding)/basics.tsx and background.tsx,
-- app/(shidduch-onboarding)/complete.tsx), profile editing (app/profile/edit.tsx via
-- useUpdateProfile), and location (app/settings/location.tsx,
-- src/api/mutations/useProfile.ts useUpdateLocation).
GRANT UPDATE (
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
) ON TABLE public.users TO authenticated;

-- SELF-ASSERTED, ON PURPOSE (MEXA-276, Gojo's decision 3).
--
-- `is_verified` is the trust badge other users see on the discovery card. It is written by
-- the client, by updateUserVerificationStatus() in
-- src/api/services/verificationService.ts:492, after AWS Rekognition has run on the
-- device. Nothing server-side checks it. A user can therefore grant themselves the badge,
-- and this grant is what lets them.
--
-- It stays until photo verification moves server-side - an Edge Function that calls
-- Rekognition and writes the flag as `service_role`. Revoke this line in the same
-- migration that lands it. Do not treat the badge as evidence of anything before then.
GRANT UPDATE (is_verified) ON TABLE public.users TO authenticated;

-- Profile creation. insertUser() in src/api/supabase/directApi.ts:142, called from
-- app/(onboarding)/complete.tsx:338 (and the retry at :349) and
-- app/(shidduch-onboarding)/complete.tsx:109.
--
-- `auth_id` is here and deliberately not in the UPDATE grant: the INSERT policy's
-- WITH CHECK (auth.uid() = auth_id) requires the client to supply it, and after the row
-- exists nothing may move it.
GRANT INSERT (
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
) ON TABLE public.users TO authenticated;

-- =====================================================
-- 3. SAY THE ROW RULE OUT LOUD
-- =====================================================

-- Left `TO public` rather than `TO authenticated`, as it was: after section 1 `anon` holds
-- no UPDATE privilege on any column of this table, so the role list adds nothing either
-- way, and re-scoping a policy this migration is not otherwise changing is churn a
-- reviewer has to check.
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

COMMENT ON TABLE public.users IS
  'MEXA-276: INSERT and UPDATE are column-scoped for `authenticated` - see '
  'supabase/migrations/00015_scope_users_write_grants.sql for the column list and the '
  'client write path behind each one. A column with no client write path is not granted; '
  'adding a screen that writes one means adding the GRANT in the same migration. '
  '`is_verified` is granted and is self-asserted until photo verification moves '
  'server-side.';

COMMIT;
