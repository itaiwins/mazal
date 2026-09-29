/**
 * Auth entry points, in a real render (MEXA-335)
 *
 * The part `scripts/e2e/mexa335-auth-lock-deadlock.mjs` cannot see: **what the user gets
 * on screen**. That script proves the auth client no longer deadlocks; this one proves
 * the app actually draws. Both MEXA-335 symptoms were rendering observations — a spinner
 * that never cleared and a permanent white screen — so it takes a render to close them.
 *
 * It drives the same web export the walkthrough pack does, at the same phone viewport.
 *
 * ## Phase A - relaunch (NOTES.md finding 2), always runs
 *
 *   1. cold start with empty storage, sign in through the login screen  (the control;
 *      this always worked, and it is also where the router gate is exercised)
 *   2. reload the page, carrying the stored session                     (the bug)
 *
 * Step 2 is a real `Page.navigate`, not `pushRoute`, so the JS context is thrown away and
 * rebuilt over the saved session — a second launch, not a route change. It asserts on the
 * console, because "blank" and "still painting" look the same in a screenshot: before the
 * fix the log stopped dead at `Auth event: SIGNED_IN | Has session: true` and
 * `[Layout] Got session:` never printed.
 *
 * ## Phase B - the confirmation link (NOTES.md finding 1), `--with-confirm` only
 *
 * Signs up through the real register screen, reads the link out of the real confirmation
 * email, and opens it in the same browser — the only browser that can redeem the PKCE
 * code, since it holds the `code_verifier`. Before the fix this sat on "Confirming your
 * email…" forever while the exchange had in fact succeeded.
 *
 * Off by default because **it sends a real email** out of the team's shared 100/day
 * Resend bucket (TEAM_BOARD, MEXA-304), and Mazal's auth SMTP is rate limited on top of
 * that. Check `GET https://api.resend.com/usage` before using it.
 *
 * Note both phases run on `navigatorLock`, since Chrome has `navigator.locks` — that is
 * where the bug was found. React Native gets `lockNoOp`, which
 * `scripts/e2e/mexa335-auth-lock-deadlock.mjs` covers in its case 1.
 *
 * ## Running it
 *
 *   set -a
 *   . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env
 *   . /home/itai/mexant/workspace/archive/credentials/mexant-agentmail.env   # phase B
 *   set +a
 *
 *   MAZAL_WEB_SHIMS=1 npx expo export --platform web --output-dir /tmp/web --clear
 *   node walkthrough/patch-export.mjs /tmp/web
 *   node walkthrough/serve.mjs /tmp/web 8788 &
 *
 *   node walkthrough/fixtures.mjs reclaim
 *   node walkthrough/fixtures.mjs seed-b
 *   node walkthrough/check-auth-entry.mjs 8788 /tmp/authentry [--with-confirm]
 *   node walkthrough/fixtures.mjs teardown          # deletes A and B
 *
 * `fixtures.mjs` owns both accounts either side of this; nothing here creates or deletes
 * a row itself, except that phase B's sign-up creates A through the app's own UI, exactly
 * as `shoot.mjs` does. `teardown` afterwards is not optional.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch } from './cdp.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const argv = process.argv.slice(2);
const WITH_CONFIRM = argv.includes('--with-confirm');
const positional = argv.filter((a) => !a.startsWith('--'));
const PORT = Number(positional[0] || 8788);
const OUT = path.resolve(positional[1] || '/tmp/authentry');
const BASE = `http://127.0.0.1:${PORT}`;

// Copied rather than imported: `fixtures.mjs` runs its CLI switch at module scope, so
// importing it from here makes it read *our* argv and exit. Keep this in step with
// `EMAIL_B` and `PASSWORD` there.
const EMAIL_B = process.env.WALKTHROUGH_EMAIL_B || 'violet-e2e-walkthrough-b@example.com';
const PASSWORD = process.env.WALKTHROUGH_PASSWORD || 'Mazal-Walkthrough-328!';

const fixtures = (...a) =>
  JSON.parse(execFileSync('node', [path.join(HERE, 'fixtures.mjs'), ...a], { encoding: 'utf8' }));

/** A signed-in, onboarded user lands on the tabs; this is the text that proves it drew. */
const SIGNED_IN_MARKER = 'Discover';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
let failures = 0;
function check(n, name, pass, detail = '') {
  results.push({ n, name, pass });
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'}  ${String(n).padStart(2)}. ${name}${detail ? `  ${detail}` : ''}`
  );
}

function tail(lines, n = 30) {
  return lines.slice(-n).map((l) => `      ${l}`).join('\n');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`MEXA-335 - auth entry points in a real render\n  ${BASE}`);
  console.log(`  phase B (confirmation email): ${WITH_CONFIRM ? 'ON' : 'off'}\n`);

  let browser = await launch({});
  try {
    // ================================================================= phase A
    console.log('phase A/1: first launch, empty storage (control)');
    await browser.goto(BASE + '/', { settle: 7000 });
    await browser.clickText('Sign In', { exact: true });
    await sleep(2500);
    await browser.typeInto(0, EMAIL_B);
    await browser.typeInto(1, PASSWORD);
    await browser.clickText('Sign In', { exact: true });

    const signedIn = await browser.waitForText(SIGNED_IN_MARKER, 30000);
    await browser.shot(path.join(OUT, 'a1-first-launch-signed-in.png'));
    // Also fails if the router decides before the deferred profile lands: an onboarded
    // user gets pushed to /(onboarding)/welcome and never sees the tabs.
    check(1, 'signing in from a clean start reaches the app', signedIn);

    const stored = await browser.evaluate(
      `Object.keys(window.localStorage).filter((k) => k.includes('auth-token')).length`
    );
    check(2, 'the session was written to storage', stored > 0, `keys=${stored}`);

    if (failures > 0) {
      console.log('\n  console tail:\n' + tail(browser.console, 40));
      return;
    }

    console.log('\nphase A/2: second launch, session in storage (the bug)');
    browser.clearConsole();
    await browser.goto(BASE + '/', { settle: 9000 });

    const drewAgain = await browser.waitForText(SIGNED_IN_MARKER, 30000);
    await browser.shot(path.join(OUT, 'a2-second-launch.png'));

    const log = browser.console.join('\n');
    const body = (await browser.text()).trim();
    const sawGotSession = log.includes('[Layout] Got session:');

    check(3, 'the auth event still fires on the relaunch', log.includes('Auth event: SIGNED_IN'));
    check(
      4,
      '[Layout] Got session: prints, so prepare() got past getSession()',
      sawGotSession,
      sawGotSession ? '' : '(this is the deadlock)'
    );
    check(
      5,
      'the app renders instead of a white screen',
      drewAgain && body.length > 0,
      `body=${body.length} chars`
    );

    if (failures > 0) {
      console.log('\n  console tail:\n' + tail(browser.console, 40));
      return;
    }

    // ================================================================= phase B
    if (!WITH_CONFIRM) {
      console.log('\nphase B skipped (pass --with-confirm to send a real email)');
      return;
    }

    console.log('\nphase B: sign up and open the link from the real email');
    const EMAIL_A = fixtures('email-a').email;
    console.log(`  A = ${EMAIL_A}`);

    // A fresh browser, so the sign-up starts with no stored session exactly as a new user
    // does, and B's session cannot be mistaken for A's.
    await browser.close();
    browser = await launch({});

    await browser.goto(BASE + '/', { settle: 7000 });
    await browser.clickText('Sign In', { exact: true });
    await sleep(1800);
    await browser.clickText('Sign up');
    await sleep(2000);
    await browser.typeInto(0, EMAIL_A);
    await browser.typeInto(1, PASSWORD);
    await browser.typeInto(2, PASSWORD);
    await browser.clickText('I confirm that I am 18 years or older');
    await sleep(600);

    const signUpAt = new Date(Date.now() - 30000).toISOString();
    browser.clearConsole();
    await browser.clickText('Create Account');
    await sleep(6000);
    // On iOS the success path is an Alert; react-native-web has none, so the form just
    // stays put and the only signal here is the absence of an error (shoot.mjs, NOTES.md).
    const afterSignUp = await browser.text();
    check(
      6,
      'the real sign-up goes through',
      !/Error|error/.test(afterSignUp),
      afterSignUp.slice(0, 120).replace(/\s+/g, ' ')
    );
    if (failures > 0) {
      console.log('\n  console tail:\n' + tail(browser.console, 40));
      return;
    }

    // The link points at `mazal://`, which headless Chrome has no handler for, so the
    // `/auth/v1/verify` hop is made here and the `?code=` it redirects to is opened as a
    // route. Same browser, so it still holds the matching `code_verifier`.
    const confirm = fixtures('confirm-code', EMAIL_A, signUpAt);
    console.log(`  email: ${confirm.subject}`);
    browser.clearConsole();
    await browser.pushRoute(`/auth/confirm?code=${encodeURIComponent(confirm.code)}&type=signup`, {
      settle: 250,
    });

    const confirmed = await browser.waitForText('Email confirmed', 45000);
    await browser.shot(path.join(OUT, 'b1-confirm.png'));
    check(
      7,
      'the confirm screen advances past the spinner',
      confirmed,
      confirmed ? '' : '(stuck on "Confirming your email…" — the deadlock)'
    );

    // The rest of finding 1: once the confirm screen wedged, every other route in that
    // instance came back blank too.
    await browser.clickText('Continue');
    await sleep(3000);
    const next = (await browser.text()).trim();
    await browser.shot(path.join(OUT, 'b2-after-continue.png'));
    check(8, 'Continue leads somewhere that renders', next.length > 0, `body=${next.length} chars`);

    if (failures > 0) console.log('\n  console tail:\n' + tail(browser.console, 40));
  } finally {
    await browser.close();
    const passed = results.filter((r) => r.pass).length;
    console.log(`\n${passed}/${results.length} passed`);
    console.log(`screenshots in ${OUT}`);
    if (WITH_CONFIRM) console.log('remember: node walkthrough/fixtures.mjs teardown');
    process.exit(failures > 0 ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
