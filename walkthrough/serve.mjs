/**
 * Static server with an SPA fallback, for the web export.  (MEXA-328)
 *
 * `expo export --platform web` writes one index.html and does client-side routing, so
 * a plain file server 404s on /settings or /basics. Everything that is not a real file
 * falls back to index.html and expo-router picks the route up from the URL.
 *
 *   node walkthrough/serve.mjs <export-dir> [port]
 *
 * Node's http module only. No new dependencies (MEXA-328 asked for none).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 8787);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // Resolve inside root, then re-check: a request for /../../etc/passwd must not escape.
    const candidate = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    const inRoot = candidate === root || candidate.startsWith(root + path.sep);

    let file = null;
    if (inRoot && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      file = candidate;
    } else {
      file = path.join(root, 'index.html'); // SPA fallback
    }

    const body = fs.readFileSync(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  })
  .listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
