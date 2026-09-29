/**
 * Who RevenueCat thinks is buying (MEXA-346)
 *
 * RevenueCat files every entitlement under an "app user id" of its own. `app/_layout.tsx`
 * called `initializeRevenueCat()` with no id, so `Purchases.configure()` invented an
 * anonymous one per install and `Purchases.logIn` was never called from anywhere. Two
 * consequences, for every entitlement (gold, platinum, orthodox, safta_pro):
 *
 *  - A subscription belonged to the **phone**, not the account. Signing in on a second
 *    device reported nothing until the user found "Restore Purchases".
 *  - Two accounts on one phone shared one RevenueCat customer, so account A's
 *    subscription read as active for account B.
 *
 * ## The id, decided once
 *
 * **The Supabase `auth.users.id`** — the uuid `session.user.id` carries. Not
 * `public.users.id`.
 *
 * Three reasons, and this does not get revisited: changing it later orphans every
 * purchase made under the old id.
 *
 *  1. It is in the session already. `public.users.id` needs a PostgREST round trip, and
 *     the one place that learns about a sign-in — the `onAuthStateChange` callback —
 *     may not await a query (see the header of `src/lib/auth/authStateSync.ts`). An id
 *     that needs a fetch is an id that is sometimes not there yet.
 *  2. It survives the profile row. A user who deletes and re-creates their `public.users`
 *     row, or any repair that rewrites it, keeps the same auth id and keeps their
 *     subscription.
 *  3. It is what the rest of the app already keys auth-scoped state on
 *     (`users.auth_id`), so a RevenueCat customer id can be matched back to an account
 *     with one query when support has to.
 *
 * ## Why this file imports nothing
 *
 * Same reason as `src/lib/purchases/entitlements.ts`: `react-native-purchases` cannot
 * load outside Metro, so the ordering rules below would be untestable if they lived in
 * `src/lib/config/revenuecat.ts`. The three store calls arrive through a binding, and
 * `scripts/check-purchase-identity.mjs` drives this state machine in plain Node.
 *
 * ## The ordering problem it exists to solve
 *
 * `app/_layout.tsx` starts `initializeRevenueCat()` and registers the auth listener in
 * the *same* effect, and neither orders the other: `prepare()` suspends on its first
 * `await`, and supabase-js then fires `INITIAL_SESSION` whenever it gets there. So the
 * request to identify can arrive before `Purchases.configure()` has run, and
 * `Purchases.logIn` before `configure` throws.
 *
 * This holds the *desired* identity as data and applies it when it can:
 *
 *  - Identity requested before configure → it becomes `configure`'s own `appUserID`, so
 *    no anonymous customer is created at all and there is nothing to alias.
 *  - Identity requested after configure → one `logIn`, or `logOut` back to anonymous.
 *  - Requests are serialised, so A → B → A cannot land out of order.
 *  - Nothing is ever applied twice: what the SDK was last told is tracked, which is also
 *    what keeps a cold start from calling `logOut` on an already-anonymous SDK (which
 *    RevenueCat reports as an error).
 *  - A failure leaves the last-applied id alone, so the next auth event retries.
 */

/** What this module needs from `react-native-purchases`. */
export type PurchaseIdentityBinding = {
  /**
   * `Purchases.configure({ apiKey, appUserID })`.
   *
   * Resolve `true` once the SDK is usable. Resolve `false` when this build cannot reach
   * a store at all — Expo Go, or no API key. That is a normal state, not a failure, and
   * must not be reported as one. Throwing means configure was attempted and failed.
   */
  configure: (appUserId: string | null) => Promise<boolean>;
  /** `Purchases.logIn(appUserId)`. */
  logIn: (appUserId: string) => Promise<void>;
  /** `Purchases.logOut()` — back to an anonymous app user id. */
  logOut: () => Promise<void>;
  /** Where failures go. Nothing here throws at the caller. */
  onError?: (stage: 'configure' | 'logIn' | 'logOut', error: unknown) => void;
};

export type PurchaseIdentityStatus =
  /** `configure()` has not finished. Identity requests are remembered, not applied. */
  | 'unconfigured'
  /** The SDK is configured and identity requests are applied as they arrive. */
  | 'ready'
  /** No store in this build, or configure failed. Every call is a no-op. */
  | 'unavailable';

export type PurchaseIdentityState = {
  status: PurchaseIdentityStatus;
  /** What the auth layer last asked for. `null` means signed out / anonymous. */
  desired: string | null;
  /** What the SDK was last successfully told, once it has been told anything. */
  applied: string | null;
  appliedKnown: boolean;
};

export type PurchaseIdentity = {
  /**
   * Run `Purchases.configure()` once, adopting any identity already requested as its
   * `appUserID`. Repeat calls return the first call's result. Resolves `true` when the
   * SDK is usable.
   */
  configure: () => Promise<boolean>;
  /**
   * Point RevenueCat at `appUserId`, or back at an anonymous id when `null`.
   *
   * Resolves when the change has landed (or been recorded, if the SDK is not configured
   * yet). Never rejects — a store failure goes to `onError`.
   */
  setIdentity: (appUserId: string | null) => Promise<void>;
  /**
   * Resolves when no configure or identity change is in flight.
   *
   * Every read of `CustomerInfo` waits on this, so an entitlement check that races the
   * sign-in cannot answer from the anonymous customer and refuse a paying user.
   * Resolves immediately when nothing was ever started, so it can never wedge a screen.
   */
  settled: () => Promise<void>;
  /** For tests and logs. */
  state: () => PurchaseIdentityState;
};

export function createPurchaseIdentity(
  binding: PurchaseIdentityBinding
): PurchaseIdentity {
  let status: PurchaseIdentityStatus = 'unconfigured';
  let desired: string | null = null;
  let applied: string | null = null;
  let appliedKnown = false;

  // Identity changes run one at a time. Without this, a fast A -> B -> A could resolve
  // out of order and leave RevenueCat on B while the app believes it is on A.
  let chain: Promise<void> = Promise.resolve();
  let configuring: Promise<boolean> | null = null;

  /** Bring the SDK to whatever `desired` currently is. Never throws. */
  async function applyDesired(): Promise<void> {
    if (status !== 'ready') return;

    // Read `desired` here, not when this was queued: a change that arrived while an
    // earlier apply was in flight is handled by this run, and its own queued apply then
    // finds nothing left to do.
    const target = desired;
    if (appliedKnown && applied === target) return;


    try {
      if (target === null) {
        await binding.logOut();
      } else {
        await binding.logIn(target);
      }
      applied = target;
      appliedKnown = true;
    } catch (error) {
      // Deliberately leave `applied` untouched, so the next auth event retries rather
      // than believing the SDK is somewhere it is not.
      binding.onError?.(target === null ? 'logOut' : 'logIn', error);
    }
  }

  function enqueue(work: () => Promise<void>): Promise<void> {
    chain = chain.then(work, work);
    return chain;
  }

  async function configure(): Promise<boolean> {
    if (configuring) return configuring;

    configuring = (async () => {
      // Whatever the auth listener has asked for by now becomes the `appUserID` we
      // configure with, so a user who is already signed in at launch never gets an
      // anonymous customer in the first place.
      const initial = desired;
      let usable: boolean;
      try {
        usable = await binding.configure(initial);
      } catch (error) {
        binding.onError?.('configure', error);
        status = 'unavailable';
        return false;
      }

      if (!usable) {
        status = 'unavailable';
        return false;
      }

      status = 'ready';
      applied = initial;
      appliedKnown = true;

      // Auth may have moved on while configure was in flight.
      void enqueue(applyDesired);
      return true;
    })();

    return configuring;
  }

  function setIdentity(appUserId: string | null): Promise<void> {
    desired = appUserId;

    // Not configured yet: `configure()` picks this up, either as its `appUserID` or in
    // the apply it queues straight after. Unavailable: there is no SDK to tell.
    if (status !== 'ready') return Promise.resolve();

    return enqueue(applyDesired);
  }

  async function settled(): Promise<void> {
    // `configure()` resolves rather than rejects, and `enqueue` catches, so neither of
    // these can reject — but a caller stuck here would be a spinner that never clears,
    // so guard anyway.
    await configuring?.catch(() => false);
    await chain.catch(() => undefined);
  }

  return {
    configure,
    setIdentity,
    settled,
    state: () => ({ status, desired, applied, appliedKnown }),
  };
}
