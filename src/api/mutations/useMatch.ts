/**
 * Match Mutation Hooks
 *
 * Unmatch, block, and report users
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';

/**
 * Hook to unmatch from a user
 */
export function useUnmatch() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (matchId: string) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Get the match to determine which user we are
      const { data: match, error: fetchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (fetchError || !match) {
        throw new Error('Match not found');
      }

      // Determine which unmatch field to update
      const updateField =
        match.user1_id === user.id ? 'user1_unmatched' : 'user2_unmatched';

      // Mark as unmatched and set inactive
      const { error } = await supabase
        .from('matches')
        .update({
          [updateField]: true,
          is_active: false,
        })
        .eq('id', matchId);

      if (error) {
        console.error('Error unmatching:', error);
        throw error;
      }

      return { matchId };
    },
    onSuccess: () => {
      // Invalidate matches list
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
    },
  });
}

/**
 * Hook to block a user
 */
export function useBlockUser() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (blockedUserId: string) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Create block record
      const { error: blockError } = await supabase.from('blocks').insert({
        blocker_id: user.id,
        blocked_id: blockedUserId,
      });

      if (blockError) {
        // Ignore if already blocked
        if (blockError.code !== '23505') {
          console.error('Error blocking user:', blockError);
          throw blockError;
        }
      }

      // Also unmatch if there's an existing match
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${blockedUserId}),and(user1_id.eq.${blockedUserId},user2_id.eq.${user.id})`
        )
        .eq('is_active', true);

      if (matches && matches.length > 0) {
        await supabase
          .from('matches')
          .update({ is_active: false })
          .in(
            'id',
            matches.map((m) => m.id)
          );
      }

      return { blockedUserId };
    },
    onSuccess: () => {
      // Invalidate matches and discovery
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
    },
  });
}

/**
 * Hook to unblock a user
 */
export function useUnblockUser() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (blockedUserId: string) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedUserId);

      if (error) {
        console.error('Error unblocking user:', error);
        throw error;
      }

      return { unblockedUserId: blockedUserId };
    },
    onSuccess: () => {
      // Invalidate discovery to potentially show unblocked user
      queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
    },
  });
}

/**
 * Hook to report a user
 */
export function useReportUser() {
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({
      reportedUserId,
      reason,
      details,
    }: {
      reportedUserId: string;
      reason: string;
      details?: string;
    }) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_id: reportedUserId,
        reason,
        details,
        status: 'pending',
      });

      if (error) {
        console.error('Error reporting user:', error);
        throw error;
      }

      return { success: true };
    },
  });
}
