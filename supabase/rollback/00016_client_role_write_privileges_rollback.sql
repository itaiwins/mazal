-- Rollback for 00016_client_role_write_privileges.sql (MEXA-274).
--
-- Run this only if the revoke actually broke something, and say on MEXA-274 what broke.
-- Every privilege this file restores was measured to be a no-op before 00016: RLS already
-- admitted zero rows for it, or `anon` already read nothing through it. So "the app broke
-- after 00016" almost certainly means one of three things, none of which this file fixes:
--
--   1. A request is reaching PostgREST with the anon key and no user JWT. That is bug (a)
--      in 00016 section 1 - the directApi.ts token-read fallback - and the answer is to
--      make it fail as "not signed in", not to re-grant anon.
--   2. Something is talking to Postgres directly as `anon` or `authenticated`. Supabase
--      issues no password for either role, so that would be a finding in its own right.
--   3. A verb this file revoked did have a policy after all, which would mean the
--      pg_policies walk behind MEXA-274 was wrong. If so, fix the one table, do not run
--      the whole rollback.
--
-- PARTIAL ROLLBACK IS USUALLY THE RIGHT ANSWER. The sections below are independent and in
-- increasing order of how much they give back. Run the smallest one that unblocks you:
--
--   Section A - one table's verb back (edit and run a single GRANT).
--   Section B - `authenticated` gets section 3 of the migration back.
--   Section C - `anon` gets section 1 back. This is the one to think hardest about.
--   Section D - notification_queue back to the stock everybody-grants shape.
--   Section E - sequences.
--   Section F - the table comments.
--
-- WHAT THIS DOES NOT RESTORE. 00016 ran after 00014, and 00014 already took TRUNCATE,
-- TRIGGER, REFERENCES and MAINTAIN away from both roles. Section C below re-grants
-- `anon` only the four verbs RLS can constrain - INSERT, SELECT, UPDATE, DELETE - not
-- those four. Undoing 00014 is 00014's own rollback file, deliberately separate. Running
-- both in order (00016's then 00014's) gets back to the pre-00014 ACL.

-- ===================================================================================
-- SECTION A - one verb on one table
-- ===================================================================================
-- Nothing runs here. Copy the shape, name the table and verb, and say why on MEXA-274.
--
--   GRANT DELETE ON TABLE public.swipes TO authenticated;

-- ===================================================================================
-- SECTION B - `authenticated`: undo section 3 of the migration
-- ===================================================================================
GRANT INSERT, UPDATE, DELETE ON TABLE public.colleges           TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.community_settings TO authenticated;
GRANT INSERT, DELETE         ON TABLE public.shadchanim         TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.subscriptions      TO authenticated;
GRANT UPDATE, DELETE ON TABLE public.swipes                 TO authenticated;
GRANT UPDATE, DELETE ON TABLE public.shidduch_profile_views TO authenticated;
GRANT UPDATE         ON TABLE public.blocks                 TO authenticated;
GRANT DELETE ON TABLE public.matches           TO authenticated;
GRANT DELETE ON TABLE public.safta_accounts    TO authenticated;
GRANT DELETE ON TABLE public.shidduch_profiles TO authenticated;
GRANT DELETE ON TABLE public.users             TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.family_connections TO authenticated;
GRANT DELETE ON TABLE public.notification_preferences TO authenticated;
GRANT DELETE ON TABLE public.safta_connections        TO authenticated;
GRANT DELETE ON TABLE public.safta_daily_usage        TO authenticated;
GRANT DELETE ON TABLE public.safta_likes              TO authenticated;
GRANT DELETE ON TABLE public.safta_messages           TO authenticated;
GRANT DELETE ON TABLE public.shadchan_connections     TO authenticated;
GRANT DELETE ON TABLE public.shadchan_recommendations TO authenticated;
GRANT DELETE ON TABLE public.shidduch_suggestions     TO authenticated;
GRANT DELETE ON TABLE public.messages                 TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.shidduch_messages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.user_safta_stats  TO authenticated;

-- `public.users` DELETE is above. Note that 00013, if applied, revokes far more from
-- `users` than 00016 did; this line re-grants only the one verb 00016 took.

-- ===================================================================================
-- SECTION C - `anon`: undo section 1 of the migration
-- ===================================================================================
--
-- READ THIS BEFORE RUNNING IT. Section 1 was the strongest part of 00016 and the least
-- likely to be what broke you: measured live, `anon` could already read nothing from
-- `users` and could not insert into it. The only thing this section actually gives back
-- is unauthenticated read access to `colleges`, `user_badges` and `user_safta_stats`,
-- through their `USING (true) TO public` SELECT policies - i.e. to anyone holding the
-- anon key, which ships in every app binary.
--
-- NOT A BLANKET GRANT, for the same reason as 00014's rollback: some tables are closed to
-- anon by other migrations and must stay closed.
--
--   public.users                 00013 - REVOKE ALL FROM anon
--   public.user_integrations     00013 - service_role only
--   public.user_public_profiles  00013 - authenticated only (a view)
--   public.deleted_accounts      00011 - service_role only
--   public.moderation_secrets    00011 - service_role only
--   public.notification_queue    00016 section 2 - service_role only, see section D
--   public.user_colleges         00019 - REVOKE ALL FROM anon (MEXA-289)
--   public.user_safta_stats      00019 - REVOKE ALL FROM anon (MEXA-289)
--
-- If a later migration closes another table to anon, add it here in the same breath.
--
-- The two 00019 entries also make the paragraph above narrower than it was written:
-- `user_safta_stats` no longer has a `USING (true) TO public` SELECT policy, and neither does
-- `user_badges` once 00015_prompts_badges_visibility lands (MEXA-277). The only thing this
-- section still hands back to unauthenticated callers is `colleges`, a reference table of
-- school names, which is deliberate.
--
-- The skip list is unconditional, so running this while 00013 has NOT been applied leaves
-- `public.users` closed to anon rather than restoring the grant 00016 took. Same deliberate
-- asymmetry as 00014's rollback, and the same reasoning: `users` is the table worth keeping
-- shut, and re-opening it cannot fix whatever this rollback is being run for. If you truly
-- need the exact pre-00016 ACL, run the one statement by hand:
--
--   GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.users TO anon;
-- `reports` is a second, narrower kind of exception: it is not skipped, but it must get
-- back exactly INSERT and SELECT, because 00014 section 3 took UPDATE and DELETE away from
-- both client roles on purpose - a report has to outlive both people in it (MEXA-256/00011).
-- A flat four-verb re-grant here would hand `anon` more than it had before 00016 and
-- silently undo part of 00014. Verified: without this branch, `reports` came back as
-- `anon=arwd, authenticated=ar`, which is worse than the state this file is restoring.
-- Alucard caught the same shape in 00014's own rollback (MEXA-275).
DO $$
DECLARE
  v_skip TEXT[] := ARRAY[
    'users',
    'user_integrations',
    'user_public_profiles',
    'deleted_accounts',
    'moderation_secrets',
    'notification_queue',
    'user_colleges',
    'user_safta_stats'
  ];
  v_insert_select_only TEXT[] := ARRAY['reports'];
  v_rel TEXT;
BEGIN
  FOR v_rel IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE c.relkind IN ('r','p','v','m')
       AND NOT (c.relname = ANY (v_skip))
     ORDER BY c.relname
  LOOP
    IF v_rel = ANY (v_insert_select_only) THEN
      EXECUTE format('GRANT INSERT, SELECT ON TABLE public.%I TO anon', v_rel);
    ELSE
      EXECUTE format('GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.%I TO anon', v_rel);
    END IF;
  END LOOP;
END;
$$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT INSERT, SELECT, UPDATE, DELETE ON TABLES TO anon;

-- ===================================================================================
-- SECTION D - notification_queue back to the stock shape
-- ===================================================================================
--
-- Only run this if something genuinely needs a client role to reach the push queue, which
-- would be a design change worth its own issue. service_role keeps everything either way,
-- so the Edge Function and the notify_* triggers do not need this.
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.notification_queue TO anon, authenticated;

-- ===================================================================================
-- SECTION E - sequences
-- ===================================================================================
--
-- There are no sequences in `public`, so the first statement is a no-op and only the
-- default-privileges line has any effect: it puts back Supabase's stock `anon=rwU` on
-- every sequence created from then on. Nothing can need this today - run it only to get a
-- bit-exact pre-00016 catalog, e.g. to reproduce something.
GRANT SELECT, UPDATE, USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO anon;

-- ===================================================================================
-- SECTION F - the table comments
-- ===================================================================================
--
-- None of these tables had a comment before 00016. 00011 and 00014 set comments on other
-- objects (reports and its columns); nothing here touches those.
COMMENT ON TABLE public.notification_queue IS NULL;
COMMENT ON TABLE public.subscriptions      IS NULL;
COMMENT ON TABLE public.swipes             IS NULL;
COMMENT ON TABLE public.matches            IS NULL;
COMMENT ON TABLE public.messages           IS NULL;
COMMENT ON TABLE public.user_safta_stats   IS NULL;
COMMENT ON TABLE public.shidduch_messages  IS NULL;
COMMENT ON TABLE public.colleges           IS NULL;
COMMENT ON TABLE public.user_badges        IS NULL;

-- ===================================================================================
-- VERIFY THE ROLLBACK LANDED
-- ===================================================================================
-- A GRANT that hits nothing is as silent as a REVOKE that hits nothing.
DO $$
DECLARE
  v_anon INTEGER;
  v_auth INTEGER;
BEGIN
  SELECT count(*) INTO v_anon
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   WHERE c.relkind IN ('r','p','v','m') AND has_table_privilege('anon', c.oid, 'SELECT');

  SELECT count(*) INTO v_auth
    FROM (VALUES ('public.swipes'),('public.messages'),('public.matches'),
                 ('public.subscriptions'),('public.user_safta_stats')) AS t(rel)
   WHERE has_table_privilege('authenticated', t.rel::regclass, 'DELETE');

  RAISE NOTICE 'MEXA-274 rollback: anon can SELECT % tables in public; % of 5 sample tables grant DELETE to authenticated', v_anon, v_auth;

  IF v_anon = 0 THEN
    RAISE EXCEPTION 'MEXA-274 rollback section C did nothing - anon still holds SELECT on no table';
  END IF;
  IF v_auth < 5 THEN
    RAISE EXCEPTION 'MEXA-274 rollback section B is incomplete - only % of 5 sample tables grant DELETE to authenticated', v_auth;
  END IF;

  -- And that undoing 00016 did not undo any of 00014 along the way. `reports` is the one
  -- table where the two files overlap.
  IF has_table_privilege('anon', 'public.reports'::regclass, 'UPDATE')
     OR has_table_privilege('anon', 'public.reports'::regclass, 'DELETE')
     OR has_table_privilege('authenticated', 'public.reports'::regclass, 'UPDATE')
     OR has_table_privilege('authenticated', 'public.reports'::regclass, 'DELETE') THEN
    RAISE EXCEPTION 'MEXA-274 rollback re-opened reports UPDATE/DELETE, which 00014 closed on purpose (MEXA-256)';
  END IF;
  IF has_table_privilege('anon', 'public.messages'::regclass, 'TRUNCATE') THEN
    RAISE EXCEPTION 'MEXA-274 rollback re-granted TRUNCATE, which is 00014''s to undo, not this file''s';
  END IF;
END;
$$;
