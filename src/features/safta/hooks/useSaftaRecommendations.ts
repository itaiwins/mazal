/**
 * Safta Recommendations Hooks
 *
 * Handles fetching and sending Safta (grandparent) recommendations
 * Uses the safta_likes table from the database schema
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { fetchSaftaPublicProfiles } from '@/api/queries/saftaPublicProfiles';
import type { SaftaPublicProfile } from '@/types/database.types';

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
  /**
   * The Safta who sent it, from `safta_public_profiles`. Undefined unless the caller holds
   * an accepted connection to her - see 00022 (MEXA-302). Only `useGrandchildRecommendations`
   * populates it; a Safta reading her own sent list already knows who she is.
   */
  safta?: SaftaPublicProfile;
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

      // `safta` was an embed on `safta_accounts` and came back null on every row: that
      // table's SELECT policy is `auth_id = auth.uid()`, so a grandchild cannot read the
      // account row of the Safta who recommended to them. MEXA-279 filed it rather than
      // widening it mid-refactor; migration 00022 (MEXA-302) added
      // `safta_public_profiles`, which publishes the display columns to a grandchild on an
      // accepted connection, and this is the read that uses it.
      const { data, error } = await supabase
        .from('safta_likes')
        .select('*')
        .eq('for_user_id', userId)
        .eq('sent_to_user', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching grandchild recommendations:', error);
        throw error;
      }

      const likedUsers = await fetchLikedUsers((data ?? []).map((like) => like.liked_user_id));
      const saftas = await fetchSaftaPublicProfiles(
        (data ?? []).map((like) => like.safta_account_id)
      );

      return (data ?? []).map((like) => ({
        ...like,
        liked_user: likedUsers.get(like.liked_user_id),
        // Undefined when the connection behind the recommendation is not accepted - the
        // recommendation itself still shows, just without "recommended by Bubbe".
        safta: saftas.get(like.safta_account_id),
      }));
    },
    enabled: !!userId,
  });
}

/**
 * Send a recommendation from Safta to their grandchild.
 *
 * TWO STATEMENTS, NOT ONE, since 00031 (MEXA-361). A `safta_likes` row is now born a draft:
 * the INSERT policy requires `sent_to_user IS NOT TRUE AND sent_at IS NULL`, so the single
 * insert this hook used to do - `sent_to_user: true, sent_at: now()` - is 42501. Sending is
 * the UPDATE, which is what fires `trigger_notify_safta_like` and queues the push, and which
 * 00020 made one-way so a row can never notify twice. `sent_at` is not sent at all any more:
 * 00031's BEFORE UPDATE trigger derives it, because a device clock is not evidence of when a
 * push went out.
 *
 * The INSERT also now requires `forUserId` to hold an `accepted` `safta_connections` row to
 * this Safta, so recommending to someone who never connected fails 42501 instead of queueing
 * a push notification at them.
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
      // 1. The draft. `sent_to_user` and `sent_at` are omitted so the column defaults supply
      //    them, which is the shape 00031's INSERT check admits.
      const { data: draft, error: insertError } = await supabase
        .from('safta_likes')
        .insert({
          safta_account_id: saftaAccountId,
          for_user_id: forUserId,
          liked_user_id: likedUserId,
          note: note || null,
        })
        .select()
        .single();

      let recommendationId: string | undefined = draft?.id;

      if (insertError) {
        // 23505 is `UNIQUE (safta_account_id, for_user_id, liked_user_id)`: this exact
        // recommendation already exists. That happens when an earlier call inserted the
        // draft and then failed before sending it - the two statements are not one
        // transaction, so a retry has to be able to finish the job instead of dying on its
        // own leftovers.
        if (insertError.code !== '23505') {
          console.error('Error drafting recommendation:', insertError);
          throw insertError;
        }

        const { data: existing, error: findError } = await supabase
          .from('safta_likes')
          .select('id, sent_to_user')
          .eq('safta_account_id', saftaAccountId)
          .eq('for_user_id', forUserId)
          .eq('liked_user_id', likedUserId)
          .single();

        if (findError) {
          console.error('Error finding the existing recommendation:', findError);
          throw findError;
        }

        // Already sent. Nothing is left to do, and the UPDATE below would match 0 rows
        // anyway (00020's one-way `USING`), which `.single()` would turn into a PGRST116.
        // The caller asked for this person to have been recommended, and they have been.
        if (existing.sent_to_user) return existing;
        recommendationId = existing.id;
      }

      // Neither branch above can leave this unset - the insert either returned a row or set
      // `insertError`, and every path through that block either throws, returns, or assigns.
      // Asserted rather than non-null-asserted so a future edit that breaks the invariant
      // fails here instead of sending `?id=eq.undefined` to PostgREST.
      if (!recommendationId) {
        throw new Error('safta_likes: no recommendation row to send');
      }

      // 2. The send. This is the statement that queues the push. It is 42501 if the
      //    grandchild has rejected the connection since the draft was written - 00031
      //    re-checks consent here, not only at insert.
      const { data, error } = await supabase
        .from('safta_likes')
        .update({ sent_to_user: true })
        .eq('id', recommendationId)
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

      // Check if user has connected safta accounts. `safta` comes from
      // `safta_public_profiles`, not an embed on `safta_accounts`: that table is
      // owner-scoped, so the embed was null for every grandchild (MEXA-302).
      const { data: connections } = await supabase
        .from('safta_connections')
        .select('*')
        .eq('connected_user_id', userId)
        .eq('status', 'accepted');

      const saftas = await fetchSaftaPublicProfiles(
        (connections ?? []).map((c) => c.safta_account_id)
      );

      return {
        connections: (connections ?? []).map((c) => ({
          ...c,
          safta: saftas.get(c.safta_account_id),
        })),
        hasSafta: (connections?.length || 0) > 0,
      };
    },
    enabled: !!userId,
  });
}
