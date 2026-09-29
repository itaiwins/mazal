#!/usr/bin/env node
/**
 * MEXA-313 - prove that a `postgres_changes` subscription on `public.messages` actually
 * delivers events, by subscribing for real against the live project with real sessions.
 *
 * Why this script has to exist. A publication change is not observable from SQL alone:
 * `pg_publication_tables` tells you the table is published, and that is exactly what was
 * true-looking-but-useless before, because `subscribe()` reports `SUBSCRIBED` whether or
 * not any event will ever follow. The only way to know the chat live-updates is to open
 * two sessions, send a message from one and wait for it on the other.
 *
 * Run it before applying 00018 and it fails at case 1 with "no INSERT event" - that is
 * the bug. Run it after and every case passes.
 *
 * One caveat, learned the hard way on the apply: realtime takes a minute or so to pick up
 * an `ALTER PUBLICATION`. The run immediately after the apply still missed the first three
 * events and then began delivering mid-run. Give it a couple of minutes before you believe
 * a failure.
 *
 *   set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
 *   node scripts/e2e/mexa313-realtime-messages.mjs
 *
 * Three fixture accounts, per scripts/README.md: fixed `e2e-*@example.com` addresses that
 * are reclaimed at setup, torn down in `finally`, and a teardown failure exits non-zero
 * even when every assertion passed. Deleting the auth user cascades to public.users and
 * from there to matches, messages and notification_queue; `record_deleted_account`
 * returns early for an account with no reports, so nothing is left in `deleted_accounts`.
 *
 * The subscriptions here are shaped exactly like the app's (src/api/realtime/
 * useMessagesSubscription.ts): A mirrors `useMessagesSubscription` (INSERT + UPDATE
 * filtered by match_id), B mirrors `useAllMessagesSubscription` (INSERT, unfiltered).
 * Nothing calls `realtime.setAuth` by hand - supabase-js wires the socket's JWT to the
 * session itself on SIGNED_IN, which is the path the app relies on, so testing it that
 * way keeps this honest.
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
const PASSWORD = `Mexa313-${randomBytes(9).toString('base64url')}`;

// Fixed addresses, so a crashed run's rows are reclaimed by the next one rather than
// leaking a fresh set (scripts/README.md rule 1).
const FIXTURES = {
  a: { email: 'e2e-realtime-a@example.com', first_name: 'Ayelet', gender: 'female' },
  b: { email: 'e2e-realtime-b@example.com', first_name: 'Boaz', gender: 'male' },
  c: { email: 'e2e-realtime-c@example.com', first_name: 'Chana', gender: 'female' },
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

/** Wait until `pick` returns something truthy, or time out. */
async function waitForEvent(pick, ms = EVENT_TIMEOUT_MS) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const hit = pick();
    if (hit) return hit;
    await sleep(150);
  }
  return null;
}

/** A signed-in client plus the events its channels have seen. */
async function signIn(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: 'pkce' },
    // Mirrors src/api/supabase/client.ts.
    realtime: { params: { eventsPerSecond: 10 } },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { client, session: data.session, events: [] };
}

/** Subscribe and wait for the channel to actually be SUBSCRIBED before returning. */
function subscribeMessages(actor, channelName, { filter, events }) {
  return new Promise((resolve, reject) => {
    const base = { schema: 'public', table: 'messages', ...(filter ? { filter } : {}) };
    let channel = actor.client.channel(channelName);
    for (const event of events) {
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
  // Delete by email, not only by a captured id: a fixture left over from a crashed run
  // has an id this process never saw (scripts/README.md rule 2).
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

  // matches has CHECK (user1_id < user2_id) and UNIQUE (user1_id, user2_id).
  const [u1, u2] = [people.a.userId, people.b.userId].sort();
  const { data: match, error: matchErr } = await admin
    .from('matches')
    .insert({ user1_id: u1, user2_id: u2, is_active: true })
    .select('id')
    .single();
  if (matchErr) throw new Error(`match insert failed: ${matchErr.message}`);

  return { people, matchId: match.id };
}

async function main() {
  console.log('MEXA-313 - live realtime check on public.messages\n');

  console.log('setup: fixtures');
  const { people, matchId } = await createFixtures();
  console.log(`  A=${people.a.userId}  B=${people.b.userId}  C=${people.c.userId}`);
  console.log(`  match(A,B)=${matchId}\n`);

  const actors = {};
  const channels = [];
  try {
    actors.a = await signIn(people.a.email);
    actors.b = await signIn(people.b.email);
    actors.c = await signIn(people.c.email);

    // A: the chat screen's subscription. B: the unread-badge subscription.
    // C: the same subscription A has, on a match C is not part of - the RLS control.
    channels.push(
      await subscribeMessages(actors.a, `messages:${matchId}`, {
        filter: `match_id=eq.${matchId}`,
        events: ['INSERT', 'UPDATE'],
      })
    );
    channels.push(
      await subscribeMessages(actors.b, 'all-messages', { events: ['INSERT'] })
    );
    channels.push(
      await subscribeMessages(actors.c, `messages-outsider:${matchId}`, {
        filter: `match_id=eq.${matchId}`,
        events: ['INSERT', 'UPDATE'],
      })
    );
    // C again, unfiltered, DELETE only. `realtime.apply_rls` short-circuits the RLS check
    // for DELETE (`if not is_rls_enabled or action = 'DELETE' then` -> every subscriber is
    // visible), so this measures what publishing the table hands a listener who is in no
    // match at all. Case 11.
    channels.push(
      await subscribeMessages(actors.c, 'messages-delete-probe', { events: ['DELETE'] })
    );
    console.log('  four channels SUBSCRIBED\n');

    // ---- case 1 & 2: B sends, A's chat and B's badge both hear it -------------------
    const shortBody = `shalom ${randomBytes(4).toString('hex')}`;
    const { data: shortMsg, error: sendErr } = await actors.b.client
      .from('messages')
      .insert({ match_id: matchId, sender_id: people.b.userId, content: shortBody, message_type: 'text' })
      .select('id, content')
      .single();
    if (sendErr) throw new Error(`B could not send: ${sendErr.message}`);

    const aInsert = await waitForEvent(() =>
      actors.a.events.find((e) => e.type === 'INSERT' && e.new?.id === shortMsg.id)
    );
    check(1, "A's chat subscription receives B's INSERT", !!aInsert,
      aInsert ? `content=${JSON.stringify(aInsert.new.content)}` : 'no INSERT event within 15s');
    check(2, 'the INSERT payload carries the message body', aInsert?.new?.content === shortBody,
      aInsert ? '' : '(no event)');

    const bInsert = await waitForEvent(() =>
      actors.b.events.find((e) => e.type === 'INSERT' && e.new?.id === shortMsg.id)
    );
    check(3, "B's unfiltered badge subscription receives it too", !!bInsert,
      bInsert ? '' : 'no INSERT event within 15s');

    // ---- case 4: the read receipt, which is an UPDATE ------------------------------
    const { error: readErr } = await actors.a.client
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', shortMsg.id);
    if (readErr) throw new Error(`A could not mark read: ${readErr.message}`);

    const aUpdate = await waitForEvent(() =>
      actors.a.events.find((e) => e.type === 'UPDATE' && e.new?.id === shortMsg.id)
    );
    check(4, "A receives the read-receipt UPDATE (filter on match_id works on the default replica identity)",
      aUpdate?.new?.is_read === true, aUpdate ? '' : 'no UPDATE event within 15s');
    check(5, 'a short (non-TOASTed) body is still present on that UPDATE',
      aUpdate?.new?.content === shortBody,
      aUpdate ? `content=${JSON.stringify(aUpdate?.new?.content)}` : '(no event)');

    // ---- case 6: the unchanged-TOAST hole the client merge exists for ---------------
    // 48 KB of base64 is well past anything pglz can squeeze under the 2 KB toast target,
    // so `content` is stored out of line. An UPDATE that does not touch it omits it from
    // the WAL, and on the default replica identity realtime has no old tuple to recover
    // it from - so it is absent from payload.new.
    const longBody = randomBytes(36 * 1024).toString('base64');
    const { data: longMsg, error: longErr } = await actors.b.client
      .from('messages')
      .insert({ match_id: matchId, sender_id: people.b.userId, content: longBody, message_type: 'text' })
      .select('id')
      .single();
    if (longErr) throw new Error(`B could not send the long message: ${longErr.message}`);

    const aLongInsert = await waitForEvent(() =>
      actors.a.events.find((e) => e.type === 'INSERT' && e.new?.id === longMsg.id)
    );
    check(6, 'a TOAST-sized body arrives complete on INSERT',
      aLongInsert?.new?.content === longBody,
      aLongInsert ? `${aLongInsert.new?.content?.length ?? 0} of ${longBody.length} chars` : 'no INSERT event');

    await actors.a.client
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', longMsg.id);

    const aLongUpdate = await waitForEvent(() =>
      actors.a.events.find((e) => e.type === 'UPDATE' && e.new?.id === longMsg.id)
    );
    const contentOmitted = !!aLongUpdate && !('content' in (aLongUpdate.new ?? {}));
    check(7, 'the read-receipt UPDATE still reaches A for a TOAST-sized message',
      aLongUpdate?.new?.is_read === true, aLongUpdate ? '' : 'no UPDATE event within 15s');
    check(8, "that UPDATE omits the unchanged TOASTed `content` (why the client merges rather than replaces)",
      contentOmitted,
      aLongUpdate ? `keys=${Object.keys(aLongUpdate.new ?? {}).sort().join(',')}` : '(no event)');

    // The merge the client now does, replayed here: it must survive the partial payload.
    const cached = { id: longMsg.id, match_id: matchId, content: longBody, is_read: false };
    const merged = { ...cached, ...(aLongUpdate?.new ?? {}) };
    check(9, 'merging that partial payload keeps the body and applies the read flag',
      merged.content === longBody && merged.is_read === true,
      `content ${merged.content === longBody ? 'kept' : 'LOST'}, is_read=${merged.is_read}`);

    // ---- case 10: RLS still gates delivery ----------------------------------------
    // C subscribed to this exact match before anything was sent. Publishing the table
    // must not hand C someone else's chat.
    const cChat = actors.c.events.filter((e) => e.channelName.startsWith('messages-outsider:'));
    check(10, 'C, who is not in the match, received no message content at all',
      cChat.length === 0,
      `${cChat.length} event(s)${cChat.length ? `: ${JSON.stringify(cChat).slice(0, 300)}` : ''}`);

    // ---- case 11: what a DELETE hands an outsider ----------------------------------
    // `messages` has no DELETE policy, so no client can delete one; deletes arrive by
    // cascade from a deleted account or unmatched pair - which is a real, routine event.
    // Deleted here as service_role to stand in for that cascade.
    const { error: delErr } = await admin.from('messages').delete().eq('id', shortMsg.id);
    if (delErr) throw new Error(`admin delete failed: ${delErr.message}`);

    const cDelete = await waitForEvent(() =>
      actors.c.events.find((e) => e.channelName === 'messages-delete-probe' && e.type === 'DELETE')
    );
    const leakedKeys = cDelete ? Object.keys(cDelete.old ?? {}).sort() : [];
    const contentLeaked = leakedKeys.some((k) => k !== 'id');
    check(11, 'a DELETE reaching an outsider carries no column beyond the primary key',
      !contentLeaked,
      cDelete
        ? `C DID receive the DELETE; old_record keys=${leakedKeys.join(',') || '(none)'}`
        : 'C received no DELETE event');
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
    const { count, error } = await admin
      .from('messages')
      .select('id', { count: 'exact', head: true });
    if (error) throw new Error(`post-teardown count failed: ${error.message}`);
    console.log(`  public.messages now holds ${count} row(s)`);
    if (count !== 0) {
      console.error('  teardown INCOMPLETE: messages rows survive');
      exitCode = 1;
    }
  } catch (err) {
    // A teardown failure is non-zero even when every assertion passed: the rows are live
    // either way, and only the loud version tells anyone (scripts/README.md rule 3).
    console.error(`  TEARDOWN FAILED: ${err.message}`);
    exitCode = 1;
  }
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} assertions passed`);
if (assertionFailures) {
  console.log(`${assertionFailures} FAILED - if case 1 is among them, public.messages is not on`);
  console.log('the supabase_realtime publication and the chat does not live-update (MEXA-313).');
  exitCode = 1;
}
process.exit(exitCode);
