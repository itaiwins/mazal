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
00022_safta_public_profiles.sql
```

`00021_drop_orthodox_discovery_rpc.sql` is on branch `mexa-327` and not merged here yet.
It drops a function and names nothing `00022` touches, so the two are order-independent;
slot it in at its number when that branch lands.

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
  `00020_safta_likes_actually_save_rollback.sql` and
  `00022_safta_public_profiles_rollback.sql`; read each one's header. `00014`'s,
  `00015`'s and `00016`'s are the three that are not bit-exact inverses, and each says
  exactly where it differs and why. `00013`'s is exact except for column order, which its
  header explains. `00016`'s is split into six independent sections, `00019`'s into two and
  `00020`'s into two, smallest first — run the one that unblocks you, not the whole file.
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
- `00016` is **not applied yet** — same reason, waiting on Guts or Alucard (MEXA-274) and
  then on Lelouch. It is written against the live post-`00014` state and **assumes `00014`
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
  Verified against live in rolled-back transactions by `.scratch/mazal-mexa289/verify.py`,
  which has three modes and leaves nothing behind (re-checked: all six fixture tables back to
  0 rows). All green:
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
- `00020` is **not applied yet** — written and verified, waiting on Guts's review (MEXA-297,
  a function moving to `SECURITY DEFINER`) and then on Lelouch. It **depends on nothing**: it
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
- `00022` is **not applied yet** — written and verified, waiting on Guts's review
  (MEXA-302) and Lelouch's apply approval. It adds exactly one object,
  `public.safta_public_profiles`, and changes no policy, grant or column on any existing
  table, so its rollback is a plain `DROP VIEW` and a genuine bit-exact inverse.

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
