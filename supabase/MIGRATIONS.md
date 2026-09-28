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
  *ahead* of the migration it undoes. The three that exist are
  `00010_secure_definer_rpcs_rollback.sql`, `00011_preserve_moderation_history_rollback.sql`
  and `00012_deleted_accounts_retention_rollback.sql`; read each one's header.
- `00011` and `00012` are in the order above but are **not applied yet** to
  `tayiyczmacvhokdxfqvm` — they are waiting on Guts's security review (MEXA-256) and, for
  what reads the tombstones at signup, on a product decision (MEXA-258,
  `docs/MODERATION_REENTRY.md`). `00012` refuses to run if `00011` has not.
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

## Still to do on the backend

- Deploy the three Edge Functions in `supabase/functions/` (`send-notification`,
  `delete-account`, `cleanup-verification-photos`). None is deployed.
- Re-create the verification-photo cleanup cron without a key in git.
- Custom SMTP. Sign-up sends a confirmation email and the built-in sender allows only a
  few per hour, which will not survive a TestFlight round.
