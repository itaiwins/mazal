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
```

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
  `00026_who_liked_me_rollback.sql` and
  `00030_public_profiles_publish_age_not_dob_rollback.sql`; read each one's header.
  `00030`'s **refuses to run while `00026` is applied**, because putting `date_of_birth`
  back would leave `get_who_liked_me()` selecting a column that no longer exists; roll
  `00026` back first. It is otherwise a bit-exact inverse, grants included. `00022`'s is a
  plain `DROP VIEW` and a genuine bit-exact inverse. `00014`'s,
  `00015`'s and `00016`'s are the three that are not bit-exact inverses, and each says
  exactly where it differs and why. `00013`'s is exact except for column order, which its
  header explains. `00016`'s is split into six independent sections, `00019`'s into two and
  `00020`'s into two, smallest first — run the one that unblocks you, not the whole file.
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
- `00016` is **not applied yet**, and that is still true as of 2026-09-29 — re-measured
  read-only on MEXA-326: no `00016` row in `supabase_migrations.schema_migrations`, and
  `anon` still holds **126** table grants in `public`, which its
  `REVOKE ALL ... FROM anon` would take to zero. It is **no longer waiting on a review**:
  Guts PASSed it on MEXA-300. It is waiting on someone to card the apply for Lelouch, and
  nobody has. **`00017` and `00018` went on live over this gap deliberately** — both were
  checked to be independent of it first (see `00017`'s note below) — so the hole between
  `00015` and `00017` in the ledger is intentional, not a skipped step to repair.
  It is written against the live post-`00014` state and **assumes `00014`
  has been applied**: it does not repeat `00014`'s work and its rollback deliberately does
  *not* undo it (`reports` comes back as `anon=ar`, never `arwd`). It is independent of
  `00013` and `00015`: `00015` narrows what `authenticated` may write to `users` by column,
  `00016` takes `users` DELETE away from `authenticated` and everything away from `anon`, so
  the two touch disjoint verbs and any order works. Its rollback is split into six
  independent sections — B (`authenticated`), C (`anon`), D (`notification_queue`),
  E (sequences), F (comments), plus A as a template for one verb on one table. **Run the
  smallest one that unblocks you.** Section C is the one to think hardest about: it hands
  unauthenticated read access back to `colleges`, `user_badges` and `user_safta_stats` —
  or it did. `00019` scoped `user_safta_stats`' SELECT policy `TO authenticated` and added
  the table to section C's skip list, and `00015_prompts_badges_visibility` does the same for
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
- **The ledger lags the repo, re-measured 2026-09-29 (MEXA-326; first taken on MEXA-359).**
  `supabase_migrations.schema_migrations` on live holds `00000`–`00011`, `00013`–`00015`,
  `00017`–`00021`, `00023`, `00024`, `00025`, `00030`, `20250114`, `20250115`
  (`00025` added 2026-09-29 08:10Z, MEXA-314; `00023` after the MEXA-359 reading, on
  MEXA-366; `00030` at 2026-09-29 10:43Z, MEXA-385; `00020` at 12:03Z, MEXA-394 — 26 rows).
  So **`00012` and `00016` are absent**, and `00026`, `00028` and `00029` are written but
  not applied.
  One thing the version column cannot tell you: it keys on the numeric prefix alone, so
  the second file of each colliding pair — `00003_push_tokens`, `00004_safta_messages`,
  `00005_notification_triggers` — has **no row of its own**. `00003`–`00005` being present
  does not prove those three ran; check the objects, not the ledger.
  `00016` is not merely missing a ledger row, it is **not applied at all**: its
  `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon` has not run (`anon` still
  holds 126 table grants), and `colleges`, `swipes`, `user_safta_stats` and
  `notification_queue` all still grant `DELETE,INSERT,SELECT,UPDATE` to `authenticated`.
  It was reviewed and PASSed on MEXA-300 and then never carded for an apply — the same
  failure this issue is about. Filed separately; do not read the per-migration notes above as
  a statement of what is on live without checking the ledger and a privilege probe.
- `00022` is **not applied yet** — written, verified, and **PASSed by Guts on MEXA-356**
  (2026-09-29, reviewed at `a54f014`); waiting on Lelouch's apply approval. It adds exactly
  one object, `public.safta_public_profiles`, and changes no policy, grant or column on any
  existing table, so its rollback is a plain `DROP VIEW` and a genuine bit-exact inverse.

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
