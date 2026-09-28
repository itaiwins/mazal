/**
 * Supabase Client Configuration
 *
 * Configures the Supabase client with proper auth persistence
 * for React Native using expo-secure-store
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@/types/database.types';

// Environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not found. Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.'
  );
}

/**
 * Custom storage adapter using AsyncStorage
 * AsyncStorage can handle larger values (unlike SecureStore's 2048 byte limit)
 * This is needed because Supabase session tokens can exceed SecureStore's limit
 */
const AsyncStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const value = await AsyncStorage.getItem(key);
      console.log('[Supabase Storage] getItem:', key, value ? `(${value.length} chars)` : 'null');
      return value;
    } catch (error) {
      console.error('[Supabase Storage] getItem error:', key, error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      console.log('[Supabase Storage] setItem:', key, `(${value.length} chars)`);
      await AsyncStorage.setItem(key, value);
      console.log('[Supabase Storage] setItem SUCCESS:', key);
    } catch (error) {
      console.error('[Supabase Storage] setItem error:', key, error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      console.log('[Supabase Storage] removeItem:', key);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('[Supabase Storage] removeItem error:', key, error);
    }
  },
};

/**
 * Supabase Client
 *
 * Type-safe client with React Native optimizations
 */
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage: AsyncStorageAdapter,
      // PKCE, not supabase-js's implicit default (MEXA-264). Both reasons come
      // from `mazal://` being a custom scheme nobody owns: implicit puts a real
      // access and refresh token in the deep-link fragment, where any app that
      // also claims `mazal://` can read them; and an implicit link works on
      // whatever device opens it, so a link forwarded to someone else signs
      // *them* in. Under PKCE the link carries only a `?code=`, which is
      // worthless without the `code_verifier` this client keeps in the storage
      // above, on the device that started the flow. See
      // src/lib/auth/authDeepLink.ts and docs/AUTH_DEEP_LINKS.md.
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Not needed for mobile
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Debug: Track signOut calls
const originalSignOut = supabase.auth.signOut.bind(supabase.auth);
(supabase.auth as any).signOut = async (options?: any) => {
  console.log('[Supabase Auth] signOut called!');
  console.trace('[Supabase Auth] signOut stack trace');
  return originalSignOut(options);
};

/**
 * Helper to get current user session
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return data.session;
}

/**
 * Helper to get current user
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return data.user;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: any) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}

// Export types
export type SupabaseClient = typeof supabase;
