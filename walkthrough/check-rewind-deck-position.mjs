#!/usr/bin/env node
/**
 * check-rewind-deck-position.mjs — does a rewind put the user back on the right card?
 *
 * MEXA-403's review of MEXA-372 found the one bug the other two checks could not see. The
 * deck-position restore only ran when `apiProfiles` changed identity, and the fast "oops"
 * rewind - the case Rewind exists for - is exactly the case where it does not:
 *
 *   swipe on P  ->  refetch in flight, currentIndex moves off P
 *   tap Rewind  ->  invalidateQueries (cancelRefetch: true) kills that refetch
 *               ->  the cache still holds the pre-swipe deck, which contains P
 *               ->  the replacement fetch is deep-equal to it, so structuralSharing
 *                   returns the SAME reference
 *               ->  the effect never runs, P is never shown, and the remembered id
 *                   survives to hijack the next swipe's refetch
 *
 * **Why this is a node script and not a render step.** It cannot be driven through
 * `check-rewind-button.mjs`. `expo export` is a production bundle, so
 * `DEV_BYPASS_PREMIUM = __DEV__` is false, every fixture is free tier, and a tap on Rewind
 * opens the paywall instead of ever calling the RPC - the render can never execute this
 * code path at all, at any timing. So `src/components/discovery/rewindDeckPosition.ts` is
 * pure and gets driven directly here, as a sequence of events rather than a single call:
 * the bug was in *when* the decision is made, so a check that made one call in isolation
 * would have passed against the broken version too.
 *
 * No network, no fixtures, no credentials.
 *
 *   cd REPOS/mazal-MEXA-372
 *   node walkthrough/check-rewind-deck-position.mjs
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'src', 'components', 'discovery', 'rewindDeckPosition.ts');

// The module under test is pure TypeScript with no imports, so transpiling it and
// evaluating it is enough - no jest, no babel, no bundler (see the repo's other .mjs
// checks). `transpileModule` strips types without typechecking; `tsc --noEmit` is what
// covers the types, and it is run separately.
const js = ts.transpileModule(readFileSync(SRC, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

const { rewindLanding, deckIndexAfterChange } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
);

const failures = [];
let passes = 0;
function record(ok, label, detail) {
  if (ok) {
    passes += 1;
    console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`);
    return;
  }
  failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

const deck = (...ids) => ids.map((id) => ({ id }));

/**
 * A miniature of the screen: the two pieces of state the real one keeps, driven through
 * the same two entry points in the same order the component calls them. Modelling the
 * *sequence* is the point - each individual answer was already "right" in the broken
 * version; what was wrong was which deck the question got asked about, and when.
 */
function makeScreen(initialDeck) {
  return {
    currentIndex: 0,
    pendingRewindId: null,
    deck: initialDeck,

    /** `handlePass` / `handleLike` onSettled. */
    swipeSettled() {
      this.currentIndex += 1;
    },

    /** `useUndoSwipe`'s per-call onSuccess. */
    rewindSucceeded(swipedId) {
      const landing = rewindLanding(this.deck, swipedId);
      this.pendingRewindId = landing.pendingRewindId;
      if (landing.landOn !== null) this.currentIndex = landing.landOn;
    },

    /** A refetch landing with a NEW `apiProfiles` identity: the effect fires. */
    deckArrived(newDeck) {
      this.deck = newDeck;
      const pending = this.pendingRewindId;
      this.pendingRewindId = null;
      this.currentIndex = deckIndexAfterChange(newDeck, pending);
    },

    /**
     * A refetch landing deep-equal to the cache: `structuralSharing` returns the same
     * reference, React sees no change, and **the effect does not fire**. Modelled as a
     * no-op on purpose - this line is the bug.
     */
    deckArrivedIdentical() {},

    showing() {
      return this.deck[this.currentIndex]?.id ?? null;
    },
  };
}

console.log('\nMEXA-372 / MEXA-403 rewind deck position (pure, no network)\n');

// ---------------------------------------------------------------------------
console.log('--- the fast path: swipe, then Rewind before the refetch lands\n');
{
  const s = makeScreen(deck('A', 'B', 'C'));
  record(s.showing() === 'A', 'starts on A');

  s.swipeSettled(); // swipe on A; its refetch is in flight
  record(s.showing() === 'B', 'after swiping A the deck shows B');

  // The rewind's invalidate cancels that refetch, so the cache still holds [A,B,C].
  s.rewindSucceeded('A');
  record(s.showing() === 'A', 'Rewind puts A back on screen immediately', 'this is the MEXA-403 bug');
  record(s.pendingRewindId === null, 'and remembers nothing, because there is nothing to wait for');

  // The replacement fetch is deep-equal, so the effect never fires.
  s.deckArrivedIdentical();
  record(s.showing() === 'A', 'the deep-equal refetch does not move it');

  // Carry on swiping. The deck that arrives next is ordered so that landing on A and
  // landing on "the top" are different answers - `C` first, `A` second - which is what
  // makes this comparable with the control block at the bottom: same arrival, and the
  // pre-fix logic lands on A where this lands on C.
  s.swipeSettled();
  s.deckArrived(deck('C', 'A'));
  record(s.showing() === 'C', 'a later deck change is NOT hijacked back to A', 'the stale-ref half of the bug');
}

// ---------------------------------------------------------------------------
console.log('\n--- the slow path: the swipe refetch lands first\n');
{
  const s = makeScreen(deck('A', 'B', 'C'));
  s.swipeSettled();
  s.deckArrived(deck('B', 'C')); // A is gone before the user taps Rewind
  record(s.showing() === 'B', 'the deck dropped A and reset to the top');

  s.rewindSucceeded('A');
  record(s.showing() === 'B', 'nothing to land on yet, so the deck does not move');
  record(s.pendingRewindId === 'A', 'A is remembered for the refetch');

  // A comes back, and the sort does not put them where they were.
  s.deckArrived(deck('B', 'A', 'C'));
  record(s.showing() === 'A', 'the rewind refetch lands on A wherever the sort put them', 'index 1, not 0');
  record(s.pendingRewindId === null, 'and the id is consumed');
}

// ---------------------------------------------------------------------------
console.log('\n--- a rewind whose person the new deck does not contain\n');
{
  const s = makeScreen(deck('A', 'B', 'C'));
  s.swipeSettled();
  s.deckArrived(deck('B', 'C'));
  s.rewindSucceeded('A');
  // A filter change, or the 50-row limit, drops A entirely.
  s.deckArrived(deck('B', 'C', 'D'));
  record(s.showing() === 'B', 'falls back to the top of the deck rather than -1');
  record(s.pendingRewindId === null, 'and does not stay armed');
}

// ---------------------------------------------------------------------------
console.log('\n--- an ordinary swipe with no rewind in play is unchanged\n');
{
  const s = makeScreen(deck('A', 'B', 'C'));
  s.swipeSettled();
  s.deckArrived(deck('B', 'C'));
  record(s.showing() === 'B' && s.currentIndex === 0, 'resets to the top of the new deck');
}

// ---------------------------------------------------------------------------
console.log('\n--- the refusal shape: a success with no swiped_id\n');
{
  const s = makeScreen(deck('A', 'B', 'C'));
  s.swipeSettled();
  s.rewindSucceeded(null);
  record(s.showing() === 'B', 'the deck does not move');
  record(s.pendingRewindId === null, 'and nothing is armed', 'a null id must not be remembered');

  const landing = rewindLanding(deck('A'), null);
  record(landing.landOn === null, 'rewindLanding(null) lands nowhere', JSON.stringify(landing));
}

// ---------------------------------------------------------------------------
// The control. A check that passes proves nothing on its own - the walkthrough NOTES.md
// rule, and it has already caught one vacuous assertion on this issue. There is no
// pre-fix bundle to run here because the fix introduced the module, so the control is the
// old logic modelled inline: `onSuccess` only ever armed the ref, and the effect was the
// only thing that could land. If these two ever start passing, this scenario has stopped
// discriminating and the check above is no longer evidence of anything.
console.log('\n--- control: the pre-fix logic, which must still fail the fast path\n');
{
  const s = makeScreen(deck('A', 'B', 'C'));
  // Pre-fix `onSuccess`: arm and wait, with no look at the deck we are holding.
  s.rewindSucceeded = function (swipedId) {
    this.pendingRewindId = swipedId;
  };

  s.swipeSettled();
  s.rewindSucceeded('A');
  s.deckArrivedIdentical(); // structuralSharing: no new reference, no effect

  record(s.showing() !== 'A', 'pre-fix: Rewind does NOT bring A back', `showed ${s.showing()}`);
  record(s.pendingRewindId === 'A', 'pre-fix: ...and A stays armed with nothing coming to consume it');

  // The user carries on swiping. A's swipe was undone, so A is back in the server's answer.
  // Same arrival as the fast-path block above, `[C, A]` - where that one lands on C, the
  // stale id resolves to a real row here and throws the user onto A.
  s.swipeSettled();
  s.deckArrived(deck('C', 'A'));
  record(
    s.showing() === 'A',
    'pre-fix: ...so the same deck change hijacks them onto A',
    `fixed lands on C, pre-fix landed on ${s.showing()}`
  );
}

// ---------------------------------------------------------------------------
console.log('\n--- the units on their own\n');
{
  record(rewindLanding(deck('A', 'B'), 'B').landOn === 1, 'rewindLanding finds by id, not by position');
  record(rewindLanding([], 'A').pendingRewindId === 'A', 'an empty deck arms the wait');
  record(deckIndexAfterChange(deck('A', 'B'), null) === 0, 'no pending rewind resets to 0');
  record(deckIndexAfterChange(deck('A', 'B'), 'B') === 1, 'a pending rewind lands on its person');
  record(deckIndexAfterChange(deck('A', 'B'), 'Z') === 0, 'a pending rewind for a missing person resets to 0');
}

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
