/**
 * User Profile Query Hook
 *
 * Fetches the current user's complete profile with photos, prompts, and badges
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types/user.types';
import type { UserPhoto, UserPrompt, UserBadge } from '@/types/database.types';

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Fetch current user's complete profile
 */
async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  // Fetch user with related data in parallel
  const [userResult, photosResult, promptsResult, badgesResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase
      .from('user_photos')
      .select('*')
      .eq('user_id', userId)
      .order('photo_order', { ascending: true }),
    supabase
      .from('user_prompts')
      .select('*')
      .eq('user_id', userId)
      .order('display_order', { ascending: true }),
    supabase.from('user_badges').select('*').eq('user_id', userId),
  ]);

  if (userResult.error) {
    console.error('Error fetching user:', userResult.error);
    throw userResult.error;
  }

  if (!userResult.data) {
    return null;
  }

  const user = userResult.data;
  const photos: UserPhoto[] = photosResult.data || [];
  const prompts: UserPrompt[] = promptsResult.data || [];
  const badges: UserBadge[] = badgesResult.data || [];

  return {
    ...user,
    photos,
    prompts,
    badges,
    age: calculateAge(user.date_of_birth),
  };
}

/**
 * Hook to get current user's profile
 */
export function useUserProfile() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return fetchUserProfile(user.id);
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get another user's profile by ID
 */
export function useProfileById(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.discovery.profile(userId || ''),
    queryFn: () => {
      if (!userId) {
        throw new Error('User ID required');
      }
      return fetchUserProfile(userId);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
