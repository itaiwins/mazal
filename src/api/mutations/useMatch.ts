/**
 * Match Mutation Hooks
 *
 * Unmatch, block, and report users
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import type { UnmatchResult } from '@/types/database.types';
import { useAuthStore } from '@/stores/authStore';

/**
 * Ends a match, through `public.unmatch(uuid)`.
 *
 * This used to be a read of the match followed by
 * `.update({ [my side]_unmatched: true, is_active: false })`. It worked - but only because
 * `authenticated` held UPDATE on every column of `matches`, and so did the person on the
 * other end. Measured on the live project (MEXA-418): after B unmatched A, A could write
 * `is_active = true` and clear B's flag, and the match B had ended was back in B's own list
 * with the thread intact. An unmatch is the app's "get this person away from me" control;
 * it must not be reversible by the person it was used against.
 *
 * Migration 00036 revokes that grant and moves the write into a SECURITY DEFINER function.
 * Two things follow for this hook:
 *
 *  - **No more read-then-write.** The side (`user1_unmatched` vs `user2_unmatched`) is
 *    decided server-side from `current_app_user_id()`, so the `.select()` that existed only
 *    to work out which column to write is gone, and with it the gap between the two
 *    statements.
 *  - **The refusal is data.** `ok: false, reason: 'not_found'` covers both "no such match"
 *    and "not yours" with one answer, on purpose - see 00036.
 *
 * Idempotent on the server, so a double tap is not an error.
 */
export function useUnmatch() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (matchId: string) => {
      // The function derives the caller from current_app_user_id(), so this is only here to
      // avoid a pointless request - and to keep the thrown error the same as before for a
      // signed-out caller.
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.rpc('unmatch', { p_match_id: matchId });

      if (error) {
        console.error('Error unmatching:', error);
        throw error;
      }

      // `RETURNS TABLE` comes back as an array of one. An empty array would mean the
      // function returned no row at all, which it is written never to do - treat it as a
      // failure rather than inventing a success.
      const result: UnmatchResult | undefined = data?.[0];
      if (!result) {
        throw new Error('Unmatch failed: unmatch returned no row');
      }
      if (!result.ok) {
        // The message the old code threw for the same situation, kept so any caller
        // matching on it does not change behaviour.
        throw new Error('Match not found');
      }

      return { matchId, otherUserId: result.other_user_id };
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

      // Also unmatch if there's an existing match.
      //
      // Through the same RPC as useUnmatch since 00036 (MEXA-418): `authenticated` no longer
      // holds UPDATE on `matches.is_active`, so the bulk `.update({ is_active: false })`
      // this used to run is now refused with 42501. Two things change besides the verb:
      //
      //  - **The block now records a side.** The old write set `is_active = false` and left
      //    *both* `*_unmatched` flags false, so nothing in the row said who ended it.
      //    `unmatch()` sets the blocker's flag, like every other unmatch.
      //  - **A failure is no longer swallowed.** The old call ignored its error entirely, so
      //    "blocked but still matched" was a silent outcome on a safety control. The block
      //    row is already written by this point, so the throw reports a partial block rather
      //    than undoing one.
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('id')
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${blockedUserId}),and(user1_id.eq.${blockedUserId},user2_id.eq.${user.id})`
        )
        .eq('is_active', true);

      if (matchesError) {
        console.error('Error reading matches to unmatch after block:', matchesError);
        throw matchesError;
      }

      // At most one row - `matches` carries UNIQUE (user1_id, user2_id) and the pair is
      // stored ordered - but the query is written for a list, so this stays a loop.
      for (const match of matches ?? []) {
        const { data, error } = await supabase.rpc('unmatch', { p_match_id: match.id });
        const result: UnmatchResult | undefined = data?.[0];
        if (error || !result?.ok) {
          console.error('Error unmatching after block:', error ?? result?.reason);
          throw error ?? new Error('Blocked, but the match could not be ended');
        }
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
