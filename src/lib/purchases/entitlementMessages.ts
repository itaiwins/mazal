/**
 * What to tell the user about a purchase or restore that did not grant access.
 *
 * Split out from the screens (MEXA-345) so the two paywalls this issue fixed say the same
 * things, and so `scripts/check-paywall-entitlements.mjs` can assert them without a
 * renderer — nothing here imports React or React Native.
 *
 * `null` means say nothing. Two outcomes deserve silence:
 *
 *   - `granted`, because the screen is about to navigate, and
 *   - `cancelled`, because the user dismissed the store sheet themselves. An "error" alert
 *     for a deliberate dismissal reads as a failure the app had.
 *
 * The wording rules that matter:
 *
 *   - `not_entitled` after a *purchase* must not read as a plain failure. The store call
 *     succeeded and the entitlement still is not active, so the honest thing is to point at
 *     Restore Purchases, which is what a user who already paid needs.
 *   - `failed` never shows the underlying message. RevenueCat and StoreKit errors name
 *     products, receipts and accounts; the screen logs the detail and shows a plain line.
 */

import type { EntitlementOutcome } from './entitlements';

export type EntitlementNotice = { title: string; message: string };

export type EntitlementContext = 'purchase' | 'restore';

export function entitlementNotice(
  outcome: EntitlementOutcome,
  context: EntitlementContext,
  /** What the user thinks they are buying, e.g. "Orthodox Mode". */
  productName: string
): EntitlementNotice | null {
  switch (outcome.status) {
    case 'granted':
    case 'cancelled':
      return null;
    case 'unavailable':
      return {
        title: 'Not Available Yet',
        message: `${productName} is not on sale on this device yet. Please try again later.`,
      };
    case 'not_entitled':
      return context === 'restore'
        ? {
            title: 'No Subscription Found',
            message: `We couldn't find an active ${productName} subscription for this account.`,
          }
        : {
            title: 'Purchase Not Confirmed',
            message:
              "The App Store didn't confirm an active subscription. If you have already paid, tap Restore Purchases.",
          };
    case 'failed':
      return {
        title: context === 'restore' ? 'Restore Failed' : 'Purchase Failed',
        message: 'Something went wrong. Please try again.',
      };
  }
}
