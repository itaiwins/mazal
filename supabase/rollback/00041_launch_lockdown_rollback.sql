-- 00041_launch_lockdown_rollback.sql  (MEXA-434)
--
-- Undoes 00041 and nothing else. Names what it restores (no skip lists):
--   1. the six `authenticated` table grants 00041 revoked;
--   2. the swipes created_at trigger and its function;
--   3. `search_path = public` on the same 28 functions - exactly the pin they had before.
-- It does not touch 00028's seven, 00012, 00016, 00036 or 00037.
-- Section 3 re-opens the pg_temp shadowing MEXA-379 describes; that is the point of an
-- undo, and it is hardening-grade (no DDL reaches a client through PostgREST).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00041') THEN
    RAISE EXCEPTION 'MEXA-434 rollback: 00041 is not in the ledger - nothing to undo';
  END IF;
END
$$;

-- 1.
GRANT INSERT ON TABLE public.matches TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.shidduch_suggestions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.orthodox_emails TO authenticated;

-- 2.
DROP TRIGGER swipes_created_at_is_server_time ON public.swipes;
DROP FUNCTION public.swipes_created_at_is_server_time();

-- 3.
ALTER FUNCTION public.browse_shidduch_profiles(uuid,text,text,integer,integer,text,text,integer,integer) SET search_path = public;
ALTER FUNCTION public.can_safta_add_connection(uuid)              SET search_path = public;
ALTER FUNCTION public.can_safta_recommend(uuid)                   SET search_path = public;
ALTER FUNCTION public.check_for_match()                           SET search_path = public;
ALTER FUNCTION public.cleanup_old_push_tokens()                   SET search_path = public;
ALTER FUNCTION public.current_app_user_id()                       SET search_path = public;
ALTER FUNCTION public.current_shidduch_profile_ids()              SET search_path = public;
ALTER FUNCTION public.family_connected_shidduch_profile_ids()     SET search_path = public;
ALTER FUNCTION public.get_creator_profile_count(uuid)             SET search_path = public;
ALTER FUNCTION public.get_profile_stats(uuid)                     SET search_path = public;
ALTER FUNCTION public.get_profiles_by_creator(uuid)               SET search_path = public;
ALTER FUNCTION public.get_safta_connection_count(uuid)            SET search_path = public;
ALTER FUNCTION public.get_safta_daily_recommendations(uuid)       SET search_path = public;
ALTER FUNCTION public.get_shidduch_suggestions(uuid)              SET search_path = public;
ALTER FUNCTION public.has_block_between(uuid)                     SET search_path = public;
ALTER FUNCTION public.increment_safta_recommendation(uuid)        SET search_path = public;
ALTER FUNCTION public.is_discoverable_profile(uuid)               SET search_path = public;
ALTER FUNCTION public.is_orthodox_email(text)                     SET search_path = public;
ALTER FUNCTION public.manageable_shidduch_profile_ids()           SET search_path = public;
ALTER FUNCTION public.owns_safta_account(uuid)                    SET search_path = public;
ALTER FUNCTION public.purge_expired_deleted_accounts()            SET search_path = public;
ALTER FUNCTION public.register_orthodox_email(text,uuid)          SET search_path = public;
ALTER FUNCTION public.respond_to_suggestion(uuid,uuid,text,text)  SET search_path = public;
ALTER FUNCTION public.send_push_notification(uuid,text,text,jsonb) SET search_path = public;
ALTER FUNCTION public.suggested_shidduch_profile_ids()            SET search_path = public;
ALTER FUNCTION public.undo_last_swipe()                           SET search_path = public;
ALTER FUNCTION public.unmatch(uuid)                               SET search_path = public;
ALTER FUNCTION public.update_safta_stats()                        SET search_path = public;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00041';

DO $$
DECLARE
  v_n int;
BEGIN
  IF NOT (has_table_privilege('authenticated', 'public.matches', 'INSERT')
      AND has_table_privilege('authenticated', 'public.shidduch_suggestions', 'INSERT')
      AND has_table_privilege('authenticated', 'public.shidduch_suggestions', 'UPDATE')
      AND has_table_privilege('authenticated', 'public.orthodox_emails', 'INSERT')
      AND has_table_privilege('authenticated', 'public.orthodox_emails', 'UPDATE')
      AND has_table_privilege('authenticated', 'public.orthodox_emails', 'DELETE')) THEN
    RAISE EXCEPTION 'MEXA-434 rollback: a grant was not restored';
  END IF;
  -- anon stays shut: this file grants nothing to anon, and 00016 must still hold.
  IF has_table_privilege('anon', 'public.matches', 'INSERT')
     OR has_table_privilege('anon', 'public.orthodox_emails', 'INSERT') THEN
    RAISE EXCEPTION 'MEXA-434 rollback: anon holds a grant on a restored table';
  END IF;
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef AND p.proconfig = ARRAY['search_path=public'];
  IF v_n <> 28 THEN
    RAISE EXCEPTION 'MEXA-434 rollback: expected 28 DEFINER functions back on search_path=public, found %', v_n;
  END IF;
END
$$;

COMMIT;
