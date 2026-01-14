/**
 * Delete Account Edge Function
 *
 * Permanently deletes a user account including:
 * - All data from custom tables (users, safta_accounts, etc.)
 * - Photos from storage
 * - The auth.users entry (requires service role)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the user's JWT from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user's token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authId = user.id;
    console.log(`Deleting account for auth_id: ${authId}`);

    // 1. Get user IDs from both tables
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_id', authId)
      .single();

    const { data: saftaData } = await supabaseAdmin
      .from('safta_accounts')
      .select('id')
      .eq('auth_id', authId)
      .single();

    // 2. Delete user's related data if user exists
    if (userData?.id) {
      console.log(`Deleting user data for user_id: ${userData.id}`);

      // Delete user photos from storage
      const { data: photos } = await supabaseAdmin
        .from('user_photos')
        .select('photo_url')
        .eq('user_id', userData.id);

      if (photos && photos.length > 0) {
        const filePaths = photos
          .map((p: { photo_url: string }) => {
            try {
              const url = new URL(p.photo_url);
              const pathParts = url.pathname.split('/');
              const bucketIndex = pathParts.indexOf('profile-photos');
              if (bucketIndex !== -1) {
                return pathParts.slice(bucketIndex + 1).join('/');
              }
            } catch {
              return null;
            }
            return null;
          })
          .filter(Boolean) as string[];

        if (filePaths.length > 0) {
          await supabaseAdmin.storage.from('profile-photos').remove(filePaths);
          console.log(`Deleted ${filePaths.length} photos from storage`);
        }
      }

      // Delete user photos records
      await supabaseAdmin.from('user_photos').delete().eq('user_id', userData.id);

      // Delete user prompts
      await supabaseAdmin.from('user_prompts').delete().eq('user_id', userData.id);

      // Delete user badges
      await supabaseAdmin.from('user_badges').delete().eq('user_id', userData.id);

      // Delete user's matches (both sides)
      await supabaseAdmin.from('matches').delete().eq('user1_id', userData.id);
      await supabaseAdmin.from('matches').delete().eq('user2_id', userData.id);

      // Delete user's swipes
      await supabaseAdmin.from('swipes').delete().eq('swiper_id', userData.id);
      await supabaseAdmin.from('swipes').delete().eq('swiped_id', userData.id);

      // Delete safta connections where user is connected
      await supabaseAdmin.from('safta_connections').delete().eq('connected_user_id', userData.id);

      // Delete safta likes related to this user
      await supabaseAdmin.from('safta_likes').delete().eq('for_user_id', userData.id);
      await supabaseAdmin.from('safta_likes').delete().eq('liked_user_id', userData.id);

      // Delete push tokens
      await supabaseAdmin.from('push_tokens').delete().eq('user_id', userData.id);

      // Delete user profile
      await supabaseAdmin.from('users').delete().eq('id', userData.id);
      console.log('User profile deleted');
    }

    // 3. Delete Safta account and related data if exists
    if (saftaData?.id) {
      console.log(`Deleting safta data for safta_id: ${saftaData.id}`);

      // Delete safta photos from storage
      const saftaPhoto = user.user_metadata?.safta_photo;
      if (saftaPhoto) {
        try {
          const url = new URL(saftaPhoto);
          const pathParts = url.pathname.split('/');
          const bucketIndex = pathParts.indexOf('profile-photos');
          if (bucketIndex !== -1) {
            const filePath = pathParts.slice(bucketIndex + 1).join('/');
            await supabaseAdmin.storage.from('profile-photos').remove([filePath]);
          }
        } catch {
          // Ignore storage deletion errors
        }
      }

      // Delete safta connections
      await supabaseAdmin.from('safta_connections').delete().eq('safta_account_id', saftaData.id);

      // Delete safta likes
      await supabaseAdmin.from('safta_likes').delete().eq('safta_account_id', saftaData.id);

      // Delete safta account
      await supabaseAdmin.from('safta_accounts').delete().eq('id', saftaData.id);
      console.log('Safta account deleted');
    }

    // 4. Delete the auth user using Admin API
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authId);

    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete auth user', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Auth user ${authId} deleted successfully`);

    return new Response(
      JSON.stringify({ success: true, message: 'Account permanently deleted' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting account:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
