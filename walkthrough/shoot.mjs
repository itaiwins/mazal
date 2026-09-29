#!/usr/bin/env node
/**
 * Drive the Mazal web export through a new user's whole path and screenshot it. (MEXA-328)
 *
 * One browser session from the welcome screen to the paywall, in the order a new user
 * meets them. Everything it touches is real: the live Supabase project, a real sign-up,
 * the real confirmation email, a real second user to match and message with.
 *
 * Preconditions, all of them set up by walkthrough/README.md:
 *   - the export is built and patched, and walkthrough/serve.mjs is serving it on :8787
 *   - fixture B is seeded (walkthrough/fixtures.mjs seed-b)
 *   - SUPABASE_*, AGENTMAIL_API_KEY in the environment
 *
 *   node walkthrough/shoot.mjs <out-dir>
 *
 * Every step is recorded in <out-dir>/manifest.json with how it was reached, so a screen
 * that had to be opened by URL instead of by tapping through is visible as such. A step
 * that fails is recorded and the run continues - a partial pack beats no pack.
 */

import { launch } from './cdp.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:8787';
const OUT = path.resolve(process.argv[2] || 'walkthrough-out');
// Resolved from AgentMail at run time, not written down: this repo is public and a real,
// receivable mailbox does not belong in it. See walkthrough/fixtures.mjs.
let EMAIL_A = null;
const PASSWORD = process.env.WALKTHROUGH_PASSWORD || 'Mazal-Walkthrough-328!';

fs.mkdirSync(OUT, { recursive: true });

const manifest = [];
let seq = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fixtures = (...args) =>
  JSON.parse(execFileSync('node', [path.join(HERE, 'fixtures.mjs'), ...args], { encoding: 'utf8' }));

let browser;

/** Screenshot the current screen and record it. `how` says how it was reached. */
async function capture(title, { how = 'tapped through', note = '' } = {}) {
  seq += 1;
  const file = `${String(seq).padStart(2, '0')}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
  await browser.shot(path.join(OUT, file));
  const entry = {
    n: seq,
    title,
    file,
    route: await browser.evaluate('location.pathname + location.search'),
    how,
    note,
  };
  manifest.push(entry);
  console.log(`  [${entry.n}] ${title}  (${entry.route})  ${how}${note ? ' — ' + note : ''}`);
  return entry;
}

async function step(title, fn, opts = {}) {
  try {
    const extra = (await fn()) || {};
    return await capture(title, { ...opts, ...extra });
  } catch (e) {
    seq += 1;
    const file = `${String(seq).padStart(2, '0')}-FAILED-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    let text = '';
    try {
      await browser.shot(path.join(OUT, file));
      text = (await browser.text()).replace(/\n+/g, ' | ').slice(0, 400);
    } catch {}
    const entry = {
      n: seq,
      title,
      file,
      how: 'FAILED',
      note: e.message,
      screenText: text,
      console: browser.console.slice(-20),
    };
    manifest.push(entry);
    console.log(
      `  [${entry.n}] ${title}  FAILED: ${e.message}\n        screen: ${text}\n        console:\n          ` +
        entry.console.join('\n          ')
    );
    return entry;
  }
}

/** Two local photos for the onboarding picker, fetched once. */
async function photoFiles() {
  const urls = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800',
  ];
  const files = [];
  for (const [i, url] of urls.entries()) {
    const file = path.join(OUT, `.photo-${i}.jpg`);
    if (!fs.existsSync(file)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`photo fetch ${url} -> ${res.status}`);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    }
    files.push(file);
  }
  return files;
}

/** A phone-sized headless Chrome with the permissions a user would have granted. */
async function newBrowser() {
  const b = await launch({ width: 390, height: 844, scale: 2 });
  // The location step asks for geolocation. Answer it the way a user who taps "Allow"
  // does, rather than letting the prompt hang the step.
  await b.send('Browser.grantPermissions', {
    origin: BASE,
    permissions: ['geolocation', 'notifications'],
  });
  await b.send('Emulation.setGeolocationOverride', {
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 20,
  });
  return b;
}

/**
 * RESUME=1 skips the sign-up and confirmation phases and starts from a sign-in with an
 * account that already exists. Only for iterating on the later steps without burning
 * another confirmation email out of the team's shared 100/day Resend bucket - the pack
 * that ships is always a full run.
 */
const RESUME = process.env.WALKTHROUGH_RESUME === '1';

async function main() {
  EMAIL_A = fixtures('email-a').email;
  const photos = await photoFiles();
  browser = await newBrowser();

  let signUpAt = null;
  let confirmScreenHung = RESUME;

  if (!RESUME) {
  console.log('\n--- before sign-up ---');
  await browser.goto(BASE + '/', { settle: 6000 });
  await step('Welcome', async () => ({ how: 'cold start, signed out' }));

  await step('Sign in', async () => {
    await browser.clickText('Sign In');
    await sleep(1500);
  });

  await step('Forgot password', async () => {
    await browser.clickText('Forgot password?');
    await sleep(1500);
  });

  await step('Create account', async () => {
    await browser.clickText('Back to sign in');
    await sleep(1200);
    await browser.clickText('Sign up');
    await sleep(1500);
  });

  await step('Create account, filled in', async () => {
    await browser.typeInto(0, EMAIL_A);
    await browser.typeInto(1, PASSWORD);
    await browser.typeInto(2, PASSWORD);
    await browser.clickText('I confirm that I am 18 years or older');
    await sleep(600);
  });

  // The sign-up itself. On iOS the success path is an Alert saying "Check your email";
  // react-native-web has no Alert, so on web the screen simply stays put - see the
  // manifest note and walkthrough/NOTES.md.
  await step('Sign-up submitted', async () => {
    browser.clearConsole();
    signUpAt = new Date(Date.now() - 30000).toISOString();
    await browser.clickText('Create Account');
    await sleep(6000);
    const text = await browser.text();
    if (/Error|error/.test(text)) throw new Error('sign-up reported: ' + text.slice(0, 200));
    return {
      note: 'real signUp against the live project; the iOS "Check your email" Alert has no web equivalent so the form stays as-is',
    };
  });

  console.log('\n--- email confirmation ---');
  let code = null;
  await step('Confirming your email', async () => {
    const res = fixtures('confirm-code', EMAIL_A, signUpAt);
    code = res.code;
    await browser.pushRoute(`/auth/confirm?code=${encodeURIComponent(code)}&type=signup`, { settle: 250 });
    return { how: 'opened the link from the real confirmation email', note: `subject: ${res.subject}` };
  });

  /**
   * The spinner never clears. `exchangeCodeForSession` succeeds - the console shows the
   * session written to storage and a `SIGNED_IN` event - but the promise the screen is
   * awaiting never resolves, so `setStatus('confirmed')` never runs. See NOTES.md
   * finding 1. Record it, then recover the way a stuck user would: relaunch the app.
   */
  await step('Email confirmed', async () => {
    const ok = await browser.waitForText('Email confirmed', 45000);
    if (!ok) {
      confirmScreenHung = true;
      const signedIn = browser.console.some((l) => l.includes('SIGNED_IN'));
      return {
        how: 'FINDING',
        note:
          'stuck on the spinner for 45s. The sign-in itself worked' +
          (signedIn ? ' (SIGNED_IN was logged and the session was written to storage)' : '') +
          ', so the account is confirmed and signed in behind a screen that never advances.',
      };
    }
    await sleep(500);
  });

  }

  console.log('\n--- onboarding ---');
  await step('Onboarding welcome', async () => {
    if (confirmScreenHung) {
      // Once the confirm screen wedges, nothing in that instance renders again - routing
      // to /login from it comes back blank too. So start the app clean, with no stored
      // session, and sign in from the login screen, which is where register.tsx's own
      // "verify your email to continue" alert sends the user anyway. A *reload carrying
      // the stored session* is the one thing that cannot be used here: that is the blank
      // screen in NOTES.md finding 2.
      await browser.close();
      browser = await newBrowser();
      await browser.goto(BASE + '/', { settle: 7000 });
      await browser.clickText('Sign In', { exact: true });
      await sleep(2500);
      await browser.typeInto(0, EMAIL_A);
      await browser.typeInto(1, PASSWORD);
      await browser.clickText('Sign In', { exact: true });
      await sleep(9000);
      return {
        how: 'fresh launch with no stored session, signed in from the login screen — the confirm screen never advanced',
      };
    }
    await browser.clickText('Continue');
    await sleep(2500);
  });

  await step('Basics', async () => {
    await browser.clickText("Let's Go");
    await sleep(1800);
    await browser.typeInto(0, 'Ari');
    await sleep(400);
    await browser.clickText('Man', { exact: true });
    await sleep(500);
  });

  await step('Photos', async () => {
    await browser.clickText('Continue');
    await sleep(1800);
  });

  await step('Photos, two chosen', async () => {
    // The six 3:4 slots, left to right, top to bottom. Measured once, before anything is
    // uploaded: a filled slot swaps its "add" Pressable for the photo and a remove
    // button, and react-native-web draws that photo as a background-image rather than an
    // <img>, so "which slots are still empty" cannot be read back from the DOM.
    const slots = await browser.evaluate(`(() => {
      const root = document.getElementById('root');
      const out = [];
      for (const el of root.querySelectorAll('div')) {
        const r = el.getBoundingClientRect();
        if (r.width < 80 || r.width > 220) continue;
        if (Math.abs(r.height / r.width - 4 / 3) > 0.08) continue;
        const c = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        if (out.some((o) => Math.abs(o.x - c.x) < 8 && Math.abs(o.y - c.y) < 8)) continue;
        out.push(c);
      }
      return out.sort((a, b) => a.y - b.y || a.x - b.x);
    })()`);
    if (!slots || slots.length < photos.length) {
      throw new Error(`found ${slots ? slots.length : 0} photo slots, need ${photos.length}`);
    }

    for (const [i, file] of photos.entries()) {
      const armed = browser.armFileChooser([file]);
      await browser.clickAt(slots[i].x, slots[i].y);
      await armed;
      await sleep(2000);
    }
    return { note: 'expo-image-picker on web is a file input; both photos chosen through the real picker' };
  });

  await step('Jewish identity', async () => {
    await browser.clickText('Continue');
    await sleep(1800);
  });

  await step('Location', async () => {
    await browser.clickText('Modern Orthodox', { exact: true });
    await sleep(400);
    await browser.clickText('Somewhat Observant', { exact: true });
    await sleep(400);
    await browser.clickText('Continue');
    await sleep(1800);
  });

  await step('Education and work', async () => {
    await browser.typeInto(0, 'Brooklyn, NY', { placeholder: 'City, State' });
    await sleep(600);
    await browser.clickText('Continue');
    await sleep(1800);
  });

  await step('Lifestyle', async () => {
    await browser.typeInto(0, 'Product designer', { placeholder: 'e.g. Software Engineer' });
    await sleep(600);
    await browser.clickText('Continue');
    await sleep(1800);
  });

  await step('Relationship goals', async () => {
    await browser.clickText('Continue');
    await sleep(1800);
  });

  // Marriage-minded, looking for women, wants kids - and "Women" is what puts fixture B
  // in A's deck at all (useDiscoveryProfiles filters on gender_preference).
  await step('Dealbreakers', async () => {
    await browser.clickText('Marriage', { exact: true });
    await sleep(300);
    await browser.clickText('Women', { exact: true });
    await sleep(300);
    await browser.clickText('Want kids', { exact: true });
    await sleep(300);
    await browser.clickText('Continue');
    await sleep(1800);
  });

  await step('Prompts', async () => {
    await browser.clickText('Jewish only', { exact: true });
    await sleep(300);
    await browser.clickText('Observes Shabbat', { exact: true });
    await sleep(300);
    await browser.clickText('Continue');
    await sleep(1800);
  });

  await step('Prompts, two answered', async () => {
    const answers = [
      ['My Shabbat looks like...', 'Too many people around one table and nobody leaving before midnight.'],
      ['Best Jewish food take:', 'Lox should be silky, never chunky. I will not be taking questions.'],
    ];
    for (const [question, answer] of answers) {
      await browser.clickText('Add a prompt');
      await sleep(1200);
      await browser.clickText(question, { exact: true });
      await sleep(1200);
      await browser.typeInto(0, answer, { placeholder: 'Write your answer' });
      await sleep(400);
      await browser.clickText('Save', { exact: true });
      await sleep(800);
    }
  });

  await step('Preferences', async () => {
    await browser.clickText('Continue');
    await sleep(1800);
  });

  await step('Notifications', async () => {
    await browser.clickText('Continue');
    await sleep(1800);
  });

  // The profile write happens here: complete.tsx inserts the users row, the photos and
  // the prompts against the live project.
  await step('Onboarding complete', async () => {
    await browser.clickText('Enable Notifications');
    await sleep(3000);
  });

  /**
   * Open a route without reloading the page.
   *
   * Once this browser holds a session, a full page load never finishes rendering
   * (NOTES.md finding 2) - so every navigation from here on is a client-side one, the
   * same kind a tap on a tab bar makes.
   */
  const goToRoute = (route, settle) => browser.pushRoute(route, { settle });

  console.log('\n--- the app proper ---');

  // B likes A first, so the card A is about to see is one that already likes her back and
  // the very next swipe produces a real match. `has_liked_me` is only used for ordering -
  // the app never draws it (NOTES.md finding 3), so the card itself looks no different.
  await step('Discover', async () => {
    await browser.clickText('Start Swiping');
    await sleep(4000);
    const liked = fixtures('b-likes-a');
    console.log(`      fixture B liked A (${liked.bUserId} -> ${liked.aUserId})`);
    // Re-enter the deck so the like is in the query, the way switching tabs does. A
    // client-side route change, never a reload - see goToRoute().
    await goToRoute('/matches', 4000);
    await goToRoute('/', 9000);
    return { note: 'one real candidate: fixture B, read out of user_public_profiles' };
  });

  /** The three circular buttons at the bottom of the deck: pass, super like, like. */
  async function tapAction(which) {
    const idx = { pass: 0, superlike: 1, like: 2 }[which];
    const box = await browser.evaluate(`(() => {
      const root = document.getElementById('root');
      const vh = window.innerHeight;
      const hits = [];
      for (const el of root.querySelectorAll('div')) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const radius = parseFloat(cs.borderRadius) || 0;
        const round = radius >= Math.min(r.width, r.height) / 2 - 1;
        if (round && r.width >= 44 && r.width <= 90 && Math.abs(r.width - r.height) < 6 && r.top > vh * 0.68) {
          hits.push({ x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width });
        }
      }
      // De-duplicate nested circles at the same centre, then order left to right.
      const uniq = [];
      for (const h of hits.sort((a, b) => b.w - a.w)) {
        if (!uniq.some((u) => Math.abs(u.x - h.x) < 12 && Math.abs(u.y - h.y) < 12)) uniq.push(h);
      }
      return uniq.sort((a, b) => a.x - b.x);
    })()`);
    if (!box || box.length < 3) throw new Error(`found ${box ? box.length : 0} action buttons, expected 3`);
    await browser.clickAt(box[idx].x, box[idx].y);
  }

  await step("It's a match", async () => {
    await tapAction('like');
    const ok = await browser.waitForText('Match', 20000);
    if (!ok) throw new Error('no match screen after the like: ' + (await browser.text()).slice(0, 200));
    // The two avatars fly in from the edges; capture after they land, not mid-flight.
    await sleep(5000);
    return { note: 'real mutual like: the 00017 trigger wrote the row and realtime delivered it' };
  });

  await step('Matches', async () => {
    const seeded = fixtures('seed-messages');
    console.log(`      seeded ${seeded.messages} messages in match ${seeded.matchId}`);
    await goToRoute('/matches', 8000);
  });

  await step('Chat', async () => {
    await browser.clickText('Rivka');
    await sleep(5000);
  });

  /**
   * Tap one of the four dots in the app's own tab bar (src/components/navigation/
   * DotNavigator.tsx). The Profile tab cannot be reached by URL: `app/(tabs)/profile.tsx`
   * and `app/profile/index.tsx` both answer `/profile`, and the modal Edit Profile screen
   * is the one that wins (NOTES.md finding 6).
   */
  async function tapDot(index) {
    const dots = await browser.evaluate(`(() => {
      const vh = window.innerHeight;
      const out = [];
      for (const el of document.body.querySelectorAll('div')) {
        const r = el.getBoundingClientRect();
        if (r.height < 4 || r.height > 10) continue;
        if (r.width < 4 || r.width > 40) continue;
        if (r.top < vh * 0.85) continue;
        if (out.some((o) => Math.abs(o.x - (r.x + r.width / 2)) < 10)) continue;
        out.push({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
      }
      return out.sort((a, b) => a.x - b.x);
    })()`);
    if (!dots || dots.length < 4) throw new Error(`found ${dots ? dots.length : 0} tab dots, expected 4`);
    await browser.clickAt(dots[index].x, dots[index].y);
  }

  await step('Profile', async () => {
    await tapDot(3);
    await sleep(6000);
    return { how: "tapped the Profile dot in the app's own tab bar" };
  });

  await step('Edit profile', async () => {
    await goToRoute('/profile/edit', 6000);
    return { how: 'opened by URL' };
  });

  await step('Paywall', async () => {
    await goToRoute('/premium', 7000);
    return {
      how: 'opened by URL',
      note: 'RevenueCat is a native module, so no App Store price rows here - see NOTES.md finding 5',
    };
  });

  await step('Settings', async () => {
    await goToRoute('/settings', 7000);
  });

  await step('Change password', async () => {
    await browser.clickText('Change Password');
    await sleep(3000);
  });

  await step('Privacy settings', async () => {
    await goToRoute('/settings/privacy', 4000);
    return { how: 'opened by URL' };
  });

  await step('Delete account row', async () => {
    await goToRoute('/settings', 5000);
    await browser.evaluate(`(() => { document.querySelectorAll('div').forEach(() => {}); window.scrollTo(0, 99999); return true; })()`);
    await sleep(600);
    return {
      how: 'opened by URL',
      note: 'the confirmation is an Alert.alert, which react-native-web does not implement - not shown, described in NOTES.md',
    };
  });

  await step('Terms of service', async () => {
    await goToRoute('/legal/terms', 4000);
    return { how: 'opened by URL' };
  });

  await step('Privacy policy', async () => {
    await goToRoute('/legal/privacy', 4000);
    return { how: 'opened by URL' };
  });

  await step('Mazal map', async () => {
    await goToRoute('/mazal-map', 6000);
    return {
      how: 'opened by URL',
      note: 'react-native-maps is native-only; this is the app\'s own "map unavailable" branch, not a stand-in',
    };
  });

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nwrote ' + path.join(OUT, 'manifest.json'));
  await browser.close();
}

main().catch(async (e) => {
  console.error('fatal:', e);
  if (browser) {
    try {
      await browser.shot(path.join(OUT, 'zz-fatal.png'));
      console.error('console tail:\n' + browser.console.slice(-30).join('\n'));
    } catch {}
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  process.exit(1);
});
