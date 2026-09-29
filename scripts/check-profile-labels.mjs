#!/usr/bin/env node
/**
 * check-profile-labels.mjs - the corpus behind MEXA-338 finding 8.
 *
 * Offline: no Supabase, no credentials, no network. It transpiles
 * `src/lib/constants/jewish.ts` in memory (pure TypeScript, no React Native imports) and
 * checks every label helper against every id in its own list. Pure JS, so a pass here is
 * a pass on device.
 *
 *   node scripts/check-profile-labels.mjs        # one line per failure, summary, exit 1
 *   node scripts/check-profile-labels.mjs -v     # also print every passing case
 *
 * Why it exists: the `users` columns store an option's `id`, not its label, so a screen
 * that renders the column straight shows "modern_orthodox". The MEXA-328 walkthrough
 * measured exactly that on the discover card (pack screen 24).
 *
 * The second half is a wiring guard, not a render test: it asserts the files that draw
 * these values still import the helpers. It cannot prove *what* they render - only
 * `npx tsc --noEmit` and a real render do that.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SOURCE = path.join(ROOT, 'src', 'lib', 'constants', 'jewish.ts');
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

/** helper name -> the list it must cover. */
const PAIRS = [
  ['jewishBackgroundLabel', 'JEWISH_BACKGROUNDS'],
  ['observanceLevelLabel', 'OBSERVANCE_LEVELS'],
  ['shabbatObservanceLabel', 'SHABBAT_OBSERVANCE'],
  ['kosherLevelLabel', 'KOSHER_LEVELS'],
  ['synagogueAttendanceLabel', 'SYNAGOGUE_ATTENDANCE'],
  ['jewishEducationLabel', 'JEWISH_EDUCATION'],
  ['lookingForLabel', 'LOOKING_FOR'],
  ['wantsChildrenLabel', 'WANTS_CHILDREN'],
];

/** The exact values the walkthrough saw raw on pack screen 24, and what they must read. */
const MEASURED = [
  ['jewishBackgroundLabel', 'modern_orthodox', 'Modern Orthodox'],
  ['observanceLevelLabel', 'somewhat_observant', 'Somewhat Observant'],
];

/** Files that draw one of these columns. They must go through the helpers. */
const DISPLAY_SITES = [
  'src/components/discovery/SwipeableCard.tsx',
  'src/components/discovery/HeroPhoto.tsx',
  'src/components/discovery/JewishLife.tsx',
  'app/profile/preview.tsx',
];

async function loadConstants() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: SOURCE,
  }).outputText;
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mazal-labels-')), 'jewish.mjs');
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

const mod = await loadConstants();

console.log(`label helpers: ${SOURCE}\n`);

console.log(`every id in every list resolves to its own label (${PAIRS.length} lists)`);
for (const [helperName, listName] of PAIRS) {
  const helper = mod[helperName];
  const list = mod[listName];
  record(typeof helper === 'function', `${helperName} is exported`, typeof helper);
  record(Array.isArray(list) && list.length > 0, `${listName} is a non-empty list`);
  if (typeof helper !== 'function' || !Array.isArray(list)) continue;
  for (const option of list) {
    const got = helper(option.id);
    record(
      got === option.label,
      `${helperName}(${JSON.stringify(option.id)})`,
      got === option.label ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(option.label)}`
    );
    // The point of the whole exercise: no id ever reaches the screen as itself.
    record(
      !/_/.test(got),
      `${helperName}(${JSON.stringify(option.id)}) has no underscore`,
      /_/.test(got) ? `got ${JSON.stringify(got)}` : ''
    );
  }
}

console.log(`\nthe two values the walkthrough measured raw (${MEASURED.length} cases)`);
for (const [helperName, id, want] of MEASURED) {
  const got = mod[helperName]?.(id);
  record(got === want, `${helperName}(${JSON.stringify(id)}) === ${JSON.stringify(want)}`, `got ${JSON.stringify(got)}`);
}

console.log('\nmissing and unknown ids');
for (const [helperName] of PAIRS) {
  const helper = mod[helperName];
  if (typeof helper !== 'function') continue;
  // Nothing to draw: '' so the caller's `&&` guard keeps the chip off the screen.
  for (const empty of [undefined, null, '']) {
    const got = helper(empty);
    record(got === '', `${helperName}(${JSON.stringify(empty)}) === ''`, `got ${JSON.stringify(got)}`);
  }
  // A row written before a list changed still has to read as something.
  const got = helper('a_retired_option');
  record(
    got === 'A Retired Option',
    `${helperName}('a_retired_option') title-cases`,
    `got ${JSON.stringify(got)}`
  );
}

console.log('\nobservanceLevelDescription');
record(
  mod.observanceLevelDescription('somewhat_observant') === 'I pick and choose traditions',
  "observanceLevelDescription('somewhat_observant')",
  JSON.stringify(mod.observanceLevelDescription('somewhat_observant'))
);
record(mod.observanceLevelDescription('a_retired_option') === '', 'unknown id has no description');
record(mod.observanceLevelDescription(null) === '', 'null id has no description');

console.log(`\ndisplay sites still import the helpers (${DISPLAY_SITES.length} files)`);
for (const rel of DISPLAY_SITES) {
  const file = path.join(ROOT, rel);
  const exists = fs.existsSync(file);
  record(exists, `${rel} exists`);
  if (!exists) continue;
  const text = fs.readFileSync(file, 'utf8');
  record(
    /from '@\/lib\/constants\/jewish'/.test(text),
    `${rel} imports @/lib/constants/jewish`
  );
}

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
