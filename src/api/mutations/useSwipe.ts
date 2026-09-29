/**
 * Swipe Mutation Hook
 *
 * Records a swipe action and checks for matches
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';
import type {
  SwipeAction,
  UndoLastSwipeResult,
  UndoSwipeRefusal,
} from '@/types/database.types';

interface SwipeParams {
  swipedUserId: string;
  action: SwipeAction;
}

interface SwipeResult {
  success: boolean;
  isMatch: boolean;
  matchId?: string;
}

/**
 * Record a swipe and check for match
 */
async function performSwipe(
  swiperId: string,
  swipedId: string,
  action: SwipeAction
): Promise<SwipeResult> {
  // Insert the swipe
  const { error: swipeError } = await supabase.from('swipes').insert({
    swiper_id: swiperId,
    swiped_id: swipedId,
    action,
  });

  if (swipeError) {
    console.error('Error recording swipe:', swipeError);
    throw swipeError;
  }

  // If it's a pass, no match possible
  if (action === 'pass') {
    return { success: true, isMatch: false };
  }

  // Did that like complete a match? Ask `matches`, not `swipes` (MEXA-294).
  //
  // This used to look for the other person's like in `swipes` and, if it found one, insert
  // the `matches` row itself. Neither half worked. The only SELECT policy on `swipes` is
  // `swiper_id = <me>`, so a caller can never read a row in which they are the swipee -
  // the reciprocal-like query came back empty for everyone, silently, and the "It's a
  // Match!" screen never appeared. And `matches` has no INSERT policy, so the insert
  // underneath it would have been refused with 42501 if it had ever run.
  //
  // `swipes_check_match` is the one thing that creates a match, and since 00017 it is
  // SECURITY DEFINER, so it sees both sides and writes the row in the same transaction as
  // the INSERT above. By the time we get here it is committed, and the `matches` SELECT
  // policy shows it to both participants - so all we have to do is read it.
  //
  // user1_id < user2_id, matching the trigger and the UNIQUE (user1_id, user2_id)
  // constraint, so the pair has exactly one row whichever way round the second like came.
  const [user1, user2] =
    swiperId < swipedId ? [swiperId, swipedId] : [swipedId, swiperId];

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id')
    .eq('user1_id', user1)
    .eq('user2_id', user2)
    .maybeSingle();

  if (matchError) {
    // The swipe is recorded and the match, if any, exists - only our read of it failed.
    // Don't throw the swipe away over a missing celebration; the matches list will show it.
    console.error('Error reading match after swipe:', matchError);
    return { success: true, isMatch: false };
  }

  if (match) {
    return { success: true, isMatch: true, matchId: match.id };
  }

  return { success: true, isMatch: false };
}

/**
 * Hook to perform a swipe action
 */
export function useSwipe() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({ swipedUserId, action }: SwipeParams) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Skip database operations for demo profiles (IDs starting with "demo-")
      if (swipedUserId.startsWith('demo-')) {
        // Simulate a successful swipe for demo mode
        return { success: true, isMatch: action === 'like' || action === 'super_like' };
      }

      return performSwipe(user.id, swipedUserId, action);
    },
    onSuccess: (result) => {
      // Invalidate discovery to remove swiped user
      queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });

      // If it's a match, invalidate matches
      if (result.isMatch) {
        queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      }
    },
  });
}

/**
 * What to show the user when the server refuses a rewind. Every refusal has a message;
 * none of them is a silent success.
 */
const UNDO_REFUSAL_MESSAGES: Record<UndoSwipeRefusal, string> = {
  no_swipe: 'No swipe to undo',
  too_old: 'Swipe is too old to undo',
  matched: "You've already matched - rewind can't undo that. Unmatch them instead.",
};

/**
 * Hook to undo the last swipe (premium feature)
 *
 * This used to do the work itself: read the newest `swipes` row, check its age against the
 * device clock, then `delete().eq('id', ...)`. Both halves were wrong (MEXA-314).
 *
 *   * `swipes` has no DELETE policy - only the INSERT and SELECT ones from 00002 - and a
 *     DELETE that RLS filters to zero rows **is not an error**. So `deleteError` was null,
 *     this hook returned `{ undoneSwipe }`, the deck was invalidated, and the UI reported a
 *     successful rewind while the row sat there and the person stayed out of the deck.
 *     Rewind is sold as a Gold/Platinum feature, so it was a paid feature that did nothing
 *     and said nothing.
 *   * The 30-second window compared `Date.now()` with a server `created_at`, so a wrong
 *     device clock either let an old swipe through or refused a fresh one.
 *
 * Migration 00025 replaces it with `public.undo_last_swipe()`, a SECURITY DEFINER function
 * that takes no arguments. Ownership, the window (server-side `now()`) and the
 * already-matched rule are all decided there, in one round trip, and `swipes` stays
 * append-only for clients - no DELETE policy, no DELETE grant. All this hook does is
 * translate the outcome.
 */
export function useUndoSwipe() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async () => {
      // The function derives the caller from current_app_user_id(), so this is only here to
      // avoid a pointless request - and to keep the thrown error the same as before for a
      // signed-out caller.
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.rpc('undo_last_swipe');

      if (error) {
        console.error('Error undoing swipe:', error);
        throw error;
      }

      // `RETURNS TABLE` comes back as an array of one. An empty array would mean the
      // function returned no row at all, which it is written never to do - treat it as a
      // failure rather than inventing a success.
      const result: UndoLastSwipeResult | undefined = data?.[0];
      if (!result) {
        throw new Error('Rewind failed: undo_last_swipe returned no row');
      }

      if (!result.ok) {
        throw new Error(
          (result.reason && UNDO_REFUSAL_MESSAGES[result.reason]) ??
            `Rewind failed${result.reason ? `: ${result.reason}` : ''}`
        );
      }

      return { undoneSwipe: result };
    },
    onSuccess: () => {
      // Invalidate discovery to bring back the user
      queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
    },
  });
}
