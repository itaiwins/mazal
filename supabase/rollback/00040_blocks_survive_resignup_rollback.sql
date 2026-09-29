-- ROLLBACK for 00040_blocks_survive_resignup.sql  (MEXA-435 item 3)
--
-- Puts record_deleted_account() back to the body measured live before 00040 (00011 as
-- amended by MEXA-262; pg_get_functiondef output, verbatim, 2026-09-29) and removes
-- everything 00040 created. Afterwards: only reported accounts leave a tombstone, blocks die
-- on re-signup again, and a moderator's hold does nothing.
--
-- DATA LOSS: dropping deleted_account_blockers and account_reentry_events deletes the blocker
-- snapshots and the re-entry review queue. Block-only tombstones (reports_against_count = 0)
-- are deleted too, since pre-00040 they could not exist and the privacy text promises none.
-- Copy those tables out first if any row matters.

BEGIN;

SELECT cron.unschedule('block-only-tombstone-retention')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'block-only-tombstone-retention');

DROP TRIGGER IF EXISTS users_restore_on_reentry ON public.users;
DROP TRIGGER IF EXISTS users_refuse_held_reentry ON public.users;
DROP FUNCTION IF EXISTS public.restore_on_reentry();
DROP FUNCTION IF EXISTS public.refuse_held_reentry();
DROP FUNCTION IF EXISTS public.reentry_matches(UUID);
DROP FUNCTION IF EXISTS public.purge_expired_block_only_tombstones();

DROP TABLE IF EXISTS public.account_reentry_events;
DROP TABLE IF EXISTS public.deleted_account_blockers;

DELETE FROM public.deleted_accounts WHERE reports_against_count = 0;

CREATE OR REPLACE FUNCTION public.record_deleted_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_total INTEGER;
  v_open INTEGER;
  v_email TEXT;
  v_phone TEXT;
  v_source TEXT := 'auth';
BEGIN
  SELECT pg_catalog.count(*),
         pg_catalog.count(*) FILTER (WHERE status IN ('pending', 'reviewed'))
    INTO v_total, v_open
    FROM public.reports
   WHERE reported_id = OLD.id;

  -- Nobody reported this account. Deleting it should leave nothing behind.
  IF v_total = 0 THEN
    RETURN OLD;
  END IF;

  -- The identifiers come from `auth.users`, NOT from `public.users` (MEXA-259, M1).
  -- `authenticated` holds UPDATE on public.users.email and .phone, and the 00002 policy
  -- "Users can update own profile" puts no column limit on it. Hashing the profile
  -- columns would let the reported user rewrite their own email to junk one request
  -- before deleting - or, worse, to an innocent third party's address, framing them once
  -- MEXA-258 starts refusing signups. The auth row is the identifier the account is
  -- really reachable at, and only a verified Supabase Auth flow can change it.
  --
  -- The Edge Function deletes public.users first and calls auth.admin.deleteUser after,
  -- so on the real path this row is still here. On a cascade that starts at auth.users
  -- it is already gone, hence the fallback. Section 6 closes the rewrite hole as well,
  -- so the fallback is not a way back in.
  --
  -- The fallback is on the auth ROW being missing, not on a single column being NULL.
  -- `coalesce(v_email, OLD.email)` would look equivalent and is not: auth.users.email is
  -- nullable, so an account that signed up by phone has an auth row with no email, and
  -- coalesce would reach for the profile email - the one column the framing case in
  -- MEXA-259 needs, because a client picks it at INSERT ("Users can create own profile"
  -- is WITH CHECK (auth.uid() = auth_id), no column limit, and section 6 guards UPDATE
  -- only). Verified on the live DB: with coalesce, a phone-signup account that put a
  -- third party's address on its profile produced a tombstone hashing that third party.
  -- No email to hash is the honest answer, and email_hash is nullable for it. Phone
  -- signup is switched off today (external_phone_enabled = false) but the screen is
  -- built - app/(auth)/phone-verify.tsx - so this would open on the day it is enabled.
  SELECT email, phone INTO v_email, v_phone FROM auth.users WHERE id = OLD.auth_id;

  IF NOT FOUND THEN
    v_email := OLD.email;
    v_phone := OLD.phone;
    v_source := 'profile';
  END IF;

  INSERT INTO public.deleted_accounts (
    user_id, auth_id, email_hash, phone_hash, identifier_source, display_name,
    account_created_at, reports_against_count, open_reports_against_count
  )
  VALUES (
    OLD.id,
    OLD.auth_id,
    -- Both return NULL for a blank identifier, which is what makes an account with no
    -- email (or a profile row holding '') deletable instead of failing on NOT NULL.
    public.hash_account_identifier(v_email),
    public.hash_account_identifier(v_phone),
    v_source,
    -- A hint for a moderator, not an identifier: the user can rename themselves right
    -- before deleting. user_id is the key (MEXA-259).
    OLD.display_name,
    OLD.created_at,
    v_total,
    v_open
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_deleted_account() FROM PUBLIC, anon, authenticated;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00040';

COMMIT;
