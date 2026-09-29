/**
 * The wiring between a paywall screen and a RevenueCat entitlement.
 *
 * ## Why this exists (MEXA-345)
 *
 * Three screens sell something. Two of them never asked the store at all:
 *
 *   - `app/(orthodox)/paywall.tsx` slept 1500ms and then set the persisted
 *     `hasOrthodoxSubscription` flag to true, with an alert saying the subscription was
 *     active. Its Restore button always answered "No Purchases".
 *   - `app/(safta-auth)/paywall.tsx` wrote `safta_accounts.subscription_status = 'active'`
 *     from the client and its Restore button read that column back. Measured on the live
 *     project 2026-09-29: `authenticated` holds UPDATE on that column and the
 *     `Safta can update own account` policy has no `WITH CHECK`, so the write really does
 *     land — any Safta account could give itself Safta Pro with one request.
 *
 * `useOrthodoxEntitlement` (MEXA-293) fixed the third, `(orthodox-auth)/paywall.tsx`, by
 * wiring `src/lib/purchases/entitlements.ts` to the SDK. This is the same wiring with the
 * entitlement and the products as arguments instead of constants, so the two remaining
 * paywalls do not each grow their own copy. The decisions all still live in
 * `entitlements.ts`, which is plain functions over an injected binding and is what
 * `scripts/check-paywall-entitlements.mjs` drives.
 *
 * `useOrthodoxEntitlement` is deliberately left alone here: it is under security review on
 * MEXA-347 and collapsing it onto this hook while a reviewer is reading it would invalidate
 * the review. It is a thin wrapper over the same functions and can be folded in afterwards.
 *
 * ## Products are a call argument, not hook config
 *
 * Both screens have a monthly/yearly toggle, and the purchase must be for the period the
 * user picked — not "monthly, falling back to yearly", which would charge a price the
 * screen never showed. So `purchase()` takes the ids, and the caller passes exactly the one
 * it is advertising.
 */

import { useCallback, useState } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  DEV_BYPASS_PREMIUM,
  getAllPackages,
  getCustomerInfo,
  purchasePackage,
  restorePurchases,
} from '@/lib/config/revenuecat';
import {
  isEntitlementActive,
  purchaseEntitlement,
  restoreEntitlement,
  type EntitlementOutcome,
} from '@/lib/purchases/entitlements';

export type { EntitlementOutcome };

export function useEntitlement(entitlementId: string) {
  const [isBusy, setIsBusy] = useState(false);

  /**
   * Does this account hold the entitlement right now?
   *
   * False whenever RevenueCat cannot answer - no API key, Expo Go, offline. Failing
   * closed sends a paying user to the paywall, where Restore Purchases gets them back
   * in; failing open would hand a paid mode to anyone who turned off wifi.
   */
  const checkEntitlement = useCallback(async (): Promise<boolean> => {
    // Same bypass the rest of the app uses; `__DEV__` is false in any release bundle.
    if (DEV_BYPASS_PREMIUM) return true;
    return isEntitlementActive(await getCustomerInfo(), entitlementId);
  }, [entitlementId]);

  /**
   * Buy one of `productIds`, earliest first, and grant only if the `CustomerInfo` the
   * purchase returned carries the entitlement - never because the call did not throw.
   */
  const purchase = useCallback(
    async (productIds: readonly string[]): Promise<EntitlementOutcome> => {
      if (DEV_BYPASS_PREMIUM) return { status: 'granted' };

      setIsBusy(true);
      try {
        return await purchaseEntitlement<PurchasesPackage>({
          listPackages: getAllPackages,
          purchase: purchasePackage,
          entitlementId,
          productIds,
        });
      } finally {
        setIsBusy(false);
      }
    },
    [entitlementId]
  );

  /** Restore a purchase made on another install or device, then check the entitlement. */
  const restore = useCallback(async (): Promise<EntitlementOutcome> => {
    if (DEV_BYPASS_PREMIUM) return { status: 'granted' };

    setIsBusy(true);
    try {
      return await restoreEntitlement({ restore: restorePurchases, entitlementId });
    } finally {
      setIsBusy(false);
    }
  }, [entitlementId]);

  return { isBusy, checkEntitlement, purchase, restore };
}
