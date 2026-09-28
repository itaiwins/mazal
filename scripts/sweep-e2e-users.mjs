#!/usr/bin/env node
/**
 * Delete the test accounts an e2e run left in auth.users.  (MEXA-280)
 *
 * WHY THIS EXISTS
 *
 * Mazal has one Supabase project, so every end-to-end check runs against the live
 * auth server the app will ship against. On 2026-09-28 two runs of one auth suite
 * took `auth.users` from 3 rows to 17 and nothing removed them. That is bad in three
 * ways, in order: an agent using the row count as a before/after control on this
 * database gets a false signal; the rows accumulate without bound; and they are
 * usable sign-ins on the project TestFlight will point at, not inert records.
 *
 * A suite should clean up after itself - see scripts/e2e/mexa272-password-cases.py
 * for the shape - and this script is the backstop for when one doesn't, plus the
 * "clear test state first" step before verifying anything against live.
 *
 *   node scripts/sweep-e2e-users.mjs              # dry run, lists what it would delete
 *   node scripts/sweep-e2e-users.mjs --apply      # actually deletes
 *   node scripts/sweep-e2e-users.mjs --json       # machine-readable, for a before/after control
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment. Both are in
 * archive/credentials/mazal-supabase.env in the workspace; never paste either into a
 * commit or an issue comment.
 *
 *   set -a; . /path/to/mazal-supabase.env; set +a
 *   node scripts/sweep-e2e-users.mjs --apply
 *
 * THE NAMING RULE THIS ENFORCES
 *
 * A test fixture account's email must look like `e2e-<something>@example.com`, or
 * `<agent>-e2e-<something>@example.com`. Both halves are load-bearing: the `e2e-`
 * label is what this script matches on, and `@example.com` is a domain RFC 2606
 * reserves for exactly this, so it can never be a real person's address. An account
 * that misses either half is left alone, on purpose - the cost of this script
 * deleting a real user is much higher than the cost of one stray fixture surviving.
 */

const DRY_RUN = !process.argv.includes('--apply');
const AS_JSON = process.argv.includes('--json');

// `e2e-foo@` or `violet-e2e-foo@`: the label is either at the start or after one
// dash-separated prefix. Anchored at both ends so `not-e2e-ish@gmail.com.evil.com`
// does not match.
const E2E_EMAIL = /^(?:[a-z0-9]+-)?e2e-[a-z0-9-]+@example\.com$/i;

const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !serviceKey) {
  console.error('error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  console.error('       source archive/credentials/mazal-supabase.env first.');
  process.exit(2);
}

async function admin(method, path, body) {
  const res = await fetch(url + path, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text.slice(0, 300) };
    }
  }
  return { status: res.status, body: parsed };
}

/** Every row in auth.users, following GoTrue's admin pagination to the end. */
async function listAllUsers() {
  const users = [];
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { status, body } = await admin('GET', `/auth/v1/admin/users?page=${page}&per_page=${perPage}`);
    if (status !== 200) {
      throw new Error(`admin list users failed: http ${status} ${JSON.stringify(body)}`);
    }
    const batch = body?.users ?? [];
    users.push(...batch);
    // GoTrue keeps answering 200 with an empty list past the last page, so stop on a
    // short page rather than trusting a total count we would also have to page past.
    if (batch.length < perPage) return users;
    if (page > 100) throw new Error('refusing to page past 20k users; something is wrong');
  }
}

// An @example.com address that misses the `e2e-` label. Almost certainly a fixture from
// a suite that predates the naming rule - while MEXA-280 was being fixed, a concurrent
// run was creating `own@example.com`, `real.harasser@example.com` and `legit.new@example.com`.
// Reported, never deleted: the whole point of the rule is that this script only removes
// what opted in by name.
const SUSPECT_EMAIL = /@example\.com$/i;

const all = await listAllUsers();
const targets = all.filter((u) => E2E_EMAIL.test(u.email || ''));
const suspects = all.filter((u) => !E2E_EMAIL.test(u.email || '') && SUSPECT_EMAIL.test(u.email || ''));
const kept = all.length - targets.length;

const results = [];
for (const u of targets) {
  if (DRY_RUN) {
    results.push({ email: u.email, id: u.id, deleted: false, dryRun: true });
    continue;
  }
  const { status, body } = await admin('DELETE', `/auth/v1/admin/users/${u.id}`);
  const ok = status === 200 || status === 204 || status === 404;
  results.push({
    email: u.email,
    id: u.id,
    deleted: ok,
    http: status,
    ...(ok ? {} : { error: body }),
  });
}

const failed = results.filter((r) => !DRY_RUN && !r.deleted);

if (AS_JSON) {
  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    authUsersBefore: all.length,
    matched: targets.length,
    nonTestUsersLeftAlone: kept,
    deleted: results.filter((r) => r.deleted).length,
    failed: failed.length,
    results,
    unmatchedExampleComAccounts: suspects.map((u) => ({ email: u.email, id: u.id })),
  }, null, 2));
} else {
  console.log(`auth.users: ${all.length} rows, ${targets.length} match the e2e naming rule, ${kept} left alone.`);
  for (const r of results) {
    const mark = r.dryRun ? 'would delete' : r.deleted ? 'deleted' : `FAILED (http ${r.http})`;
    console.log(`  ${mark.padEnd(22)} ${r.email}  ${r.id}`);
  }
  if (DRY_RUN) console.log('\ndry run - nothing was deleted. Re-run with --apply.');
  else console.log(`\ndeleted ${results.length - failed.length} of ${targets.length}.`);

  if (suspects.length) {
    console.log(`\n${suspects.length} @example.com account(s) do NOT match the naming rule, so they were left alone:`);
    for (const u of suspects) console.log(`  ${u.email}  ${u.id}`);
    console.log('If these are fixtures, rename them to e2e-<what-it-is-for>@example.com (scripts/README.md)');
    console.log('so this sweep can reach them; if one is a real account, leave it and say so on the issue.');
  }
}

// A sweep that silently half-worked is worse than one that didn't run, because the
// next run's before/after control is wrong either way and only the loud one says so.
if (failed.length) process.exit(1);
