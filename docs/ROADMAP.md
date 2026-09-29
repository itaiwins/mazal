# Mazal Roadmap

Last updated: 2026-09-28 (MEXA-250)

## Now

Ship the core dating app — sign up, onboarding, discovery, matches, messages, Mazal Map,
profile, premium — to TestFlight. Two large side-features are built but not finished, so
they are hidden behind build-time feature flags instead of being deleted. Nothing was
removed and nothing was dropped: every file, table and migration listed below is still in
the repo and still in the schema.

Migrations *were* added, after the flag work, to make the schema apply to an empty
database at all — `00000_extensions.sql`, `00007`, `00008`, `00009`. They add an extension
and repair RLS; they drop no tables and hide no features. See
[`supabase/MIGRATIONS.md`](../supabase/MIGRATIONS.md).

## Backend

Live project: `tayiyczmacvhokdxfqvm` (Supabase Pro, us-east-1), created 2026-09-28 to
replace the deleted `keossekxijwygksqsxel`. Schema and storage buckets applied; no Edge
Functions deployed yet.

The app reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the
environment in `src/lib/config/env.ts`, `src/api/supabase/client.ts` and
`src/api/supabase/directApi.ts`. No key is committed. Local development uses a gitignored
`.env`; EAS builds read project-level environment variables stored on the Expo project for
all three environments.

## Feature flags

Defined in [`src/lib/config/features.ts`](../src/lib/config/features.ts). They read
`EXPO_PUBLIC_*` env vars, which Metro inlines at bundle time, so an unset or `"false"`
value makes the flag a compile-time constant.

| Flag | Env var | Default | Covers |
|---|---|---|---|
| `FEATURE_ORTHODOX_MODE` | `EXPO_PUBLIC_FEATURE_ORTHODOX_MODE` | off | Orthodox Shidduch mode, including the `(shidduch-*)` flow |
| `FEATURE_SAFTA_MODE` | `EXPO_PUBLIC_FEATURE_SAFTA_MODE` | off | Parents/grandparents ("Safta") matchmaker mode |
| `FEATURE_PHOTO_VERIFICATION` | `EXPO_PUBLIC_FEATURE_PHOTO_VERIFICATION` | off | ID/selfie verification: the "Verify Your Profile" action and `app/profile/verify.tsx` |
| `FEATURE_WHO_LIKES_YOU` | `EXPO_PUBLIC_FEATURE_WHO_LIKES_YOU` | off | "See who likes you": `app/likes/`, its entry point and badge on the Matches tab, **and the three places the paywall promises it** |

`FEATURE_PHOTO_VERIFICATION` is different from the other two: they hide *unfinished*
features, and turning either on gives you a working (if rough) product. This one hides a
feature that was **actively wrong**, and it must not be turned on until the server-side path
exists — see [Photo verification](#photo-verification-off-until-it-is-server-side) below.

`FEATURE_WHO_LIKES_YOU` is different again: it is the only flag that gates a **promise** as
well as a feature — see [See who likes you](#see-who-likes-you-built-flag-off) below.

Only the exact string `"true"` turns a flag on. They are pinned to `"false"` in the
`env` block of every profile in [`eas.json`](../eas.json), so a stray shell variable
cannot flip them in an EAS build. To work on a feature locally, set the var in `.env`
(see [`.env.example`](../.env.example)) or in the shell:

```bash
EXPO_PUBLIC_FEATURE_SAFTA_MODE=true npx expo start --clear
```

`--clear` matters: Metro's transform cache does not invalidate on an env-var change, so
a warm cache will silently reuse the old (flag-off) bundle.

## Premium gating and ads

Two switches decide whether a build behaves like the real product. Both are set so that
the TestFlight build a tester installs gates premium for real and shows only test ads.

| Switch | Where | TestFlight / release value | Effect |
|---|---|---|---|
| `DEV_BYPASS_PREMIUM` | [`src/lib/config/revenuecat.ts`](../src/lib/config/revenuecat.ts) | `__DEV__` → `false` | Real free-tier gating: 25 swipes/day, 1 Super Like/week, no Boost, likes/rewind/read-receipts/advanced-filters locked, banner + interstitial ads shown |
| `USE_TEST_ADS` | [`src/lib/config/ads.ts`](../src/lib/config/ads.ts), env `EXPO_PUBLIC_USE_TEST_ADS` | `"true"` | Serves Google's reserved test ad units instead of Mazal's real AdMob units |

`DEV_BYPASS_PREMIUM` is tied to `__DEV__`, which Metro inlines as `false` in any release
bundle, so there is nothing to remember to flip before a build. Local `expo start` still
gets everything unlocked.

`EXPO_PUBLIC_USE_TEST_ADS` is pinned to `"true"` in the `env` block of **all three**
profiles in [`eas.json`](../eas.json) — `development`, `preview` and `production` — so a
stray shell variable cannot flip it in an EAS build.

### Flipping `USE_TEST_ADS` to `false`

**Only for the public App Store release, and only with Itai's sign-off.** Serving real ads
to our own testers is invalid traffic under AdMob policy and can get the account
suspended, so every internal or TestFlight build keeps test ads. When the flip happens,
change only the `production` profile in `eas.json` and re-verify the bundle (below).

`AdBanner.tsx` and `useInterstitialAd.ts` read `process.env.EXPO_PUBLIC_USE_TEST_ADS`
inline rather than importing `USE_TEST_ADS`. That is deliberate: Metro inlines
`EXPO_PUBLIC_*` as a literal per module, so an inline read lets the minifier fold the
`(__DEV__ || USE_TEST_ADS) ? TestIds : real` ternary and strip the real unit IDs out of
the bundle entirely. Importing the const leaves them in (measured, MEXA-250). Verified on
the iOS export:

```bash
CI=1 EXPO_PUBLIC_USE_TEST_ADS=true npx expo export --platform ios --clear
strings -a dist/_expo/static/js/ios/*.hbc | grep -c 'ca-app-pub-3550432802315468/'   # 0
CI=1 EXPO_PUBLIC_USE_TEST_ADS=false npx expo export --platform ios --clear
strings -a dist/_expo/static/js/ios/*.hbc | grep -c 'ca-app-pub-3550432802315468/'   # 4
```

The AdMob **app** IDs in [`app.json`](../app.json) (`ca-app-pub-...~9124654238` and
`~7292697810`, tilde not slash) stay as they are in every build. The SDK needs the real
app ID to initialise, and test ad units serve fine under it.

### Purchases do not work yet

There is no RevenueCat iOS key, so `EXPO_PUBLIC_REVENUECAT_IOS_KEY` is empty and
`initializeRevenueCat()` returns without calling `Purchases.configure()`. Every later SDK
call throws `UninitializedPurchasesError`, which the wrappers in `revenuecat.ts` catch.
Nothing crashes: the paywall renders in full, `getOfferings()` returns `[]`, tapping
subscribe shows a "Demo Mode" alert naming the plan and price, and "Restore purchases"
shows "Restore Failed". **Expected for the TestFlight round** (MEXA-250).

To make purchases real: create the RevenueCat iOS app and the `mazal_gold` / `mazal_platinum`
entitlements with their four products, create the matching App Store subscriptions, and
set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` as an Expo project environment variable. The "Demo
Mode" fallback in [`app/premium/index.tsx`](../app/premium/index.tsx) should go at the
same time, and the Gold/Platinum prices ($14.99/$29.99 monthly) need Itai's review before
anyone outside the team sees them.

---

## See who likes you: built, flag off

Flag: **`FEATURE_WHO_LIKES_YOU`** (off, pinned `"false"` in all three `eas.json` profiles).
MEXA-315.

Every other flag hides a feature. This one also hides the **promise** of one, and that is
the reason it exists. The paywall has been selling "See who likes you" as the headline Gold
benefit since the beginning and nothing behind it had ever been built: there was a React
Query key, `queryKeys.swipes.whoLikedMe()`, whose only reference in the repo was an
`invalidateQueries` inside a realtime hook that MEXA-294 deleted because it could never
fire. No query function, no hook, no screen, no route. Nothing had ever read "who liked me".

### What the flag covers

| On | Off |
|---|---|
| `app/likes/` — the Likes screen | not reachable; a deep link redirects to Matches |
| The "Likes You" row and its badge at the top of the Matches tab | not rendered |
| `see_likes` in the Gold feature list (`PREMIUM_FEATURES`) | absent |
| The "See who likes you" row in `PLAN_COMPARISON` | absent |
| The upgrade banner's "See who likes you, unlimited swipes & more" | "Unlimited swipes, Super Likes & more" |
| `PaywallPromptModal`'s `see_likes` card | never selected |

"Off" means **not rendered**, not "absent from the binary". `babel-preset-expo` inlines
`process.env.EXPO_PUBLIC_*` inside `features.ts`, but the flag then crosses a module
boundary as an imported binding and neither Metro's minifier nor Hermes does cross-module
constant propagation — so the branches stay, and both strings sit in the Hermes string
table. Every flag here behaves that way: with `FEATURE_SAFTA_MODE` off, the literal "Safta"
still appears 14 times in an `npx expo export --platform ios` bundle. **Do not grep a
`.hbc` to check a flag** — Hermes packs and dedups its string table, so `grep -a -F` finds
some present strings and misses others. `.scratch/mazal-mexa315/check-paywall-copy.mjs` is
the check: it loads the real modules with the env var set both ways and reads the exported
arrays.

### The backend

`supabase/migrations/00026_who_liked_me.sql` — two `SECURITY DEFINER` functions over one
internal one. Not a policy on `swipes`, and that is the central decision: the only SELECT
policy there is `swiper_id = <me>`, and a policy admitting `swiped_id = <me>` would publish
**"who passed on you"** in the same breath, because RLS restricts rows and not values.
MEXA-294 and `00017` both declined to widen it for that reason and this feature does not
either. `public.swipes` keeps exactly the two policies `00002` gave it, asserted in the
migration's post-check.

- `count_who_liked_me()` → an integer, granted to **every** signed-in caller. It is the
  upsell ("3 people like you"), it names nobody, and it never counts a `pass`.
- `get_who_liked_me(limit, offset)` → the list. Both arguments are paging only and clamped
  server-side; neither names a user, so identity still comes from `current_app_user_id()`.
- Excluded from both: a `pass`, anyone blocked in either direction, anyone deactivated or
  mid-onboarding, anyone you have already swiped on, and anyone you have already matched.
  All of it server-side — `src/api/queries/useWhoLikedMe.ts` filters nothing.

### Before turning it on

1. **Apply `00026`** to the project the build points at. Without it both RPCs are 404s from
   PostgREST and the screen shows its error state. It needs Guts's review (it is a new
   SECURITY DEFINER path over other people's data) and Lelouch's approval, like every
   migration.
2. **Lelouch signs off on shipping it**, because it is a user-visible new feature on a paid
   tier (MEXA-273).
3. Know that **the Gold gate is `useCanSeeLikes()` on the device only.** There is nothing
   server-side to check: `public.subscriptions` is RevenueCat's webhook table and no webhook
   is deployed, so it is empty and a server-side gate would refuse every paying user. A free
   user who called `/rest/v1/rpc/get_who_liked_me` directly would get the list. That is a
   revenue leak and not a privacy one — the list only ever contains likes aimed at the
   caller, and a `pass` never leaves the database whatever anyone has paid. **MEXA-373** is
   what closes it; the migration header argues the distinction at length.

### No realtime

The badge is polled, not subscribed. A `postgres_changes` subscription on `swipes` is what
MEXA-294 removed and MEXA-313 explains: the event never survives realtime's RLS re-check for
the person who was swiped on, and publishing the table would put `pass` rows on the
replication stream. The count refetches on focus and `useSwipe` invalidates it, so answering
somebody removes them from the list and the badge together.

---

## Photo verification: off until it is server-side

Flag: **`FEATURE_PHOTO_VERIFICATION`** (off, pinned `"false"` in all three `eas.json`
profiles). MEXA-359.

`users.is_verified` is the trust badge other users see — the swipe card, the profile story,
the hero photo, the matches list. It is supposed to mean a selfie was matched against a
government ID at >= 90% similarity. It meant nothing of the kind:

- No verification provider is configured in any build. `EXPO_PUBLIC_AWS_*` is set nowhere —
  not in `.env`, not in any `eas.json` profile, not in EAS environment variables — so
  `isVerificationConfigured()` was false everywhere, including TestFlight.
- An unconfigured provider used to mean *mock mode*, not failure. `verifyMock()` returned
  `verified: Math.random() > 0.1` with a hardcoded `confidence: 0.95`, and
  `verifyIdentity()` then wrote `is_verified = true` on the strength of it. **The shipped
  app's "Verify Your Profile" button awarded the real badge on a coin flip** after the user
  photographed anything at all.
- `authenticated` also held `UPDATE (is_verified)` directly, so any account could set the
  badge with a single `PATCH /rest/v1/users?id=eq.<self>`.
- The AWS path read its key from `EXPO_PUBLIC_AWS_ACCESS_KEY_ID`, which Metro inlines into
  the bundle. Configuring it as written would have shipped a long-lived AWS secret key
  inside the IPA.

What changed (MEXA-359 Part A):

| Change | Where |
|---|---|
| `UPDATE (is_verified)` revoked from `authenticated`; `service_role` only | [`00024_revoke_self_awarded_verified_badge.sql`](../supabase/migrations/00024_revoke_self_awarded_verified_badge.sql) |
| Entry point hidden, route redirects | [`app/(tabs)/profile.tsx`](../app/(tabs)/profile.tsx), [`app/profile/verify.tsx`](../app/profile/verify.tsx) |
| `EXPO_PUBLIC_AWS_*` names deleted; `verifyWithAWS()` removed | [`src/lib/config/env.ts`](../src/lib/config/env.ts), [`src/api/services/verificationService.ts`](../src/api/services/verificationService.ts) |
| `verifyMock()` and the client-side `is_verified` write removed | `src/api/services/verificationService.ts` |
| Unconfigured provider is now a hard failure, not mock mode | `src/api/services/verificationService.ts` |

The screen, its copy, the ID-type list and the photo capture flow are all untouched, so
Part B has a UI to reconnect.

**Turning this flag on will not restore verification, and must not be attempted as a
shortcut.** `00024` **is applied to live** (2026-09-29 06:34Z), so with the flag on the flow
reaches its old database write and gets `42501: permission denied for table users`. What it
needs (**MEXA-367**, Part B):

1. A Supabase Edge Function that receives the selfie and the ID, calls Rekognition
   **server-side**, and writes `is_verified` as `service_role`.
2. AWS credentials **only** as a Supabase Edge Function secret, on a dedicated IAM user
   limited to `rekognition:CompareFaces`. Never `EXPO_PUBLIC`, never in the repo.
3. No on-device pre-check. A device check proves nothing to anyone else, and it is what put
   credentials in the bundle in the first place.
4. Deletion of the ID photos after the compare, per the retention rules in MEXA-253. These
   are people's identity documents.

Rekognition is a paid AWS service and there is no Mexant AWS account, so Part B (**MEXA-367**)
needs Itai's spending decision before it can start.

Until it lands, **`is_verified` is unreachable: no client can write it and no server does.**
That is the intended resting state — no badge is better than a badge that lies — but it means
a `true` in that column today is evidence of a manual write, not of a verification.

`is_photo_verified` is the other half of the pair and needed nothing: no code has ever
written it, and `authenticated` has never held the privilege. `ONFIDO_API_TOKEN`,
`JUMIO_API_TOKEN` and `JUMIO_API_SECRET` are still read from `EXPO_PUBLIC_*` in
`src/lib/config/env.ts` — the same bundling hazard as the AWS keys, harmless only because
nothing sets them and the code reading them is unreachable behind this flag. They should
leave with the on-device providers in Part B.

---

## Future: Parents/grandparents mode ("Safta")

A second app persona. A parent or grandparent signs up as a "Safta", connects to a
relative with an invite code, browses on their behalf, and sends approved profiles into
the relative's inbox. Flag: **`FEATURE_SAFTA_MODE`**.

### What exists today

Routes (all still in `app/`, each group's `_layout.tsx` redirects to `/` while the flag
is off):

- `app/(safta-auth)/` — welcome, login, signup, enter-code, profile-setup, complete, paywall
- `app/(safta-tabs)/` — index (discover), messages, profile
- `app/(safta)/` — index, setup, connect, browse, likes (older stack, superseded by `(safta-tabs)`)
- `app/(tabs)/safta.tsx` — the Safta tab inside the regular user app: generates the invite link and lists connected Saftas
- `app/(tabs)/safta-chat/[connectionId].tsx` — user ↔ Safta chat

Shared code:

- `src/features/safta/hooks/useSaftaRecommendations.ts`
- `src/stores/saftaPremiumStore.ts` (Safta Pro entitlements)
- `src/api/queries/useSaftaConnections.ts`, `src/api/queries/useSaftaMessages.ts`
- `src/api/mutations/useSaftaMessage.ts`
- `src/components/discovery/SaftaBadge.tsx`, `src/components/chat/SendToChatsModal.tsx`
  (Saftas section), `src/components/chat/ProfileShareMessage.tsx` (`isSafta`),
  `src/components/matches/ConversationCard.tsx` (`isSafta`), `src/components/ui/GlassCard.tsx`
  (`SaftaGlassCard`)
- `src/theme/colors.ts` — `colors.safta.*` purple/lavender palette
- `src/lib/config/queryClient.ts` — `queryKeys.safta.*`
- `src/lib/config/revenuecat.ts` — `ENTITLEMENTS.SAFTA_PRO`, `PRODUCTS.SAFTA_PRO_*`,
  `SAFTA_FEATURE_LIMITS`, `SAFTA_PLAN_COMPARISON`, `PREMIUM_FEATURES['safta_pro']`
- `src/lib/constants/app.ts` — `MAX_SAFTA_CONNECTIONS`
- `src/lib/notifications/notificationService.ts` — `safta_like` notification type
- `src/lib/demo/demoProfiles.ts` — `DEMO_SAFTA_CONNECTIONS`

Tables / migrations (untouched, nothing dropped): `safta_accounts`, `safta_connections`,
`safta_likes`, `safta_messages` — `supabase/migrations/00004_safta_messages.sql`,
`supabase/migrations/00006_safta_pro.sql`.

### Where it is hidden

| Surface | File |
|---|---|
| "I'm a Parent or Grandparent" button + the "or" divider above it | `app/(auth)/welcome.tsx` |
| Root routing into Safta mode | `app/index.tsx` |
| `setCurrentMode('safta')` / `toggleMode()` are no-ops | `src/stores/authStore.ts` |
| "Switch to Safta Mode" settings section | `app/settings/index.tsx` |
| "…delete BOTH your dating profile AND your Safta account" delete-account copy | `app/settings/index.tsx` |
| "What is Safta Mode?" FAQ entry | `app/settings/help.tsx` |
| "Safta approvals" notification toggle | `app/settings/notifications.tsx` |
| Safta dot-nav tab (also `href: null` on the route) | `app/(tabs)/_layout.tsx` |
| Discover/Saftas mode tab row | `app/(tabs)/index.tsx` |
| "Saftas" tab + "From Your Saftas" section in Matches | `app/(tabs)/matches.tsx` |
| "Safta Approvals" profile stat + its `safta_likes` count query | `app/(tabs)/profile.tsx` |
| 👵 map marker badge + "N Saftas approved" preview row | `app/(tabs)/mazal-map.tsx` |
| `SaftaBadge` renders `null` (covers every caller, e.g. `ProfileStory`) | `src/components/discovery/SaftaBadge.tsx` |
| Group route guards (`Redirect` to `/`) | `app/(safta-auth)/_layout.tsx`, `app/(safta-tabs)/_layout.tsx`, `app/(safta)/_layout.tsx` |
| Screen guards | `app/(tabs)/safta.tsx`, `app/(tabs)/safta-chat/[connectionId].tsx` |
| Queries disabled (`enabled: … && FEATURE_SAFTA_MODE`) | `src/api/queries/useSaftaConnections.ts`, `src/api/queries/useSaftaMessages.ts` |
| `safta_likes` discovery boost query skipped | `src/api/queries/useDiscoveryProfiles.ts` |

### What turning it back on needs

1. Set `EXPO_PUBLIC_FEATURE_SAFTA_MODE=true` (eas.json profile env and/or `.env`).
2. Nothing to do for the schema: the `safta_*` tables and their RLS policies are already
   applied to the live project (`supabase/MIGRATIONS.md`). Their policies were checked for
   the recursion problems found elsewhere and are clean.
3. A real invite/deep-link flow. `app/(tabs)/safta.tsx` currently fabricates a link
   (`https://mazal.app/invite/<first 8 chars of user id>`) that nothing resolves.
4. `src/components/chat/SendToChatsModal.tsx` still has a hardcoded mock chat
   (`id: 'safta-1'`) in its Saftas section — replace with real connections.
5. RevenueCat: create the `safta_pro` entitlement and the `safta_pro_monthly` /
   `safta_pro_yearly` products, and the matching App Store subscriptions.
6. Push: the `safta_like` notification needs a server-side trigger.
7. Product review of the Safta paywall copy and pricing (`$14.99/mo`, `$119.99/yr`)
   before it is shown to anyone.

---

## Future: Orthodox Shidduch mode

A separate, paid, non-swiping experience: shidduch resumes, shadchan directory,
references, Shabbat-aware behaviour. Flag: **`FEATURE_ORTHODOX_MODE`**.

### What exists today

Routes (each group's `_layout.tsx` redirects to `/` while the flag is off):

- `app/(orthodox-auth)/` — welcome, register, login, paywall
- `app/(orthodox-onboarding)/` — welcome, basics, background, complete
- `app/(orthodox-tabs)/` — index, shadchan, matches, profile
- `app/(orthodox)/` — index, guidelines, shidduch, shadchan, paywall
- `app/(shidduch-onboarding)/` — welcome, creator-type, basics, family, education,
  hashkafa, looking-for, references, photos, complete
- `app/(shidduch-tabs)/` — index, browse, connections, my-profiles, shadchanim, profile

Shared code:

- `src/stores/shidduchOnboardingStore.ts`
- `src/components/shidduch/ShabbatModeScreen.tsx`
- `src/services/shabbatService.ts` (also used by the general "Jewish Life → Shabbat Mode"
  setting, which is **not** flagged)
- `src/stores/uiStore.ts` — `isOrthodoxMode`, `hasOrthodoxSubscription`
- `src/lib/config/revenuecat.ts` — `ENTITLEMENTS.ORTHODOX`, `PRODUCTS.ORTHODOX_*`,
  `PREMIUM_FEATURES['mazal_orthodox']` ("Orthodox-only dating pool", "Shadchan directory
  access", `$49.99/mo`, `$399.99/yr`)
- `docs/SHIDDUCH_SYSTEM.md`, `docs/SHIDDUCH_PRODUCT_OVERVIEW.md`

Tables / migrations (untouched): `shidduch_profiles` and the rest of
`supabase/migrations/20250114_shidduch_system_fixed.sql`, plus
`supabase/migrations/00005_orthodox_mode.sql`.

### Where it is hidden

| Surface | File |
|---|---|
| "Orthodox Shidduch / Coming Soon" locked button from `b1bcfc0` | `app/(auth)/welcome.tsx` |
| Root routing on `isOrthodoxMode` (also ignores a stale persisted `true`) | `app/index.tsx` |
| `setOrthodoxMode(true)` is a no-op | `src/stores/uiStore.ts` |
| `shidduch_profiles` lookups on startup and on Apple sign-in | `app/_layout.tsx`, `app/(auth)/login.tsx` |
| Group route guards (`Redirect` to `/`) | `app/(orthodox)/_layout.tsx`, `app/(orthodox-auth)/_layout.tsx`, `app/(orthodox-onboarding)/_layout.tsx`, `app/(orthodox-tabs)/_layout.tsx`, `app/(shidduch-onboarding)/_layout.tsx`, `app/(shidduch-tabs)/_layout.tsx` |

**The `b1bcfc0` lock lives inside the flag.** With the flag off the button is gone
entirely; with the flag on you get exactly what `main` showed — a greyed-out button with
a "Coming Soon" badge and an alert. When the flow is genuinely ready, replace that
`Pressable` in `app/(auth)/welcome.tsx` with `<Link href="/(orthodox-auth)/welcome">`.

### Note on the `(shidduch-*)` routes

They are gated by `FEATURE_ORTHODOX_MODE`, because `app/index.tsx` only ever routes into
them via `isOrthodoxMode`, and `(shidduch-onboarding)/_layout.tsx` describes itself as
the Orthodox shidduch-resume flow. They do overlap the parents/grandparents idea —
`(shidduch-onboarding)/creator-type.tsx` lets a parent, grandparent, aunt/uncle or
shadchan build a profile for someone else. If parents mode comes back first and wants
that flow, either move those guards to `FEATURE_SAFTA_MODE` or split the two entry
points.

### What turning it back on needs

1. Set `EXPO_PUBLIC_FEATURE_ORTHODOX_MODE=true`.
2. Replace the "Coming Soon" lock in `app/(auth)/welcome.tsx` with the real link.
3. The schema is already applied to the live project (`supabase/MIGRATIONS.md`), but the
   shidduch RLS needs a proper security review before any real profile is stored:
   - `00009_fix_shidduch_profiles_policy_recursion.sql` repaired three policy cycles that
     made every read of `shidduch_profiles` fail with 42P17, and closed an anonymous read
     of every `profile_visible = true` profile. Those rewrites have never been exercised
     against real data, because the feature is off.
   - `20250114_add_creator_tracking.sql` compares `shidduch_profiles.user_id` and
     `created_by_user_id` against `auth.uid()`. Those columns hold `public.users` ids,
     while `auth.uid()` is an `auth.users` id — two different id spaces, so those branches
     can never match. Left alone deliberately: guessing at the intent of an ownership
     rule is how you write a hole. Decide what it should mean, then fix it.
4. RevenueCat: `mazal_orthodox` entitlement + `mazal_orthodox_monthly` / `_yearly`
   products and the App Store subscriptions. The $49.99/mo price is unreviewed.
5. Real shadchan data — the directory has no backing content.
6. A rabbinic/community review of the guidelines and matching rules before launch, and
   Itai's sign-off on all Orthodox-facing copy.

---

## Deliberately not flagged

- **"Orthodox" and "Modern Orthodox" denominations** in
  `src/lib/constants/jewish.ts`, used by the Jewish-identity onboarding step. These are
  ordinary profile attributes for any Jewish dating app, not the Orthodox *mode*.
- **Shabbat Mode** in Settings → "Jewish Life" (`app/settings/index.tsx`,
  `src/services/shabbatService.ts`). It pauses the app from Friday sunset to Saturday
  nightfall for any user who wants it, independent of Orthodox mode.
- **Deleting a Safta account on account deletion**
  (`src/api/mutations/useProfile.ts`) — kept running so that any pre-existing
  `safta_accounts` row is still cleaned up when a user deletes their account.
- **The `safta_like` notification handler** in
  `src/lib/notifications/notificationService.ts` — inert with no Safta connections, and
  harmless if an old queued push arrives.
- **Internal names** (`colors.safta.*`, `queryKeys.safta.*`, `SaftaGlassCard`,
  `MAX_SAFTA_CONNECTIONS`). No user ever sees them.

A note on what "hidden" means here: both features are unreachable at runtime and no copy
about them renders. Their strings and route files are still compiled into the JS bundle,
because expo-router bundles every file under `app/`. That is invisible to users but would
be visible to anyone who unpacked the binary.
