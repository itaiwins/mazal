-- Rollback for 00012_deleted_accounts_retention.sql (MEXA-258, item 4).
--
-- Unschedules the daily sweep and drops the function. `deleted_accounts` and the
-- reports are left exactly as they are - this file removes the thing that deletes
-- rows, it does not delete rows itself.
--
-- Rows the sweep already purged are gone and this cannot bring them back. If you are
-- rolling back because the horizons were wrong, roll back first, then restore from the
-- point-in-time backup, then fix the constants in 00012 and re-apply.

SELECT cron.unschedule('deleted-accounts-retention')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deleted-accounts-retention');

DROP FUNCTION IF EXISTS public.purge_expired_deleted_accounts();

-- MEXA-434: 00012 now writes a ledger row; take it back out.
DELETE FROM supabase_migrations.schema_migrations WHERE version = '00012';
