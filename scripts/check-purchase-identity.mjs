#!/usr/bin/env node
/**
 * check-purchase-identity.mjs - the corpus behind MEXA-346.
 *
 * Offline: no Supabase, no RevenueCat, no credentials, no network, no iOS sandbox.
 *
 *   node scripts/check-purchase-identity.mjs        # one line per failure, exit 1 on any
 *   node scripts/check-purchase-identity.mjs -v     # also print every passing case
 *
 * ## The defect
 *
 * `app/_layout.tsx` called `initializeRevenueCat()` with no user id, so
 * `Purchases.configure()` invented an anonymous app user id per install, and
 * `Purchases.logIn` was never called from anywhere - grep found only its definition. So
 * every entitlement (gold, platinum, orthodox, safta_pro) belonged to the phone rather
 * than to the account: a second device saw nothing until "Restore Purchases", and two
 * accounts on one phone shared one RevenueCat customer.
 *
 * ## What it drives
 *
 * The real `createPurchaseIdentity` from `src/lib/purchases/identity.ts` against a
 * recording stub at the `configure` / `logIn` / `logOut` seam - the same three calls
 * `revenuecat.ts` wires to the SDK - and the real `createAuthStateHandler` from
 * `src/lib/auth/authStateSync.ts` against a stub Supabase client. Both modules import
 * nothing at runtime on purpose (types only), so Node 24 loads them straight from `.ts`
 * with no build; the `MODULE_TYPELESS_PACKAGE_JSON` warning is expected.
 *
 * ## The cases that matter
 *
 *  - ORDERING 2: an identity requested *before* configure becomes configure's own
 *    `appUserID`. `app/_layout.tsx` starts `initializeRevenueCat()` and registers the
 *    auth listener in one effect and neither orders the other, so this really happens -
 *    and `Purchases.logIn` before `configure` throws.
 *  - ORDERING 7: a cold start with no session must NOT call `logOut`. RevenueCat reports
 *    logging out an already-anonymous user as an error.
 *  - APPLY 3: a failed `logIn` must leave the last-applied id alone, so the next auth
 *    event retries instead of believing the SDK is somewhere it is not.
 *  - LISTENER 1: the identity call leaves the `onAuthStateChange` callback through
 *    `defer()`. Awaiting anything in that callback deadlocks the whole auth client
 *    (MEXA-335), and `Purchases.logIn` is a network call.
 *  - LISTENER 7: the first event of a launch always sends, including `null`. RevenueCat
 *    persists its app user id across launches, so a fresh JS context cannot assume the
 *    SDK is where it left it.
 *
 * The CONTROL block re-implements the pre-fix shape (configure with no id, no logIn) and
 * *requires* it to leave a signed-in user anonymous, so the positive cases above cannot
 * pass vacuously.
 *
 * ## What it does not prove
 *
 * That StoreKit honours any of it. Identification and entitlement need a real device or
 * a RevenueCat sandbox; this box has neither. `npx tsc --noEmit` covers the wiring types,
 * and the WIRING block below covers the call sites by source text, which is all a Node
 * script can do for a module that imports `react-native-purchases`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPurchaseIdentity } from '../src/lib/purchases/identity.ts';
import { createAuthStateHandler } from '../src/lib/auth/authStateSync.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const IDENTITY = path.join(ROOT, 'src', 'lib', 'purchases', 'identity.ts');
const REVENUECAT = path.join(ROOT, 'src', 'lib', 'config', 'revenuecat.ts');
const AUTH_SYNC = path.join(ROOT, 'src', 'lib', 'auth', 'authStateSync.ts');
const LAYOUT = path.join(ROOT, 'app', '_layout.tsx');
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

const failures = [];
let passes = 0;

function record(ok, label, detail) {
  if (ok) {
    passes += 1;
    if (VERBOSE) console.log(`  ok    ${label}`);
    return;
  }
  failures.push(`${label}${detail ? ` - ${detail}` : ''}`);
  console.log(`  FAIL  ${label}${detail ? ` - ${detail}` : ''}`);
}

function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  record(a === e, label, a === e ? '' : `got ${a}, want ${e}`);
}

/**
 * A stub at the seam `revenuecat.ts` wires to the SDK, recording every call in order.
 *
 * `configureResult` false is the Expo Go / missing-key case (not an error);
 * `configureThrows` is a real configure failure. `logInThrows` is a one-shot, so a
 * retry after a failure can be observed.
 */
function stubStore({ configureResult = true, configureThrows = null, logInThrows = null } = {}) {
  const calls = [];
  const errors = [];
  let pendingLogIn = null;
  let logInFailuresLeft = logInThrows ? logInThrows.times ?? 1 : 0;

  const store = {
    calls,
    errors,
    /** Hold the next logIn open, so an event arriving mid-flight can be tested. */
    hold: false,
    release() {
      const resolve = pendingLogIn;
      pendingLogIn = null;
      resolve?.();
    },
    binding: {
      async configure(appUserId) {
        calls.push(`configure(${appUserId ?? 'anonymous'})`);
        if (configureThrows) throw new Error(configureThrows);
        return configureResult;
      },
      async logIn(appUserId) {
        calls.push(`logIn(${appUserId})`);
        if (store.hold) await new Promise((resolve) => (pendingLogIn = resolve));
        if (logInFailuresLeft > 0) {
          logInFailuresLeft -= 1;
          throw new Error(logInThrows.message ?? 'logIn failed');
        }
      },
      async logOut() {
        calls.push('logOut()');
      },
      onError(stage, error) {
        errors.push(`${stage}: ${error.message}`);
      },
    },
  };
  return store;
}

/** Let every queued microtask run. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

console.log(`purchase identity: ${IDENTITY}\n`);

// ---------------------------------------------------------------------------
console.log('ORDERING - configure and identity race, and neither orders the other');
{
  // 1. Nothing requested: RevenueCat gets its anonymous id, and nothing else happens.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  record((await id.configure()) === true, 'configure resolves true when the SDK is usable');
  await id.settled();
  eq(s.calls, ['configure(anonymous)'], 'a launch with no session configures anonymously');
  eq(id.state().status, 'ready', 'and the state is ready');
}
{
  // 2. THE CASE THIS EXISTS FOR. Identity known before configure ran: it becomes the
  // appUserID, so no anonymous customer is created and there is nothing to alias.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  await id.setIdentity(A);
  await id.configure();
  await id.settled();
  eq(s.calls, [`configure(${A})`], 'an identity known before configure becomes the appUserID');
  record(!s.calls.some((c) => c.startsWith('logIn')), 'and no logIn is needed afterwards');
}
{
  // 3. The ordinary case: sign-in after the SDK is up.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  await id.configure();
  await id.setIdentity(A);
  eq(s.calls, ['configure(anonymous)', `logIn(${A})`], 'a later sign-in logs in');
}
{
  // 4. Repeats are free - the auth listener may re-send the same id.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  await id.configure();
  await id.setIdentity(A);
  await id.setIdentity(A);
  await id.setIdentity(A);
  eq(s.calls, ['configure(anonymous)', `logIn(${A})`], 'the same id is applied only once');
}
{
  // 5. Two accounts on one install: the second must not inherit the first's customer.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  await id.configure();
  await id.setIdentity(A);
  await id.setIdentity(null);
  await id.setIdentity(B);
  eq(
    s.calls,
    ['configure(anonymous)', `logIn(${A})`, 'logOut()', `logIn(${B})`],
    'account A -> sign out -> account B walks the SDK across'
  );
  eq(id.state().applied, B, 'and the SDK ends on B');
}
{
  // 6. Switching accounts with no sign-out in between (a re-auth, or a deep link).
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  await id.configure();
  await id.setIdentity(A);
  await id.setIdentity(B);
  eq(
    s.calls,
    ['configure(anonymous)', `logIn(${A})`, `logIn(${B})`],
    'A -> B with no sign-out still re-identifies'
  );
}
{
  // 7. A cold start with no session must not log out: RevenueCat treats logging out an
  // already-anonymous app user id as an error, and the app would log it every launch.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  await id.configure();
  await id.setIdentity(null);
  eq(s.calls, ['configure(anonymous)'], 'signed out at launch does not call logOut');
  eq(s.errors, [], 'and reports no error');
}
{
  // 8. configure() is once per process however many times it is called.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  const [one, two] = await Promise.all([id.configure(), id.configure()]);
  await id.configure();
  eq(s.calls, ['configure(anonymous)'], 'configure runs once');
  record(one === true && two === true, 'and every caller gets the same answer');
}

// ---------------------------------------------------------------------------
console.log('\nAPPLY - serialisation, retries, and never throwing at the caller');
{
  // 1. An identity change arriving while a logIn is in flight must queue behind it,
  // not race it: out of order, the SDK would be left on the wrong account.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  await id.configure();
  s.hold = true;
  const first = id.setIdentity(A);
  await tick();
  eq(s.calls, ['configure(anonymous)', `logIn(${A})`], 'logIn(A) is in flight');
  const second = id.setIdentity(B);
  await tick();
  eq(s.calls, ['configure(anonymous)', `logIn(${A})`], 'logIn(B) waits rather than racing');
  s.hold = false;
  s.release();
  await Promise.all([first, second]);
  eq(
    s.calls,
    ['configure(anonymous)', `logIn(${A})`, `logIn(${B})`],
    'and lands after it, in order'
  );
  eq(id.state().applied, B, 'the SDK ends on B');
}
{
  // 2. A -> B -> A in one burst collapses to the destination. The intermediate B must
  // never be applied, or an entitlement read in between answers for the wrong account.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  await id.configure();
  const all = [id.setIdentity(A), id.setIdentity(B), id.setIdentity(A)];
  await Promise.all(all);
  eq(s.calls, ['configure(anonymous)', `logIn(${A})`], 'A -> B -> A collapses to one logIn(A)');
  eq(id.state().applied, A, 'and the SDK is on A');
}
{
  // 3. A failed logIn must not be recorded as applied, or the retry never happens and
  // the user stays on the anonymous customer for the rest of the session.
  const s = stubStore({ logInThrows: { message: 'offline' } });
  const id = createPurchaseIdentity(s.binding);
  await id.configure();
  await id.setIdentity(A);
  eq(s.errors, ['logIn: offline'], 'a failed logIn is reported');
  eq(id.state().applied, null, 'and is not recorded as applied');
  await id.setIdentity(null);
  await id.setIdentity(A);
  eq(
    s.calls,
    ['configure(anonymous)', `logIn(${A})`, `logIn(${A})`],
    'so the next auth event retries it'
  );
  eq(id.state().applied, A, 'and the retry sticks');
}
{
  // 4. Expo Go and a missing API key are normal states, not failures. Nothing may be
  // called on an SDK that was never configured.
  const s = stubStore({ configureResult: false });
  const id = createPurchaseIdentity(s.binding);
  record((await id.configure()) === false, 'configure resolves false with no store');
  await id.setIdentity(A);
  eq(s.calls, ['configure(anonymous)'], 'and no identity call follows');
  eq(s.errors, [], 'no store is not an error');
  eq(id.state().status, 'unavailable', 'the state says unavailable');
}
{
  // 5. A configure that throws is an error, and still must not leave logIn reachable.
  const s = stubStore({ configureThrows: 'no native store' });
  const id = createPurchaseIdentity(s.binding);
  record((await id.configure()) === false, 'a throwing configure resolves false');
  eq(s.errors, ['configure: no native store'], 'and is reported once');
  await id.setIdentity(A);
  eq(s.calls, ['configure(anonymous)'], 'no logIn on an unconfigured SDK');
}
{
  // 6. Nothing here rejects at the caller: these are called from a fire-and-forget
  // `void` in the auth listener, where a rejection is an unhandled promise.
  const s = stubStore({ logInThrows: { message: 'boom', times: 5 } });
  const id = createPurchaseIdentity(s.binding);
  await id.configure();
  let threw = false;
  try {
    await id.setIdentity(A);
    await id.settled();
  } catch {
    threw = true;
  }
  record(!threw, 'setIdentity never rejects, even when the store fails');
}

// ---------------------------------------------------------------------------
console.log('\nSETTLED - what an entitlement read waits for');
{
  // 1. A read that races the sign-in must not answer from the anonymous customer.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  await id.configure();
  s.hold = true;
  void id.setIdentity(A);
  await tick();
  let done = false;
  const waiting = id.settled().then(() => (done = true));
  await tick();
  record(!done, 'settled() waits while an identity change is in flight');
  s.hold = false;
  s.release();
  await waiting;
  record(done && id.state().applied === A, 'and resolves once it has landed');
}
{
  // 2. settled() must never be able to wedge a screen. Nothing started, nothing to wait
  // for - this is what keeps a missing initializeRevenueCat() from hanging a paywall.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  let done = false;
  void id.settled().then(() => (done = true));
  await tick();
  record(done, 'settled() resolves immediately when nothing was ever started');
  eq(s.calls, [], 'and starts nothing itself');
}
{
  // 3. It also covers configure, not just identity: a read at launch waits for the SDK.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  void id.configure();
  await id.settled();
  eq(id.state().status, 'ready', 'settled() waits for configure too');
}

// ---------------------------------------------------------------------------
console.log('\nCONTROL - the pre-MEXA-346 shape, which must still be broken');
{
  // configure with no appUserID and no logIn anywhere: exactly what shipped. If this
  // block ever reports the user as identified, the corpus above proves nothing.
  const s = stubStore();
  const id = createPurchaseIdentity(s.binding);
  await id.configure(); // the old app/_layout.tsx:99 call, with no id and no listener
  await id.settled();
  record(id.state().applied === null, 'the old shape leaves a signed-in user anonymous');
  record(
    !s.calls.some((c) => c.startsWith('logIn')),
    'and never calls logIn - the grep result on the issue'
  );
}

// ---------------------------------------------------------------------------
console.log('\nLISTENER - how the identity leaves onAuthStateChange');

/** The two queries `loadUserProfile` makes, stubbed. */
function stubClient({ fail = false, explode = false } = {}) {
  return {
    from() {
      if (explode) throw new Error('PostgREST unreachable');
      const q = {
        select: () => q,
        eq: (_column, value) => {
          q.value = value;
          return q;
        },
        maybeSingle: async () =>
          fail
            ? { data: null, error: { message: 'stub failure' } }
            : { data: { id: `profile-of-${q.value}`, auth_id: q.value }, error: null },
      };
      return q;
    },
  };
}

/** Build the handler with a manual `defer` queue, so timing is observable. */
function listener(options = {}) {
  const queue = [];
  const identities = [];
  const handler = createAuthStateHandler({
    client: options.client ?? stubClient(),
    setSession: () => {},
    setUser: () => {},
    setHasShidduchProfile: () => {},
    setProfileLoading: () => {},
    onIdentityChange: options.omit ? undefined : (authId) => identities.push(authId),
    defer: (fn) => queue.push(fn),
  });
  const flush = async () => {
    while (queue.length) {
      queue.shift()();
      await tick();
    }
  };
  return { handler, identities, queue, flush };
}

const session = (authId) => ({ user: { id: authId }, access_token: 'stub' });

{
  // 1. THE MEXA-335 CONTRACT. `Purchases.logIn` is a network call; if it were awaited in
  // this callback the whole auth client would deadlock. Nothing may fire synchronously.
  const l = listener();
  const returned = l.handler('SIGNED_IN', session(A));
  record(returned === undefined, 'the handler returns undefined, not a promise');
  eq(l.identities, [], 'nothing is identified inside the callback');
  record(l.queue.length > 0, 'the identity call is queued on defer()');
  await l.flush();
  eq(l.identities, [A], 'and lands afterwards, with the auth.users.id');
}
{
  // 2. Launch with a stored session: supabase-js fires INITIAL_SESSION, then SIGNED_IN
  // for the same account. One identification, not two.
  const l = listener();
  l.handler('INITIAL_SESSION', session(A));
  l.handler('SIGNED_IN', session(A));
  await l.flush();
  eq(l.identities, [A], 'INITIAL_SESSION + SIGNED_IN for one account identifies once');
}
{
  // 3. A token refresh happens hourly, forever. It must not re-identify.
  const l = listener();
  l.handler('SIGNED_IN', session(A));
  await l.flush();
  l.handler('TOKEN_REFRESHED', session(A));
  l.handler('TOKEN_REFRESHED', session(A));
  await l.flush();
  eq(l.identities, [A], 'TOKEN_REFRESHED does not re-identify');
}
{
  // 4. Sign-out has to reach RevenueCat, or the next account on this phone inherits the
  // customer - one of the two consequences on the issue.
  const l = listener();
  l.handler('SIGNED_IN', session(A));
  await l.flush();
  l.handler('SIGNED_OUT', null);
  await l.flush();
  eq(l.identities, [A, null], 'SIGNED_OUT hands RevenueCat back to anonymous');
}
{
  // 5. Two accounts on one install, the other consequence on the issue.
  const l = listener();
  l.handler('SIGNED_IN', session(A));
  await l.flush();
  l.handler('SIGNED_OUT', null);
  await l.flush();
  l.handler('SIGNED_IN', session(B));
  await l.flush();
  eq(l.identities, [A, null, B], 'account A then account B never share a customer');
}
{
  // 6. An account switch with no sign-out in between.
  const l = listener();
  l.handler('SIGNED_IN', session(A));
  l.handler('SIGNED_IN', session(B));
  await l.flush();
  record(l.identities.at(-1) === B, 'a direct A -> B switch ends on B');
  record(
    !l.identities.slice(l.identities.indexOf(B) + 1).length,
    'and nothing stale is sent after it'
  );
}
{
  // 7. A cold start with no session still has to send `null`: RevenueCat persists its
  // app user id across launches, so a fresh JS context cannot assume it is anonymous.
  const l = listener();
  l.handler('INITIAL_SESSION', null);
  await l.flush();
  eq(l.identities, [null], 'a signed-out launch clears the persisted app user id');
  l.handler('INITIAL_SESSION', null);
  await l.flush();
  eq(l.identities, [null], 'but only once');
}
{
  // 8. Billing identity must not depend on PostgREST. The profile fetch is allowed to
  // fail; the entitlement the user paid for is not allowed to fail with it.
  const l = listener({ client: stubClient({ fail: true }) });
  l.handler('SIGNED_IN', session(A));
  await l.flush();
  eq(l.identities, [A], 'a failed profile query still identifies');
}
{
  const l = listener({ client: stubClient({ explode: true }) });
  l.handler('SIGNED_IN', session(A));
  await l.flush();
  eq(l.identities, [A], 'so does a client that throws outright');
}
{
  // 9. The binding is optional - every other consumer of this module must keep working.
  const l = listener({ omit: true });
  let threw = false;
  try {
    l.handler('SIGNED_IN', session(A));
    await l.flush();
  } catch {
    threw = true;
  }
  record(!threw, 'a binding with no onIdentityChange is fine');
}

// ---------------------------------------------------------------------------
console.log('\nWIRING - the call sites, by source text');
{
  const identity = fs.readFileSync(IDENTITY, 'utf8');
  const revenuecat = fs.readFileSync(REVENUECAT, 'utf8');
  const authSync = fs.readFileSync(AUTH_SYNC, 'utf8');
  const layout = fs.readFileSync(LAYOUT, 'utf8');

  // identity.ts has to stay runtime-import-free, or this script cannot load it and the
  // whole corpus above silently stops running.
  const runtimeImports = identity
    .split('\n')
    .filter((line) => /^import\s/.test(line) && !/^import\s+type\s/.test(line));
  eq(runtimeImports, [], 'identity.ts imports nothing at runtime');

  // The decision the issue asked to be written down.
  record(
    /\*\*The Supabase `auth\.users\.id`\*\*/.test(identity) &&
      /Not[\s*]+`public\.users\.id`/.test(identity),
    'identity.ts records that the app user id is auth.users.id, not public.users.id'
  );

  // revenuecat.ts is the only place that touches the SDK, and it goes through here.
  record(
    /createPurchaseIdentity\(\{/.test(revenuecat),
    'revenuecat.ts builds the identity through createPurchaseIdentity'
  );
  eq(
    (revenuecat.match(/Purchases\.configure\(/g) ?? []).length,
    1,
    'exactly one Purchases.configure call'
  );
  record(
    /appUserID: appUserId \?\? undefined/.test(revenuecat),
    'and it passes the requested app user id through'
  );
  record(
    /logIn: async \(appUserId\) => \{\s*await Purchases\.logIn\(appUserId\)/.test(revenuecat),
    'logIn is wired to Purchases.logIn'
  );
  record(
    /logOut: async \(\) => \{\s*await Purchases\.logOut\(\)/.test(revenuecat),
    'logOut is wired to Purchases.logOut'
  );
  record(
    /export async function setPurchaseIdentity\(authUserId: string \| null\)/.test(revenuecat),
    'setPurchaseIdentity is the exported seam'
  );

  // Every read of a CustomerInfo, and every call that moves money, waits for identity.
  for (const fn of ['getCustomerInfo', 'hasEntitlement', 'purchasePackage', 'restorePurchases']) {
    const body = revenuecat.slice(revenuecat.indexOf(`export async function ${fn}`));
    const upToFirstCall = body.slice(0, body.indexOf('await Purchases.'));
    record(
      /await purchaseIdentity\.settled\(\)/.test(upToFirstCall),
      `${fn}() waits for the identity to settle first`
    );
  }

  // The listener contract, in the module that has to keep it.
  record(
    /onIdentityChange\?: \(authId: string \| null\) => void/.test(authSync),
    'authStateSync declares the onIdentityChange binding'
  );
  const handlerBody = authSync.slice(authSync.indexOf('return (event, session) => {'));
  record(
    /defer\(\(\) => \{[\s\S]{0,400}?binding\.onIdentityChange\?\.\(authId\)/.test(handlerBody),
    'and calls it through defer(), not inline'
  );
  record(
    !/await\s+binding\.onIdentityChange/.test(authSync),
    'and never awaits it'
  );
  record(
    !/onAuthStateChange\(\s*async/.test(authSync) && !/return async \(event, session\)/.test(authSync),
    'the callback is still synchronous (MEXA-335)'
  );

  // The app wires all of it up, and does not await the result.
  record(
    /onIdentityChange: \(authId\) => \{\s*void setPurchaseIdentity\(authId\);/.test(layout),
    '_layout.tsx wires onIdentityChange to setPurchaseIdentity with void'
  );
  record(
    /import \{ initializeRevenueCat, setPurchaseIdentity \}/.test(layout),
    'and imports it from the config module'
  );
  eq(
    (layout.match(/subscribeToAuthState\(/g) ?? []).length,
    1,
    'still exactly one onAuthStateChange subscription (MEXA-340)'
  );
}

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
