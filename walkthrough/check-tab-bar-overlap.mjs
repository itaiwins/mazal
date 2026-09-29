#!/usr/bin/env node
/**
 * check-tab-bar-overlap.mjs — measures the DotNavigator against the content beneath it.
 *
 * MEXA-338, walkthrough finding 9: the navigator is `position: 'absolute'` over the
 * screen and the screens beneath only padded by `insets.bottom`, so the discover action
 * buttons, the chat composer and the first row of the profile's Account list all sat
 * underneath it (MEXA-328 pack screens 24, 27, 28). This is the measurement, not a
 * screenshot: it reads `getBoundingClientRect()` for the navigator and for everything that
 * draws text or takes a tap, and asserts none of it intersects the navigator's band.
 *
 * It covers the **Profile tab and the Map**. The deck, the matches list and the chat all
 * need data the live project cannot currently supply — see the comment in `run()`. Every
 * screen pads by the same published constant, and that constant is asserted against the
 * rendered height, so this is not the whole of finding 9; it is the part that can be
 * measured from this machine.
 *
 * It also prints the navigator's **rendered** height against `DOT_NAVIGATOR_HEIGHT`. That
 * constant is what every screen pads by, so if the render disagrees with it every fix
 * built on it is off by the difference — which is exactly how the chat composer ended up
 * with a hand-written `70` that was 15pt short.
 *
 * Two live fixtures on `tayiyczmacvhokdxfqvm`, both created through the admin API with
 * `email_confirm: true`, so **no confirmation email is sent** and the team's shared
 * 100/day Resend bucket is untouched (TEAM_BOARD, MEXA-304). Both are removed in a
 * `finally`, and the run prints the user count before and after.
 *
 *   cd REPOS/mazal-MEXA-338
 *   set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
 *   MAZAL_WEB_SHIMS=1 npx expo export --platform web --output-dir /tmp/web --clear
 *   node walkthrough/patch-export.mjs /tmp/web
 *   node walkthrough/serve.mjs /tmp/web 8787 &
 *   node walkthrough/check-tab-bar-overlap.mjs
 *
 * What it cannot answer: `useSafeAreaInsets()` is 0 in this render and 34 on a notched
 * iPhone. Every number below is therefore the inset-0 case. That is the *tighter* one —
 * the fix adds the navigator's height to whatever the inset is, so clearing it at 0
 * clears it at 34 — but the visual result still wants a device look (MEXA-344).
 */

import { createClient } from '@supabase/supabase-js';
import { launch } from './cdp.mjs';

const BASE = process.env.WALKTHROUGH_BASE || 'http://127.0.0.1:8787';
const PASSWORD = process.env.WALKTHROUGH_PASSWORD || 'Mazal-Walkthrough-328!';
// Same names the rest of walkthrough/ reads, from archive/credentials/mazal-supabase.env.
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

/** Both fixtures are @example.com, which the repo's own sweep recognises. */
const HER = 'violet-mexa338-overlap-her@example.com';
const HIM = 'violet-mexa338-overlap-him@example.com';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BASE_PROFILE = {
  date_of_birth: '1996-04-11',
  current_city: 'Brooklyn',
  current_state: 'NY',
  current_country: 'USA',
  current_latitude: 40.6782,
  current_longitude: -73.9442,
  jewish_background: 'modern_orthodox',
  observance_level: 'somewhat_observant',
  looking_for: 'marriage_minded',
  wants_children: 'yes',
  is_active: true,
  onboarding_complete: true,
};

/**
 * She is who we sign in as. He is the one candidate in her deck, which is the only way the
 * discover action buttons render at all — an empty deck draws the "You've seen everyone"
 * state instead, and that is not the screen with the overlap on it.
 */
const PEOPLE = {
  her: {
    email: HER,
    profile: {
      ...BASE_PROFILE,
      first_name: 'Overlapher',
      last_name: 'Fixture',
      display_name: 'Overlapher',
      gender: 'female',
      gender_preference: ['male'],
      bio: 'MEXA-338 overlap measurement fixture.',
    },
  },
  him: {
    email: HIM,
    profile: {
      ...BASE_PROFILE,
      first_name: 'Overlaphim',
      last_name: 'Fixture',
      display_name: 'Overlaphim',
      gender: 'male',
      gender_preference: ['female'],
      bio: 'MEXA-338 overlap measurement fixture, the candidate in her deck.',
    },
  },
};

async function countUsers() {
  const { count, error } = await admin.from('users').select('id', { count: 'exact', head: true });
  if (error) throw new Error(`count failed: ${error.message}`);
  return count;
}

async function seed(who) {
  const { email, profile } = PEOPLE[who];
  // email_confirm: true — created confirmed, so GoTrue sends nothing.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  const authId = data.user.id;
  const { data: row, error: rowErr } = await admin
    .from('users')
    .insert({ auth_id: authId, email, ...profile })
    .select('id')
    .single();
  if (rowErr) throw new Error(`profile insert for ${who} failed: ${rowErr.message}`);
  return { authId, userId: row.id };
}

async function removeFixtures() {
  let removed = 0;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      if (u.email !== HER && u.email !== HIM) continue;
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (delErr) throw new Error(`deleteUser(${u.email}) failed: ${delErr.message}`);
      removed += 1;
    }
    if (data.users.length < 200) break;
  }
  return removed;
}

// ---------------------------------------------------------------------------------------

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

/**
 * Find the navigator itself.
 *
 * By its hint text, because react-native-web emits generated class names: "Drag dots to
 * navigate" is the only copy in the app that appears inside it. The *leaf* carrying that
 * text, then out to the first ancestor pinned to the bottom of the screen — searching for
 * the pinned element directly finds an outer page wrapper that also contains the text,
 * which is a mistake that makes the whole check pass vacuously.
 */
const FIND_NAV = `(() => {
  const hint = [...document.querySelectorAll('div')].find(
    (el) => el.children.length === 0 && el.textContent.trim() === 'Drag dots to navigate'
  );
  if (!hint) return null;
  let el = hint;
  for (let i = 0; i < 8 && el; i += 1) {
    const cs = getComputedStyle(el);
    if (cs.position === 'absolute' && cs.bottom === '0px') return el;
    el = el.parentElement;
  }
  return null;
})()`;

const NAV_BOX = `(() => {
  const nav = ${FIND_NAV};
  if (!nav) return null;
  const r = nav.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, height: r.height };
})()`;

/**
 * Anything that draws text or takes a tap and whose box reaches into the navigator's band.
 *
 * Only leaves are reported: an element is skipped when a descendant of it is also an
 * intruder, otherwise one overlapping row comes back as itself plus six wrappers. The
 * navigator's own subtree, and the ancestors that contain it, are excluded.
 */
const intruders = (navTop) => `(() => {
  const nav = ${FIND_NAV};
  const vh = window.innerHeight;
  const hits = [];
  for (const el of document.querySelectorAll('div, span, input, textarea, img')) {
    if (nav && (nav === el || nav.contains(el) || el.contains(nav))) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    // Taller than the viewport is a page wrapper, not content.
    if (r.height > vh) continue;
    if (r.bottom <= ${navTop} || r.top >= vh) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') continue;
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ');
    const tappable = el.getAttribute('tabindex') !== null || cs.cursor === 'pointer' ||
      el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'IMG';
    if (!own && !tappable) continue;
    hits.push({ el, own, r });
  }
  const leaves = hits.filter((h) => !hits.some((o) => o !== h && h.el.contains(o.el)));
  return leaves
    .map((h) => ({
      tag: h.el.tagName,
      text: (h.own || '(no text)').slice(0, 40),
      top: Math.round(h.r.top),
      bottom: Math.round(h.r.bottom),
      overlap: Math.round(Math.min(h.r.bottom, vh) - Math.max(h.r.top, ${navTop})),
    }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 8);
})()`;

let browser = null;

async function measure(label, navTop, { expect = null } = {}) {
  // A screen that drew nothing would report "clear" and pass for the wrong reason, so each
  // call names a string that has to be on screen first.
  if (expect) {
    const text = await browser.evaluate(
      `(document.getElementById('root')?.innerText || '')`
    );
    if (!text.includes(expect)) {
      record(false, `${label}: did not render`, `never found ${JSON.stringify(expect)}`);
      return;
    }
  }
  const found = await browser.evaluate(intruders(navTop));
  if (found.length === 0) {
    record(true, `${label}: nothing reaches into the tab bar`);
    return;
  }
  record(
    false,
    `${label}: ${found.length} element(s) under the tab bar`,
    found.map((f) => `${f.text} (${f.top}-${f.bottom}, ${f.overlap}pt into it)`).join('; ')
  );
}

async function run() {
  console.log(`\nDotNavigator overlap, measured at 390x844 against ${BASE}\n`);

  const before = await countUsers();
  console.log(`users before: ${before}`);
  const her = await seed('her');
  const him = await seed('him');
  console.log(`seeded her=${her.userId} him=${him.userId}`);

  browser = await launch({ width: 390, height: 844, scale: 2 });
  await browser.send('Browser.grantPermissions', {
    origin: BASE,
    permissions: ['geolocation', 'notifications'],
  });
  await browser.send('Emulation.setGeolocationOverride', {
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 20,
  });

  // Sign in from a cold start with no stored session. A reload *carrying* a session is
  // the one thing that cannot be used here — that is NOTES.md finding 2.
  await browser.goto(BASE + '/', { settle: 7000 });
  await browser.clickText('Sign In', { exact: true });
  await sleep(2500);
  await browser.typeInto(0, HER);
  await browser.typeInto(1, PASSWORD);
  await browser.clickText('Sign In', { exact: true });
  await sleep(9000);

  // Client-side route changes from here on, never a reload, for the same reason.
  const go = (route, settle = 5000) => browser.pushRoute(route, { settle });

  await go('/', 8000);
  const nav = await browser.evaluate(NAV_BOX);
  if (!nav) throw new Error('DotNavigator not found — is the session signed in?');

  console.log('\nthe navigator itself');
  console.log(`  rendered height ${nav.height}pt, top at y=${Math.round(nav.top)} of 844`);
  // The constant every screen pads by has to match what actually renders, exactly. 85 is
  // the sum of METRICS in DotNavigator.tsx and the inset is 0 in this render, so there is
  // no rounding to allow for — and demanding exactness is what catches an unpinned
  // `lineHeight`, which makes the height a function of the platform's font metrics. The
  // pre-fix build measures 84.5 here for precisely that reason.
  record(
    nav.height === 85,
    'rendered height is exactly DOT_NAVIGATOR_HEIGHT (85 at inset 0)',
    `measured ${nav.height}pt`
  );

  console.log('\nthe screens beneath, on live data');
  // The Profile tab is the one screen that renders fully without the broken deck query.
  await go('/profile', 6000);
  await scrollToEnd();
  await measure('profile, scrolled to the end (pack screen 28)', nav.top, { expect: 'ACCOUNT' });

  await go('/mazal-map', 6000);
  await measure('map (pack screen 37)', nav.top);

  /**
   * Not covered here: the deck's action buttons, the matches list and the chat composer.
   *
   * All three needed data the live project could not supply when this was written —
   * `useDiscoveryProfiles` filters on `user_public_profiles.age`, which migration 00030
   * adds and which was **not applied** to `tayiyczmacvhokdxfqvm`, so the deck query 400d
   * and the screen the walkthrough photographed drew "You've seen everyone!" instead. The
   * app's own Demo Mode would supply the data, but it sits behind a five-tap gesture on
   * the version line that this driver could not make register.
   *
   * **That blocker is gone: 00030 was applied on 2026-09-29 (MEXA-385).** The deck now
   * fills from two seeded fixtures — `check-discovery-deck.mjs` in this directory does
   * exactly that and renders a candidate card. So the deck, and with a match and a message
   * the matches list and the chat, can now be measured here for real. Whoever picks up
   * MEXA-338 finding 9 next should extend `run()` rather than re-reading this note.
   *
   * What stands in for measuring them: all three pad by the same `useDotNavigatorInset()`
   * the Profile tab does, and that value is asserted against the rendered height above. The
   * chat composer is the reason to care about the constant at all — it carried a
   * hand-written 70, which this run measures as 15pt short.
   */
  console.log('\nnot measured here: discover / matches / chat — see the comment above');
}

/** Scroll the screen's own scroller to the bottom; the profile overlap is below the fold. */
async function scrollToEnd() {
  await browser.evaluate(
    `(() => { const s = [...document.querySelectorAll('div')].find(
        (e) => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 300);
      if (s) s.scrollTop = s.scrollHeight; return !!s; })()`
  );
  await sleep(1500);
}

try {
  await run();
} catch (e) {
  record(false, 'the run itself', e.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  const removed = await removeFixtures().catch((e) => {
    console.error(`CLEANUP FAILED: ${e.message}`);
    return -1;
  });
  const after = await countUsers().catch(() => null);
  console.log(`\nremoved ${removed} fixture(s); users after: ${after}`);
  record(removed === 2, 'both fixtures were removed', `removed ${removed}`);
}

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
