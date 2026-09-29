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

// The local `calculateAge()` is gone with MEXA-320: the deck's ages now arrive as
// `user_public_profiles.age`, computed by `public.profile_age()`. The view no longer
// publishes a date of birth for anybody but you, so there is nothing here to compute from.
// The helper survives in the screens that read the *signed-in* user's own row out of
// `public.users` - src/api/queries/useUserProfile.ts and the profile tabs.

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
  // The deck comes ranked from the server (MEXA-435, migration 00039): `get_discovery_deck`
  // drops people you already swiped and applies every filter below FIRST, ranks (people who
  // liked you, then elo_score), and only then takes 50. It used to be "any 50 rows of
  // `user_public_profiles`, then filter and sort here", which gave a heavy swiper a short or
  // empty deck and needed the view to publish `elo_score` to every client. It returns rows
  // of the same view, so nothing here can see a column the view does not publish.
  //
  // The age filter is on `age`, not on `date_of_birth` (MEXA-320), inclusive at both ends.
  // Distance is compared on the rounded miles the card shows; no location on either side
  // does not hide anyone, which is what this file did before.
  const { data: users, error } = await supabase.rpc('get_discovery_deck', {
    p_age_min: filters.age_min,
    p_age_max: filters.age_max,
    p_distance_max_miles: filters.distance_max_miles,
    p_genders: filters.gender_preference,
    p_backgrounds: filters.jewish_backgrounds ?? [],
    p_limit: 50,
  });

  if (error) {
    console.error('Error fetching discovery profiles:', error);
    throw error;
  }

  if (!users || users.length === 0) {
    return [];
  }

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

  // Fetch photos, prompts, and badges for the deck in parallel
  const userIds = users.map((u) => u.id);

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
  // Kept in the server's order: the rank lives there now, and rewindDeckPosition.ts needs
  // the same order on every fetch.
  return users.map((user): DiscoveryUser => {
      // Computed by the view (public.profile_age), for the same reason distance_miles is:
      // the client no longer receives the input it was derived from (MEXA-320).
      const age = user.age;

      // Computed by the view now (public.haversine_miles, the same 3959-mile formula this
      // file used to run on downloaded coordinates), so the numbers are unchanged. Null
      // when either side has no location, which is the old `undefined`.
      const distance =
        user.distance_miles === null ? undefined : Math.round(user.distance_miles);

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
