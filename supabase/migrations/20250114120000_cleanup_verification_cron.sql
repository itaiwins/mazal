-- Enable pg_net extension for HTTP requests (pg_cron should already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule cleanup job to run every hour
-- This calls our Edge Function to delete verification photos older than 1 hour
SELECT cron.schedule(
  'cleanup-verification-photos',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://keossekxijwygksqsxel.supabase.co/functions/v1/cleanup-verification-photos',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtlb3NzZWt4aWp3eWdrc3FzeGVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODExMDY5NCwiZXhwIjoyMDgzNjg2Njk0fQ.f2spdM29wAPqXleXAg71TXJp2ig-S_wL0wFwU3lBD-4", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
