#!/usr/bin/env node
/**
 * Writes the branded auth email templates in this folder (MEXA-581).
 *
 *   node supabase/templates/build.mjs      # regenerate the *.html files from this file
 *   node supabase/templates/apply.mjs      # push them to the live project
 *
 * Edit the copy here, not in the generated HTML: all six share one layout, and hand edits
 * to one file drift from the others.
 *
 * Email clients are the constraint, not taste: tables for layout, every style inline, no
 * web fonts (Gmail strips them), no CSS the iOS Mail / Gmail / Outlook trio disagrees on.
 * Colours and type are the app's own (src/theme): navy #0D1B3E, gold #C9A227, cream
 * #FAF7F2, Georgia for headlines, the system sans stack for body text. The logo is
 * assets/logo-mem.png served from the public repo, with a navy cell behind it so a client
 * that blocks images still shows a branded header.
 *
 * Links: every button is `{{ .ConfirmationURL }}` untouched. GoTrue builds that URL itself,
 * including the `pkce_` token that makes /verify redirect with `?code=`, so wrapping or
 * rebuilding it from `{{ .TokenHash }}` would break the PKCE flow that
 * scripts/verify-pkce-auth-links.mjs checks.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOGO = 'https://raw.githubusercontent.com/itaiwins/mazal/main/assets/logo-mem.png';
const NAVY = '#0D1B3E';
const GOLD = '#C9A227';
const CREAM = '#FAF7F2';
const INK = '#2B3245';
const MUTED = '#6B7280';
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const button = (label) => `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 8px;">
            <tr>
              <td align="center" bgcolor="${GOLD}" style="border-radius:999px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:15px 36px;font-family:${SANS};font-size:16px;font-weight:700;color:${NAVY};text-decoration:none;border-radius:999px;">${label}</a>
              </td>
            </tr>
          </table>`;

const fallbackLink = `
          <p style="margin:24px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${MUTED};">
            Button not working? Open this link on the phone that has Mazal installed:<br>
            <a href="{{ .ConfirmationURL }}" style="color:${NAVY};word-break:break-all;">{{ .ConfirmationURL }}</a>
          </p>`;

function layout({ title, preheader, heading, body, footer }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${CREAM};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREAM};">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CREAM}" style="background-color:${CREAM};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(13,27,62,0.08);">
          <tr>
            <td align="center" bgcolor="${NAVY}" style="background-color:${NAVY};padding:28px 24px 22px;">
              <img src="${LOGO}" width="64" height="64" alt="Mazal" style="display:block;width:64px;height:64px;border:0;border-radius:14px;color:${GOLD};font-family:${SERIF};font-size:22px;">
              <div style="margin-top:10px;font-family:${SERIF};font-size:22px;letter-spacing:3px;color:${GOLD};">MAZAL</div>
            </td>
          </tr>
          <tr>
            <td style="height:4px;line-height:4px;font-size:0;background-color:${GOLD};">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:36px 32px 32px;text-align:center;">
              <h1 style="margin:0 0 14px;font-family:${SERIF};font-size:26px;line-height:34px;font-weight:bold;color:${NAVY};">${heading}</h1>
${body}
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
          <tr>
            <td style="padding:20px 24px 0;text-align:center;font-family:${SANS};font-size:12px;line-height:18px;color:${MUTED};">
              ${footer}<br>
              <span style="color:${GOLD};">&#10022;</span> Mazal &middot; Jewish dating, made with intention
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

const para = (text) =>
  `          <p style="margin:0 auto;max-width:360px;font-family:${SANS};font-size:16px;line-height:25px;color:${INK};">${text}</p>`;

const notYou = "Didn't ask for this? You can ignore this email and nothing will change.";

export const TEMPLATES = {
  confirmation: {
    subject: 'Welcome to Mazal - confirm your email',
    html: layout({
      title: 'Confirm your email',
      preheader: 'One tap and your Mazal profile is ready.',
      heading: 'You’re almost in',
      body: [para('Confirm your email to finish creating your Mazal account. It takes one tap, and then you can start meeting people.'), button('Confirm my email'), fallbackLink].join('\n'),
      footer: `This email was sent to {{ .Email }} because it was used to sign up for Mazal. ${notYou}`,
    }),
  },
  recovery: {
    subject: 'Reset your Mazal password',
    html: layout({
      title: 'Reset your password',
      preheader: 'Choose a new password for your Mazal account.',
      heading: 'Reset your password',
      body: [para('We got a request to reset the password on your Mazal account. Tap below to choose a new one. The link works once and expires in an hour.'), button('Choose a new password'), fallbackLink].join('\n'),
      footer: `Sent to {{ .Email }}. ${notYou}`,
    }),
  },
  magic_link: {
    subject: 'Your Mazal sign-in link',
    html: layout({
      title: 'Sign in to Mazal',
      preheader: 'Tap to sign in. The link works once.',
      heading: 'Sign in to Mazal',
      body: [para('Tap below to sign in. The link works once and expires in an hour.'), button('Sign in'), fallbackLink].join('\n'),
      footer: `Sent to {{ .Email }}. ${notYou}`,
    }),
  },
  email_change: {
    subject: 'Confirm your new email for Mazal',
    html: layout({
      title: 'Confirm your new email',
      preheader: 'Confirm the new address on your Mazal account.',
      heading: 'Confirm your new email',
      body: [para('Tap below to make <strong>{{ .NewEmail }}</strong> the email on your Mazal account.'), button('Confirm new email'), fallbackLink].join('\n'),
      footer: `Sent to {{ .Email }}. If you didn't ask for this change, ignore this email and your address stays the same.`,
    }),
  },
  password_changed_notification: {
    subject: 'Your Mazal password was changed',
    html: layout({
      title: 'Your password was changed',
      preheader: 'The password on your Mazal account was just changed.',
      heading: 'Your password was changed',
      body: [
        para('The password on your Mazal account ({{ .Email }}) was just changed.'),
        para('<br>If this was you, you’re all set. If it wasn’t, open Mazal and tap <strong>Forgot password</strong> on the sign-in screen to take your account back.'),
      ].join('\n'),
      footer: 'You get this email whenever your Mazal password changes, so you always know.',
    }),
  },
  email_changed_notification: {
    subject: 'Your Mazal email was changed',
    html: layout({
      title: 'Your email was changed',
      preheader: 'The email on your Mazal account was changed.',
      heading: 'Your email was changed',
      body: [
        para('The email on your Mazal account was changed from {{ .OldEmail }} to <strong>{{ .Email }}</strong>.'),
        para('<br>If this wasn’t you, open Mazal and tap <strong>Forgot password</strong> on the sign-in screen right away.'),
      ].join('\n'),
      footer: 'You get this email whenever your Mazal email address changes.',
    }),
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [name, t] of Object.entries(TEMPLATES)) {
    writeFileSync(join(HERE, `${name}.html`), t.html);
    console.log(`wrote ${name}.html  (subject: ${t.subject})`);
  }
}
