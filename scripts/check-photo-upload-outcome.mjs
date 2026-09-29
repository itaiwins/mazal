#!/usr/bin/env node
/**
 * check-photo-upload-outcome.mjs - the corpus behind MEXA-338 finding 13.
 *
 * Offline: no Supabase, no credentials, no network, no simulator. It transpiles
 * `src/lib/onboarding/photoUploadOutcome.ts` in memory (pure TypeScript, its only import
 * is a constant) and drives every combination of picked / landed / failures through
 * `describePhotoUploadOutcome`. Pure JS, so a pass here is a pass on device.
 *
 *   node scripts/check-photo-upload-outcome.mjs        # one line per failure, exit 1 on any
 *   node scripts/check-photo-upload-outcome.mjs -v     # also print every passing case
 *
 * Why it exists: before MEXA-338 every upload failure in `app/(onboarding)/complete.tsx`
 * was swallowed — `try { … } catch { continue; }` and a bare `console.error` on a storage
 * error — so a flaky network finished onboarding and put the user in the deck with a
 * profile nobody will swipe on, with nothing shown. The rule the cases below encode:
 *
 *   - nothing missing and nothing failed -> say nothing
 *   - fewer than MIN_PHOTOS landed       -> block, offer a retry
 *   - enough landed but not all          -> notice only
 *
 * What it does NOT prove: that the screen draws the result, or that the retry path works.
 * `npx tsc --noEmit` covers the wiring; the device check on MEXA-344 covers the rest.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SOURCE = path.join(ROOT, 'src', 'lib', 'onboarding', 'photoUploadOutcome.ts');
const SCREEN = path.join(ROOT, 'app', '(onboarding)', 'complete.tsx');
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

/** Mirrors MIN_PHOTOS in src/lib/constants/app.ts; asserted against it below. */
const MIN = 2;

const FAIL = ['Photo 2: network request failed'];
const TWO_FAILS = ['Photo 1: 413 Payload Too Large', 'Photo 2: network request failed'];

/** [picked, landed, failures, expected kind, why]. */
const CASES = [
  // Nothing to say.
  [2, 2, [], 'ok', 'both photos landed'],
  [6, 6, [], 'ok', 'a full grid landed'],
  [0, 0, [], 'ok', 'no photos were picked'],

  // Below the floor onboarding already made the user clear -> block with a retry.
  [2, 0, TWO_FAILS, 'blocking', 'the walkthrough case: nothing landed'],
  [2, 1, FAIL, 'blocking', 'one landed, one short of MIN_PHOTOS'],
  [6, 1, TWO_FAILS, 'blocking', 'five of six failed'],
  [3, 0, FAIL, 'blocking', 'nothing landed, only one reason recorded'],

  // Enough landed to be a usable profile -> notice only.
  [3, 2, FAIL, 'notice', 'exactly MIN_PHOTOS landed'],
  [6, 4, TWO_FAILS, 'notice', 'four of six landed'],
  [6, 5, FAIL, 'notice', 'one short of the full grid'],

  // A short count with no recorded reason is still a problem. This is the case that
  // catches a new `continue` added to the loop without a `photoFailures.push`.
  [2, 0, [], 'blocking', 'nothing landed and nobody said why'],
  [6, 3, [], 'notice', 'half landed and nobody said why'],
];

async function load() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  // The module's one import is `MIN_PHOTOS` from a path alias tsc resolves and node does
  // not, so inline it. Asserted against the real constant below, so it cannot drift.
  const inlined = source.replace(
    /import \{ MIN_PHOTOS \} from '@\/lib\/constants\/app';/,
    `const MIN_PHOTOS = ${MIN};`
  );
  if (inlined === source) {
    throw new Error(`${SOURCE} no longer imports MIN_PHOTOS the way this script patches it`);
  }
  const js = ts.transpileModule(inlined, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: SOURCE,
  }).outputText;
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mazal-photos-')), 'outcome.mjs');
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

const { describePhotoUploadOutcome, MAX_FAILURE_LINES } = await load();

console.log(`photo upload outcome: ${SOURCE}\n`);

// The inlined constant has to be the real one, or every case above is testing a fiction.
const appConstants = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'constants', 'app.ts'), 'utf8');
const declared = appConstants.match(/export const MIN_PHOTOS = (\d+);/)?.[1];
record(
  declared === String(MIN),
  `MIN_PHOTOS in src/lib/constants/app.ts is ${MIN}`,
  `found ${declared ?? 'nothing'}`
);

console.log(`\nwhich outcome each situation gets (${CASES.length} cases)`);
for (const [picked, landed, fails, want, why] of CASES) {
  const got = describePhotoUploadOutcome(picked, landed, fails);
  record(
    got.kind === want,
    `picked=${picked} landed=${landed} failures=${fails.length} -> ${want} (${why})`,
    got.kind === want ? '' : `got ${got.kind}`
  );
  // Anything that is not 'ok' has to carry copy, or the user sees an empty dialog.
  if (want !== 'ok') {
    record(
      typeof got.title === 'string' && got.title.length > 0,
      `  has a title: ${JSON.stringify(got.title)}`
    );
    record(
      typeof got.message === 'string' && got.message.length > 20,
      `  has a message: ${JSON.stringify(got.message?.slice(0, 40))}...`
    );
    // The reason has to reach the user. That was the whole defect.
    for (const f of fails.slice(0, MAX_FAILURE_LINES)) {
      record(got.message.includes(f), `  names the reason: ${JSON.stringify(f)}`);
    }
  } else {
    record(got.title === undefined, '  ok carries no copy to draw');
  }
}

console.log('\nthe blocking copy is honest about the numbers');
const none = describePhotoUploadOutcome(2, 0, FAIL);
record(/at least 2 photos/.test(none.message), "names the floor: 'at least 2 photos'", none.message);
record(/none made it/.test(none.message), "says 'none made it' when nothing landed", none.message);
const one = describePhotoUploadOutcome(3, 1, FAIL);
record(/only 1 made it/.test(one.message), "says 'only 1 made it' when one landed", one.message);
record(/Only 1 of your photos uploaded/.test(one.title), 'the title counts too', one.title);
const notice = describePhotoUploadOutcome(6, 4, FAIL);
record(/4 of your 6 photos/.test(notice.message), 'the notice counts both numbers', notice.message);
record(/Edit Profile/.test(notice.message), 'the notice says where to fix it', notice.message);

console.log(`\nat most ${MAX_FAILURE_LINES} reasons are shown`);
const many = ['a: one', 'b: two', 'c: three', 'd: four', 'e: five'];
const trimmed = describePhotoUploadOutcome(6, 0, many);
record(trimmed.message.includes('c: three'), 'the third reason is shown');
record(!trimmed.message.includes('d: four'), 'the fourth reason is not');

console.log('\na different floor changes the verdict, not just the copy');
record(
  describePhotoUploadOutcome(4, 2, FAIL, 3).kind === 'blocking',
  'landed=2 blocks when minPhotos=3'
);
record(
  describePhotoUploadOutcome(4, 2, FAIL, 1).kind === 'notice',
  'landed=2 is only a notice when minPhotos=1'
);

console.log('\nthe screen still uses it');
const screen = fs.readFileSync(SCREEN, 'utf8');
record(
  /describePhotoUploadOutcome\(/.test(screen),
  'app/(onboarding)/complete.tsx calls describePhotoUploadOutcome'
);
record(
  /photoFailures\.push\(/.test(screen),
  'complete.tsx records failures rather than swallowing them'
);
// The defect itself: an empty catch. Every `catch` in the photo loop must record something.
record(
  !/catch\s*\{\s*continue;?\s*\}/.test(screen),
  'complete.tsx has no bare `catch { continue }`'
);
record(
  /kind === 'blocking'/.test(screen) && /setIsSaving\(false\)/.test(screen),
  'the blocking branch stays on the screen instead of navigating'
);

// MEXA-388 A: the block above only keeps the user on the screen. It keeps a photoless
// profile out of the deck only if the row is not live until after it.
console.log('\nthe profile goes live only after the photo outcome');
const firstWrite = screen.indexOf('onboarding_complete: false');
const outcomeAt = screen.indexOf('describePhotoUploadOutcome(photosPicked');
const goLive = screen.search(/updateUser\(verifiedAuthId, \{\s*onboarding_complete: true,\s*is_active: true,?\s*\}\)/);
record(firstWrite !== -1 && /is_active: false/.test(screen), 'the first write sets onboarding_complete and is_active false');
record(!/onboarding_complete: true,\s*is_active: true,\s*\};/.test(screen), 'profileData no longer carries the live flags');
record(goLive > outcomeAt && outcomeAt > firstWrite, 'the go-live update comes after the photo outcome is decided');
record(/setUser\(liveUser\)/.test(screen), 'the auth store gets the live row, not the pre-photo one');

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
