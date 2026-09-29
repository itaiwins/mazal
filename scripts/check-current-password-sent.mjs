#!/usr/bin/env node
/**
 * check-current-password-sent.mjs - guards the MEXA-272 server-side password check.
 *
 * Offline: no Supabase, no credentials, no network. It drives the *real*
 * `@supabase/supabase-js` against a stub `fetch` and a stub storage holding a fake
 * session, then asserts what actually lands in the `PUT /auth/v1/user` body.
 *
 *   node scripts/check-current-password-sent.mjs        # one line per failure, exit 1 on any
 *   node scripts/check-current-password-sent.mjs -v     # also print every passing case
 *
 * ## Why this exists
 *
 * Settings -> Change Password sends `current_password` so that GoTrue itself verifies
 * the old password (`security_update_password_require_current_password`) instead of
 * trusting the client's `signInWithPassword` reauth. `current_password` is **not** in
 * auth-js's `UserAttributes` type; it reaches the wire only because `_updateUser`
 * spreads the attributes into the request body:
 *
 *     body: { ...attributes, code_challenge, code_challenge_method }
 *
 * That is a detail of a dependency we do not control. If a future auth-js switched to
 * an allowlist of known fields, it would drop `current_password` silently: no type
 * error, no runtime error, `tsc` still clean, the screen still reporting success - and
 * the server-side check quietly stops applying. Guts raised exactly this on MEXA-284.
 * A green `tsc` cannot catch it, so this check does.
 *
 * It asserts both halves, because either one alone can rot:
 *   1. the library still puts an untyped extra attribute on the wire, and
 *   2. `app/settings/password.tsx` still passes `current_password` to `updateUser`.
 *
 * Run it after any `@supabase/supabase-js` or `@supabase/auth-js` bump.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCREEN = path.join(HERE, '..', 'app', 'settings', 'password.tsx');
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

const OLD_PASSWORD = 'old-password-for-the-stub';
const NEW_PASSWORD = 'new-password-for-the-stub';

const failures = [];
function check(name, ok, detail) {
  if (ok) {
    if (VERBOSE) console.log(`  ok    ${name}`);
  } else {
    failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

/** A session far enough from expiry that auth-js will not try to refresh it. */
function fakeSession() {
  const user = {
    id: '00000000-0000-4000-8000-000000000000',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'stub@example.com',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return {
    access_token: 'stub-access-token',
    refresh_token: 'stub-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
}

/**
 * Run one `updateUser` call against a stub fetch and hand back what it sent.
 * Nothing leaves the process: every request is answered from here.
 */
async function captureUpdateUserRequest(attributes) {
  const requests = [];
  const storageKey = 'check-current-password-sent';
  const store = new Map([[storageKey, JSON.stringify(fakeSession())]]);

  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };

  const stubFetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    let body = null;
    if (typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    requests.push({ url: String(url), method, body });

    // Answer every auth call locally so the check needs no network.
    const session = fakeSession();
    const payload = String(url).includes('/auth/v1/user') && method === 'PUT'
      ? session.user
      : { ...session };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const supabase = createClient('https://stub.supabase.co', 'stub-anon-key', {
    auth: {
      storage,
      storageKey,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      // Match the app: src/api/supabase/client.ts sets flowType 'pkce' (MEXA-264).
      flowType: 'pkce',
    },
    global: { fetch: stubFetch },
  });

  const { error } = await supabase.auth.updateUser(attributes);
  const put = requests.find((r) => r.url.endsWith('/auth/v1/user') && r.method === 'PUT');
  return { put, error, requests };
}

async function main() {
  console.log('check-current-password-sent (offline)\n');

  // 1. The library contract: an attribute auth-js does not type still reaches the wire.
  const { put, error } = await captureUpdateUserRequest({
    password: NEW_PASSWORD,
    current_password: OLD_PASSWORD,
  });

  check('updateUser issues a PUT /auth/v1/user', Boolean(put),
    put ? '' : 'no PUT to /auth/v1/user was captured');

  if (put) {
    check('updateUser reported no error', !error, error ? `${error.code} ${error.message}` : '');
    check('body carries `password`', put.body?.password === NEW_PASSWORD,
      `got ${JSON.stringify(put.body?.password)}`);
    check(
      'body carries `current_password` (auth-js still spreads untyped attributes)',
      put.body?.current_password === OLD_PASSWORD,
      put.body && 'current_password' in put.body
        ? `present but wrong value: ${JSON.stringify(put.body.current_password)}`
        : `DROPPED by auth-js - body keys: ${Object.keys(put.body ?? {}).sort().join(', ')}`
    );
  }

  // 2. Control: the check would notice the field going missing. If auth-js ever
  //    invented a `current_password` of its own, case 1 could pass while the screen
  //    had stopped sending one, so pin the omitted case too.
  const omitted = await captureUpdateUserRequest({ password: NEW_PASSWORD });
  check(
    'control: omitting it really does leave it out of the body',
    omitted.put ? !('current_password' in (omitted.put.body ?? {})) : false,
    'auth-js added a current_password we did not pass - case 1 above is no longer meaningful'
  );

  // 3. The call site: the screen still passes the field.
  const source = fs.readFileSync(SCREEN, 'utf8');
  const callSite = /updateUser\(\{[^}]*current_password\s*:/s.test(source);
  check(
    'app/settings/password.tsx passes current_password to updateUser',
    callSite,
    'the screen no longer sends it, so the server-side check cannot apply'
  );

  console.log();
  if (failures.length) {
    console.log(`${failures.length} failure(s):`);
    for (const f of failures) console.log(`  - ${f}`);
    console.log('\nSee MEXA-272. If auth-js stopped spreading unknown attributes, send');
    console.log('current_password explicitly rather than relying on the spread.');
    process.exit(1);
  }
  console.log('all checks passed - current_password reaches GoTrue');
}

main().catch((err) => {
  console.error('check crashed:', err);
  process.exit(1);
});
