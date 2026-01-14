/**
 * Cleanup Verification Photos
 *
 * This Edge Function deletes verification photos older than 1 hour
 * from the verification-temp storage bucket.
 *
 * PRIVACY COMPLIANCE:
 * - Verification photos are only needed during the verification process
 * - Photos are deleted automatically after 1 hour for privacy
 * - This ensures GDPR/CCPA compliance for temporary biometric data
 *
 * DEPLOYMENT:
 * 1. Deploy this function: supabase functions deploy cleanup-verification-photos
 * 2. Set up a cron job in Supabase to call this every hour:
 *    - Go to Database > Extensions > Enable pg_cron
 *    - Run the SQL below to schedule the job
 *
 * CRON SETUP SQL:
 * ```sql
 * SELECT cron.schedule(
 *   'cleanup-verification-photos',
 *   '0 * * * *', -- Every hour on the hour
 *   $$
 *   SELECT net.http_post(
 *     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-verification-photos',
 *     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
 *     body := '{}'::jsonb
 *   );
 *   $$
 * );
 * ```
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate cutoff time (1 hour ago)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    console.log(`[Cleanup] Looking for files older than: ${oneHourAgo.toISOString()}`);

    // List all folders in verification-temp bucket
    const { data: folders, error: listError } = await supabase.storage
      .from('verification-temp')
      .list('verification', {
        limit: 1000,
      });

    if (listError) {
      console.error('[Cleanup] Error listing folders:', listError);
      throw listError;
    }

    console.log(`[Cleanup] Found ${folders?.length || 0} user folders`);

    let deletedCount = 0;
    const errors: string[] = [];

    // Process each user folder
    for (const folder of folders || []) {
      if (!folder.name) continue;

      const folderPath = `verification/${folder.name}`;

      // List files in this user's folder
      const { data: files, error: filesError } = await supabase.storage
        .from('verification-temp')
        .list(folderPath, {
          limit: 100,
        });

      if (filesError) {
        console.error(`[Cleanup] Error listing files in ${folderPath}:`, filesError);
        errors.push(`Error listing ${folderPath}: ${filesError.message}`);
        continue;
      }

      // Filter files older than 1 hour
      const oldFiles = (files || []).filter((file) => {
        if (!file.created_at) return false;
        const fileDate = new Date(file.created_at);
        return fileDate < oneHourAgo;
      });

      if (oldFiles.length === 0) continue;

      // Build paths for deletion
      const pathsToDelete = oldFiles.map((file) => `${folderPath}/${file.name}`);

      console.log(`[Cleanup] Deleting ${pathsToDelete.length} old files from ${folderPath}`);

      // Delete old files
      const { error: deleteError } = await supabase.storage
        .from('verification-temp')
        .remove(pathsToDelete);

      if (deleteError) {
        console.error(`[Cleanup] Error deleting files in ${folderPath}:`, deleteError);
        errors.push(`Error deleting from ${folderPath}: ${deleteError.message}`);
      } else {
        deletedCount += pathsToDelete.length;
      }
    }

    const response = {
      success: true,
      message: `Cleanup complete. Deleted ${deletedCount} old verification photos.`,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    };

    console.log('[Cleanup] Complete:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('[Cleanup] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
