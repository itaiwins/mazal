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
00015_discovery_rank_server_side.sql
```

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
  *ahead* of the migration it undoes. The six that exist are
  `00010_secure_definer_rpcs_rollback.sql`, `00011_preserve_moderation_history_rollback.sql`,
  `00012_deleted_accounts_retention_rollback.sql`,
  `00013_users_column_privacy_rollback.sql`,
  `00014_revoke_unreachable_table_privileges_rollback.sql` and
  `00015_discovery_rank_server_side_rollback.sql`; read each one's header. `00014`'s
  is the only one that is not a bit-exact inverse, and it says exactly where it differs and
  why.
- `00011`, `00012` and `00013` are in the order above but are **not applied yet** to
  `tayiyczmacvhokdxfqvm` — they are waiting on Guts's security review (MEXA-256, MEXA-261)
  and, for what reads the tombstones at signup, on a product decision (MEXA-258,
  `docs/MODERATION_REENTRY.md`). `00012` refuses to run if `00011` has not.
- `00013` does not depend on `00011`/`00012` and can be applied without them. It is the one
  migration here that the **app cannot run without**: it makes `public.users` own-row-only
  and moves other people's profiles to a new `public.user_public_profiles` view, which
  `src/api/queries/useDiscoveryProfiles.ts`, `src/api/queries/useMatches.ts` and
  `app/(safta-tabs)/index.tsx` already read. Applying it and shipping the app go together —
  old app against new database means an empty deck, new app against old database means a
  404 from PostgREST for the view.
- `00014` is **not applied yet** either — it is a privilege change on a live project, so it
  waits on Guts or Alucard (MEXA-275) and then on Lelouch for the apply (MEXA-33). It has no
  dependency on `00011`–`00013` and they have none on it: it is one `REVOKE` over every
  table in `public` plus a default-privileges fix, and re-running it is a no-op. Applying it
  out of order is safe; applying it *before* a new `CREATE TABLE` is better, because that is
  what stops the new table being handed TRUNCATE.
- `00015` is **not applied yet** either, and it is the only migration here with a hard
  dependency upwards: it restates `00013`'s view without `elo_score`, so `00013` has to be
  applied first. It also adds `public.get_discovery_deck()`, which returns the discovery
  deck already ranked — incoming likes first, then `elo_score` descending — so no client
  ever sees the ranking number (MEXA-278). Same shipping constraint as `00013`: the app and
  the migration go together, because an app that still sorts client-side asks the view for a
  column that is gone, and an app that calls the RPC against a database without it gets a
  404. It waits on Guts (grants and RPC security) and on `00013` landing.
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

## Columns are not rows: reading someone else's profile

RLS restricts rows and nothing else, so a policy can never stop a client asking for a
column. That is what MEXA-261 was, and `00013_users_column_privacy.sql` is the shape to
copy if another table ever has to serve both "mine" and "everyone's":

- **`public.users` is own-row-only.** One SELECT policy, `auth.uid() = auth_id`. Anything in
  the app that reads the signed-in user can keep saying `select('*')`.
- **`public.user_public_profiles` is everyone else.** A view listing display columns, owned
  by `postgres` and left at `security_invoker = false` so it is not subject to `users` RLS —
  which means **the row rule has to be in the view's own `WHERE`**, because no policy is
  going to supply it. Add `security_barrier = true`.
- Do not reach for a column-level `REVOKE ... (col)` on SELECT. If a role lacks SELECT on
  even one column, `select('*')` fails for that role with `permission denied for table`,
  and this app's own-row reads are built on `select('*')`. Column-level `UPDATE` grants are
  fine — they do not affect reads.
- A policy on some *other* table that reaches into `users` with a correlated subquery is
  subject to `users` RLS too, so it breaks the moment `users` stops answering cross-user
  reads. `user_photos."Users can view other photos"` was exactly that, and 00013 had to
  rewrite it through a SECURITY DEFINER helper. Grep `pg_policies` for the pattern before
  changing a policy anything else leans on.

**A policy can hide rows the caller is entitled to, quietly.** The only SELECT policy on
`swipes` (00002) is `swiper_id = <me>`, so a caller cannot read a row in which they are the
*swipee* — and "who liked me" is exactly that. Three client reads were written against it
and have always returned nothing: the incoming-likes query in `useDiscoveryProfiles.ts`
(fixed in 00015 by moving it into a SECURITY DEFINER RPC, MEXA-278), the reciprocal-like
check in `useSwipe.ts`, and the realtime filter in `useMatchesSubscription.ts` (both
MEXA-294). The match itself still gets made — the `swipes_check_match` trigger from 00001
runs as its owner and is not subject to the policy — so what breaks is the "It's a Match!"
screen and the incoming-like notification, not the data.
None of them errored; they just came back empty, which is why it went unnoticed for months.
Before writing a query that reads a table "about me", check which side of the row the policy
names.

**Types for a new view have to be written by hand.** `supabase gen types typescript` shells
out to Docker, and there is no Docker on this box — it exits 1 after printing only
`Connecting to ...`. So `src/types/supabase.generated.ts` is left alone and the view is
declared in `src/types/database.types.ts`, which augments the generated `Database` with a
`Views` entry and re-exports it (`src/api/supabase/client.ts` is the only consumer). Read
the comment on `PublicProfile` there before regenerating anything: a real generator run
emits every view column as nullable, because Postgres reports no NOT NULL through a view.

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

  Granting a verb with no matching policy is not neutral: it is silent until someone adds a
  permissive policy later and does not think to check the grant.

## Still to do on the backend

- Deploy the three Edge Functions in `supabase/functions/` (`send-notification`,
  `delete-account`, `cleanup-verification-photos`). None is deployed.
- Re-create the verification-photo cleanup cron without a key in git.
- Custom SMTP. Sign-up sends a confirmation email and the built-in sender allows only a
  few per hour, which will not survive a TestFlight round.
