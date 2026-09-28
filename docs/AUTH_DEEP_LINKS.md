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

To verify without sending email or burning the built-in sender's rate limit, ask
the admin API for a link and see where it actually redirects:

```bash
# needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
link=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/generate_link" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"type":"recovery","email":"<an existing user>","redirect_to":"mazal://auth/reset-password"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["action_link"])')

curl -s -o /dev/null -D - --max-redirs 0 "$link" | grep -i '^location:'
# want: location: mazal://auth/reset-password#access_token=...&type=recovery
# wrong: location: mazal://#access_token=...        <- redirect_to was rejected
```

`generate_link` consumes nothing and sends no email, but the link it returns is
single-use, so following it burns that link.

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

The client runs supabase-js's default `implicit` flow and sets
`detectSessionInUrl: false` (a web-only mechanism — see
`src/api/supabase/client.ts`). So GoTrue hands the session back in the URL
**fragment**:

```
mazal://auth/reset-password#access_token=...&refresh_token=...&type=recovery
```

and failures arrive the same way:

```
mazal://auth/reset-password#error=access_denied&error_code=otp_expired&error_description=...
```

expo-router drops the fragment before it reaches `useLocalSearchParams()`
(`extractExpoPathFromURL` keeps only host, path and query). That is why
`useAuthLink()` reads the raw URL from `Linking.useURL()` and parses the fragment
by hand. Query params such as `?flow=safta` do survive into
`useLocalSearchParams()`.

PKCE (`?code=...`) is handled too, so setting `flowType: 'pkce'` on the client
later will not silently break these screens.

## Open items

- **Custom SMTP is not configured** (`smtp_host` is null), so auth email still
  goes through Supabase's built-in sender: a few messages per hour, and
  undeliverable domains are rejected outright. Blocks a real TestFlight round —
  tracked on MEXA-249.
- **`mailer_notifications_password_changed_enabled` is off**, so changing a
  password sends the account holder no notification. Worth turning on before
  launch; it is the main way someone notices an account takeover.
- `app/settings/password.tsx` ("Change Password" in Settings) does not call
  Supabase at all — it shows a success alert and changes nothing.
