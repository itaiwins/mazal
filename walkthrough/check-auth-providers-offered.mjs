#!/usr/bin/env node
/**
 * check-auth-providers-offered.mjs — the app must not offer a login the server refuses.
 *
 * MEXA-338 finding 7 / MEXA-387: the login and register screens carried "Continue with
 * Apple" and "Continue with Google" while the live project had both providers **disabled**,
 * so every tap produced an error. The Apple one was worse than a dead button: it called
 * `AppleAuthentication.signInAsync()` before touching Supabase, so on a device the user
 * authenticated with Face ID and *then* got an error. Lelouch's call was to take both out
 * for the first TestFlight (MEXA-387); turning them on is MEXA-389.
 *
 * This is the invariant rather than the removal: it asks the **live project** which
 * providers are enabled, then requires the two auth screens to offer exactly those and no
 * others. So it keeps working in both directions — it fails if somebody re-adds a button
 * while the provider is off, and it stops demanding their absence once MEXA-389 turns them
 * on. It is not a snapshot of today's decision.
 *
 *   cd REPOS/mazal-MEXA-338
 *   set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
 *   MAZAL_WEB_SHIMS=1 npx expo export --platform web --output-dir /tmp/web --clear
 *   node walkthrough/patch-export.mjs /tmp/web
 *   node walkthrough/serve.mjs /tmp/web 8787 &
 *   node walkthrough/check-auth-providers-offered.mjs
 *
 * Half of it reads the source rather than the render, and that half is not decoration: the
 * Apple button sat inside `{Platform.OS === 'ios' && …}` and `Platform.OS` is `'web'` here,
 * so **a web render can never see it**. Against the pre-removal build the render checks
 * catch Google and the divider and report Apple as absent — vacuously. Anything iOS-only has
 * to be read.
 *
 * The signed-out screens need no fixture, so the only live call is the settings read. The
 * sign-in case at the end does seed one, through the admin API with `email_confirm: true`,
 * so **no email is sent** — it is there to prove the email path still works after the
 * buttons came out, which is the thing a removal could plausibly break.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { launch } from './cdp.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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

const EMAIL = 'violet-mexa387-authscreens@example.com';

/**
 * The third-party providers Mazal could plausibly offer, and the copy each one puts on
 * screen. Only these are checked — `email` is not a button, and the rest of GoTrue's list
 * (github, azure, …) is not something this app would ever show.
 */
const PROVIDERS = [
  ['apple', /\bApple\b/],
  ['google', /\bGoogle\b/],
  ['facebook', /\bFacebook\b/],
];

const SCREENS = [
  ['/login', 'login (MEXA-328 pack screen 2)'],
  ['/register', 'register (MEXA-328 pack screen 4)'],
];

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
  // What the server will actually accept.
  const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: ANON_KEY } });
  if (!res.ok) throw new Error(`/auth/v1/settings -> ${res.status}`);
  const settings = await res.json();
  const external = settings.external || {};
  const enabled = PROVIDERS.filter(([name]) => external[name]).map(([n]) => n);
  const disabled = PROVIDERS.filter(([name]) => !external[name]).map(([n]) => n);

  console.log(`\nauth providers on ${SUPABASE_URL.replace(/^https?:\/\//, '')}`);
  console.log(`  enabled:  ${enabled.length ? enabled.join(', ') : '(none — email only)'}`);
  console.log(`  disabled: ${disabled.join(', ')}`);
  record(external.email === true, 'email sign-up is enabled', `email: ${external.email}`);

  browser = await launch({ width: 390, height: 844, scale: 2 });

  for (const [route, label] of SCREENS) {
    await browser.goto(BASE + route, { settle: 7000 });
    const text = await browser.evaluate(`(document.getElementById('root')?.innerText || '')`);
    console.log(`\n${label}`);
    // The screen has to have rendered, or every absence below is vacuous.
    record(
      /Sign In|Create Account|Welcome/i.test(text),
      'the screen rendered',
      text.trim() ? '' : 'innerText was empty'
    );
    for (const [name, pattern] of PROVIDERS) {
      const offered = pattern.test(text);
      if (external[name]) {
        record(offered, `offers ${name}, which the server has enabled`);
      } else {
        record(!offered, `does not offer ${name}, which the server has disabled`);
      }
    }
    // The divider only makes sense with something under it.
    if (enabled.length === 0) {
      record(
        !/or (continue|sign up|sign in) with/i.test(text),
        'no "or continue with" divider, since there is nothing to continue with'
      );
    }
  }

  /**
   * The same question asked of the source, because the render cannot answer it for Apple.
   *
   * The Apple button sat inside `{Platform.OS === 'ios' && …}`, and `Platform.OS` is
   * `'web'` here, so a web render never draws it however present it is. Verified: against
   * the pre-removal build the checks above catch Google and the divider and report Apple as
   * absent — which was vacuous. Anything iOS-only therefore has to be read rather than
   * looked at, so these greps are the load-bearing half for Apple.
   */
  console.log('\nthe source, since Platform.OS === ios is invisible to a web render');
  const SOURCE_MARKERS = [
    ['apple', /handleAppleSignIn|logo-apple|expo-apple-authentication|provider: 'apple'/],
    ['google', /handleGoogleSignIn|logo-google|provider: 'google'/],
    ['facebook', /handleFacebookSignIn|logo-facebook|provider: 'facebook'/],
  ];
  for (const rel of ['app/(auth)/login.tsx', 'app/(auth)/register.tsx']) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const [name, marker] of SOURCE_MARKERS) {
      const present = marker.test(src);
      if (external[name]) {
        record(present, `${rel} wires up ${name}, which the server has enabled`);
      } else {
        record(!present, `${rel} has no ${name} code, and the server has it disabled`);
      }
    }
  }

  // The path that has to keep working now that the buttons are gone.
  console.log('\nthe email path still works');
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
    first_name: 'Authcheck',
    last_name: 'Fixture',
    display_name: 'Authcheck',
    date_of_birth: '1996-04-11',
    gender: 'female',
    gender_preference: ['male'],
    jewish_background: 'modern_orthodox',
    looking_for: 'marriage_minded',
    is_active: true,
    onboarding_complete: true,
  });
  if (rowErr) throw new Error(`profile insert failed: ${rowErr.message}`);

  await browser.goto(BASE + '/login', { settle: 7000 });
  await browser.typeInto(0, EMAIL);
  await browser.typeInto(1, PASSWORD);
  await browser.clickText('Sign In', { exact: true });
  await sleep(10000);
  const after = await browser.evaluate(`(document.getElementById('root')?.innerText || '')`);
  // Landing anywhere past the auth group is the assertion. Not the deck's *contents*:
  // while 00030 is unapplied the deck is empty for everyone (MEXA-385), so this looks for
  // the Discover screen itself rather than a profile on it.
  const signedIn = /You've seen everyone|Drag dots to navigate|Finding great people/i.test(after);
  record(signedIn, 'email sign-in reaches the app', after.replace(/\n+/g, ' ').slice(0, 70));
  record(
    !/Sign In/i.test(after) || signedIn,
    'and is no longer on the login screen'
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
