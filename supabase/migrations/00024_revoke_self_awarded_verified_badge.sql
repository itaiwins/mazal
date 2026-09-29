-- Mazal - `is_verified` stops being something a user can award themselves
--
-- MEXA-359, Part A. Rollback:
-- supabase/rollback/00024_revoke_self_awarded_verified_badge_rollback.sql
--
-- WHY
--
-- `is_verified` is the identity/trust badge other users see: the swipe card
-- (SwipeableCard.tsx:340), the profile story (ProfileStory.tsx:238), the hero photo
-- (HeroPhoto.tsx:143), and the matches list (useMatches.ts:78,136). It is supposed to mean
-- a selfie was matched against a government ID at >= 90% similarity
-- (verificationService.ts:319).
--
-- `00015_scope_users_write_grants.sql` column-scoped every other server-owned column on
-- `public.users` and deliberately left this one grantable, with an instruction attached:
--
--   "It stays until photo verification moves server-side - an Edge Function that calls
--    Rekognition and writes the flag as `service_role`. Revoke this line in the same
--    migration that lands it."
--
-- That instruction lived only inside a migration comment for three weeks; no issue carried
-- it. This file is the revoke. The Edge Function is MEXA-359 Part B and is NOT a
-- prerequisite, because the premise 00015 rested on turned out to be false.
--
-- THE PREMISE 00015 RESTED ON IS FALSE: THERE IS NO WORKING VERIFICATION TO BREAK
--
-- 00015 kept the grant because "revoking the grant would break photo verification outright
-- rather than harden it". Measured on `origin/mazal-restart` @ d6600de, that is not the
-- situation. ALL LINE NUMBERS BELOW ARE AS OF d6600de, i.e. BEFORE this commit - the client
-- half of MEXA-359 Part A lands in the same commit as this file and removes most of the code
-- being cited, so `git show d6600de:<path>` is how to check these rather than the working
-- tree:
--
--   * On-device AWS Rekognition cannot run in any build. `verificationService.ts:278-279`
--     reads `env.AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, which
--     `src/lib/config/env.ts:77-78` maps from `EXPO_PUBLIC_AWS_*`. No such variable is set
--     in `.env`, in any `eas.json` profile, or in `eas env:list production` (Gojo checked,
--     MEXA-359). So `isVerificationConfigured()` is false in every build shipped or
--     shippable, including TestFlight build 2.
--
--   * With no provider configured, `verifyIdentity()` does not fail - it falls through to
--     MOCK MODE and awards the badge anyway. `verificationService.ts:422-432`:
--     `if (!isVerificationConfigured())` runs `verifyMock()`, and `verifyMock()`
--     (:389-404) returns `verified: Math.random() > 0.1`, after which
--     `updateUserVerificationStatus(userId, true)` writes this column.
--
-- So the badge is not merely forgeable by a hand-crafted PATCH. The shipped app's
-- "Verify Your Profile" button awards the real trust badge on a 90%-likely coin flip after
-- the user photographs anything at all, and a user who loses the flip taps it again.
-- Revoking this grant breaks nothing that works; it breaks a thing that was actively
-- lying. The client half of MEXA-359 Part A puts the whole entry point behind
-- `FEATURE_PHOTO_VERIFICATION`, which stays off, and removes the mock-mode write.
--
-- `is_photo_verified` NEEDS NOTHING, AND THAT IS MEASURED, NOT ASSUMED
--
-- 00015:15 names it alongside `is_verified` as a trust badge, so MEXA-359 asked whether it
-- needs the same treatment. It does not, on both halves of the test:
--
--   * No client write path. `grep -rn is_photo_verified` across `app/` and `src/` returns
--     only type declarations (`src/types/database.types.ts:64`,
--     `src/types/supabase.generated.ts`). Nothing reads it for display either.
--   * No live privilege. 00015 section 1 revoked table-wide INSERT/UPDATE and never
--     granted this column back, and on `tayiyczmacvhokdxfqvm` right now
--     `has_column_privilege('authenticated','public.users','is_photo_verified','UPDATE')`
--     is already FALSE. `authenticated` holds only SELECT on it.
--
-- The REVOKE below names it anyway. Postgres accepts revoking a privilege that is not
-- held, it is a no-op on the live project today, and it means a future migration that
-- grants this column by accident has to argue with this file's section 3 assertion rather
-- than slip past it. Said out loud so no reviewer reads that line as evidence the
-- privilege existed.
--
-- WHY THE PRE-FLIGHT CHECKS FOR A *TABLE-LEVEL* UPDATE
--
-- The one way this file can silently fail to do its job. `REVOKE UPDATE (col)` removes a
-- column-level privilege only; it does NOT cut back a table-wide `GRANT UPDATE ON TABLE`,
-- and `has_column_privilege` returns true when either one covers the column. So on a
-- database where 00015 was never applied, this file would run clean, report success, and
-- leave `is_verified` fully writable through the table-wide grant 00015 exists to remove.
-- Section 0 refuses to run in that case instead.
--
-- `anon` IS NOT NAMED
--
-- 00015 section 1 revoked INSERT and UPDATE on this table from `anon` and never granted
-- anything back, and `has_column_privilege('anon', ..., 'is_verified', 'UPDATE')` is FALSE
-- on live. A REVOKE for `anon` here would be a second no-op line with no corresponding
-- hazard to guard - unlike `is_photo_verified`, which is a column of the same trust pair
-- and is exactly the thing a future migration might grant by mistake. Section 3 asserts
-- `anon` holds nothing regardless.
--
-- ORDER
--
-- Requires 00015 (asserted in section 0, which is the only real dependency: this file
-- revokes a grant 00015 created). Independent of everything else. Note that 00012, 00016,
-- 00020 and 00023 are in the repo but are NOT applied to live - 00016 in particular is
-- entirely unapplied (filed separately) - and this file touches nothing any of them touch.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================
--
-- Deliberately not idempotent. The ledger row in section 2 is what stops a re-apply; a
-- second run should say so loudly rather than quietly re-revoking.

DO $$
DECLARE
  v_n     INTEGER;
  v_bad   TEXT;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'MEXA-359: public.users does not exist';
  END IF;

  -- The defect, as it is on live right now. If it is already gone, this file has been
  -- applied or superseded and must not run again.
  IF NOT has_column_privilege('authenticated', 'public.users', 'is_verified', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-359: authenticated already cannot UPDATE users.is_verified; 00024 looks applied';
  END IF;

  -- 00015 must be applied, or the REVOKE below is cosmetic - see the header. Two
  -- independent signals, because the ledger can lag the schema (00016 and 00020 are in the
  -- repo and reviewed but absent from both the ledger and the database).
  IF has_table_privilege('authenticated', 'public.users', 'UPDATE') THEN
    RAISE EXCEPTION
      'MEXA-359: authenticated holds a TABLE-level UPDATE on public.users, so REVOKE UPDATE (is_verified) would not take effect. Apply 00015 first.';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.users', 'first_name', 'UPDATE') THEN
    RAISE EXCEPTION
      'MEXA-359: authenticated cannot UPDATE users.first_name, so the column-scoped grants of 00015 are not in place; refusing to guess what this database is.';
  END IF;

  -- Capture the full column-privilege picture, so section 3 can prove this file moved
  -- exactly one privilege and nothing else. Ordered so the strings are comparable.
  PERFORM set_config('mexa359.privs',
    (SELECT coalesce(string_agg(format('%s:%s:%s', grantee, privilege_type, column_name),
                                ',' ORDER BY grantee, privilege_type, column_name), '')
       FROM information_schema.column_privileges
      WHERE table_schema = 'public' AND table_name = 'users'), false);
  PERFORM set_config('mexa359.tablegrants',
    (SELECT coalesce(string_agg(format('%s:%s', grantee, privilege_type),
                                ',' ORDER BY grantee, privilege_type), '')
       FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'users'), false);
  PERFORM set_config('mexa359.rows', (SELECT count(*)::text FROM public.users), false);
  PERFORM set_config('mexa359.policies',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public'), false);

  -- Nobody is wearing the badge today, so this migration strands no one. If that ever
  -- stops being true the number belongs in the apply record, because after this file the
  -- only way the column changes is `service_role`.
  SELECT count(*) INTO v_n FROM public.users WHERE is_verified IS TRUE;
  RAISE NOTICE 'MEXA-359: % users currently have is_verified = true', v_n;

  -- Guard the pair this file is about against a grant nobody noticed: if some role other
  -- than the platform's own has write access to these columns, revoking authenticated's
  -- grant closes one door and leaves another.
  SELECT string_agg(format('%s:%s:%s', grantee, privilege_type, column_name), ', ')
    INTO v_bad
    FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND table_name = 'users'
     AND column_name IN ('is_verified', 'is_photo_verified')
     AND privilege_type IN ('INSERT', 'UPDATE')
     AND grantee NOT IN ('postgres', 'service_role', 'authenticated');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-359: an unexpected role can write the verification columns: %', v_bad;
  END IF;
END
$$;

-- =====================================================
-- 1. Take the badge away from the client
-- =====================================================
--
-- After this, `is_verified` is writable by `postgres` and `service_role` only - which is
-- precisely the Edge Function in Part B, and nothing that runs on a phone.
--
-- A client that tries gets `42501: permission denied for table users`, the same answer
-- `elo_score` has given since 00015. It is a hard refusal rather than a silent drop, so a
-- stale build that still attempts the write fails visibly instead of appearing to succeed.
--
-- `is_photo_verified` is a no-op on live today; see the header for why it is named anyway.

REVOKE UPDATE (is_verified, is_photo_verified) ON TABLE public.users FROM authenticated;

-- The table comment is where 00015 recorded the carve-out, and a stale comment asserting a
-- column is "self-asserted" is worse than no comment: the next reader would trust it and
-- reason from a privilege that no longer exists.
COMMENT ON TABLE public.users IS
  'MEXA-276: INSERT and UPDATE are column-scoped for `authenticated` - see '
  'supabase/migrations/00015_scope_users_write_grants.sql for the column list and the '
  'client write path behind each one. A column with no client write path is not granted; '
  'adding a screen that writes one means adding the GRANT in the same migration. '
  'MEXA-359: `is_verified` is NO LONGER client-writable. It and `is_photo_verified` are '
  'writable only by `service_role`, so the badge other users see can only be set by a '
  'server that actually checked something. On-device photo verification is off behind '
  '`FEATURE_PHOTO_VERIFICATION` until the Rekognition Edge Function lands (MEXA-359 '
  'Part B); until then no code sets either column and no user should have one.';

-- =====================================================
-- 2. Ledger row, in this transaction (MEXA-325)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00024', 'revoke_self_awarded_verified_badge')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. Assert the result, in the same transaction
-- =====================================================
--
-- A revoke that did not take is invisible: the column keeps working, the app keeps
-- writing, and the badge keeps lying. These checks make the claims above true of what
-- actually landed. The behaviour itself - a real `authenticated` session getting 42501 on
-- `is_verified` while its ordinary profile writes still succeed - is measured as the real
-- role in `.scratch/mazal-mexa359/verify.mjs`, which a privilege catalog cannot do.

DO $$
DECLARE
  v_privs_before  TEXT    := current_setting('mexa359.privs');
  v_tabs_before   TEXT    := current_setting('mexa359.tablegrants');
  v_rows_before   INTEGER := current_setting('mexa359.rows')::INTEGER;
  v_pols_before   INTEGER := current_setting('mexa359.policies')::INTEGER;
  v_privs_after   TEXT;
  v_expected      TEXT;
  v_n             INTEGER;
  v_bad           TEXT;
BEGIN
  -- 3a. The point of the file. `has_column_privilege` is true if EITHER a column-level or a
  -- table-level grant covers the column, so false here proves no route remains.
  IF has_column_privilege('authenticated', 'public.users', 'is_verified', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-359: authenticated can still UPDATE users.is_verified';
  END IF;
  IF has_column_privilege('authenticated', 'public.users', 'is_photo_verified', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-359: authenticated can still UPDATE users.is_photo_verified';
  END IF;
  IF has_column_privilege('anon', 'public.users', 'is_verified', 'UPDATE')
     OR has_column_privilege('anon', 'public.users', 'is_photo_verified', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-359: anon can UPDATE a verification column';
  END IF;

  -- 3b. INSERT was never granted on either column and must not have appeared. Without
  -- this, a client could sidestep section 1 by carrying the badge in on the onboarding
  -- INSERT instead of a later UPDATE.
  IF has_column_privilege('authenticated', 'public.users', 'is_verified', 'INSERT')
     OR has_column_privilege('authenticated', 'public.users', 'is_photo_verified', 'INSERT') THEN
    RAISE EXCEPTION 'MEXA-359: authenticated can INSERT a verification column';
  END IF;

  -- 3c. Part B needs the write to still exist for `service_role`. If this file had taken it
  -- from everyone, the Edge Function would have nothing to write with and the badge would
  -- be permanently unreachable rather than server-owned.
  IF NOT has_column_privilege('service_role', 'public.users', 'is_verified', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-359: service_role lost UPDATE on users.is_verified; Part B could not write the badge';
  END IF;

  -- 3d. Reading the badge is untouched. Every screen that renders it does a plain SELECT,
  -- so a read privilege lost here would blank the badge app-wide and look like a UI bug.
  IF NOT has_column_privilege('authenticated', 'public.users', 'is_verified', 'SELECT') THEN
    RAISE EXCEPTION 'MEXA-359: authenticated lost SELECT on users.is_verified';
  END IF;

  -- 3e. Ordinary profile editing still works. This is the regression that would actually
  -- reach users: a REVOKE that took more than its two columns would break onboarding and
  -- profile editing for everyone, and section 3a would still pass.
  SELECT string_agg(c, ', ') INTO v_bad
    FROM unnest(ARRAY['first_name','last_name','display_name','email','date_of_birth',
                      'gender','gender_preference','bio','occupation','company','education',
                      'school','height_cm','jewish_background','observance_level',
                      'keeps_shabbat','keeps_kosher','synagogue_attendance',
                      'jewish_education','looking_for','wants_children',
                      'partner_must_be_jewish','raise_children_jewish',
                      'willing_to_relocate','current_latitude','current_longitude',
                      'current_city','current_state','current_country','is_active',
                      'onboarding_complete','is_orthodox_user','shabbat_mode_enabled']) AS c
   WHERE NOT has_column_privilege('authenticated', 'public.users', c, 'UPDATE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-359: this file removed UPDATE on columns 00015 grants: %', v_bad;
  END IF;

  -- 3f. Exactly one privilege moved, and it is the one named. Derived by subtracting the
  -- expected row from the before-picture rather than by re-listing the after-picture, so a
  -- second, unnoticed change anywhere in this table's 55 columns fails here.
  SELECT coalesce(string_agg(format('%s:%s:%s', grantee, privilege_type, column_name),
                             ',' ORDER BY grantee, privilege_type, column_name), '')
    INTO v_privs_after
    FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND table_name = 'users';

  SELECT coalesce(string_agg(format('%s:%s:%s', grantee, privilege_type, column_name),
                             ',' ORDER BY grantee, privilege_type, column_name), '')
    INTO v_expected
    FROM (
      SELECT unnest(string_to_array(v_privs_before, ',')) AS e
    ) s
    CROSS JOIN LATERAL (
      SELECT split_part(s.e, ':', 1) AS grantee,
             split_part(s.e, ':', 2) AS privilege_type,
             split_part(s.e, ':', 3) AS column_name
    ) p
   WHERE s.e <> ''
     AND NOT (p.grantee = 'authenticated' AND p.privilege_type = 'UPDATE'
              AND p.column_name = 'is_verified');

  IF v_privs_after IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'MEXA-359: column privileges on public.users are not "before minus authenticated:UPDATE:is_verified"'
      USING DETAIL = format('expected: %s%sactual:   %s', v_expected, chr(10), v_privs_after);
  END IF;

  -- 3g. No table-level grant moved, no row moved, no policy moved. This file is a REVOKE
  -- and a COMMENT; it has no business touching any of the three.
  SELECT coalesce(string_agg(format('%s:%s', grantee, privilege_type),
                             ',' ORDER BY grantee, privilege_type), '')
    INTO v_bad
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'users';
  IF v_bad IS DISTINCT FROM v_tabs_before THEN
    RAISE EXCEPTION 'MEXA-359: table-level grants on public.users changed: "%" -> "%"', v_tabs_before, v_bad;
  END IF;

  SELECT count(*) INTO v_n FROM public.users;
  IF v_n <> v_rows_before THEN
    RAISE EXCEPTION 'MEXA-359: users row count changed % -> %', v_rows_before, v_n;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'public';
  IF v_n <> v_pols_before THEN
    RAISE EXCEPTION 'MEXA-359: public policy count changed % -> %; this file writes no policy', v_pols_before, v_n;
  END IF;

  -- 3h. The comment actually says the new thing. 00015's text asserted the opposite, and a
  -- COMMENT ON that silently failed to replace it would leave the lie in place.
  IF coalesce(obj_description('public.users'::regclass, 'pg_class'), '') NOT LIKE '%NO LONGER client-writable%' THEN
    RAISE EXCEPTION 'MEXA-359: the users table comment was not updated';
  END IF;

  RAISE NOTICE 'MEXA-359: is_verified and is_photo_verified are now service_role-only; 00015''s other grants intact';
END
$$;

COMMIT;
