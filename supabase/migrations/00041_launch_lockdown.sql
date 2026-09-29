-- 00041_launch_lockdown.sql  (MEXA-434, Fern, 2026-09-29)
--
-- The last of the pre-launch database lockdown that had no migration yet. Three parts,
-- each small, each closing a finding that was parked on MEXA-426:
--
--   1. Leftover client write grants (MEXA-274). `00016` scoped the client roles' write
--      privileges table by table but left six (table, verb) pairs on `authenticated` that
--      no policy admits for any row. Measured after 00016/00027/00028/00012/00036/00037 in
--      one rolled-back transaction on live: exactly these six, and nothing else:
--        matches               INSERT   - 00017 made check_for_match() SECURITY DEFINER, so
--                                          the trigger no longer needs the client's grant;
--                                          the client never inserts a match itself.
--        shidduch_suggestions  INSERT, UPDATE - SELECT-only policy; the Safta/shidduch
--                                          surface is hidden behind a flag (MEXA-245) and
--                                          its one insert (matchingService.ts) already
--                                          fails 42501 today. This changes the error text,
--                                          not what works.
--        orthodox_emails       INSERT, UPDATE, DELETE - the only write policy is
--                                          `auth.role() = 'service_role'`; service_role
--                                          bypasses RLS and the client registers through
--                                          the DEFINER RPC register_orthodox_email().
--      Revoking a verb no policy admits changes no result a client can observe; it stops
--      the next permissive policy on these tables from going live silently.
--
--   2. swipes.created_at is set by the server (MEXA-409). `authenticated` can INSERT the
--      column, and 00025's undo_last_swipe() trusts it for the 30-second Rewind window, so
--      a future-dated swipe was rewindable forever and pinned "the last swipe". A BEFORE
--      INSERT trigger overwrites whatever the client sent with now(). A trigger rather than
--      a column-grant rescope because it holds for every writer, including a later
--      table-wide GRANT (a column REVOKE cannot cut one - see MIGRATIONS.md).
--      `authenticated` has had no UPDATE on swipes since 00016, so INSERT is the only door.
--
--   3. SECURITY DEFINER functions pinned to `search_path = public` alone (MEXA-379).
--      Postgres searches the caller's temp schema ahead of `public` unless `pg_temp` is
--      named, so a temp table called `users` would steer current_app_user_id() and every
--      policy that calls it. Measured on MEXA-319: `public` alone is attacker-controlled,
--      `public, pg_temp` is not. Not reachable through PostgREST (no DDL), so hardening.
--      00028 does the four notify_* triggers and the three postgis functions; this does
--      the other 28, listed by name below, including 00012's purge_expired_deleted_accounts
--      and 00036's unmatch, so it must run after both. `ALTER FUNCTION ... SET`, not a body
--      rewrite, so no function body changes here.
--      Trap for later files: `CREATE OR REPLACE FUNCTION ... SET search_path = public`
--      overwrites this pin. Section 4d fails this file if any DEFINER in `public` is left on
--      `public` alone, whoever wrote it; re-check the same query after any later apply.
--
-- Order: after 00016, 00012, 00028, 00036 (guards 0a-0d refuse otherwise).
-- Rollback: supabase/rollback/00041_launch_lockdown_rollback.sql names exactly what it
-- restores - the six grants, the trigger, and `search_path=public` on the same 28.

BEGIN;

-- =====================================================
-- 0. GUARDS
-- =====================================================
DO $$
DECLARE
  v_missing text;
BEGIN
  -- 0a. 00016 has scoped the client grants this file finishes.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00016') THEN
    RAISE EXCEPTION 'MEXA-434: 00016 is not in the ledger - apply it first';
  END IF;
  -- 0b. 00012 and 00036 create two of the functions section 3 pins.
  IF to_regprocedure('public.purge_expired_deleted_accounts()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-434: purge_expired_deleted_accounts() is missing - apply 00012 first';
  END IF;
  IF to_regprocedure('public.unmatch(uuid)') IS NULL THEN
    RAISE EXCEPTION 'MEXA-434: unmatch(uuid) is missing - apply 00036 first';
  END IF;
  -- 0c. 00028 has pinned its seven, so section 4d's "none left on public alone" is fair.
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.notify_new_match()'::regprocedure
                  AND proconfig @> ARRAY['search_path=public, pg_temp']) THEN
    RAISE EXCEPTION 'MEXA-434: notify_new_match() is not pinned - apply 00028 first';
  END IF;
  -- 0d. Not already applied.
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00041') THEN
    RAISE EXCEPTION 'MEXA-434: 00041 is already in the ledger';
  END IF;
  IF to_regprocedure('public.swipes_created_at_is_server_time()') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-434: swipes_created_at_is_server_time() already exists';
  END IF;
  -- 0e. Every function section 3 names exists with exactly the pin it replaces.
  SELECT string_agg(sig, ', ') INTO v_missing
    FROM unnest(ARRAY[
      'public.browse_shidduch_profiles(uuid,text,text,integer,integer,text,text,integer,integer)',
      'public.can_safta_add_connection(uuid)',
      'public.can_safta_recommend(uuid)',
      'public.check_for_match()',
      'public.cleanup_old_push_tokens()',
      'public.current_app_user_id()',
      'public.current_shidduch_profile_ids()',
      'public.family_connected_shidduch_profile_ids()',
      'public.get_creator_profile_count(uuid)',
      'public.get_profile_stats(uuid)',
      'public.get_profiles_by_creator(uuid)',
      'public.get_safta_connection_count(uuid)',
      'public.get_safta_daily_recommendations(uuid)',
      'public.get_shidduch_suggestions(uuid)',
      'public.has_block_between(uuid)',
      'public.increment_safta_recommendation(uuid)',
      'public.is_discoverable_profile(uuid)',
      'public.is_orthodox_email(text)',
      'public.manageable_shidduch_profile_ids()',
      'public.owns_safta_account(uuid)',
      'public.purge_expired_deleted_accounts()',
      'public.register_orthodox_email(text,uuid)',
      'public.respond_to_suggestion(uuid,uuid,text,text)',
      'public.send_push_notification(uuid,text,text,jsonb)',
      'public.suggested_shidduch_profile_ids()',
      'public.undo_last_swipe()',
      'public.unmatch(uuid)',
      'public.update_safta_stats()'
    ]) AS sig
   WHERE to_regprocedure(sig) IS NULL
      OR NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure(sig)
                       AND p.prosecdef AND p.proconfig = ARRAY['search_path=public']);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-434: not SECURITY DEFINER with exactly {search_path=public}: % - reconcile before applying', v_missing;
  END IF;
END
$$;

-- =====================================================
-- 1. LEFTOVER CLIENT WRITE GRANTS (MEXA-274)
-- =====================================================
REVOKE INSERT ON TABLE public.matches FROM authenticated;
REVOKE INSERT, UPDATE ON TABLE public.shidduch_suggestions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.orthodox_emails FROM authenticated;

-- =====================================================
-- 2. swipes.created_at IS THE SERVER'S CLOCK (MEXA-409)
-- =====================================================
CREATE FUNCTION public.swipes_created_at_is_server_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.created_at := pg_catalog.now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.swipes_created_at_is_server_time() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER swipes_created_at_is_server_time
  BEFORE INSERT ON public.swipes
  FOR EACH ROW EXECUTE FUNCTION public.swipes_created_at_is_server_time();

-- Anything already future-dated would still pin Rewind; live holds 0 swipes today.
UPDATE public.swipes SET created_at = now() WHERE created_at > now();

-- =====================================================
-- 3. pg_temp LAST ON EVERY REMAINING DEFINER (MEXA-379)
-- =====================================================
ALTER FUNCTION public.browse_shidduch_profiles(uuid,text,text,integer,integer,text,text,integer,integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.can_safta_add_connection(uuid)              SET search_path = public, pg_temp;
ALTER FUNCTION public.can_safta_recommend(uuid)                   SET search_path = public, pg_temp;
ALTER FUNCTION public.check_for_match()                           SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_old_push_tokens()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.current_app_user_id()                       SET search_path = public, pg_temp;
ALTER FUNCTION public.current_shidduch_profile_ids()              SET search_path = public, pg_temp;
ALTER FUNCTION public.family_connected_shidduch_profile_ids()     SET search_path = public, pg_temp;
ALTER FUNCTION public.get_creator_profile_count(uuid)             SET search_path = public, pg_temp;
ALTER FUNCTION public.get_profile_stats(uuid)                     SET search_path = public, pg_temp;
ALTER FUNCTION public.get_profiles_by_creator(uuid)               SET search_path = public, pg_temp;
ALTER FUNCTION public.get_safta_connection_count(uuid)            SET search_path = public, pg_temp;
ALTER FUNCTION public.get_safta_daily_recommendations(uuid)       SET search_path = public, pg_temp;
ALTER FUNCTION public.get_shidduch_suggestions(uuid)              SET search_path = public, pg_temp;
ALTER FUNCTION public.has_block_between(uuid)                     SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_safta_recommendation(uuid)        SET search_path = public, pg_temp;
ALTER FUNCTION public.is_discoverable_profile(uuid)               SET search_path = public, pg_temp;
ALTER FUNCTION public.is_orthodox_email(text)                     SET search_path = public, pg_temp;
ALTER FUNCTION public.manageable_shidduch_profile_ids()           SET search_path = public, pg_temp;
ALTER FUNCTION public.owns_safta_account(uuid)                    SET search_path = public, pg_temp;
ALTER FUNCTION public.purge_expired_deleted_accounts()            SET search_path = public, pg_temp;
ALTER FUNCTION public.register_orthodox_email(text,uuid)          SET search_path = public, pg_temp;
ALTER FUNCTION public.respond_to_suggestion(uuid,uuid,text,text)  SET search_path = public, pg_temp;
ALTER FUNCTION public.send_push_notification(uuid,text,text,jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.suggested_shidduch_profile_ids()            SET search_path = public, pg_temp;
ALTER FUNCTION public.undo_last_swipe()                           SET search_path = public, pg_temp;
ALTER FUNCTION public.unmatch(uuid)                               SET search_path = public, pg_temp;
ALTER FUNCTION public.update_safta_stats()                        SET search_path = public, pg_temp;

-- =====================================================
-- 4. LEDGER + ASSERTIONS
-- =====================================================
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00041', 'launch_lockdown')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_bad text;
BEGIN
  -- 4a. The six pairs are gone - no table grant and no column grant left behind either.
  SELECT string_agg(t || ':' || v, ', ') INTO v_bad
    FROM (VALUES ('matches','INSERT'), ('shidduch_suggestions','INSERT'), ('shidduch_suggestions','UPDATE'),
                 ('orthodox_emails','INSERT'), ('orthodox_emails','UPDATE'), ('orthodox_emails','DELETE')) x(t, v)
   WHERE has_table_privilege('authenticated', ('public.' || t)::regclass, v)
      OR (v <> 'DELETE' AND EXISTS (
            SELECT 1 FROM pg_attribute a
             WHERE a.attrelid = ('public.' || t)::regclass AND a.attnum > 0 AND NOT a.attisdropped
               AND has_column_privilege('authenticated', a.attrelid, a.attnum, v)));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-434: authenticated still holds %', v_bad;
  END IF;

  -- 4b. The app's own writes still work: the verbs this file must not have touched.
  SELECT string_agg(t || ':' || v, ', ') INTO v_bad
    -- (matches UPDATE is not listed: 00036 narrowed it to a column grant on purpose.)
    FROM (VALUES ('swipes','INSERT'), ('matches','SELECT'),
                 ('shidduch_suggestions','SELECT'), ('orthodox_emails','SELECT')) x(t, v)
   WHERE NOT has_table_privilege('authenticated', ('public.' || t)::regclass, v);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-434: authenticated lost % - this file revokes only the six pairs', v_bad;
  END IF;

  -- 4c. The trigger is there, BEFORE INSERT, enabled.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid = 'public.swipes'::regclass
                    AND tgname = 'swipes_created_at_is_server_time'
                    AND tgenabled = 'O'
                    AND tgfoid = 'public.swipes_created_at_is_server_time()'::regprocedure) THEN
    RAISE EXCEPTION 'MEXA-434: swipes_created_at_is_server_time trigger is missing or disabled';
  END IF;
  IF has_table_privilege('authenticated', 'public.swipes', 'UPDATE')
     OR EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = 'public.swipes'::regclass
                  AND a.attname = 'created_at' AND has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE')) THEN
    RAISE EXCEPTION 'MEXA-434: authenticated can UPDATE swipes.created_at, so the trigger is not the only door';
  END IF;

  -- 4d. No SECURITY DEFINER in public is left with a search_path that lets pg_temp win:
  --     either it names pg_temp last, or it is empty ("" - every name qualified).
  SELECT string_agg(p.oid::regprocedure::text || '=' || coalesce(array_to_string(p.proconfig, ','), 'NULL'), '; ')
    INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c
                      WHERE c = 'search_path=""' OR c LIKE 'search_path=%, pg\_temp');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-434: SECURITY DEFINER functions whose search_path lets pg_temp shadow: %', v_bad;
  END IF;

  -- 4e. The ledger row.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00041') THEN
    RAISE EXCEPTION 'MEXA-434: ledger row 00041 is missing';
  END IF;
END
$$;

COMMIT;
