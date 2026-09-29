/**
 * One post-export patch to the web bundle, so it can load at all.  (MEXA-328)
 *
 *   node walkthrough/patch-export.mjs <export-dir>
 *
 * WHY
 * `zustand/middleware` ships `devtools`, which reads `import.meta.env.MODE`. Metro picks
 * zustand's ESM build for web and emits that expression verbatim into the bundle, which
 * expo's index.html loads as a classic `<script>` - so the whole bundle dies at parse time
 * with "Cannot use 'import.meta' outside a module" and the page renders nothing.
 *
 * Nothing in src/stores uses `devtools`; it is dead code reached only through the
 * `zustand/middleware` barrel, and the expression it sits in already falls back to
 * `void 0`. So rewriting the token to `void 0` changes no behaviour, and it is confined
 * to the exported web artifact - the repo, the native bundle and every EAS build are
 * untouched. Serving the bundle as `type="module"` instead would also fix the parse, but
 * would put the whole Metro bundle in strict mode, which is a much larger change to what
 * the screenshots are showing.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'dist');
const jsDir = path.join(root, '_expo/static/js/web');

let total = 0;
for (const name of fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'))) {
  const file = path.join(jsDir, name);
  const src = fs.readFileSync(file, 'utf8');
  const out = src.split('import.meta.env').join('(void 0)');
  const n = (src.length - out.length) / ('import.meta.env'.length - '(void 0)'.length);
  if (n > 0) {
    fs.writeFileSync(file, out);
    console.log(`patched ${name}: ${n} x import.meta.env -> (void 0)`);
    total += n;
  }
}
if (total === 0) console.log('no import.meta.env found - nothing to patch');

// Anything else still referencing import.meta would fail the same way. Fail loudly
// rather than let the walkthrough produce a set of blank screenshots.
for (const name of fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(jsDir, name), 'utf8');
  if (src.includes('import.meta')) {
    console.error(`error: ${name} still contains import.meta; the bundle will not parse.`);
    process.exit(1);
  }
}
