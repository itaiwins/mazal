---
title: "Auth deep links — how password reset and email confirmation get back into the app"
---

# Auth deep links

Supabase auth emails have to reopen the app. Mazal has no website, so every
redirect goes to the app's own scheme, `mazal://` (`app.json` → `expo.scheme`).

## Supabase project config (Auth → URL Configuration)

This lives only in the Supabase project, not in the repo, so it is recorded here.
Project: `tayiyczmacvhokdxfqvm`.

| Setting | Value |
|---|---|
| `site_url` | `mazal://` |
| `uri_allow_list` | `mazal://auth/**` |

**The double star is required.** GoTrue compiles allow-list patterns with `/` as a
glob separator, so a single `*` never crosses a slash: `mazal://*` does **not**
match `mazal://auth/reset-password`. When a `redirectTo` fails to match, GoTrue
does not return an error — it quietly substitutes `site_url`, and the user lands
on the app's root with no idea why. That was the state this fixed (MEXA-254).

GoTrue caches this config; a change takes up to ~30 seconds to take effect. If you
change it, re-verify before concluding it is broken.

To verify **the allow list** without sending email or burning the built-in
sender's rate limit, ask the admin API for a link and see where it actually
redirects. (It cannot verify the *flow type* — see "Verifying PKCE" below.)

```bash
# needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
link=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/generate_link" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"type":"recovery","email":"<an existing user>","redirect_to":"mazal://auth/reset-password"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["action_link"])')

curl -s -o /dev/null -D - --max-redirs 0 "$link" | grep -i '^location:'
# want:  location: mazal://auth/reset-password#...  <- path preserved, allow list OK
# wrong: location: mazal://#...                     <- redirect_to was rejected
```

`generate_link` consumes nothing and sends no email, but the link it returns is
single-use, so following it burns that link. Read only the **path** out of that
`location:`; the fragment-vs-query part of it is an artefact of the admin endpoint
and says nothing about the client's flow type.

## Client side

| Route | Deep link | Sent by |
|---|---|---|
| `app/auth/reset-password.tsx` | `mazal://auth/reset-password` | `app/(auth)/forgot-password.tsx` → `resetPasswordForEmail({ redirectTo })` |
| `app/auth/confirm.tsx` | `mazal://auth/confirm` | `app/(auth)/register.tsx` → `signUp({ emailRedirectTo })` |
| `app/auth/confirm.tsx` | `mazal://auth/confirm?flow=safta` | `app/(safta-auth)/signup.tsx` (behind `FEATURE_SAFTA_MODE`) |

Both URLs are defined once in `src/lib/auth/authDeepLink.ts`; use those constants
rather than re-typing the string, and keep them inside the allow list above.

`app/auth/` is a real path segment, not a route group like `app/(auth)/`, because
the `auth/` part has to appear in the URL. Both can coexist: `(auth)` contributes
`/login`, `/register`, …, while `auth/` contributes `/auth/reset-password`.

### Why the screens parse the URL themselves

The client runs `flowType: 'pkce'` and sets `detectSessionInUrl: false` (a web-only
mechanism — see `src/api/supabase/client.ts`). So a successful link comes back as
an authorization **code in the query string**:

```
mazal://auth/reset-password?code=...&type=recovery
```

while a failure arrives in the query **and** the fragment, the same params in both
(the implicit flow used only the fragment):

```
mazal://auth/reset-password?error=access_denied&error_code=otp_expired&error_description=...#error=...
```

expo-router drops the fragment before it reaches `useLocalSearchParams()`
(`extractExpoPathFromURL` keeps only host, path and query). That is why
`useAuthLink()` reads the raw URL from `Linking.useURL()` and parses the fragment
by hand. Query params such as `?flow=safta` and `?code=` do survive into
`useLocalSearchParams()`.

### Why PKCE, and what it means for the screens

The default `implicit` flow put a real access **and** refresh token in that
fragment. `mazal://` is a custom scheme nobody owns, so any app that also claims
it could read them; and an implicit link works on whatever device opens it, so a
forwarded link signed the recipient in. Under PKCE the link carries only a code,
redeemable only with the `code_verifier` supabase-js stored on the device that
asked for the link (MEXA-264).

Two consequences the code depends on:

- **`establishSessionFromAuthLink` refuses tokens-in-the-link.** This project no
  longer issues one, so such a link is either pre-PKCE or forged — and forged was
  the attack: `mazal://auth/confirm#access_token=<attacker's token>` signed the
  victim into the attacker's account, after which `type=signup` (also just a URL
  param) sent them through onboarding, uploading their photos, location and
  prompts into it.
- **The OAuth callback goes through the same door.** `signInWithOAuth` now returns
  `?code=` too, so the four Google buttons use `completeOAuthCallback()` instead of
  reading `access_token` off the callback themselves.

**All auth flows share one `code_verifier` slot** (`${storageKey}-code-verifier`).
Starting a second flow before finishing the first overwrites it and kills the
first link — sign up, tap Google before confirming your email, and the
confirmation link is dead. That surfaces as the "belongs to a different sign-in
attempt" branch of `establishSessionFromAuthLink`, which routes to "request a new
link" rather than a bare error.

### Verifying PKCE

`scripts/verify-pkce-auth-links.mjs` does it against the live project. Run it after
any change to the client's auth options. It creates and deletes its own throwaway
users.

```bash
# 5/5 — the security property, no email needed
node scripts/verify-pkce-auth-links.mjs

# 6/6 — adds the link-shape check, which needs an email to actually arrive
PKCE_TEST_MAILBOX=giftedvideo221@agentmail.to node scripts/verify-pkce-auth-links.mjs
```

The default fixture address is `@example.com`, which can be *created* (the admin
API skips the deliverability check) but cannot receive. `/recover` therefore dies
at the mailer with `500 Error sending recovery email`, no `pkce_`-prefixed token is
written, and the shape check skips. Point `PKCE_TEST_MAILBOX` at a real deliverable
address and it runs for real — the run that proved SMTP works got
`token prefix "pkce_" -> pkce: mazal://auth/reset-password?code=…` (MEXA-249).

Do **not** try to verify PKCE with the `generate_link` trick above. How GoTrue
actually decides, all of it measured here:

- It marks a link as PKCE by writing `auth.users.recovery_token` with a literal
  **`pkce_` prefix**, and `/verify` keys off that prefix.
- `generate_link` writes an *unprefixed* token, so its link is always implicit. It
  accepts `code_challenge` / `code_challenge_method` and **silently ignores** them —
  two links for the same user, one with and one without, redirect identically.
  Prepending `pkce_` to the hash it hands back does not help either: the lookup
  includes the prefix, so it 404s as `otp_expired`.
- Only `/recover`, `/signup` and `/authorize` write a prefixed token, and
  `/recover` only reaches that point **if the email actually sends**. With
  `rate_limit_email_sent` at 2/hour there is often no budget, so the script skips
  that one assertion rather than failing.

The security property does not need an email, because `/recover` writes the
`auth.flow_state` row *before* it tries to send. A 429 therefore leaves a row with
`auth_code` and `code_challenge` set but `recovery_token` empty — orphaned and
unreachable by any link, but its `auth_code` is byte-for-byte the `?code=` a real
link would have carried. The script takes it from there and shows that a second
device holding that code gets `400 pkce_code_verifier_not_found` while the device
that started the flow exchanges it into a session.

Two smaller things that measurement settled:

- **There is no project-side PKCE setting.** The auth config has no flow-type key
  at all; GoTrue supports PKCE unconditionally.
- **supabase-js deletes the `code_verifier` whenever `/recover` errors** (see the
  catch in `resetPasswordForEmail`), including on a mailer 429. So a
  rate-limited reset request leaves that orphaned flow state behind and the user
  has to start over — which is what they were going to do anyway, having received
  no email.

## Who actually sends the mail

Custom SMTP through **Resend**, configured 2026-09-28 (MEXA-249, Itai's call).
Before that it was Supabase's built-in sender, capped at 2 emails/hour for the
whole project, which could not survive more than one tester.

| Setting | Value |
|---|---|
| `smtp_host` / `smtp_port` | `smtp.resend.com` / `465` |
| `smtp_user` | `resend` (literal — not an address) |
| `smtp_pass` | Resend key, see below |
| `smtp_admin_email` | `noreply@mexantmail.com` |
| `smtp_sender_name` | `Mazal` |
| `rate_limit_email_sent` | `30`/hour |

Testers see **`Mazal <noreply@mexantmail.com>`**. Mazal has no domain of its own —
`mexantmail.com` is a verified Mexant domain (DKIM + SPF), reused so TestFlight
was not blocked on buying one. Register a real domain before a public launch;
that is new spending, so Itai decides.

`smtp_port` must be sent to the management API as a **string**; a number gets
`400 smtp_port: Invalid input: expected string, received number`.

The key is **not** the one in `archive/credentials/mexant-resend.env`. That one is
full-access and was pasted into a chat channel, so it is compromised. Mazal uses a
separate `sending_access` key restricted to the `mexantmail.com` domain
(`mazal-supabase-smtp`), kept in `archive/credentials/mazal-resend.env`. It cannot
read logs, manage keys, or send as `mexant.com` — confirmed by a 201 on send and a
401 on `GET /emails/<id>` with the same key.

### The quota is shared with mexant.com, and that has already bitten

Resend's free tier is **100 emails/day for the entire account**, not per domain.
On 2026-09-28 something sent ~200 in a day and every send failed for about six
hours — mexant.com's included. Symptom: nothing. No bounce, no error to the user,
just an email that never arrives. `GET https://api.resend.com/usage` is the only
way to see it:

```bash
curl -s -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/usage \
  | python3 -c 'import json,sys; d=json.load(sys.stdin)["emails"]["daily"]; print(d["used"],"/",d["limit"])'
```

Check that first whenever auth email "just stops". Tracked on MEXA-303. Note that
`delivered@resend.dev` still consumes quota — it simulates delivery, it is not
free — so never point a test loop at it.

## Open items

- ~~`mailer_notifications_password_changed_enabled` is off~~ — **on** since
  MEXA-264 (2026-09-28). A password change now emails the account holder, which is
  the main way someone notices a takeover. Subject and body are Supabase's
  defaults, listed under Auth → Emails.
- ~~`app/settings/password.tsx` ("Change Password" in Settings) does not call
  Supabase at all — it shows a success alert and changes nothing.~~ — fixed in
  MEXA-257; it now reauthenticates and then really calls `updateUser`.
- ~~`security_update_password_require_current_password` is off, so that
  reauthentication is client-side only~~ — **on** since 2026-09-29 (MEXA-369,
  Lelouch approved, Guts reviewed the client half on MEXA-284). GoTrue itself now
  refuses a password update that carries no `current_password`, so a modified
  client holding a stolen session can no longer take an account over from that
  screen. **Which sessions that covers is a property of the flow, and moving to
  PKCE changed the answer** — measured live with the flag on by
  `scripts/e2e/mexa369-pkce-password-update.py`:

  | Session a real Mazal user can hold | AMR | Covered by the flag |
  |---|---|---|
  | signed in with a password | `password` | **yes** |
  | just confirmed the signup email | `email/signup` | **yes** (was `otp`, and exempt, under implicit) |
  | arrived on a password-reset link | `recovery` | no — **by design**; this exemption is what keeps reset working |
  | magic link | `magiclink` under PKCE, `otp` under implicit | no, and Mazal has no email magic-link sign-in |
  | phone OTP | `otp` | no, and phone auth is off on the project |

  Recorded as a **partial** fix of MEXA-263 finding 1, not a closed one: the
  exemption list is hardcoded in GoTrue (`Session.IsRecovery()`,
  `internal/models/factor.go`), so a stolen *recovery* session is still enough to
  change a password. `eef90b8` bounds that session to a single visit rather than
  closing the hole. Closing it completely means not relying on GoTrue for the
  check — an edge function in front of the update — which Guts and I both judged
  not worth building pre-TestFlight.
