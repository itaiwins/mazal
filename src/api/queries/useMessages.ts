/**
 * Messages Query Hook
 *
 * Fetches messages for a conversation with pagination
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';
import type { Message } from '@/types/database.types';

const PAGE_SIZE = 50;

/**
 * Fetch messages for a match/conversation
 */
async function fetchMessages(
  matchId: string,
  page: number = 0
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from('messages')
    .select('*', { count: 'exact' })
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }

  // Reverse to get chronological order (oldest first)
  const messages = (data || []).reverse();
  const hasMore = (count || 0) > to + 1;

  return { messages, hasMore };
}

/**
 * Hook to get messages for a conversation
 */
export function useMessages(matchId: string | undefined) {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: queryKeys.messages.conversation(matchId || ''),
    queryFn: async () => {
      if (!matchId) {
        throw new Error('Match ID required');
      }
      const result = await fetchMessages(matchId);
      return result.messages;
    },
    enabled: !!matchId && !!user?.id,
    staleTime: 0, // Always refetch - messages should be real-time
    refetchInterval: 5000, // Poll every 5 seconds as fallback
  });
}

/**
 * Hook to get messages with infinite scroll (for large conversations)
 */
export function useInfiniteMessages(matchId: string | undefined) {
  const user = useAuthStore((s) => s.user);

  return useInfiniteQuery({
    queryKey: ['messages', 'infinite', matchId],
    queryFn: ({ pageParam = 0 }) => {
      if (!matchId) {
        throw new Error('Match ID required');
      }
      return fetchMessages(matchId, pageParam);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length : undefined;
    },
    enabled: !!matchId && !!user?.id,
    staleTime: 0,
  });
}

/**
 * Hook to get unread message count
 */
export function useUnreadCount() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: queryKeys.messages.unread(),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Get all matches for the user
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .eq('is_active', true);

      if (!matches || matches.length === 0) {
        return 0;
      }

      const matchIds = matches.map((m) => m.id);

      // Count unread messages not sent by current user
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('match_id', matchIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error fetching unread count:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}
