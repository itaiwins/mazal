# `scripts/`

Operational scripts that run against the live Supabase project, plus the offline checks
marked as such. None of them are part of the app bundle.

| Script | What it does |
|---|---|
| `check-moderation.mjs` | **Offline** — no Supabase, no credentials, no network. Fifty-six-case corpus for the content filter (MEXA-337): every phrase a real user should be able to type has to get through `validateProfileContent` and `validateMessageContent`, every explicit or threatening one has to be refused, and contact info has to warn twice in a row rather than once. Transpiles `src/lib/moderation/index.ts` in memory, so it needs no build. Add a case whenever an ordinary answer gets wrongly rejected. |
| `check-recovery-session.mjs` | **Offline** — no Supabase, no credentials, no network. Nineteen-case check that the session a password-reset link mints cannot outlive the visit (MEXA-264). Imports the real `src/lib/auth/recoverySession.ts` and counts `signOut` calls against a stub. The case that matters is *a save that fails while still backgrounded*: the listener rightly refuses to sign out under a live `updateUser`, the write then fails, and no further AppState event is coming — the hole Guts found in `00b5ce0`. Also covers `'inactive'` **not** counting as leaving (treating it as leaving would throw away the session of anyone using a password manager) and an offline `signOut`, which auth-js reports as an error while leaving the session live. All six mutations of the module it guards are caught. |
| `check-current-password-sent.mjs` | **Offline** — no Supabase, no credentials, no network. Guards the server-side half of the password change (MEXA-272). Settings → Change Password sends `current_password` so that GoTrue verifies the old password itself, but that field is **not** in auth-js's `UserAttributes`: it reaches the wire only because `_updateUser` spreads the attributes into the request body. An auth-js that allowlisted known fields instead would drop it **silently** — no type error, no runtime error, `tsc` still clean, the screen still reporting success, and the server-side check quietly no longer applying (Guts raised this on MEXA-284). Drives the real `supabase-js` against a stub `fetch` and a stub session, then asserts what actually lands in `PUT /auth/v1/user`, that omitting the field really does leave it out (so the first case cannot pass vacuously), and that the screen still passes it. Both mutations it guards are caught: auth-js dropping the field, and the call site dropping it. Run after any `@supabase/supabase-js` or `@supabase/auth-js` bump. |
| `check-profile-labels.mjs` | **Offline** — no Supabase, no credentials, no network. 147-case corpus for the profile label helpers in `src/lib/constants/jewish.ts` (MEXA-338 finding 8). The `users` columns store an option's `id`, so a screen that renders one straight shows `modern_orthodox` — which is what the MEXA-328 walkthrough measured on the discover card (pack screen 24). Every id in all eight lists has to resolve to its own label and to contain no underscore, a missing id has to give `''` so the caller's `&&` guard keeps the chip off the screen, and a retired id has to title-case rather than vanish. The last block is a *wiring* guard, not a render test: the four files that draw these values must still import the helpers. Both mutations it guards are caught — a list entry losing its label, and a display site dropping the import. |
| `check-photo-upload-outcome.mjs` | **Offline** — no Supabase, no credentials, no network, no simulator. 58-case corpus for `describePhotoUploadOutcome` (MEXA-338 finding 13). Onboarding used to swallow every photo-upload failure into a `console.error` and finish anyway, so a flaky network put the user in the deck with a profile nobody will swipe on. Drives every picked/landed/failures combination: fewer than `MIN_PHOTOS` landed has to **block** with a retry, enough landed has to be a notice only, and a full profile has to say nothing. Two cases matter most — a short count with *no* recorded reason still has to report (that catches a new `continue` added without a `photoFailures.push`), and the reason has to reach the user, which is the defect itself. The last block greps the screen: it must still call the helper, must have no bare `catch { continue }`, and the blocking branch must not navigate. All three mutations it guards are caught. What it does **not** prove: that the dialog draws, or that the retry works — `npx tsc --noEmit` covers the wiring, the device check covers the rest. |
| `check-match-celebration-fit.mjs` | **Offline** — no Supabase, no credentials, no network, no simulator. 31-case geometry check for the match celebration's paired avatars (MEXA-338 finding 9, second half). MEXA-328 pack screen 25 caught them over both edges at 390pt, five seconds in, so where they land. Two causes: the slide-in rested at `translateX: ∓30` instead of 0, spreading the pair 60pt wider than its own row, and the photo size was a fixed 120 with no cap for narrow screens. Checks the row's left and right edges at eight iPhone widths from 320 to 440. The control block is what stops it passing vacuously: it recomputes the old `∓30` + fixed-120 layout and *requires* it to break out of the content padding — measured, that put the glow 32pt off-screen at 320pt, 4.5pt off at 375pt, and 3pt inside the bezel at 390pt. Parses the layout constants out of the component; the formula is re-implemented here (the file imports React Native) with a grep asserting the component's copy still matches. Both mutations it guards are caught. |
| `check-auth-error-messages.mjs` | **Offline** — no Supabase, no credentials, no network. 63-case corpus for `authErrorMessage()` (MEXA-338 finding 11). Signing up with a domain that cannot receive mail returned GoTrue's own "Error sending confirmation email" — a server-sounding 500 for what is a typo, with the account rolled back. Runs real GoTrue strings through the mapping for all three operations. Three properties matter beyond the wording: an **unrecognised** message is passed through unchanged (so a cause nobody anticipated is never rewritten into "something went wrong"), `only` is honoured so a signup message cannot appear on the login form, and the sign-in copy never distinguishes a wrong password from an unknown address — that distinction would make the login form a way to enumerate who is on a dating app. The last block greps the three screens. All three mutations it guards are caught. |
| `check-store-pricing.mjs` | **Offline** — no Supabase, no credentials, no network, no StoreKit. 47-case corpus for `src/lib/premium/storePricing.ts` (MEXA-338 finding 6, MEXA-387 option (a)). The paywall drew $119.99/yr and $14.99/mo out of the app's own hardcoded `PRICING` whenever RevenueCat could not load. Checks that every string comes from the package verbatim (including a non-dollar locale, so nothing formats money itself), that a missing package means a missing price rather than a fallback, that the savings badge needs **both** real prices behind it and a real saving, and what the screen may do in each of loading / ready / unavailable — including ready-but-not-for-this-period, which is the case that shipped wrong. The last block is the grep Lelouch asked for: no `PRICING` reference outside a comment, no "Demo Mode" alert, and Subscribe gated on `canPurchase`. |
| `sweep-e2e-users.mjs` | Deletes the test accounts an e2e run left behind in `auth.users`. Dry run by default. |
| `e2e/mexa272-password-cases.py` | Seven-case check that `current_password` is enforced on password / recovery / magic-link / signup sessions (MEXA-272). Cleans up after itself. |
| `e2e/mexa313-realtime-messages.mjs` | Eleven-case check that a `postgres_changes` subscription on `messages` really delivers: two sessions, one sends and the other has to hear it. The only thing that proves the chat live-updates, because `subscribe()` reports `SUBSCRIBED` whether or not any event will follow (MEXA-313). Cleans up after itself. |
| `e2e/mexa279-public-profile-reads.mjs` | Twenty-two-case check that the Orthodox / Safta / Shidduch screens read other people through `user_public_profiles` rather than `users` (MEXA-279). Runs each rewritten query as a real signed-in user and requires the *other* user's row to come back, plus the view refusing `email`, `phone`, coordinates and `last_name`. Those screens sit behind feature flags, so this is the only thing that exercises them. Refuses to run at all when the view is missing, because a missing relation also returns no rows and half the cases would pass vacuously. Cleans up after itself. |
| `e2e/mexa335-auth-lock-deadlock.mjs` | Thirteen-case check that an `onAuthStateChange` callback no longer deadlocks the auth client (MEXA-335). Case 2 asserts the *old* shape — an `async` callback awaiting a query — still hangs, so the rest cannot pass vacuously, and case 1 asserts the client is on `lockNoOp`: that is the lock React Native uses, which is how this answers "does it happen on iOS too?" without an iOS build. Imports the real handler from `src/lib/auth/authStateSync.ts` rather than a copy; Node 24 strips the types, and the `MODULE_TYPELESS_PACKAGE_JSON` warning it prints is expected. Cleans up after itself. |
| `e2e/mexa294-realtime-matches.mjs` | Fourteen-case check that mutual matching works end to end: four sessions swipe through the real API, and the pair that likes each other has to get the `matches` INSERT over realtime and a queued push, while a non-participant gets neither (MEXA-294). The app's subscription is unfiltered, so case 6 — RLS gating delivery — is what keeps publishing the table from handing every signed-in user every match. Cleans up after itself. Give realtime **two minutes** after any `ALTER PUBLICATION` before believing a failure. |

All of them except the eight offline `check-*.mjs` scripts need credentials from
`archive/credentials/mazal-supabase.env` in the workspace, which is outside this repo and
stays there:

```sh
set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
node scripts/sweep-e2e-users.mjs            # dry run
node scripts/sweep-e2e-users.mjs --apply
```

Never commit a key. The public git history already contains the old project's anon key
and a `service_role` JWT; they are inert only because that project is gone.

## Test accounts on a live project (MEXA-280)

Mazal has one Supabase project, so every end-to-end check runs against the same auth
server the app will ship against. There is no staging database to be careless in.

**The naming rule.** A test fixture account's email must be:

```
e2e-<what-it-is-for>@example.com          or   <agent>-e2e-<what-it-is-for>@example.com
```

Both halves matter. The `e2e-` label is what `sweep-e2e-users.mjs` matches on, and
`@example.com` is a domain RFC 2606 reserves for documentation and testing, so it can
never be a real person's address. The sweep deliberately leaves anything that misses
either half alone: deleting a real user costs far more than leaving one stray fixture.

**Three rules for a suite that creates accounts**, all of them learned from MEXA-280,
where two runs of one suite took `auth.users` from 3 rows to 17 and nothing removed
them. `e2e/mexa272-password-cases.py` is the worked example.

1. **Fixed fixture addresses, not timestamped ones.** Delete a stale fixture at setup
   and recreate it. A timestamped address makes a crashed run's rows unreachable and
   the next run adds a fresh set, so leakage grows without bound; a fixed address means
   the next run reclaims exactly the same rows.
2. **Tear down in `finally`, and delete by email rather than only by captured id.**
   `generate_link` creates accounts without always returning an id, so an id-only
   teardown silently misses those.
3. **Fail loudly on a teardown error - non-zero exit even if every assertion passed.**
   The rows are still live either way; only the loud version tells anyone.

**Before using row counts as a control**, sweep first. The bug that opened MEXA-280 was
an agent checking `auth.users` to confirm its own rolled-back dry run had not leaked,
and finding the count had moved for an unrelated reason.
