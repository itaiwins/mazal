-- Rollback for 00011_preserve_moderation_history.sql (MEXA-256).
--
-- Restores the schema exactly as 00001_initial_schema.sql left it: both report
-- columns back to `REFERENCES users(id) ON DELETE CASCADE`, and every object 00011
-- added removed.
--
-- READ THIS BEFORE RUNNING IT. Re-adding the CASCADE is re-opening the bug: from then
-- on, deleting a user again wipes the reports against them. Only run this to get out
-- of a bad deploy, and re-apply 00011 afterwards.
--
-- DESTRUCTIVE. It drops `deleted_accounts`, which is the only copy of the moderation
-- tombstones, and `moderation_secrets`, without which existing hashes can never be
-- matched again. Dump both first if the database has been live:
--
--   select * from public.deleted_accounts;
--   select * from public.moderation_secrets;
--
-- It also re-adds the foreign keys, which fails with 23503 if any surviving report
-- already points at a deleted user - exactly the rows 00011 exists to keep. Clean
-- those out first (and lose them) or do not roll back.

BEGIN;

DROP TRIGGER IF EXISTS reports_check_participants ON public.reports;
DROP FUNCTION IF EXISTS public.reports_check_participants();

DROP TRIGGER IF EXISTS users_record_deletion ON public.users;
DROP FUNCTION IF EXISTS public.record_deleted_account();

DROP INDEX IF EXISTS public.idx_reports_reported;
DROP INDEX IF EXISTS public.idx_reports_reporter;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_reported_id_fkey
  FOREIGN KEY (reported_id) REFERENCES public.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.reports.reported_id IS NULL;
COMMENT ON COLUMN public.reports.reporter_id IS NULL;

DROP TABLE IF EXISTS public.deleted_accounts;
DROP FUNCTION IF EXISTS public.hash_account_identifier(TEXT);
DROP TABLE IF EXISTS public.moderation_secrets;

COMMIT;
