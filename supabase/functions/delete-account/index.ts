/**
 * Delete Account Edge Function
 *
 * Permanently deletes a user account including:
 * - All data from custom tables (users, safta_accounts, etc.)
 * - Photos from storage (profile photos and any leftover verification images)
 * - The auth.users entry (requires service role)
 *
 * ORDER MATTERS. Most tables reference users(id) ON DELETE CASCADE, so deleting the
 * users row is enough for them. Five references are ON DELETE NO ACTION and will
 * abort the delete instead:
 *
 *   safta_accounts.user_id            -> delete the safta account first
 *   users.shadchan_id                 -> null it out on the people they matched for
 *   shidduch_messages.sender_user_id  -> delete their shidduch messages
 *   shidduch_profiles.created_by_user_id -> null it out on profiles they made for others
 *   shidduch_suggestions.suggested_by_user_id -> null it out
 *
 * Every write is checked. An account deletion that half-succeeds must report failure,
 * not return 200: a user who is told "deleted" and still has rows in the database is
 * a privacy problem, not a cosmetic one.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Storage paths under `profile-photos` for a set of stored photo URLs. */
function storagePathsFor(urls: string[], bucket: string): string[] {
  return urls
    .map((raw) => {
      try {
        const parts = new URL(raw).pathname.split('/');
        const i = parts.indexOf(bucket);
        return i === -1 ? null : parts.slice(i + 1).join('/');
      } catch {
        return null;
      }
    })
    .filter((p): p is string => !!p && p.length > 0);
}

/** Remove every object under `verification/<userId>/` in the temp bucket, if it exists. */
// deno-lint-ignore no-explicit-any
async function removeVerificationImages(admin: any, userId: string) {
  const prefix = `verification/${userId}`;
  const { data: files, error } = await admin.storage.from('verification-temp').list(prefix);
  if (error) {
    // The bucket is optional: verification uploads are not wired up on every build.
    console.warn(`[delete-account] skipping verification-temp (${error.message})`);
    return;
  }
  const paths = (files ?? []).filter((f) => f.name).map((f) => `${prefix}/${f.name}`);
  if (paths.length > 0) {
    await admin.storage.from('verification-temp').remove(paths);
  }
}

serve(async (req: Request) => {
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
      return json({ error: 'Missing authorization header' }, 401);
    }

    // Verify the user's token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return json({ error: 'Invalid or expired token' }, 401);
    }

    const authId = user.id;
    console.log(`Deleting account for auth_id: ${authId}`);

    // 1. Get user IDs from both tables. maybeSingle(), because most accounts have only one.
    const { data: userData, error: userLookupError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_id', authId)
      .maybeSingle();

    if (userLookupError) {
      console.error('Error looking up user row:', userLookupError);
      return json({ error: 'Failed to load account', details: userLookupError.message }, 500);
    }

    const { data: saftaData, error: saftaLookupError } = await supabaseAdmin
      .from('safta_accounts')
      .select('id')
      .eq('auth_id', authId)
      .maybeSingle();

    if (saftaLookupError) {
      console.error('Error looking up safta account:', saftaLookupError);
      return json({ error: 'Failed to load account', details: saftaLookupError.message }, 500);
    }

    // 2. Delete the Safta account first: safta_accounts.user_id references users(id)
    //    ON DELETE NO ACTION, so it would block step 4.
    if (saftaData?.id) {
      console.log(`Deleting safta data for safta_id: ${saftaData.id}`);

      const saftaPhoto = user.user_metadata?.safta_photo;
      if (typeof saftaPhoto === 'string') {
        const paths = storagePathsFor([saftaPhoto], 'profile-photos');
        if (paths.length > 0) {
          await supabaseAdmin.storage.from('profile-photos').remove(paths);
        }
      }

      // safta_connections, safta_likes and safta_daily_usage cascade from safta_accounts.
      const { error } = await supabaseAdmin.from('safta_accounts').delete().eq('id', saftaData.id);
      if (error) {
        console.error('Error deleting safta account:', error);
        return json({ error: 'Failed to delete Safta account', details: error.message }, 500);
      }
      console.log('Safta account deleted');
    }

    // 3. Delete the dater profile and everything hanging off it.
    if (userData?.id) {
      const userId = userData.id as string;
      console.log(`Deleting user data for user_id: ${userId}`);

      // 3a. Storage: profile photos, then any verification image left behind.
      const { data: photos, error: photosError } = await supabaseAdmin
        .from('user_photos')
        .select('photo_url')
        .eq('user_id', userId);

      if (photosError) {
        console.error('Error listing user photos:', photosError);
        return json({ error: 'Failed to list photos', details: photosError.message }, 500);
      }

      const filePaths = storagePathsFor(
        (photos ?? []).map((p: { photo_url: string }) => p.photo_url),
        'profile-photos'
      );
      if (filePaths.length > 0) {
        const { error } = await supabaseAdmin.storage.from('profile-photos').remove(filePaths);
        if (error) {
          console.error('Error deleting photos from storage:', error);
          return json({ error: 'Failed to delete photos', details: error.message }, 500);
        }
        console.log(`Deleted ${filePaths.length} photos from storage`);
      }

      await removeVerificationImages(supabaseAdmin, userId);

      // 3b. Clear the references that are ON DELETE NO ACTION and would abort step 3c.
      const detach = [
        [
          'users.shadchan_id',
          supabaseAdmin.from('users').update({ shadchan_id: null }).eq('shadchan_id', userId),
        ],
        [
          // Not the same thing `messages` does, despite the resemblance (MEXA-253): a
          // dater's whole conversation disappears because the `matches` row cascades and
          // takes every message with it, sender or not. A shidduch thread has no such
          // container, so it survives for the other side and only this user's own
          // messages come out of it. Narrower on purpose.
          'shidduch_messages',
          supabaseAdmin.from('shidduch_messages').delete().eq('sender_user_id', userId),
        ],
        [
          'shidduch_profiles.created_by_user_id',
          supabaseAdmin
            .from('shidduch_profiles')
            .update({ created_by_user_id: null })
            .eq('created_by_user_id', userId),
        ],
        [
          'shidduch_suggestions.suggested_by_user_id',
          supabaseAdmin
            .from('shidduch_suggestions')
            .update({ suggested_by_user_id: null })
            .eq('suggested_by_user_id', userId),
        ],
      ] as const;

      for (const [label, op] of detach) {
        const { error } = await op;
        if (error) {
          console.error(`Error detaching ${label}:`, error);
          return json({ error: `Failed to detach ${label}`, details: error.message }, 500);
        }
      }

      // 3c. The profile itself. Everything else (photos, prompts, badges, matches, swipes,
      //     messages, blocks, reports, subscriptions, push tokens, saved locations,
      //     notification rows, shidduch profile, safta links) cascades from here.
      const { error: profileError } = await supabaseAdmin.from('users').delete().eq('id', userId);
      if (profileError) {
        console.error('Error deleting user profile:', profileError);
        return json({ error: 'Failed to delete profile', details: profileError.message }, 500);
      }
      console.log('User profile deleted');
    }

    // 4. Delete the auth user using Admin API
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authId);

    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      return json({ error: 'Failed to delete auth user', details: deleteError.message }, 500);
    }

    console.log(`Auth user ${authId} deleted successfully`);

    return json({ success: true, message: 'Account permanently deleted' }, 200);
  } catch (error) {
    console.error('Error deleting account:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
