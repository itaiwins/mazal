-- ROLLBACK for 00038_deliver_push_notifications.sql  (MEXA-435 item 1)
--
-- Stops delivery and removes what 00038 added. Afterwards the queue collects rows again
-- and nothing sends them, which is the pre-00038 state.
--
-- Restores, measured on tayiyczmacvhokdxfqvm before 00038 (2026-09-29):
--   notification_queue columns   id, user_id, title, body, data, status, created_at, sent_at
--   cron.job                     only cleanup-verification-photos
--   COMMENT ON TABLE             00016's text if 00016 is applied, otherwise none. 00016 was
--                                unapplied when 00038 was written, so this sets it to NULL;
--                                re-run 00016's COMMENT statement if 00016 has landed since.
--
-- Rows already `sent` keep that status: they were handed to Expo, and flipping them back to
-- `pending` would make 00033's retraction delete a delivered notification.

BEGIN;

SELECT cron.unschedule('drain-notification-queue')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-notification-queue');

DROP FUNCTION IF EXISTS public.drain_notification_queue(INTEGER);
DROP FUNCTION IF EXISTS public.reconcile_notification_responses();

DROP INDEX IF EXISTS public.idx_notification_queue_awaiting_response;

ALTER TABLE public.notification_queue
  DROP COLUMN IF EXISTS net_request_id,
  DROP COLUMN IF EXISTS response_status,
  DROP COLUMN IF EXISTS failure;

COMMENT ON TABLE public.notification_queue IS NULL;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00038';

COMMIT;
