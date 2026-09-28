/**
 * Verify PKCE on the live Supabase project (MEXA-264, fix 1).
 *
 * `docs/AUTH_DEEP_LINKS.md` verifies the `uri_allow_list` with the admin
 * `generate_link` trick. That trick CANNOT prove PKCE. GoTrue decides
 * implicit-vs-PKCE at `/auth/v1/verify` time by looking for a *flow state* row
 * for the user, and only the public endpoints (`/recover`, `/signup`,
 * `/authorize`) create one. `generate_link` accepts `code_challenge` and
 * silently ignores it, so an admin-minted link always redirects implicit —
 * measured: two `generate_link` calls for the same recovery, one with
 * `code_challenge` and one without, both came back `#access_token=...`.
 *
 * So this drives the real client path end to end, through a real mailbox:
 *
 *   1. admin-create a throwaway confirmed user at MAZAL_TEST_EMAIL (a mailbox we
 *      can read; `email_confirm` means no confirmation mail is sent)
 *   2. client A (`flowType: 'pkce'`, its own storage) calls
 *      resetPasswordForEmail(), which POSTs `/recover` with a `code_challenge`
 *      and stashes the `code_verifier` in A's storage. That call is what creates
 *      the flow state.
 *   3. read the delivered email, take the ConfirmationURL out of it, and follow
 *      it with redirects off: the `location:` must be `?code=`, not
 *      `#access_token=`.
 *   4. client B (fresh storage — "another device") exchanges that code: must
 *      FAIL, because the verifier only exists on A.
 *   5. client A exchanges the same code: must SUCCEED.
 *
 * Steps 4 then 5 in that order are the whole point — the code alone is worthless,
 * the verifier is what redeems it.
 *
 * Usage (creds live outside the repo):
 *   set -a && . <workspace>/archive/credentials/mazal-supabase.env
 *          && . <workspace>/archive/credentials/mexant-agentmail.env && set +a
 *   MAZAL_TEST_EMAIL='<an agentmail inbox>' node scripts/verify-pkce-auth-links.mjs
 *
 * It sends one real recovery email and deletes the user it made.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = process.env.MAZAL_TEST_EMAIL;
const AGENTMAIL_KEY = process.env.AGENTMAIL_API_KEY;
const REDIRECT = 'mazal://auth/reset-password';

for (const [name, value] of Object.entries({
  SUPABASE_URL,
  SUPABASE_ANON_KEY: ANON,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE,
  MAZAL_TEST_EMAIL: TEST_EMAIL,
  AGENTMAIL_API_KEY: AGENTMAIL_KEY,
})) {
  if (!value) {
    console.error(`missing ${name}`);
    process.exit(2);
  }
}

/** `user+tag@host` all lands in inbox `user@host`. */
const INBOX = TEST_EMAIL.replace(/\+[^@]*(?=@)/, '');

/** In-memory storage, one per "device". */
function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: async (k) => (map.has(k) ? map.get(k) : null),
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
  };
}

/** The auth options from src/api/supabase/client.ts, minus the RN-only bits. */
function pkceClient(storage) {
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

const agentmail = (path) =>
  fetch(`https://api.agentmail.to/v0${path}`, {
    headers: { Authorization: `Bearer ${AGENTMAIL_KEY}`, 'User-Agent': 'mazal-auth-verify/1.0' },
  }).then((r) => r.json());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Wait for a recovery email newer than `since` and return its verify URL. */
async function waitForRecoveryLink(since, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { messages = [] } = await agentmail(
      `/inboxes/${encodeURIComponent(INBOX)}/messages?limit=10`
    );

    for (const summary of messages) {
      if (new Date(summary.timestamp).getTime() < since) continue;
      if (!/reset your password/i.test(summary.subject ?? '')) continue;

      const full = await agentmail(
        `/inboxes/${encodeURIComponent(INBOX)}/messages/${encodeURIComponent(summary.message_id)}`
      );
      const body = [full.html, full.text, full.extracted_text].filter(Boolean).join('\n');
      const match = body.match(/https:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/);
      if (match) return match[0].replace(/&amp;/g, '&');
    }

    await sleep(5_000);
  }

  return null;
}

let userId = null;

try {
  // 1. Throwaway confirmed user. `email_confirm` skips the confirmation email.
  const created = await admin('/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: `pk-${Math.random().toString(36).slice(2)}-Aa1!`,
      email_confirm: true,
    }),
  }).then((r) => r.json());
  userId = created.id;
  if (!userId) throw new Error(`could not create user: ${JSON.stringify(created)}`);
  console.log(`\nuser ${TEST_EMAIL} (${userId}), inbox ${INBOX}\n`);

  // 2. Device A asks for the reset. `/recover` is rate limited per address, so
  //    retry on 429 rather than failing the run.
  const storageA = memoryStorage();
  const clientA = pkceClient(storageA);
  const sentAfter = Date.now() - 60_000; // clock skew between us and SES

  // The project has no custom SMTP, so the built-in sender allows
  // `rate_limit_email_sent` = 2 auth emails an hour for the whole project. That
  // is easily already spent, and the window is rolling, so be patient rather than
  // failing the run.
  const MAX_ATTEMPTS = 12;
  for (let attempt = 1; ; attempt += 1) {
    const { error } = await clientA.auth.resetPasswordForEmail(TEST_EMAIL, {
      redirectTo: REDIRECT,
    });
    if (!error) break;
    console.log(
      `  [${new Date().toISOString()}] /recover attempt ${attempt}: ${error.status} ${error.message}`
    );
    const retryable = error.status === 429 || /rate limit/i.test(error.message);
    if (!retryable || attempt === MAX_ATTEMPTS) throw new Error(`/recover failed: ${error.message}`);
    await sleep(/rate limit exceeded/i.test(error.message) ? 300_000 : 35_000);
  }

  const verifierKeys = [...storageA.map.keys()].filter((k) => k.endsWith('-code-verifier'));
  check(
    'resetPasswordForEmail stored a code_verifier on device A',
    verifierKeys.length === 1,
    verifierKeys[0] ?? `keys=${[...storageA.map.keys()].join(',') || 'none'}`
  );

  // 3. The link as the user actually receives it.
  const verifyUrl = await waitForRecoveryLink(sentAfter);
  if (!verifyUrl) throw new Error('no recovery email arrived within 120s');

  const res = await fetch(verifyUrl, { redirect: 'manual' });
  const location = res.headers.get('location') ?? '';
  const shape = location.includes('#access_token=')
    ? 'implicit (#access_token)'
    : /[?&]code=/.test(location)
      ? 'pkce (?code)'
      : `neither (${res.status})`;
  check(
    'the emailed link redirects with ?code=, not #access_token',
    shape === 'pkce (?code)',
    `${shape}: ${location.slice(0, 120)}`
  );

  const code = new URL(location.replace('mazal://', 'https://mazal.invalid/')).searchParams.get(
    'code'
  );
  if (!code) throw new Error('no ?code in the redirect; cannot test the exchange');

  // 4. Another device has the code but not the verifier.
  const clientB = pkceClient(memoryStorage());
  const b = await clientB.auth.exchangeCodeForSession(code);
  check(
    'a code copied to another device does NOT exchange',
    !!b.error && !b.data?.session,
    b.error ? `${b.error.status} ${b.error.message}` : 'it exchanged — PKCE is not binding'
  );

  // 5. The originating device still redeems it.
  const a = await clientA.auth.exchangeCodeForSession(code);
  check(
    'the originating device DOES exchange the same code',
    !a.error && !!a.data?.session,
    a.error ? `${a.error.status} ${a.error.message}` : `session for ${a.data.user?.email}`
  );
} finally {
  if (userId) {
    const del = await admin(`/admin/users/${userId}`, { method: 'DELETE' });
    console.log(`\ncleanup: deleted ${userId} -> ${del.status}`);
  }
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
