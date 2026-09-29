#!/usr/bin/env node
/**
 * Turn a shoot.mjs run into one PDF a reviewer can page through.  (MEXA-328)
 *
 *   node walkthrough/build-pack.mjs <out-dir> [title]
 *
 * Reads <out-dir>/manifest.json, writes <out-dir>/INDEX.md and
 * <out-dir>/mazal-walkthrough.pdf. The PDF is printed by the same headless Chrome the
 * screenshots came from (Page.printToPDF), so there is no PDF dependency to add.
 *
 * Each page carries the route and how the screen was reached, because "tapped through"
 * and "opened by URL" are not the same claim and the difference matters to whoever is
 * signing off.
 */

import { launch } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'walkthrough-out');
const TITLE = process.argv[3] || 'Mazal — full walkthrough';
const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- INDEX.md ---------------------------------------------------------------------
const index = [
  `# ${TITLE}`,
  '',
  '| # | Screen | Route | How it was reached |',
  '|---|---|---|---|',
  ...manifest.map(
    (m) => `| ${m.n} | ${m.title} | \`${m.route || '-'}\` | ${m.how}${m.note ? ' — ' + m.note : ''} |`
  ),
  '',
].join('\n');
fs.writeFileSync(path.join(OUT, 'INDEX.md'), index);

// ---- one HTML page per screenshot, then print ---------------------------------------
const pages = manifest
  .filter((m) => m.file && fs.existsSync(path.join(OUT, m.file)))
  .map(
    (m) => `
    <section>
      <h2>${m.n}. ${esc(m.title)}</h2>
      <p class="meta"><code>${esc(m.route || '-')}</code> · ${esc(m.how)}</p>
      ${m.note ? `<p class="note">${esc(m.note)}</p>` : ''}
      <img src="${esc(m.file)}" />
    </section>`
  )
  .join('\n');

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(TITLE)}</title>
<style>
  @page { size: 6in 11in; margin: 0.3in; }
  body { font: 11px/1.4 -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 0; }
  section { page-break-after: always; text-align: center; }
  h2 { font-size: 14px; margin: 0 0 2px; text-align: left; }
  .meta { margin: 0 0 2px; color: #555; text-align: left; }
  .note { margin: 0 0 6px; color: #7a5b00; text-align: left; }
  code { background: #f2f2f2; padding: 1px 3px; border-radius: 3px; }
  img { width: 3.2in; border: 1px solid #ddd; border-radius: 10px; }
  .cover { text-align: left; }
  .cover h1 { font-size: 22px; margin: 0 0 6px; }
  table { border-collapse: collapse; width: 100%; font-size: 9px; }
  td, th { border-bottom: 1px solid #eee; padding: 2px 4px; text-align: left; vertical-align: top; }
</style></head><body>
<section class="cover">
  <h1>${esc(TITLE)}</h1>
  <p>${manifest.length} screens, rendered from the real web export of the app against the live
  Supabase project <code>tayiyczmacvhokdxfqvm</code>. Every screenshot is a real render;
  nothing here is a mockup.</p>
  <table>
    <tr><th>#</th><th>Screen</th><th>Route</th><th>How it was reached</th></tr>
    ${manifest
      .map(
        (m) =>
          `<tr><td>${m.n}</td><td>${esc(m.title)}</td><td><code>${esc(m.route || '-')}</code></td><td>${esc(m.how)}${m.note ? ' — ' + esc(m.note) : ''}</td></tr>`
      )
      .join('')}
  </table>
</section>
${pages}
</body></html>`;

const htmlPath = path.join(OUT, 'pack.html');
fs.writeFileSync(htmlPath, html);

const b = await launch({ width: 800, height: 1000, scale: 1 });
await b.goto('file://' + htmlPath, { settle: 2500 });
const { data } = await b.send('Page.printToPDF', {
  printBackground: true,
  paperWidth: 6,
  paperHeight: 11,
  marginTop: 0.3,
  marginBottom: 0.3,
  marginLeft: 0.3,
  marginRight: 0.3,
});
const pdf = path.join(OUT, 'mazal-walkthrough.pdf');
fs.writeFileSync(pdf, Buffer.from(data, 'base64'));
await b.close();

console.log(`INDEX.md and ${path.basename(pdf)} (${(fs.statSync(pdf).size / 1024 / 1024).toFixed(1)} MB) in ${OUT}`);
