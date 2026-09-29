#!/usr/bin/env node
/**
 * check-moderation.mjs - the corpus behind MEXA-337.
 *
 * Offline: no Supabase, no credentials, no network. It transpiles
 * `src/lib/moderation/index.ts` in memory (the module is pure TypeScript with no React
 * Native imports) and runs every case below through the two functions the app actually
 * calls - `validateProfileContent` (onboarding prompts) and `validateMessageContent`
 * (chat). Pure JS, so a pass here is a pass on device.
 *
 *   node scripts/check-moderation.mjs          # one line per failure, summary, exit 1 on any
 *   node scripts/check-moderation.mjs -v       # also print every passing case
 *
 * Add a case whenever a real answer gets wrongly rejected. The ALLOWED half is the point:
 * MEXA-337 shipped a filter that blocked "home", "hope", "host", "honestly" and "shtetl".
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, '..', 'src', 'lib', 'moderation', 'index.ts');
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

/** Words and sentences a real Mazal user should be able to type. */
const ALLOWED = [
  // The five the MEXA-328 walkthrough measured as BLOCKED.
  'Friday night dinners at home with my family',
  'I hope to travel more',
  'I host Shabbat most weeks',
  'Honestly? Cholent.',
  'Hockey, hiking and hot soup',
  // ...and the sixth, from `/\b(die|death\s+threat)\b/`.
  'I will die on that hill: pizza over pasta',

  // "ho" words, which the app's own copy is full of.
  'Looking for someone to build a Jewish home with',
  'My favourite holiday is Sukkot, hands down',
  "I'm a homebody who loves hosting",
  'Hoping for a partner who hikes',
  'Hummus, hot sauce and honesty',
  'Lake Tahoe in the winter',

  // Yiddish and Hebrew, which the old `sht` alternative flagged.
  'My grandfather wore a shtreimel',
  'Great shtick at the wedding',
  'My family came from a shtetl outside Vilna',
  'I daven at a small shtiebel',
  'Shiitake mushrooms in the ramen',

  // Words that only looked explicit because of a trailing `\w*`.
  'My grandfather Dick taught me chess',
  'We have a cocker spaniel named Rashi',
  'The tent fabric is flame retardant',
  'Whole Foods runs on Sunday mornings',

  // Interests that are not threats, and idioms that are not threats.
  'I love a good murder mystery podcast',
  'True crime documentaries and hot chocolate',
  "I'll beat you at mini golf",
  "I'm going to shoot you a text later",

  // `(money|cash|$)` used `$` as an anchor, so any message ending in "send" was blocked.
  'Let me know what you want me to send',
  "I'll send a photo of my dog later",
  'Send over your favourite recipe',
];

/** Content that must still be refused. Nothing here is a judgement call. */
const BLOCKED = [
  'fuck this',
  'what the fuuuuck',
  'this is bullshit',
  'she is such a bitch',
  'you absolute asshole',
  'stupid whore',
  'she is a hoe',
  'that is slutty',
  'you dickhead',
  'stop being a dick',
  'you retarded idiot',
  'I watch porn every night',
  'xxx videos',
  'kill yourself',
  'I will kill you',
  'he sent death threats',
  'I am going to hurt you',
  'he raped her',
  'cocaine at the party',
  'send me money',
  'venmo me now',
  'crypto investment opportunity',
];

/** Blocked as personal info rather than as language, so the error names no word. */
const BLOCKED_PERSONAL = ['my SSN is 123-45-6789', 'card 4111 1111 1111 1111'];

/** Allowed, but the user gets a heads-up in chat. */
const WARNED = [
  'text me at 555-123-4567',
  'find me @jewishfoodie',
  'my email is someone@example.com',
  'see https://example.com/me',
];

async function loadModeration() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: SOURCE,
  }).outputText;
  const tmp = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'mazal-moderation-')),
    'moderation.mjs'
  );
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

const mod = await loadModeration();
const { validateProfileContent, validateMessageContent, moderateContent, sanitizeContent } = mod;

console.log(`moderation corpus: ${SOURCE}\n`);

console.log(`clean content must get through (${ALLOWED.length} cases)`);
for (const text of ALLOWED) {
  const profile = validateProfileContent(text);
  const message = validateMessageContent(text);
  const flagged = moderateContent(text).flaggedPatterns;
  record(
    profile.isValid && message.isValid,
    `allow: ${JSON.stringify(text)}`,
    profile.isValid && message.isValid ? '' : `flagged ${JSON.stringify(flagged)}`
  );
  record(
    sanitizeContent(text) === text,
    `unchanged: ${JSON.stringify(text)}`,
    sanitizeContent(text) === text ? '' : `became ${JSON.stringify(sanitizeContent(text))}`
  );
}

console.log(`\nexplicit and unsafe content must be refused (${BLOCKED.length} cases)`);
for (const text of BLOCKED) {
  const profile = validateProfileContent(text);
  const message = validateMessageContent(text);
  record(
    !profile.isValid && !message.isValid,
    `block: ${JSON.stringify(text)}`,
    !profile.isValid && !message.isValid
      ? ''
      : `profile=${profile.isValid ? 'allowed' : 'blocked'} message=${message.isValid ? 'allowed' : 'blocked'}`
  );
  // The error has to name what tripped, or the user cannot fix it (MEXA-337).
  const error = profile.error || '';
  record(
    /[“"]/.test(error),
    `names the term: ${JSON.stringify(text)}`,
    `error=${JSON.stringify(error)}`
  );
}

console.log(`\npersonal info must be refused (${BLOCKED_PERSONAL.length} cases)`);
for (const text of BLOCKED_PERSONAL) {
  const profile = validateProfileContent(text);
  const message = validateMessageContent(text);
  record(
    !profile.isValid && !message.isValid,
    `block: ${JSON.stringify(text)}`,
    `profile=${JSON.stringify(profile)} message=${JSON.stringify(message)}`
  );
  record(
    /personal information/i.test(profile.error || ''),
    `personal-info wording: ${JSON.stringify(text)}`,
    `error=${JSON.stringify(profile.error)}`
  );
}

console.log(`\ncontact info warns without blocking (${WARNED.length} cases)`);
for (const text of WARNED) {
  const first = validateMessageContent(text);
  const second = validateMessageContent(text);
  record(first.isValid && !!first.warning, `warn: ${JSON.stringify(text)}`, JSON.stringify(first));
  // A global regex used with .test() carries lastIndex between calls, so the second
  // verdict used to differ from the first.
  record(
    JSON.stringify(first) === JSON.stringify(second),
    `stable across calls: ${JSON.stringify(text)}`,
    `${JSON.stringify(first)} then ${JSON.stringify(second)}`
  );
}

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
