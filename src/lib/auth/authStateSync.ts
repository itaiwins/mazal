/**
 * Auth state synchronisation
 *
 * Keeps the auth store in step with supabase-js's `onAuthStateChange`, and loads the
 * `public.users` row that belongs to the signed-in account.
 *
 * ## Why this is its own module, and why the handler is synchronous (MEXA-335)
 *
 * `app/_layout.tsx` used to register an `async` callback that `await`ed
 * `supabase.from('users').select(...)` inline. That deadlocks the whole client, and it
 * is not a subtle race — it happens every time:
 *
 *  1. On a launch with a session already in storage, `auth.getSession()` runs
 *     `_acquireLock` -> `_initialize` -> `_recoverAndRefresh`, which `await`s
 *     `_notifyAllSubscribers('SIGNED_IN', session)`. So the callback runs *inside* the
 *     lock, and the lock's operation cannot finish until the callback does.
 *  2. The callback `await`s a PostgREST query. Every PostgREST request asks the auth
 *     client for the access token, which calls `getSession()`, which calls
 *     `_acquireLock` again.
 *  3. `_acquireLock` sees `lockAcquired === true` and takes its re-entrant branch:
 *     `await last`, where `last` is the still-running outer operation from step 1.
 *     The outer operation is waiting on the callback, the callback is waiting on the
 *     query, and the query is waiting on the outer operation. Nothing ever resolves.
 *
 * The two symptoms on MEXA-335 were both this: the confirm screen's
 * `exchangeCodeForSession()` never returned (spinner forever, then every route blank),
 * and a second launch never got past `Auth event: SIGNED_IN` (white screen forever,
 * because `RootLayout` returns `null` until its `prepare()` resolves).
 *
 * **This is not web-specific.** Step 3 lives in `_acquireLock`, above the lock
 * primitive, so it happens whichever lock supabase-js picked. Measured on
 * `@supabase/auth-js` 2.90.1: React Native gets `lockNoOp` (`isBrowser()` is false
 * there, since `document` is undefined) and deadlocks exactly the same way — see
 * `scripts/e2e/mexa335-auth-lock-deadlock.mjs`, which reproduces it on that path.
 *
 * So: **never `await` a Supabase call inside an `onAuthStateChange` callback, and never
 * make the callback `async`.** `createAuthStateHandler` returns a synchronous function.
 * It writes the session to the store immediately (that part is just zustand) and hands
 * the profile fetch to `defer()`, which is `setTimeout(fn, 0)` — a macrotask, so the
 * query runs outside the callback and cannot be what the lock is waiting for.
 *
 * ## Two other things the old callback got wrong
 *
 * - **It refetched the profile on every `TOKEN_REFRESHED`**, i.e. hourly, forever, for a
 *   row that a token refresh cannot have changed. The handler skips that when it already
 *   has the row for that account.
 * - **A failed fetch cleared the stored profile.** `setUser(null)` also sets
 *   `isOnboardingComplete: false`, so one flaky request pushed a signed-in user back to
 *   `/(onboarding)/welcome`. Now the user is only cleared when the query *succeeds* and
 *   says there is no row; a transport error leaves the persisted profile alone.
 */

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { SupabaseClient } from '@/api/supabase/client';
import type { User } from '@/types/database.types';

/**
 * Everything the handler touches, passed in rather than imported.
 *
 * Only types are imported above, so this module loads in plain Node — which is what
 * lets `scripts/e2e/mexa335-auth-lock-deadlock.mjs` drive the real handler against the
 * live project instead of a copy of it.
 */
export type AuthStateBinding = {
  client: SupabaseClient;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setHasShidduchProfile: (has: boolean) => void;
  /**
   * Raised synchronously when a deferred profile fetch is queued, lowered when it
   * settles. `app/index.tsx` waits on it, so the router does not route on the
   * `isAuthenticated: true, isOnboardingComplete: false` gap the deferral opens.
   */
  setProfileLoading?: (loading: boolean) => void;
  /** Run synchronously on `SIGNED_OUT`, to clear stores that outlive the session. */
  onSignedOut?: () => void;
  /**
   * Tell the billing SDK which account is signed in — the **`auth.users.id`**, or `null`
   * when there is no session (MEXA-346).
   *
   * RevenueCat files entitlements under an app user id of its own. Nothing ever called
   * `Purchases.logIn`, so that id stayed an anonymous per-install one: a subscription
   * followed the phone instead of the account, and two accounts on one phone shared a
   * customer. This is the seam that fixes it, and it lives here rather than in a second
   * `onAuthStateChange` subscription because there must only ever be one (see
   * `generation` below).
   *
   * Called through `defer()` and never awaited — `Purchases.logIn` is a network call,
   * and awaiting anything in this callback deadlocks the auth client (see the header).
   * Fired at most once per distinct id, but always at least once per launch, including
   * for `null`: RevenueCat persists its app user id across launches, so a fresh JS
   * context cannot assume the SDK is where it left it.
   */
  onIdentityChange?: (authId: string | null) => void;
  /**
   * `FEATURE_ORTHODOX_MODE`, injected. The shidduch lookup is pointless while the
   * mode is hidden (docs/ROADMAP.md), and injecting it keeps this module free of
   * runtime imports.
   */
  orthodoxModeEnabled?: boolean;
  /**
   * How work leaves the auth callback. The default is the whole point of the module;
   * override it only in tests.
   */
  defer?: (fn: () => void) => void;
};

export type ProfileLoad = {
  profile: User | null;
  hasShidduchProfile: boolean;
  /** The query itself failed (offline, RLS, 5xx). Distinct from "there is no row". */
  failed: boolean;
};

/**
 * Load the `public.users` row for an auth user, plus whether they have a shidduch
 * profile. `maybeSingle()` rather than `single()`, so "no row" is not reported as an
 * error and the caller can tell it apart from a request that never landed.
 */
export async function loadUserProfile(
  client: SupabaseClient,
  authId: string,
  options: { orthodoxModeEnabled?: boolean } = {}
): Promise<ProfileLoad> {
  const { data: profile, error } = await client
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle();

  if (error) {
    console.warn('[AuthState] profile query failed:', error.message);
    return { profile: null, hasShidduchProfile: false, failed: true };
  }

  if (!profile || !options.orthodoxModeEnabled) {
    return { profile: profile ?? null, hasShidduchProfile: false, failed: false };
  }

  const { data: shidduchProfile } = await client
    .from('shidduch_profiles')
    .select('id')
    .eq('user_id', profile.id)
    .maybeSingle();

  return { profile, hasShidduchProfile: !!shidduchProfile, failed: false };
}

/**
 * Build the `onAuthStateChange` callback.
 *
 * Synchronous by contract — see the header. Returning a promise here would put the
 * awaited work back inside the auth lock.
 */
export function createAuthStateHandler(
  binding: AuthStateBinding
): (event: AuthChangeEvent, session: Session | null) => void {
  const defer = binding.defer ?? ((fn: () => void) => void setTimeout(fn, 0));

  // Bumped on every event. A deferred fetch that comes back after a newer event has
  // already been handled is stale and must not write to the store — otherwise signing
  // out (or switching accounts) can be undone by the previous account's in-flight read.
  //
  // It is per handler, not per app, so it only orders the events *this* handler sees.
  // That is sound because there is exactly one subscription: `app/_layout.tsx` registers
  // it in an effect with an empty dependency array and unsubscribes on cleanup. Register
  // a second one anywhere and two handlers would each think their own write is the
  // newest — so don't, or lift this counter to module scope first (Guts, MEXA-340).
  let generation = 0;
  // Which auth id the store's profile belongs to, so a token refresh is a no-op.
  let loadedAuthId: string | null = null;
  // Which auth id the billing SDK was last pointed at, and whether it has been pointed
  // anywhere at all in this JS context. Separate from `loadedAuthId`: the profile row
  // and the RevenueCat customer are different things, and a failed profile fetch must
  // not make the app re-identify a purchase account it already identified.
  let identityAuthId: string | null = null;
  let identitySent = false;

  return (event, session) => {
    const current = ++generation;
    console.log('Auth event:', event, '| Has session:', !!session);

    if (event === 'SIGNED_OUT') {
      console.log('[AuthState] SIGNED_OUT - clearing stores that outlive the session');
      binding.onSignedOut?.();
    }

    // Synchronous store writes only. Nothing below this line may be awaited here.
    binding.setSession(session);

    const authId = session?.user?.id ?? null;

    // Billing identity (MEXA-346). Deferred, exactly like the profile fetch below and
    // for the same reason. The first event of a launch always sends, even for `null`,
    // because RevenueCat's app user id outlives the JS context.
    if (binding.onIdentityChange && (!identitySent || identityAuthId !== authId)) {
      identitySent = true;
      identityAuthId = authId;
      defer(() => {
        // Not the `generation` check the profile fetch uses: a *newer* event that wants
        // the same id would be skipped above, so its own defer would never run and the
        // id would never be sent. What matters is only that this is still the target.
        if (identityAuthId !== authId) return;
        binding.onIdentityChange?.(authId);
      });
    }

    if (!authId) {
      loadedAuthId = null;
      binding.setUser(null);
      binding.setProfileLoading?.(false);
      return;
    }

    // A refresh mints a new access token for the same account; the profile row is
    // untouched, so there is nothing to reload.
    if (event === 'TOKEN_REFRESHED' && loadedAuthId === authId) {
      console.log('[AuthState] token refreshed, profile already loaded');
      return;
    }

    // Raised here, not in the deferred body: the router can render in between.
    binding.setProfileLoading?.(true);

    defer(() => {
      void (async () => {
        try {
          const { profile, hasShidduchProfile, failed } = await loadUserProfile(
            binding.client,
            authId,
            { orthodoxModeEnabled: binding.orthodoxModeEnabled }
          );

          // A newer auth event has been handled since; its own fetch owns the store.
          if (current !== generation) return;

          if (failed) {
            // Keep whatever profile was persisted rather than bouncing a signed-in user
            // back into onboarding over one bad request.
            return;
          }

          loadedAuthId = profile ? authId : null;
          binding.setUser(profile);

          if (hasShidduchProfile) {
            console.log('[AuthState] found shidduch profile');
            binding.setHasShidduchProfile(true);
          }
        } catch (error) {
          // `loadUserProfile` turns a *query* error into `failed: true`, so reaching
          // here means the client itself threw — offline in a way PostgREST never saw,
          // or a bad client. The `finally` below already handles the spinner; this is
          // only so the rejection is reported rather than left unhandled on a promise
          // nobody is holding (MEXA-346). The persisted profile is left alone, exactly
          // as in the `failed` branch.
          console.warn(
            '[AuthState] profile load threw:',
            error instanceof Error ? error.message : error
          );
        } finally {
          // Always lowered, including on a throw: a stuck flag is a spinner that never
          // clears, which is the bug this whole module exists to remove.
          if (current === generation) binding.setProfileLoading?.(false);
        }
      })();
    });
  };
}

/**
 * Register the handler. Returns the subscription, so the caller's effect cleanup is
 * just `subscription.unsubscribe()`.
 */
export function subscribeToAuthState(binding: AuthStateBinding) {
  const {
    data: { subscription },
  } = binding.client.auth.onAuthStateChange(createAuthStateHandler(binding));

  return subscription;
}
