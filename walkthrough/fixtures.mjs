#!/usr/bin/env node
/**
 * Walkthrough fixtures on the live project.  (MEXA-328)
 *
 * `tayiyczmacvhokdxfqvm` is Mazal's only Supabase project, so this writes to the same
 * auth server TestFlight will point at. It follows scripts/README.md to the letter:
 * fixed `violet-e2e-*@example.com` addresses, reclaimed at setup, and a teardown that
 * `scripts/sweep-e2e-users.mjs` also matches if this script ever dies mid-run.
 *
 * Two throwaway users, exactly as MEXA-328 asked:
 *   A  violet-e2e-walkthrough-a@example.com  created by the BROWSER, through the real
 *                                            sign-up + onboarding UI. Not created here.
 *   B  violet-e2e-walkthrough-b@example.com  seeded here, so A's deck, likes, match and
 *                                            chat have a real person on the other side.
 *
 *   node walkthrough/fixtures.mjs email-a        # A's address, resolved from AgentMail
 *   node walkthrough/fixtures.mjs count          # auth.users count, for before/after
 *   node walkthrough/fixtures.mjs reclaim        # delete both fixtures + their storage
 *   node walkthrough/fixtures.mjs seed-b         # create B with photo, prompts, badges
 *   node walkthrough/fixtures.mjs confirm-code <email>   # real PKCE code for /auth/confirm
 *   node walkthrough/fixtures.mjs b-likes-a      # B likes A, so A's Likes screen fills
 *   node walkthrough/fixtures.mjs seed-messages  # a short conversation in the match
 *   node walkthrough/fixtures.mjs teardown       # reclaim + report the count
 *
 * Needs archive/credentials/mazal-supabase.env:
 *   set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.');
  console.error('set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a');
  process.exit(2);
}

/**
 * Both fixtures share one password, and it is typed into the real sign-up form, so it
 * cannot live in an env var the browser never sees. It is a throwaway: both accounts are
 * deleted by `teardown` at the end of every run, and neither is ever a real person.
 */
export const PASSWORD = process.env.WALKTHROUGH_PASSWORD || 'Mazal-Walkthrough-328!';

/**
 * A is NOT `@example.com`, and that is deliberate.
 *
 * scripts/README.md wants fixtures on `@example.com` so `sweep-e2e-users.mjs` can match
 * them. But `example.com` (RFC 2606) has no MX record, so Resend cannot deliver to it and
 * GoTrue's `/signup` returns 500 "Error sending confirmation email" and rolls the user
 * back - measured on this project, 2026-09-29. So an `@example.com` address can never be
 * created through the real sign-up screen, only through `admin.createUser`, which is why
 * every other e2e suite here does it that way.
 *
 * MEXA-328 needs the opposite: the sign-up, the confirmation email and the link inside it
 * have to be the real ones, because that is the first thing a TestFlight tester does. So A
 * is a plus-address on the team's AgentMail test mailbox, which has MX and a readable
 * inbox.
 *
 * The address is resolved from the AgentMail API at run time rather than written down,
 * because this repo is public and a real, receivable mailbox does not belong in it.
 *
 * The cost of stepping outside the naming rule is that the sweep will NOT clean A up.
 * `reclaim()` below deletes it by exact address, teardown re-checks the count, and the
 * label is still unmistakably a fixture.
 */
const EMAIL_A_TAG = 'mazal-e2e-walkthrough-a';

let emailACache = null;
export async function emailA() {
  if (emailACache) return emailACache;
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AGENTMAIL_API_KEY is required to resolve the test mailbox.\n' +
        'set -a; . /home/itai/mexant/workspace/archive/credentials/mexant-agentmail.env; set +a'
    );
  }
  const res = await fetch('https://api.agentmail.to/v0/inboxes', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`agentmail inboxes failed: ${res.status} ${await res.text()}`);
  const { inboxes = [] } = await res.json();
  // Stable across runs, so a crashed run's account is reclaimed rather than orphaned.
  const inbox = inboxes.map((i) => i.email || i.inbox_id).filter(Boolean).sort()[0];
  if (!inbox) throw new Error('no AgentMail inbox available');
  const [local, domain] = inbox.split('@');
  emailACache = `${local}+${EMAIL_A_TAG}@${domain}`;
  return emailACache;
}

export const EMAIL_B = 'violet-e2e-walkthrough-b@example.com';

const STATE_FILE = path.join(process.env.PAPERCLIP_RUN_SCRATCH_DIR || '/tmp', 'walkthrough-state.json');

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const readState = () => (fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {});
const writeState = (patch) => {
  const next = { ...readState(), ...patch };
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
  return next;
};

async function listAllUsers() {
  const out = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    out.push(...data.users);
    if (data.users.length < 200) break;
  }
  return out;
}

async function signIn(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: 'pkce' },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { client, authId: data.user.id };
}

/** Storage objects are not cascaded by deleting the auth user, so remove them by hand. */
async function removeStorageFor(authId) {
  const { data, error } = await admin.storage.from('profile-photos').list(authId, { limit: 100 });
  if (error || !data?.length) return 0;
  const paths = data.map((f) => `${authId}/${f.name}`);
  const { error: rmErr } = await admin.storage.from('profile-photos').remove(paths);
  if (rmErr) throw new Error(`storage remove failed: ${rmErr.message}`);
  return paths.length;
}

async function reclaim() {
  const wanted = new Set([await emailA(), EMAIL_B]);
  const users = await listAllUsers();
  let removedUsers = 0;
  let removedFiles = 0;
  for (const u of users) {
    if (!u.email || !wanted.has(u.email.toLowerCase())) continue;
    removedFiles += await removeStorageFor(u.id);
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) throw new Error(`deleteUser(${u.email}) failed: ${error.message}`);
    removedUsers += 1;
  }
  return { removedUsers, removedFiles };
}

/**
 * B's profile. `onboarding_complete` and `is_active` are what put her in A's deck
 * (src/api/queries/useDiscoveryProfiles.ts reads user_public_profiles filtered on both),
 * and `gender_preference` is what lets A's own filters keep her there.
 */
const PROFILE_B = {
  first_name: 'Rivka',
  last_name: 'Testfixture',
  display_name: 'Rivka',
  date_of_birth: '1996-04-11',
  gender: 'female',
  gender_preference: ['male'],
  bio: 'Test fixture for the MEXA-328 walkthrough. Shabbat table regular, terrible at chess, will argue about which bagel place is best.',
  height_cm: 168,
  occupation: 'Speech therapist',
  education: 'Barnard College',
  school: 'Barnard College',
  current_city: 'Brooklyn',
  current_state: 'NY',
  current_country: 'USA',
  current_latitude: 40.6782,
  current_longitude: -73.9442,
  jewish_background: 'modern_orthodox',
  observance_level: 'somewhat_observant',
  keeps_shabbat: 'always',
  keeps_kosher: 'strict',
  synagogue_attendance: 'weekly',
  jewish_education: 'day_school',
  looking_for: 'marriage_minded',
  wants_children: 'yes',
  is_active: true,
  onboarding_complete: true,
};

const PROMPTS_B = [
  { prompt_id: 'shabbat_dinner', answer: 'Loud, too much food, and nobody leaves before midnight.', display_order: 0 },
  { prompt_id: 'green_flag', answer: 'Someone who calls their grandmother without being reminded.', display_order: 1 },
];

/**
 * One photo, uploaded as B through the same bucket and `<auth_id>/<file>` path the app
 * uses (app/(onboarding)/complete.tsx), so the RLS policy on storage.objects is the one
 * actually exercised. The source image is the same Unsplash portrait the app's own demo
 * data already points at (src/lib/demo/demoProfiles.ts).
 */
const PHOTO_SOURCE = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800';

async function seedB() {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL_B,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${EMAIL_B}) failed: ${error.message}`);
  const authId = data.user.id;

  const { data: row, error: rowErr } = await admin
    .from('users')
    .insert({ auth_id: authId, email: EMAIL_B, ...PROFILE_B })
    .select('id')
    .single();
  if (rowErr) throw new Error(`profile insert for B failed: ${rowErr.message}`);
  const userId = row.id;

  const { client } = await signIn(EMAIL_B);

  const res = await fetch(PHOTO_SOURCE);
  if (!res.ok) throw new Error(`photo fetch failed: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const fileName = `${authId}/${Date.now()}_0.jpg`;
  const { error: upErr } = await client.storage
    .from('profile-photos')
    .upload(fileName, bytes, { contentType: 'image/jpeg' });
  if (upErr) throw new Error(`photo upload failed: ${upErr.message}`);
  const photoUrl = `${SUPABASE_URL}/storage/v1/object/public/profile-photos/${fileName}`;

  const { error: photoErr } = await client
    .from('user_photos')
    .insert({ user_id: userId, photo_url: photoUrl, photo_order: 0, is_primary: true });
  if (photoErr) throw new Error(`user_photos insert failed: ${photoErr.message}`);

  const { error: promptErr } = await client
    .from('user_prompts')
    .insert(PROMPTS_B.map((p) => ({ user_id: userId, ...p })));
  if (promptErr) throw new Error(`user_prompts insert failed: ${promptErr.message}`);

  writeState({ b: { email: EMAIL_B, authId, userId, photoUrl } });
  return { authId, userId, photoUrl };
}

/** Look A up by email once the browser has signed her up. */
async function findUser(email) {
  const { data, error } = await admin
    .from('users')
    .select('id, auth_id, first_name, onboarding_complete')
    .eq('email', email)
    .maybeSingle();
  if (error) throw new Error(`user lookup failed: ${error.message}`);
  return data;
}

/**
 * Read the confirmation link out of the email Mazal actually sent, and resolve it to the
 * `?code=` app/auth/confirm.tsx redeems.
 *
 * Nothing here is a shortcut past the product: the link is the one in the inbox, and
 * `/auth/v1/verify` is the hop the user's own tap makes. The code that comes back is
 * still only redeemable by the browser holding the matching `code_verifier` - the one
 * that ran the sign-up - which is the PKCE property MEXA-264 added (see
 * scripts/verify-pkce-auth-links.mjs). This does not bypass it; the same browser
 * redeems it.
 *
 * The only reason this is not a plain "click the link" is that the link points at
 * `mazal://`, a scheme headless Chrome has no handler for.
 */
async function latestConfirmLink(email, { timeoutMs = 120000, since = null } = {}) {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AGENTMAIL_API_KEY is required to read the confirmation email.\n' +
        'set -a; . /home/itai/mexant/workspace/archive/credentials/mexant-agentmail.env; set +a'
    );
  }
  const inbox = email.split('+')[0] + '@' + email.split('@')[1];
  const deadline = Date.now() + timeoutMs;
  const headers = { Authorization: `Bearer ${apiKey}` };

  while (Date.now() < deadline) {
    const res = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages?limit=20`,
      { headers }
    );
    if (!res.ok) throw new Error(`agentmail list failed: ${res.status} ${await res.text()}`);
    const { messages = [] } = await res.json();

    // Newest first, and never older than `since`. A confirmation link is single-use, so
    // picking up the previous run's email hands back a code that is already spent and the
    // screen shows "expired" - which looks exactly like a product bug and is not one.
    const fresh = messages
      .filter((m) => !since || new Date(m.timestamp || m.created_at || 0) >= new Date(since))
      .sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0));

    for (const m of fresh) {
      if (!(m.to || []).some((t) => String(t).toLowerCase().includes(email.toLowerCase()))) continue;
      const full = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages/${m.message_id}`,
        { headers }
      ).then((r) => r.json());
      const body = `${full.text || ''}\n${full.html || ''}`;
      const link = body.match(/https?:\/\/[^\s"'<>]*\/auth\/v1\/verify\?[^\s"'<>]+/);
      if (link) return { link: link[0].replace(/&amp;/g, '&'), subject: full.subject, from: full.from };
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`no confirmation email for ${email} within ${timeoutMs}ms`);
}

async function confirmCode(email, since) {
  const { link, subject, from } = await latestConfirmLink(email, { since });
  const res = await fetch(link, { redirect: 'manual' });
  const location = res.headers.get('location');
  if (!location) throw new Error(`verify returned ${res.status} with no redirect`);
  const code = new URL(location.replace('mazal://', 'https://mazal.invalid/')).searchParams.get('code');
  if (!code) throw new Error(`verify redirected to ${location} with no code (implicit flow?)`);
  return { subject, from, verifyLink: link.slice(0, 80) + '…', redirect: location.split('?')[0], code };
}

/** B likes A, through B's own session, exactly as src/api/mutations/useSwipe.ts writes it. */
async function bLikesA() {
  const A = await emailA();
  const a = await findUser(A);
  if (!a) throw new Error(`${A} has no users row yet - finish onboarding first`);
  const state = readState();
  const { client } = await signIn(EMAIL_B);
  const { error } = await client
    .from('swipes')
    .insert({ swiper_id: state.b.userId, swiped_id: a.id, action: 'like' });
  if (error) throw new Error(`B -> A like failed: ${error.message}`);
  writeState({ a: { email: A, userId: a.id, authId: a.auth_id } });
  return { aUserId: a.id, bUserId: state.b.userId };
}

async function seedMessages() {
  const state = readState();
  if (!state.a || !state.b) throw new Error('run b-likes-a first');
  const [u1, u2] = [state.a.userId, state.b.userId].sort();
  const { data: match, error } = await admin
    .from('matches')
    .select('id')
    .eq('user1_id', u1)
    .eq('user2_id', u2)
    .maybeSingle();
  if (error) throw new Error(`match read failed: ${error.message}`);
  if (!match) throw new Error('no match row - A has not liked B back yet');

  const b = await signIn(EMAIL_B);
  const a = await signIn(await emailA());

  // Alternate senders through their own sessions so the RLS insert policy is what
  // allows each row, and the bubbles land on the right sides of the thread.
  const script = [
    [b, state.b.userId, 'Okay, your prompt about the bagel place. Which one, and are you ready to defend it?'],
    [a, state.a.userId, 'Ess-a-Bagel, and I am not taking questions.'],
    [b, state.b.userId, "Wrong, but confidently wrong, which counts for something. Shabbat in Brooklyn this week?"],
  ];
  for (const [actor, senderId, content] of script) {
    const { error: msgErr } = await actor.client
      .from('messages')
      .insert({ match_id: match.id, sender_id: senderId, content, message_type: 'text' });
    if (msgErr) throw new Error(`message insert failed: ${msgErr.message}`);
    await new Promise((r) => setTimeout(r, 400));
  }
  writeState({ matchId: match.id });
  return { matchId: match.id, messages: script.length };
}

async function count() {
  const users = await listAllUsers();
  return {
    authUsers: users.length,
    emails: users.map((u) => u.email).sort(),
  };
}

const cmd = process.argv[2];
const arg = process.argv[3];

try {
  switch (cmd) {
    case 'email-a':
      console.log(JSON.stringify({ email: await emailA() }, null, 2));
      break;
    case 'count':
      console.log(JSON.stringify(await count(), null, 2));
      break;
    case 'reclaim':
      console.log(JSON.stringify(await reclaim(), null, 2));
      break;
    case 'seed-b':
      console.log(JSON.stringify(await seedB(), null, 2));
      break;
    case 'confirm-code':
      console.log(JSON.stringify(await confirmCode(arg || (await emailA()), process.argv[4]), null, 2));
      break;
    case 'b-likes-a':
      console.log(JSON.stringify(await bLikesA(), null, 2));
      break;
    case 'seed-messages':
      console.log(JSON.stringify(await seedMessages(), null, 2));
      break;
    case 'find':
      console.log(JSON.stringify(await findUser(arg || (await emailA())), null, 2));
      break;
    case 'teardown': {
      const removed = await reclaim();
      const after = await count();
      console.log(JSON.stringify({ ...removed, ...after }, null, 2));
      break;
    }
    default:
      console.error('usage: fixtures.mjs email-a|count|reclaim|seed-b|confirm-code|b-likes-a|seed-messages|find|teardown');
      process.exit(2);
  }
} catch (e) {
  console.error('error:', e.message);
  process.exit(1);
}
