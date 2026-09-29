/**
 * Where the discovery deck should point after a rewind (MEXA-372).
 *
 * This is pure on purpose. The rule it encodes is the part of Rewind that is easiest to
 * get wrong and impossible to see in the walkthrough render - the render runs a production
 * bundle, so `DEV_BYPASS_PREMIUM = __DEV__` is false, every fixture is free tier, and a tap
 * on Rewind opens the paywall instead of ever calling the RPC. Nothing rendered can reach
 * this code. Extracted here so it can be driven directly in node instead
 * (`walkthrough/check-rewind-deck-position.mjs`).
 *
 * =====================================================
 * The problem
 * =====================================================
 *
 * The screen holds `currentIndex` into a deck that arrives from React Query, and both a
 * swipe and a rewind invalidate `queryKeys.discovery.all`. A rewind has to put the user
 * back on the person it undid, and that person's position is not something the screen can
 * compute: the deck is sorted by `has_liked_me` then `elo_score`, so `currentIndex - 1` is
 * a guess. They have to be found by id.
 *
 * The subtle half is *which* deck to search, and it is what MEXA-403's review caught:
 *
 *  - **Slow path.** The swipe's refetch has already landed, so the deck no longer contains
 *    them. Nothing to find yet. Remember the id, and land when the rewind's own refetch
 *    brings them back - that arrival changes `apiProfiles`, which is what wakes the effect.
 *  - **Fast path**, and it is the one Rewind exists for - swipe, then "oops" a second
 *    later. The swipe's refetch is still in flight when the rewind's `invalidateQueries`
 *    fires, and `cancelRefetch` defaults to true, so that refetch is *cancelled* and the
 *    cache still holds the pre-swipe deck. The replacement fetch then returns a deck that
 *    is deep-equal to the cached one (the sort is deterministic and a swipe changes no
 *    elo), and TanStack v5's `structuralSharing` hands back **the same reference**. So
 *    `apiProfiles` never changes identity and an effect keyed on it never runs.
 *
 * Waiting for the refetch therefore does not work in the fast path: the rewind reports
 * success and the card does not come back. Worse, the remembered id survives, and the
 * *next* swipe's refetch consumes it and throws the user onto a card they did not ask for.
 *
 * =====================================================
 * The rule
 * =====================================================
 *
 * Look in the deck we are holding *right now*, at the moment the rewind succeeds. In the
 * fast path they are already in it - the cache was never updated - so land immediately and
 * remember nothing. Only when they are genuinely absent is there anything to wait for.
 *
 * `rewindLanding()` is that decision; `deckIndexAfterChange()` is what the wait resolves
 * to. Between them they are the whole of it, and neither one asks whether a refetch
 * produced a new object.
 *
 * One case is deliberately given up on: if the rewind's refetch *does* arrive with a new
 * identity after we already landed (someone else's profile changed in the same window),
 * the deck-changed path resets to the top and the user is at index 0 rather than on the
 * rewound card. That is the right way to lose. The alternative - keeping the id armed so a
 * later arrival can re-land - is exactly the stale jump above, and being put back at the
 * top of your own deck is a non-event next to being thrown onto an arbitrary stranger.
 */

/** The shape of a deck entry this module needs. The real one is `DiscoveryUser`. */
export interface RewindDeckEntry {
  id: string;
}

export interface RewindLanding {
  /**
   * The index to show now, or null when the rewound person is not in the deck we hold.
   * Null does **not** mean failure - it means the answer has to wait for the refetch.
   */
  landOn: number | null;
  /**
   * The id to remember for the next deck change, or null when there is nothing to wait
   * for. Always assign this to the pending-rewind ref, including when it is null: leaving
   * a stale id armed after a successful landing is the bug this file exists to prevent.
   */
  pendingRewindId: string | null;
}

/**
 * Called the moment `undo_last_swipe()` reports success, with the deck the screen is
 * currently rendering and the `swiped_id` the function returned.
 *
 * `swipedId` is nullable because `UndoLastSwipeResult` is: the refusal branches return NULL
 * for every column but `ok` and `reason`. A success is documented to carry the id, so null
 * here means the server said something the client has no answer for - leave the deck
 * exactly where it is and remember nothing, rather than arming a null or landing on
 * `findIndex`'s -1.
 */
export function rewindLanding(
  profiles: ReadonlyArray<RewindDeckEntry>,
  swipedId: string | null
): RewindLanding {
  if (!swipedId) {
    return { landOn: null, pendingRewindId: null };
  }

  const index = profiles.findIndex((p) => p.id === swipedId);

  if (index >= 0) {
    return { landOn: index, pendingRewindId: null };
  }

  return { landOn: null, pendingRewindId: swipedId };
}

/**
 * Called when the deck data changes identity. Without a pending rewind this is the
 * screen's long-standing "reset to the top" behaviour; with one, it is where the slow path
 * finally lands.
 *
 * Falls back to 0 when the pending person is not in the new deck. That is a real case and
 * not a defensive nicety: the deck's 50-row limit and its age, distance and gender filters
 * can all exclude somebody the user swiped on before changing a filter.
 */
export function deckIndexAfterChange(
  profiles: ReadonlyArray<RewindDeckEntry>,
  pendingRewindId: string | null
): number {
  if (!pendingRewindId) {
    return 0;
  }

  const index = profiles.findIndex((p) => p.id === pendingRewindId);
  return index >= 0 ? index : 0;
}
