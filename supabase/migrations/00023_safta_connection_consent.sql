-- Mazal - a Safta connection cannot be forced on anybody
--
-- MEXA-357. Rollback: supabase/rollback/00023_safta_connection_consent_rollback.sql
--
-- Three changes on one table, `safta_connections`, in the order a connection travels:
--
--   1. INSERT ("Safta can create connections") may only create a `pending` row. Today the
--      check pins `safta_account_id` to one of the caller's own Safta accounts and says
--      nothing about `status`, so the Safta writes `'accepted'` herself.
--   2. UPDATE ("Users can update connection status") gets its first `WITH CHECK`, and the
--      status it may write is narrowed to `accepted` / `rejected`.
--   3. A `BEFORE UPDATE` trigger makes `id`, `safta_account_id`, `connected_user_id` and
--      `created_at` immutable, and takes `accepted_at` out of the client's hands.
--      `WITH CHECK` cannot see OLD, so pinning a column across an UPDATE needs a trigger;
--      a policy alone cannot express it.
--
-- Both policies also move from `TO public` to `TO authenticated`, which is where the
-- policies written since `00019` sit. `anon` still holds the INSERT and UPDATE grants on
-- this table until `00016` goes on, so under `TO public` these two policies were the only
-- thing between the anon key and the table. They did hold - `auth.uid()` is NULL for
-- `anon`, so the subquery is empty - but that is one layer, not two.
--
-- DEPENDS ON: `00002` (the two policies it replaces) and `00013` (which created
-- `public.current_app_user_id()`; asserted in section 0, and live today). Independent of
-- everything in flight. `00016` names `safta_connections` only to REVOKE DELETE from
-- `authenticated`, and its post-check (section 7c) reads grants, never policies - this file
-- changes no grant at all and asserts so in section 5. `00020`, `00021` and `00022`
-- (MEXA-302) name no policy and no trigger on this table. Safe in either order against all
-- of them; `00022` in particular wants to land *after* this one, see below.
--
-- ===================================================================================
-- THE DEFECT, MEASURED ON THE LIVE PROJECT
-- ===================================================================================
--
-- `tayiyczmacvhokdxfqvm`, inside `begin … rollback`, as the real `authenticated` role with
-- `request.jwt.claims` set (`.scratch/mazal-mexa357/verify.mjs --mode before`). Nothing
-- left behind. Fixtures: a victim V with a normal user account, an attacker A who also
-- holds a `safta_accounts` row of her own, and a grandchild G with a real `pending`
-- connection to a second Safta account.
--
--   As A, who has never met V and holds no invitation from her:
--     INSERT INTO safta_connections (safta_account_id, connected_user_id, status)
--       VALUES (<A's own safta account>, <V's users.id>, 'accepted')   ->  1 row
--     INSERT INTO safta_messages (connection_id, sender_type, sender_id, content)
--       VALUES (<that connection>, 'safta', <A's safta account>, '...')  ->  1 row
--     as V:  SELECT content FROM safta_messages                          ->  the message
--
--   As G, who holds one real `pending` connection to Safta B:
--     UPDATE safta_connections SET safta_account_id = <an unrelated Safta account>,
--            status = 'accepted' WHERE id = <G's row>                  ->  1 row
--
-- So any signed-in account can attach itself to any user id as an `accepted` family
-- connection and start a conversation there, and a grandchild can re-point a connection she
-- was given at a Safta account that never invited her. Neither needs an invite, a code, or
-- a single action by the person on the other end.
--
-- HOW WIDE THIS IS. `"Safta can create account"` (`00002`) is `WITH CHECK (auth_id =
-- auth.uid())`, so becoming a Safta is one INSERT with no vetting, and `connected_user_id`
-- is any `public.users.id` - discoverable through `user_public_profiles`, which `00013`
-- opens to every signed-in account. `EXPO_PUBLIC_FEATURE_SAFTA_MODE` is a client-bundle
-- constant: it decides which React screens render, not what PostgREST accepts, so the flag
-- being off does not close any of this. What does limit it today is that the tables hold 0
-- rows and no screen in the app inserts into `safta_connections` at all - the invite flow
-- (`app/(safta-auth)/enter-code.tsx`) is a `setTimeout` stub that validates a link by string
-- match and never writes. The hole is reachable, not yet walked through.
--
-- WHY IT MATTERS TO `00022` (MEXA-302), WHICH IS WAITING BEHIND THIS. That view publishes a
-- Safta's `display_name` and `relationship` to the `connected_user_id` of an `accepted`
-- row, and its security argument is, in its own words, "the grandchild consents by
-- accepting". This file is what makes that sentence true. Without it, a forged `accepted`
-- row is how an attacker puts a name of her choosing - "Bubbe Ruth" - on a message to a
-- stranger on a dating app.
--
-- ===================================================================================
-- WHAT THIS FILE DOES NOT FIX, SAID PLAINLY
-- ===================================================================================
--
-- After this, anyone may still INSERT a `pending` connection row pointing at any user id.
-- That is the invite problem, and it cannot be closed by a policy: there is nothing in the
-- schema to check against - no invite token, no code, no column - because the invite flow
-- was never built. A `pending` row is inert today and stays inert after `00022`: no
-- message can be sent on it (`00004`'s INSERT check is `sc.status = 'accepted'`), it
-- renders nowhere (every client query filters `status = 'accepted'`), and `00022`'s view
-- is `accepted`-only, so it publishes no name. The one screen that reads connections
-- unfiltered, `app/(safta-tabs)/profile.tsx:153`, then looks the members up in
-- `user_public_profiles` - which any signed-in account can already read for any active
-- user, so a forged `pending` row buys an attacker nothing there either. Filed as a
-- follow-up with the invite flow, where a token column can be checked; not half-built here.
--
-- The same unconstrained-INSERT shape sits on `"Safta can create likes"` (`00002`:
-- `for_user_id` and `liked_user_id` are unchecked), and there it is worse than here,
-- because `00005`'s `trigger_notify_safta_like` fires `AFTER INSERT … WHEN (NEW.sent_to_user
-- = true)` - one INSERT queues a push at a user the Safta has no relationship to. `00020`'s
-- header filed it and did not close it; it is a different table, a different trigger and a
-- different fix, and it is filed again as its own issue rather than smuggled in here.
--
-- `status` stays nullable with `DEFAULT 'pending'`. `SET NOT NULL` would be an ALTER TABLE
-- on the column this file's whole argument rests on, and it buys nothing over the policies:
-- `NULL = 'pending'` is NULL, which is not TRUE, so section 1 already refuses a NULL status
-- from a client, and section 2 refuses to write one. Only `postgres` and `service_role`,
-- which bypass RLS entirely, could still put a NULL there.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================
--
-- Capture what must not move, and refuse to run against a table somebody has already
-- reshaped. Deliberately not idempotent: the ledger row in section 4 is what stops a
-- re-apply, and a second run finding its own policies in place should say so loudly rather
-- than quietly re-writing them.

DO $$
DECLARE
  v_n         INTEGER;
  v_check     TEXT;
BEGIN
  IF to_regprocedure('public.current_app_user_id()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-357: public.current_app_user_id() is missing - 00013 is not applied, so the UPDATE policy below would fail at runtime';
  END IF;

  IF to_regclass('public.safta_connections') IS NULL THEN
    RAISE EXCEPTION 'MEXA-357: public.safta_connections does not exist';
  END IF;

  -- One INSERT policy and one UPDATE policy, the ones 00002 wrote. More than one of either
  -- means a policy this file does not know about is also deciding these writes, and
  -- dropping only the named one would leave it deciding them alone.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'INSERT';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-357: expected exactly 1 INSERT policy on safta_connections, found %', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'UPDATE';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-357: expected exactly 1 UPDATE policy on safta_connections, found %', v_n;
  END IF;

  -- The two defects, as they are on live right now. If either is already absent, this file
  -- has been applied (or superseded) and must not run again.
  SELECT with_check INTO v_check FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'INSERT';
  IF v_check IS NULL OR v_check LIKE '%pending%' THEN
    RAISE EXCEPTION 'MEXA-357: the safta_connections INSERT check already constrains status ("%"); 00023 looks applied', v_check;
  END IF;

  SELECT with_check INTO v_check FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'UPDATE';
  IF v_check IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-357: the safta_connections UPDATE policy already has a WITH CHECK ("%"); 00023 looks applied', v_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'safta_connections' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'MEXA-357: safta_connections already carries a trigger; inspect it before adding another';
  END IF;

  -- Grants and row count, to prove in section 5 that this file moved neither.
  PERFORM set_config('mexa357.grants',
    (SELECT coalesce(string_agg(format('%s:%s', grantee, privilege_type), ',' ORDER BY grantee, privilege_type), '')
       FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'safta_connections'), false);
  PERFORM set_config('mexa357.rows',
    (SELECT count(*)::text FROM public.safta_connections), false);
  PERFORM set_config('mexa357.policies',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public'), false);
END
$$;

-- ===================================================================================
-- 1. INSERT: a connection is born `pending`, always
-- ===================================================================================
--
-- `status = 'pending'` is the whole fix for the primary path. It is written as a policy
-- predicate rather than a BEFORE INSERT trigger that overwrites `NEW.status`, because a
-- client that tries to write `'accepted'` should be told no (42501) rather than have its
-- row silently rewritten - the caller is asking for something it must not have, and a
-- silent correction hides that from anyone reading logs. It is also visible in
-- `pg_policies`, which is where the next reviewer will look.
--
-- `accepted_at IS NULL` for the same reason: the column means "when the grandchild said
-- yes", so a row that nobody has said yes to must not carry a timestamp. Nothing reads it
-- today (measured: no query in `src/` or `app/` names it), which is exactly why it would
-- have gone on rotting unnoticed once something did.
--
-- The `safta_account_id` clause is 00002's, unchanged: the row must point at a Safta
-- account the caller owns. What it still does not constrain is `connected_user_id` - see
-- "WHAT THIS FILE DOES NOT FIX" above.

DROP POLICY IF EXISTS "Safta can create connections" ON public.safta_connections;

CREATE POLICY "Safta can create connections" ON public.safta_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND accepted_at IS NULL
    AND safta_account_id IN (
      SELECT id FROM public.safta_accounts WHERE auth_id = auth.uid()
    )
  );

-- ===================================================================================
-- 2. UPDATE: only the grandchild answers, and the only answers are yes and no
-- ===================================================================================
--
-- `USING` is 00002's rule, restated with `current_app_user_id()` instead of an inline
-- subquery on `users` - the same STABLE, SECURITY DEFINER lookup every policy written since
-- `00013` uses, evaluated once per statement instead of once per row. It returns NULL with
-- no session, and `connected_user_id = NULL` matches nothing.
--
-- `WITH CHECK` is new, and it is the fix for the secondary path. Postgres reuses `USING` as
-- the check on the new row when a policy has no `WITH CHECK` of its own, so until now the
-- only thing asserted about the updated row was that it *still* pointed at the caller -
-- which a row re-pointed at a different Safta account does. Spelling the check out is what
-- lets the status be narrowed; the column pinning it cannot express is section 3's job.
--
-- `status IN ('accepted','rejected')`, not a transition table. A grandchild may move her
-- own row between those two as often as she likes - "I changed my mind about my
-- grandmother" must always be available on a dating app, and `00016` takes DELETE away
-- from `authenticated`, so this UPDATE is her only way out of a connection. What she may
-- not do is put a row back to `pending`, which would let her erase the record of an answer
-- she has already given. Unlike `00020`'s one-way rule on `safta_likes`, flipping this
-- column queues nothing: `safta_connections` carries no notification trigger (checked on
-- live - it carries no trigger at all), so there is no faucet to leave open.

DROP POLICY IF EXISTS "Users can update connection status" ON public.safta_connections;

CREATE POLICY "Users can update connection status" ON public.safta_connections
  FOR UPDATE TO authenticated
  USING (connected_user_id = public.current_app_user_id())
  WITH CHECK (
    connected_user_id = public.current_app_user_id()
    AND status IN ('accepted', 'rejected')
  );

-- ===================================================================================
-- 3. The two parties to a connection are fixed for its lifetime
-- ===================================================================================
--
-- `WITH CHECK` sees only NEW, so no policy can say "this column did not change". That is
-- the entire reason a trigger appears here: without it, section 2's check is satisfied by a
-- row whose `safta_account_id` now names a Safta who never invited anyone, and the
-- grandchild has handed herself an `accepted` connection to a stranger's account.
--
-- IT APPLIES TO EVERYONE, INCLUDING `postgres` AND `service_role`. Not an oversight: the
-- rule is that a connection row records *which two people* agreed, and re-pointing it at a
-- third is not an edit of that fact, it is a forgery of it. `UNIQUE (safta_account_id,
-- connected_user_id)` says the same thing in the schema - a row is identified by its pair.
-- An operator who genuinely needs the pair changed deletes the row and inserts another,
-- which is the honest version of the same operation and leaves `safta_messages` (ON DELETE
-- CASCADE) consistent with it instead of silently re-attributing a conversation to someone
-- who was never in it. `ALTER TABLE … DISABLE TRIGGER` remains available to the owner for a
-- genuine repair.
--
-- `accepted_at` is assigned here rather than checked, because it is derived, not chosen:
-- there is exactly one correct value for it given `status`, and the client has no business
-- supplying one. `COALESCE(OLD.accepted_at, now())` keeps the first yes rather than
-- refreshing it on every later UPDATE, and any status that is not `accepted` clears it, so
-- a rejected row cannot keep a timestamp claiming it was once agreed to. Assignment in a
-- BEFORE trigger happens before the policy's `WITH CHECK` runs, so section 2 sees the value
-- this function wrote, not the one the client sent.
--
-- `SECURITY INVOKER`, the default, stated because it is a deliberate choice: this function
-- reads nothing but OLD and NEW and writes nothing, so it needs no privilege of its own,
-- and `docs/TRIGGER_FUNCTION_SECURITY_AUDIT.md` rule 3 (pin `search_path` on anything that
-- runs as owner) is satisfied here by not running as owner at all. `SET search_path =
-- public` goes on anyway: it costs nothing and it is one less thing for the next audit to
-- have to reason about.

CREATE OR REPLACE FUNCTION public.enforce_safta_connection_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.safta_account_id IS DISTINCT FROM OLD.safta_account_id
     OR NEW.connected_user_id IS DISTINCT FROM OLD.connected_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'safta_connections: id, safta_account_id, connected_user_id and created_at are immutable; delete the row and create a new one (MEXA-357)'
      USING ERRCODE = '42501';
  END IF;

  NEW.accepted_at := CASE
    WHEN NEW.status = 'accepted' THEN COALESCE(OLD.accepted_at, now())
    ELSE NULL
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_safta_connection_immutable() IS
  'BEFORE UPDATE trigger on safta_connections: the pair (safta_account_id, connected_user_id) '
  'and the row identity are immutable, and accepted_at is derived from status rather than '
  'supplied. Added by 00023 (MEXA-357) because a policy WITH CHECK cannot see OLD, so without '
  'it a grandchild could re-point her connection at a Safta account that never invited her.';

DROP TRIGGER IF EXISTS safta_connections_immutable ON public.safta_connections;

CREATE TRIGGER safta_connections_immutable
  BEFORE UPDATE ON public.safta_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_safta_connection_immutable();

COMMENT ON TABLE public.safta_connections IS
  'One family connection: a Safta account and the user she matchmakes for. Created pending '
  'by the Safta (INSERT policy) and answered - accepted or rejected - only by that user '
  '(UPDATE policy), who is also the only party who can ever change the status. The pair is '
  'immutable after insert and accepted_at is set by trigger, not by the client (MEXA-357). '
  'status = accepted is what gates safta_messages (00004) and safta_public_profiles (00022), '
  'so it means consent and nothing else may write it. DELETE is revoked from authenticated '
  'in 00016. Nothing in the app inserts here yet: the invite flow is still a stub.';

-- =====================================================
-- 4. Ledger row, in this transaction (MEXA-325)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00023', 'safta_connection_consent')
ON CONFLICT DO NOTHING;

-- ===================================================================================
-- 5. Assert the result, in the same transaction
-- ===================================================================================
--
-- A policy that is too wide fails open and stays quiet, and this table holds 0 rows, so
-- nothing would ever notice. These checks are what make the claims above true of the
-- objects that actually landed rather than of the ones this file describes. The behaviour
-- itself - a forged `accepted` INSERT refused, a re-pointed UPDATE refused, a real accept
-- still working - is measured as the real `authenticated` role in
-- `.scratch/mazal-mexa357/verify.mjs --mode after`, which a policy catalog cannot do.

DO $$
DECLARE
  v_grants_before TEXT    := current_setting('mexa357.grants');
  v_rows_before   INTEGER := current_setting('mexa357.rows')::INTEGER;
  v_pols_before   INTEGER := current_setting('mexa357.policies')::INTEGER;
  v_bad           TEXT;
  v_n             INTEGER;
BEGIN
  -- 5a. The INSERT policy: one of them, ours, pinning status, out of anon's reach.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'INSERT';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-357: expected exactly 1 INSERT policy on safta_connections, found %', v_n;
  END IF;

  SELECT format('%s roles=%s check=%s', policyname, roles::text, with_check) INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'INSERT'
     AND ('public' = ANY (roles) OR 'anon' = ANY (roles)
          OR with_check IS NULL
          OR with_check NOT LIKE '%pending%'
          OR with_check NOT LIKE '%accepted_at IS NULL%'
          OR with_check NOT LIKE '%safta_accounts%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-357: the safta_connections INSERT policy is not the one this file writes: %', v_bad;
  END IF;

  -- 5b. The UPDATE policy: one of them, ours, with a WITH CHECK of its own - the absence
  -- of which is half of the reported defect - naming both terminal states and neither
  -- admitting `pending` back nor widening past the caller's own row.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'UPDATE';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-357: expected exactly 1 UPDATE policy on safta_connections, found %', v_n;
  END IF;

  SELECT format('%s roles=%s qual=%s check=%s', policyname, roles::text, qual, with_check) INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'UPDATE'
     AND ('public' = ANY (roles) OR 'anon' = ANY (roles)
          OR qual IS NULL OR with_check IS NULL
          OR with_check NOT LIKE '%connected_user_id%'
          OR with_check NOT LIKE '%accepted%'
          OR with_check NOT LIKE '%rejected%'
          OR with_check LIKE '%pending%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-357: the safta_connections UPDATE policy is not the one this file writes: %', v_bad;
  END IF;

  -- 5c. The SELECT policy is untouched. This file narrows writes; if it had widened a read
  -- by accident, every Safta's connections would be visible to everyone.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_connections' AND cmd = 'SELECT';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-357: safta_connections has % SELECT policies, expected exactly 1', v_n;
  END IF;

  -- 5d. Exactly one trigger, ours, BEFORE UPDATE, FOR EACH ROW, pointing at the function
  -- this file defines - and that function still pins its search_path.
  SELECT count(*) INTO v_n
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'safta_connections' AND NOT t.tgisinternal;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-357: expected exactly 1 trigger on safta_connections, found %', v_n;
  END IF;

  SELECT format('%s tgtype=%s fn=%s', t.tgname, t.tgtype, p.proname) INTO v_bad
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE c.relname = 'safta_connections' AND NOT t.tgisinternal
     AND (p.proname <> 'enforce_safta_connection_immutable'
          OR (t.tgtype & 1) = 0            -- FOR EACH ROW
          OR (t.tgtype & 2) = 0            -- BEFORE
          OR (t.tgtype & 16) = 0);         -- UPDATE
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-357: the safta_connections trigger is not a BEFORE UPDATE FOR EACH ROW on enforce_safta_connection_immutable: %', v_bad;
  END IF;

  SELECT format('%s(secdef=%s, config=%s)', p.proname, p.prosecdef,
                coalesce(array_to_string(p.proconfig, ' '), 'null')) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'enforce_safta_connection_immutable'
     AND (p.proconfig IS NULL OR NOT ('search_path=public' = ANY (p.proconfig)));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-357: enforce_safta_connection_immutable has no pinned search_path: %', v_bad;
  END IF;

  -- 5e. No grant moved, no row moved, and the policy count across the schema is where it
  -- started - two dropped, two created. 00016's section 7c reads these grants and would
  -- abort on its own apply if this file had touched them.
  SELECT coalesce(string_agg(format('%s:%s', grantee, privilege_type), ',' ORDER BY grantee, privilege_type), '')
    INTO v_bad
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'safta_connections';
  IF v_bad IS DISTINCT FROM v_grants_before THEN
    RAISE EXCEPTION 'MEXA-357: grants on safta_connections changed: "%" -> "%"', v_grants_before, v_bad;
  END IF;

  SELECT count(*) INTO v_n FROM public.safta_connections;
  IF v_n <> v_rows_before THEN
    RAISE EXCEPTION 'MEXA-357: safta_connections row count changed % -> %', v_rows_before, v_n;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'public';
  IF v_n <> v_pols_before THEN
    RAISE EXCEPTION 'MEXA-357: public policy count changed % -> %, expected 2 replaced in place', v_pols_before, v_n;
  END IF;

  RAISE NOTICE 'MEXA-357: a safta connection starts pending, only its grandchild answers, and its two parties are fixed.';
END
$$;

COMMIT;
