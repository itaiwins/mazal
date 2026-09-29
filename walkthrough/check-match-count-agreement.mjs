#!/usr/bin/env node
/**
 * check-match-count-agreement.mjs — the three surfaces that show a match count must agree.
 *
 * MEXA-338, walkthrough finding 10: right after a first match, the Matches screen said
 * "1" (correct), the Profile tab said "0 Matches" and the tab-bar badge said "0". Three
 * surfaces, three answers. The badge was fixed on MEXA-336 by deriving it from the same
 * `useMatches()` query the screen renders from; the Profile tab's stat was a literal
 * `matches_count: 0` in `app/(tabs)/profile.tsx` and is fixed here the same way.
 *
 * This reads the rendered numbers off all three, so a regression on any one of them fails.
 *
 * Two live fixtures on `tayiyczmacvhokdxfqvm`, plus a match between them and one unread
 * message. Both users are created through the admin API with `email_confirm: true`, so **no
 * email is sent** and the shared 100/day Resend bucket is untouched (TEAM_BOARD, MEXA-304).
 * Everything is removed in a `finally`, and the run prints the user count before and after.
 *
 *   cd REPOS/mazal-MEXA-338
 *   set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
 *   MAZAL_WEB_SHIMS=1 npx expo export --platform web --output-dir /tmp/web --clear
 *   node walkthrough/patch-export.mjs /tmp/web
 *   node walkthrough/serve.mjs /tmp/web 8787 &
 *   node walkthrough/check-match-count-agreement.mjs
 *
 * Unaffected by the unapplied 00030 that empties the deck (MEXA-385): `fetchMatches` reads
 * `user_public_profiles` for a name, a photo and a tick, and deliberately asks for no `age`.
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

const HER = 'violet-mexa338-count-her@example.com';
const HIM = 'violet-mexa338-count-him@example.com';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BASE_PROFILE = {
  date_of_birth: '1996-04-11',
  current_city: 'Brooklyn',
  current_state: 'NY',
  current_country: 'USA',
  jewish_background: 'modern_orthodox',
  observance_level: 'somewhat_observant',
  looking_for: 'marriage_minded',
  wants_children: 'yes',
  is_active: true,
  onboarding_complete: true,
};

async function countUsers() {
  const { count, error } = await admin.from('users').select('id', { count: 'exact', head: true });
  if (error) throw new Error(`count failed: ${error.message}`);
  return count;
}

async function seed(email, extra) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  const { data: row, error: rowErr } = await admin
    .from('users')
    .insert({ auth_id: data.user.id, email, ...BASE_PROFILE, ...extra })
    .select('id')
    .single();
  if (rowErr) throw new Error(`profile insert for ${email} failed: ${rowErr.message}`);
  return { authId: data.user.id, userId: row.id };
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
 * The number under the "Matches" label in the Profile tab's stat row.
 *
 * By label, not position: the row has a Safta card in front of it when that flag is on.
 * The value and the label are siblings inside the card, so this walks up from the label.
 */
const PROFILE_STAT = `(() => {
  const label = [...document.querySelectorAll('div')].find(
    (el) => el.children.length === 0 && el.textContent.trim() === 'Matches'
  );
  if (!label) return null;
  const card = label.parentElement;
  if (!card) return null;
  const texts = [...card.querySelectorAll('div')]
    .filter((el) => el.children.length === 0)
    .map((el) => el.textContent.trim())
    .filter((t) => /^[0-9]+$/.test(t));
  return texts.length ? Number(texts[0]) : null;
})()`;

/** The red badge on the Matches dot in the tab bar, or 0 when there is none. */
const TAB_BADGE = `(() => {
  const hint = [...document.querySelectorAll('div')].find(
    (el) => el.children.length === 0 && el.textContent.trim() === 'Drag dots to navigate'
  );
  if (!hint) return null;
  let nav = hint;
  for (let i = 0; i < 8 && nav; i += 1) {
    const cs = getComputedStyle(nav);
    if (cs.position === 'absolute' && cs.bottom === '0px') break;
    nav = nav.parentElement;
  }
  if (!nav) return null;
  // The badge is a small absolutely-positioned pill with a number in it.
  const pills = [...nav.querySelectorAll('div')].filter((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.position === 'absolute' && r.height > 10 && r.height < 24 && /^[0-9+]+$/.test(el.textContent.trim());
  });
  return pills.length ? Number(pills[0].textContent.trim().replace('+', '')) : 0;
})()`;

let browser = null;

async function run() {
  console.log(`\nMatch count agreement, 390x844 against ${BASE}\n`);

  const before = await countUsers();
  console.log(`users before: ${before}`);
  const her = await seed(HER, {
    first_name: 'Counther',
    last_name: 'Fixture',
    display_name: 'Counther',
    gender: 'female',
    gender_preference: ['male'],
    bio: 'MEXA-338 match count fixture.',
  });
  const him = await seed(HIM, {
    first_name: 'Counthim',
    last_name: 'Fixture',
    display_name: 'Counthim',
    gender: 'male',
    gender_preference: ['female'],
    bio: 'MEXA-338 match count fixture.',
  });

  // One match, and one message from him that she has not read — so all three surfaces
  // should read 1: the list has one row, the stat counts one match, and the badge counts
  // one match with something unread.
  // `matches` carries a CHECK that orders the pair, so the smaller uuid has to be user1 —
  // inserting them the other way round is rejected with `matches_check`.
  const [user1_id, user2_id] = [her.userId, him.userId].sort();
  const { data: match, error: matchErr } = await admin
    .from('matches')
    .insert({ user1_id, user2_id, is_active: true })
    .select('id')
    .single();
  if (matchErr) throw new Error(`match insert failed: ${matchErr.message}`);
  const { error: msgErr } = await admin.from('messages').insert({
    match_id: match.id,
    sender_id: him.userId,
    content: 'Shabbat shalom — what is your cholent position?',
    is_read: false,
  });
  if (msgErr) throw new Error(`message insert failed: ${msgErr.message}`);
  console.log(`seeded her=${her.userId} him=${him.userId} match=${match.id} + 1 unread`);

  browser = await launch({ width: 390, height: 844, scale: 2 });
  await browser.send('Browser.grantPermissions', {
    origin: BASE,
    permissions: ['geolocation', 'notifications'],
  });

  await browser.goto(BASE + '/', { settle: 7000 });
  await browser.clickText('Sign In', { exact: true });
  await sleep(2500);
  await browser.typeInto(0, HER);
  await browser.typeInto(1, PASSWORD);
  await browser.clickText('Sign In', { exact: true });
  await sleep(9000);

  const go = (route, settle = 6000) => browser.pushRoute(route, { settle });

  // The Matches screen first, because it is the surface that was already right.
  await go('/matches', 8000);
  const listText = await browser.evaluate(`(document.getElementById('root')?.innerText || '')`);
  record(
    listText.includes('Counthim'),
    'the Matches screen lists the match',
    listText.includes('Counthim') ? '' : 'his name never appeared'
  );
  const badgeOnMatches = await browser.evaluate(TAB_BADGE);
  record(badgeOnMatches === 1, 'the tab-bar badge reads 1', `read ${badgeOnMatches}`);

  await go('/profile', 8000);
  const stat = await browser.evaluate(PROFILE_STAT);
  record(stat === 1, 'the Profile tab stat reads 1 Matches', `read ${stat}`);
  const badgeOnProfile = await browser.evaluate(TAB_BADGE);
  record(badgeOnProfile === 1, 'the badge still reads 1 from the Profile tab', `read ${badgeOnProfile}`);

  record(
    stat === 1 && badgeOnProfile === 1 && listText.includes('Counthim'),
    'all three surfaces agree',
    `list=1 stat=${stat} badge=${badgeOnProfile}`
  );
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
