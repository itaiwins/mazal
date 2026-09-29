/**
 * Swipe Mutation Hook
 *
 * Records a swipe action and checks for matches
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';
import type { SwipeAction } from '@/types/database.types';

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
 * Hook to undo the last swipe (premium feature)
 */
export function useUndoSwipe() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Get the most recent swipe
      const { data: lastSwipe, error: fetchError } = await supabase
        .from('swipes')
        .select('*')
        .eq('swiper_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !lastSwipe) {
        throw new Error('No swipe to undo');
      }

      // Check if swipe is recent enough (within 30 seconds)
      const swipeTime = new Date(lastSwipe.created_at).getTime();
      const now = Date.now();
      if (now - swipeTime > 30000) {
        throw new Error('Swipe is too old to undo');
      }

      // Delete the swipe
      const { error: deleteError } = await supabase
        .from('swipes')
        .delete()
        .eq('id', lastSwipe.id);

      if (deleteError) {
        console.error('Error undoing swipe:', deleteError);
        throw deleteError;
      }

      return { undoneSwipe: lastSwipe };
    },
    onSuccess: () => {
      // Invalidate discovery to bring back the user
      queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all });
    },
  });
}
