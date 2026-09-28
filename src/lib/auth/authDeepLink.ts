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
 * The client runs the default `implicit` flow (see src/api/supabase/client.ts),
 * so GoTrue's `/auth/v1/verify` redirect puts the session in the URL *fragment*:
 *
 *   mazal://auth/reset-password#access_token=...&refresh_token=...&type=recovery
 *
 * and failures arrive the same way:
 *
 *   mazal://auth/reset-password#error=access_denied&error_code=otp_expired&...
 *
 * `detectSessionInUrl` is off (it is a web-only mechanism), so the screen that
 * receives the link has to read those params and establish the session itself.
 * PKCE (`?code=...`) is handled too so that switching `flowType` later does not
 * silently break these screens.
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
 * Parse a full deep-link URL. Fragment params win over query params, because the
 * implicit flow puts the real tokens in the fragment while `redirectTo` may carry
 * unrelated query params of our own (e.g. `?flow=safta`).
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
 * Turn the params from an auth email link into a real session.
 *
 * A single-use link that has already been opened, or one older than
 * `mailer_otp_exp` (1 hour), comes back as `expired: true` so the caller can
 * offer "send me a new link" instead of a dead end.
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

  if (link.accessToken && link.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: link.accessToken,
      refresh_token: link.refreshToken,
    });

    if (error) {
      return { ok: false, expired: false, message: error.message };
    }

    return { ok: true, type: link.type };
  }

  // PKCE flow (only reachable if the client's `flowType` is switched to 'pkce').
  if (link.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(link.code);

    if (error) {
      return { ok: false, expired: false, message: error.message };
    }

    return { ok: true, type: link.type };
  }

  return {
    ok: false,
    expired: false,
    message: 'This link is missing the information we need to continue.',
  };
}
