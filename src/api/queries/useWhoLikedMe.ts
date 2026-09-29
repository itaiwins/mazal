/**
 * "See who likes you" - the Gold/Platinum feature the paywall has been selling since
 * before anything was built behind it (MEXA-315).
 *
 * Both hooks call a SECURITY DEFINER function from
 * `supabase/migrations/00026_who_liked_me.sql`. Neither takes a user id, and there is no
 * table read to fall back on: the only SELECT policy on `swipes` is `swiper_id = <me>`, so
 * a client cannot read a row in which it is the *swipee*. That is deliberate and was left
 * alone by MEXA-294 and 00017 - a policy admitting `swiped_id = <me>` would publish "who
 * passed on you" in the same breath as "who liked you", because RLS restricts rows and not
 * values. The functions answer the narrower question instead.
 *
 * The split between the two hooks is the product, not just paging:
 *
 *  - {@link useWhoLikedMeCount} is the **free** teaser. It names nobody and every signed-in
 *    user gets it, because "12 people like you" is what makes the paywall worth tapping.
 *  - {@link useWhoLikedMe} is the **paid** list, gated on `useCanSeeLikes()`.
 *
 * That gate is on the device, reading the RevenueCat SDK, and a determined free user could
 * call the RPC directly. It is a revenue leak, not a privacy one - the list only ever
 * contains likes aimed at the caller, never a pass, never a blocked or deactivated person -
 * and closing it is MEXA-373, which gives `public.subscriptions` a writer so there is
 * something server-side to check. The header of 00026 argues this at length.
 *
 * **No realtime subscription.** A badge fed by `postgres_changes` on `swipes` is exactly
 * what MEXA-294 deleted and MEXA-313 explains: the caller cannot read the row cross-side,
 * so the event never survives the RLS check, and publishing the table would put `pass` rows
 * on the replication stream. The count refetches on focus and is invalidated by `useSwipe`.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabase/client';
import { queryKeys } from '@/lib/config/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useCanSeeLikes } from '@/features/premium/hooks/usePremium';
import { FEATURE_WHO_LIKES_YOU } from '@/lib/config/features';
import { fetchPrimaryPhotoUrls } from './primaryPhotos';
import type { WhoLikedMeRow } from '@/types/database.types';

/** How many likers one page holds. The server clamps anything above 100. */
export const WHO_LIKED_ME_PAGE_SIZE = 50;

/**
 * A liker, ready to render: the row the function returns plus their primary photo. The age
 * is already on the row - `get_who_liked_me()` returns the view's `age` since MEXA-320,
 * and no client sees anybody else's date of birth.
 */
export interface LikerProfile extends WhoLikedMeRow {
  primaryPhotoUrl: string | null;
}

async function fetchWhoLikedMe(): Promise<LikerProfile[]> {
  const { data, error } = await supabase.rpc('get_who_liked_me', {
    p_limit: WHO_LIKED_ME_PAGE_SIZE,
    p_offset: 0,
  });

  if (error) {
    console.error('Error fetching who liked me:', error);
    throw error;
  }

  const likers = (data ?? []) as WhoLikedMeRow[];
  if (likers.length === 0) return [];

  // Photos are a second query keyed on the id list, not an embed: `user_public_profiles`
  // is a view, so PostgREST has no relationship to follow from it (MEXA-279). The deck and
  // the matches list already do exactly this.
  const photos = await fetchPrimaryPhotoUrls(likers.map((l) => l.id));

  // The server already ordered these - super likes first, then newest - and the order is
  // not recomputed here. A client-side re-sort is how a paged list starts disagreeing with
  // its own page boundaries.
  return likers.map((liker) => ({
    ...liker,
    primaryPhotoUrl: photos.get(liker.id) ?? null,
  }));
}

/**
 * The people who liked you and are still waiting on an answer.
 *
 * Disabled - and so never issuing a request - unless the feature is switched on, somebody
 * is signed in, and they hold Gold or Platinum. The last of those is what makes this the
 * paid half; `useWhoLikedMeCount` deliberately has no such condition.
 */
export function useWhoLikedMe() {
  const user = useAuthStore((s) => s.user);
  const isDemoMode = useUIStore((s) => s.isDemoMode);
  const canSeeLikes = useCanSeeLikes();

  return useQuery({
    queryKey: queryKeys.swipes.whoLikedMe(),
    queryFn: fetchWhoLikedMe,
    // Demo mode is deliberately not given fake likers: the screen's job is to show real
    // inbound likes, and a demo list would be indistinguishable from the real thing to
    // whoever is holding the phone.
    enabled: FEATURE_WHO_LIKES_YOU && !isDemoMode && !!user?.id && canSeeLikes,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * How many unanswered likes you have. **Free for everyone** - see the file header.
 *
 * Returns 0 rather than undefined while loading, when the flag is off, or in demo mode, so
 * a caller can render it straight into a badge. Zero and "not loaded yet" look the same to
 * a badge that hides itself at zero, which is what the Matches tab does.
 */
export function useWhoLikedMeCount(): number {
  const user = useAuthStore((s) => s.user);
  const isDemoMode = useUIStore((s) => s.isDemoMode);

  const { data } = useQuery({
    queryKey: queryKeys.swipes.whoLikedMeCount(),
    queryFn: async (): Promise<number> => {
      const { data: count, error } = await supabase.rpc('count_who_liked_me');
      if (error) {
        console.error('Error counting who liked me:', error);
        throw error;
      }
      return count ?? 0;
    },
    enabled: FEATURE_WHO_LIKES_YOU && !isDemoMode && !!user?.id,
    staleTime: 1000 * 60 * 2,
    // The number is a nudge, not a ledger. Refetching when the app comes back to the
    // foreground is what keeps it roughly current without a subscription on `swipes`.
    refetchOnWindowFocus: true,
  });

  return data ?? 0;
}
