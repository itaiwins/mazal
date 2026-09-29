# Applying Mazal's migrations to an empty database

Last run: 2026-09-28 against project `tayiyczmacvhokdxfqvm` (MEXA-246), which was empty.

## Why there is a runbook instead of `supabase db push`

The filenames do not follow the CLI's `<timestamp>_name.sql` convention and several
prefixes collide — two `00003`, two `00004`, two `00005` — so a lexicographic sort is not
a valid order. Two pairs actually break if you sort them:

| Wrong (sorted) order | Why it fails |
|---|---|
| `20250114_add_creator_tracking.sql` before `20250114_shidduch_system_fixed.sql` | `relation "shidduch_profiles" does not exist` — the creator-tracking migration alters a table the shidduch migration creates |
| `20250114120000_cleanup_verification_cron.sql` first (digits sort before `_`) | irrelevant here, that file is deliberately not applied |

## Order

Apply exactly this sequence:

```
00000_extensions.sql
00001_initial_schema.sql
00002_rls_policies.sql
00003_fix_badges_delete_policy.sql
00003_push_tokens.sql
00004_storage_buckets.sql
00004_safta_messages.sql
00005_orthodox_mode.sql
00005_notification_triggers.sql
00006_safta_pro.sql
20250114_shidduch_system_fixed.sql
20250114_add_creator_tracking.sql
20250115_profile_views.sql
00007_enable_rls_on_unprotected_tables.sql
00008_fix_users_policy_recursion.sql
00009_fix_shidduch_profiles_policy_recursion.sql
00010_secure_definer_rpcs.sql
00011_preserve_moderation_history.sql
00012_deleted_accounts_retention.sql
00013_users_column_privacy.sql
00014_revoke_unreachable_table_privileges.sql
00015_scope_users_write_grants.sql
00016_client_role_write_privileges.sql
00017_matching_actually_matches.sql
00018_publish_messages_to_realtime.sql
00019_college_and_safta_stats_visibility.sql
00020_safta_likes_actually_save.sql
00021_drop_orthodox_discovery_rpc.sql
00023_safta_connection_consent.sql
00022_safta_public_profiles.sql
00024_revoke_self_awarded_verified_badge.sql
00025_rewind_undo_last_swipe.sql
00030_public_profiles_publish_age_not_dob.sql
00026_who_liked_me.sql
00031_safta_like_needs_a_connection.sql
00032_has_entitlement.sql
00033_rewind_retracts_super_like_notification.sql
00034_messages_are_not_rewritable.sql
00035_server_side_swipe_quota.sql
00036_unmatch_is_one_way.sql
00037_shadchan_notes_belong_to_their_shadchan.sql
```

**`00037` has to come after `00005` and `20250114_shidduch_system_fixed`, and its guards
0a/0c abort if it does not.** `00037_shadchan_notes_belong_to_their_shadchan.sql` (MEXA-419)
replaces the one policy on `public.shadchan_notes` — `FOR ALL TO public USING (true)`, which
let any signed-in caller and any anon-key holder read, rewrite, delete and forge every
matchmaker note — with four command-scoped policies `TO authenticated`, gives
`shadchan_notes.shadchan_id` its first foreign key (`shadchanim(id) ON DELETE CASCADE`), adds
the SECURITY DEFINER helper `public.current_shadchan_ids()`, and revokes `anon`'s `arwd`. It
needs `00005` for `shadchanim` (guard 0a) and the shidduch migration for the table itself.
It is independent of `00016` in both directions: `00016` revokes `anon` across the whole
schema in a loop and asserts the result with `has_table_privilege`, so this subset already
being revoked is a no-op it still passes; and `00016` never names `shadchan_notes` in its own
statements. `00016`'s **rollback** would re-grant `anon` the whole of
`INSERT, SELECT, UPDATE, DELETE` here — `shadchan_notes` is one of the 31 names in that
file's `v_restore` array and is not in its `v_insert_select_only` exception, which holds only
`reports` — i.e. exactly the `arwd` this file takes away. That is survivable, and for all
four commands, because all four policies are `TO authenticated`: the grants would return and
RLS would still deny `anon` every row, with the INSERT denied outright for want of any
applicable policy. Rehearsal mutations F4/F4b/F4c/F4d restore that exact grant set and probe
all four. Live had **0 rows in `shadchan_notes`**, so the foreign key validated against
nothing and nobody is stranded.

**Three things to read in it before approving.** (1) `shadchan_id` had no FK at all, and the
file has to *decide* what the column means; DECISION 1 argues for `shadchanim(id)` over
`users(id)` and says why `users.shadchan_id` is not a precedent. (2) The predicate goes
through a DEFINER helper rather than a direct join on `shadchanim`, because a policy
expression inherits that table's own RLS and its only SELECT policy is `is_active = true` —
so the obvious join would silently cut a *deactivated* matchmaker off from their own notes.
Probe E6 in the rehearsal demonstrates exactly that failure. (3) The explicit `WITH CHECK` on
the UPDATE policy is **not** what stops a note being moved into another matchmaker's list —
a `FOR UPDATE` policy with a NULL `WITH CHECK` falls back to its `USING`, and this `USING`
reads `shadchan_id`. It is written out so the rule is visible in `pg_policies.with_check`
instead of implied, which is the reading mistake that let `FOR ALL USING (true)` stand as a
write policy for eight months. Section 3 carries the six-scenario measurement.

**`00035` has to come after `00033`, and its guard 0c aborts if it does not.**
`00035_server_side_swipe_quota.sql` (MEXA-373 items 2, 3, 5) `CREATE OR REPLACE`s
`public.undo_last_swipe()` to add the Rewind entitlement gate, and the body it writes is
`00033`'s — MEXA-401's retraction of the still-pending super-like push included. Applied the
other way round, `00033` would overwrite the gate with its own ungated body and hand a paid
feature back to every free client with nothing failing. So guard 0c is a hard `RAISE`, not a
warning, and it is also what makes `00035`'s rollback deterministic: because `00033` is
guaranteed applied, the rollback knows exactly which body to restore instead of branching on
the ledger the way `00025`'s comment restore has to. Post-check 5e asserts
`notification_queue` is still named in the body it just wrote, so an accidental overwrite
fails loudly on the way in as well.

It also depends on `00032` (guard 0b): it re-creates `has_entitlement(text)` as a wrapper
over a new internal `public.user_has_entitlement(uuid, text)`, so the entitlement predicate
has exactly one copy. The trigger cannot use `has_entitlement(text)` — that one answers about
*the caller* and takes no user id by design, while a quota belongs to `NEW.swiper_id`.
`user_has_entitlement` does take a user id, so it is revoked from PUBLIC, `anon`,
`authenticated` **and** `service_role`; it is only ever called from other DEFINER functions.

What it enforces, from `FEATURE_LIMITS` in `src/lib/config/revenuecat.ts`: free = 25 swipes
per UTC day (**every** action, passes included, because the device counts passes) and 1 super
like per week; `mazal_gold`/`mazal_platinum` = unlimited swipes and 5 super likes per week.
The week starts at Monday 00:00 UTC **minus 14 hours**, which is earlier than Monday 00:00 in
every timezone, so the server has always reset before any device has and can never refuse a
super like the user's own app is offering. Refusals are `RAISE` with `ERRCODE = P0001` and a
stable token in `DETAIL` (`swipe_daily_cap`, `super_like_weekly_cap`); the client branches on
the token, never on the HTTP status.

**Read the header before approving: the daily cap is *not* "what the device already
enforces".** `resetDailySwipes()` in `premiumStore` is defined and never called, and
`resetWeeklyLimits()` does not touch `dailySwipesRemaining` — what actually refills the free
allowance is `setEntitlements()`, which runs from `usePremium()`'s mount effect. So today the
device's cap is effectively *per app launch*, which a server cannot express. `00035` enforces
the rule Gojo stated in words (25 a day), and that is a real tightening for a heavy free
user. 0 users and no TestFlight build, so nothing is taken from anybody today. The client
reset bug is filed separately, because fixing it makes the *device* stricter and that is a
product change rather than a migration.

**`00034` has no ordering dependency beyond `00001`, and is listed last because it only
narrows.** `00034_messages_are_not_rewritable.sql` (MEXA-406) swaps `authenticated`'s
table-wide `UPDATE` on `public.messages` for `GRANT UPDATE (is_read, read_at)` and revokes
`anon`'s outright. **It writes no policy** — see the status entry for why the obvious
`WITH CHECK` fix is a measured no-op — and its section 4a aborts if one moved. It is
independent of `00016` in both directions, and that was checked rather than assumed:
`00016` section 3 revokes `messages` **DELETE** and section 7b asserts that revoke held, so
it does not collide; and `00016` section 7c — the "these grants must STILL be granted" list —
names `matches:INSERT`, `safta_likes:UPDATE` and `shidduch_suggestions:INSERT/UPDATE` but
**not** `messages:UPDATE`, so narrowing it here cannot make `00016` abort later. `00016`
section 6 writes `COMMENT ON TABLE public.messages`, which is why `00034` records its
invariant in **column** comments instead — neither file overwrites the other and neither
rollback has to know about the other (the `00025`/`00026` lesson, MEXA-361). `00018` puts
this table in `supabase_realtime`; replication does not run as `authenticated`, so a client
grant change does not touch it, and `00034` section 4f asserts the publication membership
survived anyway.

**`00036` has no ordering dependency beyond `00001`, `00002` and `00010`, and is listed
last because it only narrows.** `00036_unmatch_is_one_way.sql` (MEXA-418) swaps
`authenticated`'s table-wide `UPDATE` on `public.matches` for
`GRANT UPDATE (last_message_at)`, revokes `anon`'s outright, and adds
`public.unmatch(uuid)` — a SECURITY DEFINER function that sets the caller's own
`*_unmatched` flag and `is_active = false`, and never sets either back. Before it, the
person who had been unmatched could write `is_active = true`, clear the other side's flag
and resume the thread; measured on live, both before and after, in
`.scratch/mazal-mexa418/rehearse.mjs` (`REHEARSE.txt`). **It writes no policy** — a
`WITH CHECK` expression sees only the NEW row, so "`is_active` may go true→false but never
back" is not expressible there — and its section 5a aborts if one moved.

**The trap in it is `last_message_at`, and it is the reason the file is not a bare
`REVOKE`.** `update_match_last_message()` (00001) is a **SECURITY INVOKER** AFTER INSERT
trigger on `messages` that `UPDATE`s `matches`, so it runs as `authenticated` and needs a
real UPDATE privilege. Measured in the rehearsal (probe H1): with `UPDATE` revoked outright,
**every message send fails** with `42501 permission denied for table matches` — the whole
chat feature. So `00036` grants that one column back, and asserts in 5k that the trigger is
still INVOKER, so the day MEXA-296 makes it DEFINER the grant can be dropped with it.
`git grep last_message_at` over `src/` and `app/` finds it only in the generated types, so
the column handed back is one nothing reads. It is independent of `00016` in both
directions, checked rather than assumed: `00016` section 3 revokes `matches` **DELETE** and
7b asserts that held, and 7c — the "must STILL be granted" list — names `matches:INSERT` but
**not** `matches:UPDATE`. `00016` section 6 writes `COMMENT ON TABLE public.matches`, so
`00036` records its invariant in **column** comments instead (the `00025`/`00026` lesson,
MEXA-361). Rewind is untouched: `undo_last_swipe()` never writes `matches` — it refuses with
`reason = 'matched'` when the pair has a row — and 5l asserts both that and the absence of
any `UPDATE matches` in its body. `check_for_match()` is DEFINER since `00017`, so mutual
matching is unaffected; 5k asserts that too.

**`00033` must come after `00025`, and that is the only ordering it has.**
`00033_rewind_retracts_super_like_notification.sql` (MEXA-401) `CREATE OR REPLACE`s
`public.undo_last_swipe()` to add one guarded DELETE, so `00025` has to have created the
function first. Its guard `0a` refuses unless `00025` is in the ledger **and** the live body
hashes to `00025`'s, so applying it early or on top of some third replacement aborts and
changes nothing. It also needs `00005_notification_triggers.sql`, which creates
`notification_queue` and `notify_super_like` — guard `0f` reads that function's live body
rather than trusting the file on disk, because the payload shape
(`type=super_like, userId=NEW.swiper_id`) is the single fact the DELETE keys on. It is
independent of `00016` in both directions: it changes no grant and no policy, and the DEFINER
owner `postgres` keeps its access whichever order the two land in.

**`00032` has no ordering dependency and is listed last because it is additive.**
`00032_has_entitlement.sql` (MEXA-373, Phase 1 item 1) creates
`public.has_entitlement(text)` — the first server-side answer to "has this caller paid?" —
and **calls it from nowhere**. It reads `public.subscriptions`, which has existed since
`00001`, and needs only `public.current_app_user_id()` from `00008`/`00010`, so it is safe
before or after everything else in this list. Two relationships worth knowing:

* **It does not require `00016`, but `00016` is what makes it durable.** `00032`'s whole
  safety argument is that `public.subscriptions` carries exactly one policy (SELECT own
  row), so the INSERT/UPDATE/DELETE grants `authenticated` and `anon` still hold on that
  table are inert. Guard `0f` refuses to apply if any client-write policy exists, and the
  function's COMMENT states the rule — but the grant-level fix is `00016`'s, and `00016` is
  still unapplied (MEXA-364).
* **The gate inside `get_who_liked_me()` is not here.** `00026`'s header specifies it ("the
  gate goes in `get_who_liked_me()` and nowhere else: `count_who_liked_me()` stays free by
  design") and `00026` is unapplied, so that call site lands with or after `00026`. Same for
  the Rewind gate in `00025`'s `undo_last_swipe()` and the daily swipe/super-like caps — the
  rest of MEXA-373 Phase 1, all three blocked on one product decision; see the issue.

**`00031` has to come after both `00023` and `00020`, which is why it is listed last.**
`00031_safta_like_needs_a_connection.sql` (MEXA-361) requires `for_user_id` on a
`safta_likes` row to hold an **`accepted`** `safta_connections` row to the recommending
Safta, and that predicate only means consent because `00023` took `'accepted'` out of the
Safta's own hands — before `00023` an attacker awarded herself the connection first and the
new check was decorative. It also replaces `00020`'s `"Safta can send own likes"` UPDATE
policy, so `00020` has to have written it. Unlike the `00022`/`00023` pair this is **not
merely documentation**: `00031`'s section 0 aborts with
`00023 (safta_connection_consent) is not in the ledger` and again if the
`safta_connections` INSERT check does not pin `status` to `pending`, so applying it early
fails loudly and changes nothing. `00028` and `00029` are absent from this list — see the
note at the end of this section.

**`00022` is deliberately listed after `00023`**, which is not where the placeholder note
here used to say it would go. `00022_safta_public_profiles.sql` (MEXA-302) publishes a
Safta's `display_name` to a grandchild on an **`accepted`** connection, and its header
argues that `accepted` means the grandchild consented. That sentence was false at the RLS
layer until `00023_safta_connection_consent.sql` (MEXA-357) landed: `00002`'s INSERT check
constrained neither `connected_user_id` nor `status`, so anyone could write themselves an
`accepted` connection to any user id. Applied the other way round on a fresh database,
`00022` is briefly a view whose row rule rests on a premise the schema does not yet
enforce. Nothing is reachable in that window — a migration run has no users — so this is
documentation of the dependency rather than a hazard, but the order is the honest one.

**`00030` is deliberately listed before `00026`.** `00030` (MEXA-320) rebuilds
`public.user_public_profiles` to publish an `age` instead of a `date_of_birth`, and
`00026`'s `get_who_liked_me()` selects that column out of the view - so the view has to be
reshaped first. Applying `00026` first aborts at its guard 0d with
`user_public_profiles has no column(s) [age]`, which is a clear error and no damage; it does
not corrupt anything and can simply be run again after `00030`. This is what the order list
is for: it has never been numeric (two `00003`s, two `00004`s, two `00005`s).

**The list above is for a fresh database. It is not what is on `tayiyczmacvhokdxfqvm`, and
the live set has holes on purpose.** `00016` is reviewed and PASSed but has never been
carded for an apply, so `00017`, `00018` and everything after went on over the gap — each
one checked to be independent of it before it was applied, and the per-migration notes
below say which. `00012`, `00026`, `00028` and `00029` are likewise
absent from live (`00030` was applied on 2026-09-29, MEXA-385; `00020` on the same day,
MEXA-394). **Do
not "fix" the order to close a gap**, and do not read a numeric hole as a mistake: apply
the full list on a new database, and on live go by the ledger plus the notes below. The
measured census is in the *ledger lags the repo* note near the end of this section.

Notes on the order:

- `00000_extensions.sql` has to come first. `00001` declares
  `CREATE EXTENSION IF NOT EXISTS "postgis"` at the top and then uses `::geography` lower
  down, but Postgres parses a whole multi-statement batch before executing any of it, so
  applying `00001` to a database without PostGIS fails with
  `syntax error at or near "::"`.
- `00007`–`00010` come last on purpose: they fix RLS and privilege problems in the
  migrations above them, so they have to run after the objects they repair exist. `00010`
  in particular replaces functions defined in `00005`, `00006`, `20250114_*` and
  `20250115_*`.
- Undo scripts live in `supabase/rollback/`, **never** in this directory. Anything
  dropped in here is a file some tool will eventually apply in name order, and an undo
  script is the last thing you want applied by accident — `00010_rollback.sql` sorted
  *ahead* of the migration it undoes. There is one for every migration from `00010` on
  except `00018`: `00010_secure_definer_rpcs_rollback.sql`,
  `00011_preserve_moderation_history_rollback.sql`,
  `00012_deleted_accounts_retention_rollback.sql`,
  `00013_users_column_privacy_rollback.sql`,
  `00014_revoke_unreachable_table_privileges_rollback.sql`,
  `00015_scope_users_write_grants_rollback.sql`,
  `00016_client_role_write_privileges_rollback.sql`,
  `00017_matching_actually_matches_rollback.sql`,
  `00019_college_and_safta_stats_visibility_rollback.sql`,
  `00020_safta_likes_actually_save_rollback.sql`,
  `00021_drop_orthodox_discovery_rpc_rollback.sql`,
  `00022_safta_public_profiles_rollback.sql`,
  `00023_safta_connection_consent_rollback.sql`,
  `00024_revoke_self_awarded_verified_badge_rollback.sql`,
  `00025_rewind_undo_last_swipe_rollback.sql`,
  `00026_who_liked_me_rollback.sql`,
  `00028_pin_function_search_path_rollback.sql`,
  `00029_reentry_restore_and_hold_rollback.sql`,
  `00030_public_profiles_publish_age_not_dob_rollback.sql` and
  `00031_safta_like_needs_a_connection_rollback.sql` and
  `00032_has_entitlement_rollback.sql` and
  `00033_rewind_retracts_super_like_notification_rollback.sql` and
  `00034_messages_are_not_rewritable_rollback.sql` and
  `00035_server_side_swipe_quota_rollback.sql` and
  `00036_unmatch_is_one_way_rollback.sql` and
  `00037_shadchan_notes_belong_to_their_shadchan_rollback.sql`; read each one's header.
  `00037`'s **names what it restores** — the one `FOR ALL TO public USING (true)` policy
  (verbatim from `20250114_shidduch_system_fixed.sql:459`, trailing comment included, so a
  diff against that file comes back empty), the measured pre-apply `relacl`, the absent FK,
  the absent helper and the two NULL comments — rather than deriving any of it at run time
  (MEXA-364/399). It **re-opens MEXA-419 in full** and says so in a closing `RAISE WARNING`:
  after it, any signed-in caller and any anon-key holder can read, rewrite, delete and forge
  every matchmaker note. It checks `relacl` as a **sorted set of aclitems, not as
  `relacl::text`** — a REVOKE-then-GRANT round trip restores the same four entries in a
  different array order, and written as a string comparison this assertion aborted a
  *correct* rollback in rehearsal. It touches no row, and its section 3 refuses to drop the
  helper if any policy anywhere still calls it.
  `00036`'s **names what it restores** — the measured pre-apply `relacl`, the eight
  `attacl`s (all NULL: there were no column grants on that table at all) and the eight NULL
  column comments — rather than deriving any of it at run time (MEXA-364/399). It drops
  `public.unmatch(uuid)` rather than leaving it, because a DEFINER writer beside a
  client-writable table is a state nobody has reviewed. Three things to know before running
  it. It **re-opens MEXA-418 in full**: after it the person who was unmatched can again set
  `is_active` back to true and resume the thread, and the file says so in a closing
  `RAISE WARNING`. It also **takes the client's unmatch and block with it** — the same
  commit points `useUnmatch` and `useBlockUser` at the RPC, so any build cut after that
  commit loses both (PostgREST answers 404 for a missing function); there is no TestFlight
  or store build today, so the only client is a dev build. And its `anon` re-grant is
  **conditional on the live ledger** — if `00016` has landed in the meantime, `anon`'s
  `UPDATE` is deliberately *not* restored, for the reason `00034`'s rollback gives. Both
  branches are asserted in its section 4c. It also asserts the active-match count did not
  move, because a rollback that quietly flipped `is_active` would be undoing real people's
  unmatches, which is worse than the bug.
  `00035`'s **restores MEXA-373 in full** and says so at the top: with the trigger gone
  `public.swipes` has no cap of any kind again, so unlimited swipes, unlimited super-likes
  (and therefore unlimited push notifications at whoever is swiped on), and Rewind stops
  checking the entitlement. It is otherwise a true inverse — it restores `00032`'s
  `has_entitlement` body and `00033`'s `undo_last_swipe` body verbatim, drops the helper, and
  asserts on the way out that the gate is gone *and* that MEXA-401's retraction survived. Its
  section 0d refuses if anything other than the two functions it rewrites has come to call
  `user_has_entitlement`, since a string-body call leaves no `pg_depend` edge for
  `DROP ... RESTRICT` to catch.
  `00034`'s **names what it restores** — the measured pre-apply `relacl`, the nine
  `attacl`s (all NULL: there were no column grants on that table at all), and the nine NULL
  column comments — rather than deriving any of it at run time, because by the time a
  rollback runs the pre-state is gone (MEXA-364/399). It touches **no policy**, because
  `00034` writes none; section 3a asserts the UPDATE policy is byte-for-byte what it was, in
  both files. Two things are worth knowing before running it. It **re-opens MEXA-406 in
  full**: after it, either participant in a match can again rewrite the other person's
  message body and reassign its authorship, and the file says so in a closing
  `RAISE WARNING`. And its `anon` re-grant is **conditional on the live ledger** — if
  `00016` has landed in the meantime, `anon`'s `UPDATE` is deliberately *not* restored,
  because `00016` section 7a asserts `anon` holds nothing in `public` and handing a chat
  table back to a role whose key ships inside the app binary is not an undo, it is a second
  bug. Both branches are asserted in its section 3c and both are exercised in
  `.scratch/mazal-mexa406/guards_00034.mjs` (G9, G10).
  `00033`'s **names what it restores**: `00025`'s function body, pinned by `prosrc` md5
  `33f97d655e9e1219d7f1456c57db7aea` and asserted afterwards, not merely "the function
  exists". It refuses unless the live body is `00033`'s, so it cannot silently revert a
  fourth migration's version. It restores `00025`'s `COMMENT ON FUNCTION` byte for byte,
  deletes its own ledger row, and touches no table, policy or grant — `00033` changed none
  of those, so undoing it gives nothing back and opens no window. It re-opens MEXA-401 in
  full (a rewound Super Like leaves a `pending` push naming the swiper), and it restores
  **code, not data**: rows already retracted are gone, since `notification_queue` has no
  soft delete.
  `00032`'s is a clean undo — `00032` gates nothing, so nothing regresses in behaviour when
  it goes — but it **refuses while any caller exists**. A SQL function called from another
  function's string body leaves no `pg_depend` edge, so `DROP ... RESTRICT` would succeed and
  the caller would then fail at runtime; section 0c greps `pg_proc.prosrc` and both halves of
  every policy expression instead. If it fires, roll back whatever added the call site first.
  `00031`'s **re-opens MEXA-361 in full** — one INSERT again queues a push notification at
  any user of the app — and its header says so at the top; it restores `00002`'s INSERT
  policy and `00020`'s UPDATE policy byte for byte, and deliberately leaves `00023` alone.
  `00030`'s **refuses to run while `00026` is applied**, because putting `date_of_birth`
  back would leave `get_who_liked_me()` selecting a column that no longer exists; roll
  `00026` back first. It is otherwise a bit-exact inverse, grants included. `00022`'s is a
  plain `DROP VIEW` and a genuine bit-exact inverse. `00014`'s,
  `00015`'s and `00016`'s are the three that are not bit-exact inverses, and each says
  exactly where it differs and why. `00013`'s is exact except for column order, which its
  header explains. `00016`'s is split into seven independent sections, `00019`'s into two and
  `00020`'s into two, smallest first — run the one that unblocks you, not the whole file.
  `00016`'s section G (its ledger row) is the exception to "run the smallest section": run it
  whenever you have run enough of B–F that `00016` is no longer true of the database.
  **One lesson from `00016`'s section C is general: a rollback must name what it restores, not
  what it skips.** A skip list fails open — every table added after it was written, and every
  table a later migration closes, is handed back by default, with nothing to notice. `00016`'s
  skipped `user_photos`, which `00013` had closed to `anon`, so running it would have
  re-opened people's photo rows to anyone holding the anon key while every one of its own
  checks passed (MEXA-364, measured in a rolled-back transaction against live). Same class
  Alucard caught in `00014`'s rollback on MEXA-275, and the same class the `reports` branch
  exists for — third instance, so the shape changed rather than the entry being added. It is
  now an explicit 31-name restore list plus an assertion that the eight relations
  `00011`/`00013`/`00019` closed to `anon` are still closed. **`00014`'s rollback still has
  the skip-list shape and is worse (it re-grants `TRUNCATE`, which ignores RLS, to `anon` on
  `user_photos`, `user_colleges` and `user_safta_stats`) — MEXA-399, not yet fixed.**
  `00021`'s is the first one that **deletes its own ledger row** rather than leaving a
  `DELETE` in a comment, because `00021` writes that row inside its own transaction; expect
  new rollbacks to do the same. `00024`'s does, and it is also **not** a bit-exact inverse:
  `00024` revokes `UPDATE` on `is_verified` *and* `is_photo_verified`, but `authenticated`
  never held the second one, so the rollback restores only `is_verified` — granting the other
  would be an escalation dressed as a rollback. Its header says so and its section 2 asserts
  it.
- `00011` is **APPLIED** to `tayiyczmacvhokdxfqvm`, 2026-09-28 23:31Z, from commit
  `1980e6a` (MEXA-256; Alucard reviewed it on MEXA-259 and MEXA-262, Lelouch approved the
  apply). Consequences anything written after this has to assume:
  **`reports` has no foreign keys.** `reports_check_participants()` is what enforces that
  both participants exist, and a report deliberately outlives the people in it, so a
  `reported_id` pointing at no `users` row is correct rather than corrupt. `users` carries
  a `BEFORE DELETE` tombstone trigger and an identity guard on `email`/`phone`, and
  `deleted_accounts`, `moderation_secrets` and `hash_account_identifier()` exist, all
  `service_role`-only.
- `00012` is **not applied yet**: what reads the tombstones at signup still waits on a
  product decision (MEXA-258, `docs/MODERATION_REENTRY.md`). It refuses to run if `00011`
  has not — `00011` now has, so it is no longer blocked on that.
- `00013` **is applied** — 2026-09-29 00:35Z, MEXA-261, from commit `9f1e080`, after Guts's
  review (MEXA-286) and Lelouch's approval (MEXA-301). No dependency either way with
  `00011`, `00012` or `00014`, and it was verified against the schema as it stands *with*
  `00011` and `00014` already on. Post-check 19/19, including on the live project:
  `public.users` answers only the caller's own row, the view carries no email, phone,
  `auth_id`, coordinates or Instagram token, `anon` holds zero privileges on `users`,
  `user_photos` and the view, and `user_integrations` is `service_role`-only
  (`archive/backups/mazal-00013-postcheck-20260929T003325Z.txt`; pre-apply catalog snapshot
  alongside it). It is the one migration here that **the app cannot run without**: it makes
  `public.users` own-row-only and moves other people's profiles to a new
  `public.user_public_profiles` view, which `src/api/queries/useDiscoveryProfiles.ts`,
  `src/api/queries/useMatches.ts` and `app/(safta-tabs)/index.tsx` already read. So it and
  the app ship together — the old app against the new database means an empty deck, the new
  app against the old database means a 404 from PostgREST for the view. **The database is
  now the new side**, so a checkout older than `000b7a0` will get an empty deck.
  One thing the view deliberately publishes: `date_of_birth`, because the client renders
  `calculateAge()` from it and filters the age range server-side on that column. Exact DOB is
  more than an age, so narrowing it is filed as its own issue rather than left unnamed.
- `00014` **is applied** — 2026-09-28 23:36Z, MEXA-268, after Alucard's review (MEXA-275) and
  Lelouch's approval (MEXA-285). It has no dependency on `00011`–`00013` and they have none
  on it: it is one `REVOKE` over every table in `public` plus a default-privileges fix, and
  re-running it is a no-op. Applying it out of order is safe; applying it *before* a new
  `CREATE TABLE` is better, because that is what stops the new table being handed TRUNCATE.
  Post-check, all green: as `authenticated`, `TRUNCATE` on `reports` / `users CASCADE` /
  `messages` / `swipes` and `CREATE TRIGGER ON reports` are `42501`, reads and
  `UPDATE public.users` still work, and no table in `public` grants any of the four to
  `anon` or `authenticated` (`.scratch/mazal-mexa268/APPLY_AND_POSTCHECK.txt`).
  **Re-checking this later: `00015` has since changed what "`UPDATE public.users` still
  works" means.** A *table-wide* `UPDATE public.users` as `authenticated` is now `42501`,
  and that is `00015` working as designed, not `00014` regressing. Probe a column the client
  is actually granted (`bio`) and expect a server-owned one (`updated_at`, `elo_score`) to be
  refused — `.scratch/mazal-mexa268/postcheck_00014_rerun.mjs`, re-run green 20/20 on
  2026-09-29 against the live project. It went on
  **after** `00011`, so the sweep covered `deleted_accounts` and `moderation_secrets` too —
  no-ops there, since `00011` had already revoked everything from the client roles. Its
  header counts 36 tables because that is what `public` held when the problem was measured;
  `00011` has since added two.
- `00015` **is applied** — 2026-09-29 00:51Z, from `mazal-restart` @ `a5b233c` (MEXA-276),
  after Guts's review (MEXA-291) and Lelouch's approval (MEXA-321). It is independent of
  `00013` and `00014` and they are independent of it: it names no column `00013` drops, and
  `00014` revokes a disjoint set of verbs (`00014` takes `Dxtm`, `00015` takes `a` and `w`
  and grants them back per column), so any order works. Its rollback is
  `00015_scope_users_write_grants_rollback.sql`, a bit-exact inverse except that it does not
  restore `anon`'s INSERT/UPDATE; the file says why.
  Post-check, all green: **79 checks, 0 failed** against live with the migration applied —
  every granted column still writes as `authenticated`, every other column returns `42501`
  including when smuggled into the same statement as a legitimate one, and the row rule is
  unchanged (`.scratch/mazal-mexa276/POSTCHECK_00015.txt`; before/after reads in
  `PRE_APPLY_00015.txt` and `POST_APPLY_00015.txt`). `public.users` went from
  `authenticated` holding INSERT/UPDATE on all 53 columns to **INSERT on 33 and UPDATE on
  34**; `SELECT` is untouched at 53, which is why `select('*')` still works. `relacl` is
  now `authenticated=r` — the remaining write privileges live only at column level. The
  UPDATE policy gained its explicit `WITH CHECK (auth.uid() = auth_id)`.
  **`00015` is column-level. Adding a screen that writes a new `users` column now means
  adding a one-line `GRANT` in the same migration as the screen**, or the write returns
  42501. The migration header lists every granted column with the file:line that justifies
  it; keep that list true.
- `00016` is **not applied yet**, and that is still true as of 2026-09-29 12:51Z — re-measured
  read-only on MEXA-364 (and before that on MEXA-326): no `00016` row in
  `supabase_migrations.schema_migrations`, and
  `anon` still holds **126** table grants in `public`, which its
  `REVOKE ALL ... FROM anon` would take to zero. It is **no longer waiting on a review**:
  Guts PASSed it at `e08396e` on MEXA-300. It is waiting on someone to card the apply for
  Lelouch, and nobody has. **`00017` and `00018` went on live over this gap deliberately** — both were
  checked to be independent of it first (see `00017`'s note below) — so the hole between
  `00015` and `00017` in the ledger is intentional, not a skipped step to repair.
  **Amended on MEXA-364, after Guts's PASS**, in three places, none of them a privilege
  statement:
  1. The file now wraps itself in `BEGIN; … COMMIT;` and writes its own ledger row (section 8,
     MEXA-325). It predates that convention. Both matter more here than usual: without the
     transaction, ~30 REVOKEs commit one at a time and section 7 stops being a safety net —
     it would raise *after* the grants were gone; without the row, `00011`'s failure repeats
     and this file's whole effect is invisible in `\dt`. Proven by sending the file verbatim
     with its `COMMIT;` swapped for `ROLLBACK;`: all 126 grants and no ledger row survived,
     which is only possible if the `BEGIN` is real (`.scratch/mazal-mexa364/ATOMICITY.txt`).
  2. Its rollback's section C went from a skip list to an explicit 31-name restore list,
     because the skip list had gone stale and re-opened `user_photos` to `anon` — see the
     rollback note above and MEXA-364.
  3. Its rollback gained section G, which deletes the ledger row that (1) now writes.

  Re-verified against live in rolled-back transactions after those amendments —
  `.scratch/mazal-mexa364/verify.mjs`, three modes, nothing left behind (a fresh connection
  re-reads the grant count and the ledger each run): **`before` 39/39**, **`after` 50/50**,
  **`rollback` 17/17**, plus a pre-fix control (`CONTROL.txt`) showing the old rollback
  re-opened `user_photos` silently and the new assertion aborts and names it.
  The `before` run is the one to read: as the real `authenticated` role, `DELETE FROM swipes`,
  `DELETE FROM messages`, `DELETE FROM matches` and four UPDATEs all **succeed today** and RLS
  filters them to zero rows with no error, and `SELECT` on `notification_queue` is allowed.
  After, every one is `42501 permission denied for table` — checked on the *message*, not just
  the code, because RLS refusing an INSERT is also `42501` and only the message tells a missing
  policy from a missing grant.
  Two things the measurement corrected: `users` DELETE for `authenticated` was **already gone**
  (`00015` left `relacl` at `authenticated=r`), so 41 of 00016's 42 asserted pairs were still
  granted, not 42; and nothing is actually exposed today — `notification_queue` holds 0 rows and
  RLS admits none, so this is a fix, not an incident.
  It is written against the live post-`00014` state and **assumes `00014`
  has been applied**: it does not repeat `00014`'s work and its rollback deliberately does
  *not* undo it (`reports` comes back as `anon=ar`, never `arwd`). It is independent of
  `00013` and `00015`: `00015` narrows what `authenticated` may write to `users` by column,
  `00016` takes `users` DELETE away from `authenticated` and everything away from `anon`, so
  the two touch disjoint verbs and any order works. Its rollback is split into seven
  independent sections — B (`authenticated`), C (`anon`), D (`notification_queue`),
  E (sequences), F (comments), G (the ledger row), plus A as a template for one verb on one
  table. **Run the smallest one that unblocks you.** Section C is the one to think hardest about: it hands
  unauthenticated read access back to `colleges`, `user_badges` and `user_safta_stats` —
  or it did. `00019` scoped `user_safta_stats`' SELECT policy `TO authenticated` and took the
  table off section C's restore list, and `00015_prompts_badges_visibility` does the same for
  `user_badges` when it lands (MEXA-277), which leaves `colleges` as the only table section C
  really re-opens. `00016` is also **independent of `00019`**: `00016` changes grants and no
  policy, `00019` changes two policies and revokes `anon` on the two tables it touches, which
  `00016`'s schema-wide `REVOKE ALL ... FROM anon` subsumes. Either order works.
- `00017` **is applied** — 2026-09-29 01:19:57Z, from `mazal-restart` @ `299731d`
  (MEXA-294 and MEXA-296 cause 1), after Guts's review (MEXA-316), Gojo's routing and
  Lelouch's approval (MEXA-324). It is a change users see: the "It's a Match!" screen and
  new-match push notifications start working, and **no match row had ever been created by
  anything** before it. It is independent of `00011`–`00016` and of `00018` — it replaces one function
  defined in `00001` and adds one table to `supabase_realtime`, none of which those name —
  so **any order works, including applying it before `00015` and `00016`.** Gojo checked
  that specifically: Guts's "nobody can force a match with someone who has not liked them"
  argument cites `00016`'s revoked UPDATE/DELETE grants, but `00002` gives `swipes` only a
  SELECT and an INSERT policy, so RLS already refuses UPDATE and DELETE whatever the grants
  say. Two things it does not do, both deliberate:
  **no new SELECT policy on `swipes`** (one admitting `swiped_id = <me>` would publish
  "who passed on you") and **no INSERT policy on `matches`** (the trigger owns match
  creation once it is DEFINER, and the client insert that needed one is deleted in the
  same commit). The dead INSERT grant `anon` and `authenticated` still hold on `matches`
  is left for MEXA-274's sweep; it was already unreachable, because `matches` has never had
  an INSERT policy.
  **`00017` and the app ship together, like `00013`.** `performSwipe` after this commit
  reads the `matches` row the trigger creates; against a database without `00017` that row
  does not exist and the match screen stays missing — the same as today, not a new break.
  No backfill is needed: `swipes` and `matches` are both empty on `tayiyczmacvhokdxfqvm`.
  It **does not** set `REPLICA IDENTITY FULL` on `matches` — an earlier draft did, and
  MEXA-322 took it out for the reasons `00018`'s header sets out at length (realtime
  re-reads the live row by primary key for the RLS check, so a policy on non-PK columns is
  fine at the default identity) plus one specific to this table: no column on `matches` is
  TOASTable, so the default identity costs nothing at all here.
  Its rollback is `00017_matching_actually_matches_rollback.sql`, a bit-exact inverse of
  both parts, verified in the same transaction. Note it drops `matches` from the
  publication but leaves `messages` there, since that one is `00018`'s.
  Post-check, all green: **21/21** from SQL as `authenticated` and `anon`
  (`.scratch/mazal-mexa294/POSTCHECK_00017.txt`), and **14/14** end to end through the
  real API with live realtime subscriptions and real sessions
  (`scripts/e2e/mexa294-realtime-matches.mjs`), 0 fixtures left behind by either. A
  mutual like now creates exactly one `matches` row, both people read it and both get the
  INSERT over realtime, both get a queued `new_match` push, a non-participant gets
  neither the event nor the row, a `pass` still matches nothing, `swipes` is still closed
  cross-side, and a client INSERT into `matches` is still `42501`.
  **The realtime warm-up is real, and it is a full two minutes.** The e2e run started
  2m30s after the `ALTER PUBLICATION` and case 4 failed — the second subscriber got no
  INSERT. The same run at 4m and again at 6m passed 14/14 unchanged. Nothing was fixed in
  between. Same behaviour `00018`'s apply saw; do not judge a realtime failure inside
  that window, and do not touch anything to "fix" it.
- `00018` **is applied** — 2026-09-29, from `mazal-restart` @ `c6ab722` (MEXA-313), after
  Guts's review (MEXA-323, PASS) and Gojo's acceptance. The apply is not timestamped
  anywhere: `supabase_migrations.schema_migrations` holds only `(version, statements,
  name)`, so the tightest bound the thread gives is **between the commit at 01:01:29Z and
  the report at 01:04:06Z** on 2026-09-29. Re-verified read-only against
  `tayiyczmacvhokdxfqvm` on 2026-09-29 (MEXA-326): ledger row `00018` /
  `publish_messages_to_realtime` is there, and `pg_publication_tables` for
  `supabase_realtime` is exactly `public.messages` and `public.matches` — nothing else.
  **It is the reason the chat live-updates at all.** `supabase_realtime` was an empty
  publication, so Postgres never wrote row-level changes for `messages` to the WAL and
  every `postgres_changes` subscription in the app received nothing while still reporting
  `SUBSCRIBED`. A database without `00018` fails exactly that way: silently, with no
  error anywhere. Two subscriptions depend on it, `useMessagesSubscription` (the chat) and
  `useAllMessagesSubscription` (the unread badge).
  It is independent of everything else. It names one table and one publication, adds no
  column, policy or grant, and is idempotent — the `ALTER PUBLICATION` is guarded by an
  existence check, so re-running it is a no-op. **Any order works**, including before
  `00017` (which is how it actually went on live).
  It **does not** set `REPLICA IDENTITY FULL`, deliberately; MEXA-322 took the same thing
  out of `00017` for the reasons this file's header argues at length. Two consequences its
  header records and that are now live: `payload.new.content` can be **absent** on the
  read-receipt UPDATE for a TOASTed body, which is why the client merges `payload.new`
  instead of replacing (case 6 of `scripts/e2e/mexa313-realtime-messages.mjs`); and
  **realtime's DELETE path bypasses RLS by design**, so any authenticated client can now
  see one DELETE event per deleted message — primary key only, no content, sender or
  `match_id` (case 11). Read the header before changing either.
  **It is the one migration from `00010` on with no rollback file.** To undo it, run
  `ALTER PUBLICATION supabase_realtime DROP TABLE public.messages` and
  `delete from supabase_migrations.schema_migrations where version='00018'` in one
  transaction. Note `00017`'s rollback drops `matches` from the same publication and
  deliberately leaves `messages` alone, because that one is this migration's.
  Post-check: **11/11** through `scripts/e2e/mexa313-realtime-messages.mjs` — three real
  sessions and live subscriptions, against **1/11** before the migration, the silent
  failure measured on the wire rather than argued. **The realtime warm-up is real**: the
  run straight after the apply missed its first three events and the re-run about two
  minutes later passed 11/11 unchanged with nothing fixed in between. `00017`'s apply saw
  the same thing at a full two minutes. Do not judge a realtime failure inside that
  window.
- `00019` **is applied** — 2026-09-29 02:17:07Z, from `mazal-restart` @ `976fe67` (the
  reviewed commit, unedited), after Guts's review (MEXA-289 / MEXA-330, PASS) and the apply
  on MEXA-331. The apply was one transaction holding the file body and the
  `schema_migrations` insert (`.scratch/mazal-mexa289/APPLIED_00019_TX.sql`), over a
  pre-apply policy/grant snapshot in `PREAPPLY_SNAPSHOT.json` — both tables held 0 rows.
  Post-apply against live without a re-apply: **31/31**, plus a rollback rehearsal at
  **30/30**, rolled back (`.scratch/mazal-mexa289/POSTAPPLY.txt`). Re-confirmed independently
  while measuring MEXA-297: `user_safta_stats`' only SELECT policy is
  `"Users can view own safta stats" TO authenticated USING (user_id = current_app_user_id())`
  and `anon` holds no privilege on it. **To roll it back**, run the rollback file (A+B; B is
  guarded on `00016`) and `delete from supabase_migrations.schema_migrations where
  version='00019'` in one transaction.
  It **depends on `00013`** for `is_discoverable_profile()` and
  `current_app_user_id()`, and on nothing else; `00013` is applied, so there is no unmet
  dependency on the live project. It is independent of `00014`–`00018` (see the `00016` note
  above for the one pair worth spelling out) and of `00015_prompts_badges_visibility`
  (MEXA-277), which does the same thing to two different tables and shares only the
  `00013` dependency — any order works.
  It takes `USING (true) TO public` off `user_colleges` and `user_safta_stats`, which were the
  last two per-user tables readable by anyone holding the anon key with no session, and
  revokes `anon` on both. **Nothing in the app reads or writes either table** — checked before
  narrowing them, and `MEXA-289` was filed assuming otherwise. There is no college screen
  (`education.tsx` is a hardcoded string list, the shidduch one writes
  `shidduch_profiles.college_university`, and `mazal-map.tsx`'s `'college'` is a location
  type), and `user_safta_stats`' only writer is the `update_safta_stats` trigger, which was
  broken outright when `00019` went on and is fixed by `00020` (MEXA-297). Both tables hold
  0 rows, so nothing was exposed in practice.
  Two deliberate departures from the fix as filed, both argued at length in the header:
  **`user_colleges`' cross-user policy tests `is_visible IS NOT FALSE`** (the column exists
  for exactly this and no policy had ever honoured it), and **`user_safta_stats` gets an
  own-row policy and no cross-user one** — a like counter with no reader and a flagged-off
  surface does not get a permissive policy on spec; whoever re-enables Safta writes it with a
  product argument, the way `00016` leaves `shidduch_messages`.
  Its rollback is `00019_college_and_safta_stats_visibility_rollback.sql`, split into A
  (policies) and B (`anon`'s grants), where B no-ops if `00016` has been applied. Running A
  restores the defect exactly, so prefer writing the narrow policy you need.
  Verified by `.scratch/mazal-mexa289/verify.py`, which leaves nothing behind (re-checked after
  every run: all six fixture tables back to 0 rows).
  **Now that `00019` is applied, `./verify.py live` is the only mode that means anything against
  `tayiyczmacvhokdxfqvm`, and it is the default.** It asserts the fix against the policies
  already on the database and applies nothing: **31/31** (`LIVE.txt`, Violet's own post-apply
  check, independent of the `POSTAPPLY.txt` run above).
  **The other three modes now fail against this project, by design — that is not a regression.**
  `after` and `rollback` cannot run at all: both apply the file first, and the request dies
  there on `42710 policy "Users can view own college affiliations" ... already exists` before
  any probe runs — the migration refusing to be applied twice. `before` does run and fails,
  which is the fix working: it fails on exactly the 8 probes `00019` closes (the `anon`
  no-session read, both block directions, `is_active`, `is_visible`), so a *passing* `before`
  here would mean the fix had been undone. Keep all four: `before`/`after`/`rollback` are how
  this gets re-verified against a **fresh** database (a rebuilt project, or a local Postgres
  following the Order block above). What they said when they were meaningful, against the
  pre-apply database at 2026-09-29 02:05Z:
  **`before` 30/30** (`BEFORE.txt`) — the defect measured on the live database, not argued
  from the policy text: as `anon`, with no session and only the publishable key, all 8
  `user_colleges` rows, all 5 `user_safta_stats` rows and the name of every school in the
  table. As a signed-in caller, the rows of a user who blocked them, a user they blocked, and
  a deactivated account.
  **`after` 31/31** (`AFTER.txt`) — own rows still visible including the `is_visible = false`
  one, blocks refused in both directions, `is_active = false` refused, `is_visible = false`
  hidden cross-user, `is_visible IS NULL` still visible, `anon` denied by the revoked grant
  *and separately* by the policies when the grant is handed back, and `user_colleges`' three
  write policies unchanged (own-row insert works, forging a row for someone else is `42501`,
  updating someone else's row matches nothing).
  **`rollback` 30/30** (`ROLLBACK.txt`) — `00019` then its rollback asserted against the
  `before` expectations, so the undo is bit-for-bit and puts the defect back rather than
  landing somewhere in between.
- `00020` **is applied** — 2026-09-29 12:03Z, from `mazal-restart` @ `d0a39ca` (the file itself
  byte-identical to the reviewed `60aebb6`; `d0a39ca` only moved this record), after Guts's
  review (MEXA-297 / MEXA-349, PASS on both parts, re-diffing the function body against
  `00001` and re-running `verify.mjs` himself in all three modes) and Lelouch's approval and
  apply on MEXA-394. One Management-API transaction holding the file body and the
  `schema_migrations` insert, the file's own assertions passing before its `COMMIT`
  (`.scratch/mazal-mexa297/APPLIED_00020_TX.sql`).
  **A Safta can now like someone.** Post-apply, verified independently of the applier:
  the ledger carries `00020`; `update_safta_stats` is `prosecdef = true` with
  `proconfig = {search_path=public}`; `safta_likes` carries three policies —
  `Safta can create likes:INSERT`, `Safta can view own likes:SELECT` and the new
  `Safta can send own likes:UPDATE`; `safta_likes` and `user_safta_stats` are both still 0
  rows. `verify.mjs --mode after` against live: **27/27**, rolled back, fixtures CLEAN
  (`.scratch/mazal-mexa297/POSTAPPLY_after.txt`).
  **To roll it back**, run the rollback file — **B** (the policy) then **A** (the function),
  smallest first — plus `delete from supabase_migrations.schema_migrations where
  version='00020'`, in one transaction.
  It was **re-verified against the current baseline before the apply**, not only the one it was
  reviewed on, because `00021`, `00023`, `00024`, `00025` and `00030` had gone on in between:
  `after` still **27/27** (`.scratch/mazal-mexa297/AFTER_rebaseline.txt`).
  `00023_safta_connection_consent` is the only migration since that touches the Safta surface
  and it changes no `safta_likes` policy — it only cites `00020`'s one-way rule as precedent —
  so there is no overlap to reconcile. Pre-apply backup:
  `.scratch/mazal-mexa297/BACKUP_public_before_00020_2026-09-29T12-00-30-091Z.sql` (`chmod 600`,
  it carries the `moderation_secrets` pepper; it holds the pre-state of both objects this file
  changes — the `update_safta_stats` body and `safta_likes`' two existing policies, with no
  UPDATE among them).
  **One known gap it inherits rather than introduces, and now carries live:**
  `SET search_path = public` does not stop `pg_temp` shadowing an unqualified relation name, so
  `update_safta_stats` is now the **26th** DEFINER function in the set MEXA-379 sweeps to
  `public, pg_temp`. Measured after the apply: `select count(*) from pg_proc … where prosecdef
  and 'search_path=public' = any(proconfig)` returns **26**, up from the 25 `00028`'s header
  was written against — that header is corrected in the same commit as this note, prose only,
  since nothing in `00028` keys on the number (its assertions name its own seven functions and
  five triggers). Guts raised it on the review as MEXA-353 and explicitly did not block on it:
  the vector needs `CREATE TEMP TABLE`, PostgREST exposes no DDL, neither client role holds
  `CREATE` on any schema, and the worst case here is a Safta corrupting the counter on her own
  like. `00020` was deliberately **not** amended for it — it was already reviewed, and the pin
  belongs in MEXA-379's sweep with the other 25 and with `check_for_match`, which was already
  live and which `00020` could not reach. **Ordering, for whoever applies that sweep:**
  `CREATE OR REPLACE FUNCTION … SET search_path = public` **overwrites** `proconfig`, so a
  later `CREATE OR REPLACE` of any swept function silently reverts its pin. `00020` is in
  before the sweep, which is the safe order; the trap is live for any future migration that
  replaces a swept function without re-stating the full pin.
  It **depends on nothing**: it
  replaces one function defined in `00001` and adds one policy to a table `00002` created,
  and no other file names either. In particular it is independent of `00016` and changes no
  grant at all, so `00016`'s post-check section 7c — which raises if
  `has_table_privilege('authenticated','public.safta_likes','UPDATE')` is false — passes
  whichever order the two go on in. That constraint is why `00020` does **not** column-scope
  the `safta_likes` UPDATE grant the way `00015` scopes `users`: measured, a column-level
  `GRANT UPDATE (sent_to_user, sent_at)` leaves `has_table_privilege` false, so it would
  abort `00016`'s apply. Column-scoping this table belongs in the same migration that edits
  that assertion.
  Two changes on one path. **`update_safta_stats` becomes `SECURITY DEFINER` with
  `SET search_path = public`** — it was INVOKER and its whole body writes another user's row
  in `user_safta_stats`, which has no INSERT or UPDATE policy, so the write was `42501` and
  the `42501` from an AFTER INSERT trigger aborted the `safta_likes` insert that fired it.
  **No Safta had ever been able to like anyone**, and unlike `check_for_match` this one
  always threw. And **`safta_likes` gets its first UPDATE policy**, admitting the owning
  Safta and only while the row is still a draft (`sent_to_user IS NOT TRUE`).
  Two things the header argues at length and a reviewer should read there rather than here.
  First, **the "caller" `00016` cites for that policy is not live**:
  `useUpdateRecommendationStatus` is exported from the Safta hooks barrel and called from no
  screen, and neither is `useSendRecommendation` beside it — the Safta deck's Recommend
  button (`app/(safta-tabs)/index.tsx:388`) spends a daily-usage credit, `console.log`s and
  advances without writing anything. So Safta likes are unbuilt in the client and broken in
  the database, and `00016`'s note reads as though line 166 were live. Second, **the draft
  gate is the whole security argument, not tidiness**: flipping `sent_to_user` false → true
  queues a push to `for_user_id`, `notification_queue`'s only unique constraint is a
  `uuid_generate_v4()` primary key so `send_push_notification`'s `ON CONFLICT DO NOTHING`
  deduplicates nothing, and an ownership-only UPDATE policy would hand a Safta a push faucet
  on one row aimed at a user the INSERT policy never required her to be related to. `USING`
  sees the OLD row, so admitting drafts only makes the transition one-way.
  **Nothing decrements `total_safta_likes`**, and `00020` does not add a decrement — see
  `docs/TRIGGER_FUNCTION_SECURITY_AUDIT.md`. Nothing to backfill: `safta_likes` and
  `user_safta_stats` hold 0 rows.
  Its rollback is `00020_safta_likes_actually_save_rollback.sql`, a bit-exact inverse split
  into B (the policy) and A (the function), smallest first. Note the one thing that is not
  obvious: `CREATE OR REPLACE FUNCTION` does **not** clear `proconfig`, so the rollback has
  to `ALTER FUNCTION … RESET search_path` explicitly or the undo leaves
  `prosecdef = false` next to a pinned `search_path` `00001` never set.
  Verified against live in rolled-back transactions by `.scratch/mazal-mexa297/verify.mjs`,
  three modes, nothing left behind (all five fixture tables back to 0 rows in each run).
  All green: **`before` 23/23** (`BEFORE.txt`) — the like measured failing `42501` from
  `user_safta_stats` as the real `safta_accounts` owner, `safta_likes` and `user_safta_stats`
  both still 0 afterwards, and the UPDATE matching 0 rows in silence.
  **`after` 27/27** (`AFTER.txt`) — the like is written and the counter lands on the person
  liked rather than the grandchild; a second Safta liking the same person takes it to 2 via
  the `ON CONFLICT` path; re-liking the same pair is `23505` from `00001`'s UNIQUE constraint,
  so the counter cannot be doubled; a regular user still gets `42501` inserting a counter and
  0 rows bumping someone else's, so DEFINER opened nothing; the owning Safta sends her draft
  (1 row) and queues exactly one notification, un-sending it matches 0 rows and queues none,
  a NULL `sent_to_user` draft is still sendable, another Safta's draft matches 0 rows, and
  re-pointing a row at another Safta's account is `42501` from `WITH CHECK`.
  **`rollback` 23/23** (`ROLLBACK.txt`) — `00020` then its rollback asserted against the
  `before` expectations, so the undo puts both defects back rather than landing in between.
  One measured detail worth carrying forward: `anon` still holds SELECT and UPDATE on
  `safta_likes` until `00016` lands, but both come back `42501: permission denied for table
  users` rather than 0 rows, because `00002`'s own policies subquery `public.users` and
  `00013`/`00015` took that away from `anon`.
- `00021` **is applied** — Guts PASSed it and Lelouch approved on MEXA-358. Measured on live
  2026-09-29 (MEXA-359): `supabase_migrations.schema_migrations` carries `('00021',
  'drop_orthodox_discovery_rpc')`. The "not applied yet" that stood here was written before
  the apply and is corrected, not deleted; everything below it about *why* the drop is right
  still holds. It
  **depends on nothing and nothing depends on it**: it drops the single function
  `public.get_orthodox_discovery_profiles(uuid,integer,integer,integer,text[])`, which
  `00005` created and `00010` replaced, and `pg_depend` shows 0 referrers on live, so the
  `DROP` is deliberately RESTRICT. It only needs `00013` applied, which it asserts, because
  `user_public_profiles` is what the Orthodox deck reads instead.
  **Why a drop and not a reshape.** The function is `RETURNS SETOF public.users` and
  `SECURITY DEFINER`, with EXECUTE to `authenticated`, so one call returns up to 50 whole
  rows of other people. `00010` fixed its *authorisation* (`requesting_user_id` must be the
  caller) but not its return type, and `00013` could not narrow it — a view cannot stand in
  for `SETOF users` — so `00013`'s own header claim that "00010 closed the RPC route" was
  wrong and is corrected in the same commit. Reshaping the columns would still have left the
  second defect: **the caller's entitlement is never checked.** It filters the pool on
  `is_orthodox_user` and never the caller, and `is_orthodox_user` is written from the device
  (`app/(orthodox-auth)/register.tsx:103`), so any signed-in account can page the Orthodox
  pool. Nothing calls it — the deck reads `user_public_profiles` directly since MEXA-279 and
  the only non-SQL reference was the generated-types entry — so there was no behaviour to
  preserve. A replacement RPC, if ever wanted, is a separate issue: view columns plus a
  server-side entitlement check.
  The pool is **0 rows on live**, so nothing has leaked; the exposure opens when the first
  Orthodox user finishes onboarding, which is why this blocks MEXA-292 and nothing else.
  Its rollback is `00021_drop_orthodox_discovery_rpc_rollback.sql`, a bit-exact inverse
  asserted down to `proacl`, and the first rollback here that deletes its own ledger row.
  Verified against live in rolled-back transactions by `.scratch/mazal-mexa327/verify.mjs`,
  three modes, nothing left behind (checked on a fresh connection each run).
  All green: **`before` 21/21** (`BEFORE.txt`) — the leak *reproduced*, not just read off the
  catalog: as a caller with `is_orthodox_user = false` and no subscription, the RPC returned
  both Orthodox fixtures with all **53** columns, and their `email`, `phone`, `auth_id`,
  `current_latitude`, `date_of_birth` and `elo_score` read back by value.
  **`after` 17/17** (`AFTER.txt`) — `to_regprocedure` null, no function of that name under any
  signature, `has_function_privilege` cannot resolve it for `authenticated` or `anon`, the
  call is `42883` for both roles, the public function count moved by exactly −1 while
  relations, policies and `users` rows did not move, `00010`'s three DEFINER siblings intact,
  ledger carries `00021`, and the deck's own `user_public_profiles` query still returns both
  profiles with no contact, coordinate or auth column.
  **`rollback` 21/21** (`ROLLBACK.txt`) — identical to `before` on every probe including the
  exact `proacl`, so the undo puts the defect back rather than landing in between.
  One measured detail worth carrying forward: the live `users` table has **no**
  `instagram_access_token` or `instagram_user_id` — `00013` moved both to `user_integrations`
  — but `src/types/supabase.generated.ts` still lists them on `users`. That is stale drift
  unrelated to this migration; don't repeat the claim that this RPC leaked an Instagram token.
- `00024` **is applied** — 2026-09-29 06:34Z, from `mazal-restart` @ `1e27d15` (MEXA-359).
  Guts PASSed it on MEXA-365 with no blockers; Lelouch approved on MEXA-368 and named one
  applier. Applied by `.scratch/mazal-mexa359/apply_00024.mjs --apply` (log: `APPLIED.txt`),
  which gated on provenance, file shape, a 0.1-minute-old backup and a live baseline match,
  then post-checked on a fresh connection: **12/12**, including all 33 of `00015`'s profile
  columns still writable. Post-apply the exploit itself was re-run against the committed
  schema as the real `authenticated` role — `verify.mjs --mode applied`, **13/13**
  (`POSTCHECK_APPLIED.txt`): `is_verified := true` → `42501` and reads back `false`,
  `is_photo_verified` and `elo_score` → `42501`, `bio`/`first_name`/`current_city` still
  write, `SELECT` of both columns still works, `anon` refused, ledger carries `00024`, and a
  fresh connection confirms no fixture survived. A catalog check only proves the privilege is
  gone; this proves a real caller is refused.
  One `REVOKE` and one `COMMENT`: it takes
  `UPDATE (is_verified)` away from `authenticated`, leaving the badge writable only by
  `service_role`. It **depends only on `00015`**, whose grant it revokes, and nothing depends
  on it.
  **Why it can land before the Edge Function.** `00015` kept this grant deliberately, on the
  grounds that revoking it "would break photo verification outright rather than harden it".
  That premise is false and was measured, not assumed: no `EXPO_PUBLIC_AWS_*` value is set in
  `.env`, in any `eas.json` profile, or in EAS environment variables, so
  `isVerificationConfigured()` is false in every build — and an unconfigured provider did not
  fail, it fell through to `verifyMock()`, which returned `verified: Math.random() > 0.1` and
  then wrote this column. So the app's own "Verify Your Profile" button was awarding the
  badge other users see on a coin flip. There is nothing working to break.
  **The pre-flight guard that matters.** `REVOKE UPDATE (col)` does **not** cut back a
  table-wide `GRANT UPDATE ON TABLE`, and `has_column_privilege` returns true when either
  covers the column — so on a database without `00015` this file would run clean, report
  success, and leave `is_verified` fully writable. Section 0 checks
  `has_table_privilege(...,'UPDATE')` and refuses instead. Whoever writes the next
  column-level revoke should copy that check.
  It names `is_photo_verified` too, which is a **no-op on live**: nothing in `app/` or `src/`
  has ever written it and `authenticated` has never held the privilege
  (`has_column_privilege` false before the file runs). It is in the statement so that a
  future migration granting it by accident has to argue with section 3.
  At apply time live held **0 users** and **0 rows with `is_verified = true`**, so nothing was
  mis-badged and the apply stranded nobody. From here on, `is_verified` can only become true
  via `service_role`, and nothing writes it until MEXA-367 (Part B) lands — so a `true` in
  that column is currently evidence of a manual write, not of a verification.
  Its rollback is `00024_revoke_self_awarded_verified_badge_rollback.sql`; it deletes its own
  ledger row and restores only `is_verified` (see the rollback note above).
  Verified against live in rolled-back transactions by `.scratch/mazal-mexa359/verify.mjs`,
  three modes, nothing left behind (checked on a fresh connection each run). Every claim is a
  **write as the real `authenticated` role**, not a catalog read.
  All green: **`before` 13/13** (`BEFORE.txt`) — the defect reproduced: `is_verified := true`
  succeeded and read back `true`, while `elo_score := 9999` and `is_photo_verified := true`
  were already `42501`.
  **`after` 13/13** (`AFTER.txt`) — `is_verified := true` is `42501` and reads back `false`;
  `elo_score` still `42501`; **profile editing still works** (`bio`, `first_name`,
  `current_city` all written in one statement — the regression a grant list cannot see);
  `SELECT` of both columns still works; `service_role` keeps `UPDATE` so Part B has something
  to write with; `anon` refused; ledger carries `00024`; comment updated.
  **`rollback` 13/13** (`ROLLBACK.txt`) — identical to `before` on every probe.
  The pre-flight guards are proven to bite, not just present: `.scratch/mazal-mexa359/dryrun.mjs`
  **8/8** (`DRYRUN.txt`) — a clean apply, a second apply refused, a refusal when
  `authenticated` holds table-level `UPDATE`, a refusal when `00015`'s column grants are
  missing, a refusal when an unexpected role can write the column, the rollback refused
  against an unapplied database, and apply→rollback→apply all clean, with live untouched
  afterwards.
- `00025` **is applied** — 2026-09-29 08:10Z, from `mazal-restart` @ `1712a22` (MEXA-314).
  Guts PASSed it on MEXA-371 at `af58137`; Lelouch approved the apply on MEXA-314 under his
  standing migration authority and named Violet the only applier. Applied by
  `.scratch/mazal-mexa314/apply_00025.mjs --apply` (log: `APPLIED.txt`) — **33 gates**, then the
  file sent verbatim through the `pg` driver as one simple query so its own `BEGIN`/`COMMIT`
  **and its own ledger `INSERT` share one transaction**. That last part is the 00011 lesson: a
  Management-API apply can leave `schema_migrations` untouched. Counts across the apply:
  public functions **41 → 42**, policies **88 → 88** (unchanged, which is the design), ledger
  **23 → 24**, `users`/`swipes`/`matches` **0 → 0** — so nothing was stranded and there were no
  real users to affect. Backup first:
  `BACKUP_public_before_00025_2026-09-29T08-07-32-664Z.sql`, 101,862 bytes, `chmod 600`,
  39 tables / 7 data rows / 41 functions / 88 policies / 16 triggers / 23 ledger rows, with
  8 substring assertions proving `swipes`, `matches`, the policies, `check_for_match`,
  `current_app_user_id` and the ledger are really in it **and** that `undo_last_swipe` is not
  (i.e. it predates the apply). It makes **Rewind** real. `public.swipes` had no DELETE policy, so
  `useUndoSwipe`'s `delete().eq('id', ...)` matched zero rows — which **is not an error** — and
  the hook reported a successful rewind while the row sat there and the person stayed out of
  the deck. Measured on live: the client DELETE returns `code=null, rowCount=0`
  (`.scratch/mazal-mexa314/BEFORE.txt`). Rewind is sold on the paywall, so it was a paid
  feature that did nothing and said nothing.
  **It does not add a DELETE policy, and does not touch a single grant.** Rewind goes through
  `public.undo_last_swipe()`, SECURITY DEFINER, **no arguments**, `SET search_path = public`,
  `EXECUTE` to `authenticated` only. Three reasons the policy route was wrong here, all in the
  file's header: `00016` revokes `DELETE ON swipes FROM authenticated` and its section 7b
  *asserts* it stayed revoked, so policy+grant would either be undone or make `00016` abort;
  the 30-second window cannot be enforced against a device clock; and a zero-row DELETE cannot
  say *why* it refused. The function returns one row — `ok`, plus `reason` in
  (`no_swipe`, `too_old`, `matched`) — so every refusal is a message and none is a silent
  success. **`swipes` stays append-only for clients**, which is what `00016` wants, and `00016`
  can be applied before or after this file in any order. That last claim is measured, not
  reasoned: the rehearsal revokes the grant mid-transaction and Rewind still works.
  **A rewind refuses once the pair has matched** (`reason = 'matched'`). Since `00017`,
  `swipes_check_match` really does create the `matches` row, so inside 30 seconds a like can
  already have matched; deleting the swipe then would leave the match row behind, with
  `messages` still accepting posts into it. Deleting the match instead is worse and is a
  different feature — `trigger_notify_new_match` has already queued a push to **both** people,
  `messages.match_id` cascades, and Mazal already has `is_active` / `user*_unmatched` with an
  UPDATE policy for exactly this. The rule lives in the function, **not** in a `BEFORE DELETE`
  trigger, because such a trigger would also fire on the `ON DELETE CASCADE` from `users` and
  would block account deletion.
  **Known corner, documented rather than fixed** (Guts, MEXA-371, on Lelouch's instruction):
  the `matched` check and the `DELETE` are not under one lock — only the caller's own swipe row
  is `FOR UPDATE`, and `check_for_match()` reads the other side with a plain `SELECT`. If the
  reciprocal swipe commits in between, the match is created and the originating swipe row is
  deleted a moment later. Harmless: the match is honestly earned and `matches` has **no foreign
  key back to `swipes`**, so nothing orphans; what is lost is one side's cosmetic provenance.
  Fixing it would serialise every rewind against every incoming swipe. Revisit if a `swipes` row
  ever becomes load-bearing for more than the deck filter.
  Its rollback is `00025_rewind_undo_last_swipe_rollback.sql`; it deletes its own ledger row,
  and the `swipes` comment it restores is **conditional on `00016` and `00026`** — three files
  write that comment now, so it reads the ledger instead of hardcoding one string, with the same
  precedence `00026`'s rollback uses. Its post-check asserts the comment's *content*, not just
  that it is non-NULL, which is what catches the branch picking the wrong string. The `00026`
  branch and that assertion were added **after** Guts's PASS, because `00026` landed on
  `mazal-restart` in between; they change only the undo path, not what the apply does, and
  `dryrun.mjs` case 9b proves them by execution (apply 00025 → apply 00026 → roll back 00025 →
  the comment is `00026`'s, and the function is gone).
  Verified against live in rolled-back transactions by `.scratch/mazal-mexa314/verify.mjs`,
  three modes, nothing left behind (checked on a fresh connection each run — objects, row
  counts, policies, ledger and the table comment). Every behavioural claim is a statement run
  as the real `authenticated` / `anon` role.
  All green: **`before` 18/18** (`BEFORE.txt`) — the defect reproduced, and it is RLS rather
  than privilege that filters it (`authenticated` does hold the DELETE grant today).
  **`after` 41/41** (`AFTER.txt`) — a fresh like and a fresh pass are both undone and the rows
  are really gone; a second call right away says `no_swipe`; 31s old is `too_old` and survives
  while 29s old still works (the boundary is exact, because `now()` is the transaction
  timestamp); a like that produced a match is refused with `matched` and **both** the swipe and
  the match survive; a caller with no swipe of their own gets `no_swipe` rather than somebody
  else's newest swipe, and that swipe is untouched; `anon` is `42501` (`permission denied for
  function`); a JWT with no `public.users` row is `42501` from the body; a direct client DELETE
  **still** touches 0 rows, so no direct path was opened; Rewind still works with
  `DELETE ON swipes` revoked from `authenticated`; and `EXECUTE` is held by exactly
  `authenticated` and the owner.
  **`rollback` 22/22** (`ROLLBACK.txt`) — identical to `before` on every probe, the function
  gone, the ledger row gone, the comment back to NULL.
  **Post-apply, against the committed schema:** `.scratch/mazal-mexa314/postapply.mjs`
  **42/42** (`POSTAPPLY.txt`). This exists because **`verify.mjs after` cannot run once the
  migration is real** — that mode applies 00025 inside its own rolled-back transaction and
  00025's pre-flight guard 0a refuses with `public.undo_last_swipe() already exists`. Measured
  right after the apply; the guard doing its job, not a failure. `postapply.mjs` carries every
  behavioural probe from `after` verbatim, run as the real `authenticated` / `anon` /
  `service_role` roles against live, with only the fixtures in a rolled-back transaction. Its
  leave-nothing-behind check is inverted: the fixtures must be **gone** and the function must
  **remain**. It adds a `service_role` probe (`42501`, EXECUTE revoked on purpose) that the
  rehearsal did not have. Whoever writes the next migration should copy this split — an apply
  script's catalog post-check only proves the *object* is there, never that a real caller gets
  the right answer.
  **And the real HTTP surface, not just SQL role simulation:** one
  `POST /rest/v1/rpc/undo_last_swipe` with the publishable anon key returns
  **`401` / `{"code":"42501","message":"permission denied for function undo_last_swipe"}`**.
  The pre-flight guards are proven to bite, not just present: `.scratch/mazal-mexa314/dryrun.mjs`
  **29/29** (`DRYRUN.txt`) — a clean apply, then a refusal (with the right message each time)
  for a second apply, a DELETE policy already on `swipes`, `check_for_match` back to
  `SECURITY INVOKER`, `current_app_user_id()` no longer DEFINER, `UNIQUE (swiper_id, swiped_id)`
  dropped, and RLS disabled; the rollback refused against an unapplied database and refused
  when an overload exists; and apply→rollback→apply all clean, with live untouched afterwards.
  **Client half, same commit:** `useUndoSwipe` now calls the RPC and throws on `ok = false`; the
  device-clock arithmetic is gone. Its `onSuccess` also invalidates
  `queryKeys.swipes.whoLikedMe()`, because `get_who_liked_me` (`00026`) excludes anybody the
  caller has already swiped on — so undoing an answer has to put that person back on the list and
  the badge. That line was added after `00026` landed; `useSwipe` already had the matching
  invalidation on the way in. `undo_last_swipe` is declared by hand in
  `src/types/database.types.ts` (same reason as the `00013` view — `supabase gen types` needs
  Docker), so `npx tsc --noEmit` covers the call. **Keep the `UndoSwipeRefusal` union in that
  file in step with the `reason` strings in the migration.**
  **Still open after this, both filed:** there is **no Rewind button** — nothing in `app/` or
  `src/` calls `useUndoSwipe`, while the paywall and the plan comparison both sell it; and the
  premium gate is still `useCanRewind()` on the device only, because `public.subscriptions` has
  a SELECT policy and no writer anywhere in the repo, so there is no server-side entitlement to
  check. A queued super-like notification is also not retracted by a rewind (moot today —
  `send-notification` is not deployed).
- `00026` is **NOT applied** — written 2026-09-29 (MEXA-315), waiting on Guts's review and
  an apply card. It builds **"See who likes you"**, the headline Gold benefit the paywall has
  sold from the start with nothing behind it: `queryKeys.swipes.whoLikedMe()` existed and its
  only reference in the repo was an `invalidateQueries` inside the realtime hook MEXA-294
  deleted. No query function, no hook, no screen, no route — nothing had ever read "who
  liked me". Measured on live before writing it: a client asking `swipes` for its own inbound
  likes gets `code=null, rowCount=0` (`.scratch/mazal-mexa315/BEFORE.txt`).
  **It adds no policy, no grant on any table, no column and no publication entry** — only
  three functions and a comment. The central decision is in the header: **not** a cross-side
  SELECT policy on `swipes`, because RLS restricts rows and not values, so a policy admitting
  `swiped_id = <me>` publishes **"who passed on you"** in the same breath. `00017` and
  MEXA-294 both declined to widen it and this does not either; post-check 4d asserts `swipes`
  still carries exactly `00002`'s two policies, and 4e that it is still out of
  `supabase_realtime`.
  Three functions: `public.pending_likers()` holds the predicate once and is **internal** —
  `EXECUTE` revoked from PUBLIC, `anon`, `authenticated` *and* `service_role`, so
  `/rest/v1/rpc/pending_likers` is a 403 for everyone; `public.count_who_liked_me()` returns
  an integer and is granted to **every** signed-in caller on purpose (it is the upsell, it
  names nobody); `public.get_who_liked_me(limit, offset)` is the list, and its two arguments
  are paging only, clamped server-side to 1..100 and >= 0, so **no argument names a user** and
  `00010`'s rule 1 still holds. All three `STABLE`, `SECURITY DEFINER`,
  `SET search_path = public`. `service_role` is deliberately left out of every grant, like
  `00025`: it has no `public.users` row, so `current_app_user_id()` is NULL and it would get
  an empty list that reads as "nobody likes you".
  The visibility rule is **not restated** here — `pending_likers()` joins
  `public.user_public_profiles`, so `00013`'s WHERE (not you, active, no `blocks` row either
  way, `auth.uid()` present) *is* the rule, and this feature tracks it for free if it ever
  changes. `auth.uid()` still resolves inside a DEFINER function because it reads the
  `request.jwt.claims` GUC, which SECURITY DEFINER does not touch. Five exclusions on top:
  `pass`, mid-onboarding, already swiped on, already matched, plus the view's own.
  **No entitlement check, and that is deliberate.** There is nothing server-side to read —
  `public.subscriptions` is RevenueCat's webhook table, no webhook is deployed, so it is empty
  and a gate there would refuse every paying user. The Gold gate is `useCanSeeLikes()` on the
  device, as Rewind's is. A free user calling the RPC directly gets the list: **a revenue leak,
  not a privacy leak** — the list only ever holds likes aimed at the caller, a `pass` never
  leaves the database whatever anyone paid, and every row rule above is server-side. **MEXA-373**
  closes it; when it lands the gate goes in `get_who_liked_me()` only, never in the count.
  Its rollback is `00026_who_liked_me_rollback.sql`, a bit-exact inverse; it deletes its own
  ledger row, and the `swipes` comment it restores is **conditional on the ledger** (`00016`
  if applied, else `00025`, else NULL) because three files now write that comment.
  Verified against live in rolled-back transactions by `.scratch/mazal-mexa315/verify.mjs`,
  three modes, nothing left behind (a fresh connection checks objects, ledger, row counts and
  fixtures each run). Every behavioural claim is a statement run as the real `authenticated` /
  `anon` role against eleven fixture users.
  All green: **`before` 10/10** (`BEFORE.txt`) — the question is unaskable client-side.
  **`after` 35/35** (`AFTER.txt`) — a like and a super like appear; a **`pass` does not**; a
  liker blocked in either direction, a deactivated one, one mid-onboarding, one already passed
  on, one already matched through the `00017` trigger, and one with a bare `matches` row are
  all absent; the super like sorts above a newer plain like; the returned row carries the 13
  card columns and no more; the count equals the list; the person who liked you sees nobody
  (it is inbound, not a mirror); paging does not repeat or skip; an absurd limit and a negative
  offset clamp instead of erroring; a JWT with no `users` row gets an empty list and a count of
  0, not somebody else's; `anon` is `42501` on all three and `authenticated` is `42501` on
  `pending_likers()`; a direct cross-side read of `swipes` still returns 0 rows; and answering
  somebody drops them from the list and the count together.
  **`rollback` 43/43** (`ROLLBACK.txt`) — identical to `before` on every probe afterwards, all
  three functions gone, ledger row gone; a second apply and a second rollback both abort with
  the right message.
  **Client half, same commit** (behind `FEATURE_WHO_LIKES_YOU`, off, pinned `"false"` in all
  three `eas.json` profiles): `src/api/queries/useWhoLikedMe.ts`, `app/likes/`, an entry row
  with the badge on the Matches tab, and the paywall copy gated on the same flag so a build
  that cannot deliver the feature does not sell it. Both functions are declared by hand in
  `src/types/database.types.ts` (same reason as the `00013` view — `supabase gen types` needs
  Docker), so `npx tsc --noEmit` covers the calls; it is green. **Keep `WhoLikedMeRow` in step
  with the function's RETURNS TABLE.**
  **Amended by MEXA-320, after Guts's review of MEXA-315 and before any apply:**
  `get_who_liked_me()` returned `p.date_of_birth` out of the view, which is the exposure
  `00030` closes; it returns the view's `age` now, guard 0d asks for `age` instead of
  `date_of_birth`, and `date_of_birth` appears nowhere in the file. That makes it depend on
  `00030`, which is why the order list puts `00030` first. **The amendment has not been
  through Guts's review.** Proven by execution in `.scratch/mazal-mexa320/`: `00026` applied
  on top of `00030` returns a liker with `age: 29` and no `date_of_birth` key (`AFTER.txt`
  20), and `00026` applied *first* aborts with `user_public_profiles has no column(s) [age]`
  (`BEFORE.txt` 8).
- `00030` is **APPLIED** — written 2026-09-29 (MEXA-320), Guts PASSed it on MEXA-382 at
  `d1f4a17`, Lelouch approved the apply on MEXA-385 under his standing migration authority
  (MEXA-33), and Violet applied it at **2026-09-29 10:43Z** with
  `.scratch/mazal-mexa385/apply_00030.mjs --apply` on the session pooler: one transaction,
  the file's own `BEGIN`/`COMMIT` with its own ledger `INSERT` inside it. Counts across the
  apply — users/swipes/matches all 0 and unchanged, ledger 24 → 25, functions 42 → 43
  (`profile_age`), policies 88 → 88, view columns 33 → 33.
  **It was carded as a privacy fix and it was also an outage fix.** `d1f4a17` merged the
  client half — `useDiscoveryProfiles` filters `.gte('age', …)` — while the apply stayed
  blocked, so for as long as the two were apart the deck query came back `42703 column
  user_public_profiles.age does not exist` and **every user's discovery deck was empty**
  (MEXA-385). Post-apply that is measured, not inferred: `walkthrough/check-discovery-deck.mjs`
  signs in against live in a real render and the card reads "Deckhim, 28", with no empty
  state and no `42703` in the page console — **6/6**. The catalog and the screen came apart
  once here; check both.
  Pre-apply snapshot (view definition, owner, reloptions, comment, all 33 columns, the
  pre-`00030` grant set, the ledger and the row counts) is
  `archive/backups/mazal-00030-preapply-20260929T103836Z.txt`; the post-check **23/23** is
  `archive/backups/mazal-00030-postapply-20260929T104709Z.txt`; the rendered deck is
  `archive/backups/mazal-00030-deck-20260929T104709Z.png`.
  Two bugs worth carrying forward, both in the *harness* and neither in the migration: the
  apply script's age probe passed a `timestamp` to `profile_age(date)` and died `42883`
  **after** the transaction had committed (the apply was sound, but its own log never got
  written — which is why the post-check is a separate script run against the committed
  schema), and the post-check's deliberate `42703` probe aborted its own transaction until
  it was given a `SAVEPOINT`. A probe that is meant to fail needs a savepoint, and a
  post-check that can crash should not be the only record that an apply happened.
  What it does: it rebuilds `public.user_public_profiles` so that it publishes an
  `age integer` (from the new `public.profile_age(date)`, STABLE, UTC-pinned) instead of
  `u.date_of_birth`. Everything else about the view is `00013`'s definition byte for byte:
  same 33 columns, same `security_invoker = false` / `security_barrier = true`, same owner,
  same `distance_miles`, same WHERE clause. **The app never rendered a birthdate** — five
  screens and three hooks all ran `calculateAge()` on it — so the published precision was
  strictly greater than the used precision, and one `select *` handed a signed-in caller the
  exact birthdate of every active user, attached to a name, a face and a city.
  `CREATE OR REPLACE VIEW` cannot drop a column, so the view is dropped and rebuilt; that
  makes it a **new** object, which Supabase's `ALTER DEFAULT PRIVILEGES` re-grants all four
  verbs on to `anon`, `authenticated` and `service_role`. Section 2's `REVOKE` is therefore
  load-bearing, not housekeeping, and post-check 4f asserts the end state is exactly
  `authenticated:SELECT, service_role:SELECT`. It also takes away the three inert write verbs
  `00013` left on `authenticated` (the view is not auto-updatable, so a write is `55000`
  either way — the privilege moves, the error code does not).
  **The age filter loses no index, measured rather than assumed.** MEXA-320 asked whether
  moving the discovery filter from a `date_of_birth` range to `age >= .. AND age <= ..` would
  lose a plan. There is **no index on `users.date_of_birth`** and never has been (the whole
  set on that table is `users_pkey`, `users_email_key`, `users_phone_key`,
  `idx_users_location`, `idx_users_active`, `idx_users_auth_id`, `idx_users_orthodox`), so
  both forms are a `Seq Scan` with a filter. `EXPLAIN` in `AFTER.txt` shows the age predicate
  pushed down into the scan on `users`, not evaluated above the view.
  **Client half, same commit:** the deck and the safta deck filter `.gte('age', min)
  .lte('age', max)`; `useMatches`, `useWhoLikedMe`, `matchingService`, the Orthodox deck, both
  shidduch screens and the safta profile read `age`; four copies of `calculateAge()` are
  deleted and the two that remain serve the *signed-in user's own* row out of `public.users`.
  `PublicProfile` in `src/types/database.types.ts` drops `date_of_birth` and gains
  `age: number`. `npx tsc --noEmit` is green. Three of the screens were also computing the age
  wrongly (a bare year subtraction, and a 365.25-day division); the view's number is the one
  the deck always used.
  Its rollback is `00030_public_profiles_publish_age_not_dob_rollback.sql`, a bit-exact
  inverse including the wider pre-`00030` grants, and it **refuses to run while `00026` is
  applied**.
  Verified against live in rolled-back transactions by `.scratch/mazal-mexa320/verify_00030.mjs`,
  three modes, nothing left behind (a fresh connection checks the view shape, the functions,
  the ledger and the row counts each run). All green: **`before` 11/11** — a signed-in caller
  harvests four other people's exact birthdates by value, which is the finding.
  **`after` 24/24** — the same caller gets `42703` for `date_of_birth`, `select *` carries no
  such key, the ages match the app's `calculateAge()` for four fixtures, a birthday *tomorrow*
  still reads as the younger number, the deck filter returns exactly the right two people and
  is inclusive at both ends, the blocked and deactivated users are still hidden, `public.users`
  is still own-row-only, `anon` is `42501` on both the view and `profile_age()`, and `00026`
  on top returns `age: 29` with no birthdate. **`rollback` 15/15** — identical to `before` on
  every probe afterwards, and the refusal fires when `00026` is on top.
- `00031` is **NOT applied** — written 2026-09-29 (MEXA-361), waiting on Guts's review and
  an apply card for Lelouch. It closes the last unconstrained `WITH CHECK` on the Safta
  surface, the sibling of the one `00023` closed one table over, and it is the worse of the
  two: `00005`'s `trigger_notify_safta_like` is `AFTER INSERT OR UPDATE OF sent_to_user …
  WHEN (NEW.sent_to_user = true)`, so on live today **one INSERT queues a push notification
  at any user id in the app**, under a `display_name` the attacker picked, with no
  relationship to that person and no action by them. Becoming a Safta is one unvetted INSERT
  (`00002`'s `"Safta can create account"`), and `users.id` values are readable by every
  signed-in account through `user_public_profiles` (`00013`). `notification_queue`'s only
  unique constraint is its primary key, so `send_push_notification`'s `ON CONFLICT DO
  NOTHING` deduplicates nothing, and `UNIQUE (safta_account_id, for_user_id, liked_user_id)`
  is walked around by varying `liked_user_id`. **Not reachable through the app** — no screen
  calls `useSendRecommendation`, the Recommend button at `app/(safta-tabs)/index.tsx:388`
  spends a usage credit and `console.log`s, and the table holds 0 rows — but reachable over
  PostgREST with any user JWT and the public anon key, independent of
  `EXPO_PUBLIC_FEATURE_SAFTA_MODE`, which is a client-bundle constant.
  Three sections, and its header is explicit about which one refuses what, because the
  rehearsal showed the layering is not the obvious one: the INSERT policy makes every row a
  draft aimed at a grandchild with an **`accepted`** connection; the **BEFORE UPDATE
  trigger** is what refuses the re-aim attack (it runs before any `WITH CHECK`, so the
  policy's `EXISTS` never sees that statement); and the UPDATE `WITH CHECK`'s `EXISTS` is
  the **consent-withdrawal** rule, the one case a trigger on this table cannot see, since it
  is another table that moved. `sent_at` becomes trigger-derived rather than client-supplied.
  **It depends on `00023`, hard**, and section 0 aborts if `00023` is not in the ledger or
  the `safta_connections` INSERT check does not pin `status` — see the order-list note above.
  It changes **no grant**, adds no policy to any other table, and asserts in section 5 that
  `safta_likes:UPDATE` is still held at table level, which is what `00016`'s section 7c
  raises on, and that `00020`'s `update_safta_stats` is still DEFINER with a pinned
  `search_path`.
  **It comes with a client change in the same commit**: `useSendRecommendation` inserted
  `sent_to_user: true, sent_at: now()` in one statement, which the new INSERT check makes
  42501, so it now drafts and then sends — two statements, `sent_at` omitted — and recovers
  from a half-completed earlier attempt by re-selecting the draft on `23505`. No screen calls
  it, so nothing a tester can reach changes. `npx tsc --noEmit` is clean.
  Verified against live in rolled-back transactions by `.scratch/mazal-mexa361/verify.mjs`,
  three modes, nothing left behind (a fresh connection checks the two policies, the trigger
  count, the ledger row and the row counts of `safta_likes`, `notification_queue` and
  `user_safta_stats` each run). All green: **`before` 8/8** — the attacker's single INSERT
  lands, a push is queued at the victim carrying `Your Loving Grandmother thinks you should
  meet someone special.`, an uninvolved third party's public `total_safta_likes` goes to 1,
  and a legitimate draft re-aimed at the victim queues a **second** push at her.
  **`after` 25/25** — both of those are 42501; a plain draft to a non-connected user is
  42501 too, and so is one from a different Safta to somebody else's grandchild; a like
  cannot be born sent or born stamped; `liked_user_id` cannot be moved; the real Safta still
  sends to her own grandchild, the push arrives, and `total_safta_likes` still increments, so
  `00020` is intact; the send is still one-way (0 rows on un-send); a client-supplied
  `sent_at` of `2020-01-01` is overwritten with the real time; and after the grandchild
  **rejects** the connection her Safta can neither send an existing draft nor write a new one,
  while `anon` is refused on both verbs — the victim's queue is empty at the end of all of it.
  **`rollback` 13/13** — identical to `before` on every probe afterwards, both policies back
  to `00002`'s and `00020`'s deparsed text, the trigger and its function gone, ledger row
  deleted.
- `00033` **is applied** — 2026-09-29 16:31Z, from `mazal-restart` @ `fab074d` (MEXA-401).
  Guts PASSed it on MEXA-408 at `a3b25a1`; Lelouch accepted the apply card on MEXA-401.
  Applied by `.scratch/mazal-mexa401/apply_00033.mjs --apply` (log: `APPLIED.txt`) —
  **33 gates**, then the file sent verbatim through the `pg` driver as one simple query, so
  its own `BEGIN`/`COMMIT` **and its own ledger `INSERT` share one transaction** (the `00011`
  lesson: a Management-API apply can leave `schema_migrations` untouched). 236 ms. Counts
  across the apply: public functions **44 → 44** (a replace, not a create, which is the
  design), policies **89 → 89**, ledger **29 → 30**, `notification_queue` rows **0 → 0**,
  `users`/`swipes` **0 → 0** — nothing stranded, and no real users to affect. Backup first:
  `mazal-00033-preapply-20260929T162939Z.sql`, 207,606 bytes, `chmod 600`, 39 tables / 7 data
  rows / 44 functions / 89 policies / 16 triggers / 29 ledger rows, asserted to contain
  `00025`'s `undo_last_swipe()` body verbatim — so it is a restore source for the thing being
  replaced — **and** to carry no `00033` ledger row, so it provably predates the apply.
  **Verified live afterwards behaviourally, not just in the catalog.** The 33 gates prove the
  right body is installed with the right flags; a function can carry a correct md5 and still
  filter the wrong rows. `.scratch/mazal-mexa401/postapply.mjs`, **15/15**
  (`POSTAPPLY.txt`), one always-rolled-back transaction, every call as the real
  `authenticated` role with a JWT: a real super-like queues a push and the rewind **retracts
  it on live**; a `sent` push survives; a third party's pending push to the same person
  survives; a plain `like` still rewinds and retracts nothing; and `authenticated` still
  reads and deletes **0 rows** from `notification_queue` directly. A fresh connection
  afterwards confirms live row counts identical to the baseline and the body still hashing to
  `b547a17b…007a`.
  **Recorded rather than smoothed over:** guard `0f-bis` (`5b976d5`) was added **after**
  Guts's PASS, on his own advisory, and he had not re-confirmed it at apply time. It is
  pre-flight only, changes no statement, and leaves the function's `prosrc` md5 identical;
  Lelouch accepted the card with that fact stated on it. So the applied bytes are not
  byte-for-byte the reviewed bytes.
  It settles the question `00025`'s header filed and
  MEXA-372 decided: **a rewind retracts the super-like push it queued, if that push is still
  unsent.** `trigger_notify_super_like` (`00005`) is `AFTER INSERT ON swipes` and queues
  `<name> thinks you are special!` with `jsonb_build_object('type','super_like','userId',
  NEW.swiper_id)`; `00025` deletes the swipe and leaves that row at `status = 'pending'`.
  The argument for leaving it was that the push is anonymous. **It is not** — it names the
  person and carries their id — so delivered after a rewind it makes a claim the app then
  contradicts: the named person is not in "See who likes you" (`get_who_liked_me` reads
  `swipes`) and is back in the deck as an ordinary card.
  **One statement, inside the function.** `notification_queue` gets no client grant and no
  policy: it has RLS on and **zero policies**, which denies every client verb regardless of
  the table grants `anon` and `authenticated` still hold, and it is the table holding the
  title and body of every push. `undo_last_swipe()` is already DEFINER with
  `search_path = public`, owned by `postgres`, which owns the table, has `rolbypassrls` and
  holds DELETE; `relforcerowsecurity` is false. All four are asserted in guard `0h` rather
  than assumed, because if any stopped holding the DELETE would match zero rows and still
  report a successful rewind — the same silent lie `00025` exists to fix.
  **What a caller can reach.** `v_swipe` is selected `WHERE swiper_id = current_app_user_id()`
  and the function takes no arguments, so `data->>'userId' = v_swipe.swiper_id::text` is
  always the caller: every row it can delete is one the caller's own super-like created.
  They cannot retract an old super-like either — that needs a fresh swipe on the same person,
  and `UNIQUE (swiper_id, swiped_id)` blocks a second while RLS blocks removing the first.
  **`swipes.created_at` is client-settable** (a column-level INSERT grant, and the INSERT
  policy constrains only `swiper_id`) and it does not widen this: a future value makes
  `created_at >= v_swipe.created_at` false so the retraction does not fire, a past one trips
  `too_old` first. Both fail safe. That the window itself can be pushed out with a future
  `created_at` is a pre-existing `00025` hole, filed separately.
  **Two things a drainer author must know.** `status` is nullable, so `status = 'pending'` is
  not "not sent" — NULL-status rows are left alone on purpose. And **nothing drains this
  queue today, `send-notification` included**: that Edge Function takes `{userId, title,
  body, data}` from an HTTP request body and never reads `notification_queue` or writes
  `status`/`sent_at`. `00016`'s comment said otherwise and this commit corrects it. A real
  drainer **must** flip `pending` → `sent` as it pushes, or this retraction becomes a delete
  of a delivered notification.
  It adds **no return column** — `CREATE OR REPLACE` cannot change a return type, and the
  post-check asserts the six output columns are unchanged — and sets **no**
  `COMMENT ON TABLE notification_queue`, because that comment is NULL today, `00016` writes
  it and `00016`'s rollback nulls it, which is the trap already filed against the `swipes`
  comment. The fact lives in the function's own COMMENT and in `00016`'s literal, amended in
  the same commit.
  Verified against live in one always-rolled-back transaction by
  `.scratch/mazal-mexa401/rehearse.mjs`, **46/46, three consecutive runs**
  (`REHEARSAL.txt`), every behavioural claim executed as the real `authenticated` role with
  a JWT. It opens with a **pre-fix control** — with `00025` live, a rewound super-like leaves
  its push queued — so the "after" result is a change and not an assertion about an empty
  table. Then: the push is retracted; a **`sent`** row survives; a third party's pending push
  to the same person survives; the caller's own earlier push to somebody else survives; a
  plain `like` retracts nothing; a `new_match` payload to the same pair survives; a
  two-day-old pending row for the same pair survives (the `created_at` bound); `too_old`,
  `matched` and `no_swipe` still refuse and retract nothing; `authenticated` still reads and
  deletes **0 rows** from `notification_queue` directly and the table still has zero
  policies; a second apply aborts; and the rollback restores `00025` byte for byte, brings
  the control result back, and refuses a second run. A fresh connection afterwards confirms
  no ledger row, `00025`'s body, and row counts identical to the baseline the run started
  from. **The two predicates that matter are proven by mutation, in both layers.** Deleting
  `AND status = 'pending'` outright never reaches a behavioural test — post-check `3c`
  aborts the apply with *"the retraction is not restricted to pending rows"*. Widening it to
  `(status = 'pending' OR status = 'sent')` slips past that grep and is caught by the
  behaviour instead: the `sent`-row case fails, 44/45. Same in both layers for the caller
  pin — neutralised as `(data->>'userId' = … OR TRUE)` it applies cleanly and the
  third-party case fails, 44/45. So neither assertion is vacuous and neither layer is
  carrying the other.
  **Guard `0f-bis` was added after Guts's PASS**, on his own advisory (MEXA-408): `0f` pinned
  `notify_super_like()`'s payload, but nothing checked how `send_push_notification()` — one
  call deeper — maps its argument onto `notification_queue.user_id`, so an edit to that
  helper alone could have remapped the column with every other guard still passing and the
  DELETE then filtering on the wrong person. It is proven to bite: remapping the helper
  inside the rehearsal, leaving `notify_super_like` untouched, aborts the apply. That is the
  only change to the file since the PASS, it is pre-flight only and changes no statement, and
  `undo_last_swipe()`'s own `prosrc` md5 is unchanged at `b547a17b…007a` — so the rollback's
  pin still holds.
- `00037` is **NOT applied** — written 2026-09-29 (MEXA-419), waiting on Guts's security
  review and an apply card. It closes the one constant-`true` policy on a write command
  anywhere in the schema: `public.shadchan_notes` had a single `FOR ALL TO public
  USING (true)` policy, so any signed-in caller and any anon-key holder could read, rewrite,
  delete and forge every matchmaker note. Rehearsed end to end against `tayiyczmacvhokdxfqvm`
  in one rolled-back transaction, `.scratch/mazal-mexa419/rehearse.mjs` → `REHEARSE.txt`,
  **56/56, three consecutive runs**, every behavioural claim executed as the real
  `authenticated` (or `anon`) role. It opens with a **pre-fix control** — all four filed
  probes ALLOWED, plus `anon` reading the note — so the "after" results are a change and not
  an assertion about an empty table. Then: the four probes are refused or return 0 rows; the
  real shadchan's own SELECT/INSERT/UPDATE/DELETE all still work; a shadchan cannot forge
  under, move a note into, read or delete from another shadchan's list; the candidate the
  notes are *about* reads nothing (DECISION 2); `anon` is refused `42501` at the grant layer
  and cannot EXECUTE the helper; a **deactivated** shadchan still reads and edits their own
  notes; `anon` handed back `00016`'s-rollback grant set still gets nothing on any of the
  four commands; and the rollback runs in the same transaction and restores the policy, the `relacl`
  set, the FK, the helper and both comments, with the pre-fix control result coming back.
  A fresh connection afterwards confirms no ledger row and row counts identical to baseline.
  **The sweep the issue asked for is in the header**, done against the live catalog rather
  than the file: of 89 policies, five have a constant-`true` expression and the other four
  are SELECT-only on reference data (`colleges`, `community_settings`, `user_badges`,
  `user_prompts` — the last two are MEXA-277). Every other table from
  `20250114_shidduch_system_fixed.sql` is closed by RLS rather than open.
  **Two things a reviewer should check by running, not reading.** `INSERT ... RETURNING` is
  refused by the SELECT policy even with the INSERT check widened to `true` — so a forge
  probe written with `RETURNING` proves nothing about the INSERT check, and the rehearsal's
  probes drop it (F2 vs F2b). And the "move a note into another shadchan's list" refusal has
  **two independent causes**, separated by mutating each alone: blinding only the UPDATE
  policy still refuses (F1a), blinding only the SELECT policy still refuses (F1b), blinding
  both is ALLOWED (F1c). So neither assertion is vacuous and neither is carrying the other.
  **This file's own post-check caught a defect in its first draft**, which is worth knowing
  because it generalises: this project carries `ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon`, so a new function is born with `anon=X/postgres` as a
  *direct* grant, and `REVOKE ALL ... FROM PUBLIC` does not remove it — `PUBLIC` is a
  different grantee. The house form is `FROM PUBLIC, anon` (00010); `00009`'s helpers used
  the short form. Post-check 7f matches the whole `proacl` string rather than probing for
  `anon`, and F5 proves the trap is real rather than theoretical.
- `00036` is **NOT applied** — written 2026-09-29 (MEXA-418), waiting on Guts's security
  review and an apply card. It closes the only hit the MEXA-414 sweep found on the **live
  dating surface**: an unmatch was reversible by the person who was unmatched. Rehearsed end
  to end against `tayiyczmacvhokdxfqvm` in one rolled-back transaction,
  `.scratch/mazal-mexa418/rehearse.mjs` → `REHEARSE.txt`, which measures the bug before, the
  fix after, **and runs the rollback in the same transaction** and asserts `relacl`, `attacl`
  and the column comments came back byte-identical to the pre-state. What it proves, in order:
  the resurrection write is **ALLOWED** before and **refused 42501** after; the app's own
  unmatch write and `useBlockUser`'s bulk write are refused after too, which is why the
  client moves to the RPC in the same commit; `last_message_at` is the one column still
  writable, and `is_active` cannot be smuggled into the same statement; message sending,
  mutual matching and Rewind all still work; the RPC sets the caller's own side, is
  idempotent, answers `not_found` for a match the caller is not in, is refused to `anon` and
  raises `42501` for a session with no `public.users` row. **Probe H1 is the one to read
  before approving:** a bare `REVOKE UPDATE ON matches` — the obvious fix — makes *every
  message send* fail `42501 permission denied for table matches`, because
  `update_match_last_message()` is a SECURITY INVOKER trigger. Live had **0 rows in
  `matches`**, so nothing is stranded by applying it.
  **Still open after this, filed separately:** the Unmatch and Block buttons in
  `app/(tabs)/messages/[matchId].tsx` call nothing — they pop "You have been unmatched" and
  navigate away, and `useUnmatch`/`useBlockUser` are exported but wired to no screen. So the
  hole this file closes is not reachable from the UI today, and neither is the feature.
- `00034` is **APPLIED** to `tayiyczmacvhokdxfqvm`, 2026-09-29 16:00Z, from `mazal-restart`
  @ `56a039f` (reviewed text `1a5f087`; the only `supabase/` difference between them is this
  file). Approved by Lelouch on MEXA-415 under MEXA-33, with me named as the single applier.
  Backup `archive/backups/mazal-00034-preapply-20260929T155910Z.sql` (207,735 bytes, chmod
  600 — it carries the `moderation_secrets` pepper), taken 0.2 min before the apply. Gate log
  in `.scratch/mazal-mexa406/APPLIED.txt`. `relacl` on `public.messages` went
  `anon=arwd,authenticated=arwd` → **`anon=ard,authenticated=ard`** — the `w` is gone from
  both — with `attacl` on `is_read`/`read_at` carrying `authenticated=w`. 89 public policies
  before and after, 0 rows touched, ledger row `00034` committed.
  **The apply aborted at gate 59, AFTER the transaction had committed, on a check of mine
  that was wrong.** Gates 1–57 passed, including the behavioural proof against the committed
  schema. Gate 59 was an `anon` HTTP probe added to satisfy Guts's PostgREST note, and it is
  **blind to this migration**: PostgREST's generated UPDATE puts `public.users` in the range
  table (the policy's subquery reads it), and `anon` has had no SELECT on `users` since
  `00013`, so the executor's permission pass raises *permission denied for table **users***
  before it ever reaches the column privilege on `messages` — the same answer before and
  after. A direct SQL `UPDATE public.messages` as `anon` *does* flip from naming `users` to
  naming `messages`, which is exactly why the gate looked sound at SQL level and was not one
  over REST. Both defects are fixed in `apply_00034.mjs`: the gate is replaced by the
  authenticated end-to-end check, and the abort banner no longer says "nothing was applied"
  once the transaction has committed (it said that here, which sent me hunting for a failed
  apply that had succeeded).
  **The real transport check is `.scratch/mazal-mexa406/postapply_http.mjs`, 11/11**
  (`POSTAPPLY_HTTP.txt`) — what Lelouch's card actually asked for, through PostgREST, as a
  signed-in user with a real GoTrue JWT, on two throwaway accounts created with
  `email_confirm: true` (no mail, no Resend quota) and deleted afterwards with the counts
  proved back to 0. Control first: u1 *can* read `public.users`, so a refusal below cannot be
  the `users` check firing. Then `PATCH messages.content` → **403 `42501 permission denied
  for table messages`**, hint `GRANT UPDATE ON public.messages TO authenticated`;
  `PATCH sender_id` → the same; `PATCH {is_read, read_at}` filtered exactly as
  `useMarkMessagesAsRead` sends it → **204**, and re-read confirms the receipt landed while
  `content` and `sender_id` are unchanged; `POST` a new message → **201**.
  Written 2026-09-29 (MEXA-406). **Guts PASSed it with no findings** on MEXA-413
  (commit `1a5f087`).
  He re-derived the mechanism correction himself before reading the conclusion, confirmed no
  SECURITY DEFINER function anywhere writes `content`/`sender_id` on a client's behalf (so
  there is no RPC bypass around the new column grant), and checked the `00016` independence
  claim against `00016`'s own text rather than this file's summary of it — both apply orders
  are safe. His one non-blocking note: **no migration in this repo sends
  `NOTIFY pgrst, 'reload schema'` after a grant change** (he checked all 41), so `00034` does
  not add it alone; the applier sends it and then proves it over HTTP. That check asserts on
  the **table named** in the error, not on the `42501` code, because `anon` is already
  refused today for a different reason — the UPDATE policy's subquery reads `public.users`,
  which `00013` closed to `anon`, so the pre-apply answer is *permission denied for table
  **users***. Measured both sides: before the REVOKE the error names `users`, after it names
  `messages`. A gate that accepted any `42501` would have passed identically before and
  after and proved nothing. **Either participant in a match can rewrite the other
  person's chat messages, and can reassign authorship of them to themselves.** Measured by
  execution on `tayiyczmacvhokdxfqvm`, not read off the catalog: as a real `authenticated`
  u1, `UPDATE messages SET content = 'I never said this'` on a message **u2 sent** affects
  **1 row**, and so does `SET sender_id = u1`.
  **MEXA-406 filed the wrong mechanism, and it was settled by execution rather than by
  argument** (`.scratch/mazal-mexa406/semantics.mjs`, PostgreSQL 17.6). The issue said the
  cause was `00002`'s UPDATE policy having a NULL `with_check`, on the reading that a NULL
  `with_check` does not reuse the `USING` clause for the new row. **The opposite is true:**
  for an UPDATE policy a NULL `with_check` means `USING` *is* applied to the new row. The
  discriminating probe is the one write that changes the only column `USING` reads — as u1,
  `SET match_id = <a match u1 is not in>` is refused with *"new row violates row-level
  security policy"*, while `SET content = …` with `match_id` untouched is allowed. So the
  new row is checked; the rewrite gets through because **the row filter is match
  membership, and a content rewrite does not change match membership**. The same script
  proves the corollary: adding a `WITH CHECK` that mirrors `USING` changes nothing, both
  probes identical with and without it. An earlier draft of `00034` added exactly that
  mirror and called it defence in depth; it was **removed**, because a no-op statement in a
  security migration is worse than none — the next reader believes it is doing work.
  **This also corrects the sweep MEXA-406 asked for.** "Every UPDATE policy in `public`
  with a NULL `with_check`" matches 19 policies and is mostly *not* a finding: where the
  `USING` clause is own-row (`user_id = me`) it *does* refuse a row that moves to another
  owner, and that was measured on three of them — repointing a `matches` row at a stranger,
  moving a `user_photos` row onto another profile, and re-registering a `push_tokens` row as
  the victim's are **all refused**. The real class, and the one worth sweeping for, is *a
  client role holding an over-broad UPDATE grant on a table whose policy `USING` expression
  is invariant under changing a security-relevant column* — which is what `messages` is
  (membership filter, free-text body) and also what `safta_accounts.subscription_status`
  (MEXA-345) and `users.orthodox_subscription_status` (MEXA-292) are (own-row filter,
  entitlement column). Follow-ups are on MEXA-406.
  **The grant is the fix and the policy cannot be.** An RLS `WITH CHECK` sees only the NEW
  row — there is no `OLD` in a policy — so no policy can say "content must not change".
  Column immutability lives in a column privilege or a `BEFORE UPDATE` trigger, and this file
  uses the privilege: declarative, visible in `information_schema.column_privileges`, free per
  row, and the mechanism `00015` already uses on `public.users`. A trigger was considered and
  rejected (a per-row function on the one table that is also published to realtime and
  cascade-deleted from `matches`, to enforce what the privilege system enforces for nothing).
  `GRANT UPDATE (is_read, read_at)` is the whole surface the app needs, measured against the
  code rather than assumed: `useMarkMessagesAsRead` (src/api/mutations/useMessage.ts:82) is
  the **only** client UPDATE on this table and it sends exactly those two columns.
  Verified against live in always-rolled-back transactions by
  `.scratch/mazal-mexa406/rehearse_00034.mjs`, **34/34** (`REHEARSAL.txt`), every
  behavioural claim executed as the real `authenticated` and `anon` roles with a JWT. It
  opens with a **pre-fix control** — the exploit runs, 1 row, and the row is re-read to show
  the tamper persisted rather than trusting a rowcount — so the "after" result is a change
  and not an assertion about an empty table. Then: `content`, `sender_id`, `match_id`,
  `message_type`, `media_url` and `created_at` are each refused, a mixed
  `SET is_read, content` is refused **whole**, `anon` is refused on both, and the message row
  is re-read unchanged. The feature side is executed too, because a fix that closed the hole
  by breaking read receipts would look like a UI bug: `useMarkMessagesAsRead`'s exact
  statement still affects 1 row and the receipt persists, sending still works, the thread
  still reads, and a third user in no match with either still reads 0 rows and writes 0 — so
  the `USING` filter is still doing its own job and the grant is not carrying it alone.
  Denials are classified on the **message**, never the code, since RLS and a missing GRANT
  are both `42501`; all of these are `permission denied for table messages`, i.e. the grant.
  The rollback is run in the same transaction and the exploit is then required to **work
  again** — that is what proves it is an inverse rather than a file that merely runs.
  **Every guard is proven to fire**, `.scratch/mazal-mexa406/guards_00034.mjs`, **12/12**
  (`GUARDS.txt`): a second apply, a database where the table grant is already gone (the
  MEXA-359 trap in its other direction — without that guard this file would *hand out* a
  privilege rather than narrow one), an unexpected third role holding UPDATE, the
  table-level `REVOKE` spliced out so only the column `GRANT` runs (which is exactly what
  "a column REVOKE cannot cut a table grant" produces: a file that runs clean and changes
  nothing), the re-grant spliced out so read receipts would break, the deleted `ALTER
  POLICY` spliced back in (so "this file writes no policy" is enforced, not just claimed in
  the header), `anon` left holding UPDATE, a comment that says the wrong thing, and **both**
  branches of the rollback's `anon` decision. Fresh connections afterwards confirm no
  fixture, no ledger row, `with_check` still NULL, no column ACL and 89 public policies —
  the live schema untouched.
- **The ledger lags the repo, re-measured 2026-09-29 (MEXA-326; first taken on MEXA-359).**
  `supabase_migrations.schema_migrations` on live holds `00000`–`00011`, `00013`–`00015`,
  `00017`–`00021`, `00023`, `00024`, `00025`, `00030`, `00032`, `00033`, `00034`, `20250114`,
  `20250115`
  (`00025` added 2026-09-29 08:10Z, MEXA-314; `00023` after the MEXA-359 reading, on
  MEXA-366; `00030` at 2026-09-29 10:43Z, MEXA-385; `00020` at 12:03Z, MEXA-394; `00032` at
  15:23Z, MEXA-373; `00034` at 16:00Z, MEXA-406; `00033` at 16:31Z, MEXA-401 — 30 rows).
  So **`00012` and `00016` are absent**, and `00026`, `00028`, `00029` and `00031` are
  written but not applied. Re-read at 12:26Z on MEXA-361: still 26 rows, `00023` present,
  no `00031`.
  **`00028` and `00029` are missing from the fresh-database order list at the top of this
  section**, though both exist in `supabase/migrations/` with rollbacks. That is a gap in
  this document, not a decision — filed on MEXA-361 for an owner rather than guessed at
  here, because where `00028` (`pin_function_search_path`) sits relative to the migrations
  that define the functions it pins is a real ordering question and not a typo to patch
  in passing.
  One thing the version column cannot tell you: it keys on the numeric prefix alone, so
  the second file of each colliding pair — `00003_push_tokens`, `00004_safta_messages`,
  `00005_notification_triggers` — has **no row of its own**. `00003`–`00005` being present
  does not prove those three ran; check the objects, not the ledger.
  `00016` is not merely missing a ledger row, it is **not applied at all**: its
  `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon` has not run (`anon` still
  holds 126 table grants), and `colleges`, `swipes`, `user_safta_stats` and
  `notification_queue` all still grant `DELETE,INSERT,SELECT,UPDATE` to `authenticated`.
  It was reviewed and PASSed on MEXA-300 and then never carded for an apply — the same
  failure this issue is about. **MEXA-364 owns it now**, and re-measured the same numbers at
  12:51Z: 126 pairs, no `00016` row, 41 of its 42 asserted `authenticated` pairs still granted
  (`users` DELETE was already gone, by `00015`). Do not read the per-migration notes above as
  a statement of what is on live without checking the ledger and a privilege probe.
- `00032` is **APPLIED** to `tayiyczmacvhokdxfqvm`, 2026-09-29 15:23Z, from `mazal-restart`
  @ `3a9906e` (MEXA-373). Guts PASSed it on MEXA-407 after re-running both suites himself;
  Lelouch approved the apply on MEXA-373 conditional on that review and on the backup and
  rollback being named. Applier: Violet, via
  `.scratch/mazal-mexa373/apply_00032.mjs --apply` — **69/69 gates**, log in
  `archive/backups/mazal-00032-postapply-20260929T152Z.txt`.

  It adds exactly one object, `public.has_entitlement(text)`, plus its ledger row. It drops
  nothing, alters no table, adds no policy and changes no table grant — measured across the
  apply: functions 43 → 44, policies 89 → 89, `subscriptions` policies 1 → 1, and `users`,
  `swipes` and `subscriptions` row counts all unchanged at 0.

  Post-apply on a fresh connection: SECURITY DEFINER, STABLE, `proconfig` exactly
  `search_path=public, pg_temp`, one signature, `proacl` non-NULL and equal to
  `{postgres=X/postgres,authenticated=X/postgres}` — so PUBLIC, `anon` and `service_role`
  hold nothing. **Behaviour was proven by execution against the applied function, not read
  off the catalog**: a seeded paying caller gets `TRUE` (which is what rules out a constant
  false), a caller with no row gets `FALSE`, and the real `anon` role gets `42501`. Those
  fixtures were rolled back and a third connection confirmed none survived.

  **The REST layer was checked too, and it is the check that is easy to skip.** A brand-new
  function is invisible to PostgREST until the schema cache reloads, so the SQL can be
  perfect while every call 404s. After `NOTIFY pgrst, 'reload schema'`:
  `POST /rest/v1/rpc/has_entitlement` with the anon key returns **401 `42501 permission
  denied for function has_entitlement`** — in the cache, and refused by the grant. The
  control, `POST /rest/v1/rpc/has_entitlement_nope`, returns **404 `PGRST202 Could not find
  the function … in the schema cache`**, which is what a missing function looks like and is
  why the 401 means something.

  **Nothing calls it yet, on the server or the device.** The three call sites — the daily
  swipe/super-like caps, the Rewind gate in `undo_last_swipe()`, and the gate inside
  `get_who_liked_me()` once `00026` lands — are MEXA-373 items 2/3/5 and come after
  MEXA-406. So applying this changed no behaviour for any caller; it created the thing the
  gates will ask.

  **The standing item this leaves open is `00016` (MEXA-364).** `public.subscriptions` still
  grants `INSERT, UPDATE, DELETE, SELECT` to **both** `anon` and `authenticated` — recorded
  verbatim in the apply log. Those grants are inert *only* because the table has exactly one
  policy and it is SELECT, which is what guard 0f checks and what the function's COMMENT
  states in the catalog. Guts's words on the review: "00016/MEXA-364 is the only thing
  between now and a silent premium bypass … today it's inert-by-absence-of-policy, which is
  a thin margin." Do not add a write policy to `subscriptions`; apply `00016` instead.

- `00022` is **APPLIED** to `tayiyczmacvhokdxfqvm`, 2026-09-29 14:00Z, from commit `a54f014`
  (Guts PASSed it on MEXA-356; Lelouch approved the apply on MEXA-396). It adds exactly one
  object, `public.safta_public_profiles`, and changes no policy, grant or column on any
  existing table, so its rollback is a plain `DROP VIEW` and a genuine bit-exact inverse.

  Post-apply, on a fresh connection: the view exists, its columns are exactly
  `id, display_name, relationship`, `security_invoker=false security_barrier=true`, the only
  non-owner grant is `authenticated:SELECT`, and `safta_accounts` is untouched at 3 policies
  and 11 columns. Behavioural probe `verify.mjs --mode applied` **35/35** against the applied
  database — that mode failed before the apply, which is what makes its pass meaningful.

  **The REST layer was checked separately, and it is the check that is easy to skip.** A new
  view is invisible to PostgREST until its schema cache reloads, so the SQL can be perfect
  while every app read 404s. After `NOTIFY pgrst, 'reload schema'`:
  `GET /rest/v1/safta_public_profiles` with the anon key returns **401 `42501 permission
  denied for view`** — in the cache, and refused by the grant. The control,
  `GET /rest/v1/safta_nonexistent_view`, returns **404 `PGRST205 Could not find the table
  … in the schema cache`**, which is what a missing view looks like and is why the 401 means
  something. `?select=email` is **400 `42703`**, so the withheld columns are withheld over
  REST too. Full output in `.scratch/mazal-mexa302/REST_PROBE.txt`.

  **Its security premise is `00023`.** The row rule publishes a name on an `accepted`
  connection and its header argues that `accepted` means the grandchild consented. That was
  false at the RLS layer until `00023_safta_connection_consent.sql` (MEXA-357) landed on
  live at 2026-09-29 06:39Z — before that, any signed-in account could write itself an
  `accepted` connection to any user id, which would have made `00022` publish a chosen
  `display_name` to a stranger. `00023` is applied, so the premise now holds. Do not apply
  `00022` to a database where `00023` is absent.

  What it is for: `safta_accounts` has one SELECT policy, `auth_id = auth.uid()`, so a
  grandchild could never read the row of a Safta connected to her. Three shipping call
  sites depended on it and one of them, `useSaftaConnections`, embedded it as
  `safta_accounts!inner(...)` — PostgREST turns `!inner` into an inner join, so the
  unreadable row **deleted the connection** and the grandchild's Safta list on the matches
  tab rendered empty rather than nameless. All of it is behind `FEATURE_SAFTA_MODE`, which
  is off, so no user has been affected.

  The view is the `user_public_profiles` shape from `00013`: owner-run
  (`security_invoker = false`), `security_barrier = true`, the WHERE clause **is** the row
  rule. Three display columns only — `id`, `display_name`, `relationship`. `email` and the
  three `subscription_*` columns are not in it and must not be added; they are an adult's
  contact details and billing state, and a column absent from a view cannot be leaked by a
  policy mistake. Rows are limited to accounts the caller holds an **accepted**
  `safta_connections` row to, plus her own: `pending` would let anyone with a Safta account
  learn a display name by inserting a connection nobody ever accepted.

  One thing that is easy to get wrong and is **not** shared with `00013`: this view *is*
  auto-updatable (`is_insertable_into = YES`), so without the REVOKE an owner-run write
  would reach `safta_accounts` with RLS off. Supabase's default privileges grant all four
  verbs on any new object in `public`, so section 2's REVOKE is load-bearing, not
  boilerplate. Measured both ways in `.scratch/mazal-mexa302/probe_mine_updatable.mjs`.
  `00013`'s `user_public_profiles` is *not* auto-updatable (`55000 cannot update view`), so
  the write grants still sitting on it are inert — checked while writing this, no issue
  filed.

  Verified against live in rolled-back transactions by `.scratch/mazal-mexa302/verify.mjs`,
  three modes, nothing left behind (a fresh connection asserts the view is absent and all
  fixture tables are back to 0 rows in each run).
  All green: **`before` 10/10** (`BEFORE.txt`) — the connected grandchild measured reading
  **0 rows**, not a null column, off `safta_accounts`.
  **`after` 35/35** (`AFTER.txt`) — the accepted grandchild sees the name; a pending one, a
  rejected one, an unconnected user and a second Safta all see nothing; `anon` is `42501` on
  the grant *and* the row rule independently yields 0 rows with no session; all seven
  withheld columns are `42703` through the view and still 0 rows off the table; INSERT,
  UPDATE and DELETE through the view are all refused and the row is unchanged after; and
  the join the app now issues returns 1 named connection for the accepted grandchild and 0
  for the pending one, with her pending connection row readable but its name NULL.
  **`rollback` 10/10** (`ROLLBACK.txt`) — identical to `before`, i.e. the undo lands exactly
  where it started.

  **After applying, reload the PostgREST schema cache** (`NOTIFY pgrst, 'reload schema';`
  or the dashboard's restart) — a new view is invisible to the REST API until it does, and
  the app-side reads would 404 while the SQL is already correct.
- `20250114120000_cleanup_verification_cron.sql` is **not** applied. Read the header in
  that file.
- `demo_data.sql` is **not** seed data for a real database. It inserts `auth_id` values
  like `'demo-shadchan-1'` into a UUID column and omits NOT NULL columns
  (`display_name`, `jewish_background`, `looking_for`), so it does not run as written.
  The app's demo mode uses `src/lib/demo/demoProfiles.ts`, not the database.
- Nothing seeds `colleges`. That is fine: no client code reads that table.

## Commands

There is no `psql` on the Mexant box and the CLI cannot be used for the reasons above, so
the run used a small Node script with the `pg` driver. Connect through the session pooler
on IPv4 — `db.<ref>.supabase.co` has no A record, only AAAA:

```
host: aws-0-us-east-1.pooler.supabase.com
port: 5432                      # session mode, so DDL and transactions behave
user: postgres.<project-ref>
password: $SUPABASE_DB_PASSWORD # archive/credentials/mazal-supabase.env, never in git
database: postgres
ssl: required
```

The script applies each file in one transaction and records it in
`supabase_migrations.schema_migrations` (the table `supabase db push` uses), keyed on the
numeric/date prefix, so a re-run skips what is already applied:

```js
await c.query('begin');
await c.query(fs.readFileSync(file, 'utf8'));
await c.query(
  'insert into supabase_migrations.schema_migrations (version, name) values ($1,$2) on conflict do nothing',
  [version, name]
);
await c.query('commit');
```

**Every apply path has to write that row, in the same transaction as the file.** `00011`
went on through the Management API's query endpoint instead of this script, with only the
file body inside its `BEGIN…COMMIT`. The objects landed but the ledger row did not, so a
re-run would have tried to apply `00011` a second time. The row was backfilled on
2026-09-29 (MEXA-325) after checking that every object the file creates, down to its last
statement, is on live. If you apply by any other route, put the `insert` above inside your
own transaction. A separate statement run afterwards can leave the ledger claiming a
migration that did not run, or leave out one that did. After an apply, compare
`select version from supabase_migrations.schema_migrations` with the APPLIED notes above.

Two limits of keying on the prefix. The second `00003`, `00004` and `00005` files and
`20250114_add_creator_tracking` have no row of their own, because `on conflict do nothing`
drops them against their twin. A re-run skips them, which is right today because they are
applied. But **never give a new file a prefix that is already in the table.** It would be
skipped silently.

## Result of the 2026-09-28 run

- 16 files applied, 0 failures, **36 tables** in `public`.
- Storage buckets created: `profile-photos` (public, 5 MB, jpeg/png/webp/heic) and
  `message-media` (private, 10 MB, images + audio), with 6 policies on
  `storage.objects`.
- 88 RLS policies in `public`; **every** table in `public` has RLS enabled.
- No RLS policy cycles remain. Checked by walking `pg_policies` and looking for a table
  whose policy expressions reach back to itself; three cycles existed before `00008`
  and `00009` (`users ↔ blocks`, `shidduch_profiles ↔ shidduch_suggestions`,
  `shidduch_profiles ↔ family_connections`).

`00010_secure_definer_rpcs.sql` was applied to the same project later on 2026-09-28
(MEXA-252). After it, no function in `public` is executable by `anon` or `PUBLIC` except
the four `notify_*` trigger functions, which Postgres will not run outside a trigger and
PostgREST does not publish.

## Writing a new SECURITY DEFINER function

Two things bite here, both learned the hard way in MEXA-248/251/252:

- A `SECURITY DEFINER` function runs as `postgres`, which has `BYPASSRLS`, so **no policy
  on any table it reads or writes applies**. It has to check identity itself, from
  `auth.uid()` / `public.current_app_user_id()`. Never trust an id passed in as an
  argument; if the argument has to stay for compatibility, compare it to the caller and
  raise `42501` when it does not match.
- **`REVOKE ... FROM PUBLIC` is not enough, and omitting a role from `GRANT` does
  nothing.** Supabase ships `ALTER DEFAULT PRIVILEGES` on `public` that grants `EXECUTE`
  to `anon`, `authenticated` and `service_role` on every new function at creation time.
  Say it explicitly:

```sql
REVOKE EXECUTE ON FUNCTION public.my_function(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_function(uuid) TO authenticated, service_role;
```

  PostgREST publishes every non-trigger function in `public` at `/rest/v1/rpc/<name>`, so
  a missed revoke is a live endpoint for anyone holding the anon key. Also add
  `SET search_path = public`.

## Creating a new table

The table-level twin of the problem above, from MEXA-268. Supabase ships
`ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon, authenticated, service_role`
on `public`, so before `00014` every one of the 36 tables here held the full privilege set
for both client roles — `anon=arwdDxtm`, i.e. INSERT, SELECT, UPDATE, DELETE, **TRUNCATE,
REFERENCES, TRIGGER and MAINTAIN**.

**RLS does not constrain TRUNCATE, TRIGGER, REFERENCES or MAINTAIN.** Policies filter
SELECT/INSERT/UPDATE/DELETE only; the other four are table-level privileges and bypass
every policy. `TRUNCATE public.users CASCADE` as the `authenticated` role emptied nine
more tables with it — measured on this project, in a rolled-back transaction, before
`00014`. Nothing reaches it through PostgREST, which is why this is hardening rather than
an incident, but the grant has no caller and no purpose.

`00014` revokes all four schema-wide and fixes the `postgres`-owned default so the next
`CREATE TABLE` does not re-grant them. Two things it does not solve:

- The `supabase_admin`-owned entry in `pg_default_acl` for `public` still grants all eight.
  The pooler role cannot change it (`permission denied to change default privileges`) and a
  default ACL only applies to objects created by its owning role, so it is harmless while
  every migration runs as `postgres`. Re-running `00014` section 1 is the fix if it ever
  bites. Do not grant `supabase_admin` to `postgres` to get around it.
- `arwd` is still schema-wide. A new table therefore starts life with INSERT, SELECT,
  UPDATE and DELETE for `anon` **and** `authenticated`, and RLS is the only thing standing
  between them and the data. So a new table needs, in the same migration that creates it:
  `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, a policy per verb it means to allow, and an
  explicit `REVOKE`/`GRANT` pair naming the verbs it does not — the shape `00011` uses for
  `deleted_accounts` and `moderation_secrets`:

```sql
REVOKE ALL ON TABLE public.my_table FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.my_table TO authenticated;
GRANT ALL    ON TABLE public.my_table TO service_role;
```

  Granting a verb with no matching policy is not neutral, and note which way round the risk
  runs (Alucard, MEXA-275). **Revoking** a verb whose policy arrives later fails *loudly* —
  the policy is never consulted and the caller gets `42501 permission denied`, which whoever
  tests the new policy hits at once. **Granting** one with no policy is the quiet case: it
  looks inert because RLS admits zero rows, right up until someone adds a permissive policy
  for that verb and opens the standing grant with it. So err towards the narrow GRANT.

  Sequences had the same default problem (`anon=rwU`, i.e. `nextval`/`setval`/`currval` on
  every new sequence). `00016` closes it for `anon` — both on the sequences that exist (none;
  every id is a `uuid`) and on the default, so a future `bigserial` does not inherit it.
  `authenticated` deliberately keeps `rwU`, because a `serial` column's default `nextval()`
  is evaluated with the **inserting** role's privileges, so revoking it would break INSERT
  into the first `serial` table anyone adds. Use `GENERATED ALWAYS AS IDENTITY` instead —
  its sequence is owned by the column and needs no caller-side grant at all — and then
  `authenticated` can lose sequences too.

  And since `00016`, `anon` holds **nothing at all** on any table in `public`, including
  the default for new ones. A new table that genuinely needs unauthenticated reads has to
  say so out loud with an explicit `GRANT SELECT ... TO anon` plus a policy — which is the
  point: `USING (true)` on a `TO public` policy meant "the whole internet", since the anon
  key ships in every app binary.

## Three features are dead on the live database (MEXA-274)

Found by walking the grants against `pg_policies`, not by running the app. All three are
missing RLS policies, not missing grants, so `00016` deliberately leaves their grants in
place and fixes nothing here — each has its own issue.

| What is broken | Why |
|---|---|
| **Mutual matching** — nobody ever gets a match | `check_for_match` on `swipes` is SECURITY INVOKER, so its mutual-like `EXISTS` runs under the `swipes` SELECT policy (`swiper_id = me`) and can never see the other person's like. Measured: `mutual_like = FALSE` with the other swipe right there. And `matches` has no INSERT policy, so even a fixed trigger gets `42501`. Both halves need fixing. |
| **Safta likes** — every like fails | `update_safta_stats` on `safta_likes`, same SECURITY INVOKER shape, inserts into `user_safta_stats`, which has no INSERT or UPDATE policy. `42501`, and the like is rolled back with it. |
| **Shidduch suggestions** — cannot be created or answered | `shidduch_suggestions` has a SELECT policy and nothing else, while `matchingService.ts:602` inserts and `app/(shidduch-tabs)/index.tsx:483` updates. |

The general shape to watch for: **a SECURITY INVOKER trigger function is subject to RLS,
both for what it can read and for what it can write.** `update_match_last_message` is the
one of the three that works, and only because `matches` does have an UPDATE policy that
admits the sender. A trigger that maintains derived state on behalf of the system wants
`SECURITY DEFINER` + `SET search_path = public`, the way the `notify_*` triggers already do.

## Columns are not rows: publishing someone else's profile

RLS restricts rows and nothing else, so no policy can stop a client asking for a *column*.
That was MEXA-261 — `users` doubled as "my account" and "everyone's public profile", so the
policy that let you see other people handed over their `email`, `phone`, coordinates and an
Instagram OAuth token with them. `00013_users_column_privacy.sql` is the shape to copy if
another table ever has to serve both audiences:

- **`public.users` is own-row-only.** One SELECT policy, `auth.uid() = auth_id`. Everything
  that reads the signed-in user can keep saying `select('*')`.
- **`public.user_public_profiles` is everyone else.** A view of display columns, owned by
  `postgres` and left at `security_invoker = false` so `users` RLS does not apply to it —
  which means **the row rule has to live in the view's own `WHERE`**, because no policy is
  going to supply it. Add `security_barrier = true`. Revoke it from `anon`.
- Do **not** reach for a column-level `REVOKE ... (col)` on SELECT. A role that lacks SELECT
  on even one column gets `permission denied for table` from `select('*')`, and this app's
  own-row reads are built on `select('*')`. Column-level *UPDATE* grants are fine; they do
  not affect reads. That is why the Instagram token had to move to its own table
  (`user_integrations`) rather than just lose its grant.
- A policy on some *other* table that reaches into `users` with a correlated subquery is
  subject to `users` RLS too, so it breaks the moment `users` stops answering cross-user
  reads. `user_photos."Users can view other photos"` was exactly that, and `00013` had to
  rewrite it through a SECURITY DEFINER helper, `public.is_discoverable_profile()`. Grep
  `pg_policies` for the pattern before narrowing a table other policies lean on.

**Types for a new view have to be written by hand.** `supabase gen types typescript` shells
out to Docker and there is none on this box: it exits 1 having printed only
`Connecting to <host> 5432`. So `src/types/supabase.generated.ts` is left alone, and the view
is declared in `src/types/database.types.ts`, which augments the generated `Database` with a
`Views` entry and re-exports it (`src/api/supabase/client.ts` is the only consumer). Read the
comment on `PublicProfile` there before regenerating anything: a real generator run emits
every view column as nullable, because Postgres reports no NOT NULL through a view.

## The RLS write sweep, and the query to re-run it (MEXA-414)

`00034`'s entry under **Order** records *why* "every UPDATE policy with a NULL `with_check`"
is the wrong search. This section is the right one, run to completion on
`tayiyczmacvhokdxfqvm` (PostgreSQL 17.6) on **2026-09-29**, with a verdict per hit. Evidence:
`.scratch/mazal-mexa414/` — `sweep2.mjs`/`SWEEP2.txt` (the catalog cross-product),
`probe.mjs`/`PROBE.txt` (33 writes executed as real `authenticated` callers in one
rolled-back transaction), `schema.mjs`/`SCHEMA.txt` (the grant and policy picture per table).

**The class.** *A client role holds an UPDATE grant on a column that the table's UPDATE
policy `qual` does not reference.* `USING` cannot see `OLD`, so it constrains only the columns
it reads; every other writable column is free up to the grant. The fix is always a column
grant (or a `SECURITY DEFINER` RPC), never a policy.

**The query.** For every `UPDATE`/`ALL` policy in `public`, cross the columns a client role may
UPDATE (`has_column_privilege`, which folds in both the table grant and any column grant)
against the columns `pg_get_expr(polqual, polrelid)` actually references. Writable and
unreferenced is a candidate; then ask whether the column is security-relevant.

Two ways to get the referenced set wrong, both hit on the way here:

- **`polqual::text` VAR nodes are not usable.** A sublink's own RTE is also `varno 1`, so a
  subquery on `public.users` donates *users'* attnums to the policy's table: `push_tokens`
  acquired a phantom `platform`, `shadchan_connections` a phantom `user_id`, `matches` a
  phantom `id`. That direction **hides** candidates, so v1 of the sweep under-reported.
- **A bare substring match over-counts** for the same reason in reverse (`m.user1_id` is not
  `messages.user1_id`). What works is the deparsed text: `pg_get_expr` qualifies every var
  that lives in a sublink and leaves the policy relation's own top-level columns bare, so keep
  `<tbl>.col`, strip every other `alias.col`, then match bare column names in what is left.
  Sanity-check the stripped aliases by eye — if one of them is an alias *of the policy's own
  table*, this rule would wrongly free that column.

**25 UPDATE-capable policies across 24 tables; 329 candidate (table, policy, column) triples.**
Most are profile content a user is supposed to edit. What survives triage:

| verdict | where | measured |
|---|---|---|
| **finding, live surface** | `matches.is_active` + `userN_unmatched` | **An unmatch is reversible by the person who was unmatched.** `useUnmatch` (src/api/mutations/useMatch.ts:41) writes own-flag + `is_active=false`; `useMatches.ts:48` lists `is_active = true`. The other participant then writes `is_active = true, <their>_unmatched = false` — **allowed, 1 row** — and the match is back in *both* lists, with the thread intact and sendable again. `qual` is match membership, which neither column changes. MEXA-418. **Fixed by `00036`** (written, rehearsed, not applied): table-wide `UPDATE` revoked from both client roles, `GRANT UPDATE (last_message_at)` kept so the INVOKER trigger on `messages` still works, and the write moved into `public.unmatch(uuid)`, which is one-way. |
| **finding, hidden surface** | `shadchan_notes` | `shadchan_notes_select_own` is `FOR ALL USING (true)` with full column grants to `anon` **and** `authenticated`. An unrelated user reads every matchmaker's private candidate notes, rewrites them, **deletes** them and forges new ones under another shadchan's id — all measured allowed. Not this class at all: a missing ownership filter, and the policy name says what it meant to be. MEXA-419. **Fixed by `00037`** (written, rehearsed, not applied): four command-scoped policies `TO authenticated` through the DEFINER helper `current_shadchan_ids()`, `shadchan_id` given its first FK (`shadchanim(id)`), and `anon` revoked. It is the only constant-`true` policy on a write command in the schema — the other four are SELECT-only on reference data. |
| **finding, hidden surface** | `safta_messages.content`, `.sender_id` | MEXA-406's twin. "Users can mark safta messages as read" gates on connection membership, so the connected user rewrites the Safta's message body and reassigns its sender — allowed. MEXA-420. |
| **finding, hidden surface** | `shadchanim.is_verified`, `.successful_matches`, `.years_experience` | Self-awarded, and *readable by everyone* (`SELECT USING (is_active = true)`): 250 successful matches and a verified tick on your own matchmaker profile, allowed. MEXA-420. |
| **finding, hidden surface** | `shidduch_references.is_verified`, `.verified_at` | The profile owner marks their own reference — the rabbi who vouches for them — verified. Allowed. MEXA-420. |
| **finding, hidden surface** | `safta_daily_usage.recommendations_count` | A Safta zeroes their own daily counter, i.e. the free-tier cap. Allowed. MEXA-420. |
| **still open, re-measured** | `safta_accounts.subscription_status`, `_plan`, `_expires_at` | MEXA-345, unfixed on live today: a Safta writes `active`/`safta_pro` + a ten-year expiry on their own account. Allowed. |
| **latent, one render away** | `user_badges.badge_type`, `.verified` | `birthright`/`hebrew_speaker` etc. are self-declared **by design**, but the same CHECK list holds `verified_jewish` and `photo_verified`, and `(tabs)/profile.tsx:53` maps `verified_jewish` to a gold "Verified" chip. A user inserts or updates their way into it (both allowed), and `SELECT` is `USING (true)`, so any signed-in user can read it. Inert only because nothing renders *another* user's `user_badges` yet — `useDiscoveryProfiles.ts:134` already fetches them. MEXA-420. Separately and not a security bug: the picker offers eight ids the CHECK rejects and `handleSave` deletes the old rows before finding out — MEXA-421. |
| **latent, one render away** | `user_photos.is_verified` | Found on MEXA-406, re-proved here. Nothing renders a per-photo tick; the badge users see is `users.is_verified`, closed by `00024`. Belongs in whatever migration first gives the column a reader. |
| **not a finding** | `users.*`, `shidduch_profiles.*` (content), `notification_preferences`, `saved_locations`, `user_prompts.answer`, `user_colleges`, `shabbat_schedules`, `shidduch_daily_activity`, `push_tokens.token`/`device_id` | Own-row content the owner is meant to edit. `users` is already column-scoped by `00015` + `00024`, and the two gated-everything policies (`shabbat_schedules`, `shidduch_daily_activity`) produce no candidates at all. `push_tokens` is reachable only for your own row: you can point your own registration at a device token you already know, which is push spam to that device, not a route to anyone's notifications (`user_id` **is** gated — measured refused on MEXA-406). |
| **not a finding, but the grant is wrong** | `orthodox_emails` | `anon` and `authenticated` hold INSERT/UPDATE on every column while the only policy is `auth.role() = 'service_role'`. Client writes match no row, so this is 0 rows today — and it is one permissive policy away from being a hole. |
| **not a finding, but the grant is wrong** | `blocks`, `colleges`, `community_settings`, `family_connections`, `notification_queue`, `shidduch_messages`, `shidduch_profile_views`, `shidduch_suggestions`, `subscriptions`, `swipes`, `user_safta_stats` | A client UPDATE grant with **no UPDATE policy at all**. Measured on `swipes`: an own-row UPDATE is **allowed and affects 0 rows** — no `42501`, so the write fails *silently*. The policy's absence is the only thing stopping it, and `subscriptions` is the entitlement table. |

**A `WITH CHECK` that mirrors `USING` is a no-op; one that adds a predicate is not.** Worth
keeping straight, because the guards in `00023` and `00031` assert `with_check IS NOT NULL` on
`safta_connections` and `safta_likes` and those assertions are **correct**: those policies'
`WITH CHECK` pins `status` to a terminal value and keeps `pending` out, which `USING` never
said. Do not "correct" them by analogy with `00034`, where the mirror was deleted.

**The INSERT side is the same cross-product, and a fix that only revokes UPDATE leaves the
door open.** `sweep3.mjs` / `SWEEP3.txt` runs it: INSERT policies, the `WITH CHECK` in place of
`qual`, `has_column_privilege(..., 'INSERT')`. Most of its 337 hits are noise by construction —
on a creation *every* column is caller-supplied, and that is the point of a creation. What
matters is the subset that is **server-owned state on a brand-new row**, and it is the same
list: `user_badges.badge_type`/`verified`, `user_photos.is_verified`,
`shidduch_references.is_verified`, `safta_accounts.subscription_status`. A user does not need
the UPDATE grant if they can carry the value in on the INSERT — which is exactly why `00024`
section 3b asserts `has_column_privilege('authenticated', …, 'is_verified', 'INSERT')` is false
rather than stopping at the UPDATE it revoked. Copy that assertion into anything that lands off
MEXA-420. Two more from this pass, neither newly owned: `reports.status` is caller-supplied, so
a report can be filed pre-`dismissed` (the moderation queue has no reader yet), and
`safta_likes.sent_to_user`/`sent_at` are ungated on INSERT — which is the defect `00031` exists
to fix and **`00031` is not in the live ledger** (`00026`, `00028`, `00029`, `00031` and `00035`
are all in the repo and absent from `supabase_migrations.schema_migrations`, read 2026-09-29).

## Still to do on the backend

- Deploy the three Edge Functions in `supabase/functions/` (`send-notification`,
  `delete-account`, `cleanup-verification-photos`). None is deployed.
- Re-create the verification-photo cleanup cron without a key in git.
- Custom SMTP. Sign-up sends a confirmation email and the built-in sender allows only a
  few per hour, which will not survive a TestFlight round.
- `user_colleges.is_visible` is `boolean` **nullable** `DEFAULT true`, so a policy has to
  decide what an explicit NULL means. `00019` reads it as visible (`IS NOT FALSE`), matching
  the column default. Making it `NOT NULL DEFAULT true` would remove the question; it is safe
  on a 0-row table but it is a schema change, so it was left out of `00019`. Do it in the
  migration that first gives the column a writer.
