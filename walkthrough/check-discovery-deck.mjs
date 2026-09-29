#!/usr/bin/env node
/**
 * check-discovery-deck.mjs — does the discovery deck draw a candidate, or the empty state?
 *
 * MEXA-385. `useDiscoveryProfiles` filters on `user_public_profiles.age`, a column that
 * migration 00030 adds. Before 00030 was applied to `tayiyczmacvhokdxfqvm` the query came
 * back `42703 column user_public_profiles.age does not exist`, the hook threw, and
 * `app/(tabs)/index.tsx` drew "You've seen everyone!" for every user on the platform —
 * with an eligible candidate sitting in the table. This is the measurement that says which
 * of the two screens the app renders, against the live project, signed in for real.
 *
 * It is deliberately NOT a catalog read. `information_schema` saying `age` exists proves
 * the migration landed; it does not prove the deck fills. The whole point of MEXA-385 is
 * that those two came apart.
 *
 * Two live fixtures on `tayiyczmacvhokdxfqvm`, created through the admin API with
 * `email_confirm: true`, so **no confirmation email is sent** and the team's shared
 * 100/day Resend bucket is untouched (TEAM_BOARD, MEXA-304). Both are removed in a
 * `finally`, and the run prints the user count before and after.
 *
 *   cd REPOS/mazal-MEXA-385
 *   set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
 *   MAZAL_WEB_SHIMS=1 npx expo export --platform web --output-dir /tmp/web385 --clear
 *   node walkthrough/patch-export.mjs /tmp/web385
 *   node walkthrough/serve.mjs /tmp/web385 8788 &
 *   node walkthrough/check-discovery-deck.mjs /tmp/mexa385-shots
 *
 * What it cannot answer: this is react-native-web at inset 0, so it says nothing about
 * device chrome or `Platform.OS === 'ios'` branches. It answers exactly one question —
 * whose name is on the card.
 */

import { createClient } from '@supabase/supabase-js';
import { launch } from './cdp.mjs';

const BASE = process.env.WALKTHROUGH_BASE || 'http://127.0.0.1:8788';
const PASSWORD = process.env.WALKTHROUGH_PASSWORD || 'Mazal-Walkthrough-328!';
const SHOTS = process.argv[2] || '/tmp/mexa385-shots';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run:\n' +
      '  set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a'
  );
  process.exit(2);
}

const HER = 'violet-mexa385-deck-her@example.com';
const HIM = 'violet-mexa385-deck-him@example.com';

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

/**
 * His birthdate is pinned relative to today rather than written as a literal, so the age
 * this asserts is a real assertion and not a number that goes stale next birthday. 28 sits
 * inside the deck's default age filter with room on both sides.
 */
const HIS_AGE = 28;
const hisDob = (() => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - HIS_AGE);
  d.setUTCDate(d.getUTCDate() - 1); // a day past the birthday, so "completed years" is unambiguous
  return d.toISOString().slice(0, 10);
})();

const PEOPLE = {
  her: {
    email: HER,
    profile: {
      ...BASE_PROFILE,
      first_name: 'Deckher',
      last_name: 'Fixture',
      display_name: 'Deckher',
      date_of_birth: '1996-04-11',
      gender: 'female',
      gender_preference: ['male'],
      bio: 'MEXA-385 deck fixture: the signed-in caller.',
    },
  },
  him: {
    email: HIM,
    profile: {
      ...BASE_PROFILE,
      first_name: 'Deckhim',
      last_name: 'Fixture',
      display_name: 'Deckhim',
      date_of_birth: hisDob,
      gender: 'male',
      gender_preference: ['female'],
      bio: 'MEXA-385 deck fixture: the one candidate who should be on the card.',
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
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
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
  if (ok) { passes += 1; console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`); return; }
  failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

// The empty state's exact copy, from app/(tabs)/index.tsx. This is the string MEXA-385
// photographed; if it is on screen the deck is still broken, whatever the catalog says.
const EMPTY = "You've seen everyone!";

let browser;

async function run() {
  console.log(`\nMEXA-385 discovery deck, 390x844, against ${BASE}\n`);

  const before = await countUsers();
  console.log(`users before: ${before}`);
  const her = await seed('her');
  const him = await seed('him');
  console.log(`seeded her=${her.userId} him=${him.userId} (his dob ${hisDob}, age ${HIS_AGE})\n`);

  browser = await launch({ width: 390, height: 844, scale: 2 });
  await browser.send('Browser.grantPermissions', { origin: BASE, permissions: ['geolocation', 'notifications'] });
  await browser.send('Emulation.setGeolocationOverride', { latitude: 40.7128, longitude: -74.006, accuracy: 20 });

  // Cold start, no stored session. A reload *carrying* a session is the one thing that
  // cannot be used here — NOTES.md finding 2.
  await browser.goto(BASE + '/', { settle: 7000 });
  await browser.clickText('Sign In', { exact: true });
  await sleep(2500);
  await browser.typeInto(0, HER);
  await browser.typeInto(1, PASSWORD);
  await browser.clickText('Sign In', { exact: true });
  await sleep(9000);

  await browser.pushRoute('/', { settle: 9000 });
  const text = await browser.text();
  await browser.shot(`${SHOTS}/deck.png`);

  // The three questions, in the order they decide the issue.
  record(!text.includes(EMPTY), `the empty state "${EMPTY}" is NOT on screen`);
  record(text.includes('Deckhim'), "the candidate's name is on the card", 'Deckhim');
  record(new RegExp(`\\b${HIS_AGE}\\b`).test(text), `his age renders as ${HIS_AGE}`);

  // And the query itself, as the app makes it: no 42703 in the console.
  const bad = browser.console.filter((m) => /42703|does not exist|user_public_profiles/i.test(JSON.stringify(m)));
  record(bad.length === 0, 'no column-does-not-exist error in the page console', bad.length ? JSON.stringify(bad[0]).slice(0, 200) : '');

  console.log(`\n  screenshot: ${SHOTS}/deck.png`);
  console.log(`  on-screen text:\n${text.split('\n').filter(Boolean).map((l) => `    | ${l}`).join('\n')}`);
}

try {
  await run();
} catch (e) {
  record(false, 'the run itself', e.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  const removed = await removeFixtures().catch((e) => { console.error(`CLEANUP FAILED: ${e.message}`); return -1; });
  const after = await countUsers().catch(() => null);
  console.log(`\nremoved ${removed} fixture(s); users after: ${after}`);
  record(removed === 2, 'both fixtures were removed', `removed ${removed}`);
  record(after === 0, 'the live project is back to 0 users', `after ${after}`);
}

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
