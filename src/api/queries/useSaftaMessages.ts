/**
 * Safta Messages Query Hook
 *
 * Fetches messages between a user and a Safta
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { FEATURE_SAFTA_MODE } from '@/lib/config/features';
import {
  fetchSaftaPublicProfiles,
  UNKNOWN_SAFTA_NAME,
  DEFAULT_SAFTA_RELATIONSHIP,
} from './saftaPublicProfiles';

// Note: safta_messages table needs to be created via migration before these work
// Using 'as any' for table access until types are regenerated

export interface SaftaMessage {
  id: string;
  connectionId: string;
  senderType: 'safta' | 'user';
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * Fetch messages for a Safta connection
 */
async function fetchSaftaMessages(connectionId: string): Promise<SaftaMessage[]> {
  const { data, error } = await (supabase as any)
    .from('safta_messages')
    .select('*')
    .eq('connection_id', connectionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching Safta messages:', error);
    throw error;
  }

  return (data || []).map((msg: any) => ({
    id: msg.id,
    connectionId: msg.connection_id,
    senderType: msg.sender_type as 'safta' | 'user',
    senderId: msg.sender_id,
    content: msg.content,
    isRead: msg.is_read,
    createdAt: msg.created_at,
  }));
}

/**
 * Hook to get messages for a Safta connection
 */
export function useSaftaMessages(connectionId: string | undefined) {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['safta', 'messages', connectionId],
    queryFn: async () => {
      if (!connectionId) {
        throw new Error('Connection ID required');
      }
      return fetchSaftaMessages(connectionId);
    },
    enabled: !!connectionId && !!user?.id && FEATURE_SAFTA_MODE,
    staleTime: 0, // Always refetch for real-time feel
    refetchInterval: 5000, // Poll every 5 seconds as fallback
  });
}

/**
 * Hook to get connection details by ID
 */
export function useSaftaConnectionById(connectionId: string | undefined) {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['safta', 'connection', connectionId],
    queryFn: async () => {
      if (!connectionId || !user?.id) {
        throw new Error('Connection ID and user required');
      }

      // No `safta_accounts` embed: that table is owner-scoped, so the embed was null for
      // every grandchild and the chat header always read 'Unknown Safta' (MEXA-302).
      const { data: connection, error } = await supabase
        .from('safta_connections')
        .select(`
          id,
          status,
          created_at,
          safta_account_id,
          connected_user_id
        `)
        .eq('id', connectionId)
        .single();

      if (error) throw error;
      if (!connection) throw new Error('Connection not found');

      // Unlike `useSaftaConnections`, this hook does not filter on status - it fetches one
      // connection by id, which may still be `pending`. `safta_public_profiles` only
      // publishes a name on an `accepted` connection, so a pending one keeps falling
      // through to 'Unknown Safta'. That is the intended behaviour, not a gap: the name
      // is disclosed when the grandchild accepts.
      const saftaAccount = (await fetchSaftaPublicProfiles([connection.safta_account_id]))
        .get(connection.safta_account_id);

      return {
        id: connection.id,
        status: connection.status,
        createdAt: connection.created_at,
        saftaId: connection.safta_account_id,
        userId: connection.connected_user_id,
        saftaName: saftaAccount?.display_name || UNKNOWN_SAFTA_NAME,
        relationship: saftaAccount?.relationship || DEFAULT_SAFTA_RELATIONSHIP,
      };
    },
    enabled: !!connectionId && !!user?.id && FEATURE_SAFTA_MODE,
  });
}

/**
 * Hook to get unread Safta messages count
 */
export function useSaftaUnreadCount() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['safta', 'messages', 'unread', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Get all connections for this user
      const { data: connections } = await supabase
        .from('safta_connections')
        .select('id')
        .eq('connected_user_id', user.id)
        .eq('status', 'accepted');

      if (!connections || connections.length === 0) {
        return 0;
      }

      const connectionIds = connections.map((c) => c.id);

      // Count unread messages from Saftas
      const { count, error } = await (supabase as any)
        .from('safta_messages')
        .select('*', { count: 'exact', head: true })
        .in('connection_id', connectionIds)
        .eq('sender_type', 'safta')
        .eq('is_read', false);

      if (error) {
        console.error('Error fetching Safta unread count:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user?.id && FEATURE_SAFTA_MODE,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}
