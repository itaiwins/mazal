/**
 * Messages Real-time Subscription Hook
 *
 * Subscribes to real-time message updates for a conversation
 */

import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';
import type { Message } from '@/types/database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Subscribe to new messages for a specific match/conversation
 */
export function useMessagesSubscription(matchId: string | undefined) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!matchId || !user?.id) return;

    // Create a channel for this conversation
    const channel: RealtimeChannel = supabase
      .channel(`messages:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;

          // Update the messages cache optimistically
          queryClient.setQueryData<Message[]>(
            queryKeys.messages.conversation(matchId),
            (old) => {
              if (!old) return [newMessage];
              // Check if message already exists (avoid duplicates)
              if (old.some((m) => m.id === newMessage.id)) {
                return old;
              }
              return [...old, newMessage];
            }
          );

          // Also update matches list to show new last message
          queryClient.invalidateQueries({ queryKey: queryKeys.matches.list() });

          // Update unread count if message is from other user
          if (newMessage.sender_id !== user.id) {
            queryClient.invalidateQueries({ queryKey: queryKeys.messages.unread() });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          // Partial on purpose. An UPDATE's payload is not guaranteed to carry every
          // column: a TOASTed value the UPDATE did not change is left out of the WAL,
          // and `messages` is on the default replica identity, so realtime has no old
          // row to recover it from (MEXA-313, see 00018's header). The read-receipt
          // UPDATE is exactly that case - it touches `is_read`/`read_at` and leaves a
          // long `content` alone - so replacing the cached message with this payload
          // blanked the body of any message over ~2 KB.
          const updatedMessage = payload.new as Partial<Message>;
          if (!updatedMessage.id) return;

          // Update the message in cache (for read status updates)
          queryClient.setQueryData<Message[]>(
            queryKeys.messages.conversation(matchId),
            (old) => {
              if (!old) return old;
              return old.map((m) =>
                m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m
              );
            }
          );
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, user?.id, queryClient]);
}

/**
 * Subscribe to all messages for the current user (for unread counts)
 */
export function useAllMessagesSubscription() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to all messages where user is involved
    const channel: RealtimeChannel = supabase
      .channel('all-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          // Only process if the message is to the current user
          if (newMessage.sender_id === user.id) return;

          // Check if the message is in one of user's matches
          const { data: match } = await supabase
            .from('matches')
            .select('id')
            .eq('id', newMessage.match_id)
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
            .single();

          if (match) {
            // Update unread count
            queryClient.invalidateQueries({ queryKey: queryKeys.messages.unread() });
            // Update matches list
            queryClient.invalidateQueries({ queryKey: queryKeys.matches.list() });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}

/**
 * Hook to handle typing indicators
 */
export function useTypingIndicator(matchId: string | undefined) {
  const user = useAuthStore((s) => s.user);

  // Broadcast typing status
  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!matchId || !user?.id) return;

      const channel = supabase.channel(`typing:${matchId}`);
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: user.id,
          isTyping,
        },
      });
    },
    [matchId, user?.id]
  );

  return { setTyping };
}

/**
 * Hook to subscribe to typing indicators
 */
export function useTypingSubscription(
  matchId: string | undefined,
  onTyping: (userId: string, isTyping: boolean) => void
) {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!matchId || !user?.id) return;

    const channel = supabase
      .channel(`typing:${matchId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, isTyping } = payload.payload as {
          userId: string;
          isTyping: boolean;
        };

        // Only show typing for other users
        if (userId !== user.id) {
          onTyping(userId, isTyping);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, user?.id, onTyping]);
}
