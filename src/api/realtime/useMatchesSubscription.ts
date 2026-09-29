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

/*
 * `useLikesSubscription` was here: a postgres_changes subscription on `swipes` filtered by
 * `swiped_id=eq.<me>`, meant to drive the premium "see who liked you" badge. Removed in
 * MEXA-294, because there is no version of it that works today and keeping it made an
 * unbuilt feature look built.
 *
 * Three separate reasons it delivered nothing:
 *
 *   1. Realtime applies the table's SELECT policy to each subscriber, and the only one on
 *      `swipes` is `swiper_id = <me>`. A row where the subscriber is the *swipee* - which
 *      is every row this filter selects - fails it.
 *   2. `supabase_realtime` had no tables on it at all, so no row event was ever sent for
 *      any table. 00017 adds `matches`; `swipes` is deliberately left off, because the
 *      policy that would make this subscription deliver is the one that also publishes
 *      "who passed on you".
 *   3. Nothing mounted the hook, and nothing ever queried `queryKeys.swipes.whoLikedMe()` -
 *      there is no "who liked me" query or screen in the app. The key exists in
 *      queryClient.ts and this was its only reference.
 *
 * Building that surface properly - a SECURITY DEFINER RPC for the list, entitlement-gated,
 * and a notification path that doesn't require publishing `swipes` - is its own issue.
 * Match notifications, which is what this file's other hook does, work as of 00017.
 */

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
