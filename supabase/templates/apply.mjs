#!/usr/bin/env node
/**
 * Push the branded auth emails to the live project, or put the old ones back (MEXA-581).
 *
 *   node supabase/templates/apply.mjs --dry-run    # show what would change, send nothing
 *   node supabase/templates/apply.mjs              # PATCH the six templates + subjects
 *   node supabase/templates/apply.mjs --rollback   # restore rollback/live-before-mexa581.json
 *
 * Needs SUPABASE_ACCESS_TOKEN (archive/credentials/mexant-supabase.env). Uses the Management
 * API rather than `supabase config push`, which would also push every other [auth] key in
 * config.toml and this repo's config.toml does not describe the rest of the live auth config.
 *
 * Only the mailer subject/template keys are sent. The sender (`smtp_admin_email`,
 * noreply@mexantmail.com) and the SMTP settings are not touched. After the PATCH it reads the
 * config back and fails unless every key it sent is now live, byte for byte.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES } from './build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// Pinned, not read from SUPABASE_PROJECT_REF: mexant-supabase.env (where the token lives)
// sets that variable to a different project, so sourcing it would aim this at the wrong one.
const REF = 'tayiyczmacvhokdxfqvm';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run');
const ROLLBACK = process.argv.includes('--rollback');
if (!TOKEN) {
  console.error('missing SUPABASE_ACCESS_TOKEN (archive/credentials/mexant-supabase.env)');
  process.exit(2);
}

function branded() {
  const body = {};
  for (const [name, t] of Object.entries(TEMPLATES)) {
    // config.toml points at these files, so they are what gets sent - but only if they are
    // what build.mjs writes today. A stale file means someone edited one copy, not the other.
    const html = readFileSync(join(HERE, `${name}.html`), 'utf8');
    if (html !== t.html) throw new Error(`${name}.html is stale: run node supabase/templates/build.mjs`);
    body[`mailer_subjects_${name}`] = t.subject;
    body[`mailer_templates_${name}_content`] = html;
  }
  return body;
}

const url = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const readLive = async () => {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET config/auth: ${res.status} ${await res.text()}`);
  return res.json();
};

const body = ROLLBACK ? JSON.parse(readFileSync(join(HERE, 'rollback/live-before-mexa581.json'), 'utf8')) : branded();
const live = await readLive();
const changed = Object.keys(body).filter((k) => live[k] !== body[k]);
console.log(`${ROLLBACK ? 'rollback' : 'apply'}: ${changed.length} of ${Object.keys(body).length} keys differ from live`);
for (const k of changed) console.log(`  ${k}`);
console.log(`sender stays: ${live.smtp_sender_name} <${live.smtp_admin_email}>`);
if (DRY_RUN || changed.length === 0) process.exit(0);

const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
if (!res.ok) {
  console.error(`PATCH config/auth: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const after = await readLive();
const wrong = Object.keys(body).filter((k) => after[k] !== body[k]);
if (wrong.length) {
  console.error(`not live after PATCH: ${wrong.join(', ')}`);
  process.exit(1);
}
if (after.smtp_admin_email !== live.smtp_admin_email) {
  console.error(`sender moved: ${live.smtp_admin_email} -> ${after.smtp_admin_email}`);
  process.exit(1);
}
console.log(`done: all ${Object.keys(body).length} keys read back identical`);
