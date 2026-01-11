/**
 * Matches Real-time Subscription Hook
 *
 * Subscribes to new matches and match updates
 */

import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';
import type { Match } from '@/types/database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface NewMatchEvent {
  matchId: string;
  matchedUserId: string;
  matchedAt: string;
}

/**
 * Subscribe to new matches for the current user
 */
export function useMatchesSubscription(
  onNewMatch?: (event: NewMatchEvent) => void
) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [latestMatch, setLatestMatch] = useState<NewMatchEvent | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to matches where user is either user1 or user2
    const channel: RealtimeChannel = supabase
      .channel('user-matches')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
        },
        (payload) => {
          const newMatch = payload.new as Match;

          // Check if current user is part of this match
          if (newMatch.user1_id !== user.id && newMatch.user2_id !== user.id) {
            return;
          }

          // Determine the other user
          const matchedUserId =
            newMatch.user1_id === user.id ? newMatch.user2_id : newMatch.user1_id;

          const matchEvent: NewMatchEvent = {
            matchId: newMatch.id,
            matchedUserId,
            matchedAt: newMatch.created_at,
          };

          // Update state
          setLatestMatch(matchEvent);

          // Call callback if provided
          if (onNewMatch) {
            onNewMatch(matchEvent);
          }

          // Invalidate matches query to refresh the list
          queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
        },
        (payload) => {
          const updatedMatch = payload.new as Match;

          // Check if current user is part of this match
          if (
            updatedMatch.user1_id !== user.id &&
            updatedMatch.user2_id !== user.id
          ) {
            return;
          }

          // Invalidate specific match and list
          queryClient.invalidateQueries({
            queryKey: queryKeys.matches.detail(updatedMatch.id),
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.matches.list() });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, onNewMatch]);

  // Clear the latest match (e.g., after showing celebration)
  const clearLatestMatch = useCallback(() => {
    setLatestMatch(null);
  }, []);

  return { latestMatch, clearLatestMatch };
}

/**
 * Subscribe to "who liked me" updates (premium feature)
 */
export function useLikesSubscription() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [newLikeCount, setNewLikeCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const channel: RealtimeChannel = supabase
      .channel('incoming-likes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'swipes',
          filter: `swiped_id=eq.${user.id}`,
        },
        (payload) => {
          const swipe = payload.new as { action: string };

          // Only count likes and super likes
          if (swipe.action === 'like' || swipe.action === 'super_like') {
            setNewLikeCount((prev) => prev + 1);

            // Invalidate the "who liked me" query
            queryClient.invalidateQueries({
              queryKey: queryKeys.swipes.whoLikedMe(),
            });

            // Also invalidate discovery to update "has liked me" indicators
            queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const clearNewLikeCount = useCallback(() => {
    setNewLikeCount(0);
  }, []);

  return { newLikeCount, clearNewLikeCount };
}

/**
 * Subscribe to online/presence status of matches
 */
export function usePresenceSubscription(matchIds: string[]) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user?.id || matchIds.length === 0) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const online = new Set<string>();

        Object.keys(state).forEach((key) => {
          if (matchIds.includes(key)) {
            online.add(key);
          }
        });

        setOnlineUsers(online);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (matchIds.includes(key)) {
          setOnlineUsers((prev) => new Set(prev).add(key));
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, matchIds.join(',')]);

  return { onlineUsers };
}
