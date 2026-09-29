/**
 * Matches Query Hook
 *
 * Fetches the current user's matches with preview info
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { getDemoConversations } from '@/lib/demo/demoProfiles';
import type { Match, UserPhoto, Message } from '@/types/database.types';

/**
 * Match with user preview and last message
 */
export interface MatchWithPreview {
  id: string;
  userId: string;
  firstName: string;
  displayName: string;
  primaryPhotoUrl: string | null;
  isVerified: boolean;
  matchedAt: string;
  lastMessage: {
    content: string | null;
    senderId: string;
    createdAt: string;
    isRead: boolean | null;
  } | null;
  unreadCount: number;
}

// The local `calculateAge()` is gone with MEXA-320: `user_public_profiles` publishes an
// `age` computed by `public.profile_age()` and no longer publishes anybody else's date of
// birth, so there is nothing left here to compute from.

/**
 * Fetch user's matches with preview information
 */
async function fetchMatches(userId: string): Promise<MatchWithPreview[]> {
  // Get all active matches where user is either user1 or user2
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching matches:', error);
    throw error;
  }

  if (!matches || matches.length === 0) {
    return [];
  }

  // Get the other user's ID for each match
  const otherUserIds = matches.map((m) =>
    m.user1_id === userId ? m.user2_id : m.user1_id
  );

  // Fetch other users' info. From the view, not `users`: that table is own-row-only since
  // 00013 (MEXA-261), so this query would return nothing against it.
  const { data: users } = await supabase
    .from('user_public_profiles')
    // No age here: the matches list renders a name, a photo and a verification tick, and
    // nothing on it has ever drawn one. This used to ask for `date_of_birth` and drop it on
    // the floor (MEXA-320).
    .select('id, first_name, display_name, is_verified')
    .in('id', otherUserIds);

  // Fetch primary photos for other users
  const { data: photos } = await supabase
    .from('user_photos')
    .select('user_id, photo_url')
    .in('user_id', otherUserIds)
    .eq('is_primary', true);

  // Fetch last message and unread count for each match
  const matchIds = matches.map((m) => m.id);

  // Get last messages
  const { data: lastMessages } = await supabase
    .from('messages')
    .select('match_id, content, sender_id, created_at, is_read')
    .in('match_id', matchIds)
    .order('created_at', { ascending: false });

  // Get unread counts
  const { data: unreadCounts } = await supabase
    .from('messages')
    .select('match_id')
    .in('match_id', matchIds)
    .neq('sender_id', userId)
    .eq('is_read', false);

  // Build maps for quick lookup
  const usersMap = new Map(users?.map((u) => [u.id, u]) || []);
  const photosMap = new Map(photos?.map((p) => [p.user_id, p.photo_url]) || []);

  // Group last messages by match (already sorted by created_at desc)
  const lastMessageByMatch = new Map<string, Message>();
  (lastMessages || []).forEach((m) => {
    if (!lastMessageByMatch.has(m.match_id)) {
      lastMessageByMatch.set(m.match_id, m as Message);
    }
  });

  // Count unreads per match
  const unreadByMatch = new Map<string, number>();
  (unreadCounts || []).forEach((m) => {
    unreadByMatch.set(m.match_id, (unreadByMatch.get(m.match_id) || 0) + 1);
  });

  // Build result
  const result: MatchWithPreview[] = matches.map((match) => {
    const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;
    const otherUser = usersMap.get(otherUserId);
    const lastMsg = lastMessageByMatch.get(match.id);

    return {
      id: match.id,
      userId: otherUserId,
      firstName: otherUser?.first_name || 'Unknown',
      displayName: otherUser?.display_name || 'Unknown',
      primaryPhotoUrl: photosMap.get(otherUserId) || null,
      isVerified: otherUser?.is_verified || false,
      matchedAt: match.created_at,
      lastMessage: lastMsg
        ? {
            content: lastMsg.content,
            senderId: lastMsg.sender_id,
            createdAt: lastMsg.created_at,
            isRead: lastMsg.is_read,
          }
        : null,
      unreadCount: unreadByMatch.get(match.id) || 0,
    };
  });

  // Sort by last message time (most recent first), then by match time
  return result.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt || a.matchedAt;
    const bTime = b.lastMessage?.createdAt || b.matchedAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

/**
 * Hook to get all matches for current user
 */
export function useMatches() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: queryKeys.matches.list(),
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return fetchMatches(user.id);
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30, // 30 seconds - matches update frequently
  });
}

/**
 * How many matches have at least one unread message — the number the tab-bar badge shows.
 *
 * Derived from the same query the Matches screen renders from, so the badge and the screen
 * cannot disagree. `matchStore.unreadMatchesCount` used to feed the badge, but nothing ever
 * called `setMatches`, so it was pinned at 0 forever (MEXA-336).
 *
 * In demo mode the Matches screen substitutes `getDemoConversations()`, which carries no
 * unread messages, so the badge is 0 there too.
 */
export function useUnreadMatchesCount(): number {
  const isDemoMode = useUIStore((s) => s.isDemoMode);
  const { data } = useMatches();

  if (isDemoMode) {
    return 0;
  }

  return data?.filter((m) => m.unreadCount > 0).length ?? 0;
}

/**
 * How many matches there are — the number the Profile tab's "Matches" stat shows.
 *
 * Same query as the Matches screen and as the tab-bar badge, for the same reason: right
 * after a first match the three surfaces read "1", "0 Matches" and "0" (MEXA-338, finding
 * 10). The badge was fixed on MEXA-336; this was the remaining one, and it was not a stale
 * store but a literal `matches_count: 0` in `app/(tabs)/profile.tsx`.
 *
 * Demo mode counts `getDemoConversations()`, which is what the Matches screen substitutes
 * there, so the two agree in demo mode too — the stat used to be a hardcoded 12 against a
 * demo list of 2.
 */
export function useMatchesCount(): number {
  const isDemoMode = useUIStore((s) => s.isDemoMode);
  const { data } = useMatches();

  if (isDemoMode) {
    return getDemoConversations().length;
  }

  return data?.length ?? 0;
}

/**
 * Hook to get match details by ID
 */
export function useMatchById(matchId: string | undefined) {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: queryKeys.matches.detail(matchId || ''),
    queryFn: async () => {
      if (!matchId || !user?.id) {
        throw new Error('Match ID and user required');
      }

      const { data: match, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (error) throw error;
      if (!match) throw new Error('Match not found');

      // Get the other user's public profile. Matching somebody does not entitle either of
      // you to the other's email, phone or coordinates, so this reads the same view
      // discovery does (MEXA-261).
      const otherUserId = match.user1_id === user.id ? match.user2_id : match.user1_id;

      const { data: otherUser } = await supabase
        .from('user_public_profiles')
        .select('*')
        .eq('id', otherUserId)
        .single();

      const { data: photos } = await supabase
        .from('user_photos')
        .select('*')
        .eq('user_id', otherUserId)
        .order('photo_order', { ascending: true });

      return {
        ...match,
        otherUser: otherUser
          ? {
              ...otherUser,
              photos: photos || [],
              // Computed by the view (MEXA-320), like distance_miles.
              age: otherUser.age,
            }
          : null,
      };
    },
    enabled: !!matchId && !!user?.id,
  });
}
