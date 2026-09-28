/**
 * Profile Mutation Hooks
 *
 * Create and update user profiles
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';
import type { InsertTables, UpdateTables } from '@/types/database.types';

type UserInsert = InsertTables<'users'>;
type UserUpdate = UpdateTables<'users'>;

/**
 * Hook to create a new user profile (after onboarding)
 */
export function useCreateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (profile: UserInsert) => {
      const { data, error } = await supabase
        .from('users')
        .insert(profile)
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      // Update the auth store with the new user
      setUser(data);

      // Invalidate user queries
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
    },
  });
}

/**
 * Hook to update user profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (updates: UserUpdate) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // No updated_at here: the users_updated_at BEFORE UPDATE trigger sets it
      // (00001_initial_schema.sql:377), and since 00015 the column is not in
      // `authenticated`'s UPDATE grant, so sending it would fail with 42501.
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      // Update the auth store
      setUser(data);

      // Invalidate user queries
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
    },
  });
}

/**
 * Hook to update user photos
 */
export function useUpdatePhotos() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (
      photos: Array<{
        photo_url: string;
        photo_order: number;
        is_primary: boolean;
      }>
    ) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Delete existing photos
      await supabase.from('user_photos').delete().eq('user_id', user.id);

      // Insert new photos
      if (photos.length > 0) {
        const { error } = await supabase.from('user_photos').insert(
          photos.map((p) => ({
            user_id: user.id,
            photo_url: p.photo_url,
            photo_order: p.photo_order,
            is_primary: p.is_primary,
          }))
        );

        if (error) {
          console.error('Error updating photos:', error);
          throw error;
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate user photos
      queryClient.invalidateQueries({ queryKey: queryKeys.user.photos() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() });
    },
  });
}

/**
 * Hook to update user prompts
 */
export function useUpdatePrompts() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (
      prompts: Array<{
        prompt_id: string;
        answer: string;
        display_order: number;
      }>
    ) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Delete existing prompts
      await supabase.from('user_prompts').delete().eq('user_id', user.id);

      // Insert new prompts
      if (prompts.length > 0) {
        const { error } = await supabase.from('user_prompts').insert(
          prompts.map((p) => ({
            user_id: user.id,
            prompt_id: p.prompt_id,
            answer: p.answer,
            display_order: p.display_order,
          }))
        );

        if (error) {
          console.error('Error updating prompts:', error);
          throw error;
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate user prompts
      queryClient.invalidateQueries({ queryKey: queryKeys.user.prompts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() });
    },
  });
}

/**
 * Hook to update user location
 */
export function useUpdateLocation() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (location: {
      latitude: number;
      longitude: number;
      city?: string;
      state?: string;
      country?: string;
    }) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // No location_updated_at here: the users_location_update BEFORE trigger sets it,
      // along with the PostGIS `location` point, whenever the coordinates change
      // (00001_initial_schema.sql:383-397). Since 00015 it is not in `authenticated`'s
      // UPDATE grant either.
      const { data, error } = await supabase
        .from('users')
        .update({
          current_latitude: location.latitude,
          current_longitude: location.longitude,
          current_city: location.city,
          current_state: location.state,
          current_country: location.country,
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating location:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      setUser(data);
      // Invalidate discovery queries since location affects results
      queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() });
    },
  });
}

/**
 * Hook to deactivate/delete account
 * Handles both regular user accounts and Safta accounts
 * For permanent deletion, uses Edge Function to delete auth user
 */
export function useDeactivateAccount() {
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: async (permanent: boolean = false) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('User not authenticated');
      }

      if (permanent) {
        // Permanent deletion - call Edge Function which handles everything
        // including deleting from auth.users (requires service role)
        const { data, error } = await supabase.functions.invoke('delete-account', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) {
          console.error('Delete account error:', error);
          throw new Error(error.message || 'Failed to delete account');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to delete account');
        }

        return { success: true };
      } else {
        // Temporary deactivation - just mark as inactive
        const authId = session.user.id;

        // Deactivate regular user account
        await supabase
          .from('users')
          .update({ is_active: false })
          .eq('auth_id', authId);

        // Deactivate Safta account if exists
        await supabase
          .from('safta_accounts')
          .update({ is_active: false })
          .eq('auth_id', authId);

        await supabase.auth.signOut();
        return { success: true };
      }
    },
    onSuccess: () => {
      logout();
    },
  });
}
