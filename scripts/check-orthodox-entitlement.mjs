#!/usr/bin/env node
/**
 * check-orthodox-entitlement.mjs - the corpus behind MEXA-293.
 *
 * Offline: no Supabase, no RevenueCat, no credentials, no network, no iOS sandbox. It
 * transpiles `src/lib/purchases/entitlements.ts` in memory (that module imports
 * nothing, which is why the flows live there rather than in the hook) and drives the
 * real `purchaseEntitlement` and `restoreEntitlement` against a stubbed store:
 * `listPackages`, `purchase` and `restore` are the three calls `useOrthodoxEntitlement`
 * wires to `react-native-purchases`, so a stub at that seam exercises every decision
 * the screens make.
 *
 *   node scripts/check-orthodox-entitlement.mjs        # one line per failure, exit 1 on any
 *   node scripts/check-orthodox-entitlement.mjs -v     # also print every passing case
 *
 * The case this exists for is PURCHASE 2: the store call succeeds and the entitlement
 * is not active. Before MEXA-293 the Orthodox paywall made no store call at all - it
 * wrote `users.orthodox_subscription_status = 'active'` itself and let anyone in. Any
 * change that lets a non-granted outcome through here re-opens that.
 *
 * The WIRING section is the other half. The flows are generic over an entitlement id,
 * so this file's stub product ids prove nothing on their own unless the identifiers the
 * hook passes really are the Orthodox ones - those are asserted against the source text
 * of `revenuecat.ts` and `useOrthodoxEntitlement.ts`, which is all a Node script can do
 * for a module that imports react-native.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SOURCE = path.join(ROOT, 'src', 'lib', 'purchases', 'entitlements.ts');
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

const ORTHODOX = 'mazal_orthodox';
const ORTHODOX_MONTHLY = 'mazal_orthodox_monthly';
const ORTHODOX_YEARLY = 'mazal_orthodox_yearly';
const ORTHODOX_PRODUCTS = [ORTHODOX_MONTHLY, ORTHODOX_YEARLY];

async function loadModule() {
  const js = ts.transpileModule(fs.readFileSync(SOURCE, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: SOURCE,
  }).outputText;
  const tmp = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'mazal-entitlements-')),
    'entitlements.mjs'
  );
  fs.writeFileSync(tmp, js);
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }
}

/** A `CustomerInfo` shaped like the SDK's, with the named entitlements active. */
function customerInfo(activeIds, { expirationDate = null } = {}) {
  const active = {};
  for (const id of activeIds) {
    active[id] = {
      identifier: id,
      isActive: true,
      willRenew: true,
      periodType: 'NORMAL',
      latestPurchaseDate: '2026-09-29T00:00:00Z',
      originalPurchaseDate: '2026-09-29T00:00:00Z',
      expirationDate,
      productIdentifier: `${id}_monthly`,
      store: 'APP_STORE',
      unsubscribeDetectedAt: null,
      billingIssueDetectedAt: null,
    };
  }
  return {
    entitlements: { active, all: active, verification: 'NOT_REQUESTED' },
    activeSubscriptions: Object.keys(active),
    originalAppUserId: 'stub-user',
  };
}

/** A `PurchasesPackage` shaped like the SDK's. */
function pkg(productId, { offeringIdentifier = 'orthodox', identifier = '$rc_monthly' } = {}) {
  return {
    identifier,
    packageType: 'MONTHLY',
    offeringIdentifier,
    product: {
      identifier: productId,
      description: 'stub',
      title: 'stub',
      price: 49.99,
      priceString: '$49.99',
      currencyCode: 'USD',
    },
  };
}

/** The error `react-native-purchases` throws when the user dismisses the sheet. */
function cancelledError() {
  const error = new Error('Purchase was cancelled.');
  error.userCancelled = true;
  error.code = '1';
  return error;
}

const failures = [];
let passes = 0;

function record(ok, label, detail) {
  if (ok) {
    passes += 1;
    if (VERBOSE) console.log(`  ok   ${label}`);
    return;
  }
  failures.push(label);
  console.log(`  FAIL ${label}${detail ? ` - ${detail}` : ''}`);
}

function eq(actual, expected, label) {
  record(
    actual === expected,
    label,
    actual === expected ? '' : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`
  );
}

function status(outcome, expected, label) {
  eq(outcome?.status, expected, label);
}

async function main() {
  const {
    isEntitlementActive,
    entitlementExpiresAt,
    findPackageForProducts,
    purchaseEntitlement,
    restoreEntitlement,
  } = await loadModule();

  console.log('ENTITLEMENT READ');
  eq(isEntitlementActive(customerInfo([ORTHODOX]), ORTHODOX), true, 'active orthodox reads active');
  eq(isEntitlementActive(customerInfo([ORTHODOX, 'mazal_gold']), ORTHODOX), true, 'active alongside gold');
  eq(isEntitlementActive(customerInfo(['mazal_gold']), ORTHODOX), false, 'gold alone is not orthodox');
  eq(isEntitlementActive(customerInfo([]), ORTHODOX), false, 'no entitlements');
  eq(isEntitlementActive(null, ORTHODOX), false, 'null CustomerInfo (SDK unavailable)');
  eq(isEntitlementActive(undefined, ORTHODOX), false, 'undefined CustomerInfo');
  eq(isEntitlementActive({}, ORTHODOX), false, 'CustomerInfo with no entitlements key');
  eq(isEntitlementActive({ entitlements: null }, ORTHODOX), false, 'null entitlements');
  eq(isEntitlementActive({ entitlements: { active: null } }, ORTHODOX), false, 'null active map');
  eq(
    isEntitlementActive({ entitlements: { active: { [ORTHODOX]: { isActive: false } } } }, ORTHODOX),
    false,
    'expired entitlement (isActive false)'
  );
  eq(
    isEntitlementActive({ entitlements: { active: { [ORTHODOX]: {} } } }, ORTHODOX),
    false,
    'entry with no isActive'
  );
  eq(
    isEntitlementActive({ entitlements: { active: { [ORTHODOX]: { isActive: 'true' } } } }, ORTHODOX),
    false,
    'string "true" is not active'
  );
  eq(
    isEntitlementActive({ entitlements: { active: { [ORTHODOX]: { isActive: 1 } } } }, ORTHODOX),
    false,
    'truthy 1 is not active'
  );
  eq(isEntitlementActive(customerInfo([ORTHODOX]), ''), false, 'empty entitlement id');

  console.log('EXPIRY');
  eq(
    entitlementExpiresAt(customerInfo([ORTHODOX], { expirationDate: '2026-10-29T00:00:00Z' }), ORTHODOX),
    '2026-10-29T00:00:00Z',
    'expiry passed through'
  );
  eq(entitlementExpiresAt(customerInfo([ORTHODOX]), ORTHODOX), undefined, 'lifetime has no expiry');
  eq(
    entitlementExpiresAt(
      { entitlements: { active: { [ORTHODOX]: { isActive: false, expirationDate: '2020-01-01' } } } },
      ORTHODOX
    ),
    undefined,
    'expired entitlement reports no expiry'
  );

  console.log('PACKAGE MATCH');
  eq(
    findPackageForProducts([pkg(ORTHODOX_YEARLY), pkg(ORTHODOX_MONTHLY)], ORTHODOX_PRODUCTS)?.product
      ?.identifier,
    ORTHODOX_MONTHLY,
    'monthly wins on preference order, not array order'
  );
  eq(
    findPackageForProducts([pkg(ORTHODOX_YEARLY)], ORTHODOX_PRODUCTS)?.product?.identifier,
    ORTHODOX_YEARLY,
    'yearly when it is the only orthodox package'
  );
  eq(
    findPackageForProducts([pkg('mazal_gold_monthly'), pkg('safta_pro_yearly')], ORTHODOX_PRODUCTS),
    null,
    'other products do not match'
  );
  eq(findPackageForProducts([], ORTHODOX_PRODUCTS), null, 'empty offering');
  eq(findPackageForProducts(null, ORTHODOX_PRODUCTS), null, 'null offering');
  eq(
    findPackageForProducts([pkg('mazal_gold_monthly', { identifier: ORTHODOX_MONTHLY })], ORTHODOX_PRODUCTS),
    null,
    'a package NAMED orthodox selling gold does not match'
  );
  eq(
    findPackageForProducts([{ identifier: '$rc_monthly' }], ORTHODOX_PRODUCTS),
    null,
    'package with no product'
  );

  // The binding under test, with counters so "unavailable" can be shown to mean
  // "nothing was charged" rather than just "no access granted".
  const binding = ({ packages, purchase, restore }) => {
    const calls = { listPackages: 0, purchase: 0, restore: 0, purchased: null };
    return {
      calls,
      purchase: {
        entitlementId: ORTHODOX,
        productIds: ORTHODOX_PRODUCTS,
        listPackages: async () => {
          calls.listPackages += 1;
          return typeof packages === 'function' ? packages() : packages;
        },
        purchase: async (p) => {
          calls.purchase += 1;
          calls.purchased = p;
          return purchase(p);
        },
      },
      restore: {
        entitlementId: ORTHODOX,
        restore: async () => {
          calls.restore += 1;
          return restore();
        },
      },
    };
  };

  console.log('PURCHASE');
  {
    const b = binding({
      packages: [pkg(ORTHODOX_MONTHLY), pkg(ORTHODOX_YEARLY, { identifier: '$rc_annual' })],
      purchase: async () => customerInfo([ORTHODOX], { expirationDate: '2026-10-29T00:00:00Z' }),
    });
    const outcome = await purchaseEntitlement(b.purchase);
    status(outcome, 'granted', 'a real purchase that entitles -> granted');
    eq(outcome.expiresAt, '2026-10-29T00:00:00Z', 'granted carries the expiry');
    eq(b.calls.purchased?.product?.identifier, ORTHODOX_MONTHLY, 'charged the monthly product');
    eq(b.calls.purchase, 1, 'charged exactly once');
  }
  {
    // THE MEXA-292 CASE. The store call comes back clean and the entitlement is not
    // active. The old paywall had no store call and granted unconditionally.
    const b = binding({ packages: [pkg(ORTHODOX_MONTHLY)], purchase: async () => customerInfo([]) });
    status(await purchaseEntitlement(b.purchase), 'not_entitled', 'purchase without the entitlement -> NOT granted');
  }
  {
    const b = binding({
      packages: [pkg(ORTHODOX_MONTHLY)],
      purchase: async () => customerInfo(['mazal_gold', 'safta_pro']),
    });
    status(await purchaseEntitlement(b.purchase), 'not_entitled', 'another entitlement does not unlock orthodox');
  }
  {
    const b = binding({
      packages: [pkg(ORTHODOX_MONTHLY)],
      purchase: async () => ({ entitlements: { active: { [ORTHODOX]: { isActive: false } } } }),
    });
    status(await purchaseEntitlement(b.purchase), 'not_entitled', 'expired entitlement after purchase');
  }
  {
    const b = binding({ packages: [pkg('mazal_gold_monthly')], purchase: async () => customerInfo([ORTHODOX]) });
    status(await purchaseEntitlement(b.purchase), 'unavailable', 'no orthodox package -> unavailable');
    eq(b.calls.purchase, 0, 'unavailable charges nothing');
  }
  {
    const b = binding({ packages: [], purchase: async () => customerInfo([ORTHODOX]) });
    status(await purchaseEntitlement(b.purchase), 'unavailable', 'empty offering -> unavailable');
  }
  {
    const b = binding({ packages: null, purchase: async () => customerInfo([ORTHODOX]) });
    status(await purchaseEntitlement(b.purchase), 'unavailable', 'null package list -> unavailable');
  }
  {
    const b = binding({
      packages: () => {
        throw new Error('offerings unreachable');
      },
      purchase: async () => customerInfo([ORTHODOX]),
    });
    const outcome = await purchaseEntitlement(b.purchase);
    status(outcome, 'failed', 'offerings lookup throws -> failed');
    eq(outcome.message, 'offerings unreachable', 'failure keeps the message');
    eq(b.calls.purchase, 0, 'a failed lookup charges nothing');
  }
  {
    const b = binding({
      packages: [pkg(ORTHODOX_MONTHLY)],
      purchase: async () => {
        throw cancelledError();
      },
    });
    status(await purchaseEntitlement(b.purchase), 'cancelled', 'userCancelled error -> cancelled');
  }
  {
    const b = binding({ packages: [pkg(ORTHODOX_MONTHLY)], purchase: async () => null });
    status(await purchaseEntitlement(b.purchase), 'cancelled', 'null CustomerInfo (cancel) -> cancelled');
  }
  {
    const b = binding({
      packages: [pkg(ORTHODOX_MONTHLY)],
      purchase: async () => {
        throw new Error('STORE_PROBLEM');
      },
    });
    const outcome = await purchaseEntitlement(b.purchase);
    status(outcome, 'failed', 'store error -> failed');
    eq(outcome.message, 'STORE_PROBLEM', 'store failure keeps the message');
  }
  {
    // RevenueCat rejects a non-Error object in some paths; a thrown string must not crash.
    const b = binding({
      packages: [pkg(ORTHODOX_MONTHLY)],
      purchase: async () => {
        throw 'plain string';
      },
    });
    status(await purchaseEntitlement(b.purchase), 'failed', 'thrown non-Error -> failed');
  }

  console.log('RESTORE');
  {
    const b = binding({ restore: async () => customerInfo([ORTHODOX]) });
    status(await restoreEntitlement(b.restore), 'granted', 'restore that entitles -> granted');
    eq(b.calls.restore, 1, 'restore called once');
  }
  {
    const b = binding({ restore: async () => customerInfo([]) });
    status(await restoreEntitlement(b.restore), 'not_entitled', 'restore with nothing active -> NOT granted');
  }
  {
    const b = binding({ restore: async () => customerInfo(['mazal_platinum']) });
    status(await restoreEntitlement(b.restore), 'not_entitled', 'restoring platinum does not unlock orthodox');
  }
  {
    const b = binding({ restore: async () => null });
    status(await restoreEntitlement(b.restore), 'not_entitled', 'null CustomerInfo -> not entitled');
  }
  {
    const b = binding({
      restore: async () => {
        throw new Error('RESTORE_FAILED');
      },
    });
    const outcome = await restoreEntitlement(b.restore);
    status(outcome, 'failed', 'restore error -> failed');
    eq(outcome.message, 'RESTORE_FAILED', 'restore failure keeps the message');
  }
  {
    const b = binding({
      restore: async () => {
        throw cancelledError();
      },
    });
    status(await restoreEntitlement(b.restore), 'cancelled', 'cancelled restore -> cancelled');
  }

  // The flows above are generic over an entitlement id, so they only say something
  // about Orthodox if the hook passes the Orthodox identifiers. Those modules import
  // react-native, so this is a source-text check rather than an executed one.
  console.log('WIRING');
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const revenuecat = read('src/lib/config/revenuecat.ts');
  const hook = read('src/features/premium/hooks/useOrthodoxEntitlement.ts');
  const login = read('app/(orthodox-auth)/login.tsx');
  const paywall = read('app/(orthodox-auth)/paywall.tsx');

  record(revenuecat.includes(`ORTHODOX: '${ORTHODOX}'`), `ENTITLEMENTS.ORTHODOX is '${ORTHODOX}'`);
  record(
    revenuecat.includes(`ORTHODOX_MONTHLY: '${ORTHODOX_MONTHLY}'`),
    `PRODUCTS.ORTHODOX_MONTHLY is '${ORTHODOX_MONTHLY}'`
  );
  record(
    revenuecat.includes(`ORTHODOX_YEARLY: '${ORTHODOX_YEARLY}'`),
    `PRODUCTS.ORTHODOX_YEARLY is '${ORTHODOX_YEARLY}'`
  );
  record(hook.includes('entitlementId: ENTITLEMENTS.ORTHODOX'), 'the hook buys against ENTITLEMENTS.ORTHODOX');
  record(
    hook.includes('PRODUCTS.ORTHODOX_MONTHLY') && hook.includes('PRODUCTS.ORTHODOX_YEARLY'),
    'the hook offers both orthodox products'
  );
  record(
    hook.includes('restore: restorePurchases') && hook.includes('purchase: purchasePackage'),
    'the hook wires the real store calls'
  );

  // A code line, not a comment: the point is that nothing *reads* the dead column.
  const codeReads = (src) =>
    src
      .split('\n')
      .filter((line) => line.includes('orthodox_subscription_status'))
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line));
  record(codeReads(login).length === 0, 'login.tsx does not read orthodox_subscription_status', codeReads(login).join(' | '));
  record(
    codeReads(paywall).length === 0,
    'paywall.tsx does not read orthodox_subscription_status',
    codeReads(paywall).join(' | ')
  );

  console.log(
    `\n${passes} passed, ${failures.length} failed` + (failures.length ? `:\n  - ${failures.join('\n  - ')}` : '')
  );
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
