-- Hourly cleanup of identity-verification selfies.
--
-- APPLIED to project tayiyczmacvhokdxfqvm on 2026-09-28 (MEXA-249), once the
-- `cleanup-verification-photos` Edge Function was deployed.
--
-- SECRETS: the project URL and the service_role key live in Supabase Vault, never in this
-- file. They were created once, out of band:
--
--   select vault.create_secret('https://<ref>.supabase.co', 'mazal_project_url', '...');
--   select vault.create_secret('<service_role key>',        'mazal_service_role_key', '...');
--
-- Reading them back through vault.decrypted_secrets keeps the key out of git, out of
-- pg_settings, and out of the statement text an `ALTER DATABASE ... SET` would leave in a
-- log line. An earlier version of this file hardcoded the *old* project's URL and
-- service_role JWT; that key is in this repo's public history and is burned. Never put a
-- key back here.
--
-- The privacy behaviour this implements: verification selfies are deleted within the hour.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('cleanup-verification-photos')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-verification-photos');

SELECT cron.schedule(
  'cleanup-verification-photos',
  '0 * * * *',
  $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mazal_project_url')
           || '/functions/v1/cleanup-verification-photos',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mazal_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $job$
);
