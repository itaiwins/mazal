-- Mazal - Deliver the push notifications that `notification_queue` has only ever collected
--
-- MEXA-435 item 1 (was MEXA-410). Rollback: supabase/rollback/00038_deliver_push_notifications_rollback.sql
-- Requires: 00005 (the queue), 00003 (push_tokens), pg_cron and pg_net (both installed on
-- tayiyczmacvhokdxfqvm, measured 2026-09-29: pg_cron 1.6.4, pg_net 0.20.4).
--
-- THE GAP
--
-- The four `notify_*` triggers call `send_push_notification()`, which only INSERTs into
-- `notification_queue`. Nothing ever read that table: `supabase/functions/send-notification`
-- takes an HTTP payload and never touches it. So no push Mazal "sent" was ever delivered.
--
-- WHAT THIS DOES
--
-- A pg_cron job runs every 10 seconds, entirely inside the database:
--
--   drain_notification_queue()         claims `pending` rows, posts each to Expo's push API
--                                      with pg_net, and marks it `sent` in the SAME statement
--   reconcile_notification_responses() reads pg_net's stored responses, marks a row
--                                      `failed` when Expo refused it, and deactivates tokens
--                                      Expo says are dead (DeviceNotRegistered)
--
-- No Edge Function, no new secret, no paid service: Expo's push endpoint takes unauthenticated
-- requests unless the Expo project turns on "enhanced push security", which Mazal's has not
-- (if it ever does, the token goes in Vault and into the headers below).
--
-- DELIVERY SEMANTICS: AT MOST ONCE
--
-- pg_net queues the request in a table and its background worker sends it only after the
-- calling transaction COMMITS. The row is flipped to `sent` in that same transaction. So:
--   * roll back  -> no request is queued and the row stays `pending` (retried next tick);
--   * commit     -> the row is `sent` before anything reaches Expo.
-- A row is never pushed while still `pending`, which is the property 00033 relies on: it
-- retracts a rewound super-like only `WHERE status = 'pending'`, reasoning that pending
-- means undelivered. That now holds by construction, not just by comment.
-- The price is that a push lost between commit and Expo is not retried. For "you have a new
-- match" that is the right trade; a duplicate buzz is worse than a missing one.
--
-- WHAT IS NOT SENT
--
--   * rows older than 1 hour when first seen -> `failed`, 'expired' (a backlog after an
--     outage should not arrive as a burst of stale "new message" pushes);
--   * the user turned that kind off in `notification_preferences` -> `failed`, 'muted';
--     no preferences row means everything on, which is the table's own default;
--   * the user has no active push token -> `failed`, 'no_active_token'.
-- `quiet_hours_*` is not honoured: the table has no timezone to read them in. Nothing in the
-- app writes preferences yet, so today only the token rule ever fires.

BEGIN;

-- =====================================================
-- 0. PRECONDITIONS
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'MEXA-435: pg_net is not installed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'MEXA-435: pg_cron is not installed';
  END IF;
  IF to_regclass('public.notification_queue') IS NULL OR to_regclass('public.push_tokens') IS NULL THEN
    RAISE EXCEPTION 'MEXA-435: notification_queue or push_tokens is missing - apply 00003 and 00005 first';
  END IF;
  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
    RAISE EXCEPTION 'MEXA-435: net.http_post(url, body, params, headers, timeout) is not the signature this file calls';
  END IF;
END
$$;

-- =====================================================
-- 1. WHERE A PUSH GOT TO
-- =====================================================
ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS net_request_id BIGINT,
  ADD COLUMN IF NOT EXISTS response_status INTEGER,
  ADD COLUMN IF NOT EXISTS failure TEXT;

COMMENT ON COLUMN public.notification_queue.net_request_id IS
  'pg_net request id of the Expo push (net._http_response.id). Set in the same UPDATE that marks the row sent.';
COMMENT ON COLUMN public.notification_queue.response_status IS
  'HTTP status Expo answered with, filled by reconcile_notification_responses(); 0 = no response (timeout or transport error).';
COMMENT ON COLUMN public.notification_queue.failure IS
  'Why the row is failed (expired, muted, no_active_token, http <code>, expo:<error>), or a per-device Expo error on a sent row.';

-- Sent rows whose response has not been read yet. Small by construction: reconcile empties it.
CREATE INDEX IF NOT EXISTS idx_notification_queue_awaiting_response
  ON public.notification_queue(net_request_id)
  WHERE status = 'sent' AND response_status IS NULL AND net_request_id IS NOT NULL;

-- =====================================================
-- 2. DRAIN
-- =====================================================
CREATE OR REPLACE FUNCTION public.drain_notification_queue(p_batch INTEGER DEFAULT 100)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_row RECORD;
  v_tokens TEXT[];
  v_sent INTEGER := 0;
BEGIN
  UPDATE public.notification_queue
     SET status = 'failed', failure = 'expired'
   WHERE status = 'pending'
     AND created_at < now() - INTERVAL '1 hour';

  -- SKIP LOCKED: two overlapping ticks never claim the same row.
  FOR v_row IN
    SELECT q.id, q.user_id, q.title, q.body, q.data
      FROM public.notification_queue q
     WHERE q.status = 'pending'
     ORDER BY q.created_at
     LIMIT p_batch
     FOR UPDATE SKIP LOCKED
  LOOP
    IF EXISTS (
      SELECT 1
        FROM public.notification_preferences p
       WHERE p.user_id = v_row.user_id
         AND CASE v_row.data ->> 'type'
               WHEN 'new_match'   THEN p.new_matches
               WHEN 'new_message' THEN p.messages
               WHEN 'super_like'  THEN p.super_likes
               WHEN 'safta_like'  THEN p.safta_activity
             END IS FALSE
    ) THEN
      UPDATE public.notification_queue SET status = 'failed', failure = 'muted' WHERE id = v_row.id;
      CONTINUE;
    END IF;

    SELECT array_agg(DISTINCT t.token) INTO v_tokens
      FROM public.push_tokens t
     WHERE t.user_id = v_row.user_id
       AND t.is_active IS TRUE;

    IF v_tokens IS NULL THEN
      UPDATE public.notification_queue SET status = 'failed', failure = 'no_active_token' WHERE id = v_row.id;
      CONTINUE;
    END IF;

    -- One message addressed to all of the user's devices; Expo answers with one ticket per
    -- token, in order. Queued by pg_net, sent only once this transaction commits.
    UPDATE public.notification_queue
       SET status = 'sent',
           sent_at = now(),
           net_request_id = net.http_post(
             url := 'https://exp.host/--/api/v2/push/send',
             body := jsonb_build_object(
               'to', to_jsonb(v_tokens),
               'title', v_row.title,
               'body', v_row.body,
               'data', coalesce(v_row.data, '{}'::jsonb),
               'sound', 'default'
             ),
             params := '{}'::jsonb,
             headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
             timeout_milliseconds := 10000
           )
     WHERE id = v_row.id;
    v_sent := v_sent + 1;
  END LOOP;

  RETURN v_sent;
END;
$$;

REVOKE ALL ON FUNCTION public.drain_notification_queue(INTEGER) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.drain_notification_queue(INTEGER) IS
  'MEXA-435. Pushes pending notification_queue rows to Expo via pg_net and marks them sent in the same '
  'transaction (at most once; pending always means undelivered, which 00033 relies on). Run by pg_cron.';

-- =====================================================
-- 3. RECONCILE
-- =====================================================
-- pg_net keeps responses for 6 hours by default, so anything older is given up on and left
-- as it is (`sent`, response_status NULL).
CREATE OR REPLACE FUNCTION public.reconcile_notification_responses()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_row RECORD;
  v_tickets JSONB;
  v_errors TEXT[];
  v_dead TEXT[];
  v_n INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT q.id, r.status_code, r.content, r.error_msg, r.timed_out
      FROM public.notification_queue q
      JOIN net._http_response r ON r.id = q.net_request_id
     WHERE q.status = 'sent'
       AND q.response_status IS NULL
       AND q.net_request_id IS NOT NULL
       AND q.sent_at > now() - INTERVAL '6 hours'
     FOR UPDATE OF q SKIP LOCKED
  LOOP
    v_n := v_n + 1;

    IF v_row.status_code IS DISTINCT FROM 200 THEN
      UPDATE public.notification_queue
         SET status = 'failed',
             response_status = coalesce(v_row.status_code, 0),
             failure = left(coalesce('http ' || v_row.status_code, v_row.error_msg,
                                     CASE WHEN v_row.timed_out THEN 'timed out' END, 'no response'), 500)
       WHERE id = v_row.id;
      CONTINUE;
    END IF;

    BEGIN
      v_tickets := (v_row.content::jsonb) -> 'data';
    EXCEPTION WHEN others THEN
      v_tickets := NULL;
    END;
    IF jsonb_typeof(v_tickets) = 'object' THEN
      v_tickets := jsonb_build_array(v_tickets);
    END IF;

    SELECT array_agg(DISTINCT t ->> 'message') FILTER (WHERE t ->> 'status' = 'error'),
           array_agg(DISTINCT t -> 'details' ->> 'expoPushToken')
             FILTER (WHERE t -> 'details' ->> 'error' = 'DeviceNotRegistered')
      INTO v_errors, v_dead
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_tickets) = 'array' THEN v_tickets ELSE '[]'::jsonb END) t;

    IF v_dead IS NOT NULL THEN
      UPDATE public.push_tokens SET is_active = false, updated_at = now()
       WHERE token = ANY (v_dead);
    END IF;

    -- Failed only when no device took it; a partial delivery stays `sent`, with the error noted.
    UPDATE public.notification_queue
       SET response_status = 200,
           status = CASE WHEN v_errors IS NOT NULL
                          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(
                                            CASE WHEN jsonb_typeof(v_tickets) = 'array' THEN v_tickets ELSE '[]'::jsonb END) t
                                           WHERE t ->> 'status' = 'ok')
                         THEN 'failed' ELSE 'sent' END,
           failure = CASE WHEN v_errors IS NOT NULL
                          THEN left('expo:' || array_to_string(v_errors, '; '), 500) END
     WHERE id = v_row.id;
  END LOOP;

  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_notification_responses() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.reconcile_notification_responses() IS
  'MEXA-435. Reads pg_net responses for sent pushes: non-200 or all-error tickets -> failed; '
  'DeviceNotRegistered tokens -> push_tokens.is_active = false. Run by pg_cron after the drain.';

COMMENT ON TABLE public.notification_queue IS
  'Outgoing push notifications. Written by send_push_notification() (the notify_* triggers); drained every '
  '10 s by the drain-notification-queue pg_cron job (00038). service_role only. pending = not yet handed to Expo.';

-- =====================================================
-- 4. SCHEDULE
-- =====================================================
SELECT cron.unschedule('drain-notification-queue')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-notification-queue');

SELECT cron.schedule(
  'drain-notification-queue',
  '10 seconds',
  $job$ SELECT public.reconcile_notification_responses(); SELECT public.drain_notification_queue(); $job$
);

-- =====================================================
-- 5. SELF-CHECK
-- =====================================================
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.drain_notification_queue(integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.drain_notification_queue(integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.reconcile_notification_responses()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.reconcile_notification_responses()', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-435: a client role can run the drain or the reconcile';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-notification-queue' AND schedule = '10 seconds') THEN
    RAISE EXCEPTION 'MEXA-435: drain-notification-queue is not scheduled';
  END IF;
END
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00038', 'deliver_push_notifications')
ON CONFLICT (version) DO NOTHING;

COMMIT;
