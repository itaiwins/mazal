/**
 * Message Mutation Hooks
 *
 * Send messages and mark as read
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { validateMessageContent, sanitizeContent } from '@/lib/moderation';
import type { MessageType } from '@/types/database.types';

interface SendMessageParams {
  matchId: string;
  content: string;
  messageType?: MessageType;
  mediaUrl?: string;
}

/**
 * Hook to send a message
 */
export function useSendMessage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({
      matchId,
      content,
      messageType = 'text',
      mediaUrl,
    }: SendMessageParams) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Validate message content for inappropriate material
      const validation = validateMessageContent(content);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Message contains inappropriate content');
      }

      // Sanitize the content (replaces any remaining flagged patterns)
      const sanitizedMessage = sanitizeContent(content);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          match_id: matchId,
          sender_id: user.id,
          content: sanitizedMessage,
          message_type: messageType,
          media_url: mediaUrl,
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate the conversation messages
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.conversation(variables.matchId),
      });

      // Invalidate matches list to update last message preview
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.list() });
    },
  });
}

/**
 * Hook to mark messages as read
 */
export function useMarkMessagesAsRead() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (matchId: string) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('messages')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('match_id', matchId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking messages as read:', error);
        throw error;
      }

      return { matchId };
    },
    onSuccess: (_, matchId) => {
      // Invalidate unread count
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.unread() });

      // Invalidate matches list to update unread indicator
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.list() });
    },
  });
}

/**
 * Hook to delete a message (only own messages)
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({ messageId, matchId }: { messageId: string; matchId: string }) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Only allow deleting own messages
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) {
        console.error('Error deleting message:', error);
        throw error;
      }

      return { messageId, matchId };
    },
    onSuccess: (_, variables) => {
      // Invalidate the conversation
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.conversation(variables.matchId),
      });
    },
  });
}
