/**
 * Prices for the paywall, derived only from what the store actually quoted.
 *
 * MEXA-338 finding 6 / MEXA-387: `app/premium/index.tsx` loaded RevenueCat offerings in a
 * `useEffect` and, on failure, did `console.error` and nothing else — `packages` stayed `[]`
 * and the screen rendered `PRICING` from `src/lib/config/revenuecat.ts`, which is hardcoded.
 * So whenever StoreKit was slow, offline or unconfigured, a tester saw confident prices no
 * store had quoted ($119.99/yr and $14.99/mo on MEXA-328 pack screen 30). App Review is
 * specifically touchy about that, and it is also just untrue.
 *
 * Lelouch's call on MEXA-387 was option (a): show nothing until the store answers, say so
 * if it does not, and let no `PRICING` number render as a price.
 *
 * Every string this module returns comes from a `PurchasesStoreProduct`:
 *
 *   - `displayPrice` is `product.priceString` — the store's own formatted price.
 *   - `monthlyEquivalent` is `product.pricePerMonthString`, which RevenueCat derives with a
 *     currency formatter for the current locale. Not computed here: dividing a number by 12
 *     and gluing a currency symbol on gets the formatting wrong in most locales.
 *   - `savingsPercent` is the only computed value, from the two numeric `price`s, and it is
 *     a percentage rather than money — so there is no currency to get wrong.
 *
 * Nothing here imports React Native, so `scripts/check-store-pricing.mjs` can drive it.
 */

/** The shape this module needs. A real `PurchasesPackage` satisfies it structurally. */
export type PricedPackage = {
  product: {
    identifier: string;
    price: number;
    priceString: string;
    pricePerMonthString?: string | null;
  };
};

export type BillingPeriod = 'monthly' | 'yearly';

export type StorePrice = {
  /** The store's own formatted price, e.g. "$119.99" or "119,99 €". */
  displayPrice: string;
  /** The store's per-month figure for a yearly plan, or null when it did not supply one. */
  monthlyEquivalent: string | null;
};

export type PlanPrices = {
  yearly: StorePrice | null;
  monthly: StorePrice | null;
  /**
   * Whole percent saved by paying yearly, or null unless **both** prices are present and
   * the yearly one is actually cheaper per month. A savings badge with only one real price
   * behind it is the same defect in a smaller font.
   */
  savingsPercent: number | null;
};

/** A plan's store product id for each billing period. */
export type PeriodProductIds = { readonly monthly: string; readonly yearly: string };

/**
 * The identifier convention the app and App Store Connect share — for the plans that
 * follow it.
 *
 * Safta Pro does not: `PRODUCTS.SAFTA_PRO_MONTHLY` is `safta_pro_monthly`, with no
 * `mazal_` prefix (MEXA-345). Rather than rename a product id, which is an App Store
 * Connect identity and not ours to change here, every function below takes the two ids
 * explicitly and this helper is just the shorthand for the plans that do fit.
 */
export function productIdFor(plan: string, period: BillingPeriod): string {
  return `mazal_${plan}_${period}`;
}

/** The pair of ids for a plan that follows the `mazal_<plan>_<period>` convention. */
export function planProductIds(plan: string): PeriodProductIds {
  return { monthly: productIdFor(plan, 'monthly'), yearly: productIdFor(plan, 'yearly') };
}

/**
 * The package selling exactly `productId`.
 *
 * Generic over the element type, so a caller holding real `PurchasesPackage`s gets one
 * back and can hand it straight to `purchasePackage()` — narrowing to `PricedPackage`
 * here would throw away the fields RevenueCat needs.
 *
 * Exact match only. A paywall that fell back to "whatever package was in the offering"
 * would charge a price it never showed.
 */
export function findPackageById<T extends PricedPackage>(
  packages: readonly T[],
  productId: string
): T | null {
  if (!productId) return null;
  return packages.find((p) => p.product?.identifier === productId) ?? null;
}

export function findPackage<T extends PricedPackage>(
  packages: readonly T[],
  plan: string,
  period: BillingPeriod
): T | null {
  return findPackageById(packages, productIdFor(plan, period));
}

function priceFrom(pkg: PricedPackage | null): StorePrice | null {
  // A package with no `priceString` is not a price. Treated as absent rather than shown as
  // an empty string, which would read as free.
  const raw = pkg?.product?.priceString;
  if (!raw || !raw.trim()) return null;
  return {
    displayPrice: raw,
    monthlyEquivalent: pkg?.product?.pricePerMonthString?.trim() || null,
  };
}

/** Prices for a plan whose two product ids are given outright. */
export function pricesFromProductIds(
  packages: readonly PricedPackage[],
  ids: PeriodProductIds
): PlanPrices {
  const yearlyPkg = findPackageById(packages, ids.yearly);
  const monthlyPkg = findPackageById(packages, ids.monthly);
  const yearly = priceFrom(yearlyPkg);
  const monthly = priceFrom(monthlyPkg);

  let savingsPercent: number | null = null;
  const yearlyPrice = yearlyPkg?.product?.price;
  const monthlyPrice = monthlyPkg?.product?.price;
  if (
    yearly &&
    monthly &&
    typeof yearlyPrice === 'number' &&
    typeof monthlyPrice === 'number' &&
    yearlyPrice > 0 &&
    monthlyPrice > 0
  ) {
    const yearAtMonthlyRate = monthlyPrice * 12;
    const saved = Math.round(((yearAtMonthlyRate - yearlyPrice) / yearAtMonthlyRate) * 100);
    // Only a real saving is worth a badge. A yearly plan that costs more is not "0% off".
    if (saved > 0) savingsPercent = saved;
  }

  return { yearly, monthly, savingsPercent };
}

export function planPricesFromPackages(
  packages: readonly PricedPackage[],
  plan: string
): PlanPrices {
  return pricesFromProductIds(packages, planProductIds(plan));
}

/** Where the paywall is in its conversation with the store. */
export type OfferingsState = 'loading' | 'ready' | 'unavailable';

/**
 * What the paywall may do, given the state and the prices.
 *
 * `canPurchase` is the important one: it gates the button, and it is false whenever there
 * is no store price for the selected plan and period — which is also exactly when a
 * purchase would have failed. The screen used to answer that case with an Alert titled
 * "Demo Mode" that quoted the hardcoded price, so a tester who wanted to pay was told the
 * app was a demo. That path is gone.
 */
export function paywallAvailability(
  state: OfferingsState,
  prices: PlanPrices,
  period: BillingPeriod
): { showPrices: boolean; showSpinner: boolean; showUnavailable: boolean; canPurchase: boolean } {
  const selected = period === 'yearly' ? prices.yearly : prices.monthly;
  if (state === 'loading') {
    return { showPrices: false, showSpinner: true, showUnavailable: false, canPurchase: false };
  }
  if (state === 'ready' && selected) {
    return { showPrices: true, showSpinner: false, showUnavailable: false, canPurchase: true };
  }
  // 'unavailable', or 'ready' with nothing for this plan and period, are the same to a user.
  return { showPrices: false, showSpinner: false, showUnavailable: true, canPurchase: false };
}

/** The one line shown where the prices would be. */
export const PRICES_UNAVAILABLE_MESSAGE = 'Prices unavailable, check your connection';
