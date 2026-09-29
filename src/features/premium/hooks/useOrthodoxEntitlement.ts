/**
 * Orthodox entitlement hook
 *
 * The one place the Orthodox path answers "has this account paid": the RevenueCat
 * `mazal_orthodox` entitlement, read the way `usePremium` reads gold and platinum.
 *
 * ## Why not `users.orthodox_subscription_status` (MEXA-292/293)
 *
 * The Orthodox paywall used to set that column itself, with no purchase behind it, and
 * the login and restore paths trusted it. Since 00015 the column is not in
 * `authenticated`'s UPDATE grant, so no client can write it and nothing else does - it
 * is always NULL, and reading it means nobody ever gets in. Nothing server-side reads
 * it either (no RLS policy, function or cron), so the entitlement is the whole truth
 * and the column keeps no writer. Only a receipt-verifying server process would earn
 * one back.
 *
 * The purchase and restore flows themselves live in `@/lib/purchases/entitlements` as
 * plain functions over an injected binding, so `scripts/check-orthodox-entitlement.mjs`
 * can exercise them in Node. This hook is the wiring: the real store calls plus a
 * loading flag.
 */

import { useCallback, useState } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  DEV_BYPASS_PREMIUM,
  ENTITLEMENTS,
  PRODUCTS,
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

/**
 * The products that sell Orthodox mode, best first. Monthly leads because the paywall
 * only advertises the monthly price; the yearly product is a fallback for an offering
 * that carries just that one. Both identifiers are configured in the RevenueCat
 * dashboard and App Store Connect by Itai, not here.
 */
const ORTHODOX_PRODUCT_IDS = [
  PRODUCTS.ORTHODOX_MONTHLY,
  PRODUCTS.ORTHODOX_YEARLY,
] as const;

export type { EntitlementOutcome };

export function useOrthodoxEntitlement() {
  const [isBusy, setIsBusy] = useState(false);

  /**
   * Does this account hold the entitlement right now? Used by the login screens to
   * decide between the Orthodox tabs and the paywall, and by the paywall to make a
   * retry after a failed profile write safe (see `paywall.tsx`).
   *
   * False whenever RevenueCat cannot answer - no API key, Expo Go, offline. Failing
   * closed sends a paying user to the paywall, where Restore Purchases gets them back
   * in; failing open would hand the Orthodox pool to anyone who turned off wifi.
   */
  const checkEntitlement = useCallback(async (): Promise<boolean> => {
    // Same bypass the rest of the app uses; `__DEV__` is false in any release bundle.
    if (DEV_BYPASS_PREMIUM) return true;
    return isEntitlementActive(await getCustomerInfo(), ENTITLEMENTS.ORTHODOX);
  }, []);

  /** Buy Orthodox mode. Grants only on an active entitlement in the returned info. */
  const purchaseOrthodox = useCallback(async (): Promise<EntitlementOutcome> => {
    if (DEV_BYPASS_PREMIUM) return { status: 'granted' };

    setIsBusy(true);
    try {
      return await purchaseEntitlement<PurchasesPackage>({
        listPackages: getAllPackages,
        purchase: purchasePackage,
        entitlementId: ENTITLEMENTS.ORTHODOX,
        productIds: ORTHODOX_PRODUCT_IDS,
      });
    } finally {
      setIsBusy(false);
    }
  }, []);

  /** Restore an Orthodox purchase made on another install or device. */
  const restoreOrthodox = useCallback(async (): Promise<EntitlementOutcome> => {
    if (DEV_BYPASS_PREMIUM) return { status: 'granted' };

    setIsBusy(true);
    try {
      return await restoreEntitlement({
        restore: restorePurchases,
        entitlementId: ENTITLEMENTS.ORTHODOX,
      });
    } finally {
      setIsBusy(false);
    }
  }, []);

  return { isBusy, checkEntitlement, purchaseOrthodox, restoreOrthodox };
}
