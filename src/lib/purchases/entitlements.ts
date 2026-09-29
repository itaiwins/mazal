/**
 * Entitlement rules
 *
 * The decisions behind "has this account paid for X": read an entitlement out of a
 * RevenueCat `CustomerInfo`, pick the package that sells it, and run the purchase and
 * restore flows around those two.
 *
 * ## Why these are plain functions and not part of the hook (MEXA-293)
 *
 * Nothing here imports `react`, `react-native` or `react-native-purchases` — the store
 * calls arrive through a binding, the way `src/lib/auth/authStateSync.ts` takes its
 * Supabase client. That is what lets `scripts/check-orthodox-entitlement.mjs` drive the
 * real purchase and restore flows in plain Node against a stubbed `Purchases`, on a
 * repo with no test runner and a box with no iOS sandbox.
 *
 * The shapes below are structural stand-ins for `CustomerInfo` and `PurchasesPackage`.
 * They are deliberately looser than the SDK's types (every field optional, nullable):
 * these functions decide whether to unlock a paid feature, so a missing or malformed
 * field has to read as "not entitled", never as a crash and never as access.
 */

/** One entry of `CustomerInfo.entitlements.active`. */
export type ActiveEntitlementLike = {
  isActive?: boolean | null;
  expirationDate?: string | null;
};

/** The part of `CustomerInfo` an entitlement check looks at. */
export type CustomerInfoLike = {
  entitlements?: {
    active?: Record<string, ActiveEntitlementLike | null | undefined> | null;
  } | null;
};

/** The part of `PurchasesPackage` used to match a store product. */
export type PackageLike = {
  identifier?: string | null;
  product?: { identifier?: string | null } | null;
};

/**
 * Is `entitlementId` active on this customer?
 *
 * `=== true` rather than a truthiness test, so an absent entitlement, an absent
 * `active` map, a null `CustomerInfo` (which is what every helper in
 * `src/lib/config/revenuecat.ts` returns when the SDK is unavailable) and a
 * non-boolean `isActive` all come back false. Fail closed.
 */
export function isEntitlementActive(
  info: CustomerInfoLike | null | undefined,
  entitlementId: string
): boolean {
  if (!info || !entitlementId) return false;
  return info.entitlements?.active?.[entitlementId]?.isActive === true;
}

/**
 * When the active entitlement runs out, if RevenueCat said. `undefined` for a
 * lifetime purchase, and for an entitlement that is not active at all.
 */
export function entitlementExpiresAt(
  info: CustomerInfoLike | null | undefined,
  entitlementId: string
): string | undefined {
  if (!isEntitlementActive(info, entitlementId)) return undefined;
  return info?.entitlements?.active?.[entitlementId]?.expirationDate ?? undefined;
}

/**
 * The package selling one of `productIds`, preferring the earliest id in that list.
 *
 * Matched on the store product identifier, not the package identifier: package
 * identifiers are per-offering names (`$rc_monthly`), while the product identifier is
 * the App Store / Play product we actually mean to charge for. No fuzzy fallback - if
 * the offering is missing or names products we do not know, the caller shows "not
 * available" rather than charging for whatever package happened to be there.
 */
export function findPackageForProducts<T extends PackageLike>(
  packages: readonly T[] | null | undefined,
  productIds: readonly string[]
): T | null {
  if (!packages?.length) return null;
  for (const productId of productIds) {
    const match = packages.find((pkg) => pkg?.product?.identifier === productId);
    if (match) return match;
  }
  return null;
}

/**
 * What a purchase or restore attempt ended up meaning for access.
 *
 * `not_entitled` is the case this module exists for: the store call came back fine but
 * the entitlement is not active, so access is refused. Before MEXA-293 the Orthodox
 * paywall had no store call at all and granted access unconditionally.
 */
export type EntitlementOutcome =
  | { status: 'granted'; expiresAt?: string }
  /** The user dismissed the store sheet. Not an error; say nothing. */
  | { status: 'cancelled' }
  /** No package sells this entitlement (offering not configured, or SDK unavailable). */
  | { status: 'unavailable' }
  /** The store call succeeded and the entitlement is still not active. */
  | { status: 'not_entitled' }
  | { status: 'failed'; message: string };

export type EntitlementPurchaseBinding<P extends PackageLike> = {
  /** Every package RevenueCat can sell this user right now. */
  listPackages: () => Promise<readonly P[]>;
  /** `purchasePackage` from `revenuecat.ts`: resolves null when the user cancelled. */
  purchase: (pkg: P) => Promise<CustomerInfoLike | null>;
  /** The entitlement that has to be active afterwards for access to be granted. */
  entitlementId: string;
  /** Store product ids that sell the entitlement, best first. */
  productIds: readonly string[];
};

export type EntitlementRestoreBinding = {
  /** `restorePurchases` from `revenuecat.ts`. */
  restore: () => Promise<CustomerInfoLike | null>;
  entitlementId: string;
};

/** RevenueCat sets `userCancelled` on the error it throws for a dismissed sheet. */
function isUserCancelled(error: unknown): boolean {
  return (error as { userCancelled?: boolean } | null)?.userCancelled === true;
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : String(error);
}

function granted(
  info: CustomerInfoLike | null,
  entitlementId: string
): EntitlementOutcome {
  if (!isEntitlementActive(info, entitlementId)) return { status: 'not_entitled' };
  const expiresAt = entitlementExpiresAt(info, entitlementId);
  return expiresAt ? { status: 'granted', expiresAt } : { status: 'granted' };
}

/**
 * Buy the entitlement, then decide access from the `CustomerInfo` the purchase
 * returned - never from the fact that the call did not throw.
 */
export async function purchaseEntitlement<P extends PackageLike>(
  binding: EntitlementPurchaseBinding<P>
): Promise<EntitlementOutcome> {
  let packages: readonly P[];
  try {
    packages = (await binding.listPackages()) ?? [];
  } catch (error) {
    return { status: 'failed', message: describe(error) };
  }

  const pkg = findPackageForProducts(packages, binding.productIds);
  if (!pkg) return { status: 'unavailable' };

  let info: CustomerInfoLike | null;
  try {
    info = await binding.purchase(pkg);
  } catch (error) {
    if (isUserCancelled(error)) return { status: 'cancelled' };
    return { status: 'failed', message: describe(error) };
  }

  // `purchasePackage` maps a cancelled sheet to null rather than throwing.
  if (!info) return { status: 'cancelled' };

  return granted(info, binding.entitlementId);
}

/** Restore, then check the same entitlement the purchase path checks. */
export async function restoreEntitlement(
  binding: EntitlementRestoreBinding
): Promise<EntitlementOutcome> {
  let info: CustomerInfoLike | null;
  try {
    info = await binding.restore();
  } catch (error) {
    if (isUserCancelled(error)) return { status: 'cancelled' };
    return { status: 'failed', message: describe(error) };
  }

  // A restore with nothing to restore is not a failure - it is "no subscription".
  if (!info) return { status: 'not_entitled' };

  return granted(info, binding.entitlementId);
}
