/**
 * Turn a GoTrue auth error into something a tester can act on.
 *
 * MEXA-338, walkthrough finding 11: signing up with an address that cannot receive mail
 * returns HTTP 500 and the form showed GoTrue's own **"Error sending confirmation email"**.
 * GoTrue also rolls the account back on that path, so the user is left with no account, a
 * server-sounding error, and nothing to do about it. Any tester who fat-fingers a domain
 * lands there.
 *
 * Every screen showed `authError.message` straight, so this is the one place that decides.
 *
 * Two rules the mapping follows:
 *
 *  1. **An unrecognised message is passed through unchanged.** Rewriting an error nobody
 *     anticipated into "something went wrong" is how a real cause disappears. The mapping
 *     only speaks where it knows what happened.
 *  2. **The login form's message does not separate a wrong password from an unknown
 *     email.** "Invalid login credentials" stays one message for both — telling them apart
 *     turns the login form into a way to enumerate who is on a dating app. This file adds
 *     no signal of its own, but enumeration resistance is a property of GoTrue's responses,
 *     not of this file: the `user already registered` rule on `signUp` does name an
 *     existing account, and only fires when GoTrue's raw text already said so (with
 *     confirmations on, GoTrue returns an obfuscated user instead of that error), so the
 *     mapping neither creates nor removes that signal (MEXA-388 C).
 */

/** What GoTrue was asked to do. Some messages mean different things per operation. */
export type AuthOperation = 'signUp' | 'signIn' | 'resetPassword';

type Rule = {
  /** Matched case-insensitively against GoTrue's message. */
  match: RegExp;
  /** Which operations it applies to; omitted means all of them. */
  only?: AuthOperation[];
  message: string;
};

/**
 * Ordered: the first match wins, so the specific patterns come before the general ones.
 */
const RULES: Rule[] = [
  {
    // The finding. GoTrue returns this when its SMTP provider refuses the address —
    // usually a domain with no MX record, i.e. a typo.
    match: /error sending confirmation email|error sending (magic link|signup) email/i,
    only: ['signUp'],
    message:
      "We couldn't send a confirmation email to that address, so your account wasn't created. Check the spelling of your email and try again.",
  },
  {
    match: /error sending recovery email|error sending email/i,
    only: ['resetPassword'],
    message:
      "We couldn't send a reset email to that address. Check the spelling of your email and try again.",
  },
  {
    // The team shares one 100/day Resend bucket across every product (TEAM_BOARD,
    // MEXA-304), so this is a realistic thing for a tester to hit, and the raw message
    // reads like the user did something wrong.
    match: /email rate limit exceeded|over_email_send_rate_limit/i,
    message:
      "Too many emails have gone out from Mazal just now. Please try again in a little while — nothing is wrong with your account.",
  },
  {
    // GoTrue's own per-address throttle. It names the wait in seconds; keep that.
    match: /for security purposes, you can only request this after (\d+) seconds?/i,
    message: 'Please wait $1 seconds before trying again.',
  },
  {
    match: /user already registered|already been registered/i,
    only: ['signUp'],
    message: 'That email already has a Mazal account. Try signing in instead.',
  },
  {
    // Deliberately vague about *which* half was wrong — see rule 2 in the header.
    match: /invalid login credentials/i,
    only: ['signIn'],
    message: 'That email and password do not match. Check them and try again.',
  },
  {
    match: /email not confirmed/i,
    only: ['signIn'],
    message:
      'Please confirm your email first — tap the link we sent you. Check your spam folder if it is not there.',
  },
  {
    match: /password should be at least|weak.?password/i,
    message: 'Please choose a longer password.',
  },
  {
    match: /unable to validate email address|invalid format/i,
    message: 'That does not look like an email address. Check it and try again.',
  },
  {
    // A network failure, not a server one. Distinct advice, so worth its own rule.
    match: /network request failed|failed to fetch|load failed/i,
    message: 'We could not reach Mazal. Check your connection and try again.',
  },
];

/**
 * @param raw GoTrue's `error.message`, or undefined.
 * @param operation what was being attempted.
 * @returns copy to show the user. Falls back to `raw` when nothing matches, and to a
 *   generic line only when there is no message at all.
 */
export function authErrorMessage(
  raw: string | null | undefined,
  operation: AuthOperation
): string {
  const text = (raw || '').trim();
  if (!text) return 'Something went wrong. Please try again.';

  for (const rule of RULES) {
    if (rule.only && !rule.only.includes(operation)) continue;
    const m = text.match(rule.match);
    if (m) {
      // `$1` lets a rule keep a number out of GoTrue's message (the retry-after seconds).
      return rule.message.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? '');
    }
  }
  return text;
}
