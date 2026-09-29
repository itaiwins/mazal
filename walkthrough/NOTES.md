# What the walkthrough turned up (MEXA-328)

Everything below was seen in a real render of the app — the `expo export --platform web`
build of `mazal-restart`, driven in headless Chrome at a 390×844 phone viewport, signed in
against the live Supabase project `tayiyczmacvhokdxfqvm`. Nothing is a mockup and nothing
is from reading code alone unless it says so.

**None of this was fixed here.** MEXA-328 asked for the list, not the repairs. Repairs
happen on their own issues since; a finding that has been fixed says so at the top of it.

## How to read the "iOS?" line

The pack is a *web* render of an app that ships to iOS. Two different things can make a
screen look wrong here:

* **a real defect** — app code that will behave the same on a device, and
* **a web-render limitation** — a native module that has no web implementation.

Every finding says which, and where I could not tell from this machine it says that too.
The ones marked "must be checked on a device" are the ones a TestFlight build settles in a
minute and this render cannot.

---

# Blockers — check these before a build goes to testers

## 1. Tapping the confirmation link signs you in, then wedges the app

> **Fixed on MEXA-335.** The callback below is synchronous now and the profile fetch is
> deferred out of the auth lock — `src/lib/auth/authStateSync.ts`. Re-checked in this
> same render: `walkthrough/check-auth-entry.mjs --with-confirm`, case 7. The "iOS?"
> question below is answered too, and the answer was yes: `scripts/e2e/mexa335-auth-lock-deadlock.mjs`
> reproduces the deadlock on `lockNoOp`, which is the lock React Native uses.

*Pack screens 7–8.* The link from the real confirmation email lands on
`app/auth/confirm.tsx`, which shows "Confirming your email…" and never changes. The
sign-in itself **works**: the console shows the session written to storage and a
`SIGNED_IN` event fire. So the account is confirmed and signed in behind a spinner that
never clears. After that, every other route in that instance renders blank as well — I
routed to `/login` and to `/` and got a white screen both times.

`establishSessionFromAuthLink()` awaits `supabase.auth.exchangeCodeForSession(code)`. The
exchange succeeds; the promise never resolves, so `setStatus('confirmed')` is never
reached.

**Cause, most likely:** `app/_layout.tsx` registers an `async` `onAuthStateChange`
callback that `await`s a Supabase query:

```ts
const { data: { subscription } } = onAuthStateChange(async (event, session) => {
  ...
  const { data: profile } = await supabase.from('users').select('*')...   // ← inside the auth lock
```

supabase-js runs that callback while holding its auth lock and waits for it, so a Supabase
call inside it waits for the lock it is already inside. Supabase documents this exact
shape as a deadlock. The same callback is the cause of finding 2.

**iOS?** Not verified. Nothing web-specific is involved except which lock implementation
supabase-js picks (`navigator.locks` on web, an in-process lock elsewhere), so I would
assume it reproduces until a device says otherwise. **Must be checked on a device.**

## 2. Reopening the app with a saved session is a permanent blank screen

> **Fixed on MEXA-335**, same cause and same fix as finding 1. Re-checked in this render:
> `walkthrough/check-auth-entry.mjs`, cases 3–5, which assert on the console line that
> used to be the last one printed.

*Reproduced on its own, outside the pack — this is why the pack's step 9 starts from a
fresh launch.* Sign in, then load the app again with the session still in storage: white
screen, forever. The console stops dead right after `Auth event: SIGNED_IN | Has session:
true` — `[Layout] Got session:` never prints, so `setInitialized`/`setIsReady` never run
and `RootLayout` keeps returning `null`.

That is every returning user's second launch.

Same callback as finding 1. A first launch on a fresh install is fine, which is exactly
why it would survive a quick smoke test and then hit every tester on day two.

**iOS?** Same caveat as finding 1. **Must be checked on a device.**

## 3. The tab bar renders a stray `0`

*Visible at the bottom of pack screens 24–28 and 31.* `src/components/navigation/DotNavigator.tsx:60`:

```tsx
{badge && badge > 0 && (
  <View style={styles.badge}>…</View>
)}
```

`badge` is `unreadMatchesCount`, which starts at `0`. `0 && …` evaluates to `0`, and React
renders the number. On web that is a visible stray "0" under the tab dots — you can see it
in the pack. **On React Native a bare number as a child of a `View` is an invariant
violation** ("Text strings must be rendered within a `<Text>` component"), which would
throw on every tabbed screen for a user with no unread matches — i.e. every new user.

Fix is `badge ? … : null`, or `(badge ?? 0) > 0 &&`.

**iOS?** **Must be checked on a device**, and this one is a one-line change either way.

---

# Things a tester will trip on

## 4. The profanity filter rejects "home", "hope", "host", "hot", "holiday", "honestly"

`src/lib/moderation/index.ts:20` — `/\b(wh+o+r+e+|h+o+)\w*/gi`. The `h+o+` alternative
matches "ho" at a word boundary and `\w*` swallows the rest of the word, so **any word
starting with "ho" is flagged as explicit.** Measured:

| text | verdict |
|---|---|
| `Friday night dinners at home with my family` | BLOCKED (`home`) |
| `I hope to travel more` | BLOCKED (`hope`) |
| `I host Shabbat most weeks` | BLOCKED (`host`) |
| `Honestly? Cholent.` | BLOCKED (`Honestly`) |
| `Hockey, hiking and hot soup` | BLOCKED (`Hockey`, `hot`) |

`/\b(die|death\s+threat)\b/gi` on line 30 does the same to "I will die on that hill".

This runs on **profile prompts** (`validateProfileContent`, used by
`app/(onboarding)/prompts.tsx`) and on **chat messages** (`validateMessageContent`, used by
`src/api/mutations/useMessage.ts`). On a Jewish dating app, "home", "host" and "holiday"
are not edge cases — I hit it on my first attempt at a prompt answer and had to rewrite the
fixture copy to get through onboarding. The user-facing message is "This content contains
inappropriate language. Please revise.", with no indication of which word.

**iOS?** Pure JS. Identical on device.

## 5. There is no "likes" screen, and Gold sells one

MEXA-328's screen list has "likes" in it. There is no such screen. Searching the whole app
for it turns up only marketing: "See who likes you" on the paywall
(pack screen 30), on the profile upsell (screen 28), and in `FeatureGate.tsx`.
`useDiscoveryProfiles.ts:230` does compute `has_liked_me` per candidate — but the only
thing that reads it is the sort on line 238. **No screen and no card badge ever shows it**,
so a paying Gold subscriber gets nothing for that bullet.

## 6. The paywall shows prices that did not come from the App Store

*Pack screen 30.* RevenueCat could not load offerings in this render (it is a native
module), and the paywall drew **$119.99/yr and $14.99/mo anyway**, from the app's own
fallback copy. So if StoreKit is slow or unreachable on a device, a tester sees confident
prices that no store quoted. Worth deciding what that screen should do with no offerings —
App Review is also touchy about prices that do not come from StoreKit.

## 7. "Continue with Apple" and "Continue with Google" are dead

`app/(auth)/login.tsx` and `register.tsx` both offer them (pack screens 2 and 4). The live
project has **both providers disabled** — `GET /auth/v1/settings` on
`tayiyczmacvhokdxfqvm` returns `"apple": false, "google": false`. Every tester who taps
one gets an error. Either turn them on or take the buttons out before the build ships.
(Note that Apple requires Sign in with Apple *if* you offer other social logins, so
"Google only" is not an option.)

## 8. The discover card shows raw database values

*Pack screen 24.* Rivka's chips read **`modern_orthodox`** and **`somewhat_observant`** —
enum values straight out of `users`, underscores and all. The labels exist already, in
`src/lib/constants/jewish.ts` ("Modern Orthodox", "Somewhat Observant"); the card just is
not using them.

## 9. The tab bar overlaps content, and the match screen is cut off at iPhone width

*Pack screens 24, 26, 27, 28.* `DotNavigator` is absolutely positioned and the screens
under it have no matching bottom inset, so "Drag dots to navigate" and the dots sit **on
top of** the discover action buttons, the chat composer, and the first row of the profile's
Account list.

On the match screen (pack screen 25) the two paired avatars **run off both edges of the
screen** at 390pt, which is iPhone 14/15/16 width. The screenshot is taken 5s after the
animation starts, so it is where they land, not a frame mid-flight.

**iOS?** Layout maths, same on device — but `useSafeAreaInsets()` returns different values
on a real device, so **confirm on a device** before calling the overlap a measurement.

## 10. Match counts disagree with each other

Right after a real match: the Matches screen shows the conversation with a "1" tab badge
and "2" unread (pack screen 26, correct), while the profile tab says **"0 Matches"**
(screen 28) and the tab-bar badge says **0**. Three surfaces, three answers.

## 11. A sign-up to an address that can't receive mail dies with a confusing error

Measured on the live project: signing up as `…@example.com` returns HTTP 500 and the form
shows **"Error sending confirmation email"** — and GoTrue rolls the account back, so the
user has nothing and no idea why. Any tester who fat-fingers a domain lands here. (This is
also why fixture A in this pack is on a real mailbox and not the `@example.com` address
`scripts/README.md` normally requires.)

A deliverable address works: the confirmation mail sent for this run arrived through Resend
in a few seconds.

## 12. There are two Edit Profile screens, and the unfinished one shadows the Profile tab

`app/profile/index.tsx` is an older, **light-themed** Edit Profile that does not load the
user's data — empty photo grid, empty bio, no prompts — sitting next to the finished dark
one at `app/profile/edit.tsx` (pack screen 29, correct). Nothing in the app pushes
`/profile/index`, so on iOS it looks like dead code; on web it collides with
`app/(tabs)/profile.tsx` for the `/profile` URL and wins. Worth deleting either way — a
half-built screen in the tree is the kind of thing that gets wired up by accident.

## 13. Photo upload failures during onboarding are silent

Fixture A finished onboarding having picked two photos and ended up with **zero rows in
`user_photos`** — so her profile, her own profile tab and her face on the match screen are
all blank in this pack.

**This one is mostly a web-render limitation**, and I am not calling it a bug:
`app/(onboarding)/complete.tsx` reads the picked file with
`FileSystem.readAsStringAsync(uri)`, and on web the picker hands back a `blob:` URI that
expo-file-system cannot read. On a device it is a `file://` path and this works.

What *is* worth a look is the handling: the upload is wrapped in `try { … } catch { continue; }`,
so a failure for any reason — a flaky network on a device, a storage 4xx — drops the photo,
finishes onboarding and drops the user into the deck with a profile nobody will swipe on,
with no error shown. **Check on a device** that a failed upload says something.

---

# What this render could not show

Not findings; limits of screenshotting a native app through a web export. All three are
guarded `require()`s in app code already, so what you see in the pack is the app's own
fallback branch, not a stand-in I drew (`walkthrough/web-shims/`).

| Native-only | Screens affected | What the pack shows instead |
|---|---|---|
| `react-native-google-mobile-ads` | the banner slot on Discover | nothing — `AdBanner` returns `null` when the module is missing, which is also what a Gold subscriber sees |
| `react-native-maps` | the Map tab (pack screen 37) | `mazal-map.tsx`'s own "map unavailable" branch |
| `react-native-purchases` | the paywall (pack screen 30) | the app's no-offerings state — see finding 6 |

Also not visible here, and not bugs:

* **`Alert.alert` is a no-op in react-native-web.** So the sign-up "Check your email"
  alert (pack screen 6) and the **Delete Account confirmation** (screen 34) do not draw.
  The delete flow is `app/settings/index.tsx:158`: a two-button
  `Alert.alert('Delete Account', …)` whose destructive button calls
  `useDeactivateAccount().mutate(true)`. The row itself is in the pack; the dialog can only
  be screenshotted on a device.
* **`zustand/middleware` puts `import.meta.env` in the web bundle**, which a classic
  `<script>` cannot parse, so the whole bundle died on load until it was patched out
  (`walkthrough/patch-export.mjs`). Web-only — Metro resolves a different zustand build for
  native. Not a product issue, but it is why that script exists.

---

# Orthodox and Safta are not reachable

Both flags are off (`EXPO_PUBLIC_FEATURE_ORTHODOX_MODE` / `EXPO_PUBLIC_FEATURE_SAFTA_MODE`
are `false` in `.env` and pinned off in every `eas.json` profile), and `EXPO_PUBLIC_*` is
inlined by Metro, so the branches are statically dead in the bundle. In this render I could
not reach a single Orthodox, Shidduch or Safta screen: no entry point exists in the UI —
the welcome screen's mode switch, the root router in `app/index.tsx`, and the Safta tab in
`app/(tabs)/_layout.tsx` are each behind a flag — and forcing the URL directly (something
only the web render even allows) hits the `<Redirect href="/" />` in the hidden groups'
layouts and shows nothing. Nineteen flagged routes tried, all blank.
