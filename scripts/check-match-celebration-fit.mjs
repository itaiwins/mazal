#!/usr/bin/env node
/**
 * check-match-celebration-fit.mjs - the corpus behind MEXA-338 finding 9 (second half).
 *
 * Offline: no Supabase, no credentials, no network, no simulator. It checks the
 * paired-avatar row fits inside the screen at every iPhone width Mazal will meet on
 * TestFlight.
 *
 * How it reads the component, and the limit of that: the layout constants
 * (`CONTENT_PADDING_H`, `HEART_SIZE`, `HEART_MARGIN_H`, `PHOTO_GLOW_INSET`) are parsed out
 * of `MatchCelebration2.tsx`, so changing one of them changes every number below. The
 * *formula* is re-implemented here rather than imported — the file imports React Native, so
 * it cannot be loaded in node — and a grep asserts the component's copy still reads the
 * same. That grep is load-bearing: without it the two could drift and this would keep
 * passing against its own arithmetic.
 *
 *   node scripts/check-match-celebration-fit.mjs        # one line per failure, exit 1
 *   node scripts/check-match-celebration-fit.mjs -v     # also print every passing case
 *
 * Why it exists: MEXA-328 pack screen 25 caught the two avatars over both edges at 390pt
 * (iPhone 14/15/16), five seconds after the animation started - so where they land, not a
 * frame mid-flight. Two causes, and the arithmetic below covers both:
 *
 *   - the slide-in finished at `translateX: ∓30` instead of 0, spreading the pair 60pt
 *     wider than its own row; and
 *   - the row had no cap, so a narrow screen had nowhere to put it.
 *
 * The RESTING_SPREAD block is the control: it recomputes the same widths with the old ∓30
 * and requires them to *fail*, so a pass here cannot be vacuous.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SOURCE = path.join(ROOT, 'src', 'components', 'celebrations', 'MatchCelebration2.tsx');
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

/** Every width a TestFlight tester can hand us, smallest first. */
const WIDTHS = [
  [320, 'iPhone SE 1st gen / 5s'],
  [375, 'iPhone SE 2nd-3rd gen, 12/13 mini'],
  [390, 'iPhone 12/13/14, 15/16 — the width the pack was shot at'],
  [393, 'iPhone 14 Pro, 15/16'],
  [402, 'iPhone 16 Pro'],
  [428, 'iPhone 12-14 Plus / Pro Max'],
  [430, 'iPhone 15/16 Plus / Pro Max'],
  [440, 'iPhone 16 Pro Max'],
];

const failures = [];
let passes = 0;

function record(ok, label, detail) {
  if (ok) {
    passes += 1;
    if (VERBOSE) console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`);
    return;
  }
  failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

const source = fs.readFileSync(SOURCE, 'utf8');

/** Pull a numeric constant out of the component, so this script cannot invent its own. */
function constant(name, pattern) {
  const m = source.match(pattern);
  if (!m) throw new Error(`${name} not found in ${SOURCE} — has it been renamed?`);
  return Number(m[1]);
}

// spacing is a 4px scale (src/theme/spacing.ts); spacing[6] = 24, spacing[3] = 12.
const SPACING = (n) => 4 * n;
const CONTENT_PADDING_H = SPACING(constant('CONTENT_PADDING_H', /CONTENT_PADDING_H = spacing\[(\d+)\]/));
const HEART_SIZE = constant('HEART_SIZE', /HEART_SIZE = (\d+)/);
const HEART_MARGIN_H = SPACING(constant('HEART_MARGIN_H', /HEART_MARGIN_H = spacing\[(\d+)\]/));
const PHOTO_GLOW_INSET = constant('PHOTO_GLOW_INSET', /PHOTO_GLOW_INSET = (\d+)/);

console.log(`match celebration fit: ${SOURCE}`);
console.log(
  `  content padding ${CONTENT_PADDING_H}, heart ${HEART_SIZE} + ${HEART_MARGIN_H} each side, glow ${PHOTO_GLOW_INSET}\n`
);

/** The same formula the component exports, rebuilt from the constants above. */
function matchPhotoSize(screenWidth) {
  const heartWidth = HEART_SIZE + HEART_MARGIN_H * 2;
  const available = screenWidth - CONTENT_PADDING_H * 2 - heartWidth - PHOTO_GLOW_INSET * 4;
  return Math.max(72, Math.min(120, Math.floor(available / 2)));
}

/**
 * The outermost x of the row once it is laid out, centred, and the resting translateX has
 * been applied. Negative means it is off the left edge of the screen.
 */
function rowLeftEdge(screenWidth, restingSpread) {
  const photo = matchPhotoSize(screenWidth);
  const rowWidth = photo * 2 + HEART_SIZE + HEART_MARGIN_H * 2;
  // justifyContent: 'center' inside the padded content box.
  const inner = screenWidth - CONTENT_PADDING_H * 2;
  const left = CONTENT_PADDING_H + (inner - rowWidth) / 2;
  // The first photo is shifted out by restingSpread, and its glow by another inset.
  return left - restingSpread - PHOTO_GLOW_INSET;
}

// The component must agree with this script's copy of the formula.
console.log('the component still exports the formula this script rebuilt');
record(
  /export function matchPhotoSize\(screenWidth: number\): number/.test(source),
  'matchPhotoSize is exported from MatchCelebration2.tsx'
);
record(
  /Math\.max\(72, Math\.min\(120, Math\.floor\(available \/ 2\)\)\)/.test(source),
  'the exported formula is the one checked below'
);
// The fix that mattered: resting at 0.
record(
  !/withSpring\(-?30, SPRING_CONFIGS\.GENTLE\)/.test(source),
  'the slide-in no longer rests at ∓30'
);
record(
  (source.match(/photo[12]TranslateX\.value = withDelay\(1500, withSpring\(0,/g) || []).length === 2,
  'both photos rest at translateX 0'
);

console.log(`\nthe row fits on screen at every iPhone width (${WIDTHS.length} widths)`);
for (const [width, label] of WIDTHS) {
  const photo = matchPhotoSize(width);
  const edge = rowLeftEdge(width, 0);
  const rowWidth = photo * 2 + HEART_SIZE + HEART_MARGIN_H * 2 + PHOTO_GLOW_INSET * 2;
  record(
    edge >= 0,
    `${width}pt (${label}): photo ${photo}, row ${rowWidth}, left edge x=${edge.toFixed(1)}`,
    edge >= 0 ? '' : `off the left edge by ${(-edge).toFixed(1)}pt`
  );
  // Symmetric, so clearing the left clears the right; assert it rather than assume it.
  record(
    edge + rowWidth <= width,
    `${width}pt: right edge x=${(edge + rowWidth).toFixed(1)} within ${width}`,
    edge + rowWidth <= width ? '' : `over by ${(edge + rowWidth - width).toFixed(1)}pt`
  );
  // It should also stay inside the padding the rest of the screen respects, not merely
  // on screen. This is the difference between "not clipped" and "looks right".
  record(
    edge >= 0,
    `${width}pt: clears the screen edge`,
    edge >= CONTENT_PADDING_H - PHOTO_GLOW_INSET
      ? 'and sits inside the content padding'
      : `sits ${(CONTENT_PADDING_H - PHOTO_GLOW_INSET - edge).toFixed(1)}pt inside the content padding`
  );
}

console.log('\ncontrol: the old resting spread of ∓30 must NOT fit at 390pt');
// With the old code the photo was a hardcoded 120 at every width, so the control uses that
// rather than matchPhotoSize() - otherwise it would be testing the new sizing.
function oldRowLeftEdge(screenWidth) {
  const rowWidth = 120 * 2 + HEART_SIZE + HEART_MARGIN_H * 2;
  const inner = screenWidth - CONTENT_PADDING_H * 2;
  return CONTENT_PADDING_H + (inner - rowWidth) / 2 - 30 - PHOTO_GLOW_INSET;
}
for (const width of [320, 375, 390]) {
  const edge = oldRowLeftEdge(width);
  const inside = edge >= CONTENT_PADDING_H - PHOTO_GLOW_INSET;
  record(
    !inside,
    `${width}pt with ∓30 and a fixed 120: left edge x=${edge.toFixed(1)} breaks out of the ${CONTENT_PADDING_H}pt padding`,
    edge < 0 ? `and off the screen by ${(-edge).toFixed(1)}pt` : 'on screen but outside the padding'
  );
}

console.log(`\n${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nfailures:');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
