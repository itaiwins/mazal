-- Mazal - Take away the table privileges no client can legitimately use
--
-- Fixes MEXA-268 (found while checking whether a user could steer the 00012 retention
-- sweep, MEXA-258).
-- Rollback: supabase/rollback/00014_revoke_unreachable_table_privileges_rollback.sql
-- Pre-migration ACL snapshot: .scratch/mazal-mexa268/PRE_00014_ACL_SNAPSHOT.sql
--
-- Independent of 00013. Either order works: 00013 narrows `public.users` and
-- `public.user_integrations` further than this file does, and the REVOKEs below are
-- no-ops on anything 00013 already took away.
--
-- WHAT WAS WRONG
--
-- Supabase ships `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon,
-- authenticated, service_role` on `public` - the table-level twin of the function
-- default that 00010's header calls out. So on `tayiyczmacvhokdxfqvm` every one of the
-- 36 tables in `public` held the complete privilege set for BOTH `anon` and
-- `authenticated`:
--
--   relacl: {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,
--            authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
--
-- `arwd` is INSERT/SELECT/UPDATE/DELETE, which RLS then filters row by row and which the
-- app genuinely needs. The last four are the problem:
--
--   D = TRUNCATE     x = REFERENCES     t = TRIGGER     m = MAINTAIN (new in PG 17)
--
-- **Row-level security does not constrain any of them.** RLS filters
-- SELECT/INSERT/UPDATE/DELETE. TRUNCATE is a table-level privilege and bypasses policies
-- entirely; so do TRIGGER, REFERENCES and MAINTAIN. Every table in this schema has RLS
-- enabled and 88 policies between them, and none of that touches these four verbs.
--
-- `reports` is the sharpest case. Its only policies are INSERT ("Users can create
-- reports") and SELECT ("Users can view own reports"); there is deliberately no UPDATE
-- and no DELETE policy, because 00011 exists to make moderation history outlive the
-- accounts in it. The protection is complete for the verbs RLS sees and absent for the
-- one it does not, and `TRUNCATE reports` erases exactly what MEXA-256 was opened to
-- preserve - through a door 00011 does not close.
--
-- Measured on the live project as the `authenticated` role, before this migration:
--
--   TRUNCATE public.reports          -> succeeded
--   TRUNCATE public.messages         -> succeeded
--   TRUNCATE public.users            -> 0A000, blocked only by an incoming foreign key
--   TRUNCATE public.users CASCADE    -> succeeded (so the FK was not protection)
--   CREATE TRIGGER ... ON public.reports -> reached the function-lookup stage, i.e. the
--                                        privilege check on the table had already passed
--
-- After this migration, as the same role, all five are 42501 permission denied.
--
-- WHY IT IS NOT AN INCIDENT
--
-- PostgREST only ever emits SELECT/INSERT/UPDATE/DELETE and RPC calls, so a JWT holder
-- cannot ask for a TRUNCATE over HTTP. Reaching one would need either a SECURITY INVOKER
-- function in `public` that truncates - there is none; no function body in `public`
-- mentions TRUNCATE at all - or a direct Postgres connection as `authenticated`, and
-- Supabase issues no password for that role. These were standing privileges with no
-- caller and no purpose, which is the reason to remove them rather than to panic.
--
-- The project also had 0 rows in all 36 tables when this was written, so nothing was at
-- risk in practice. It is being fixed now precisely because that stops being true the
-- day Mazal has users.
--
-- WHY THESE FOUR AND NOT MORE
--
-- Everything below is a privilege no client code uses and PostgREST cannot request:
--
--   TRUNCATE   - no client path emits it; service_role keeps it for admin scripts.
--   TRIGGER    - creating a trigger on a table means running arbitrary code inside every
--                write to it, including writes made by other people. There is no reason
--                a client role should hold this.
--   REFERENCES - lets a role point a foreign key at a table, which then constrains
--                deletes on the parent. Nothing in the app creates constraints.
--   MAINTAIN   - PG 17's VACUUM/ANALYZE/CLUSTER/REINDEX/REFRESH MATERIALIZED VIEW/LOCK
--                TABLE privilege. Autovacuum does not go through it and PostgREST does
--                not issue any of those statements.
--
-- `arwd` is left alone on the other 35 tables on purpose. That is what the 88 policies
-- are written against, and pulling a verb at table level silently disables any policy
-- for it, including one added later by someone who will not think to check the grant.
-- Narrowing it needs a table-by-table argument, which is MEXA-274, not this file.
--
-- The one exception is `reports` UPDATE and DELETE, in section 3 - the single table where
-- the absence of a policy is a documented decision rather than an oversight.

-- =====================================================
-- 1. THE FOUR UNREACHABLE PRIVILEGES, ON EVERY TABLE
-- =====================================================

-- Covers views too (`user_public_profiles` from 00013, if that has been applied). A
-- REVOKE of a privilege the grantee does not hold is a no-op, not an error, so this is
-- idempotent and safe to re-run.
REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN
  ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

-- service_role deliberately keeps everything. It is the Edge Functions and admin
-- scripts, it already bypasses RLS, and it is never handed to a client.

-- =====================================================
-- 2. AND ON EVERY TABLE CREATED FROM NOW ON
-- =====================================================

-- Without this, the next CREATE TABLE in `public` re-grants all four. 00011 works around
-- the same default with a per-table `REVOKE ALL ... FROM PUBLIC, anon, authenticated`
-- followed by an explicit GRANT; this fixes the default itself so that habit only has to
-- cover the verbs a new table actually wants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLES
  FROM anon, authenticated;

-- KNOWN LIMIT, deliberately not worked around.
--
-- `pg_default_acl` holds TWO entries for tables in `public`: one owned by `postgres`,
-- which the statement above fixes, and one owned by `supabase_admin`, which it cannot -
-- the pooler role `postgres.<ref>` is a member of anon, authenticated, service_role,
-- authenticator and supabase_privileged_role, but not of supabase_admin, so
-- `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ...` fails with
-- "permission denied to change default privileges" (checked, MEXA-268).
--
-- A default ACL only applies to objects created by the role that owns it. Every migration
-- here, and the dashboard SQL editor, runs as `postgres`, so the entry that governs our
-- tables is the one we just fixed. The supabase_admin entry would only bite a table
-- created by Supabase's own internal tooling inside `public`, which nothing does. If that
-- ever happens, section 1 re-run is the fix. Do not try to route around it by granting
-- supabase_admin to postgres.

-- =====================================================
-- 3. reports LOSES UPDATE AND DELETE AS WELL
-- =====================================================

-- `reports` has exactly two policies, INSERT and SELECT (00002). There is no UPDATE
-- policy and no DELETE policy, and 00011 is the migration that made that a decision
-- rather than an accident: a report has to survive both people in it, so nothing a client
-- can reach may edit or remove one. Only service_role, which bypasses RLS, may.
--
-- RLS already made both a no-op - as `authenticated`, `UPDATE public.reports` and
-- `DELETE FROM public.reports` returned success affecting 0 rows, because no policy
-- admits any row. So this changes the error, not the outcome: 42501 instead of a silent
-- zero. That is worth having. A table-level grant for a verb with no policy is a loaded
-- gun pointed at whoever writes the next policy on this table, and the failure is silent
-- if it is ever combined with a permissive one.
--
-- Checked before writing this: the only reference to `reports` in the app is
-- `src/api/mutations/useMatch.ts:172`, `supabase.from('reports').insert({...})`. Nothing
-- updates or deletes a report, in `src/` or in `supabase/functions/`.
REVOKE UPDATE, DELETE ON TABLE public.reports FROM PUBLIC, anon, authenticated;

-- `reports` ends at `anon=ar/postgres, authenticated=ar/postgres` - INSERT and SELECT,
-- the exact two verbs its two policies are written for.

-- =====================================================
-- 4. FAIL THE MIGRATION IF ANY OF IT DID NOT TAKE
-- =====================================================

-- A REVOKE that hits nothing is silent, so the only way to know this file did its job is
-- to ask the catalog afterwards. If a future migration re-grants one of these - by
-- creating a table before section 2 has run on a fresh database, say - this raises rather
-- than leaving a quiet hole.
-- `has_table_privilege` rather than `information_schema.role_table_grants`, because
-- information_schema reports only the seven SQL-standard privileges and MAINTAIN is not
-- one of them - it is a PG 17 extension, so it is invisible there and a check built on
-- that view would pass while `m` was still granted. has_table_privilege also folds in
-- anything reachable through PUBLIC or through role membership, which is what we
-- actually care about.
DO $$
DECLARE
  v_rows TEXT;
BEGIN
  SELECT string_agg(t.relname || ' (' || r.role || ':' || p.priv || ')', ', ' ORDER BY t.relname, r.role, p.priv)
    INTO v_rows
    FROM (
      SELECT c.oid, c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
       WHERE c.relkind IN ('r', 'p', 'v', 'm')
    ) t
   CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(role)
   CROSS JOIN (VALUES ('TRUNCATE'), ('TRIGGER'), ('REFERENCES'), ('MAINTAIN')) AS p(priv)
   WHERE has_table_privilege(r.role, t.oid, p.priv);

  IF v_rows IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-268: these table privileges survived the revoke: %', v_rows;
  END IF;

  SELECT string_agg(r.role || ':' || p.priv, ', ' ORDER BY r.role, p.priv)
    INTO v_rows
    FROM (VALUES ('anon'), ('authenticated')) AS r(role)
   CROSS JOIN (VALUES ('UPDATE'), ('DELETE')) AS p(priv)
   WHERE has_table_privilege(r.role, 'public.reports'::regclass, p.priv);

  IF v_rows IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-268: reports still grants %', v_rows;
  END IF;

  -- The default-privileges fix, checked the same way. `D`, `t`, `x` and `m` are TRUNCATE,
  -- TRIGGER, REFERENCES and MAINTAIN in an aclitem; only the postgres-owned entry is
  -- ours to fix, per the note in section 2.
  IF EXISTS (
    SELECT 1
      FROM pg_default_acl d
      JOIN pg_namespace n ON n.oid = d.defaclnamespace
     WHERE n.nspname = 'public'
       AND d.defaclobjtype = 'r'
       AND pg_get_userbyid(d.defaclrole) = 'postgres'
       AND EXISTS (
         SELECT 1 FROM unnest(d.defaclacl) a
          WHERE (a::text LIKE 'anon=%' OR a::text LIKE 'authenticated=%')
            AND split_part(split_part(a::text, '=', 2), '/', 1) ~ '[Dtxm]'
       )
  ) THEN
    RAISE EXCEPTION 'MEXA-268: the postgres default privileges on public still hand out TRUNCATE/TRIGGER/REFERENCES/MAINTAIN';
  END IF;
END;
$$;

COMMENT ON TABLE public.reports IS
  'Moderation reports. anon and authenticated hold INSERT and SELECT only, matching the two '
  'RLS policies (MEXA-268). No UPDATE, DELETE or TRUNCATE from any client role: a report has to '
  'outlive both people in it (MEXA-256/00011), and RLS cannot constrain TRUNCATE.';
