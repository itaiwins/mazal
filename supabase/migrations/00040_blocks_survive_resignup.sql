-- Mazal - Blocks survive a delete-and-sign-up-again; a moderator's hold is enforced only
-- once the address is proven
--
-- MEXA-435 item 3 (was MEXA-258, MEXA-381). Rollback: supabase/rollback/00040_blocks_survive_resignup_rollback.sql
-- Requires: 00011 (deleted_accounts, hash_account_identifier, the users_record_deletion
-- trigger), applied live.
--
-- SUPERSEDES 00029, WHICH MUST NOT BE APPLIED. 00029 was never applied. This file keeps
-- its sections 1-4 (blocker snapshot, re-entry queue, silent restore) and changes three
-- things:
--
--   1. No before-user-created auth hook. A refusal that runs before GoTrue has proven the
--      address is an enumeration oracle: with confirmations on, GoTrue answers every other
--      signup identically, so a 403 for held addresses alone says "this address is banned",
--      whatever the message reads (Guts, MEXA-380). The hold is enforced below, on the
--      profile INSERT, which needs a session, and only when auth.users says the matching
--      address or phone is confirmed. Only the owner of the address can ever see the refusal.
--
--   2. A block alone now leaves a tombstone (MEXA-381). Before, only a REPORTED account did,
--      so "A blocks B, B deletes, B signs up again" handed B back access to A. A block-only
--      tombstone holds the hashes and the blocker list, and NO display_name: nobody is
--      reviewing a report, so nobody needs to know who it was.
--
--   3. Block-only tombstones get their own retention: purged 12 months after deletion
--      (the same horizon 00012 gives a record whose reports were all dismissed), by a daily
--      job this file schedules, so it does not depend on 00012 being applied.
--
-- WHAT THE KEY IS
--
-- Every identifier is read from auth.users, never from public.users, both when the
-- tombstone is written and when a new account is matched against it. public.users.email
-- and .phone are client-written columns; a user could rewrite them before deleting to dodge
-- the tombstone, or put somebody else's address on it (MEXA-259). auth.users only changes
-- through a verified Supabase Auth flow.
--
-- PRIVACY WORDING CHANGES WITH THIS: app/legal/privacy.tsx said "If nobody ever reported
-- your account, no safety record is created". Updated in the same commit; Itai reviews it
-- before it ships.

BEGIN;

-- =====================================================
-- 0. PRECONDITIONS
-- =====================================================
DO $$
BEGIN
  IF to_regclass('public.deleted_accounts') IS NULL
     OR to_regprocedure('public.hash_account_identifier(text)') IS NULL
     OR to_regprocedure('public.record_deleted_account()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-435: apply 00011 first';
  END IF;
  -- 00029's hook may be wired into the auth config; dropping it here would break signup, and
  -- keeping it keeps the oracle. A human has to unwire it first.
  IF to_regprocedure('public.before_user_created_hook(jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-435: 00029 is applied (before_user_created_hook exists). Disable the auth hook, drop the function, then apply 00040';
  END IF;
END
$$;

-- =====================================================
-- 1. WHO BLOCKED THE ACCOUNT (00029 section 1, unchanged)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.deleted_account_blockers (
  deleted_account_id UUID NOT NULL
    REFERENCES public.deleted_accounts(id) ON DELETE CASCADE,
  -- A block is a preference held by a live person; it dies with the person who held it.
  blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_at TIMESTAMPTZ,
  PRIMARY KEY (deleted_account_id, blocker_id)
);

CREATE INDEX IF NOT EXISTS idx_deleted_account_blockers_blocker
  ON public.deleted_account_blockers(blocker_id);

ALTER TABLE public.deleted_account_blockers ENABLE ROW LEVEL SECURITY;
-- No policies: service_role only. The REVOKE matters - Supabase's default privileges grant
-- CRUD on every new public table to anon and authenticated.
REVOKE ALL ON TABLE public.deleted_account_blockers FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.deleted_account_blockers TO service_role;

COMMENT ON TABLE public.deleted_account_blockers IS
  'Who had blocked an account when it was deleted (MEXA-258/435). Re-applied to the new users.id if '
  'that person signs up again. service_role only - no RLS policy exists, by design.';

-- =====================================================
-- 2. WRITE THE TOMBSTONE ON A REPORT OR A BLOCK
-- =====================================================
-- Replaces 00011's body. Unchanged from 00011 except: the early return now needs no report
-- AND no block; display_name is kept only when there was a report; the blockers are recorded.
CREATE OR REPLACE FUNCTION public.record_deleted_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total INTEGER;
  v_open INTEGER;
  v_blocked BOOLEAN;
  v_email TEXT;
  v_phone TEXT;
  v_source TEXT := 'auth';
  v_tombstone_id UUID;
BEGIN
  SELECT pg_catalog.count(*),
         pg_catalog.count(*) FILTER (WHERE status IN ('pending', 'reviewed'))
    INTO v_total, v_open
    FROM public.reports
   WHERE reported_id = OLD.id;

  v_blocked := EXISTS (SELECT 1 FROM public.blocks b WHERE b.blocked_id = OLD.id);

  -- Nobody reported this account and nobody blocked it. Deleting it leaves nothing behind.
  IF v_total = 0 AND NOT v_blocked THEN
    RETURN OLD;
  END IF;

  -- From auth.users, NOT public.users (MEXA-259, M1): the profile columns are client-written.
  -- The fallback is on the auth ROW being missing (a delete that starts at auth.users
  -- reaches public.users second), not on a NULL column.
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
    public.hash_account_identifier(v_email),
    public.hash_account_identifier(v_phone),
    v_source,
    -- A moderator reviewing a report needs to know who it was; a block-only record does not.
    CASE WHEN v_total > 0 THEN OLD.display_name END,
    OLD.created_at,
    v_total,
    v_open
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_tombstone_id;

  IF v_tombstone_id IS NULL THEN
    SELECT id INTO v_tombstone_id FROM public.deleted_accounts WHERE user_id = OLD.id;
  END IF;

  INSERT INTO public.deleted_account_blockers (deleted_account_id, blocker_id, blocked_at)
  SELECT v_tombstone_id, b.blocker_id, b.created_at
    FROM public.blocks b
   WHERE b.blocked_id = OLD.id
  ON CONFLICT (deleted_account_id, blocker_id) DO NOTHING;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.record_deleted_account() FROM PUBLIC, anon, authenticated;

-- =====================================================
-- 3. THE RE-ENTRY RECORD (00029 section 3, unchanged)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.account_reentry_events (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  new_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  deleted_account_id UUID NOT NULL
    REFERENCES public.deleted_accounts(id) ON DELETE CASCADE,
  matched_on TEXT NOT NULL CHECK (matched_on IN ('email', 'phone')),
  identifier_source TEXT NOT NULL CHECK (identifier_source IN ('auth', 'profile')),
  blocks_restored INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_note TEXT,
  UNIQUE (new_user_id, deleted_account_id)
);

CREATE INDEX IF NOT EXISTS idx_reentry_unreviewed
  ON public.account_reentry_events(created_at) WHERE reviewed_at IS NULL;

ALTER TABLE public.account_reentry_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_reentry_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.account_reentry_events TO service_role;

COMMENT ON TABLE public.account_reentry_events IS
  'One row per new account that matched a tombstone (MEXA-258/435). The review queue; no admin UI yet. '
  'service_role only - the user must not be able to tell their new account was recognised.';

-- =====================================================
-- 4. WHICH TOMBSTONES A NEW PROFILE MATCHES
-- =====================================================
-- Only identifiers auth.users says are CONFIRMED count. With confirmations on, a profile
-- row cannot be created without a confirmed session anyway; this makes the rule hold even
-- if autoconfirm is ever switched on, so nobody can inherit (or trip) a tombstone by typing
-- someone else's address.
CREATE OR REPLACE FUNCTION public.reentry_matches(p_auth_id UUID)
RETURNS TABLE (deleted_account_id UUID, matched_on TEXT, identifier_source TEXT, moderation_hold BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH me AS (
    SELECT CASE WHEN au.email_confirmed_at IS NOT NULL THEN public.hash_account_identifier(au.email) END AS email_hash,
           CASE WHEN au.phone_confirmed_at IS NOT NULL THEN public.hash_account_identifier(au.phone) END AS phone_hash
      FROM auth.users au
     WHERE au.id = p_auth_id
  )
  SELECT da.id,
         CASE WHEN me.email_hash IS NOT NULL AND da.email_hash = me.email_hash THEN 'email' ELSE 'phone' END,
         da.identifier_source,
         da.moderation_hold
    FROM me
    JOIN public.deleted_accounts da
      ON (me.email_hash IS NOT NULL AND da.email_hash = me.email_hash)
      OR (me.phone_hash IS NOT NULL AND da.phone_hash = me.phone_hash);
$$;

REVOKE ALL ON FUNCTION public.reentry_matches(UUID) FROM PUBLIC, anon, authenticated;

-- =====================================================
-- 5. THE MANUAL HOLD, AFTER THE ADDRESS IS PROVEN
-- =====================================================
-- BEFORE INSERT on the profile row. Refuses only where a human set moderation_hold, only on
-- an 'auth'-sourced tombstone (a 'profile' one came from a client-written column and could
-- name an innocent address), and only on a confirmed identifier (section 4). The person who
-- sees this error has already proven they own the address, so it tells nobody else anything.
CREATE OR REPLACE FUNCTION public.refuse_held_reentry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.auth_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reentry_matches(NEW.auth_id) m
     WHERE m.moderation_hold AND m.identifier_source = 'auth'
  ) THEN
    RAISE EXCEPTION 'We could not create a profile for this account. Please contact support@mazal.app.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_held_reentry() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS users_refuse_held_reentry ON public.users;
CREATE TRIGGER users_refuse_held_reentry
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.refuse_held_reentry();

-- =====================================================
-- 6. RESTORE THE BLOCKS WHEN THEY COME BACK (00029 section 4, matching moved to section 4)
-- =====================================================
-- AFTER INSERT: the first moment the new users.id exists, which `blocks` references. Silent:
-- nothing the returning user can read is written, and no error is raised.
CREATE OR REPLACE FUNCTION public.restore_on_reentry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match RECORD;
  v_restored INTEGER;
BEGIN
  IF NEW.auth_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- delete, return, delete, return: restore from every matching tombstone.
  FOR v_match IN SELECT * FROM public.reentry_matches(NEW.auth_id) LOOP
    WITH restored AS (
      INSERT INTO public.blocks (blocker_id, blocked_id)
      SELECT dab.blocker_id, NEW.id
        FROM public.deleted_account_blockers dab
       WHERE dab.deleted_account_id = v_match.deleted_account_id
         AND dab.blocker_id <> NEW.id
         AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = dab.blocker_id)
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      RETURNING 1
    )
    SELECT pg_catalog.count(*) INTO v_restored FROM restored;

    INSERT INTO public.account_reentry_events (
      new_user_id, deleted_account_id, matched_on, identifier_source, blocks_restored
    )
    VALUES (NEW.id, v_match.deleted_account_id, v_match.matched_on, v_match.identifier_source, v_restored)
    ON CONFLICT (new_user_id, deleted_account_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_on_reentry() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS users_restore_on_reentry ON public.users;
CREATE TRIGGER users_restore_on_reentry
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_on_reentry();

-- =====================================================
-- 7. RETENTION FOR BLOCK-ONLY TOMBSTONES
-- =====================================================
CREATE OR REPLACE FUNCTION public.purge_expired_block_only_tombstones()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purged INTEGER;
BEGIN
  DELETE FROM public.deleted_accounts da
   WHERE da.reports_against_count = 0
     AND NOT da.moderation_hold
     AND NOT EXISTS (SELECT 1 FROM public.reports r WHERE r.reported_id = da.user_id)
     AND da.deleted_at < now() - INTERVAL '12 months';
  GET DIAGNOSTICS v_purged = ROW_COUNT;
  RETURN v_purged;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_block_only_tombstones() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.purge_expired_block_only_tombstones() IS
  'MEXA-435. Deletes tombstones written only because the account was blocked (no reports, no hold) '
  '12 months after deletion; the blocker rows cascade. Daily job block-only-tombstone-retention.';

SELECT cron.unschedule('block-only-tombstone-retention')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'block-only-tombstone-retention');

SELECT cron.schedule(
  'block-only-tombstone-retention',
  '23 3 * * *',
  $job$ SELECT public.purge_expired_block_only_tombstones(); $job$
);

-- =====================================================
-- 8. SELF-CHECK
-- =====================================================
DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['public.record_deleted_account()', 'public.reentry_matches(uuid)',
                              'public.refuse_held_reentry()', 'public.restore_on_reentry()',
                              'public.purge_expired_block_only_tombstones()'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'MEXA-435: a client role can execute %', v_fn;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.deleted_account_blockers', 'SELECT')
     OR has_table_privilege('anon', 'public.deleted_account_blockers', 'SELECT')
     OR has_table_privilege('authenticated', 'public.account_reentry_events', 'SELECT')
     OR has_table_privilege('anon', 'public.account_reentry_events', 'SELECT') THEN
    RAISE EXCEPTION 'MEXA-435: a client role can read the blocker snapshot or the re-entry queue';
  END IF;
END
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00040', 'blocks_survive_resignup')
ON CONFLICT (version) DO NOTHING;

COMMIT;
