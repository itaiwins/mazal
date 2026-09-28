/**
 * Verify PKCE on the live Supabase project (MEXA-264).
 *
 * Run after any change to the client's auth options in src/api/supabase/client.ts.
 * Creates and deletes its own throwaway users. Tries to send one email and works
 * fine when it can't.
 *
 * ## Do not try to prove this with `generate_link`
 *
 * `docs/AUTH_DEEP_LINKS.md` verifies the `uri_allow_list` with the admin
 * `generate_link` trick. That trick cannot prove the flow type, and the reason is
 * worth writing down because it is not guessable (all of this measured against
 * `tayiyczmacvhokdxfqvm`):
 *
 *  - `generate_link` accepts `code_challenge` / `code_challenge_method` and
 *    **silently ignores** them. Two recovery links for the same user, one with and
 *    one without, redirect identically.
 *  - GoTrue marks a link as PKCE by writing `auth.users.recovery_token` with a
 *    literal **`pkce_` prefix**, and `/verify` keys off that. `generate_link`
 *    writes an unprefixed token, so its link is always implicit. Prepending
 *    `pkce_` to the hash it returns does not work either — the lookup includes the
 *    prefix, so it just 404s as `otp_expired`.
 *  - Only `/recover`, `/signup` and `/authorize` write a prefixed token, and
 *    `/recover` only gets that far if the **email actually sends**.
 *
 * `smtp_host` is null on this project, which pins `rate_limit_email_sent` to 2 per
 * hour for the whole project (MEXA-249), so `/recover` 429s much of the time. Two
 * consequences:
 *
 *  - The `?code=` assertion below is skipped when there is no email budget. It is
 *    the *shape* check; it is not the security property.
 *  - `/recover` creates the `auth.flow_state` row **before** it tries to send, so a
 *    429 leaves a flow state with `auth_code` and `code_challenge` set but
 *    `recovery_token` empty — orphaned, unreachable by any link. That is what lets
 *    the binding checks below run with no email at all: they take `auth_code`
 *    straight out of `auth.flow_state`, which is byte-for-byte the `?code=` a real
 *    link would have carried.
 *
 * ## What it asserts
 *
 *   binding   a code has no value without the verifier (the security property)
 *             - device B, holding the code, cannot exchange it
 *             - device A, which started the flow, can
 *   control   no flow state -> /verify redirects `#access_token=` (implicit)
 *   shape     with a real emailed link -> /verify redirects `?code=`
 *             (skipped when the email budget is spent)
 *
 * ## Usage
 *
 *   set -a && . <workspace>/archive/credentials/mazal-supabase.env
 *          && . <workspace>/archive/credentials/mexant-supabase.env && set +a
 *   node scripts/verify-pkce-auth-links.mjs
 *
 * `mexant-supabase.env` is only for `SUPABASE_ACCESS_TOKEN`, used to read
 * `auth.flow_state` (there is no REST route to it).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MGMT = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
const REDIRECT = 'mazal://auth/reset-password';

for (const [name, value] of Object.entries({
  SUPABASE_URL,
  SUPABASE_ANON_KEY: ANON,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE,
  SUPABASE_ACCESS_TOKEN: MGMT,
  SUPABASE_PROJECT_REF: REF,
})) {
  if (!value) {
    console.error(`missing ${name}`);
    process.exit(2);
  }
}

/** supabase-js derives this from the project ref. */
const VERIFIER_KEY = `sb-${REF}-auth-token-code-verifier`;

/**
 * In-memory storage for one "device". `written` also keeps values that were later
 * removed: supabase-js deletes the verifier when `/recover` errors
 * (GoTrueClient `resetPasswordForEmail`, the catch block), and a 429 from the
 * mailer is such an error even though the flow state survives server-side. Putting
 * it back is what a device whose email *did* send would have had.
 */
function memoryStorage() {
  const live = new Map();
  const written = new Map();
  return {
    live,
    written,
    getItem: async (k) => (live.has(k) ? live.get(k) : null),
    setItem: async (k, v) => {
      live.set(k, v);
      written.set(k, v);
    },
    removeItem: async (k) => void live.delete(k),
  };
}

/** The auth options from src/api/supabase/client.ts, minus the RN-only bits. */
function appClient(storage) {
  return createClient(SUPABASE_URL, ANON, {
    auth: {
      storage,
      flowType: 'pkce',
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

const admin = (path, init = {}) =>
  fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

const sql = async (query) =>
  (
    await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${MGMT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
  ).json();

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        ${detail}` : ''}`);
}
function skip(name, why) {
  console.log(`SKIP  ${name}\n        ${why}`);
}

const createdUsers = [];

async function throwawayUser(tag) {
  // example.com is fine for admin-created users — the admin API skips the
  // deliverability check that `/recover` applies (it 400s on an MX-less domain).
  const email = `violet-pkce-${tag}-${Date.now()}@example.com`;
  const user = await admin('/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password: `pk-${Math.random().toString(36).slice(2)}-Aa1!`, email_confirm: true }),
  }).then((r) => r.json());

  if (!user.id) throw new Error(`could not create user: ${JSON.stringify(user)}`);
  createdUsers.push(user.id);
  return { id: user.id, email };
}

/** `mazal://` is not hierarchical, so swap the scheme before parsing. */
function paramsOf(location) {
  const url = new URL(location.replace('mazal://', 'https://mazal.invalid/'));
  const params = new URLSearchParams(url.search);
  // Under PKCE, GoTrue reports errors in the query AND the fragment; implicit puts
  // everything in the fragment. Read both.
  for (const [k, v] of new URLSearchParams(url.hash.replace(/^#/, ''))) params.set(k, v);
  return params;
}

function shapeOf(location) {
  if (location.includes('#access_token=')) return 'implicit';
  if (/[?&]code=/.test(location)) return 'pkce';
  if (/error/.test(location)) return 'error';
  return 'neither';
}

try {
  // ---------------------------------------------------------------- binding
  const subject = await throwawayUser('binding');
  const storageA = memoryStorage();
  const clientA = appClient(storageA);

  const { error: recoverError } = await clientA.auth.resetPasswordForEmail(subject.email, {
    redirectTo: REDIRECT,
  });
  const mailerRefused =
    !!recoverError && (recoverError.status === 429 || /rate limit/i.test(recoverError.message));

  check(
    'resetPasswordForEmail generated a code_verifier on device A',
    storageA.written.has(VERIFIER_KEY),
    VERIFIER_KEY
  );

  if (recoverError) {
    console.log(
      `  note: /recover returned ${recoverError.status} "${recoverError.message}"` +
        (mailerRefused
          ? ' — the mailer, not the flow state; see the header'
          : ' — NOT the mailer, the flow state may be missing')
    );
    // Undo supabase-js's cleanup: the flow state is still there server-side.
    if (storageA.written.has(VERIFIER_KEY)) {
      await storageA.setItem(VERIFIER_KEY, storageA.written.get(VERIFIER_KEY));
    }
  }

  const [flow] = await sql(
    `select auth_code, code_challenge_method, authentication_method
       from auth.flow_state where user_id = '${subject.id}'`
  );
  check(
    'the client created a PKCE flow state server-side',
    flow?.authentication_method === 'recovery' && flow?.code_challenge_method === 's256',
    flow ? `${flow.authentication_method} / ${flow.code_challenge_method}` : 'no flow_state row'
  );
  if (!flow?.auth_code) throw new Error('no auth_code to exchange');

  // This code is byte-for-byte what a real link's `?code=` carries.
  const b = await appClient(memoryStorage()).auth.exchangeCodeForSession(flow.auth_code);
  check(
    'device B, holding the code but not the verifier, canNOT exchange it',
    !!b.error && !b.data?.session,
    b.error
      ? `${b.error.status} ${b.error.code ?? ''} — ${b.error.message.split('.')[0]}`
      : 'it exchanged — PKCE is not binding'
  );

  const a = await clientA.auth.exchangeCodeForSession(flow.auth_code);
  check(
    'device A, which started the flow, DOES exchange the same code',
    !a.error && !!a.data?.session,
    a.error ? `${a.error.status} ${a.error.message}` : `session for ${a.data.user?.email}`
  );

  // ---------------------------------------------------------------- control
  const control = await throwawayUser('control');
  const controlLink = await admin('/admin/generate_link', {
    method: 'POST',
    body: JSON.stringify({
      type: 'recovery',
      email: control.email,
      redirect_to: REDIRECT,
      // Supplied on purpose, expected to make no difference.
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 's256',
    }),
  }).then((r) => r.json());
  const controlLocation =
    (await fetch(controlLink.action_link, { redirect: 'manual' })).headers.get('location') ?? '';
  check(
    'control: no flow state -> implicit, even with generate_link given a code_challenge',
    shapeOf(controlLocation) === 'implicit',
    `${shapeOf(controlLocation)}: ${controlLocation.slice(0, 80)}…`
  );

  // ------------------------------------------------------------------ shape
  // Only a `/recover` whose email really sent writes the `pkce_`-prefixed
  // recovery token that makes `/verify` take the PKCE branch, so this needs a
  // budget slot. Ask for the token straight out of auth.users rather than
  // scraping a mailbox — same value the email's ConfirmationURL carries.
  if (mailerRefused) {
    skip(
      'the link redirects with ?code=, not #access_token',
      'no email budget: `/recover` 429d, so no pkce_-prefixed recovery token exists to follow. ' +
        'Re-run when rate_limit_email_sent has room, or after custom SMTP lands (MEXA-249).'
    );
  } else {
    const [row] = await sql(
      `select recovery_token from auth.users where id = '${subject.id}'`
    );
    const token = row?.recovery_token ?? '';
    const location =
      (
        await fetch(
          `${SUPABASE_URL}/auth/v1/verify?token=${encodeURIComponent(token)}` +
            `&type=recovery&redirect_to=${encodeURIComponent(REDIRECT)}`,
          { redirect: 'manual' }
        )
      ).headers.get('location') ?? '';
    check(
      'the link redirects with ?code=, not #access_token',
      shapeOf(location) === 'pkce',
      `token prefix "${token.slice(0, 5)}" -> ${shapeOf(location)}: ${location.slice(0, 100)}`
    );
    // app/auth/confirm.tsx reads `type` off the link, so record whether it survives.
    console.log(`  link params: ${[...paramsOf(location).keys()].join(', ') || 'none'}`);
  }
} finally {
  for (const id of createdUsers) {
    const res = await admin(`/admin/users/${id}`, { method: 'DELETE' });
    console.log(`cleanup: deleted ${id} -> ${res.status}`);
  }
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
