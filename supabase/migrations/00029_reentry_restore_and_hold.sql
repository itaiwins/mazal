-- Mazal - What happens when a deleted account's address signs up again
--
-- MEXA-258. Requires 00011_preserve_moderation_history.sql (applied).
-- Rollback: supabase/rollback/00029_reentry_restore_and_hold_rollback.sql
--
-- Migration numbers taken at the time of writing, across every remote ref and not just
-- `mazal-restart`: 00000-00028. 00022 lives on `origin/mexa-302` and 00027 on
-- `origin/mexa-277`, which is why the sequence on `mazal-restart` has holes.
--
-- THE DECISION THIS IMPLEMENTS
--
-- Itai, on MEXA-258, picked option D plus the manual hold:
--
--   "Let them in, but silently restore the blocks and reports from the old account"
--   "Yes - build the manual hold, refusal only when a human sets it"
--
-- So the default is NOT a ban. Someone who deletes an account and comes back gets an
-- ordinary account, and the people who blocked them still cannot be reached. A refusal
-- happens only where a human has set `moderation_hold` by hand. Nobody is locked out of
-- a dating app by one stranger's false report, which is what made "refuse the signup"
-- hard to recommend in the first place.
--
-- WHERE THIS RUNS, AND WHY NOT AN EDGE FUNCTION
--
-- There are three signup paths - email/password, Apple and Google, in
-- `app/(auth)/register.tsx`, repeated in `app/(safta-auth)/signup.tsx`. A client-side
-- check has to be wired into each one, the next path anyone adds starts out unguarded,
-- and the person this exists to stop is motivated enough to run a patched client. So:
--
--   * the refusal is a before-user-created auth hook (section 5), which runs inside
--     GoTrue before the `auth.users` row exists and has no client to patch;
--   * the restoration is an AFTER INSERT trigger on `public.users` (section 4), because
--     that is the first moment a new `users.id` exists - and `blocks` references
--     `users.id`, not the auth id. The hook cannot do it: at hook time there is no
--     account yet to attach anything to.
--
-- WHY A SNAPSHOT INSTEAD OF DROPPING THE CASCADE ON `blocks`
--
-- MEXA-258 originally proposed un-cascading `blocks.blocked_id` the way 00011 un-cascaded
-- `reports`. That does not work, and it took a while to see why: the returning person
-- gets a brand-new `users.id`. A preserved block row still points at the old one, so it
-- matches nobody. It would survive and do nothing, while costing the same insert-time
-- integrity trigger `reports` needed.
--
-- What is actually needed is the set of people who blocked the account, recorded against
-- the tombstone, so it can be re-applied to whatever id the person comes back with. That
-- is section 1. `blocks` keeps both cascades exactly as they are - no FK is touched here.
--
-- SCOPE: REPORT-BEARING TOMBSTONES ONLY
--
-- 00011 writes a tombstone only when there is a report against the account. An account
-- nobody reported leaves nothing behind, deliberately - that is what "delete my account"
-- should mean, and it is the property Alucard reviewed and signed off.
--
-- So an account that was BLOCKED but never REPORTED still leaves nothing, and its blocks
-- are still lost on return. That is a real gap in the promise above, and it is left open
-- here on purpose: closing it means writing a tombstone for a large share of everyone who
-- ever deletes, since being blocked is common and casual in a way being reported is not.
-- That is a data-retention expansion beyond what 00011's review covered, and it should be
-- decided on its own rather than smuggled in here. Filed as a follow-up on MEXA-258.

-- =====================================================
-- 1. WHO BLOCKED THE ACCOUNT
-- =====================================================

CREATE TABLE IF NOT EXISTS public.deleted_account_blockers (
  deleted_account_id UUID NOT NULL
    REFERENCES public.deleted_accounts(id) ON DELETE CASCADE,

  -- This one IS a foreign key with a cascade, unlike everything in 00011. The blocker is
  -- a live user; if they later delete their own account, this row should go with them.
  -- A block is a preference held by a person, and it dies with the person who held it.
  blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  blocked_at TIMESTAMPTZ,

  PRIMARY KEY (deleted_account_id, blocker_id)
);

CREATE INDEX IF NOT EXISTS idx_deleted_account_blockers_blocker
  ON public.deleted_account_blockers(blocker_id);

ALTER TABLE public.deleted_account_blockers ENABLE ROW LEVEL SECURITY;
-- No policies, same as `deleted_accounts`: service_role bypasses RLS, everyone else is
-- denied. The REVOKE is not redundant - Supabase's default privileges grant CRUD on every
-- new public table to anon and authenticated (see 00010's header, and MEXA-268).
REVOKE ALL ON TABLE public.deleted_account_blockers FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.deleted_account_blockers TO service_role;

COMMENT ON TABLE public.deleted_account_blockers IS
  'Who had blocked an account when it was deleted (MEXA-258). Re-applied to the new users.id if '
  'that person signs up again. service_role only - no RLS policy exists, by design.';

-- =====================================================
-- 2. RECORD THE BLOCKERS WHEN THE TOMBSTONE IS WRITTEN
-- =====================================================

-- 00011's trigger is BEFORE DELETE on public.users and inserts the tombstone. The blocker
-- rows have to be captured in the same breath: by the time the DELETE completes, the
-- `blocks` rows are gone (blocked_id still cascades, deliberately - see the header).
--
-- This replaces 00011's function body. Everything down to the INSERT is unchanged from
-- 00011 as amended by MEXA-262 and MEXA-259's review; the new part is the second INSERT
-- and the v_tombstone_id it needs.
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
  v_source TEXT := 'auth';
  v_tombstone_id UUID;
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
  -- `authenticated` holds UPDATE on public.users.email and .phone, so hashing the profile
  -- columns would let the reported user rewrite their own address one request before
  -- deleting - or put an innocent third party's address on the tombstone, framing them
  -- now that this migration makes a tombstone mean something. Only a verified Supabase
  -- Auth flow can change the auth row.
  --
  -- The fallback is on the auth ROW being missing (a delete that starts at auth.users
  -- reaches public.users second), not on a single column being NULL: auth.users.email is
  -- nullable for a phone signup, and a coalesce would reach for the profile email, which
  -- is the exact column the framing case needs. Verified on the live DB in MEXA-262.
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
    OLD.display_name,
    OLD.created_at,
    v_total,
    v_open
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_tombstone_id;

  -- ON CONFLICT DO NOTHING returns no row, so v_tombstone_id is NULL when a tombstone for
  -- this user already existed. Fetch it rather than skipping: the blockers still want
  -- recording, and re-running must not lose them.
  IF v_tombstone_id IS NULL THEN
    SELECT id INTO v_tombstone_id
      FROM public.deleted_accounts WHERE user_id = OLD.id;
  END IF;

  -- MEXA-258: who this account was hiding from.
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
-- 3. THE RE-ENTRY RECORD (this is the "flag for review")
-- =====================================================

CREATE TABLE IF NOT EXISTS public.account_reentry_events (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  new_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  deleted_account_id UUID NOT NULL
    REFERENCES public.deleted_accounts(id) ON DELETE CASCADE,

  -- Which identifier matched, and how much that identifier is worth. 'profile' means the
  -- tombstone's hashes came from a client-written row - see identifier_source in 00011.
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
  'One row per new account that matched a moderation tombstone (MEXA-258). This is the review '
  'queue Itai asked for; there is no admin UI yet. service_role only, by design - the user must '
  'not be able to tell that their new account was recognised.';

-- =====================================================
-- 4. RESTORE THE BLOCKS WHEN THEY COME BACK
-- =====================================================

-- Fires when the profile row is created, which is the first point a `users.id` exists.
-- Silent by design: nothing is written that the returning user can read, and no error is
-- raised. They get an ordinary account. The people who blocked them simply never stop
-- having them blocked.
CREATE OR REPLACE FUNCTION public.restore_on_reentry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT;
  v_phone TEXT;
  v_email_hash TEXT;
  v_phone_hash TEXT;
  v_tombstone RECORD;
  v_restored INTEGER;
BEGIN
  -- From auth.users, never from NEW.email: the profile row is client-written, so trusting
  -- it would let anyone claim to be a returning account - or, more usefully to an
  -- attacker, claim someone else's tombstone and inherit nothing but a review flag on a
  -- third party. Same reasoning as MEXA-259's M1.
  SELECT email, phone INTO v_email, v_phone FROM auth.users WHERE id = NEW.auth_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_email_hash := public.hash_account_identifier(v_email);
  -- auth.users.phone is stored WITHOUT a leading '+', and hash_account_identifier only
  -- lowercases and trims. Hashing a '+'-prefixed value here would never match a tombstone
  -- written from the same auth row. Moot while external_phone_enabled is false, live and
  -- waiting the day it is switched on.
  v_phone_hash := public.hash_account_identifier(v_phone);

  IF v_email_hash IS NULL AND v_phone_hash IS NULL THEN
    RETURN NEW;
  END IF;

  -- More than one tombstone can match: delete, return, delete, return. Restore from all
  -- of them, and record one event per tombstone so a moderator sees the whole history.
  FOR v_tombstone IN
    SELECT da.id, da.identifier_source,
           CASE WHEN v_email_hash IS NOT NULL AND da.email_hash = v_email_hash
                THEN 'email' ELSE 'phone' END AS matched_on
      FROM public.deleted_accounts da
     WHERE (v_email_hash IS NOT NULL AND da.email_hash = v_email_hash)
        OR (v_phone_hash IS NOT NULL AND da.phone_hash = v_phone_hash)
  LOOP
    WITH restored AS (
      INSERT INTO public.blocks (blocker_id, blocked_id)
      SELECT dab.blocker_id, NEW.id
        FROM public.deleted_account_blockers dab
       WHERE dab.deleted_account_id = v_tombstone.id
         -- The blocker cascade should already have removed these, but a blocker who is
         -- gone cannot be protected, and blocks has CHECK (blocker_id != blocked_id):
         -- without this, a person whose own tombstone somehow lists them would abort
         -- their own signup with a check violation.
         AND dab.blocker_id <> NEW.id
         AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = dab.blocker_id)
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      RETURNING 1
    )
    SELECT pg_catalog.count(*) INTO v_restored FROM restored;

    INSERT INTO public.account_reentry_events (
      new_user_id, deleted_account_id, matched_on, identifier_source, blocks_restored
    )
    VALUES (
      NEW.id, v_tombstone.id, v_tombstone.matched_on,
      v_tombstone.identifier_source, v_restored
    )
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
-- 5. THE MANUAL HOLD: REFUSE THE SIGNUP
-- =====================================================

-- A before-user-created auth hook. Supabase calls this as `supabase_auth_admin` with the
-- pending user as JSON, and reads the returned JSON: `{}` lets the signup through, an
-- `error` key stops it.
--
-- NOT ENABLED BY THIS MIGRATION. Enabling it is a live auth-config change
-- (`hook_before_user_created_enabled` / `_uri`), which is a deploy step and goes through
-- review - see the issue. Applying this file only creates the function.
--
-- FAILS OPEN, ON PURPOSE. If the payload shape is not what we expect, or the lookup
-- throws, this returns `{}` and the signup proceeds. The alternative - fail closed - turns
-- any mistake in here into "nobody can create an account", on all three signup paths at
-- once, with no way to notice except users complaining. A hold that does not bite is a
-- much smaller problem than a signup page that is dark. The payload shape below must be
-- confirmed against a real hook invocation before this is enabled; that is a gate on
-- turning it on, not on merging it.
CREATE OR REPLACE FUNCTION public.before_user_created_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT;
  v_phone TEXT;
  v_email_hash TEXT;
  v_phone_hash TEXT;
  v_held BOOLEAN;
BEGIN
  -- Read defensively. GoTrue has moved this payload's shape before, and the cost of
  -- guessing wrong is section 5's header.
  v_email := pg_catalog.coalesce(
    event #>> '{user,email}',
    event #>> '{claims,email}',
    event ->> 'email'
  );
  v_phone := pg_catalog.coalesce(
    event #>> '{user,phone}',
    event #>> '{claims,phone}',
    event ->> 'phone'
  );

  v_email_hash := public.hash_account_identifier(v_email);
  v_phone_hash := public.hash_account_identifier(v_phone);

  IF v_email_hash IS NULL AND v_phone_hash IS NULL THEN
    RETURN '{}'::JSONB;
  END IF;

  SELECT TRUE INTO v_held
    FROM public.deleted_accounts da
   WHERE da.moderation_hold
     -- A hold is only grounds to refuse when the hashes came from auth.users. An
     -- identifier_source of 'profile' means a client wrote the address on the profile row,
     -- so refusing on it would let one person get another person's address turned away at
     -- signup. It is a hint for a moderator, never a reason to lock somebody out.
     AND da.identifier_source = 'auth'
     AND (
       (v_email_hash IS NOT NULL AND da.email_hash = v_email_hash)
       OR (v_phone_hash IS NOT NULL AND da.phone_hash = v_phone_hash)
     )
   LIMIT 1;

  IF v_held THEN
    -- Deliberately says nothing. Naming the reason would make signup an oracle for "is
    -- this address banned", and would tell the person exactly what to change. Support has
    -- the review queue and can explain to a real person who asks.
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'We could not create an account with these details. Please contact support@mazal.app.'
      )
    );
  END IF;

  RETURN '{}'::JSONB;

EXCEPTION WHEN OTHERS THEN
  -- See the header: a broken hook must not take signup down.
  RETURN '{}'::JSONB;
END;
$$;

REVOKE ALL ON FUNCTION public.before_user_created_hook(JSONB) FROM PUBLIC, anon, authenticated;
-- Only GoTrue may call it. `authenticated` with EXECUTE would be an oracle: pass an
-- address, see whether it comes back refused.
GRANT EXECUTE ON FUNCTION public.before_user_created_hook(JSONB) TO supabase_auth_admin;

COMMENT ON FUNCTION public.before_user_created_hook(JSONB) IS
  'before-user-created auth hook (MEXA-258). Refuses a signup whose address matches a tombstone '
  'a human has put moderation_hold on. Fails open. Not enabled until the auth config points at it.';
