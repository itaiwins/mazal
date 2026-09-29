#!/usr/bin/env node
/**
 * check-paywall-prices.mjs — the paywall must not quote a price the store did not.
 *
 * MEXA-338 finding 6 / MEXA-387 option (a). MEXA-328 pack screen 30 caught
 * `app/premium/index.tsx` drawing **$119.99/yr and $14.99/mo with no offerings loaded** —
 * RevenueCat is a native module, it could not load in the render, and the screen fell back
 * to the app's own hardcoded `PRICING` rather than admitting it had no price.
 *
 * This render reproduces that condition *for free*: `react-native-purchases` has no web
 * implementation, so `walkthrough/web-shims/` stands in and `getOfferings()` comes back
 * empty. That is the same no-offerings state a device hits when StoreKit is unreachable, so
 * the pack's exact failure is the default here rather than something to simulate.
 *
 *   cd REPOS/mazal-MEXA-338
 *   set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
 *   MAZAL_WEB_SHIMS=1 npx expo export --platform web --output-dir /tmp/web --clear
 *   node walkthrough/patch-export.mjs /tmp/web
 *   node walkthrough/serve.mjs /tmp/web 8787 &
 *   node walkthrough/check-paywall-prices.mjs
 *
 * What it cannot show: the *loaded* state. No offerings can reach this render, so the
 * spinner and the real store prices are only covered by `scripts/check-store-pricing.mjs`
 * and want a device look. The state it does cover is the one that shipped wrong.
 *
 * One fixture, created through the admin API with `email_confirm: true`, so **no email is
 * sent**; removed in a `finally`.
 */

import { createClient } from '@supabase/supabase-js';
import { launch } from './cdp.mjs';

const BASE = process.env.WALKTHROUGH_BASE || 'http://127.0.0.1:8787';
const PASSWORD = process.env.WALKTHROUGH_PASSWORD || 'Mazal-Walkthrough-328!';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY. Run:\n' +
      '  set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a'
  );
  process.exit(2);
}

const EMAIL = 'violet-mexa387-paywall@example.com';

/** Every hardcoded figure in `PRICING` for the two plans this screen sells. */
const HARDCODED = ['119.99', '14.99', '239.99', '29.99', '$10', '$20', '33%'];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
let passes = 0;

function record(ok, label, detail) {
  if (ok) {
    passes += 1;
    console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`);
    return;
  }
  failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function removeFixture() {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
    }
    if (data.users.length < 200) break;
  }
}

let browser = null;

async function run() {
  console.log(`\nPaywall prices with no offerings loaded, 390x844 against ${BASE}\n`);

  await removeFixture();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (createErr) throw new Error(`createUser failed: ${createErr.message}`);
  const { error: rowErr } = await admin.from('users').insert({
    auth_id: created.user.id,
    email: EMAIL,
    first_name: 'Paywall',
    last_name: 'Fixture',
    display_name: 'Paywall',
    date_of_birth: '1996-04-11',
    gender: 'female',
    gender_preference: ['male'],
    jewish_background: 'modern_orthodox',
    looking_for: 'marriage_minded',
    is_active: true,
    onboarding_complete: true,
  });
  if (rowErr) throw new Error(`profile insert failed: ${rowErr.message}`);

  browser = await launch({ width: 390, height: 844, scale: 2 });
  await browser.goto(BASE + '/login', { settle: 7000 });
  await browser.typeInto(0, EMAIL);
  await browser.typeInto(1, PASSWORD);
  await browser.clickText('Sign In', { exact: true });
  await sleep(9000);

  // Client-side, never a reload, once this browser holds a session (NOTES.md finding 2).
  await browser.pushRoute('/premium', { settle: 8000 });
  const text = await browser.evaluate(`(document.getElementById('root')?.innerText || '')`);

  // Vacuity guard: the paywall has to have rendered, or every absence below proves nothing.
  record(
    /Mazal (Gold|Platinum)|Choose your billing|Compare Plans/i.test(text),
    'the paywall rendered',
    text.trim() ? '' : 'innerText was empty'
  );
  if (!/Choose your billing|Compare Plans/i.test(text)) {
    record(false, 'cannot continue', `screen was: ${text.replace(/\n+/g, ' ').slice(0, 120)}`);
    return;
  }

  console.log('\nno hardcoded price reaches the screen');
  for (const figure of HARDCODED) {
    record(!text.includes(figure), `does not show ${JSON.stringify(figure)}`);
  }
  // Nothing that looks like money at all, since the store quoted nothing.
  const moneyLike = text.match(/[$€£]\s?\d[\d.,]*/g) || [];
  record(
    moneyLike.length === 0,
    'nothing currency-shaped anywhere on the screen',
    moneyLike.length ? `found ${JSON.stringify(moneyLike.slice(0, 5))}` : ''
  );

  console.log('\nit says why, instead');
  record(
    /Prices unavailable/i.test(text),
    'shows "Prices unavailable"',
    /check your connection/i.test(text) ? 'and names a cause' : ''
  );
  record(/Try again/i.test(text), 'offers a retry');
  record(!/Demo Mode/i.test(text), 'no "Demo Mode" anywhere');

  console.log('\nSubscribe cannot be tapped');
  // react-native-web puts `pointer-events: none` / aria-disabled on a disabled Pressable.
  const cta = await browser.evaluate(`(() => {
    const label = [...document.querySelectorAll('div')].find(
      (el) => el.children.length === 0 && /Prices unavailable/i.test(el.textContent)
    );
    if (!label) return null;
    let el = label;
    for (let i = 0; i < 6 && el; i += 1) {
      const cs = getComputedStyle(el);
      if (el.getAttribute('aria-disabled') === 'true' || cs.pointerEvents === 'none') {
        return { disabled: true, via: el.getAttribute('aria-disabled') === 'true' ? 'aria-disabled' : 'pointer-events' };
      }
      el = el.parentElement;
    }
    return { disabled: false };
  })()`);
  record(cta?.disabled === true, 'the Subscribe button is disabled', cta ? `via ${cta.via || 'nothing'}` : 'button not found');

  // And the legal small print must not promise a charge for a price we do not have.
  record(
    !/\d+\.\d\d/.test(text),
    'no bare decimal figure either',
    (text.match(/\d+\.\d\d/g) || []).slice(0, 3).join(', ')
  );
}

try {
  await run();
} catch (e) {
  record(false, 'the run itself', e.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  await removeFixture().catch((e) => console.error(`CLEANUP FAILED: ${e.message}`));
  console.log('\nfixture removed');
}

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
