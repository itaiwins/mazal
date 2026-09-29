# Trigger functions and RLS — the full audit

Measured 2026-09-29 against the live dev project `tayiyczmacvhokdxfqvm`, as the real
`authenticated` and `anon` roles, in one transaction that was rolled back
(`.scratch/mazal-mexa296/audit_invoker_triggers.mjs`, 17/17). MEXA-296.

## The rule this is about

A `SECURITY INVOKER` function — the default — runs as whoever fired it, so **its body is
subject to RLS**, for reads as well as writes. Inside a trigger that matters more than it
looks, because trigger bodies are where an app does bookkeeping on rows the acting user
does not own. Three different failure shapes:

| Body does | If the policy does not admit it |
|---|---|
| `SELECT` another row | empty result, **no error** |
| `UPDATE` another row | 0 rows updated, **no error** |
| `INSERT` another row | `42501`, which aborts the whole statement |

Only the third one tells you. The first two are why `check_for_match` was dead for eight
months without a single error in any log.

Touching only `NEW`/`OLD` is always safe: no table is read, so no policy applies.

## The thirteen trigger functions in `public`

`INV` = SECURITY INVOKER, `DEF` = SECURITY DEFINER.

| Function | Trigger on | Sec | Body touches | Verdict |
|---|---|---|---|---|
| `check_for_match` | `swipes` AFTER INSERT | INV | reads `swipes` cross-side, inserts `matches` | **was broken, silently.** MEXA-296 / MEXA-294, fixed by `00017` → DEFINER + `search_path=public` |
| `update_safta_stats` | `safta_likes` AFTER INSERT | INV | inserts `user_safta_stats` | **was broken, loudly.** Every Safta like failed `42501`. MEXA-297, fixed by `00020` → DEFINER + `search_path=public` |
| `update_match_last_message` | `messages` AFTER INSERT | INV | updates `matches` | works — but only because `matches` has an UPDATE policy admitting both participants. See below |
| `update_updated_at` | `users` BEFORE UPDATE | INV | `NEW` only | safe by construction |
| `update_notification_preferences_updated_at` | `notification_preferences`, `push_tokens` BEFORE UPDATE | INV | `NEW` only | safe by construction |
| `update_user_location` | `users` BEFORE INSERT/UPDATE OF lat,lng | INV | `NEW` only, but calls postgis unqualified | works; fragile, see below |
| `notify_new_match` | `matches` AFTER INSERT | DEF | reads `users`, queues via `send_push_notification()` | works. **`search_path` not pinned** |
| `notify_new_message` | `messages` AFTER INSERT | DEF | reads `users` + `matches`, queues | works. **`search_path` not pinned** |
| `notify_safta_like` | `safta_likes` AFTER INSERT/UPDATE | DEF | reads `safta_accounts`, queues | works. **`search_path` not pinned** |
| `notify_super_like` | `swipes` AFTER INSERT | DEF | reads `users`, queues | works. **`search_path` not pinned** |
| `record_deleted_account` | `users` BEFORE DELETE | DEF `search_path=""` | reads `auth.users` + `reports`, inserts `deleted_accounts` | correct (MEXA-262) |
| `reports_check_participants` | `reports` BEFORE INSERT/UPDATE | DEF `search_path=""` | reads `users` `FOR KEY SHARE` | correct (MEXA-262) |
| `users_guard_identity_columns` | `users` BEFORE INSERT/UPDATE OF email,phone | DEF `search_path=""` | reads `auth.users` | correct (MEXA-262) |

Every trigger function in `public` has a trigger attached; there are no orphans.

## The three things this audit found that were not already filed

### 1. `update_match_last_message` works by accident, not by design

It is INVOKER and it `UPDATE`s a row in another table. It only works because the
`matches` UPDATE policy happens to admit either participant, and the sender of a message
is always a participant (the `messages` INSERT policy makes sure of it). Measured:

```
the sender's message DOES move matches.last_message_at      -> last_message_at = created_at
...and for the other participant too                        -> same
a non-participant's identical UPDATE on the same match row   -> rowCount = 0, no error
```

So the chat's "last message" ordering is load-bearing on a policy written for a different
purpose. **Anyone narrowing the `matches` UPDATE policy — column-scoping it the way
MEXA-276 does for `users`, or restricting it to the unmatch columns — breaks message
ordering silently.** If that policy is ever touched, this function should move to DEFINER
in the same migration. Left as INVOKER for now: it is not broken, and changing a working
function is a change Guts has to review for no present gain.

### 2. The four `notify_*` functions are DEFINER with a mutable `search_path`

```
unpinned = [notify_new_match, notify_new_message, notify_safta_like, notify_super_like]
pinned   = [record_deleted_account, reports_check_participants, users_guard_identity_columns]
```

A DEFINER function resolves unqualified names through the *caller's* `search_path`, so the
owner's rights can be pointed at objects the caller chose. This is Supabase's own
`function_search_path_mutable` lint. Not exploitable on this project today — measured,
neither `anon` nor `authenticated` holds `CREATE` on any schema, and neither can create
one — but it is one grant away, and `00017` pins the fifth DEFINER trigger function while
leaving these four. Filed with the postgis item below.

**Fixed by `00028_pin_function_search_path.sql` (MEXA-319) — and the fix is not the one
this section assumed.** `SET search_path = public` does *not* close the hole: Postgres
searches the caller's temp schema for relation and type names ahead of everything else
whenever `pg_temp` is not named explicitly. Measured on `tayiyczmacvhokdxfqvm`
(`.scratch/mazal-mexa319/PROBE_PGTEMP.txt`) against a throwaway DEFINER function shaped
exactly like `notify_new_match`'s `SELECT first_name FROM users WHERE id = NEW.user1_id`:

| pin | before a temp table | after `CREATE TEMP TABLE users` |
|---|---|---|
| (none) | real row | **attacker-controlled** |
| `search_path = public` | real row | **attacker-controlled** |
| `search_path = public, pg_temp` | real row | real row |

And `has_database_privilege('authenticated', current_database(), 'TEMP')` is **true**,
true for `anon` too — so unlike `CREATE` on a schema, that half of the vector is not one
grant away, it is already granted. What is still missing is any way to *execute*
`CREATE TEMP TABLE` from a client: PostgREST exposes no DDL. Severity is unchanged —
hardening, not an incident — but the pin has to name `pg_temp` last to be worth making.

Consequence for the rest of the schema: **the 25 DEFINER functions pinned to
`search_path=public` alone still carry this exact gap**, `check_for_match` (00017) and
`send_push_notification` (00010) among them. 00028 deliberately does not sweep them —
different functions, different review surface — and they are filed separately.

The function they all funnel into, `send_push_notification(uuid,text,text,jsonb)`, is
already right: DEFINER, `search_path=public`, and `EXECUTE` revoked from both `anon` and
`authenticated`, so a client cannot push an arbitrary notification to an arbitrary user.
The four triggers reach it because DEFINER makes the owner the current user.

### 3. Three functions call postgis unqualified

`update_user_location`, `users_within_radius` and `distance_between_users` all call
`ST_*` and cast to `::geography` with no schema qualification, and postgis lives in
`extensions`, not `public`.

It works today: `POST /rest/v1/rpc/users_within_radius` against the live project returns
`200 []`, which proves PostgREST's request `search_path` includes `extensions`. Remove it
and the same statement fails at the cast, before it even reaches the function:

```
update users set current_latitude = ..., current_longitude = ...  (search_path = public)
  -> 42704: type "geography" does not exist
```

So every profile save that carries coordinates depends on a PostgREST setting nothing in
this repo controls. Schema-qualify them, or pin `search_path` to `public, extensions`.

**Fixed by `00028_pin_function_search_path.sql` (MEXA-319)**, by the pin —
`public, extensions, pg_temp` — rather than by qualifying the bodies, because the
`DECLARE loc1 GEOGRAPHY` declarations resolve through `search_path` too, so qualifying
would mean rewriting three function bodies to fix a name-resolution problem. Note the
ordering hazard 00028's header calls out: had part 2 above not been done in the same
migration, the next person to pin `update_user_location` to `public` alone — following the
house habit — would have broken location writes for everyone.

## Nothing to backfill

`check_for_match` never created a match row, so any pre-existing mutual like would stay
unmatched after `00017` — the trigger only fires on new inserts. Measured on the live
project: **0 users, 0 swipes, 0 matches, 0 safta_likes**, so there is nothing to backfill
and `00017` deliberately does not try.

Same for `update_safta_stats` and `00020`: `user_safta_stats` holds 0 rows, and a counter
nothing ever incremented has no drift to repair. Worth knowing for later, though —
**nothing decrements that counter.** There is no DELETE or UPDATE trigger on `safta_likes`,
so a deleted like leaves the count where it was and a `safta_accounts` delete cascades away
every one of her likes while every counter they raised stays raised. `00016` takes DELETE on
`safta_likes` away from `authenticated`, which closes the client-driven version; the cascade
remains. Filed separately — `00020` deliberately does not add a decrement, because what the
number should mean after a withdrawal is a product decision.

## Checklist for the next trigger function

1. Does the body touch any table other than `NEW`/`OLD`? If no, leave it INVOKER.
2. If yes, is every row it touches one the acting user is admitted to by policy, for that
   exact command? If not, it must be `SECURITY DEFINER`.
3. Every DEFINER function gets `SET search_path = public` (or `""` with everything
   qualified). No exceptions.
4. Schema-qualify anything outside `public` — postgis, pgcrypto, pg_net — or put
   `extensions` on the pinned path.
5. Prove it as the `authenticated` role, not as `postgres`. Every bug in this audit is
   invisible to a `postgres` session.
