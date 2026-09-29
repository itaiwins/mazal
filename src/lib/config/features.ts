/**
 * Feature Flags
 *
 * Build-time flags for features that exist in the codebase but are not shipped yet.
 * `EXPO_PUBLIC_*` variables are inlined by Metro at build time, so an `if (!FLAG)`
 * branch is statically false in the bundle and the feature is unreachable.
 *
 * Every flag defaults to OFF. Set the env var to the string "true" (in `.env`, in the
 * `env` block of an eas.json build profile, or in the shell) to turn one back on.
 *
 * See docs/ROADMAP.md for what each flag covers and what turning it on needs.
 */

/**
 * Orthodox Shidduch mode: the (orthodox*) and (shidduch*) route groups, the welcome
 * screen entry point, and the `isOrthodoxMode` routing in app/index.tsx.
 */
export const FEATURE_ORTHODOX_MODE =
  process.env.EXPO_PUBLIC_FEATURE_ORTHODOX_MODE === 'true';

/**
 * Parents/grandparents ("Safta") matchmaker mode: the (safta*) route groups, the
 * Safta tab, Safta badges/approvals, and every Safta entry point and mention.
 */
export const FEATURE_SAFTA_MODE =
  process.env.EXPO_PUBLIC_FEATURE_SAFTA_MODE === 'true';

/**
 * Photo/ID verification: the "Verify Your Profile" action on the profile tab and the
 * `app/profile/verify.tsx` flow behind it.
 *
 * OFF, and it stays off until verification moves server-side (MEXA-359 Part B - an Edge
 * Function that calls Rekognition and writes the flag as `service_role`). `is_verified` is
 * the trust badge other users see on the discovery card, and nothing running on the device
 * can honestly decide it:
 *
 *   - No verification provider is configured in any build - `EXPO_PUBLIC_AWS_*` is set
 *     nowhere - so `verifyIdentity()` fell through to mock mode, which awarded the badge
 *     on `Math.random() > 0.1` after the user photographed anything at all.
 *   - `supabase/migrations/00024_revoke_self_awarded_verified_badge.sql` takes
 *     `UPDATE (is_verified)` away from `authenticated`, so that write is now a 42501.
 *
 * Turning this on again needs the Edge Function, not this flag.
 */
export const FEATURE_PHOTO_VERIFICATION =
  process.env.EXPO_PUBLIC_FEATURE_PHOTO_VERIFICATION === 'true';

export const FEATURES = {
  orthodoxMode: FEATURE_ORTHODOX_MODE,
  saftaMode: FEATURE_SAFTA_MODE,
  photoVerification: FEATURE_PHOTO_VERIFICATION,
} as const;
