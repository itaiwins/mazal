/**
 * Safta Recommendations Hooks
 *
 * Handles fetching and sending Safta (grandparent) recommendations
 * Uses the safta_likes table from the database schema
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';

/**
 * The columns a recommendation shows about the person recommended, read from
 * `user_public_profiles`.
 *
 * Both hooks below used to get these by embedding `liked_user:users!liked_user_id(...)`.
 * Since 00013 (MEXA-261) `users` serves the caller's own row only - and a safta signs in
 * against `safta_accounts`, so she has no `users` row at all - which made the embed null on
 * every recommendation. The view is not a table, so the app fetches it as a second query
 * keyed on the id list and merges client-side (MEXA-279).
 */
const LIKED_USER_COLUMNS = 'id, first_name, occupation, jewish_background';

async function fetchLikedUsers(likedUserIds: string[]) {
  const ids = [...new Set(likedUserIds)].filter((id): id is string => !!id);
  if (ids.length === 0) return new Map<string, SaftaRecommendation['liked_user']>();

  const { data, error } = await supabase
    .from('user_public_profiles')
    .select(LIKED_USER_COLUMNS)
    .in('id', ids);

  if (error) throw error;

  return new Map(
    (data ?? []).map((u) => [
      u.id,
      {
        id: u.id,
        first_name: u.first_name ?? '',
        occupation: u.occupation,
        jewish_background: u.jewish_background,
      },
    ])
  );
}

export interface SaftaRecommendation {
  id: string;
  safta_account_id: string;
  for_user_id: string;
  liked_user_id: string;
  note: string | null;
  sent_to_user: boolean;
  sent_at: string | null;
  created_at: string;
  liked_user?: {
    id: string;
    first_name: string;
    occupation: string | null;
    jewish_background: string | null;
  };
}

/**
 * Fetch recommendations sent by the Safta
 */
export function useSaftaSentRecommendations(saftaAccountId: string | undefined) {
  return useQuery({
    queryKey: ['safta-likes', 'sent', saftaAccountId],
    queryFn: async () => {
      if (!saftaAccountId) return [];

      const { data, error } = await supabase
        .from('safta_likes')
        .select('*')
        .eq('safta_account_id', saftaAccountId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching safta likes:', error);
        throw error;
      }

      const likedUsers = await fetchLikedUsers((data ?? []).map((like) => like.liked_user_id));

      return (data ?? []).map((like) => ({
        ...like,
        liked_user: likedUsers.get(like.liked_user_id),
      })) as unknown as SaftaRecommendation[];
    },
    enabled: !!saftaAccountId,
  });
}

/**
 * Fetch recommendations received by the user (from their safta)
 */
export function useGrandchildRecommendations(userId: string | undefined) {
  return useQuery({
    queryKey: ['safta-likes', 'received', userId],
    queryFn: async () => {
      if (!userId) return [];

      // `safta` stays an embed - `safta_accounts` is a table and 00013 did not touch it -
      // but note it comes back null here and always has: that table's SELECT policy is
      // `auth_id = auth.uid()`, so a grandchild cannot read the account row of the safta who
      // recommended to them. A pre-existing gap, filed rather than widened (MEXA-279).
      const { data, error } = await supabase
        .from('safta_likes')
        .select(`
          *,
          safta:safta_accounts!safta_account_id (
            id,
            display_name
          )
        `)
        .eq('for_user_id', userId)
        .eq('sent_to_user', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching grandchild recommendations:', error);
        throw error;
      }

      const likedUsers = await fetchLikedUsers((data ?? []).map((like) => like.liked_user_id));

      return (data ?? []).map((like) => ({
        ...like,
        liked_user: likedUsers.get(like.liked_user_id),
      }));
    },
    enabled: !!userId,
  });
}

/**
 * Send a recommendation from Safta to their grandchild
 */
export function useSendRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      saftaAccountId,
      forUserId,
      likedUserId,
      note,
    }: {
      saftaAccountId: string;
      forUserId: string;
      likedUserId: string;
      note?: string;
    }) => {
      const { data, error } = await supabase
        .from('safta_likes')
        .insert({
          safta_account_id: saftaAccountId,
          for_user_id: forUserId,
          liked_user_id: likedUserId,
          note: note || null,
          sent_to_user: true,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending recommendation:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['safta-likes', 'sent', variables.saftaAccountId],
      });
      queryClient.invalidateQueries({
        queryKey: ['safta-likes', 'received', variables.forUserId],
      });
    },
  });
}

/**
 * Update recommendation status (mark as viewed, etc.)
 */
export function useUpdateRecommendationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recommendationId,
      sentToUser,
    }: {
      recommendationId: string;
      sentToUser: boolean;
    }) => {
      const { data, error } = await supabase
        .from('safta_likes')
        .update({
          sent_to_user: sentToUser,
          sent_at: sentToUser ? new Date().toISOString() : null,
        })
        .eq('id', recommendationId)
        .select()
        .single();

      if (error) {
        console.error('Error updating recommendation:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate all safta-likes queries
      queryClient.invalidateQueries({
        queryKey: ['safta-likes'],
      });
    },
  });
}

/**
 * Get Safta connection (grandparent-grandchild relationship)
 */
export function useSaftaConnection(userId: string | undefined) {
  return useQuery({
    queryKey: ['safta-connection', userId],
    queryFn: async () => {
      if (!userId) return null;

      // Check if user has connected safta accounts
      const { data: connections } = await supabase
        .from('safta_connections')
        .select(`
          *,
          safta:safta_accounts!safta_account_id (
            id,
            display_name,
            relationship
          )
        `)
        .eq('connected_user_id', userId)
        .eq('status', 'accepted');

      return {
        connections: connections || [],
        hasSafta: (connections?.length || 0) > 0,
      };
    },
    enabled: !!userId,
  });
}
