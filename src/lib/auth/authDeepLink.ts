/**
 * Auth Deep Links
 *
 * Supabase auth emails (confirm sign-up, reset password) point at the app's
 * `mazal://` scheme. Every redirect target used here must match the project's
 * `uri_allow_list`, or GoTrue silently discards it and redirects to `site_url`
 * instead — no error, the user just lands somewhere useless.
 *
 * The allow list is `mazal://auth/**` (`site_url` is `mazal://`). The double star
 * matters: GoTrue compiles these patterns with `/` as a glob separator, so a
 * single `*` stops at the first slash and `mazal://*` does NOT match
 * `mazal://auth/reset-password`. Verified against the live project — with a
 * single star both links fell back to `mazal://`. Note that GoTrue caches this
 * config, so a change takes up to ~30s to take effect.
 *
 * The client runs `flowType: 'pkce'` (see src/api/supabase/client.ts), so
 * GoTrue's `/auth/v1/verify` redirect carries an authorization *code* in the
 * query string:
 *
 *   mazal://auth/reset-password?code=...&type=recovery
 *
 * while a failure arrives in the query *and* the fragment, the same params in both
 * (measured — the implicit flow used only the fragment):
 *
 *   mazal://auth/reset-password?error=access_denied&error_code=otp_expired&...#error=...
 *
 * `detectSessionInUrl` is off (it is a web-only mechanism), so the screen that
 * receives the link has to read those params and establish the session itself.
 *
 * A code is only redeemable with the `code_verifier` that supabase-js wrote to
 * its own storage when it asked for the link, so a code is useless to any other
 * device — which is the point of the switch (MEXA-264). It also means a tokens-in-
 * the-fragment link is now, by definition, not something this project issued:
 * `establishSessionFromAuthLink` refuses those outright instead of calling
 * `setSession` on whatever arrived. Before that, anyone could hand a user a
 * `mazal://auth/confirm#access_token=<their own token>` link and sign the user
 * into an account they control, which for a new sign-up meant the victim then
 * uploaded photos, location and prompts into the attacker's account.
 */

import { supabase } from '@/api/supabase/client';

/** Where the password-reset email sends the user. */
export const RESET_PASSWORD_REDIRECT_URL = 'mazal://auth/reset-password';

/** Where the sign-up confirmation email sends the user. */
export const EMAIL_CONFIRM_REDIRECT_URL = 'mazal://auth/confirm';

export type AuthLinkParams = {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  /** GoTrue link type: `recovery`, `signup`, `email_change`, `magiclink`, ... */
  type?: string;
  errorCode?: string;
  errorDescription?: string;
};

/**
 * Parse an `application/x-www-form-urlencoded` segment. Hand-rolled rather than
 * using `URLSearchParams` so this does not depend on the url polyfill having
 * been loaded first.
 */
function parseSegment(segment: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const pair of segment.split('&')) {
    if (!pair) continue;

    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);

    try {
      out[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      // Malformed percent-encoding: keep the raw value rather than throwing.
      out[rawKey] = rawValue;
    }
  }

  return out;
}

function first(source: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) {
      return value[0];
    }
  }
  return undefined;
}

/**
 * Pull the auth fields out of an already-parsed bag of params (e.g. expo-router's
 * `useLocalSearchParams()`). Returns `null` when none of them are present.
 */
export function parseAuthLinkParams(source: Record<string, unknown>): AuthLinkParams | null {
  const link: AuthLinkParams = {
    accessToken: first(source, 'access_token'),
    refreshToken: first(source, 'refresh_token'),
    code: first(source, 'code'),
    type: first(source, 'type'),
    errorCode: first(source, 'error_code', 'error'),
    errorDescription: first(source, 'error_description'),
  };

  const isEmpty =
    !link.accessToken &&
    !link.refreshToken &&
    !link.code &&
    !link.errorCode &&
    !link.errorDescription;

  return isEmpty ? null : link;
}

/**
 * Parse a full deep-link URL. Both segments are read: under PKCE the `code` comes
 * back in the query, alongside any `redirectTo` params of our own (e.g.
 * `?flow=safta`), while GoTrue still reports failures in the fragment. Fragment
 * wins on a collision, so an `#error=...` is never masked by a stale query param.
 */
export function parseAuthLink(url: string | null | undefined): AuthLinkParams | null {
  if (!url) return null;

  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const source: Record<string, string> = {};

  if (queryIndex !== -1) {
    const end = hashIndex > queryIndex ? hashIndex : url.length;
    Object.assign(source, parseSegment(url.slice(queryIndex + 1, end)));
  }

  if (hashIndex !== -1) {
    Object.assign(source, parseSegment(url.slice(hashIndex + 1)));
  }

  return parseAuthLinkParams(source);
}

export type AuthLinkResult =
  | { ok: true; type?: string }
  | { ok: false; expired: boolean; message: string };

const EXPIRED_ERROR_CODES = new Set(['otp_expired', 'access_denied', 'invalid_request']);

/**
 * A code this install cannot redeem: it came from a flow this device never
 * started, or the flow it belongs to is gone. Measured against the live project
 * with supabase-js 2.90.1:
 *
 *   no verifier in storage      400 pkce_code_verifier_not_found   (client-side)
 *   verifier present, no flow   404 flow_state_not_found           (from GoTrue)
 *
 * The second is the one that catches the shared-slot problem: every PKCE flow
 * writes the same `${storageKey}-code-verifier`, so starting a second one before
 * finishing the first leaves a verifier that no longer matches. Prefer the error
 * `code` over the message, which is prose and changes between releases.
 *
 * Note supabase-js clears the verifier even on a failed exchange, so opening the
 * same link twice always lands here. Sending the user to "request a new link" is
 * therefore the only useful answer, not a nicety.
 */
const UNREDEEMABLE_CODE_ERRORS = new Set([
  'pkce_code_verifier_not_found',
  'flow_state_not_found',
  'flow_state_expired',
]);

function isUnredeemableCode(error: { code?: string; message: string }): boolean {
  if (error.code && UNREDEEMABLE_CODE_ERRORS.has(error.code)) return true;
  // Older builds, and the challenge-mismatch case, only say it in the message.
  return /code[\s_]?verifier|code challenge|flow state/i.test(error.message);
}

/**
 * Turn the params from an auth email link into a real session.
 *
 * A single-use link that has already been opened, or one older than
 * `mailer_otp_exp` (1 hour), comes back as `expired: true` so the caller can
 * offer "send me a new link" instead of a dead end. So does a code this device
 * cannot redeem, which from the user's side is the same dead end.
 */
export async function establishSessionFromAuthLink(
  link: AuthLinkParams
): Promise<AuthLinkResult> {
  if (link.errorCode || link.errorDescription) {
    const expired = link.errorCode ? EXPIRED_ERROR_CODES.has(link.errorCode) : false;
    return {
      ok: false,
      expired,
      message: expired
        ? 'This link has expired or was already used.'
        : link.errorDescription || 'This link is no longer valid.',
    };
  }

  // The code path is the only one we trust, and it is the only one GoTrue uses
  // now that the client is on PKCE.
  if (link.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(link.code);

    if (error) {
      if (isUnredeemableCode(error)) {
        return {
          ok: false,
          expired: true,
          message: 'This link belongs to a different sign-in attempt.',
        };
      }
      return { ok: false, expired: false, message: error.message };
    }

    return { ok: true, type: link.type };
  }

  // Tokens in the link. Under PKCE this project never issues one, so it is either
  // a link from before the switch or a forged one — and a forged one is the whole
  // attack: `mazal://auth/confirm#access_token=<attacker's token>` would sign the
  // user into the attacker's account, and `type` is just as attacker-supplied as
  // the tokens are. Refuse rather than hand it to `setSession` (MEXA-264).
  if (link.accessToken || link.refreshToken) {
    return {
      ok: false,
      expired: true,
      message: 'This link is no longer the kind of link we issue.',
    };
  }

  return {
    ok: false,
    expired: false,
    message: 'This link is missing the information we need to continue.',
  };
}

/**
 * Finish a `signInWithOAuth` round trip, given the callback URL that
 * `WebBrowser.openAuthSessionAsync` hands back.
 *
 * Same trust rule as the email links, and the same reason it exists: all four
 * sign-in screens used to pull `access_token` straight off the callback, which
 * PKCE stopped producing — they would each have shown "Authentication failed"
 * after the user had already cleared Google's consent screen (MEXA-264). No
 * provider is enabled on the project today, so nothing was actually broken; it
 * would have broken the day someone turned Google on.
 */
export async function completeOAuthCallback(callbackUrl: string): Promise<AuthLinkResult> {
  const link = parseAuthLink(callbackUrl);

  if (!link) {
    return {
      ok: false,
      expired: false,
      message: 'The sign-in came back without anything we could use.',
    };
  }

  return establishSessionFromAuthLink(link);
}
