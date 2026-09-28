/**
 * Discovery Profiles Query Hook
 *
 * Fetches profiles for the discovery/swiping screen with smart filtering
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { useDiscoveryStore } from '@/stores/discoveryStore';
import { useUIStore } from '@/stores/uiStore';
import { DEMO_PROFILES } from '@/lib/demo/demoProfiles';
import { FEATURE_SAFTA_MODE } from '@/lib/config/features';
import type { DiscoveryUser } from '@/types/user.types';
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

// Using DiscoveryFilters from @/types instead of local interface

/**
 * Fetch discovery profiles with filtering
 */
async function fetchDiscoveryProfiles(
  userId: string,
  filters: {
    age_min: number;
    age_max: number;
    distance_max_miles: number;
    gender_preference: string[];
    jewish_backgrounds?: string[];
  }
): Promise<DiscoveryUser[]> {
  // Calculate date range for age filter
  const today = new Date();
  const maxBirthDate = new Date(
    today.getFullYear() - filters.age_min,
    today.getMonth(),
    today.getDate()
  );
  const minBirthDate = new Date(
    today.getFullYear() - filters.age_max - 1,
    today.getMonth(),
    today.getDate()
  );

  // Fetch users who haven't been swiped and match basic criteria.
  //
  // `user_public_profiles`, not `users`: since 00013 (MEXA-261) the table only ever returns
  // the signed-in user's own row, and the view is what publishes other people. It also
  // excludes the caller and inactive users itself and hands back a precomputed
  // `distance_miles` instead of coordinates. The filters below are kept anyway, so the
  // deck is still correct if the view's own rules are ever loosened.
  let query = supabase
    .from('user_public_profiles')
    .select('*')
    .neq('id', userId)
    .eq('is_active', true)
    .eq('onboarding_complete', true)
    .gte('date_of_birth', minBirthDate.toISOString().split('T')[0])
    .lte('date_of_birth', maxBirthDate.toISOString().split('T')[0]);

  // Add gender filter if specified
  if (filters.gender_preference.length > 0) {
    query = query.in('gender', filters.gender_preference);
  }

  // Add Jewish background filter if specified
  if (filters.jewish_backgrounds && filters.jewish_backgrounds.length > 0) {
    query = query.in('jewish_background', filters.jewish_backgrounds);
  }

  // Limit results for performance
  query = query.limit(50);

  const { data: users, error } = await query;

  if (error) {
    console.error('Error fetching discovery profiles:', error);
    throw error;
  }

  if (!users || users.length === 0) {
    return [];
  }

  // Get already swiped users
  const { data: swipes } = await supabase
    .from('swipes')
    .select('swiped_id')
    .eq('swiper_id', userId);

  const swipedIds = new Set((swipes || []).map((s) => s.swiped_id));

  // Get users who have liked current user
  const { data: incomingLikes } = await supabase
    .from('swipes')
    .select('swiper_id')
    .eq('swiped_id', userId)
    .in('action', ['like', 'super_like']);

  const likedByIds = new Set((incomingLikes || []).map((s) => s.swiper_id));

  // Get safta approved counts for all users (users who have been liked by a safta for
  // current user). Skipped while parents/grandparents mode is hidden (docs/ROADMAP.md),
  // so the hidden feature never influences the ranking a user sees.
  const { data: saftaLikes } = FEATURE_SAFTA_MODE
    ? await supabase
        .from('safta_likes')
        .select('liked_user_id')
        .eq('for_user_id', userId)
    : { data: null };

  // Count how many saftas have approved each user
  const saftaApprovedCounts: Record<string, number> = {};
  (saftaLikes || []).forEach((like) => {
    saftaApprovedCounts[like.liked_user_id] = (saftaApprovedCounts[like.liked_user_id] || 0) + 1;
  });

  // Filter out already swiped users
  const availableUsers = users.filter((u) => !swipedIds.has(u.id));

  // Fetch photos, prompts, and badges for available users in parallel
  const userIds = availableUsers.map((u) => u.id);

  const [photosResult, promptsResult, badgesResult] = await Promise.all([
    supabase
      .from('user_photos')
      .select('*')
      .in('user_id', userIds)
      .order('photo_order', { ascending: true }),
    supabase
      .from('user_prompts')
      .select('*')
      .in('user_id', userIds)
      .order('display_order', { ascending: true }),
    supabase.from('user_badges').select('*').in('user_id', userIds),
  ]);

  // Group photos, prompts, badges by user
  const photosByUser: Record<string, UserPhoto[]> = {};
  const promptsByUser: Record<string, UserPrompt[]> = {};
  const badgesByUser: Record<string, UserBadge[]> = {};

  (photosResult.data || []).forEach((p) => {
    if (!photosByUser[p.user_id]) photosByUser[p.user_id] = [];
    photosByUser[p.user_id].push(p);
  });

  (promptsResult.data || []).forEach((p) => {
    if (!promptsByUser[p.user_id]) promptsByUser[p.user_id] = [];
    promptsByUser[p.user_id].push(p);
  });

  (badgesResult.data || []).forEach((b) => {
    if (!badgesByUser[b.user_id]) badgesByUser[b.user_id] = [];
    badgesByUser[b.user_id].push(b);
  });

  // Build discovery profiles
  const profiles: DiscoveryUser[] = availableUsers
    .map((user) => {
      const age = calculateAge(user.date_of_birth);

      // Computed by the view now (public.haversine_miles, the same 3959-mile formula this
      // file used to run on downloaded coordinates), so the numbers are unchanged. Null
      // when either side has no location, which is the old `undefined`.
      const distance =
        user.distance_miles === null ? undefined : Math.round(user.distance_miles);

      // Filter by distance if specified
      if (
        filters.distance_max_miles > 0 &&
        distance !== undefined &&
        distance > filters.distance_max_miles
      ) {
        return null;
      }

      // Calculate simple compatibility score based on matching criteria
      let compatibilityScore = 50; // Base score

      // Boost for same Jewish background
      if (user.jewish_background && filters.jewish_backgrounds?.includes(user.jewish_background)) {
        compatibilityScore += 15;
      }

      // Boost for being within ideal age range (middle of range)
      const idealAge = (filters.age_min + filters.age_max) / 2;
      const ageDiff = Math.abs(age - idealAge);
      if (ageDiff <= 2) compatibilityScore += 15;
      else if (ageDiff <= 5) compatibilityScore += 10;
      else if (ageDiff <= 8) compatibilityScore += 5;

      // Boost for proximity
      if (distance !== undefined) {
        if (distance <= 10) compatibilityScore += 15;
        else if (distance <= 25) compatibilityScore += 10;
        else if (distance <= 50) compatibilityScore += 5;
      }

      // Boost if safta approved
      const saftaCount = saftaApprovedCounts[user.id] || 0;
      if (saftaCount > 0) compatibilityScore += Math.min(saftaCount * 5, 15);

      // Cap at 100
      compatibilityScore = Math.min(compatibilityScore, 100);

      return {
        ...user,
        photos: photosByUser[user.id] || [],
        prompts: promptsByUser[user.id] || [],
        badges: badgesByUser[user.id] || [],
        age,
        distance,
        compatibility_score: compatibilityScore,
        has_liked_me: likedByIds.has(user.id),
        safta_approved_count: saftaCount,
      };
    })
    .filter((p) => p !== null) as DiscoveryUser[];

  // Sort: Users who liked you first, then by ELO score
  return profiles.sort((a, b) => {
    if (a.has_liked_me && !b.has_liked_me) return -1;
    if (!a.has_liked_me && b.has_liked_me) return 1;
    return (b.elo_score ?? 0) - (a.elo_score ?? 0);
  });
}

/**
 * Hook to get discovery profiles for swiping
 */
export function useDiscoveryProfiles() {
  const user = useAuthStore((s) => s.user);
  const filters = useDiscoveryStore((s) => s.filters);
  const isDemoMode = useUIStore((s) => s.isDemoMode);

  return useQuery({
    queryKey: isDemoMode
      ? ['demo', 'profiles']
      : queryKeys.discovery.profiles(filters as unknown as Record<string, unknown>),
    queryFn: () => {
      // Return demo profiles when demo mode is enabled
      if (isDemoMode) {
        return Promise.resolve(DEMO_PROFILES);
      }

      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      // No coordinates passed in any more: the view knows where the caller is and returns
      // distances, so this side never handles a latitude/longitude pair.
      return fetchDiscoveryProfiles(user.id, {
        age_min: filters.age_min,
        age_max: filters.age_max,
        distance_max_miles: filters.distance_max_miles,
        gender_preference: filters.gender_preference,
        jewish_backgrounds: filters.jewish_backgrounds,
      });
    },
    enabled: isDemoMode || !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnMount: true,
  });
}
