-- Rollback for 00013_users_column_privacy.sql (MEXA-261)
--
-- Undoes the migration and puts the database back in the state the pre-migration snapshot
-- records (.scratch/mazal-mexa261/PRE_00013_SNAPSHOT.sql). Running this REOPENS the hole
-- MEXA-261 describes: every signed-in user can read every other user's email, phone,
-- coordinates and Instagram token again. Only run it if 00013 broke a client path, and say
-- on the issue that it ran.
--
-- ONE THING THIS CANNOT UNDO CLEANLY
--
-- 00013 moved `instagram_user_id` and `instagram_access_token` off `users` into
-- `user_integrations` and dropped the columns. The columns are recreated and the values
-- copied back below, but they land at the END of the column order, where they used to sit
-- at positions 48 and 49. Nothing in the app selects by position - PostgREST names every
-- column - so this matters only to something reading `select *` positionally. It also means
-- src/types/supabase.generated.ts should be regenerated after a rollback, same as after the
-- migration.
--
-- Also note: rolling back restores the token columns but any token WRITTEN while 00013 was
-- in force lives in `user_integrations`, which this script reads before dropping. Do not
-- drop `user_integrations` by hand first.

BEGIN;

-- =====================================================
-- 1. PUT THE INSTAGRAM COLUMNS BACK ON public.users
-- =====================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS instagram_user_id      text,
  ADD COLUMN IF NOT EXISTS instagram_access_token text;

UPDATE public.users u
   SET instagram_user_id      = i.instagram_user_id,
       instagram_access_token = i.instagram_access_token
  FROM public.user_integrations i
 WHERE i.user_id = u.id;

DROP TABLE IF EXISTS public.user_integrations;

-- =====================================================
-- 2. RESTORE THE CROSS-USER SELECT POLICY ON public.users
-- =====================================================
-- Verbatim from the snapshot. This is the line that made MEXA-261 a bug.

DROP POLICY IF EXISTS "Users can view other profiles" ON public.users;

CREATE POLICY "Users can view other profiles" ON public.users
  FOR SELECT TO authenticated
  USING (
    (is_active = true)
    AND (auth_id IS DISTINCT FROM auth.uid())
    AND (NOT public.has_block_between(id))
  );

-- =====================================================
-- 3. RESTORE THE user_photos POLICY
-- =====================================================
-- The correlated subquery form from 00007/00008, which works again now that step 2 lets it
-- see other users' rows.

DROP POLICY IF EXISTS "Users can view other photos" ON public.user_photos;

CREATE POLICY "Users can view other photos" ON public.user_photos
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
        FROM users u
       WHERE u.id = user_photos.user_id
         AND u.is_active = true
         AND NOT EXISTS (
               SELECT 1
                 FROM blocks
                WHERE (blocks.blocker_id = (SELECT users.id FROM users WHERE users.auth_id = auth.uid())
                       AND blocks.blocked_id = u.id)
                   OR (blocks.blocker_id = u.id
                       AND blocks.blocked_id = (SELECT users.id FROM users WHERE users.auth_id = auth.uid()))
             )
    )
  );

-- =====================================================
-- 4. DROP THE VIEW AND HELPERS
-- =====================================================

DROP VIEW IF EXISTS public.user_public_profiles;
DROP FUNCTION IF EXISTS public.haversine_miles(double precision, double precision, double precision, double precision);
DROP FUNCTION IF EXISTS public.is_discoverable_profile(uuid);

-- =====================================================
-- 5. RESTORE THE GRANTS SUPABASE SHIPPED
-- =====================================================
-- What the snapshot recorded: all seven privileges for both roles.

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;

COMMIT;

-- After running this, the app must be put back too: the queries in
-- src/api/queries/useDiscoveryProfiles.ts and src/api/queries/useMatches.ts read
-- `user_public_profiles`, which no longer exists. Revert the application commit as well, or
-- discovery and the match list return a 404 from PostgREST.
