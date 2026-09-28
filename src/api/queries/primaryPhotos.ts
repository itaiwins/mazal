/**
 * Primary photo lookup for a list of other users.
 *
 * Exists because of MEXA-279. Screens used to get photos for free by embedding
 * `photos:user_photos(...)` under a `users` select, but since 00013 (MEXA-261) `users` is
 * own-row-only and other people come from the `user_public_profiles` view instead. The view
 * is not a table, so the app fetches photos as a second query keyed on the id list - the
 * same shape `useDiscoveryProfiles` and `useMatches` already use - and three screens needed
 * the identical "one photo per user" reduction afterwards.
 *
 * Cross-user reads still work: 00013 rewrote `user_photos."Users can view other photos"` to
 * ask `public.is_discoverable_profile(user_id)`, which is the same active / not-you / not-
 * blocked rule the view applies. No policy was widened for this.
 */

import { supabase } from '@/api/supabase/client';

/**
 * Map every id in `userIds` that has a photo to its primary photo URL.
 *
 * "Primary" is `photo_order = 0` when present, otherwise the lowest `photo_order` on file -
 * which is what the embedded version did, given it took `find(p => p.photo_order === 0)`
 * and fell back to the first row of an order-by-`photo_order` embed.
 *
 * Returns an empty map for an empty id list without issuing a request, because
 * `.in('user_id', [])` is a round trip that can only return nothing.
 */
export async function fetchPrimaryPhotoUrls(userIds: string[]): Promise<Map<string, string>> {
  const primary = new Map<string, string>();
  if (userIds.length === 0) return primary;

  const { data, error } = await supabase
    .from('user_photos')
    .select('user_id, photo_url, photo_order')
    .in('user_id', userIds)
    .order('photo_order', { ascending: true });

  if (error) throw error;

  // Ordered by photo_order, so the first row seen for a user is already their primary one.
  for (const photo of data ?? []) {
    if (photo.user_id && photo.photo_url && !primary.has(photo.user_id)) {
      primary.set(photo.user_id, photo.photo_url);
    }
  }

  return primary;
}
