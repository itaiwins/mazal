/**
 * Safta Connections Query Hook
 *
 * Fetches Safta connections for a user - the Saftas that have connected with them
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { FEATURE_SAFTA_MODE } from '@/lib/config/features';
import {
  fetchSaftaPublicProfiles,
  UNKNOWN_SAFTA_NAME,
  DEFAULT_SAFTA_RELATIONSHIP,
} from './saftaPublicProfiles';

/**
 * Safta connection with preview info
 */
export interface SaftaConnectionWithPreview {
  id: string;
  saftaId: string;
  saftaName: string;
  saftaPhoto: string | null;
  relationship: string;
  status: 'pending' | 'accepted' | 'rejected';
  connectedAt: string;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
}

/**
 * Fetch Safta connections for a user
 */
async function fetchSaftaConnections(userId: string): Promise<SaftaConnectionWithPreview[]> {
  // Get all active connections where user is the connected user.
  //
  // The Safta's name is NOT embedded here. It used to be, as `safta_accounts!inner(...)`,
  // and `safta_accounts` is owner-scoped (`auth_id = auth.uid()`), so the grandchild read
  // no account row - and because `!inner` is an inner join, that dropped the connection
  // too and this list was always empty (MEXA-302). Names come from
  // `safta_public_profiles` below.
  const { data: connections, error } = await supabase
    .from('safta_connections')
    .select(`
      id,
      status,
      created_at,
      safta_account_id
    `)
    .eq('connected_user_id', userId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching Safta connections:', error);
    throw error;
  }

  if (!connections || connections.length === 0) {
    return [];
  }

  // Get connection IDs
  const connectionIds = connections.map((c) => c.id);

  // The Saftas' display rows, keyed on the account ids. Every connection here is
  // `accepted`, which is exactly the view's row rule, so each one resolves.
  const saftaProfiles = await fetchSaftaPublicProfiles(
    connections.map((c) => c.safta_account_id)
  );

  // Fetch last messages for each connection
  // Note: safta_messages table needs to be created via migration
  const { data: lastMessages } = await (supabase as any)
    .from('safta_messages')
    .select('connection_id, content, created_at, sender_type')
    .in('connection_id', connectionIds)
    .order('created_at', { ascending: false })
    .catch(() => ({ data: null })); // Gracefully handle if table doesn't exist yet

  // Fetch unread counts (messages from safta that are unread)
  const { data: unreadCounts } = await (supabase as any)
    .from('safta_messages')
    .select('connection_id')
    .in('connection_id', connectionIds)
    .eq('sender_type', 'safta')
    .eq('is_read', false)
    .catch(() => ({ data: null })); // Gracefully handle if table doesn't exist yet

  // Build maps
  const lastMessageByConnection = new Map<string, { content: string; created_at: string }>();
  (lastMessages || []).forEach((m: any) => {
    if (!lastMessageByConnection.has(m.connection_id)) {
      lastMessageByConnection.set(m.connection_id, { content: m.content, created_at: m.created_at });
    }
  });

  const unreadByConnection = new Map<string, number>();
  (unreadCounts || []).forEach((m: any) => {
    unreadByConnection.set(m.connection_id, (unreadByConnection.get(m.connection_id) || 0) + 1);
  });

  // Build result
  const result: SaftaConnectionWithPreview[] = connections.map((conn: any) => {
    const saftaAccount = saftaProfiles.get(conn.safta_account_id);
    const lastMsg = lastMessageByConnection.get(conn.id);

    return {
      id: conn.id,
      saftaId: saftaAccount?.id || conn.safta_account_id,
      saftaName: saftaAccount?.display_name || UNKNOWN_SAFTA_NAME,
      saftaPhoto: null, // Safta accounts don't have photos in current schema
      relationship: saftaAccount?.relationship || DEFAULT_SAFTA_RELATIONSHIP,
      status: conn.status,
      connectedAt: conn.created_at,
      lastMessage: lastMsg?.content || null,
      lastMessageTime: lastMsg?.created_at || conn.created_at,
      unreadCount: unreadByConnection.get(conn.id) || 0,
    };
  });

  // Sort by last message time
  return result.sort((a, b) => {
    const aTime = a.lastMessageTime || a.connectedAt;
    const bTime = b.lastMessageTime || b.connectedAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

/**
 * Hook to get Safta connections for current user
 */
export function useSaftaConnections() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['safta', 'connections', user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return fetchSaftaConnections(user.id);
    },
    enabled: !!user?.id && FEATURE_SAFTA_MODE,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to get Safta likes count for current user
 * (How many Saftas have liked profiles for this user)
 */
export function useSaftaLikesCount() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['safta', 'likes', 'count', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { count, error } = await supabase
        .from('safta_likes')
        .select('*', { count: 'exact', head: true })
        .eq('for_user_id', user.id);

      if (error) {
        console.error('Error fetching Safta likes count:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user?.id && FEATURE_SAFTA_MODE,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
