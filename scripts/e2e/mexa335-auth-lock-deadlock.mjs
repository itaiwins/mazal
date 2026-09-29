#!/usr/bin/env node
/**
 * MEXA-335 - prove that the auth-lock deadlock is gone, on the lock React Native uses.
 *
 *   set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
 *   node scripts/e2e/mexa335-auth-lock-deadlock.mjs
 *
 * ## The bug
 *
 * `app/_layout.tsx` registered an `async` `onAuthStateChange` callback that awaited
 * `supabase.from('users').select(...)`. supabase-js runs that callback inside its auth
 * lock and awaits it; the query asks the auth client for an access token, which needs
 * the same lock. `_acquireLock` sees `lockAcquired === true`, takes its re-entrant
 * branch and awaits the outer operation, which is waiting on the callback. Nothing
 * resolves. On MEXA-328 that showed up as "Confirming your email..." forever and a white
 * screen on every second launch.
 *
 * ## Why this script exists rather than a note saying "fixed"
 *
 * The finding was only ever seen in a web render, so the open question was whether iOS
 * is affected. This settles it **without an iOS build**, because the deadlock is not in
 * the lock primitive at all — it is in `_acquireLock`, above it. Node picks the same
 * lock React Native does:
 *
 *   `@supabase/auth-js` 2.90.1, GoTrueClient.js:134-142
 *     settings.lock                                       -> that
 *     persistSession && isBrowser() && navigator.locks     -> navigatorLock   (web)
 *     otherwise                                           -> lockNoOp        (RN, Node)
 *
 * `isBrowser()` is `typeof window !== 'undefined' && typeof document !== 'undefined'`.
 * React Native has no `document`, and neither does Node, so **both get `lockNoOp`** and
 * Hermes never sees `navigator.locks` either. Case 1 below asserts the lock is
 * `lockNoOp`, so if a future supabase-js changes that selection this script says so
 * instead of quietly testing the wrong path.
 *
 * Everything else here is the app's own configuration: the same `auth` options as
 * `src/api/supabase/client.ts`, and the real handler imported from
 * `src/lib/auth/authStateSync.ts` (Node 24 strips the types; that module imports types
 * only, on purpose, so it loads outside Metro).
 *
 * ## What it asserts
 *
 *   1. the client is on `lockNoOp`, i.e. the React Native path
 *   2. the old shape (async callback awaiting a query) deadlocks: `getSession()` never
 *      resolves -- this is the bug, and it has to still fail or the test proves nothing
 *   3. the old shape does not finish its own query either
 *   4. the real handler does not deadlock: `getSession()` resolves with the session
 *   5. the handler wrote the session to the store synchronously, during the callback
 *   6. the deferred profile fetch lands the `public.users` row afterwards
 *   7. ...and the row is the right one
 *   8. `exchangeCodeForSession()` resolves under the real handler (the confirm screen's
 *      call, the one that hung behind the spinner)
 *   9. a `TOKEN_REFRESHED` for an account whose profile is loaded does not refetch it
 *  10. a failed profile query does not clear an already-loaded profile
 *  11. a stale deferred fetch that returns after SIGNED_OUT does not resurrect the user
 *  12. the router gate is raised inside the callback and lowered when the fetch lands
 *  13. ...and lowered when the fetch fails, so the spinner cannot stick
 *  14. switching account A -> B with no sign-out in between never writes A's row
 *  15. ...and A's stale fetch does not lower the router gate out from under B's
 *
 * One fixture account, per scripts/README.md: a fixed `violet-e2e-*@example.com`
 * address reclaimed at setup, torn down in `finally`, and a teardown failure exits
 * non-zero even when every assertion passed.
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { createAuthStateHandler } from '../../src/lib/auth/authStateSync.ts';

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

/** Long enough that a slow request is not mistaken for a deadlock. */
const RESOLVE_TIMEOUT_MS = 20000;
/** How long to let a deferred fetch land before calling it a miss. */
const DEFERRED_TIMEOUT_MS = 20000;

const PASSWORD = `Mexa335-${randomBytes(9).toString('base64url')}`;
const FIXTURE = {
  email: 'violet-e2e-authlock@example.com',
  first_name: 'Vered',
  gender: 'female',
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
let assertionFailures = 0;
function check(n, name, pass, detail = '') {
  results.push({ n, name, pass });
  if (!pass) assertionFailures += 1;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'}  ${String(n).padStart(2)}. ${name}${detail ? `  ${detail}` : ''}`
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolve to `{ resolved: true, value }`, or `{ resolved: false }` on timeout. */
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise.then(
      (value) => ({ resolved: true, value }),
      (error) => ({ resolved: true, error })
    ),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve({ resolved: false }), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function waitFor(predicate, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(100);
  }
  return predicate();
}

/** An in-memory `storage` adapter, standing in for AsyncStorage on a device. */
function memoryStorage(bag = new Map()) {
  return {
    bag,
    getItem: async (key) => (bag.has(key) ? bag.get(key) : null),
    setItem: async (key, value) => void bag.set(key, value),
    removeItem: async (key) => void bag.delete(key),
  };
}

/** Exactly the `auth` block of src/api/supabase/client.ts. */
function appClient(storage) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      storage,
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

async function deleteFixtureAuthUsers() {
  // By email, not only by a captured id: a fixture left by a crashed run has an id this
  // process never saw (scripts/README.md rule 2).
  let removed = 0;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      if (u.email && u.email.toLowerCase() === FIXTURE.email) {
        const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
        if (delErr) throw new Error(`deleteUser(${u.email}) failed: ${delErr.message}`);
        removed += 1;
      }
    }
    if (data.users.length < 200) break;
  }
  return removed;
}

async function createFixture() {
  const reclaimed = await deleteFixtureAuthUsers();
  if (reclaimed) console.log(`  reclaimed ${reclaimed} stale fixture account(s)`);

  const { data, error } = await admin.auth.admin.createUser({
    email: FIXTURE.email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);

  const { data: row, error: rowErr } = await admin
    .from('users')
    .insert({
      auth_id: data.user.id,
      email: FIXTURE.email,
      first_name: FIXTURE.first_name,
      display_name: FIXTURE.first_name,
      date_of_birth: '1995-06-15',
      gender: FIXTURE.gender,
      jewish_background: 'modern_orthodox',
      looking_for: 'serious',
    })
    .select('id')
    .single();
  if (rowErr) throw new Error(`profile insert failed: ${rowErr.message}`);

  return { authId: data.user.id, userId: row.id };
}

/**
 * Sign in once and hand back the storage bag the client wrote its session into. Loading
 * a *new* client over that bag is a cold start with a saved session — a tester's second
 * launch, and the case that was a permanent white screen.
 */
async function savedSessionStorage() {
  const storage = memoryStorage();
  const client = appClient(storage);
  const { error } = await client.auth.signInWithPassword({
    email: FIXTURE.email,
    password: PASSWORD,
  });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  if (storage.bag.size === 0) throw new Error('sign-in wrote no session to storage');
  return storage;
}

async function main() {
  console.log('MEXA-335 - auth-lock deadlock, on the React Native lock path\n');
  console.log(`  node ${process.version}  window=${typeof window} document=${typeof document}\n`);

  console.log('setup: fixture');
  const fixture = await createFixture();
  console.log(`  ${FIXTURE.email}  auth=${fixture.authId}  users.id=${fixture.userId}\n`);

  try {
    // ---------------------------------------------------------------- case 1
    console.log('the lock supabase-js picked');
    const probe = appClient(memoryStorage());
    const lockName = probe.auth.lock?.name;
    check(
      1,
      'client is on lockNoOp, the lock React Native gets',
      lockName === 'lockNoOp',
      `lock=${lockName}`
    );

    // ------------------------------------------------------------- cases 2-3
    // The old shape. If this ever stops deadlocking, the rest of the file proves
    // nothing, so it is an assertion rather than a comment.
    console.log('\nthe old shape: async callback awaiting a query (must still hang)');
    {
      const storage = await savedSessionStorage();
      const client = appClient(storage);
      let queryFinished = false;

      client.auth.onAuthStateChange(async (event, session) => {
        if (!session?.user) return;
        await client.from('users').select('*').eq('auth_id', session.user.id).maybeSingle();
        queryFinished = true;
      });

      const got = await withTimeout(client.auth.getSession(), RESOLVE_TIMEOUT_MS);
      check(2, 'getSession() never resolves (the bug)', got.resolved === false);
      check(3, 'the callback never finishes its own query either', queryFinished === false);
    }

    // ------------------------------------------------------------- cases 4-7
    console.log('\nthe real handler from src/lib/auth/authStateSync.ts');
    let handlerSession = null;
    let handlerUser;
    let sessionSetDuringCallback = false;
    {
      const storage = await savedSessionStorage();
      const client = appClient(storage);
      let insideCallback = false;

      const handler = createAuthStateHandler({
        client,
        setSession: (session) => {
          handlerSession = session;
          if (insideCallback) sessionSetDuringCallback = true;
        },
        setUser: (user) => {
          handlerUser = user;
        },
        setHasShidduchProfile: () => {},
      });

      client.auth.onAuthStateChange((event, session) => {
        insideCallback = true;
        try {
          handler(event, session);
        } finally {
          insideCallback = false;
        }
      });

      const got = await withTimeout(client.auth.getSession(), RESOLVE_TIMEOUT_MS);
      check(
        4,
        'getSession() resolves with the saved session',
        got.resolved === true && !!got.value?.data?.session,
        got.resolved ? '' : '(timed out)'
      );
      check(5, 'the session reached the store during the callback', sessionSetDuringCallback);

      const landed = await waitFor(() => handlerUser !== undefined, DEFERRED_TIMEOUT_MS);
      check(6, 'the deferred profile fetch lands afterwards', landed && handlerUser !== undefined);
      check(
        7,
        'and it is the right users row',
        handlerUser?.id === fixture.userId,
        `id=${handlerUser?.id ?? 'none'}`
      );
    }

    // ---------------------------------------------------------------- case 8
    // The confirm screen's call. A fresh client with no stored session, so the only
    // thing that can hold the lock is the exchange itself; the code is deliberately
    // bogus, because a *failed* exchange still notifies nothing and still has to
    // resolve. Before the fix, the successful exchange in the walkthrough hung here.
    console.log('\nthe confirm screen: exchangeCodeForSession()');
    {
      const storage = await savedSessionStorage();
      const client = appClient(storage);
      const handler = createAuthStateHandler({
        client,
        setSession: () => {},
        setUser: () => {},
        setHasShidduchProfile: () => {},
      });
      client.auth.onAuthStateChange(handler);

      // Let the cold-start SIGNED_IN happen first, so the exchange runs in the same
      // client state app/auth/confirm.tsx sees.
      await withTimeout(client.auth.getSession(), RESOLVE_TIMEOUT_MS);

      const got = await withTimeout(
        client.auth.exchangeCodeForSession('mexa335-not-a-real-code'),
        RESOLVE_TIMEOUT_MS
      );
      check(
        8,
        'exchangeCodeForSession() resolves instead of hanging',
        got.resolved === true,
        got.resolved ? '' : '(timed out - the confirm spinner)'
      );
    }

    // ------------------------------------------------------------ cases 9-11
    // Unit-ish cases on the handler's own bookkeeping. `defer` is overridden so the
    // deferred work is driven by hand; `client` is a stub, because what is under test
    // here is the handler, not PostgREST.
    console.log('\nthe handler bookkeeping');
    {
      const session = { user: { id: fixture.authId } };
      const otherSession = { user: { id: '00000000-0000-0000-0000-000000000001' } };

      // --- case 9: a token refresh does not refetch a profile we already have.
      let queries = 0;
      const deferred = [];
      const counting = {
        from: () => {
          queries += 1;
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: fixture.userId }, error: null }) }) }),
          };
        },
      };
      let user;
      const handler9 = createAuthStateHandler({
        client: counting,
        setSession: () => {},
        setUser: (u) => {
          user = u;
        },
        setHasShidduchProfile: () => {},
        defer: (fn) => deferred.push(fn),
      });

      handler9('SIGNED_IN', session);
      deferred.shift()?.();
      await waitFor(() => user !== undefined, 2000);
      handler9('TOKEN_REFRESHED', session);
      deferred.shift()?.();
      await sleep(50);
      check(9, 'TOKEN_REFRESHED does not refetch a loaded profile', queries === 1, `queries=${queries}`);

      // --- case 10: a failed query keeps the profile that is already there.
      let failNext = false;
      const flaky = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                failNext
                  ? { data: null, error: { message: 'simulated transport failure' } }
                  : { data: { id: fixture.userId }, error: null },
            }),
          }),
        }),
      };
      const deferred10 = [];
      let user10 = 'untouched';
      const handler10 = createAuthStateHandler({
        client: flaky,
        setSession: () => {},
        setUser: (u) => {
          user10 = u;
        },
        setHasShidduchProfile: () => {},
        defer: (fn) => deferred10.push(fn),
      });

      handler10('SIGNED_IN', session);
      deferred10.shift()?.();
      await waitFor(() => user10 !== 'untouched', 2000);
      const loaded = user10;
      failNext = true;
      handler10('USER_UPDATED', session);
      deferred10.shift()?.();
      await sleep(200);
      check(
        10,
        'a failed profile query leaves the loaded profile alone',
        user10 === loaded && user10?.id === fixture.userId,
        `user=${JSON.stringify(user10)}`
      );

      // --- case 11: a stale fetch must not resurrect a signed-out user. The fetch for
      // `session` is released only after SIGNED_OUT has been handled.
      const deferred11 = [];
      const writes = [];
      const handler11 = createAuthStateHandler({
        client: {
          from: () => ({
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { id: fixture.userId }, error: null }) }),
            }),
          }),
        },
        setSession: () => {},
        setUser: (u) => writes.push(u),
        setHasShidduchProfile: () => {},
        defer: (fn) => deferred11.push(fn),
      });

      handler11('SIGNED_IN', otherSession); // queues a fetch
      handler11('SIGNED_OUT', null); // synchronously clears the user
      deferred11.shift()?.(); // now let the stale fetch come back
      await sleep(300);
      check(
        11,
        'a stale fetch after SIGNED_OUT does not write a user',
        writes.length === 1 && writes[0] === null,
        `writes=${JSON.stringify(writes)}`
      );

      // --- cases 12-13: the router gate. `app/index.tsx` waits on this flag, so it has
      // to be raised before the callback returns (the router can render in the gap) and
      // lowered whatever the fetch does — a stuck flag is a spinner that never clears.
      for (const [n, failing, label] of [
        [12, false, 'a successful fetch'],
        [13, true, 'a failed fetch'],
      ]) {
        const deferred12 = [];
        const flags = [];
        const handler12 = createAuthStateHandler({
          client: {
            from: () => ({
              select: () => ({
                eq: () => ({
                  maybeSingle: async () =>
                    failing
                      ? { data: null, error: { message: 'simulated transport failure' } }
                      : { data: { id: fixture.userId }, error: null },
                }),
              }),
            }),
          },
          setSession: () => {},
          setUser: () => {},
          setHasShidduchProfile: () => {},
          setProfileLoading: (v) => flags.push(v),
          defer: (fn) => deferred12.push(fn),
        });

        handler12('SIGNED_IN', session);
        const raisedSynchronously = flags.length === 1 && flags[0] === true;
        deferred12.shift()?.();
        await waitFor(() => flags.length >= 2, 2000);
        check(
          n,
          `profile-loading is raised in the callback and lowered after ${label}`,
          raisedSynchronously && flags.length === 2 && flags[1] === false,
          `flags=${JSON.stringify(flags)}`
        );
      }

      // --- cases 14-15: the same generation guard, on the path that actually puts the
      // wrong person on screen. Case 11 goes through SIGNED_OUT; this is a bare A -> B
      // switch with no sign-out in between, and A's fetch comes back first while B's
      // event has already been handled. The stub answers by the `auth_id` it was asked
      // for, so a stale write would be visibly A's row rather than just an extra write
      // (Guts, MEXA-340).
      {
        const rowFor = { [fixture.authId]: fixture.userId, [otherSession.user.id]: 'row-B' };
        const deferred14 = [];
        const writes14 = [];
        const flags14 = [];
        const handler14 = createAuthStateHandler({
          client: {
            from: () => ({
              select: () => ({
                eq: (_column, authId) => ({
                  maybeSingle: async () => ({ data: { id: rowFor[authId] }, error: null }),
                }),
              }),
            }),
          },
          setSession: () => {},
          setUser: (u) => writes14.push(u),
          setHasShidduchProfile: () => {},
          setProfileLoading: (v) => flags14.push(v),
          defer: (fn) => deferred14.push(fn),
        });

        handler14('SIGNED_IN', session); // account A, queues fetch A
        handler14('SIGNED_IN', otherSession); // straight to account B, queues fetch B
        deferred14.shift()?.(); // fetch A comes back (stale)
        deferred14.shift()?.(); // fetch B comes back (live)
        await waitFor(() => writes14.length > 0, 2000);
        await sleep(300);
        check(
          14,
          "switching A -> B without a sign-out never writes A's row",
          writes14.length === 1 && writes14[0]?.id === 'row-B',
          `writes=${JSON.stringify(writes14)}`
        );
        check(
          15,
          'and the stale fetch does not lower the router gate under the live one',
          flags14.filter((v) => v === false).length === 1 &&
            flags14[flags14.length - 1] === false,
          `flags=${JSON.stringify(flags14)}`
        );
      }
    }
  } finally {
    console.log('\nteardown');
    let teardownFailed = false;
    try {
      const removed = await deleteFixtureAuthUsers();
      console.log(`  deleted ${removed} fixture account(s)`);
      const left = await deleteFixtureAuthUsers();
      if (left !== 0) {
        console.error(`  teardown left ${left} fixture account(s) behind`);
        teardownFailed = true;
      }
    } catch (e) {
      console.error(`  teardown failed: ${e.message}`);
      teardownFailed = true;
    }

    const passed = results.filter((r) => r.pass).length;
    console.log(`\n${passed}/${results.length} passed`);
    if (assertionFailures > 0) console.log(`${assertionFailures} assertion failure(s)`);
    if (teardownFailed) console.log('teardown FAILED - fixture rows may still be live');

    // Rule 3: a teardown failure is non-zero even when every assertion passed.
    process.exit(assertionFailures > 0 || teardownFailed ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
