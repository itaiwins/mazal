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
 * 2. Schedule it hourly with the SQL in
 *    supabase/migrations/20250114120000_cleanup_verification_cron.sql. That SQL reads the
 *    project URL and the service_role key from Supabase Vault, so no key is ever written
 *    into a migration, into pg_settings or into a log line. Never paste a key into the
 *    cron body.
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
      // A missing bucket is not a failure: verification uploads are not wired up on
      // every build, and an hourly job that 500s forever is noise, not a signal.
      if (/not found/i.test(listError.message)) {
        console.warn('[Cleanup] verification-temp bucket does not exist; nothing to do');
        return new Response(
          JSON.stringify({
            success: true,
            message: 'verification-temp bucket does not exist; nothing to clean up.',
            deletedCount: 0,
            timestamp: new Date().toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
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
