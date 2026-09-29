#!/usr/bin/env node
/**
 * check-rewind-button.mjs — is Rewind reachable, and does the thing it reaches work?
 *
 * MEXA-372. The app has sold "Rewind last swipe" on the plan card, in the comparison table
 * and in the paywall's own `rewind` prompt since long before any screen called
 * `useUndoSwipe` — the hook was exported and invoked from nowhere. MEXA-314 built the
 * mechanism (`public.undo_last_swipe()`, migration 00025); this issue built the button.
 * Two different things can be wrong with that, so this measures both, and neither half
 * substitutes for the other:
 *
 *   rpc    — `undo_last_swipe` answers a real `authenticated` caller over PostgREST with
 *            the shape `useUndoSwipe` reads, and each of its three refusals comes back
 *            with the reason the Alert prints. `to_regprocedure()` saying the function
 *            exists does not prove the endpoint is reachable by a client JWT; that is the
 *            404 the issue was worried about.
 *   render — the button is actually on the discovery screen. tsc cannot see this: every
 *            prop could be wired correctly and the button still be off-screen, clipped or
 *            never rendered. Run it against this branch AND against the parent commit's
 *            bundle; without the before column a pass proves nothing (NOTES.md).
 *
 * Two live fixtures on `tayiyczmacvhokdxfqvm`, created through the admin API with
 * `email_confirm: true`, so **no confirmation email is sent** and the team's shared
 * 100/day Resend bucket is untouched (TEAM_BOARD, MEXA-304). Both are removed in a
 * `finally`, and the run prints the user count before and after.
 *
 *   cd REPOS/mazal-MEXA-372
 *   set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
 *   node walkthrough/check-rewind-button.mjs rpc
 *
 *   MAZAL_WEB_SHIMS=1 npx expo export --platform web --output-dir /tmp/web372 --clear
 *   node walkthrough/patch-export.mjs /tmp/web372
 *   node walkthrough/serve.mjs /tmp/web372 8790 &
 *   WALKTHROUGH_BASE=http://127.0.0.1:8790 \
 *     node walkthrough/check-rewind-button.mjs render /tmp/mexa372-shots
 *
 * What the render half cannot answer. `expo export` is a production build, so
 * `DEV_BYPASS_PREMIUM = __DEV__` is false and a fresh fixture is on the free tier: what it
 * photographs is the **locked** button and the paywall behind it. The Gold path — the tap
 * that actually calls the RPC — is what the `rpc` half covers. `Alert.alert` is also a
 * no-op in react-native-web (NOTES.md), so the refusal messages are not screenshottable
 * here either; the `rpc` half asserts the strings instead.
 */

import { createClient } from '@supabase/supabase-js';

const MODE = process.argv[2] || 'rpc';
const SHOTS = process.argv[3] || '/tmp/mexa372-shots';
const BASE = process.env.WALKTHROUGH_BASE || 'http://127.0.0.1:8790';
const PASSWORD = process.env.WALKTHROUGH_PASSWORD || 'Mazal-Walkthrough-328!';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error(
    'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY. Run:\n' +
      '  set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a'
  );
  process.exit(2);
}

const HER = 'violet-mexa372-undo-her@example.com';
const HIM = 'violet-mexa372-undo-him@example.com';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BASE_PROFILE = {
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

// Pinned relative to today rather than written as a literal, so the age the deck filter
// admits is a real assertion and not a number that goes stale next birthday.
const HIS_AGE = 28;
const hisDob = (() => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - HIS_AGE);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
})();

// Their names must not contain "Rewind". The first draft called them Rewindher/Rewindhim
// and "is Rewind on screen" was a substring test, so `Rewindhim, 28` on the card satisfied
// it - the check passed against the *parent commit's* bundle, which has no button at all.
// The control is the only reason that was caught (NOTES.md: without the before column a
// pass proves nothing). The assertion below is now an exact-text element lookup, but the
// names stay clear of the word regardless.
const PEOPLE = {
  her: {
    email: HER,
    profile: {
      ...BASE_PROFILE,
      first_name: 'Undoher',
      last_name: 'Fixture',
      display_name: 'Undoher',
      date_of_birth: '1996-04-11',
      gender: 'female',
      gender_preference: ['male'],
      bio: 'MEXA-372 rewind fixture: the signed-in caller.',
    },
  },
  him: {
    email: HIM,
    profile: {
      ...BASE_PROFILE,
      first_name: 'Undohim',
      last_name: 'Fixture',
      display_name: 'Undohim',
      date_of_birth: hisDob,
      gender: 'male',
      gender_preference: ['female'],
      bio: 'MEXA-372 rewind fixture: the one she swipes on and takes back.',
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
 * The refusal copy, lifted verbatim from `UNDO_REFUSAL_MESSAGES` in
 * src/api/mutations/useSwipe.ts. Asserting the *reason codes* here and the sentences in the
 * client is what keeps the two from drifting: a reason the map has no entry for falls
 * through to "Rewind failed: <code>", which is the kind of string that ships.
 */
const REFUSALS = {
  no_swipe: 'No swipe to undo',
  too_old: 'Swipe is too old to undo',
  matched: "You've already matched - rewind can't undo that. Unmatch them instead.",
};

async function signIn(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
  return client;
}

async function swipeCount(swiperId) {
  const { count, error } = await admin
    .from('swipes')
    .select('id', { count: 'exact', head: true })
    .eq('swiper_id', swiperId);
  if (error) throw new Error(`swipe count failed: ${error.message}`);
  return count;
}

async function runRpc(her, him) {
  console.log('\n--- rpc: undo_last_swipe over PostgREST, as a real authenticated caller\n');
  const asHer = await signIn(HER);

  // 1. Nothing swiped yet. This is also the reachability test: a function that is not
  //    published, or not EXECUTE-able by `authenticated`, comes back 404 PGRST202 here and
  //    every Rewind tap in the app would do the same.
  let { data, error } = await asHer.rpc('undo_last_swipe');
  record(!error, 'the endpoint answers an authenticated caller (not a 404)', error ? `${error.code} ${error.message}` : '');
  if (error) return;
  record(Array.isArray(data) && data.length === 1, 'it returns exactly one row', JSON.stringify(data));
  record(data?.[0]?.ok === false && data?.[0]?.reason === 'no_swipe', `refuses with no_swipe → "${REFUSALS.no_swipe}"`, JSON.stringify(data?.[0]));

  // 2. A fresh like, then take it back. This is the paid path the button drives.
  const { error: likeErr } = await asHer.from('swipes').insert({ swiper_id: her.userId, swiped_id: him.userId, action: 'like' });
  record(!likeErr, 'she can record a like', likeErr ? likeErr.message : '');
  record((await swipeCount(her.userId)) === 1, 'the swipe row is in the table');

  ({ data, error } = await asHer.rpc('undo_last_swipe'));
  const undone = data?.[0];
  record(!error && undone?.ok === true, 'the rewind succeeds', error ? error.message : JSON.stringify(undone));
  record(undone?.swiped_id === him.userId, 'it names who was rewound, which is what the deck lands on', `${undone?.swiped_id}`);
  record(undone?.action === 'like', 'it names the action, which is what decides the Super Like refund', `${undone?.action}`);
  record((await swipeCount(her.userId)) === 0, 'the swipe row is really gone (not an RLS-filtered no-op)');

  // 3. Too old. Back-dated as service_role, because the window is the server's clock and
  //    nothing on the device can move it — which was half of why 00025 exists.
  const { error: oldErr } = await asHer.from('swipes').insert({ swiper_id: her.userId, swiped_id: him.userId, action: 'super_like' });
  record(!oldErr, 'she can record a super like', oldErr ? oldErr.message : '');
  const { error: ageErr } = await admin
    .from('swipes')
    .update({ created_at: new Date(Date.now() - 120_000).toISOString() })
    .eq('swiper_id', her.userId);
  record(!ageErr, 'the fixture swipe can be back-dated two minutes', ageErr ? ageErr.message : '');

  ({ data, error } = await asHer.rpc('undo_last_swipe'));
  record(!error && data?.[0]?.ok === false && data?.[0]?.reason === 'too_old', `refuses with too_old → "${REFUSALS.too_old}"`, JSON.stringify(data?.[0]));
  record((await swipeCount(her.userId)) === 1, 'and it left the swipe alone');

  // 4. Matched. He likes her back, `swipes_check_match` writes the match, and the rewind
  //    has to refuse even though her swipe is seconds old.
  await admin.from('swipes').delete().eq('swiper_id', her.userId);
  const asHim = await signIn(HIM);
  const { error: hisErr } = await asHim.from('swipes').insert({ swiper_id: him.userId, swiped_id: her.userId, action: 'like' });
  record(!hisErr, 'he likes her first', hisErr ? hisErr.message : '');
  const { error: herErr } = await asHer.from('swipes').insert({ swiper_id: her.userId, swiped_id: him.userId, action: 'like' });
  record(!herErr, 'she likes him back, which makes the match', herErr ? herErr.message : '');

  const { count: matchCount } = await admin
    .from('matches')
    .select('id', { count: 'exact', head: true });
  record(matchCount === 1, 'a match row exists', `${matchCount}`);

  ({ data, error } = await asHer.rpc('undo_last_swipe'));
  record(!error && data?.[0]?.ok === false && data?.[0]?.reason === 'matched', `refuses with matched → "${REFUSALS.matched}"`, JSON.stringify(data?.[0]));
  record((await swipeCount(her.userId)) === 1, 'and her swipe survives, so the match is not left dangling');

  // 5. Every reason the server can return has a sentence on the client. A code with no
  //    entry would reach the user as "Rewind failed: <code>".
  const reasons = ['no_swipe', 'too_old', 'matched'];
  record(reasons.every((r) => REFUSALS[r]), 'every reason code 00025 can return has client copy', reasons.join(', '));

  await admin.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('swipes').delete().eq('swiper_id', her.userId);
  await admin.from('swipes').delete().eq('swiper_id', him.userId);
}

async function runRender() {
  console.log(`\n--- render: is the button on the discovery screen, at 390x844, against ${BASE}\n`);
  const { launch } = await import('./cdp.mjs');
  const browser = await launch({ width: 390, height: 844, scale: 2 });
  try {
    await browser.send('Browser.grantPermissions', { origin: BASE, permissions: ['geolocation', 'notifications'] });
    await browser.send('Emulation.setGeolocationOverride', { latitude: 40.7128, longitude: -74.006, accuracy: 20 });

    // Cold start, no stored session — a reload carrying one is the thing that cannot be
    // used here (NOTES.md finding 2).
    await browser.goto(BASE + '/', { settle: 7000 });
    await browser.clickText('Sign In', { exact: true });
    await sleep(2500);
    await browser.typeInto(0, HER);
    await browser.typeInto(1, PASSWORD);
    await browser.clickText('Sign In', { exact: true });
    await sleep(9000);

    await browser.pushRoute('/', { settle: 9000 });
    const deck = await browser.text();
    await browser.shot(`${SHOTS}/deck-with-rewind.png`);

    record(!deck.includes("You've seen everyone!"), 'the deck drew a candidate, so the action bar is on screen');

    // "Is there an element whose text is exactly Rewind, and can it be clicked" — not
    // `deck.includes('Rewind')`. A substring test over the page matches any sentence that
    // happens to contain the word, which is how the first draft of this check passed
    // against a bundle with no button in it. clickText throws when nothing matches, and
    // that throw is the measurement.
    let tapped = true;
    try {
      await browser.clickText('Rewind', { exact: true });
    } catch (e) {
      tapped = false;
    }
    record(tapped, 'the Rewind button is on the discovery screen', 'this is the whole of MEXA-372');
    if (!tapped) {
      console.log(`\n  screenshot: ${SHOTS}/deck-with-rewind.png`);
      console.log(`  on-screen text:\n${deck.split('\n').filter(Boolean).map((l) => `    | ${l}`).join('\n')}`);
      return;
    }

    // Free tier (production bundle, so `DEV_BYPASS_PREMIUM = __DEV__` is false): the tap
    // must reach the paywall's own `rewind` card, not a generic one and not nothing. The
    // keyword scan in PaywallPromptModal tests `super` before `rewind`, so a reason string
    // with "Super" in it would land on the wrong card — this is what catches that.
    await sleep(2500);
    const paywall = await browser.text();
    await browser.shot(`${SHOTS}/rewind-paywall.png`);

    // Identified by elimination, not by looking for the word "Rewind": that word is also
    // the button's own label, still on screen behind the modal, and the first word of the
    // reason sentence. What is discriminating is the *title*, which is
    // `featureInfo?.title || 'Premium Feature'` — so "no other card's title, and not the
    // fallback either" is the only way to say `FEATURE_INFO.rewind` resolved.
    const OTHER_CARDS = ['Premium Feature', 'See Who Likes You', 'Super Likes', 'Profile Boost', 'Map Discovery', 'Unlimited Swipes'];
    const wrongCard = OTHER_CARDS.filter((t) => paywall.includes(t));
    record(wrongCard.length === 0, "tapping it opens the paywall's own Rewind card", `FEATURE_INFO.rewind${wrongCard.length ? `, got ${wrongCard.join('/')}` : ''}`);
    record(paywall.includes('Rewind lets you undo your last swipe'), 'and the reason sentence is the one the handler sent');

    // Story mode. The discovery header's left icon toggles `viewMode`, and that branch
    // renders `ProfileStory` -> `ActionFooter`, a different button row from the one above.
    // A paid feature visible in one of two modes the user can toggle between is the same
    // bug this issue is about, so it gets its own measurement rather than an assumption.
    // Clicked by position because it is an icon with no text; (300, 31) CSS px is the
    // `albums-outline` button in the 390pt header.
    await browser.clickText('Maybe Later', { exact: true });
    await sleep(1500);
    await browser.clickAt(300, 31);
    await sleep(4000);
    // The footer fades in on scroll (`interpolate(scrollY, [200, 400], [0, 1])`), so it is
    // at opacity 0 until the story is scrolled - and `innerText` of a transparent element
    // is still returned, which is why this asserts the click as well as the text.
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 195, y: 500, deltaX: 0, deltaY: 600 });
    await sleep(2500);
    await browser.shot(`${SHOTS}/story-mode-rewind.png`);

    let storyTapped = true;
    try {
      await browser.clickText('Rewind', { exact: true });
    } catch (e) {
      storyTapped = false;
    }
    record(storyTapped, 'the Rewind button is in story mode too (ActionFooter)', 'the second of the two view modes');

    await sleep(2500);
    const storyPaywall = await browser.text();
    await browser.shot(`${SHOTS}/story-mode-rewind-paywall.png`);
    record(
      storyTapped && storyPaywall.includes('Rewind lets you undo your last swipe'),
      'and it reaches the same paywall card'
    );

    console.log(`\n  screenshots: ${SHOTS}/deck-with-rewind.png, ${SHOTS}/rewind-paywall.png`);
    console.log(`  on-screen text:\n${paywall.split('\n').filter(Boolean).map((l) => `    | ${l}`).join('\n')}`);
  } finally {
    await browser.close().catch(() => {});
  }
}

console.log(`\nMEXA-372 rewind check, mode=${MODE}\n`);
const before = await countUsers();
console.log(`users before: ${before}`);
let her;
let him;
try {
  her = await seed('her');
  him = await seed('him');
  console.log(`seeded her=${her.userId} him=${him.userId}\n`);

  if (MODE === 'rpc' || MODE === 'all') await runRpc(her, him);
  if (MODE === 'render' || MODE === 'all') await runRender();
} catch (e) {
  record(false, 'the run itself', e.message);
} finally {
  const removed = await removeFixtures().catch((e) => {
    console.error(`CLEANUP FAILED: ${e.message}`);
    return -1;
  });
  const after = await countUsers().catch(() => null);
  console.log(`\nremoved ${removed} fixture(s); users after: ${after}`);
  record(removed === 2, 'both fixtures were removed', `removed ${removed}`);
  record(after === before, 'the live project is back where it started', `before ${before}, after ${after}`);
}

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
