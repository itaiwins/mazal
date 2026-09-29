/**
 * What to tell someone when an onboarding photo upload did not fully succeed.
 *
 * MEXA-338, walkthrough finding 13: `app/(onboarding)/complete.tsx` wrapped each upload
 * in `try { … } catch { continue; }` and swallowed a storage error into a `console.error`,
 * so a flaky network finished onboarding and dropped the user into the deck with a profile
 * nobody will swipe on, with no error shown.
 *
 * The decision lives here rather than inline in the screen so it can be checked without a
 * simulator — `scripts/check-photo-upload-outcome.mjs` drives every case offline. The
 * screen's only job is to draw the result.
 */

import { MIN_PHOTOS } from '@/lib/constants/app';

export type PhotoUploadOutcome =
  /** Every photo landed. Say nothing. */
  | { kind: 'ok' }
  /**
   * Some landed, and enough of them: the profile clears `MIN_PHOTOS` and is usable, so
   * this is a notice the user acknowledges rather than a decision.
   */
  | { kind: 'notice'; title: string; message: string }
  /**
   * Too few landed. The profile fails the same floor `app/(onboarding)/photos.tsx` made
   * the user satisfy to get here, so this offers a retry and must default to *not*
   * continuing.
   */
  | { kind: 'blocking'; title: string; message: string };

/** How many failure lines to show. More than this is noise in an Alert. */
export const MAX_FAILURE_LINES = 3;

export function describePhotoUploadOutcome(
  picked: number,
  landed: number,
  failures: readonly string[],
  minPhotos: number = MIN_PHOTOS
): PhotoUploadOutcome {
  // No failure recorded and nothing missing: nothing to say. Both conditions matter —
  // a count that came up short without a recorded reason is still a problem worth
  // reporting, and a recorded failure on a full profile (a photo that was retried, say)
  // is not.
  if (failures.length === 0 && landed >= picked) {
    return { kind: 'ok' };
  }

  const detail = failures.slice(0, MAX_FAILURE_LINES).join('\n');
  const suffix = detail ? `\n\n${detail}` : '';

  if (landed < minPhotos) {
    // Counted rather than spelled out, so the copy stays true if MIN_PHOTOS moves.
    const howMany = landed === 0 ? 'none' : `only ${landed}`;
    return {
      kind: 'blocking',
      title:
        landed === 0
          ? "Your photos didn't upload"
          : `Only ${landed} of your photos uploaded`,
      message:
        `Mazal needs at least ${minPhotos} photos, and ${howMany} made it. Check your ` +
        `connection and try again — without photos, nobody will see your profile.${suffix}`,
    };
  }

  return {
    kind: 'notice',
    title: "Some photos didn't upload",
    message:
      `${landed} of your ${picked} photos are on your profile. You can add the rest ` +
      `from Edit Profile.${suffix}`,
  };
}
