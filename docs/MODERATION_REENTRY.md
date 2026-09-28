---
title: "Re-entry after a deleted account: what we know, and the one decision left"
status: awaiting a product decision (Itai)
issue: MEXA-258
updated: 2026-09-28
---

# Re-entry after a deleted account

MEXA-256 made moderation history survive account deletion. A deleted account that had
a report against it now leaves a `public.deleted_accounts` tombstone holding a peppered
SHA-256 of its email and phone.

Nothing reads it. Someone can delete their account under an open report and sign up
again with the same address a minute later. This file is what we found while working
out how to close that, so the decision is a choice between four described options and
not a research task.

## What is already settled by the code

### The check has to live in a before-user-created auth hook

Not an Edge Function the app calls at signup. Two reasons, both load-bearing:

1. **There are three signup paths, not one.** `app/(auth)/register.tsx` has email and
   password (`supabase.auth.signUp`, line 86), Apple (`signInWithIdToken`, line 156)
   and Google (`signInWithOAuth`, line 195); `app/(safta-auth)/signup.tsx` repeats all
   three. A client-side call has to be wired into each one, and the next path someone
   adds starts out unguarded.
2. **A client-side call is advice, not a gate.** The person we want to stop is the one
   motivated enough to delete an account and come back. Anyone running a patched client
   simply does not make the call.

A before-user-created hook runs inside GoTrue before the `auth.users` row exists, so it
covers all three paths and there is no client to patch. The project already supports
it: `hook_before_user_created_enabled` / `_uri` / `_secrets` are present in the live
auth config for `tayiyczmacvhokdxfqvm` on the free plan (read from the Management API,
2026-09-28; currently `false` / `null`).

Prefer a Postgres-function hook (`pg-functions://…`) over an HTTPS one if
before-user-created accepts it — confirm at implementation time. The function reads
`deleted_accounts` directly as its owner, so there is no service_role key in flight, no
cold start, and nothing to deploy alongside the migration. Fall back to an HTTPS hook
at an Edge Function with the hook secret if it does not.

**Never expose this as an RPC.** `deleted_accounts` and `hash_account_identifier()` are
closed to `anon` and `authenticated` on purpose. Anything a client can call with an
address and get a yes/no from is an oracle for "is this address banned".

### The email hash is the only matcher that works today

`external_phone_enabled` is `false` on the live project, so phone is not a signup
identifier and `phone_hash` will match nothing until that changes. Worth keeping the
column; do not plan around it.

Two limits that apply to every option below, and neither is fixable:

- **Apple Hide My Email** hands out a fresh relay address per app install, so an Apple
  re-signup produces a different address and a different hash. Google and email/password
  re-signups with the same address do match.
- A determined person uses a new address. This raises the cost of coming back; it does
  not make it impossible. That is the honest ceiling on all four options.

### "Keep the blocks" is not a separate decision — it depends on this one

Item 3 on MEXA-258 was written as if it were independent. It is not.

`blocks.blocker_id` and `blocks.blocked_id` both cascade, so when B deletes, every block
against B disappears. But **stopping the cascade on its own achieves nothing**: B's new
account gets a brand-new `users.id`, and a preserved block row still points at the old
one. The rows would survive and match nobody.

To make blocks bite you need to recognise the returning account — which is exactly the
tombstone match this decision authorises. So blocks get fixed as part of whichever
option is chosen, or not at all.

## The four options

The first three are the ones on the issue. The fourth came out of the blocks finding
and is the one to look at first.

### A. Nothing — keep the record for a human (today's behaviour)

The tombstone exists, a moderator can read it, signup is untouched.

Costs nothing and closes nothing. The person who was reported comes back and the people
who reported or blocked them have no idea. There is also nobody to read the record:
Mazal has no moderator role and no admin UI (noted on MEXA-256).

### B. Let them in, flag the new account for review

Signup succeeds. The new `users` row is marked for a moderator to look at.

Nobody is locked out, which is the right instinct. But it is A with extra steps until
there is a moderator and a queue, and in the meantime the returning account can reach
the people who complained about them straight away. The flag is only worth as much as
the review behind it.

### C. Refuse the signup

If the tombstone for that email hash has `moderation_hold = true`, the account is not
created.

This is the only option that actually keeps someone out, and it is the one that can
lock out a real person. Two things it must do if it is chosen:

- **The hold is set by hand, never on delete.** Firing automatically means one false
  report is enough to ban an address permanently, with no human in the loop. The issue
  already reached this conclusion; it holds.
- **The refusal message is generic.** "We couldn't create your account — contact
  support." Naming the reason turns signup into the same oracle an RPC would be, and
  tells a harasser precisely that they need a new address.

Needs an appeal path — a support address that reaches a person — or a false report
becomes a permanent, unexplained lockout. There is no support inbox for Mazal today.

### D. Let them in, restore what was there (recommended)

Signup succeeds and the account is ordinary, except that everything the old account had
standing against it is re-attached to the new `users.id`:

- every block that named the old account is re-created against the new one,
- the surviving reports are linked to the new account, so a moderator sees one history
  rather than two fragments,
- the new account is flagged for review, as in B.

The people who blocked or reported them still cannot be reached; nothing tells the
returning user any of this happened; and **nobody is locked out by a false report**,
because the worst case is that one stranger's block follows a rebuilt account. That is
a far cheaper mistake than C's.

What it costs: the tombstone has to carry the ids of everyone who blocked the account,
which is a snapshot table 00011 does not have yet, and the cascade on
`blocks.blocked_id` has to be dropped the way 00011 dropped the ones on `reports`. One
migration, the same shape as the one already written.

D does not replace C — keep the manual `moderation_hold` and the refusal for the cases
that deserve it. D is what happens by default; C is what a moderator escalates to.

## Recommendation

**D as the default, with C retained as a manual escalation.** D closes the hole that
actually matters — the returning account reaching the people who complained — without
the power to lock a real person out of a dating app on one stranger's say-so. C stays
available for the account a human has looked at and decided about.

If that is too much for now: **C alone, hold set by hand**, is the smaller build and is
defensible. **A and B leave the door open** and should only be chosen if the answer is
"not yet".

## Once the answer is in

1. Migration: drop the `blocks` cascades, add the blocker snapshot to the tombstone,
   add the match-and-restore function (D); and/or the hold lookup (C).
2. Wire the before-user-created hook and confirm `pg-functions://` is accepted.
3. Test all three signup paths against a tombstoned address, and confirm an ordinary
   signup is unaffected.
4. Guts reviews before it is applied — this is auth and moderation.
5. Itai reviews anything the user sees, which under C is the refusal copy.

Retention is already built and does not depend on the answer:
`00012_deleted_accounts_retention.sql` purges a tombstone 12 months after deletion when
every report about it was dismissed, 24 months when one ended `action_taken`, and never
while a hold or an open report is on it.
