#!/usr/bin/env node
/**
 * check-auth-error-messages.mjs - the corpus behind MEXA-338 finding 11.
 *
 * Offline: no Supabase, no credentials, no network. It transpiles
 * `src/lib/auth/authErrorMessage.ts` in memory (pure TypeScript, no imports at all) and
 * runs real GoTrue message strings through it. Pure JS, so a pass here is a pass on device.
 *
 *   node scripts/check-auth-error-messages.mjs        # one line per failure, exit 1 on any
 *   node scripts/check-auth-error-messages.mjs -v     # also print every passing case
 *
 * Why it exists: signing up with an address that cannot receive mail returned HTTP 500 and
 * the form showed GoTrue's own "Error sending confirmation email". GoTrue also rolls the
 * account back, so a tester who fat-fingers a domain got a server-sounding error and no
 * account.
 *
 * The exact string matters, because a mapping that does not match degrades silently back to
 * the old behaviour. Re-measured against `tayiyczmacvhokdxfqvm` on 2026-09-29 with an
 * `@example.com` address (no MX):
 *
 *     status 500, code `unexpected_failure`, message "Error sending confirmation email"
 *     data.user null, data.session none, no account left in auth.users
 *
 * That send cost nothing out of the shared Resend bucket — the daily count was 17 before
 * and 17 after, because Resend rejects an unroutable recipient before accepting it.
 *
 * The three properties worth guarding, beyond the wording:
 *
 *   - an **unrecognised** message is passed through unchanged, so a cause nobody
 *     anticipated is never rewritten into "something went wrong";
 *   - `only` is honoured, so a signup message cannot be shown on the login form; and
 *   - nothing in the sign-in copy distinguishes a wrong password from an unknown address,
 *     which would make the login form a way to enumerate who is on a dating app.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SOURCE = path.join(ROOT, 'src', 'lib', 'auth', 'authErrorMessage.ts');
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

/** Screens that must go through the mapping rather than showing `error.message`. */
const CALL_SITES = [
  ['app/(auth)/register.tsx', 'signUp'],
  ['app/(auth)/login.tsx', 'signIn'],
  ['app/(auth)/forgot-password.tsx', 'resetPassword'],
];

/**
 * [operation, GoTrue's message, what a substring of the answer must be].
 * The strings on the left are the ones GoTrue actually returns.
 */
const CASES = [
  // The finding. A domain with no MX record.
  ['signUp', 'Error sending confirmation email', "couldn't send a confirmation email"],
  ['signUp', 'Error sending confirmation email', "wasn't created"],
  ['signUp', 'Error sending confirmation email', 'Check the spelling'],
  ['signUp', 'Error sending signup email', "couldn't send a confirmation email"],
  ['resetPassword', 'Error sending recovery email', "couldn't send a reset email"],

  // The shared 100/day Resend bucket (TEAM_BOARD, MEXA-304) is a realistic tester hit.
  ['signUp', 'email rate limit exceeded', 'Too many emails'],
  ['signUp', 'email rate limit exceeded', 'nothing is wrong with your account'],
  ['signIn', 'over_email_send_rate_limit', 'Too many emails'],

  // GoTrue's per-address throttle names the wait; the mapping has to keep the number.
  ['signUp', 'For security purposes, you can only request this after 47 seconds', 'wait 47 seconds'],
  ['resetPassword', 'For security purposes, you can only request this after 9 seconds', 'wait 9 seconds'],

  ['signUp', 'User already registered', 'already has a Mazal account'],
  ['signIn', 'Invalid login credentials', 'do not match'],
  ['signIn', 'Email not confirmed', 'confirm your email first'],
  ['signUp', 'Password should be at least 6 characters', 'longer password'],
  ['signUp', 'Unable to validate email address: invalid format', 'does not look like an email'],
  ['signIn', 'Network request failed', 'could not reach Mazal'],
];

/** Messages the mapping must NOT touch. Rewriting these would hide a real cause. */
const PASSED_THROUGH = [
  ['signIn', 'Database error granting user'],
  ['signUp', 'Signups not allowed for this instance'],
  ['signUp', 'anonymous sign-ins are disabled'],
  ['signIn', 'Invalid Refresh Token: Refresh Token Not Found'],
  ['resetPassword', 'User not found'],
  ['signIn', 'captcha protection: request disallowed'],
  ['signUp', 'some brand new error nobody has seen yet'],
];

/** A message scoped to one operation must not leak into another. */
const WRONG_OPERATION = [
  ['signIn', 'Error sending confirmation email'],
  ['signIn', 'User already registered'],
  ['signUp', 'Invalid login credentials'],
  ['signUp', 'Email not confirmed'],
  ['resetPassword', 'Error sending confirmation email'],
];

async function load() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: SOURCE,
  }).outputText;
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mazal-autherr-')), 'm.mjs');
  fs.writeFileSync(tmp, js);
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }
}

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

const { authErrorMessage } = await load();

console.log(`auth error copy: ${SOURCE}\n`);

console.log(`known failures get copy a tester can act on (${CASES.length} cases)`);
for (const [op, raw, want] of CASES) {
  const got = authErrorMessage(raw, op);
  record(got.includes(want), `${op}: ${JSON.stringify(raw)} -> contains ${JSON.stringify(want)}`, `got ${JSON.stringify(got)}`);
  // It has to actually differ from GoTrue's text, or nothing was gained.
  record(got !== raw, `${op}: ${JSON.stringify(raw)} was rewritten`, `got ${JSON.stringify(got)}`);
}

console.log(`\nunrecognised messages pass through unchanged (${PASSED_THROUGH.length} cases)`);
for (const [op, raw] of PASSED_THROUGH) {
  const got = authErrorMessage(raw, op);
  record(got === raw, `${op}: ${JSON.stringify(raw)} is untouched`, `got ${JSON.stringify(got)}`);
}

console.log(`\noperation scoping is honoured (${WRONG_OPERATION.length} cases)`);
for (const [op, raw] of WRONG_OPERATION) {
  const got = authErrorMessage(raw, op);
  record(got === raw, `${op} does not claim ${JSON.stringify(raw)}`, `got ${JSON.stringify(got)}`);
}

console.log('\nan empty or missing message still says something');
for (const empty of [undefined, null, '', '   ']) {
  const got = authErrorMessage(empty, 'signUp');
  record(
    got === 'Something went wrong. Please try again.',
    `authErrorMessage(${JSON.stringify(empty)}) has a fallback`,
    `got ${JSON.stringify(got)}`
  );
}

console.log('\nthe sign-in copy does not say whether the address has an account');
const credentials = authErrorMessage('Invalid login credentials', 'signIn');
for (const leak of ['no account', 'not found', 'does not exist', 'unknown', 'wrong password', 'incorrect password']) {
  record(
    !credentials.toLowerCase().includes(leak),
    `sign-in copy avoids ${JSON.stringify(leak)}`,
    `copy is ${JSON.stringify(credentials)}`
  );
}

console.log(`\nthe screens go through it (${CALL_SITES.length} files)`);
for (const [rel, op] of CALL_SITES) {
  const file = path.join(ROOT, rel);
  const exists = fs.existsSync(file);
  record(exists, `${rel} exists`);
  if (!exists) continue;
  const text = fs.readFileSync(file, 'utf8');
  record(
    new RegExp(`authErrorMessage\\([^)]*'${op}'\\)`).test(text),
    `${rel} calls authErrorMessage(..., '${op}')`
  );
  // The defect itself: handing GoTrue's text straight to the user.
  record(
    !/setError\((?:authError|resetError|error)\.message\)/.test(text),
    `${rel} no longer shows a raw GoTrue message`
  );
}

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
