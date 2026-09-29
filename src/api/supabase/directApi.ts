/**
 * Direct Supabase REST API Client
 *
 * Bypasses the Supabase JS client for database operations
 * which can hang due to Promise resolution issues.
 * Uses fetch() directly for reliable, timeout-able requests.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Storage key for auth token
const AUTH_TOKEN_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

/**
 * Get the current auth token from storage with timeout
 */
async function getAuthToken(timeoutMs: number = 5000): Promise<string | null> {
  try {
    // Wrap AsyncStorage call with its own timeout - it can hang sometimes
    const tokenData = await Promise.race([
      AsyncStorage.getItem(AUTH_TOKEN_KEY),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('AsyncStorage.getItem timed out')), timeoutMs)
      ),
    ]);

    if (!tokenData) return null;

    const parsed = JSON.parse(tokenData);
    return parsed?.access_token || null;
  } catch (e: any) {
    console.error('[DirectAPI] Error getting auth token:', e.message);
    return null;
  }
}

/**
 * Make a direct REST API call to Supabase
 */
async function fetchSupabase<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
    timeout?: number;
  } = {}
): Promise<{ data: T | null; error: any }> {
  const { method = 'GET', body, headers = {}, timeout = 30000 } = options;

  console.log(`[DirectAPI] ${method} ${endpoint} - getting auth token...`);
  const authToken = await getAuthToken(5000);
  console.log(`[DirectAPI] ${method} ${endpoint} - auth token: ${authToken ? 'present' : 'none'}`);
  // No session means no request. This used to fall back to the anon key as the Bearer,
  // which ran the call as `anon` - a role that holds no table privileges since 00016 -
  // and surfaced as an RLS/permission error instead of "you are signed out" (MEXA-299).
  if (!authToken) {
    return { data: null, error: { code: 'NOT_SIGNED_IN', message: 'Not signed in' } };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`[DirectAPI] ${method} ${endpoint} - TIMEOUT triggered after ${timeout}ms`);
    controller.abort();
  }, timeout);

  try {
    console.log(`[DirectAPI] ${method} ${endpoint} - making fetch request...`);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log(`[DirectAPI] ${method} ${endpoint} - response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error('[DirectAPI] Request failed:', response.status, errorData);
      return { data: null, error: errorData };
    }

    // Handle empty response
    const text = await response.text();
    if (!text) {
      console.log(`[DirectAPI] ${method} ${endpoint} - empty response (success)`);
      return { data: null, error: null };
    }

    const data = JSON.parse(text);
    console.log(`[DirectAPI] ${method} ${endpoint} - success`);
    return { data, error: null };
  } catch (e: any) {
    clearTimeout(timeoutId);

    if (e.name === 'AbortError') {
      console.error(`[DirectAPI] ${method} ${endpoint} - Request timed out after ${timeout}ms`);
      return { data: null, error: { message: 'Request timed out', code: 'TIMEOUT' } };
    }

    console.error(`[DirectAPI] ${method} ${endpoint} - Request error:`, e.message);
    return { data: null, error: { message: e.message } };
  }
}

/**
 * Check if a user exists by auth_id
 */
export async function checkUserExists(authId: string): Promise<{ exists: boolean; userId?: string; error?: any }> {
  console.log('[DirectAPI] Checking if user exists:', authId);

  const { data, error } = await fetchSupabase<any[]>(
    `users?auth_id=eq.${authId}&select=id`,
    { method: 'GET', timeout: 15000 }
  );

  if (error) {
    console.error('[DirectAPI] Check user error:', error);
    return { exists: false, error };
  }

  const exists = Array.isArray(data) && data.length > 0;
  console.log('[DirectAPI] User exists:', exists, data?.[0]?.id);

  return { exists, userId: data?.[0]?.id };
}

/**
 * Insert a new user profile
 */
export async function insertUser(profileData: any): Promise<{ data: any; error: any }> {
  console.log('[DirectAPI] Inserting user:', profileData.auth_id);

  const { data, error } = await fetchSupabase<any[]>(
    'users',
    {
      method: 'POST',
      body: profileData,
      headers: { 'Prefer': 'return=representation' },
      timeout: 30000,
    }
  );

  if (error) {
    console.error('[DirectAPI] Insert user error:', error);
    return { data: null, error };
  }

  // PostgREST returns an array for inserts
  const user = Array.isArray(data) ? data[0] : data;
  console.log('[DirectAPI] User inserted:', user?.id);

  return { data: user, error: null };
}

/**
 * Update an existing user profile
 */
export async function updateUser(authId: string, profileData: any): Promise<{ data: any; error: any }> {
  console.log('[DirectAPI] Updating user:', authId);

  const { data, error } = await fetchSupabase<any[]>(
    `users?auth_id=eq.${authId}`,
    {
      method: 'PATCH',
      body: profileData,
      headers: { 'Prefer': 'return=representation' },
      timeout: 30000,
    }
  );

  if (error) {
    console.error('[DirectAPI] Update user error:', error);
    return { data: null, error };
  }

  const user = Array.isArray(data) ? data[0] : data;
  console.log('[DirectAPI] User updated:', user?.id);

  return { data: user, error: null };
}

/**
 * Delete photos for a user
 */
export async function deleteUserPhotos(userId: string): Promise<{ error: any }> {
  console.log('[DirectAPI] Deleting photos for user:', userId);

  const { error } = await fetchSupabase(
    `user_photos?user_id=eq.${userId}`,
    { method: 'DELETE', timeout: 15000 }
  );

  if (error) {
    console.error('[DirectAPI] Delete photos error:', error);
  }

  return { error };
}

/**
 * Insert photos for a user
 */
export async function insertUserPhotos(photos: any[]): Promise<{ error: any }> {
  console.log('[DirectAPI] Inserting photos:', photos.length);

  const { error } = await fetchSupabase(
    'user_photos',
    {
      method: 'POST',
      body: photos,
      timeout: 30000,
    }
  );

  if (error) {
    console.error('[DirectAPI] Insert photos error:', error);
  } else {
    console.log('[DirectAPI] Photos inserted successfully');
  }

  return { error };
}

/**
 * Delete prompts for a user
 */
export async function deleteUserPrompts(userId: string): Promise<{ error: any }> {
  console.log('[DirectAPI] Deleting prompts for user:', userId);

  const { error } = await fetchSupabase(
    `user_prompts?user_id=eq.${userId}`,
    { method: 'DELETE', timeout: 15000 }
  );

  if (error) {
    console.error('[DirectAPI] Delete prompts error:', error);
  }

  return { error };
}

/**
 * Insert prompts for a user
 */
export async function insertUserPrompts(prompts: any[]): Promise<{ error: any }> {
  console.log('[DirectAPI] Inserting prompts:', prompts.length);

  const { error } = await fetchSupabase(
    'user_prompts',
    {
      method: 'POST',
      body: prompts,
      timeout: 30000,
    }
  );

  if (error) {
    console.error('[DirectAPI] Insert prompts error:', error);
  } else {
    console.log('[DirectAPI] Prompts inserted successfully');
  }

  return { error };
}

/**
 * Update auth user metadata via direct REST API
 * This bypasses the Supabase JS client which can hang
 */
export async function updateAuthUserMetadata(
  metadata: Record<string, any>
): Promise<{ data: any; error: any }> {
  console.log('[DirectAPI] Updating auth user metadata...');

  const authToken = await getAuthToken();
  if (!authToken) {
    return { data: null, error: { message: 'No auth token found' } };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: metadata,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error('[DirectAPI] Auth update failed:', response.status, errorData);
      return { data: null, error: errorData };
    }

    const data = await response.json();
    console.log('[DirectAPI] Auth user metadata updated successfully');
    return { data, error: null };
  } catch (e: any) {
    clearTimeout(timeoutId);

    if (e.name === 'AbortError') {
      console.error('[DirectAPI] Auth update timed out');
      return { data: null, error: { message: 'Request timed out', code: 'TIMEOUT' } };
    }

    console.error('[DirectAPI] Auth update error:', e.message);
    return { data: null, error: { message: e.message } };
  }
}

/**
 * Upsert a shidduch profile
 */
export async function upsertShidduchProfile(profileData: any): Promise<{ data: any; error: any }> {
  console.log('[DirectAPI] Upserting shidduch profile for user:', profileData.user_id);

  // For upsert, we need to use the Prefer header with resolution
  const { data, error } = await fetchSupabase<any[]>(
    'shidduch_profiles',
    {
      method: 'POST',
      body: profileData,
      headers: {
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      timeout: 30000,
    }
  );

  if (error) {
    console.error('[DirectAPI] Upsert shidduch profile error:', error);
    return { data: null, error };
  }

  const profile = Array.isArray(data) ? data[0] : data;
  console.log('[DirectAPI] Shidduch profile upserted:', profile?.id);

  return { data: profile, error: null };
}

/**
 * Insert shidduch references
 */
export async function insertShidduchReferences(references: any[]): Promise<{ error: any }> {
  console.log('[DirectAPI] Inserting shidduch references:', references.length);

  const { error } = await fetchSupabase(
    'shidduch_references',
    {
      method: 'POST',
      body: references,
      timeout: 30000,
    }
  );

  if (error) {
    console.error('[DirectAPI] Insert shidduch references error:', error);
  } else {
    console.log('[DirectAPI] Shidduch references inserted successfully');
  }

  return { error };
}

/**
 * Get current auth user via direct REST API
 */
export async function getAuthUser(): Promise<{ data: any; error: any }> {
  console.log('[DirectAPI] Getting auth user...');

  const authToken = await getAuthToken();
  if (!authToken) {
    return { data: null, error: { message: 'No auth token found' } };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authToken}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error('[DirectAPI] Get auth user failed:', response.status, errorData);
      return { data: null, error: errorData };
    }

    const data = await response.json();
    console.log('[DirectAPI] Got auth user:', data?.id);
    return { data, error: null };
  } catch (e: any) {
    clearTimeout(timeoutId);

    if (e.name === 'AbortError') {
      console.error('[DirectAPI] Get auth user timed out');
      return { data: null, error: { message: 'Request timed out', code: 'TIMEOUT' } };
    }

    console.error('[DirectAPI] Get auth user error:', e.message);
    return { data: null, error: { message: e.message } };
  }
}

/**
 * Upload a file to Supabase Storage using direct REST API
 * Bypasses the hanging Supabase JS client
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  base64Data: string,
  contentType: string,
  timeout: number = 60000
): Promise<{ data: { path: string } | null; error: any }> {
  console.log(`[DirectAPI] Storage upload: ${bucket}/${path}`);

  const authToken = await getAuthToken(5000);
  // Same rule as fetchSupabase: never upload as `anon` (MEXA-299).
  if (!authToken) {
    return { data: null, error: { code: 'NOT_SIGNED_IN', message: 'Not signed in' } };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`[DirectAPI] Storage upload TIMEOUT after ${timeout}ms`);
    controller.abort();
  }, timeout);

  try {
    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`[DirectAPI] Storage upload: sending ${bytes.length} bytes...`);

    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: bytes,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log(`[DirectAPI] Storage upload response: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error('[DirectAPI] Storage upload failed:', response.status, errorData);
      return { data: null, error: errorData };
    }

    console.log(`[DirectAPI] Storage upload success: ${path}`);
    return { data: { path }, error: null };
  } catch (e: any) {
    clearTimeout(timeoutId);

    if (e.name === 'AbortError') {
      console.error(`[DirectAPI] Storage upload timed out after ${timeout}ms`);
      return { data: null, error: { message: 'Upload timed out', code: 'TIMEOUT' } };
    }

    console.error('[DirectAPI] Storage upload error:', e.message);
    return { data: null, error: { message: e.message } };
  }
}

/**
 * Get the public URL for a file in Supabase Storage
 */
export function getStoragePublicUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
