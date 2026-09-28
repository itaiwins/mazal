/**
 * Feature Flags
 *
 * Build-time flags for features that exist in the codebase but are not shipped yet.
 * `EXPO_PUBLIC_*` variables are inlined by Metro at build time, so an `if (!FLAG)`
 * branch is statically false in the bundle and the feature is unreachable.
 *
 * Both flags default to OFF. Set the env var to the string "true" (in `.env`, in the
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

export const FEATURES = {
  orthodoxMode: FEATURE_ORTHODOX_MODE,
  saftaMode: FEATURE_SAFTA_MODE,
} as const;
