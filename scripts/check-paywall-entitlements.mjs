#!/usr/bin/env node
/**
 * check-paywall-entitlements.mjs - the corpus behind MEXA-345.
 *
 * Offline: no Supabase, no RevenueCat, no credentials, no network, no iOS sandbox.
 *
 *   node scripts/check-paywall-entitlements.mjs        # one line per failure, exit 1 on any
 *   node scripts/check-paywall-entitlements.mjs -v     # also print every passing case
 *
 * `check-orthodox-entitlement.mjs` (MEXA-293) already drives `purchaseEntitlement` and
 * `restoreEntitlement` for the *live* Orthodox paywall. This file covers the two paywalls
 * that MEXA-293's scope fence left alone, and the three decisions this issue added:
 *
 *   1. **A paywall buys exactly the period it is advertising.** Both screens have a
 *      monthly/yearly toggle and pass one product id, not both. `findPackageForProducts`
 *      would happily fall back to the next id in the list, which is how a user taps
 *      "Yearly $119.99" and is charged for a month.
 *   2. **The store's answer decides access, not the fact that a call returned.** The
 *      defect being fixed is unconditional: `(orthodox)/paywall.tsx` slept 1500ms and set
 *      the persisted flag; `(safta-auth)/paywall.tsx` wrote
 *      `safta_accounts.subscription_status = 'active'` and read it back on Restore.
 *   3. **Nothing currency-shaped renders unless StoreKit quoted it** (Lelouch, MEXA-387).
 *      Safta Pro's product ids are `safta_pro_*`, outside the `mazal_<plan>_<period>`
 *      convention, so the lookup takes explicit ids.
 *
 * The WIRING section is the other half, and the part that would catch a regression: the
 * flows are generic over an entitlement id, so the executed cases below say nothing about
 * these two screens unless the screens really pass the Safta / Orthodox identifiers and
 * really gate their grant on `status === 'granted'`. Those files import react-native, so
 * that is a source-text check, which is all a Node script can do for them.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

const SAFTA = 'safta_pro';
const SAFTA_MONTHLY = 'safta_pro_monthly';
const SAFTA_YEARLY = 'safta_pro_yearly';
const ORTHODOX = 'mazal_orthodox';
const ORTHODOX_MONTHLY = 'mazal_orthodox_monthly';
const ORTHODOX_YEARLY = 'mazal_orthodox_yearly';

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

/** Transpile a dependency-free TS module in memory and import it. */
async function loadModule(relPath, tag) {
  const source = path.join(ROOT, relPath);
  const js = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: source,
  }).outputText;
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), `mazal-${tag}-`)), `${tag}.mjs`);
  fs.writeFileSync(tmp, js);
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }
}

/** A `CustomerInfo` shaped like the SDK's, with the named entitlements active. */
function customerInfo(activeIds) {
  const active = {};
  for (const id of activeIds) {
    active[id] = { identifier: id, isActive: true, expirationDate: null };
  }
  return { entitlements: { active, all: active }, originalAppUserId: 'stub-user' };
}

/** A `PurchasesPackage` shaped like the SDK's, with the fields both modules read. */
function pkg(productId, price, priceString, pricePerMonthString = null) {
  return {
    identifier: productId.endsWith('yearly') ? '$rc_annual' : '$rc_monthly',
    offeringIdentifier: 'stub',
    product: { identifier: productId, price, priceString, pricePerMonthString },
  };
}

const SAFTA_YEAR_PKG = pkg(SAFTA_YEARLY, 119.99, '$119.99', '$10.00');
const SAFTA_MONTH_PKG = pkg(SAFTA_MONTHLY, 14.99, '$14.99');

async function main() {
  const { purchaseEntitlement, restoreEntitlement } = await loadModule(
    'src/lib/purchases/entitlements.ts',
    'entitlements'
  );
  const { entitlementNotice } = await loadModule(
    'src/lib/purchases/entitlementMessages.ts',
    'messages'
  );
  const { pricesFromProductIds, findPackageById, planProductIds, planPricesFromPackages } =
    await loadModule('src/lib/premium/storePricing.ts', 'pricing');

  // ---------------------------------------------------------------------------------
  console.log('a paywall buys the period it advertised, and nothing else');
  // ---------------------------------------------------------------------------------
  {
    // The whole offering is on the shelf; the screen asks for yearly only.
    const bought = [];
    const outcome = await purchaseEntitlement({
      listPackages: async () => [SAFTA_MONTH_PKG, SAFTA_YEAR_PKG],
      purchase: async (p) => {
        bought.push(p.product.identifier);
        return customerInfo([SAFTA]);
      },
      entitlementId: SAFTA,
      productIds: [SAFTA_YEARLY],
    });
    eq(outcome.status, 'granted', 'yearly purchase grants');
    eq(bought.join(), SAFTA_YEARLY, 'yearly tap charges the yearly product');
  }
  {
    // The case this rule exists for: the advertised product is missing from the offering.
    // A fallback would charge for the other period at a price the screen never showed.
    const bought = [];
    const outcome = await purchaseEntitlement({
      listPackages: async () => [SAFTA_MONTH_PKG],
      purchase: async (p) => {
        bought.push(p.product.identifier);
        return customerInfo([SAFTA]);
      },
      entitlementId: SAFTA,
      productIds: [SAFTA_YEARLY],
    });
    eq(outcome.status, 'unavailable', 'yearly missing from the offering -> unavailable');
    eq(bought.length, 0, 'and no monthly subscription is sold instead');
  }

  // ---------------------------------------------------------------------------------
  console.log('the store decides access, not the fact that a call returned');
  // ---------------------------------------------------------------------------------
  {
    // Exactly the old `(safta-auth)` behaviour if it were routed through the flow: the
    // call succeeds, nothing is entitled. Must not grant.
    const outcome = await purchaseEntitlement({
      listPackages: async () => [SAFTA_YEAR_PKG],
      purchase: async () => customerInfo([]),
      entitlementId: SAFTA,
      productIds: [SAFTA_YEARLY],
    });
    eq(outcome.status, 'not_entitled', 'purchase with no active entitlement refuses');
  }
  {
    const outcome = await purchaseEntitlement({
      listPackages: async () => [SAFTA_YEAR_PKG],
      purchase: async () => customerInfo([ORTHODOX]),
      entitlementId: SAFTA,
      productIds: [SAFTA_YEARLY],
    });
    eq(outcome.status, 'not_entitled', 'holding a different entitlement does not unlock Safta Pro');
  }
  {
    const outcome = await restoreEntitlement({
      restore: async () => customerInfo([]),
      entitlementId: SAFTA,
    });
    eq(outcome.status, 'not_entitled', 'restore with nothing to restore refuses');
  }
  {
    const outcome = await restoreEntitlement({
      restore: async () => customerInfo([SAFTA]),
      entitlementId: SAFTA,
    });
    eq(outcome.status, 'granted', 'restore of a real Safta Pro subscription grants');
  }
  {
    // A store that is not there at all - Expo Go, no API key, offline. Fail closed.
    const outcome = await purchaseEntitlement({
      listPackages: async () => [],
      purchase: async () => customerInfo([SAFTA]),
      entitlementId: SAFTA,
      productIds: [SAFTA_YEARLY],
    });
    eq(outcome.status, 'unavailable', 'no packages at all -> unavailable, not granted');
  }

  // ---------------------------------------------------------------------------------
  console.log('what the user is told');
  // ---------------------------------------------------------------------------------
  {
    record(entitlementNotice({ status: 'granted' }, 'purchase', 'Safta Pro') === null,
      'a grant says nothing (the screen navigates)');
    record(entitlementNotice({ status: 'cancelled' }, 'purchase', 'Safta Pro') === null,
      'a dismissed store sheet says nothing');
    const restored = entitlementNotice({ status: 'not_entitled' }, 'restore', 'Safta Pro');
    eq(restored.title, 'No Subscription Found', 'restore with nothing found says so');
    record(restored.message.includes('Safta Pro'), 'and names the product');
    const bought = entitlementNotice({ status: 'not_entitled' }, 'purchase', 'Safta Pro');
    eq(bought.title, 'Purchase Not Confirmed', 'a purchase that did not entitle is not a plain failure');
    record(bought.message.includes('Restore Purchases'),
      'and points at Restore, which is what someone who already paid needs');
    const failed = entitlementNotice({ status: 'failed', message: 'RECEIPT_XYZ for user 4412' },
      'purchase', 'Safta Pro');
    record(!failed.message.includes('RECEIPT_XYZ'),
      'a store error never shows its own message to the user');
    const gone = entitlementNotice({ status: 'unavailable' }, 'purchase', 'Orthodox Mode');
    record(gone.message.includes('Orthodox Mode'), 'unavailable names the product too');
  }

  // ---------------------------------------------------------------------------------
  console.log('prices for a plan outside the mazal_<plan>_<period> convention');
  // ---------------------------------------------------------------------------------
  {
    const ids = { monthly: SAFTA_MONTHLY, yearly: SAFTA_YEARLY };
    const p = pricesFromProductIds([SAFTA_YEAR_PKG, SAFTA_MONTH_PKG], ids);
    eq(p.yearly.displayPrice, '$119.99', 'the yearly price is the package string, verbatim');
    eq(p.monthly.displayPrice, '$14.99', 'the monthly price is the package string, verbatim');
    eq(p.yearly.monthlyEquivalent, '$10.00', 'the per-month line is the store\'s, not computed here');
    eq(p.savingsPercent, 33, 'the savings badge is computed from the two real prices');
  }
  {
    // The bug this guards: `planPricesFromPackages(pkgs, 'safta_pro')` looks for
    // `mazal_safta_pro_yearly`, which does not exist, so the screen would go permanently
    // "unavailable" while the products were sitting right there.
    const byConvention = planPricesFromPackages([SAFTA_YEAR_PKG, SAFTA_MONTH_PKG], 'safta_pro');
    eq(byConvention.yearly, null, 'the mazal_ convention finds nothing for safta_pro');
    eq(planProductIds('orthodox').yearly, ORTHODOX_YEARLY, 'orthodox does follow the convention');
    eq(findPackageById([SAFTA_YEAR_PKG], SAFTA_MONTHLY), null, 'findPackageById is exact');
    eq(findPackageById([SAFTA_YEAR_PKG], '')?.product?.identifier, undefined,
      'and an empty id matches nothing rather than the first package');
  }

  // ---------------------------------------------------------------------------------
  // The flows above are generic. They only say something about these two screens if the
  // screens pass the right identifiers and gate their grant on the outcome.
  console.log('WIRING');
  // ---------------------------------------------------------------------------------
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  /** Lines of real code, with comments dropped - a mention in a doc block is not a call. */
  const codeLines = (src) =>
    src.split('\n').filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line));
  const codeHas = (src, needle) => codeLines(src).some((line) => line.includes(needle));

  /**
   * The body of `const <name> = async () => { ... }`, by brace counting, or null if the
   * screen has no handler of that name. Slicing per handler is what makes the ordering
   * check below mean "before the guard *in this function*".
   */
  const handlerBody = (src, name) => {
    const start = src.indexOf(`const ${name} = async () => {`);
    if (start === -1) return null;
    let depth = 0;
    for (let i = src.indexOf('{', start); i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) return src.slice(start, i + 1);
      }
    }
    return null;
  };

  const revenuecat = read('src/lib/config/revenuecat.ts');
  const hook = read('src/features/premium/hooks/useEntitlement.ts');
  const safta = read('app/(safta-auth)/paywall.tsx');
  const orthodox = read('app/(orthodox)/paywall.tsx');

  record(revenuecat.includes(`SAFTA_PRO: '${SAFTA}'`), `ENTITLEMENTS.SAFTA_PRO is '${SAFTA}'`);
  record(
    revenuecat.includes(`SAFTA_PRO_MONTHLY: '${SAFTA_MONTHLY}'`) &&
      revenuecat.includes(`SAFTA_PRO_YEARLY: '${SAFTA_YEARLY}'`),
    'the Safta Pro product ids are what this file tested'
  );
  record(
    hook.includes('restore: restorePurchases') && hook.includes('purchase: purchasePackage'),
    'the generic hook wires the real store calls'
  );
  record(
    codeHas(hook, 'listPackages: getAllPackages'),
    'and lists every offering, not just the current one (Orthodox and Safta are their own)'
  );

  for (const [name, src, entitlement, monthly, yearly, granted] of [
    ['(safta-auth)/paywall.tsx', safta, 'ENTITLEMENTS.SAFTA_PRO', 'PRODUCTS.SAFTA_PRO_MONTHLY',
      'PRODUCTS.SAFTA_PRO_YEARLY', "setPlan('safta_pro')"],
    ['(orthodox)/paywall.tsx', orthodox, 'ENTITLEMENTS.ORTHODOX', 'PRODUCTS.ORTHODOX_MONTHLY',
      'PRODUCTS.ORTHODOX_YEARLY', 'setOrthodoxSubscription(true)'],
  ]) {
    record(codeHas(src, `useEntitlement(\n    ${entitlement}\n  )`) ||
      codeHas(src, `useEntitlement(${entitlement})`) ||
      src.includes(`useEntitlement(\n    ${entitlement}\n  )`),
      `${name} gates on ${entitlement}`);
    record(codeHas(src, monthly) && codeHas(src, yearly),
      `${name} names both ${entitlement} products`);
    record(codeHas(src, '[billingPeriod]'),
      `${name} buys the period the toggle is on`);
    record(codeHas(src, "outcome.status !== 'granted'"),
      `${name} refuses every outcome that is not a grant`);
    // The defect itself: a grant reachable without the store having said so.
    record(!codeHas(src, 'setTimeout'), `${name} has no simulated purchase delay`);
    record(!codeHas(src, 'PRICING'), `${name} renders no hardcoded price`);
    record(codeHas(src, 'PRICES_UNAVAILABLE_MESSAGE') && codeHas(src, 'availability.canPurchase'),
      `${name} says so when the store has no price, and cannot be tapped then`);
    // The ordering *inside each handler* is the gate: the early return on a non-grant has
    // to come before anything that unlocks. Checked per handler body rather than over the
    // whole file, because `grantAccess` is defined above the handlers that call it.
    for (const handler of ['handleSubscribe', 'handlePurchase', 'handleRestore']) {
      const body = handlerBody(src, handler);
      if (body === null) continue;
      const guardAt = body.indexOf("outcome.status !== 'granted'");
      const grants = [granted, 'grantAccess()', "Alert.alert(\n      'Welcome"]
        .map((needle) => body.indexOf(needle))
        .filter((at) => at !== -1);
      record(guardAt !== -1, `${name} ${handler} has the refusal guard`);
      record(grants.length > 0, `${name} ${handler} unlocks something (not a vacuous pass)`);
      record(
        grants.every((at) => at > guardAt),
        `${name} ${handler} unlocks only after the guard`,
        `guard@${guardAt} grants@${grants.join(',')}`
      );
    }
  }

  // The Safta half of MEXA-292's defect: a client-written column standing in for a receipt.
  const saftaWrites = codeLines(safta).filter((line) =>
    /subscription_status|subscription_plan|safta_accounts/.test(line)
  );
  record(saftaWrites.length === 0,
    'the Safta paywall never touches safta_accounts.subscription_status',
    saftaWrites.join(' | '));
  record(!codeHas(safta, 'supabase'), 'and does not reach the database at all any more');

  console.log(
    `\n${passes} passed, ${failures.length} failed` +
      (failures.length ? `:\n  - ${failures.join('\n  - ')}` : '')
  );
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
