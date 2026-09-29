-- Rollback for 00029_reentry_restore_and_hold.sql (MEXA-258).
--
-- DO THIS FIRST IF THE HOOK IS ENABLED. Dropping the function while
-- `hook_before_user_created_enabled` still points at it is the one way this change can
-- take signup down: GoTrue would call a function that no longer exists. Turn the hook off
-- in the auth config, confirm it, and only then run this file.
--
--   PATCH /v1/projects/<ref>/config/auth
--     {"hook_before_user_created_enabled": false, "hook_before_user_created_uri": null}
--
-- WHAT THIS DOES NOT UNDO. The blocks that were re-applied to a returning account stay.
-- They are ordinary rows in `blocks` now, indistinguishable from a block the person made
-- by hand, and there is no safe way to tell them apart after the fact - the
-- `account_reentry_events` row that recorded them is dropped by this file. If you need to
-- undo the restorations too, read `blocks_restored` out of `account_reentry_events`
-- BEFORE running this, or restore from the backup taken before the apply.
--
-- Nothing here deletes a tombstone or a report: this file removes what 00029 added, not
-- the moderation history 00011 exists to keep.

-- 1. Stop restoring and stop refusing.
DROP TRIGGER IF EXISTS users_restore_on_reentry ON public.users;
DROP FUNCTION IF EXISTS public.restore_on_reentry();
DROP FUNCTION IF EXISTS public.before_user_created_hook(JSONB);

-- 2. Put `record_deleted_account()` back to its 00011 form - tombstone only, no blocker
--    snapshot. Body copied from 00011 as amended by MEXA-262; the only difference from
--    00029's version is that the second INSERT and v_tombstone_id are gone.
CREATE OR REPLACE FUNCTION public.record_deleted_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total INTEGER;
  v_open INTEGER;
  v_email TEXT;
  v_phone TEXT;
  v_source TEXT := 'auth';
BEGIN
  SELECT pg_catalog.count(*),
         pg_catalog.count(*) FILTER (WHERE status IN ('pending', 'reviewed'))
    INTO v_total, v_open
    FROM public.reports
   WHERE reported_id = OLD.id;

  IF v_total = 0 THEN
    RETURN OLD;
  END IF;

  SELECT email, phone INTO v_email, v_phone FROM auth.users WHERE id = OLD.auth_id;

  IF NOT FOUND THEN
    v_email := OLD.email;
    v_phone := OLD.phone;
    v_source := 'profile';
  END IF;

  INSERT INTO public.deleted_accounts (
    user_id, auth_id, email_hash, phone_hash, identifier_source, display_name,
    account_created_at, reports_against_count, open_reports_against_count
  )
  VALUES (
    OLD.id,
    OLD.auth_id,
    public.hash_account_identifier(v_email),
    public.hash_account_identifier(v_phone),
    v_source,
    OLD.display_name,
    OLD.created_at,
    v_total,
    v_open
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.record_deleted_account() FROM PUBLIC, anon, authenticated;

-- 3. The two tables. Dropped last, because step 2 has to stop writing to the first one.
DROP TABLE IF EXISTS public.account_reentry_events;
DROP TABLE IF EXISTS public.deleted_account_blockers;
