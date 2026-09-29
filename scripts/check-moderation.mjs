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
  'Kill Bill is my favourite film',
  // Guards for the target-focused threat patterns added on MEXA-342. Each one is a kind
  // or ordinary sentence that sits one word away from a phrasing that does block.
  'Did you get hurt on the hike?',
  "I don't want you to get hurt",
  'My knees get hurt when I run downhill',
  "You're going to get hooked on my cholent",
  'I hope you get home safely',
  'I hope you had a good holiday',
  'Kill your darlings is the best writing advice there is',
  // Guards for the shoot / beat-up / contracted-subject patterns added on MEXA-343. "shoot
  // you <determiner>" is the one benign idiom in the violence block, and a sentence with no
  // modal in front of the verb is a disclosure, which must never be refused.
  "I'll shoot you a text when I land",
  "He'll shoot you over the details",
  "I'll shoot you my number after this",
  "I'll shoot you guys a message",
  'I want to shoot you a quick question',
  "He's gonna shoot the wedding video for us",
  'I shoot film on an old Pentax',
  'My ex used to hurt me',
  "Someone hurt you and that wasn't your fault",
  'My brother will beat you at ping pong',
  "He's going to call you back tonight",
  "They're gonna love you",
  "He'll text you after Shabbat",
  "She's going to hurt her ankle if she keeps running",
  'I am going to hurt her feelings if I cancel',
  "He'll hurt her feelings if he cancels",
  'My nephew will beat you at Catan',
  'I will shoot you something tonight',
  'I will shoot you details later',
  'I will shoot you pics of the dog',
  'I will shoot you that link',
  "I'll shoot you screenshots of the thread",
  "I'll shoot you back the details tomorrow",
  "I'll shoot you a quick question",
  "I'll shoot you the address later",
  "I'll shoot you guys the info",
  "I'll shoot you whatever I find",
  "he's gonna shoot her wedding photos",

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
  // Indirect, passive and third-person threats. The first-person-leader pattern alone
  // missed every one of these (MEXA-342, Guts).
  'he should kill you',
  'someone should murder you',
  'somebody is going to hurt you',
  'you deserve to die',
  'hope you get stabbed',
  "you're going to get hurt",
  "you're gonna get murdered",
  'I hope you get murdered someday',
  'I wish you were dead',
  'you will be killed',
  // "shoot" had no unconditional cover at all, so every one of these was allowed until
  // MEXA-343: a contracted subject skipped the third-person pattern, and the first-person
  // pattern never listed the verb.
  "he's gonna shoot you",
  "she's going to shoot you",
  "they're gonna shoot you",
  "somebody's gonna shoot you",
  "I'm gonna shoot you",
  "I'll shoot you",
  'I will shoot you',
  'he should shoot you',
  "he'll hurt you",
  "he's gonna beat her up",
  "I'm gonna beat you up",
  "you're gonna get beat up",
  "I'm gonna hurt her tonight",
  "she's about to stab you",
  'they need to kill you',
  'I will shoot you dead',
  "I'm going to shoot you in the face",
  'I will shoot you if you come here',
  "I'm gonna shoot you tonight",
  // A threat continues in more ways than anyone can list, which is why the guard on
  // `shoot` blocks by default and carves out only the send-idiom (MEXA-343, Guts, pass 2).
  // These 14 all walked past the earlier allow-by-default version.
  "I'm gonna shoot you here",
  "I'm gonna shoot you outside",
  "I'm gonna shoot you at your house",
  "I'm gonna shoot you at your door",
  "I'm gonna shoot you through the window",
  "I'm gonna shoot you for this",
  "I'm gonna shoot you before you know it",
  "I'm gonna shoot you where you stand",
  "I'm gonna shoot you real quick",
  "I'm gonna shoot you good",
  "I'm gonna shoot you soon",
  "I'm gonna shoot you next",
  "I'm gonna shoot you around back",
  "I'm gonna shoot you point blank",
  "I'm gonna shoot you later",
  "I'm gonna shoot you punk",
  "I'm gonna shoot you it's over",
  // A determiner is not the idiom: it introduces "text" and "bullet" alike, so the guard
  // has to end on the thing being sent (MEXA-343, Guts, third pass). These nine cleared
  // the determiner-only version.
  "I'm gonna shoot you a bullet",
  "I'm gonna shoot you a bullet to the head",
  "I'm gonna shoot you a warning shot",
  "I'm gonna shoot you this time",
  "he's gonna shoot you your last breath",
  "I'll shoot you your own gun",
  "I'm gonna shoot you some lead",
  "I'm gonna shoot you over there",
  "I'm gonna shoot you back",
  // ...and the same shape, found by looking for more of it.
  "I'm gonna shoot you a hole in the head",
  "I'm gonna shoot you the finger",
  "I'm gonna shoot you a round",
  "I'm gonna shoot you my gun",
  "I'm gonna shoot you some bullets",
  "I'm gonna shoot you a couple of rounds",
  "I'm gonna shoot you a bullet text",
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
