# `walkthrough/`

Screenshots every reachable screen of Mazal, in the order a new user meets them, by
rendering the app for real and driving it. Built for MEXA-328: Lelouch's pre-TestFlight
gate (MEXA-273) needs a walkthrough of the whole app, and he can't run an iOS build.

**Findings are in [NOTES.md](NOTES.md).** This file is how to re-run it.

Nothing here is part of the app bundle. `metro.config.js` in the repo root belongs to this
directory too and is inert unless `MAZAL_WEB_SHIMS=1` is set.

## No new dependencies

MEXA-328 asked for none, and none were added: `package.json` and `package-lock.json` are
untouched. Two things are worth knowing.

* **`react-dom` and `react-native-web` are required to export for web at all** — `expo
  export --platform web` refuses without them. They were installed into an isolated tree
  and the missing packages copied into the shared `node_modules`, so nothing in the repo
  changed and nothing was upgraded in place. If `expo export --platform web` starts
  refusing again, that copy is gone; redo it:

  ```sh
  mkdir -p /tmp/webdeps && cd /tmp/webdeps && npm init -y
  npm install react-dom@19.1.0 react-native-web@^0.21.0
  # then copy only the package dirs that REPOS/mazal/node_modules does not already have
  ```

* **`pg` is not used here** (an earlier draft did); the confirmation link is read out of a
  real mailbox instead.

The driver is puppeteer's job done against `/usr/bin/google-chrome` with Node 24's global
`WebSocket` — see `cdp.mjs`.

## Running it

```sh
cd REPOS/mazal-MEXA-328
set -a
. /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env
. /home/itai/mexant/workspace/archive/credentials/mexant-agentmail.env
set +a

# 1. build the web export, with the native-only modules shimmed
MAZAL_WEB_SHIMS=1 npx expo export --platform web --output-dir /tmp/web --clear
node walkthrough/patch-export.mjs /tmp/web       # see the file for why this is needed

# 2. serve it with an SPA fallback
node walkthrough/serve.mjs /tmp/web 8787 &

# 3. seed the second user, run the walkthrough, build the PDF
node walkthrough/fixtures.mjs count              # before/after control
node walkthrough/fixtures.mjs reclaim
node walkthrough/fixtures.mjs seed-b
node walkthrough/shoot.mjs /tmp/pack
node walkthrough/build-pack.mjs /tmp/pack "Mazal — full walkthrough"

# 4. put the live project back
node walkthrough/fixtures.mjs teardown
```

`WALKTHROUGH_RESUME=1 node walkthrough/shoot.mjs …` skips the sign-up and confirmation
phases and starts from a sign-in with an account that already exists. Use it while
iterating — each full run sends one confirmation email out of the team's shared 100/day
Resend bucket (TEAM_BOARD, MEXA-304). The pack that ships is always a full run.

## The two test users

Both are throwaway fixtures on the **live** project; there is no staging database.

| | address | made by |
|---|---|---|
| A | `<the team AgentMail inbox>+mazal-e2e-walkthrough-a@agentmail.to`, resolved from the API at run time (`fixtures.mjs email-a`) — this repo is public, so the address is not written down here | the browser, through the real sign-up and onboarding UI |
| B | `violet-e2e-walkthrough-b@example.com` | `fixtures.mjs seed-b` — profile, photo, prompts |

A is deliberately **not** on `@example.com`, which breaks the naming rule in
`scripts/README.md`. `example.com` has no MX record, so GoTrue cannot send the confirmation
email, returns 500 and rolls the account back — an `@example.com` address can never be
created through the real sign-up screen (NOTES.md finding 11). Since the point of this pack
is the real sign-up, A needs a mailbox that exists.

The cost is that **`scripts/sweep-e2e-users.mjs` will not clean A up.**
`fixtures.mjs teardown` deletes both by exact address and re-reads the count; if a run dies
somewhere odd, run it by hand rather than relying on the sweep.

## Files

| File | What it does |
|---|---|
| `cdp.mjs` | Minimal Chrome DevTools Protocol driver: launch at a phone viewport, navigate, click, type, answer a file picker, screenshot. No dependencies. |
| `serve.mjs` | Static server with an SPA fallback, because the export is one `index.html` doing client-side routing. |
| `patch-export.mjs` | Strips `import.meta.env` out of the exported bundle. Without it the bundle does not parse and every screenshot is blank. |
| `fixtures.mjs` | The two test users on the live project: seed, the real confirmation link, the like, the messages, teardown, counts. |
| `shoot.mjs` | The walkthrough itself. Writes a screenshot per screen plus `manifest.json` recording how each one was reached. |
| `check-auth-entry.mjs` | Added by MEXA-335. Asserts, rather than screenshots, the two auth entry points that NOTES.md findings 1 and 2 broke: a relaunch carrying a saved session, and the confirmation link. Phase A sends no email; phase B (`--with-confirm`) sends one. |
| `check-tab-bar-overlap.mjs` | Added by MEXA-338. **Measures** rather than screenshots NOTES.md finding 9: reads the `DotNavigator`'s box and every element that draws text or takes a tap, and asserts none of it reaches into the navigator's band. Also asserts the navigator's *rendered* height is exactly `DOT_NAVIGATOR_HEIGHT`, which is the number every screen now pads by — the pre-fix build measures 84.5 there, because an unpinned `lineHeight` left the total to the platform's font metrics. Seeds two `@example.com` fixtures through the admin API with `email_confirm: true`, so **no email is sent**, and removes them in a `finally`. Covers the Profile tab and the Map only; the deck, matches and chat need data the live project cannot serve while 00030 is unapplied — see the comment in `run()`. |
| `check-match-count-agreement.mjs` | Added by MEXA-338. Seeds two fixtures, a match between them and one unread message, then reads the number off all three surfaces from NOTES.md finding 10: the Matches list, the Profile tab's "Matches" stat and the tab-bar badge. All three must say 1. The pre-fix build reports `list=1 stat=0 badge=1`, which is the finding verbatim, so the check is not passing vacuously. No email is sent. Unaffected by the unapplied 00030 (MEXA-385) — `fetchMatches` deliberately asks for no `age`. |
| `check-auth-providers-offered.mjs` | Added by MEXA-338 / MEXA-387. Asks the **live project** which auth providers are enabled, then requires the login and register screens to offer exactly those and no others — so it fails if a button is re-added while its provider is off, and stops demanding their absence once MEXA-389 turns them on. Half of it greps the source, and that half is load-bearing: the Apple button sat inside `{Platform.OS === 'ios' && …}` and `Platform.OS` is `'web'` here, so a web render can never see it — against the pre-removal build the render checks catch Google and the divider and report Apple as absent, vacuously. Ends by proving email sign-in still reaches the app. One fixture, `email_confirm: true`, no email sent, removed in a `finally`. |
| `build-pack.mjs` | `manifest.json` → `INDEX.md` + one PDF, printed by the same headless Chrome. |
| `web-shims/` | Stand-ins for the three native-only modules, loaded only under `MAZAL_WEB_SHIMS=1`. They export nothing usable on purpose. |

## Why the shims export nothing

`react-native-google-mobile-ads`, `react-native-maps` and `react-native-purchases` are
native and break the web bundle. Every consumer already loads them through a guarded
`require()` and has a "module not available" branch, so returning nothing makes the app
draw **its own** fallback. A fake banner or a picture of a map would let a reviewer sign
off on something the app has never drawn — see the table at the end of NOTES.md for what
each one costs.
