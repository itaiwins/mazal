/**
 * Recovery-session guard
 *
 * A password-reset link buys a **full, persisted, auto-refreshing session** on the
 * device before the user has proved anything. `app/auth/reset-password.tsx` is the
 * only screen that ever holds one, and the rule is that it must not outlive the
 * visit: if the user walks away without saving a new password, the session ends
 * (MEXA-264).
 *
 * ## Why this is its own module
 *
 * Every version of this logic so far has been wrong in a way that only showed up on
 * a careful read, never on a run — there is no test runner in this repo, and no
 * simulator on the build box. The first cut signed out only after a *successful*
 * save. The second added an `AppState` listener and still left the session live if
 * the app was backgrounded when a save *failed* (Guts's re-review of `00b5ce0`).
 * The third called `signOut()` and believed it.
 *
 * So the decisions live here, import-free and with the SDK passed in, and
 * `scripts/check-recovery-session.mjs` drives the real module against a stub —
 * the pattern `src/lib/auth/authStateSync.ts` and
 * `src/lib/purchases/entitlements.ts` already use. Only types are imported, so this
 * loads in plain Node. Keep it that way: no `@/` aliases, no `react-native`.
 *
 * ## The three decisions, and why each is shaped the way it is
 *
 * 1. **Background ends the session — but only `'background'`.** iOS reports
 *    `'inactive'` for the app switcher, an incoming call, and the password autofill
 *    sheet. Treating those as leaving would throw away the session of anyone using
 *    a password manager, which is most of the people who should be.
 *
 * 2. **Never while a save is in flight.** Signing out under a running `updateUser`
 *    can race a write that then succeeds, which would leave the app telling the
 *    user their password is unchanged immediately after changing it. `'saving'` is
 *    therefore excluded, and the settle path below covers it instead: a *failed*
 *    save is the one moment we know the password did not change and nothing is in
 *    flight, so it is safe to end the session there.
 *
 * 3. **A sign-out that did not land is not a sign-out.** auth-js `_signOut` calls
 *    `/logout` first and returns early **without clearing the local session** if
 *    that call fails with anything but 401/403/404 — so an offline sign-out is a
 *    no-op that reports an error nobody was reading. Every scope hits the network,
 *    so there is no local-only escape hatch; the guard records the failure and
 *    retries on the next foreground instead of claiming success.
 */

/** The statuses `app/auth/reset-password.tsx` can be in. */
export type RecoveryStatus = 'verifying' | 'ready' | 'saving' | 'invalid';

/** `AppStateStatus` from react-native, without importing it. */
export type AppStateValue = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

/** Everything the guard touches, passed in rather than imported. */
export type RecoverySessionBinding = {
  /** `supabase.auth.signOut()`. Shaped so a non-null `error` means it did not land. */
  signOut: () => Promise<{ error: unknown }>;
  /** `() => AppState.currentState`. Read at the moment of the decision, not cached. */
  getAppState: () => AppStateValue;
};

/** What the caller should render after a decision. */
export type SettleOutcome =
  | { render: 'abandoned' }
  | { render: 'error'; message: string };

export type RecoverySessionGuard = {
  /** True once the session has been given up on. */
  isAbandoned: () => boolean;
  /** True when a `signOut` failed and has not yet been retried. */
  isSignOutPending: () => boolean;
  /**
   * End the session. Returns whether it actually landed; on failure the guard
   * remembers and `onAppStateChange('active', …)` retries.
   */
  endSession: () => Promise<boolean>;
  /**
   * Give up on the session for good. Idempotent — the second call does not sign out
   * again, so a listener and an in-flight exchange racing cannot double up.
   */
  abandon: () => Promise<void>;
  /**
   * Feed it every `AppState` change. Returns true when the caller should render the
   * abandoned state.
   */
  onAppStateChange: (next: AppStateValue, status: RecoveryStatus) => Promise<boolean>;
  /**
   * Call when the link exchange resolves. `true` when a session was established.
   * Returns true if the guard discarded it because the user had already left, in
   * which case the caller must not move to `ready`.
   */
  afterExchange: (established: boolean) => Promise<boolean>;
  /** Call when `updateUser` failed. Decides between the error and the abandoned state. */
  settleFailedSave: (message: string) => Promise<SettleOutcome>;
};

export function createRecoverySessionGuard(
  binding: RecoverySessionBinding
): RecoverySessionGuard {
  let abandoned = false;
  let signOutPending = false;

  const endSession = async (): Promise<boolean> => {
    try {
      const { error } = await binding.signOut();
      signOutPending = !!error;
    } catch {
      // A thrown transport error is the same situation as a returned one.
      signOutPending = true;
    }
    return !signOutPending;
  };

  const abandon = async (): Promise<void> => {
    if (abandoned) return;
    abandoned = true;
    await endSession();
  };

  return {
    isAbandoned: () => abandoned,
    isSignOutPending: () => signOutPending,
    endSession,
    abandon,

    async onAppStateChange(next, status) {
      if (next === 'active') {
        // Nothing to decide, but this is the first moment a failed sign-out can be
        // retried with a network again.
        if (signOutPending) await endSession();
        return abandoned;
      }

      // Decision 1: only a real background counts as leaving.
      if (next !== 'background') return abandoned;
      if (abandoned) return true;

      // Decision 2: 'invalid' has no session to end, and 'saving' has a write in
      // flight that `settleFailedSave` will pick up.
      if (status !== 'verifying' && status !== 'ready') return false;

      await abandon();
      return true;
    },

    async afterExchange(established) {
      if (!abandoned) return false;
      // The user left while the code was being exchanged, so the sign-out ran
      // against a session that did not exist yet. End the one that just arrived.
      if (established) await endSession();
      return true;
    },

    async settleFailedSave(message) {
      // Decision 2, other half. Safe here: the save is settled and it failed, so the
      // password is unchanged and no write can be racing the sign-out.
      if (binding.getAppState() === 'background') {
        await abandon();
        return { render: 'abandoned' };
      }

      return { render: 'error', message };
    },
  };
}
