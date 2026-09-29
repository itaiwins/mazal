#!/usr/bin/env node
/**
 * check-recovery-session.mjs — the cases behind MEXA-264's recovery-session bound.
 *
 * Offline: no Supabase, no credentials, no network. It imports the real
 * `src/lib/auth/recoverySession.ts` (Node 24 strips the types; that module imports
 * nothing at all) and drives it against a stub that counts `signOut` calls and lets
 * the test set `AppState.currentState`. Pure JS, so a pass here is a pass on device.
 *
 *   node scripts/check-recovery-session.mjs        # one line per failure, exit 1 on any
 *   node scripts/check-recovery-session.mjs -v     # also print every passing case
 *
 * Why this exists: a password-reset link mints a full auto-refreshing session before
 * the user has proved anything, and three successive versions of "end it when they
 * leave" were each wrong in a way only a careful read caught — there is no simulator
 * on the build box and no test runner in this repo. Every case below is a shape that
 * shipped or was about to.
 *
 * The one that matters most is `save fails while still backgrounded`: that is the
 * hole Guts found in `00b5ce0`. The listener correctly refuses to sign out while a
 * write is in flight, the write then fails, the screen goes back to `ready` — and no
 * further AppState event is ever coming, so the session just stays live.
 */

import { createRecoverySessionGuard } from '../src/lib/auth/recoverySession.ts';

const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

let passes = 0;
const failures = [];

function record(ok, name, detail) {
  if (ok) {
    passes += 1;
    if (VERBOSE) console.log(`  ok   ${name}`);
    return;
  }
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

/**
 * A stand-in for supabase-js plus react-native's AppState.
 *
 * `signOutFails` models the case the guard exists to survive: auth-js `_signOut`
 * calls `/logout` and returns early *without* clearing the local session when that
 * call fails, so a returned error means the session is still live.
 */
function harness({ appState = 'active', signOutFails = false, signOutThrows = false } = {}) {
  const state = { appState, signOutFails, signOutThrows, signOuts: 0 };

  const guard = createRecoverySessionGuard({
    signOut: async () => {
      state.signOuts += 1;
      if (state.signOutThrows) throw new Error('network down');
      return { error: state.signOutFails ? { message: 'network down' } : null };
    },
    getAppState: () => state.appState,
  });

  return { state, guard };
}

// ---------------------------------------------------------------------------
console.log('leaving the app before saving ends the session');

for (const status of ['verifying', 'ready']) {
  const { state, guard } = harness();
  const abandoned = await guard.onAppStateChange('background', status);
  record(abandoned && state.signOuts === 1, `background while '${status}' signs out`,
    `abandoned=${abandoned} signOuts=${state.signOuts}`);
}

{
  const { state, guard } = harness();
  await guard.onAppStateChange('background', 'invalid');
  record(state.signOuts === 0, "background while 'invalid' does nothing",
    `signOuts=${state.signOuts}`);
}

{
  // Two events in a row, e.g. background -> active -> background, must not stack.
  const { state, guard } = harness();
  await guard.onAppStateChange('background', 'ready');
  await guard.onAppStateChange('background', 'ready');
  record(state.signOuts === 1, 'a second background event does not sign out twice',
    `signOuts=${state.signOuts}`);
}

{
  // The listener's early return covers the case above, so this reaches past it to
  // abandon()'s own guard — two callers (the listener and a failing save) must not
  // be able to stack sign-outs even if they ever do both fire.
  const { state, guard } = harness();
  await guard.abandon();
  await guard.abandon();
  record(state.signOuts === 1, 'abandon() twice signs out once',
    `signOuts=${state.signOuts}`);
}

// ---------------------------------------------------------------------------
console.log("\n'inactive' is not leaving (app switcher, calls, autofill sheet)");

{
  const { state, guard } = harness();
  const abandoned = await guard.onAppStateChange('inactive', 'ready');
  record(!abandoned && state.signOuts === 0, "inactive while 'ready' keeps the session",
    `abandoned=${abandoned} signOuts=${state.signOuts}`);
}

{
  // The password-manager case: a rejected save while the autofill sheet is up must
  // show the error, not throw the session away.
  const { state, guard } = harness({ appState: 'inactive' });
  const outcome = await guard.settleFailedSave('Password is too short');
  record(outcome.render === 'error' && state.signOuts === 0,
    'a save that fails while inactive shows the error',
    `render=${outcome.render} signOuts=${state.signOuts}`);
}

// ---------------------------------------------------------------------------
console.log('\na save in flight is never interrupted (MEXA-264, Guts on 00b5ce0)');

{
  const { state, guard } = harness();
  const abandoned = await guard.onAppStateChange('background', 'saving');
  record(!abandoned && state.signOuts === 0,
    "background while 'saving' leaves the write alone",
    `abandoned=${abandoned} signOuts=${state.signOuts}`);
}

{
  // THE REGRESSION. Backgrounded during the save, save then fails, still
  // backgrounded: nothing else will ever fire, so the guard has to act here.
  const { state, guard } = harness();
  await guard.onAppStateChange('background', 'saving');
  state.appState = 'background';
  const outcome = await guard.settleFailedSave('Something went wrong.');
  record(outcome.render === 'abandoned' && state.signOuts === 1,
    'a save that fails while still backgrounded ends the session',
    `render=${outcome.render} signOuts=${state.signOuts}`);
}

{
  // Same start, but the user came back first. They are present, so they get the
  // error and keep the session they are actively using.
  const { state, guard } = harness();
  await guard.onAppStateChange('background', 'saving');
  state.appState = 'active';
  await guard.onAppStateChange('active', 'saving');
  const outcome = await guard.settleFailedSave('Password is too short');
  record(outcome.render === 'error' && state.signOuts === 0,
    'a save that fails after coming back shows the error',
    `render=${outcome.render} signOuts=${state.signOuts}`);
}

// ---------------------------------------------------------------------------
console.log('\nleaving while the link is still being exchanged');

{
  // The sign-out ran before the session existed, so the arriving one must be ended.
  const { state, guard } = harness();
  await guard.onAppStateChange('background', 'verifying');
  const handled = await guard.afterExchange(true);
  record(handled && state.signOuts === 2,
    'a session that lands after the user left is signed out again',
    `handled=${handled} signOuts=${state.signOuts}`);
}

{
  const { state, guard } = harness();
  await guard.onAppStateChange('background', 'verifying');
  const handled = await guard.afterExchange(false);
  record(handled && state.signOuts === 1,
    'a failed exchange after leaving needs no second sign-out',
    `handled=${handled} signOuts=${state.signOuts}`);
}

{
  const { state, guard } = harness();
  const handled = await guard.afterExchange(true);
  record(!handled && state.signOuts === 0,
    'an exchange the user waited for is left alone',
    `handled=${handled} signOuts=${state.signOuts}`);
}

// ---------------------------------------------------------------------------
console.log('\na sign-out that did not land is not a sign-out');

{
  const { state, guard } = harness({ signOutFails: true });
  const ok = await guard.endSession();
  record(!ok && guard.isSignOutPending(), 'a failed signOut is recorded, not believed',
    `ok=${ok} pending=${guard.isSignOutPending()} signOuts=${state.signOuts}`);
}

{
  const { state, guard } = harness({ signOutThrows: true });
  const ok = await guard.endSession();
  record(!ok && guard.isSignOutPending(), 'a thrown signOut is recorded too',
    `ok=${ok} pending=${guard.isSignOutPending()} signOuts=${state.signOuts}`);
}

{
  const { state, guard } = harness();
  const ok = await guard.endSession();
  record(ok && !guard.isSignOutPending(), 'a signOut that landed leaves nothing pending',
    `ok=${ok} pending=${guard.isSignOutPending()} signOuts=${state.signOuts}`);
}

{
  // Offline when they left, online when they came back.
  const { state, guard } = harness({ signOutFails: true });
  await guard.onAppStateChange('background', 'ready');
  record(guard.isSignOutPending(), 'offline: the session is still live after abandoning',
    `pending=${guard.isSignOutPending()}`);

  state.signOutFails = false;
  await guard.onAppStateChange('active', 'invalid');
  record(!guard.isSignOutPending() && state.signOuts === 2,
    'coming back online retries the sign-out',
    `pending=${guard.isSignOutPending()} signOuts=${state.signOuts}`);
}

{
  // No retry storm when there was nothing pending.
  const { state, guard } = harness();
  await guard.onAppStateChange('active', 'ready');
  record(state.signOuts === 0, 'foreground with nothing pending does not sign out',
    `signOuts=${state.signOuts}`);
}

// ---------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
