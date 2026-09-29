/**
 * Minimal Chrome DevTools Protocol driver.  (MEXA-328)
 *
 * MEXA-328 said no new dependencies, so this is puppeteer's job done with Node 24's
 * global WebSocket and /usr/bin/google-chrome. It does only what a walkthrough needs:
 * launch headless Chrome at a phone viewport, navigate, evaluate, click, type, and
 * take a full-page PNG.
 *
 *   const b = await launch({ width: 390, height: 844, scale: 2 });
 *   await b.goto('http://127.0.0.1:8787/');
 *   await b.shot('/tmp/01-welcome.png');
 *   await b.close();
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      /* chrome not up yet */
    }
    await sleep(250);
  }
  throw new Error(`CDP endpoint never came up: ${url}`);
}

export async function launch({ width = 390, height = 844, scale = 2, port } = {}) {
  // A random port per launch, because a leftover Chrome on a fixed one silently steals
  // the next run: `/json/version` answers, the driver attaches to the OLD browser, and
  // every step then runs against a dead page. Cost an hour on MEXA-328.
  if (!port) port = 9400 + Math.floor(Math.random() * 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mazal-chrome-'));
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=' + scale,
      '--no-sandbox',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const chromeLog = [];
  child.stdout.on('data', (d) => chromeLog.push(String(d)));
  child.stderr.on('data', (d) => chromeLog.push(String(d)));

  const version = await fetchJson(`http://127.0.0.1:${port}/json/version`);
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('CDP websocket failed\n' + chromeLog.join('')));
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message + ' (' + JSON.stringify(msg.error) + ')')) : resolve(msg.result);
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  };

  let sessionId = null;
  const send = (method, params = {}, opts = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      const frame = { id, method, params };
      const sid = opts.sessionId === null ? undefined : opts.sessionId || sessionId;
      if (sid) frame.sessionId = sid;
      ws.send(JSON.stringify(frame));
    });

  // Attach to the about:blank tab.
  const targets = await send('Target.getTargets', {}, { sessionId: null });
  const page = targets.targetInfos.find((t) => t.type === 'page');
  ({ sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true }, { sessionId: null }));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: true,
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  // Keep every console message and page error: a blank screenshot is only diagnosable
  // with the log that produced it, and "the screen rendered nothing" is a finding.
  const console_ = [];
  listeners.push((msg) => {
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || [])
        .map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type))
        .join(' ');
      console_.push(`[${msg.params.type}] ${text}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      console_.push(`[pageerror] ${d.exception?.description || d.text}`);
    } else if (msg.method === 'Log.entryAdded') {
      console_.push(`[${msg.params.entry.level}] ${msg.params.entry.text}`);
    }
  });

  const evaluate = async (expr, { awaitPromise = true } = {}) => {
    const r = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise,
      userGesture: true,
    });
    if (r.exceptionDetails) {
      throw new Error('evaluate threw: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    }
    return r.result.value;
  };

  const browser = {
    send,
    console: console_,
    clearConsole: () => (console_.length = 0),
    evaluate,

    async goto(url, { settle = 1500 } = {}) {
      await send('Page.navigate', { url });
      await browser.waitForIdle();
      await sleep(settle);
    },

    /** Client-side route change, so the SPA is not reloaded and the session survives. */
    async pushRoute(pathname, { settle = 1500 } = {}) {
      await evaluate(
        `(() => { history.pushState({}, '', ${JSON.stringify(pathname)});
                  window.dispatchEvent(new PopStateEvent('popstate')); return true; })()`
      );
      await sleep(settle);
    },

    async waitForIdle(timeout = 20000) {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        const ready = await evaluate('document.readyState').catch(() => null);
        if (ready === 'complete') return;
        await sleep(200);
      }
    },

    /**
     * Wait until some text appears anywhere in the rendered tree.
     *
     * `document.body`, not `#root`: react-native-web renders `<Modal>` into its own
     * portal appended to the body, so the prompt picker and every other modal is
     * invisible to a `#root`-scoped query.
     */
    async waitForText(text, timeout = 15000) {
      const started = Date.now();
      const needle = JSON.stringify(text);
      while (Date.now() - started < timeout) {
        const found = await evaluate(
          `(document.body?.innerText || '').includes(${needle})`
        ).catch(() => false);
        if (found) return true;
        await sleep(250);
      }
      return false;
    },

    async text() {
      return (await evaluate(`document.body?.innerText || ''`)) || '';
    },

    /**
     * Click the element whose visible text matches, by dispatching a real mouse event
     * at its centre. react-native-web renders Pressable as a div with onClick, and
     * el.click() skips the pointer handlers some of them use, so go through Input.
     */
    async clickText(text, { nth = 0, exact = false } = {}) {
      const box = await evaluate(`(() => {
        const want = ${JSON.stringify(text)};
        const root = document.body;
        if (!root) return null;
        const hits = [];
        for (const el of root.querySelectorAll('*')) {
          const own = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
          const t = (el.innerText || own || '').trim();
          const match = ${exact ? 't === want' : 't.includes(want)'};
          if (!match) continue;
          // Deepest match only: skip anything that has a descendant matching too.
          if (Array.from(el.querySelectorAll('*')).some((c) => {
            const ct = (c.innerText || '').trim();
            return ${exact ? 'ct === want' : 'ct.includes(want)'};
          })) continue;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) hits.push({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
        }
        return hits[${nth}] || null;
      })()`);
      if (!box) throw new Error(`clickText: no element with text ${JSON.stringify(text)} (nth=${nth})`);
      await browser.clickAt(box.x, box.y);
      return box;
    },

    /**
     * Answer the next file-picker with `files`, instead of leaving it hanging.
     *
     * `expo-image-picker` on web is an `<input type="file">` it creates, clicks and
     * throws away, so there is no stable element to target - the only handle is the
     * fileChooserOpened event, which is how a real "choose a photo" tap is answered too.
     */
    async armFileChooser(files) {
      await send('DOM.enable');
      await send('Page.setInterceptFileChooserDialog', { enabled: true });
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          listeners.splice(listeners.indexOf(handler), 1);
          reject(new Error('no file chooser opened within 15s'));
        }, 15000);
        const handler = async (msg) => {
          if (msg.method !== 'Page.fileChooserOpened') return;
          clearTimeout(timer);
          listeners.splice(listeners.indexOf(handler), 1);
          try {
            await send('DOM.setFileInputFiles', { files, backendNodeId: msg.params.backendNodeId });
            await sleep(600);
            resolve(true);
          } catch (e) {
            reject(e);
          }
        };
        listeners.push(handler);
      });
    },

    async clickAt(x, y) {
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', {
          type,
          x,
          y,
          button: 'left',
          clickCount: 1,
          buttons: type === 'mousePressed' ? 1 : 0,
        });
      }
      await sleep(350);
    },

    /** Focus the nth text input and type into it as real key events. */
    async typeInto(nth, value, { placeholder = null } = {}) {
      const ok = await evaluate(`(() => {
        const root = document.body;
        const inputs = Array.from(root.querySelectorAll('input, textarea'))
          .filter((i) => i.type !== 'hidden' && i.offsetParent !== null);
        const el = ${placeholder
          ? `inputs.find((i) => (i.placeholder || '').includes(${JSON.stringify(placeholder)}))`
          : `inputs[${nth}]`};
        if (!el) return false;
        el.focus();
        return true;
      })()`);
      if (!ok) throw new Error(`typeInto: no input (nth=${nth}, placeholder=${placeholder})`);
      await send('Input.insertText', { text: value });
      // react-native-web's TextInput listens for change/input; insertText fires input.
      await sleep(200);
      return true;
    },

    async shot(file, { fullPage = false } = {}) {
      const params = { format: 'png', captureBeyondViewport: fullPage };
      if (fullPage) {
        const m = await send('Page.getLayoutMetrics');
        const h = Math.min(Math.ceil(m.cssContentSize.height), 4000);
        params.clip = { x: 0, y: 0, width, height: Math.max(h, height), scale: 1 };
      }
      const { data } = await send('Page.captureScreenshot', params);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      return file;
    },

    async close() {
      try {
        ws.close();
      } catch {}
      child.kill('SIGTERM');
      await sleep(500);
      if (child.exitCode === null) child.kill('SIGKILL');
      await sleep(200);
      try {
        fs.rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };

  return browser;
}
