-- Rollback for 00014_revoke_unreachable_table_privileges.sql (MEXA-268).
--
-- This file puts back privileges that nothing can legitimately use. Run it only if the
-- revoke actually broke something, and say on MEXA-268 what broke - "the app stopped
-- working" after 00014 almost certainly means something is talking to Postgres as `anon`
-- or `authenticated` over a direct connection, which is a finding in its own right and
-- not a reason to re-grant.
--
-- The pre-migration state this restores is recorded in
-- .scratch/mazal-mexa268/PRE_00014_ACL_SNAPSHOT.sql: every table in `public` held
-- `anon=arwdDxtm` and `authenticated=arwdDxtm`, and `pg_default_acl` handed the same set
-- to every new table.
--
-- NOT A BLANKET GRANT, ON PURPOSE.
--
-- `GRANT ... ON ALL TABLES IN SCHEMA public` would also re-open tables that other
-- migrations locked down deliberately, and it would do it silently:
--
--   public.users                 00013 - REVOKE ALL FROM anon, and TRUNCATE/TRIGGER/
--                                        REFERENCES/DELETE FROM authenticated
--   public.user_integrations     00013 - service_role only
--   public.user_public_profiles  00013 - SELECT to authenticated only (a view)
--   public.deleted_accounts      00011 - service_role only
--   public.moderation_secrets    00011 - service_role only
--   public.reports               00011/MEXA-256 - a report has to outlive both people in
--                                it, so no client role may wipe the table. Added to this
--                                list by Alucard's review, MEXA-275: the first draft of
--                                this file made that argument in its own header and then
--                                handed `TRUNCATE reports` straight back in the loop.
--
-- So the loop below skips those six by name. If a later migration adds another table that
-- is meant to stay closed, add it to the list in the same breath as writing it.
--
-- DELIBERATE ASYMMETRIES. The skip list is unconditional, so this is not a bit-exact
-- inverse of the migration, in two places:
--
--   - `reports` never gets TRUNCATE, TRIGGER, REFERENCES or MAINTAIN back at all, for the
--     reason above. It does get UPDATE and DELETE back, at the bottom of this file - those
--     were already no-ops under RLS, so that restores an ACL and not a capability.
--   - `users` and `user_integrations` keep the narrower ACL even if 00013 has NOT been
--     applied, in which case they end up tighter than they were before 00014.
--
-- That is the right trade in every one of those cases: these four are the privileges
-- nothing can reach, `users` is the table a `TRUNCATE ... CASCADE` takes the whole
-- database down through (measured: it cascades to nine more tables), and re-granting them
-- cannot fix whatever this rollback is being run for. If you genuinely need the exact
-- pre-00014 ACL back - to reproduce something, say - run these by hand, and say on
-- MEXA-268 that you did:
--
--   GRANT TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLE public.users             TO anon, authenticated;
--   GRANT TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLE public.user_integrations TO anon, authenticated;
--   GRANT TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLE public.reports           TO anon, authenticated;

DO $$
DECLARE
  v_skip TEXT[] := ARRAY[
    'users',
    'user_integrations',
    'user_public_profiles',
    'deleted_accounts',
    'moderation_secrets',
    'reports'
  ];
  v_rel TEXT;
BEGIN
  FOR v_rel IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE c.relkind IN ('r', 'p', 'v', 'm')
       AND NOT (c.relname = ANY (v_skip))
     ORDER BY c.relname
  LOOP
    EXECUTE format(
      'GRANT TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLE public.%I TO anon, authenticated',
      v_rel
    );
  END LOOP;
END;
$$;

-- Section 3 of the migration: reports gets UPDATE and DELETE back. Both were no-ops for
-- clients even before 00014 - `reports` has no UPDATE and no DELETE policy, so RLS
-- admitted zero rows - so this restores the ACL, not any capability.
GRANT UPDATE, DELETE ON TABLE public.reports TO anon, authenticated;

-- Section 4's comment. `reports` had no table comment before 00014; 00011 sets comments
-- on reporter_id and reported_id and those are not touched here.
COMMENT ON TABLE public.reports IS NULL;

-- Section 2: the default privileges. Restores Supabase's stock behaviour, so the next
-- CREATE TABLE in `public` again hands all eight privileges to anon and authenticated.
-- Only the postgres-owned entry was ever changed; the supabase_admin one could not be
-- touched and so needs nothing here (see the migration's section 2 note).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLES
  TO anon, authenticated;

-- Verify the rollback landed, so it does not fail quietly the way the revoke could.
DO $$
DECLARE
  v_n INTEGER;
BEGIN
  SELECT count(DISTINCT table_name) INTO v_n
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND grantee = 'authenticated'
     AND privilege_type = 'TRUNCATE';

  RAISE NOTICE 'MEXA-268 rollback: % tables in public now grant TRUNCATE to authenticated', v_n;

  IF v_n = 0 THEN
    RAISE EXCEPTION 'MEXA-268 rollback did nothing - no table grants TRUNCATE to authenticated';
  END IF;
END;
$$;
