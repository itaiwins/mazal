# `scripts/`

Operational scripts that run against the live Supabase project. None of them are part
of the app bundle.

| Script | What it does |
|---|---|
| `sweep-e2e-users.mjs` | Deletes the test accounts an e2e run left behind in `auth.users`. Dry run by default. |
| `e2e/mexa272-password-cases.py` | Seven-case check that `current_password` is enforced on password / recovery / magic-link / signup sessions (MEXA-272). Cleans up after itself. |
| `e2e/mexa313-realtime-messages.mjs` | Eleven-case check that a `postgres_changes` subscription on `messages` really delivers: two sessions, one sends and the other has to hear it. The only thing that proves the chat live-updates, because `subscribe()` reports `SUBSCRIBED` whether or not any event will follow (MEXA-313). Cleans up after itself. |
| `e2e/mexa294-realtime-matches.mjs` | Fourteen-case check that mutual matching works end to end: four sessions swipe through the real API, and the pair that likes each other has to get the `matches` INSERT over realtime and a queued push, while a non-participant gets neither (MEXA-294). The app's subscription is unfiltered, so case 6 — RLS gating delivery — is what keeps publishing the table from handing every signed-in user every match. Cleans up after itself. Give realtime **two minutes** after any `ALTER PUBLICATION` before believing a failure. |

All of them need credentials from `archive/credentials/mazal-supabase.env` in the
workspace, which is outside this repo and stays there:

```sh
set -a; . /home/itai/mexant/workspace/archive/credentials/mazal-supabase.env; set +a
node scripts/sweep-e2e-users.mjs            # dry run
node scripts/sweep-e2e-users.mjs --apply
```

Never commit a key. The public git history already contains the old project's anon key
and a `service_role` JWT; they are inert only because that project is gone.

## Test accounts on a live project (MEXA-280)

Mazal has one Supabase project, so every end-to-end check runs against the same auth
server the app will ship against. There is no staging database to be careless in.

**The naming rule.** A test fixture account's email must be:

```
e2e-<what-it-is-for>@example.com          or   <agent>-e2e-<what-it-is-for>@example.com
```

Both halves matter. The `e2e-` label is what `sweep-e2e-users.mjs` matches on, and
`@example.com` is a domain RFC 2606 reserves for documentation and testing, so it can
never be a real person's address. The sweep deliberately leaves anything that misses
either half alone: deleting a real user costs far more than leaving one stray fixture.

**Three rules for a suite that creates accounts**, all of them learned from MEXA-280,
where two runs of one suite took `auth.users` from 3 rows to 17 and nothing removed
them. `e2e/mexa272-password-cases.py` is the worked example.

1. **Fixed fixture addresses, not timestamped ones.** Delete a stale fixture at setup
   and recreate it. A timestamped address makes a crashed run's rows unreachable and
   the next run adds a fresh set, so leakage grows without bound; a fixed address means
   the next run reclaims exactly the same rows.
2. **Tear down in `finally`, and delete by email rather than only by captured id.**
   `generate_link` creates accounts without always returning an id, so an id-only
   teardown silently misses those.
3. **Fail loudly on a teardown error - non-zero exit even if every assertion passed.**
   The rows are still live either way; only the loud version tells anyone.

**Before using row counts as a control**, sweep first. The bug that opened MEXA-280 was
an agent checking `auth.users` to confirm its own rolled-back dry run had not leaked,
and finding the count had moved for an unrelated reason.
