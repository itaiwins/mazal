-- Mazal - Retention for the moderation tombstones
--
-- MEXA-258, item 4. Requires 00011_preserve_moderation_history.sql.
-- Rollback: supabase/rollback/00012_deleted_accounts_retention_rollback.sql
--
-- WHY
--
-- 00011 started writing a `public.deleted_accounts` row whenever someone with a report
-- against them deletes their account. It never deletes one. A row that says "this
-- address belonged to somebody who was reported" is exactly the kind of record that
-- should not sit in a database forever - the person asked to be deleted, and the only
-- reason we kept anything is the open complaint. Once the complaint is resolved and
-- enough time has passed, the reason is gone and so should the row be.
--
-- THE RULE
--
-- A tombstone is purged when ALL of these hold:
--   * `moderation_hold` is false. A hold is a human saying "keep this"; a sweep must
--     never overrule it. (MEXA-258 decides what a hold does at signup; whatever the
--     answer, it means keep.)
--   * No report about the account is still `pending` or `reviewed`. Something is
--     waiting on a moderator, so the record is still in use.
--   * The account was deleted longer ago than the horizon below.
--
-- Two horizons, because the two populations are not the same:
--   * UNSUBSTANTIATED (every report about them ended `dismissed`): 12 months. This is
--     where a person who got one false report ends up. Being reported once and
--     cleared should not follow anyone around.
--   * SUBSTANTIATED (at least one report ended `action_taken`): 24 months. A moderator
--     looked and agreed. Keeping that longer is the point of the table.
--
-- The reports about the purged account go with it, in the same transaction. Leaving
-- them behind would produce a report row whose `reported_id` matches no `users` row
-- and no tombstone - unreadable by anyone, and still personal data. Reports *filed by*
-- the purged account about someone who still exists are kept: those are moderation
-- history about a live user, and MEXA-256 is the whole reason they now survive.
--
-- NOT AN EDGE FUNCTION, unlike 20250114120000_cleanup_verification_cron.sql. That one
-- has to call out over HTTP because it deletes objects from Storage. This is a DELETE
-- against two tables in the same database, so pg_cron runs the SQL directly: no
-- service_role key in flight, no pg_net, nothing to deploy alongside it.

DO $$
BEGIN
  IF to_regclass('public.deleted_accounts') IS NULL THEN
    RAISE EXCEPTION 'run 00011_preserve_moderation_history.sql first';
  END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- 1. THE SWEEP
-- =====================================================

CREATE OR REPLACE FUNCTION public.purge_expired_deleted_accounts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Change these and the next run picks them up; there is no other copy of the numbers.
  c_dismissed_months CONSTANT INTEGER := 12;
  c_actioned_months  CONSTANT INTEGER := 24;
  v_purged INTEGER;
BEGIN
  WITH expired AS (
    SELECT da.user_id
      FROM public.deleted_accounts da
     WHERE NOT da.moderation_hold
       -- Nothing about this account is waiting on a moderator.
       AND NOT EXISTS (
             SELECT 1 FROM public.reports r
              WHERE r.reported_id = da.user_id
                AND r.status IN ('pending', 'reviewed')
           )
       AND da.deleted_at < NOW() - (
             CASE WHEN EXISTS (
                    SELECT 1 FROM public.reports r
                     WHERE r.reported_id = da.user_id
                       AND r.status = 'action_taken'
                  )
                  THEN c_actioned_months
                  ELSE c_dismissed_months
             END * INTERVAL '1 month'
           )
  ),
  purged_reports AS (
    DELETE FROM public.reports r
     USING expired e
     WHERE r.reported_id = e.user_id
    RETURNING r.id
  )
  DELETE FROM public.deleted_accounts da
   USING expired e
   WHERE da.user_id = e.user_id;

  GET DIAGNOSTICS v_purged = ROW_COUNT;
  RETURN v_purged;
END;
$$;

-- Same lockdown as everything else that touches this table: the cron job runs as the
-- table owner, service_role can run it by hand, nobody else can reach it. An
-- `authenticated` caller with EXECUTE could use the return value to probe whether a
-- given account is still on file.
REVOKE ALL ON FUNCTION public.purge_expired_deleted_accounts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_deleted_accounts() TO service_role;

COMMENT ON FUNCTION public.purge_expired_deleted_accounts() IS
  'MEXA-258. Deletes moderation tombstones (and the reports about them) once no hold and no open '
  'report remain: 12 months if every report was dismissed, 24 if one ended action_taken. '
  'Scheduled daily as deleted-accounts-retention.';

-- =====================================================
-- 2. THE SCHEDULE
-- =====================================================

-- Daily, off the hour so it does not land with the hourly verification-photo sweep.
SELECT cron.unschedule('deleted-accounts-retention')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deleted-accounts-retention');

SELECT cron.schedule(
  'deleted-accounts-retention',
  '17 3 * * *',
  $job$ SELECT public.purge_expired_deleted_accounts(); $job$
);
