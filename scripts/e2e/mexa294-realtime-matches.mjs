#!/usr/bin/env node
/**
 * MEXA-294 / MEXA-324 - prove that mutual matching works end to end against the live
 * project, through the real API, after 00017 is applied.
 *
 * The SQL post-check (.scratch/mazal-mexa294/postcheck_00017.mjs) proves the trigger
 * creates the row and that RLS still holds. It cannot prove the two things a user
 * actually experiences, because neither is observable from SQL:
 *
 *   1. The "It's a Match!" screen. `useMatchesSubscription` subscribes to
 *      postgres_changes INSERT on `public.matches`, and `subscribe()` reports SUBSCRIBED
 *      whether or not any event will ever follow. Before 00017 the table was not on
 *      `supabase_realtime` and no event was ever sent. The only way to know is to open a
 *      session, swipe, and wait.
 *   2. Who that event reaches. The app's subscription is **unfiltered** - it takes every
 *      INSERT on `matches` and discards the ones it is not in, client-side. So delivery
 *      has to be gated by RLS at the realtime layer, or publishing the table hands every
 *      signed-in user the id pair of every match made on the app. Case 4 is that check.
 *
 * Run it before 00017 and case 1 fails with "no INSERT event"; run it after and every
 * case passes.
 *
 * One caveat, learned on the 00018 apply: realtime takes about a minute to pick up an
 * `ALTER PUBLICATION`. A run started immediately after the apply loses its first events.
 * Wait two minutes before believing a failure here.
 *
 *   set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
 *   node scripts/e2e/mexa294-realtime-matches.mjs
 *
 * Fixtures follow scripts/README.md: fixed `e2e-*@example.com` addresses reclaimed at
 * setup, torn down in `finally`, and a teardown failure exits non-zero even when every
 * assertion passed. Deleting the auth user cascades to public.users and from there to
 * swipes, matches and notification_queue.
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.\n' +
      'set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a'
  );
  process.exit(2);
}

const EVENT_TIMEOUT_MS = 15000;
const PASSWORD = `Mexa294-${randomBytes(9).toString('base64url')}`;

const FIXTURES = {
  a: { email: 'e2e-match-a@example.com', first_name: 'Adina', gender: 'female' },
  b: { email: 'e2e-match-b@example.com', first_name: 'Baruch', gender: 'male' },
  c: { email: 'e2e-match-c@example.com', first_name: 'Chaya', gender: 'female' },
  d: { email: 'e2e-match-d@example.com', first_name: 'Dov', gender: 'male' },
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
let assertionFailures = 0;
function check(n, name, pass, detail = '') {
  results.push({ n, name, pass, detail });
  if (!pass) assertionFailures += 1;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${String(n).padStart(2)}. ${name}${detail ? `  ${detail}` : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForEvent(pick, ms = EVENT_TIMEOUT_MS) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const hit = pick();
    if (hit) return hit;
    await sleep(150);
  }
  return null;
}

async function signIn(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: 'pkce' },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { client, session: data.session, events: [] };
}

/**
 * Shaped exactly like `useMatchesSubscription` in src/api/realtime/: INSERT and UPDATE on
 * `public.matches`, with NO filter - the hook sorts out participation client-side.
 */
function subscribeMatches(actor, channelName) {
  return new Promise((resolve, reject) => {
    const base = { schema: 'public', table: 'matches' };
    let channel = actor.client.channel(channelName);
    for (const event of ['INSERT', 'UPDATE']) {
      channel = channel.on('postgres_changes', { event, ...base }, (payload) => {
        actor.events.push({ channelName, type: payload.eventType, new: payload.new, old: payload.old });
      });
    }
    const timer = setTimeout(() => reject(new Error(`${channelName} never reached SUBSCRIBED`)), 20000);
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve(channel);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        reject(new Error(`${channelName} status=${status} ${err?.message ?? ''}`));
      }
    });
  });
}

async function deleteFixtureAuthUsers() {
  const wanted = new Set(Object.values(FIXTURES).map((f) => f.email));
  let removed = 0;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      if (u.email && wanted.has(u.email.toLowerCase())) {
        const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
        if (delErr) throw new Error(`deleteUser(${u.email}) failed: ${delErr.message}`);
        removed += 1;
      }
    }
    if (data.users.length < 200) break;
  }
  return removed;
}

async function createFixtures() {
  const reclaimed = await deleteFixtureAuthUsers();
  if (reclaimed) console.log(`  reclaimed ${reclaimed} stale fixture account(s)`);

  const people = {};
  for (const [key, f] of Object.entries(FIXTURES)) {
    const { data, error } = await admin.auth.admin.createUser({
      email: f.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser(${f.email}) failed: ${error.message}`);

    const { data: row, error: rowErr } = await admin
      .from('users')
      .insert({
        auth_id: data.user.id,
        email: f.email,
        first_name: f.first_name,
        display_name: f.first_name,
        date_of_birth: '1995-06-15',
        gender: f.gender,
        jewish_background: 'modern_orthodox',
        looking_for: 'serious',
      })
      .select('id')
      .single();
    if (rowErr) throw new Error(`profile insert for ${f.email} failed: ${rowErr.message}`);
    people[key] = { ...f, authId: data.user.id, userId: row.id };
  }
  return people;
}

/** performSwipe's insert, as src/api/mutations/useSwipe.ts issues it. */
async function swipe(actor, me, them, action) {
  const { error } = await actor.client
    .from('swipes')
    .insert({ swiper_id: me.userId, swiped_id: them.userId, action });
  if (error) throw new Error(`${me.first_name} -> ${them.first_name} (${action}) failed: ${error.message}`);
}

/** performSwipe's match read, as the client issues it after a like. */
async function readMatch(actor, me, them) {
  const [u1, u2] = [me.userId, them.userId].sort();
  const { data, error } = await actor.client
    .from('matches')
    .select('id, user1_id, user2_id')
    .eq('user1_id', u1)
    .eq('user2_id', u2)
    .maybeSingle();
  if (error) throw new Error(`match read failed: ${error.message}`);
  return data;
}

async function main() {
  console.log('MEXA-294 - live realtime + trigger check on public.matches\n');

  console.log('setup: fixtures');
  const people = await createFixtures();
  console.log(`  A=${people.a.userId}  B=${people.b.userId}  C=${people.c.userId}  D=${people.d.userId}\n`);

  const actors = {};
  const channels = [];
  try {
    actors.a = await signIn(people.a.email);
    actors.b = await signIn(people.b.email);
    actors.c = await signIn(people.c.email);
    actors.d = await signIn(people.d.email);

    // All three subscribe BEFORE anything is swiped, so a missing event is a real miss
    // and not a race. C is the outsider: never part of any match made here.
    channels.push(await subscribeMatches(actors.a, 'user-matches:a'));
    channels.push(await subscribeMatches(actors.b, 'user-matches:b'));
    channels.push(await subscribeMatches(actors.c, 'user-matches:c'));
    console.log('  A, B and C subscribed to postgres_changes on public.matches\n');

    console.log('cases');

    // ---- case 1: the first like alone matches nothing --------------------------------
    await swipe(actors.a, people.a, people.b, 'like');
    await sleep(1500);
    const earlyMatch = await readMatch(actors.a, people.a, people.b);
    check(1, 'one-sided like creates no match', earlyMatch === null,
      earlyMatch ? `match ${earlyMatch.id} appeared` : '');
    check(2, 'and no realtime event was sent for it',
      actors.a.events.length === 0, `A saw ${actors.a.events.length} event(s)`);

    // ---- case 3 & 4: the reciprocal like ---------------------------------------------
    // B likes back. The trigger, now SECURITY DEFINER, can see A's like and inserts the
    // match. This is the moment that has never worked.
    await swipe(actors.b, people.b, people.a, 'like');

    const aInsert = await waitForEvent(() =>
      actors.a.events.find((e) => e.type === 'INSERT')
    );
    check(3, 'A (who swiped first, app in the background) gets the INSERT — the "It\'s a Match!" screen',
      !!aInsert, aInsert ? `match ${aInsert.new?.id}` : 'no INSERT event within 15s');

    const bInsert = await waitForEvent(() =>
      actors.b.events.find((e) => e.type === 'INSERT')
    );
    check(4, 'B (who swiped second) gets the same INSERT',
      !!bInsert && bInsert.new?.id === aInsert?.new?.id,
      bInsert ? `match ${bInsert.new?.id}` : 'no INSERT event within 15s');

    const [u1, u2] = [people.a.userId, people.b.userId].sort();
    check(5, 'the payload is the right pair, ordered user1_id < user2_id',
      aInsert?.new?.user1_id === u1 && aInsert?.new?.user2_id === u2,
      `user1=${aInsert?.new?.user1_id} user2=${aInsert?.new?.user2_id}`);

    // ---- case 6: RLS gates delivery, because the app's subscription is unfiltered -----
    // C has been listening on an unfiltered INSERT since before the swipe. If realtime
    // did not apply the matches SELECT policy, C would now hold A and B's user ids.
    const cEvents = actors.c.events;
    check(6, 'C, who is in no match, received nothing — realtime applies the SELECT policy',
      cEvents.length === 0,
      `${cEvents.length} event(s)${cEvents.length ? `: ${JSON.stringify(cEvents).slice(0, 300)}` : ''}`);

    // ---- case 7 & 8: both sides can read it through the API --------------------------
    const aRead = await readMatch(actors.a, people.a, people.b);
    const bRead = await readMatch(actors.b, people.b, people.a);
    check(7, 'A reads the match row with performSwipe\'s query (isMatch true)',
      aRead?.id === aInsert?.new?.id, aRead ? `id=${aRead.id}` : 'null');
    check(8, 'B reads the same row, least/greatest ordering working from either side',
      bRead?.id === aRead?.id, bRead ? `id=${bRead.id}` : 'null');

    const cRead = await actors.c.client
      .from('matches')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2);
    check(9, 'C cannot read the match row through the API either',
      !cRead.error && (cRead.data?.length ?? 0) === 0,
      cRead.error ? cRead.error.message : `rows=${cRead.data?.length}`);

    // ---- case 10: the push both people get -------------------------------------------
    // notify_new_match has been sitting on `matches` unable to fire, because no row was
    // ever created for it to fire on. Read as service_role; notification_queue is not
    // client-readable.
    const { data: queued, error: qErr } = await admin
      .from('notification_queue')
      .select('user_id, data')
      .in('user_id', [people.a.userId, people.b.userId]);
    if (qErr) throw new Error(`notification_queue read failed: ${qErr.message}`);
    const types = (queued ?? []).map((q) => q.data?.type);
    check(10, '"Mazal Tov! New Match!" is queued for BOTH people',
      queued?.length === 2
        && types.every((t) => t === 'new_match')
        && new Set(queued.map((q) => q.user_id)).size === 2,
      `${queued?.length ?? 0} row(s), types=[${types.join(',')}]`);
    check(11, '...pointing at the match that was just created',
      (queued ?? []).every((q) => q.data?.matchId === aRead?.id),
      `matchIds=[${(queued ?? []).map((q) => q.data?.matchId).join(',')}]`);

    // ---- case 12: a pass still matches nothing ---------------------------------------
    await swipe(actors.c, people.c, people.d, 'like');
    await swipe(actors.d, people.d, people.c, 'pass');
    await sleep(2000);
    const cdMatch = await readMatch(actors.c, people.c, people.d);
    check(12, 'a pass against a like creates no match', cdMatch === null,
      cdMatch ? `match ${cdMatch.id} appeared` : '');

    // ---- case 13: swipes are still closed cross-side ---------------------------------
    // The half of MEXA-294 that must NOT have been "fixed" by opening the table up.
    const { data: incoming, error: inErr } = await actors.a.client
      .from('swipes')
      .select('id')
      .eq('swiper_id', people.b.userId)
      .eq('swiped_id', people.a.userId);
    check(13, 'A still cannot read B\'s like on the swipes table (no "who passed on you")',
      !inErr && (incoming?.length ?? 0) === 0,
      inErr ? inErr.message : `rows=${incoming?.length}`);

    // ---- case 14: the client still cannot forge a match ------------------------------
    const forged = await actors.c.client
      .from('matches')
      .insert({ user1_id: [people.c.userId, people.a.userId].sort()[0],
                user2_id: [people.c.userId, people.a.userId].sort()[1] });
    check(14, 'a client INSERT into matches is still refused (no INSERT policy)',
      !!forged.error, forged.error ? `${forged.error.code}: ${forged.error.message}` : 'INSERT SUCCEEDED');
  } finally {
    for (const ch of channels) {
      try { await ch.unsubscribe(); } catch { /* teardown is best-effort for sockets */ }
    }
    for (const actor of Object.values(actors)) {
      try { actor.client.realtime.disconnect(); } catch { /* ditto */ }
      try { await actor.client.auth.signOut(); } catch { /* ditto */ }
    }
  }
}

let exitCode = 0;
try {
  await main();
} catch (err) {
  console.error(`\nERROR: ${err.message}`);
  exitCode = 1;
} finally {
  console.log('\nteardown: deleting fixture accounts');
  try {
    const removed = await deleteFixtureAuthUsers();
    console.log(`  deleted ${removed} auth user(s); public.users cascades from there`);
    let leftover = 0;
    for (const table of ['matches', 'swipes', 'notification_queue', 'users']) {
      const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true });
      if (error) throw new Error(`post-teardown count on ${table} failed: ${error.message}`);
      console.log(`  public.${table} now holds ${count} row(s)`);
      leftover += count ?? 0;
    }
    console.log(`  fixtures left behind: ${leftover}`);
    if (leftover !== 0) {
      console.error('  teardown INCOMPLETE: rows survive');
      exitCode = 1;
    }
  } catch (err) {
    console.error(`  TEARDOWN FAILED: ${err.message}`);
    exitCode = 1;
  }
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} assertions passed`);
if (assertionFailures) {
  console.log(`${assertionFailures} FAILED - if case 3 is among them, either public.matches is not`);
  console.log('on the supabase_realtime publication, or check_for_match is not SECURITY DEFINER');
  console.log('and no match row was created at all (MEXA-294 / MEXA-296).');
  exitCode = 1;
}
process.exit(exitCode);
