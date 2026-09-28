-- Mazal - Keep moderation history when an account is deleted
--
-- Fixes MEXA-256 (found by Guts reviewing the delete-account rewrite, MEXA-253).
-- Rollback: supabase/rollback/00011_preserve_moderation_history_rollback.sql
--
-- THE GAP
--
-- `reports.reporter_id` and `reports.reported_id` were both `REFERENCES users(id)
-- ON DELETE CASCADE` (00001_initial_schema.sql). So:
--
--   A reports B for harassment -> B taps "Delete my account" -> the cascade removes
--   every report against B -> `auth.admin.deleteUser` frees B's email immediately ->
--   B signs up again with the same address and there is no trace, anywhere in the
--   product, that the report ever existed.
--
-- That is the ordinary self-service delete flow, not an exploit needing any special
-- access. It has to stop working before the app has users.
--
-- WHAT THIS MIGRATION DOES
--
-- 1. Drops the two foreign keys on `reports`. The columns keep their type and stay
--    NOT NULL, so a report row now outlives both the person who filed it and the
--    person it is about. Insert-time integrity moves to a trigger that checks both
--    ids against `users` and raises 23503, which is what the FK gave us and is all it
--    gave us - the FK's delete behaviour was the bug.
--
--    `ON DELETE SET NULL` was the other option in the issue. It was rejected because
--    it makes both columns nullable, which changes the generated TypeScript types and
--    every read of a report, and because a report whose `reported_id` is NULL cannot
--    be tied back to a person at all - it preserves the row and loses the only thing
--    the row is for.
--
-- 2. Adds `deleted_accounts`: one tombstone row per deleted account that had reports
--    against it. It is what a moderator joins `reports.reported_id` to once the
--    `users` row is gone, and it is what lets a future signup check notice that a
--    returning email belongs to an account that left under an open report.
--
--    Written by a BEFORE DELETE trigger on `users`, not by the Edge Function, so it
--    also covers a cascade from `auth.users`, a service-role script and the SQL
--    editor. The Edge Function needs no change.
--
-- 3. Data minimisation, deliberately: a tombstone is created ONLY when there is at
--    least one report against the account. Deleting an account nobody complained
--    about leaves nothing behind, which is what "delete my account" should mean.
--    The email and phone are stored as a peppered SHA-256, never in the clear - the
--    hash is enough to recognise the same address coming back, and not enough to read
--    the address back out or to mail it. `display_name` is kept because a moderator
--    reviewing a surviving report needs to know who it was about, though it is a hint
--    and not an identifier: the user can rename themselves on the way out.
--
-- 4. Takes those identifiers from `auth.users`, not from `public.users`, and stops
--    clients rewriting `public.users.email` / `.phone` at all. Both come out of
--    Alucard's review, MEXA-259 M1: `authenticated` holds UPDATE on those columns and
--    00002's "Users can update own profile" policy puts no column limit on it, so
--    hashing the profile row would have let a reported user change their email to junk
--    one request before deleting - or to an innocent third party's address, framing
--    them the moment MEXA-258 starts refusing signups.
--
-- WHAT THIS MIGRATION DOES NOT DO
--
-- - It does not block a re-registration. Nothing reads `moderation_hold` yet; turning
--   someone away at signup is user-visible behaviour and is Itai's call. Follow-up:
--   MEXA-258.
-- - It does not add a moderator role. `reports` stays readable only by the reporter
--   (00002) and by service_role, and `deleted_accounts` only by service_role. There
--   are no staff accounts and no admin UI, so adding a role now would be a new
--   privilege surface protecting nothing. Raised on MEXA-256 for a product decision.
-- - It does not change `blocks`, which still cascades. A block is a preference held by
--   the blocker about someone who no longer exists; re-contact after a re-registration
--   is the same problem as the one MEXA-258 covers.

-- =====================================================
-- 1. PEPPER FOR THE IDENTIFIER HASHES
-- =====================================================

-- A bare SHA-256 of an email address is reversible with a wordlist, so the hash is
-- peppered with a 256-bit secret. It lives in a table rather than inside the function
-- body because `pg_proc.prosrc` is world-readable, and rather than in Supabase Vault
-- because this needs no rotation story and one less moving part is worth more here.
--
-- Do not change the pepper. Every hash in `deleted_accounts` is computed with it, and
-- replacing it silently orphans all of them.
CREATE TABLE IF NOT EXISTS public.moderation_secrets (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  pepper TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.moderation_secrets (singleton, pepper)
VALUES (true, encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.moderation_secrets ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: service_role bypasses RLS, everyone else is denied. The
-- REVOKE is not redundant - Supabase ships ALTER DEFAULT PRIVILEGES that grants CRUD
-- on every new public table to anon and authenticated (see 00010's header).
REVOKE ALL ON TABLE public.moderation_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.moderation_secrets TO service_role;

COMMENT ON TABLE public.moderation_secrets IS
  'Single row. Pepper for the identifier hashes in deleted_accounts. service_role only; never expose.';

-- =====================================================
-- 2. THE HASH HELPER
-- =====================================================

-- Every function below runs with `SET search_path = ''` (MEXA-259, Alucard's optional
-- hardening), so every name has to say where it lives. Two exceptions, both deliberate:
-- COALESCE is SQL syntax rather than a function, so `pg_catalog.coalesce(...)` is a
-- 42883 at runtime and the bare form is already search_path-proof; and operators like
-- `||` and `<>` resolve through pg_catalog regardless.
CREATE OR REPLACE FUNCTION public.hash_account_identifier(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pepper TEXT;
  v_normalized TEXT;
BEGIN
  v_normalized := pg_catalog.lower(pg_catalog.btrim(coalesce(p_value, '')));
  IF v_normalized = '' THEN
    RETURN NULL;
  END IF;

  SELECT pepper INTO v_pepper FROM public.moderation_secrets WHERE singleton;
  IF v_pepper IS NULL THEN
    RAISE EXCEPTION 'moderation pepper is missing' USING ERRCODE = 'internal_error';
  END IF;

  RETURN pg_catalog.encode(extensions.digest(v_pepper || ':' || v_normalized, 'sha256'), 'hex');
END;
$$;

-- SECURITY DEFINER over the pepper table: only the trigger and service_role may call it.
-- Anyone else could use it as an oracle to test whether a given address was deleted.
REVOKE ALL ON FUNCTION public.hash_account_identifier(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_account_identifier(TEXT) TO service_role;

-- =====================================================
-- 3. THE TOMBSTONE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.deleted_accounts (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- No FKs here by design: both rows these point at are gone by the time anyone reads
  -- this. user_id is the join key for the reports that survived the deletion.
  user_id UUID NOT NULL UNIQUE,
  auth_id UUID,

  -- Peppered SHA-256, see hash_account_identifier(). Never the address itself.
  email_hash TEXT NOT NULL,
  phone_hash TEXT,

  -- Kept so a moderator reading a surviving report can tell who it was about.
  display_name TEXT,
  account_created_at TIMESTAMPTZ,

  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reports_against_count INTEGER NOT NULL DEFAULT 0,
  open_reports_against_count INTEGER NOT NULL DEFAULT 0,

  -- Nothing reads these yet. MEXA-258 is where signup starts honouring them.
  moderation_hold BOOLEAN NOT NULL DEFAULT false,
  hold_reason TEXT,
  hold_set_at TIMESTAMPTZ,

  CHECK (moderation_hold = false OR hold_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_deleted_accounts_email_hash ON public.deleted_accounts(email_hash);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_phone_hash ON public.deleted_accounts(phone_hash)
  WHERE phone_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_hold ON public.deleted_accounts(email_hash)
  WHERE moderation_hold;

ALTER TABLE public.deleted_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.deleted_accounts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.deleted_accounts TO service_role;

COMMENT ON TABLE public.deleted_accounts IS
  'One row per deleted account that had a report against it. Retained so moderation history survives '
  'self-service deletion (MEXA-256). service_role only - no RLS policy exists, by design.';

-- =====================================================
-- 4. WRITE THE TOMBSTONE ON DELETE
-- =====================================================

CREATE OR REPLACE FUNCTION public.record_deleted_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total INTEGER;
  v_open INTEGER;
  v_email TEXT;
  v_phone TEXT;
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
  SELECT email, phone INTO v_email, v_phone FROM auth.users WHERE id = OLD.auth_id;
  v_email := coalesce(v_email, OLD.email);
  v_phone := coalesce(v_phone, OLD.phone);

  INSERT INTO public.deleted_accounts (
    user_id, auth_id, email_hash, phone_hash, display_name,
    account_created_at, reports_against_count, open_reports_against_count
  )
  VALUES (
    OLD.id,
    OLD.auth_id,
    public.hash_account_identifier(v_email),
    public.hash_account_identifier(v_phone),
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
$$;

REVOKE ALL ON FUNCTION public.record_deleted_account() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS users_record_deletion ON public.users;
CREATE TRIGGER users_record_deletion
  BEFORE DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.record_deleted_account();

-- =====================================================
-- 5. REPORTS SURVIVE THE PEOPLE IN THEM
-- =====================================================

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reported_id_fkey;

-- 00001 indexed reports(status) only. The delete trigger and any moderator lookup go
-- through reported_id.
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);

-- What the dropped FKs still owed us: you cannot file a report about someone who does
-- not exist. SECURITY DEFINER because `users` has RLS and a reporter cannot see every
-- row of it, so an invoker-rights check would reject legitimate reports.
--
-- `FOR KEY SHARE` is the part that is easy to leave out (MEXA-259, L1). A real foreign
-- key takes that lock on the parent row; a bare EXISTS does not. Under READ COMMITTED,
-- a report inserted while the reported user's DELETE is in flight would otherwise see
-- the user, while the DELETE's own trigger counts reports without seeing the uncommitted
-- insert - leaving a report pointing at a vanished user and no tombstone at all. Taking
-- the lock makes the DELETE wait, so its trigger counts the report.
CREATE OR REPLACE FUNCTION public.reports_check_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- An UPDATE that lists these columns but does not change them (a full-row upsert from
  -- some future admin tool) must not be rejected just because the people in an old
  -- report are gone.
  IF TG_OP = 'UPDATE'
     AND NEW.reporter_id IS NOT DISTINCT FROM OLD.reporter_id
     AND NEW.reported_id IS NOT DISTINCT FROM OLD.reported_id THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.users WHERE id = NEW.reporter_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reporter_id % is not a user', NEW.reporter_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  PERFORM 1 FROM public.users WHERE id = NEW.reported_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reported_id % is not a user', NEW.reported_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reports_check_participants() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reports_check_participants ON public.reports;
CREATE TRIGGER reports_check_participants
  BEFORE INSERT OR UPDATE OF reporter_id, reported_id ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.reports_check_participants();

COMMENT ON COLUMN public.reports.reported_id IS
  'public.users.id. Intentionally NOT a foreign key (MEXA-256): the report must outlive the account. '
  'Join public.deleted_accounts on user_id when the users row is gone.';
COMMENT ON COLUMN public.reports.reporter_id IS
  'public.users.id. Intentionally NOT a foreign key (MEXA-256), same reason as reported_id.';

-- =====================================================
-- 6. THE PROFILE EMAIL AND PHONE STOP BEING FREE TEXT
-- =====================================================

-- MEXA-259, M1 part 2. `authenticated` holds UPDATE on public.users.email and .phone,
-- and 00002's "Users can update own profile" policy puts no column limit on it. That is
-- a problem beyond deletion: `users.email` is UNIQUE, so anyone could take any address
-- that is not registered yet and squat it, and the profile email could drift away from
-- the address the account is actually reachable at.
--
-- Section 4 no longer trusts these columns, so this is defence in depth rather than the
-- fix. It is written to be the smallest change that is safe for the app:
--   - an UPDATE that does not change the value passes, so a screen that spreads the
--     whole profile object back (useUpdateProfile does exactly this) keeps working;
--   - a change that matches the account's verified Supabase Auth address passes, so a
--     legitimate email change made through Auth can still be mirrored here;
--   - anything else from a client is refused. service_role is unaffected.
-- I grepped the app for a write to either column and found none, INSERT included.
CREATE OR REPLACE FUNCTION public.users_guard_identity_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_email TEXT;
  v_auth_phone TEXT;
BEGIN
  -- Only clients are held to this. A NULL role is a direct postgres session (migrations,
  -- the SQL editor, a service-role script that did not set a JWT).
  IF coalesce(auth.role(), 'service_role') NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    SELECT email INTO v_auth_email FROM auth.users WHERE id = OLD.auth_id;
    IF v_auth_email IS NULL
       OR pg_catalog.lower(pg_catalog.btrim(NEW.email)) <> pg_catalog.lower(v_auth_email) THEN
      RAISE EXCEPTION 'users.email can only be set to this account''s verified auth email'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    SELECT phone INTO v_auth_phone FROM auth.users WHERE id = OLD.auth_id;
    IF v_auth_phone IS NULL OR v_auth_phone = ''
       OR pg_catalog.btrim(coalesce(NEW.phone, '')) <> v_auth_phone THEN
      RAISE EXCEPTION 'users.phone can only be set to this account''s verified auth phone'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.users_guard_identity_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS users_guard_identity_columns ON public.users;
CREATE TRIGGER users_guard_identity_columns
  BEFORE UPDATE OF email, phone ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_guard_identity_columns();
