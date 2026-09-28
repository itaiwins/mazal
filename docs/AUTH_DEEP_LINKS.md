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

while failures still arrive in the **fragment**:

```
mazal://auth/reset-password#error=access_denied&error_code=otp_expired&error_description=...
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

`scripts/verify-pkce-auth-links.mjs` does it end to end against the live project.
Run it after any change to the client's auth options.

Do **not** try to verify PKCE with the `generate_link` trick above. GoTrue picks
implicit vs PKCE at `/auth/v1/verify` time by looking for a *flow state* row for
the user, and only the public endpoints (`/recover`, `/signup`, `/authorize`)
create one — `generate_link` accepts `code_challenge` and silently ignores it.
Measured: two `generate_link` recovery links for the same redirect, one with
`code_challenge` and one without, both redirected `#access_token=...`. So that
test reports "not PKCE" whatever the client is set to.

There is also **no project-side PKCE setting** to turn on. The auth config has no
flow-type key at all; GoTrue supports PKCE unconditionally.

## Open items

- **Custom SMTP is not configured** (`smtp_host` is null), so auth email still
  goes through Supabase's built-in sender, which pins `rate_limit_email_sent` to
  **2 per hour for the whole project** and rejects undeliverable domains outright
  (`example.com` has no MX, so `/recover` 400s on it before it ever creates a flow
  state). Blocks a real TestFlight round — tracked on MEXA-249. One password reset
  now costs both of those emails: the recovery link plus the
  password-changed notice below.
- ~~`mailer_notifications_password_changed_enabled` is off~~ — **on** since
  MEXA-264 (2026-09-28). A password change now emails the account holder, which is
  the main way someone notices a takeover. Subject and body are Supabase's
  defaults, listed under Auth → Emails.
- `app/settings/password.tsx` ("Change Password" in Settings) does not call
  Supabase at all — it shows a success alert and changes nothing.
