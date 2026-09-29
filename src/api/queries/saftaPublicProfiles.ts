/**
 * Display details of the Saftas a user is connected to.
 *
 * Exists because of MEXA-302. Four call sites used to get the Safta's name for free by
 * embedding `safta_accounts(...)` under a `safta_connections` or `safta_likes` select, and
 * every one of them came back empty: `safta_accounts` has exactly one SELECT policy,
 * `auth_id = auth.uid()`, so a grandchild matches no row on the account of the Safta who
 * connected to her.
 *
 * Worse than nameless, in one case. `useSaftaConnections` embedded it as
 * `safta_accounts!inner(...)`, and PostgREST turns `!inner` into an inner join - so the
 * unreadable account row did not blank the name, it deleted the connection. The Safta list
 * on the matches tab rendered empty.
 *
 * Migration 00022 adds `public.safta_public_profiles`: `id`, `display_name` and
 * `relationship` only, readable when the caller is the `connected_user_id` of an
 * `accepted` `safta_connections` row pointing at that account (or is the Safta herself).
 * `email` and the `subscription_*` columns stay unreadable by anyone but their owner - no
 * policy on `safta_accounts` was widened. The view is not a table, so it is fetched as a
 * second query keyed on the id list, the same shape `fetchPrimaryPhotoUrls` and
 * `user_public_profiles` already use.
 */

import { supabase } from '@/api/supabase/client';
import type { SaftaPublicProfile } from '@/types/database.types';

/** What the screens render when the Safta's row is not readable. */
export const UNKNOWN_SAFTA_NAME = 'Unknown Safta';
export const DEFAULT_SAFTA_RELATIONSHIP = 'Family';

/**
 * Map every id in `saftaAccountIds` the caller may read to its display row.
 *
 * An id that is missing from the result is not an error: it means the connection is not
 * `accepted`, which is exactly when the name should not be shown. Callers fall back to
 * `UNKNOWN_SAFTA_NAME`.
 *
 * Returns an empty map for an empty id list without issuing a request, because
 * `.in('id', [])` is a round trip that can only return nothing.
 */
export async function fetchSaftaPublicProfiles(
  saftaAccountIds: (string | null | undefined)[]
): Promise<Map<string, SaftaPublicProfile>> {
  const ids = [...new Set(saftaAccountIds)].filter((id): id is string => !!id);
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from('safta_public_profiles')
    .select('id, display_name, relationship')
    .in('id', ids);

  if (error) throw error;

  return new Map((data ?? []).map((row) => [row.id, row]));
}
