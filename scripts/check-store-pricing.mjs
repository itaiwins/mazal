#!/usr/bin/env node
/**
 * check-store-pricing.mjs - the corpus behind MEXA-338 finding 6 / MEXA-387 option (a).
 *
 * Offline: no Supabase, no credentials, no network, no StoreKit. It transpiles
 * `src/lib/premium/storePricing.ts` in memory (pure TypeScript, no imports) and drives every
 * state the paywall can be in. Pure JS, so a pass here is a pass on device.
 *
 *   node scripts/check-store-pricing.mjs        # one line per failure, exit 1 on any
 *   node scripts/check-store-pricing.mjs -v     # also print every passing case
 *
 * Why it exists: `app/premium/index.tsx` loaded RevenueCat offerings and, on failure, did
 * `console.error` and nothing else — so it drew $119.99/yr and $14.99/mo out of the app's own
 * hardcoded `PRICING` whenever StoreKit was slow, offline or unconfigured. MEXA-328 pack
 * screen 30 caught exactly that. App Review is specifically touchy about prices that did not
 * come from StoreKit.
 *
 * The rule Lelouch set, and what each block below checks:
 *
 *   - **no `PRICING` number may render as a price, and a grep should prove it** — the last
 *     block is that grep;
 *   - a spinner while offerings load;
 *   - "Prices unavailable" and a disabled Subscribe if they fail;
 *   - the "Demo Mode" alert path deleted completely.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SOURCE = path.join(ROOT, 'src', 'lib', 'premium', 'storePricing.ts');
const SCREEN = path.join(ROOT, 'app', 'premium', 'index.tsx');
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

/** A package as RevenueCat hands it over, with only the fields the module reads. */
const pkg = (id, price, priceString, pricePerMonthString = null) => ({
  product: { identifier: id, price, priceString, pricePerMonthString },
});

const GOLD_YEAR = pkg('mazal_gold_yearly', 119.99, '$119.99', '$10.00');
const GOLD_MONTH = pkg('mazal_gold_monthly', 14.99, '$14.99');
const PLAT_YEAR = pkg('mazal_platinum_yearly', 239.99, '$239.99', '$20.00');
/** A different locale, to make sure nothing here formats money itself. */
const EURO_YEAR = pkg('mazal_gold_yearly', 119.99, '119,99 €', '10,00 €');

const failures = [];
let passes = 0;

function record(ok, label, detail) {
  if (ok) {
    passes += 1;
    if (VERBOSE) console.log(`  ok    ${label}`);
    return;
  }
  failures.push(`${label}${detail ? ` - ${detail}` : ''}`);
  console.log(`  FAIL  ${label}${detail ? ` - ${detail}` : ''}`);
}

async function load() {
  const src = fs.readFileSync(SOURCE, 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: SOURCE,
  }).outputText;
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mazal-pricing-')), 'p.mjs');
  fs.writeFileSync(tmp, js);
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }
}

const {
  planPricesFromPackages,
  paywallAvailability,
  findPackage,
  productIdFor,
  PRICES_UNAVAILABLE_MESSAGE,
} = await load();

console.log(`store pricing: ${SOURCE}\n`);

console.log('prices come from the package, verbatim');
{
  const p = planPricesFromPackages([GOLD_YEAR, GOLD_MONTH], 'gold');
  record(p.yearly?.displayPrice === '$119.99', 'yearly displayPrice is the store string', JSON.stringify(p.yearly));
  record(p.monthly?.displayPrice === '$14.99', 'monthly displayPrice is the store string', JSON.stringify(p.monthly));
  record(p.yearly?.monthlyEquivalent === '$10.00', "monthlyEquivalent is the store's pricePerMonthString");
  // 119.99 vs 14.99*12 = 179.88 -> 33%
  record(p.savingsPercent === 33, 'savings is computed from the two real prices', `got ${p.savingsPercent}`);
}
{
  const p = planPricesFromPackages([EURO_YEAR, GOLD_MONTH], 'gold');
  record(p.yearly?.displayPrice === '119,99 €', 'a non-dollar locale passes through untouched', JSON.stringify(p.yearly));
  record(p.yearly?.monthlyEquivalent === '10,00 €', 'and so does its per-month string');
}

console.log('\nmissing packages mean missing prices, never a fallback');
{
  const none = planPricesFromPackages([], 'gold');
  record(none.yearly === null, 'no packages -> yearly is null');
  record(none.monthly === null, 'no packages -> monthly is null');
  record(none.savingsPercent === null, 'no packages -> no savings badge');

  const yearlyOnly = planPricesFromPackages([GOLD_YEAR], 'gold');
  record(yearlyOnly.yearly !== null, 'yearly only -> yearly present');
  record(yearlyOnly.monthly === null, 'yearly only -> monthly null');
  record(
    yearlyOnly.savingsPercent === null,
    'yearly only -> NO savings badge, since the figure needs both prices'
  );

  // The wrong plan's packages must not leak into this plan.
  const wrongPlan = planPricesFromPackages([PLAT_YEAR], 'gold');
  record(wrongPlan.yearly === null, "platinum's package is not gold's price");
  record(planPricesFromPackages([PLAT_YEAR], 'platinum').yearly !== null, "and it is platinum's");

  // A package with an empty price string is not a price.
  const blank = planPricesFromPackages([pkg('mazal_gold_yearly', 1, '   ')], 'gold');
  record(blank.yearly === null, 'a blank priceString is treated as absent, not as free');
}

console.log('\na yearly plan that saves nothing gets no badge');
{
  const same = planPricesFromPackages(
    [pkg('mazal_gold_yearly', 179.88, '$179.88'), GOLD_MONTH],
    'gold'
  );
  record(same.savingsPercent === null, 'yearly = 12x monthly -> no badge', `got ${same.savingsPercent}`);
  const worse = planPricesFromPackages(
    [pkg('mazal_gold_yearly', 300, '$300.00'), GOLD_MONTH],
    'gold'
  );
  record(worse.savingsPercent === null, 'yearly dearer than monthly -> no badge', `got ${worse.savingsPercent}`);
}

console.log('\nwhat the screen may do in each state');
{
  const full = planPricesFromPackages([GOLD_YEAR, GOLD_MONTH], 'gold');
  const empty = planPricesFromPackages([], 'gold');

  const loading = paywallAvailability('loading', empty, 'yearly');
  record(loading.showSpinner === true, 'loading -> spinner');
  record(loading.showPrices === false, 'loading -> no prices');
  record(loading.canPurchase === false, 'loading -> Subscribe disabled');
  record(loading.showUnavailable === false, 'loading -> not yet "unavailable"');

  // Still loading, even if a previous render left prices around.
  const loadingWithPrices = paywallAvailability('loading', full, 'yearly');
  record(loadingWithPrices.showPrices === false, 'loading wins over stale prices');

  const ready = paywallAvailability('ready', full, 'yearly');
  record(ready.showPrices === true, 'ready with a price -> show it');
  record(ready.canPurchase === true, 'ready with a price -> Subscribe enabled');
  record(ready.showSpinner === false && ready.showUnavailable === false, 'ready -> nothing else');

  const unavailable = paywallAvailability('unavailable', empty, 'yearly');
  record(unavailable.showUnavailable === true, 'unavailable -> say so');
  record(unavailable.canPurchase === false, 'unavailable -> Subscribe disabled');
  record(unavailable.showPrices === false, 'unavailable -> no prices');

  // The case the walkthrough actually hit: offerings loaded, but not for this selection.
  const yearlyOnly = planPricesFromPackages([GOLD_YEAR], 'gold');
  const readyNoMonthly = paywallAvailability('ready', yearlyOnly, 'monthly');
  record(readyNoMonthly.canPurchase === false, 'ready but no package for this period -> disabled');
  record(readyNoMonthly.showUnavailable === true, 'ready but no package for this period -> say so');
  record(
    paywallAvailability('ready', yearlyOnly, 'yearly').canPurchase === true,
    'and the other period still works'
  );
}

console.log('\nthe identifier convention and the lookup');
record(productIdFor('gold', 'yearly') === 'mazal_gold_yearly', 'productIdFor gold/yearly');
record(productIdFor('platinum', 'monthly') === 'mazal_platinum_monthly', 'productIdFor platinum/monthly');
record(findPackage([GOLD_YEAR, GOLD_MONTH], 'gold', 'monthly') === GOLD_MONTH, 'findPackage returns the same object');
record(findPackage([GOLD_YEAR], 'gold', 'monthly') === null, 'findPackage returns null when absent');

console.log('\nthe message exists and says something useful');
record(
  /unavailable/i.test(PRICES_UNAVAILABLE_MESSAGE) && /connection/i.test(PRICES_UNAVAILABLE_MESSAGE),
  'PRICES_UNAVAILABLE_MESSAGE names both the problem and a cause',
  JSON.stringify(PRICES_UNAVAILABLE_MESSAGE)
);

console.log('\nthe grep Lelouch asked for: no PRICING number renders as a price');
{
  const screen = fs.readFileSync(SCREEN, 'utf8');
  // PRICING must not be imported at all any more.
  record(
    !/^\s*PRICING,$/m.test(screen),
    'app/premium/index.tsx does not import PRICING'
  );
  // Nor referenced outside a comment.
  const code = screen
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
  record(!/\bPRICING\b/.test(code), 'no PRICING reference outside comments');
  record(!/\bpricing\.(yearly|monthly)\b/.test(code), 'no `pricing.yearly` / `pricing.monthly` left');
  // The Demo Mode alert is gone, completely.
  record(!/'Demo Mode'/.test(screen), "the \"Demo Mode\" alert is gone");
  record(!/In production, this would purchase/.test(screen), 'and so is its copy');
  // The screen goes through the helpers.
  record(/planPricesFromPackages\(/.test(code), 'the screen derives prices from the packages');
  record(/paywallAvailability\(/.test(code), 'and gates itself on the availability');
  record(/PRICES_UNAVAILABLE_MESSAGE/.test(code), 'and shows the unavailable message');
  // Subscribe must be gated on canPurchase, not only on isPurchasing.
  record(
    /disabled=\{isPurchasing \|\| !availability\.canPurchase\}/.test(code),
    'Subscribe is disabled when there is no store price'
  );
  record(/setOfferingsState\('unavailable'\)/.test(code), 'a failed load sets the unavailable state');
  record(/ActivityIndicator/.test(code) && /offeringsState === 'loading'/.test(code), 'a spinner covers the load');
}

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
