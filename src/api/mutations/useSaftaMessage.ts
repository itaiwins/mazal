/**
 * Safta Message Mutations
 *
 * Mutations for sending messages between users and Saftas
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';

// Note: safta_messages table needs to be created via migration before these work
// Using 'as any' for table access until types are regenerated

interface SendSaftaMessageParams {
  connectionId: string;
  content: string;
}

/**
 * Hook to send a message in a Safta connection (from user to Safta)
 */
export function useSendSaftaMessage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({ connectionId, content }: SendSaftaMessageParams) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await (supabase as any)
        .from('safta_messages')
        .insert({
          connection_id: connectionId,
          sender_type: 'user',
          sender_id: user.id,
          content: content.trim(),
          is_read: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending Safta message:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate messages for this connection
      queryClient.invalidateQueries({
        queryKey: ['safta', 'messages', variables.connectionId],
      });
      // Also invalidate the connections list to update last message
      queryClient.invalidateQueries({
        queryKey: ['safta', 'connections'],
      });
    },
  });
}

/**
 * Hook to send a message in a Safta connection (from Safta to user)
 * Used when logged in as a Safta account
 */
export function useSendSaftaMessageAsSafta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ connectionId, content, saftaId }: SendSaftaMessageParams & { saftaId: string }) => {
      const { data, error } = await (supabase as any)
        .from('safta_messages')
        .insert({
          connection_id: connectionId,
          sender_type: 'safta',
          sender_id: saftaId,
          content: content.trim(),
          is_read: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending Safta message:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['safta', 'messages', variables.connectionId],
      });
    },
  });
}

/**
 * Hook to mark Safta messages as read
 */
export function useMarkSaftaMessagesAsRead() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (connectionId: string) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Mark all messages from Safta as read
      const { error } = await (supabase as any)
        .from('safta_messages')
        .update({ is_read: true })
        .eq('connection_id', connectionId)
        .eq('sender_type', 'safta')
        .eq('is_read', false);

      if (error) {
        console.error('Error marking Safta messages as read:', error);
        throw error;
      }
    },
    onSuccess: (_, connectionId) => {
      // Invalidate unread count
      queryClient.invalidateQueries({
        queryKey: ['safta', 'messages', 'unread'],
      });
      // Invalidate messages for this connection
      queryClient.invalidateQueries({
        queryKey: ['safta', 'messages', connectionId],
      });
    },
  });
}
