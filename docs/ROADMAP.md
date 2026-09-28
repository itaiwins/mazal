# Mazal Roadmap

Last updated: 2026-09-28 (MEXA-246)

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

Only the exact string `"true"` turns a flag on. They are pinned to `"false"` in the
`env` block of every profile in [`eas.json`](../eas.json), so a stray shell variable
cannot flip them in an EAS build. To work on a feature locally, set the var in `.env`
(see [`.env.example`](../.env.example)) or in the shell:

```bash
EXPO_PUBLIC_FEATURE_SAFTA_MODE=true npx expo start --clear
```

`--clear` matters: Metro's transform cache does not invalidate on an env-var change, so
a warm cache will silently reuse the old (flag-off) bundle.

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
