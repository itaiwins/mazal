-- Mazal - a matchmaker's private notes belong to that matchmaker, and to nobody else
--
-- MEXA-419. Rollback: supabase/rollback/00037_shadchan_notes_belong_to_their_shadchan_rollback.sql
--
-- =====================================================
-- WHAT IS WRONG TODAY
-- =====================================================
--
-- `public.shadchan_notes` carries exactly one policy, and it gates nothing:
--
--   "shadchan_notes_select_own"  FOR ALL  TO public
--     USING (true)
--     WITH CHECK NULL
--
-- The name says what it was meant to be. `FOR ALL USING (true)` is what got written, with
-- the comment `-- Simplified - adjust based on your shadchanim table structure`
-- (20250114_shidduch_system_fixed.sql:459). `FOR ALL` covers SELECT, INSERT, UPDATE and
-- DELETE; on INSERT a NULL `WITH CHECK` falls back to `USING`, which is `true`. Both client
-- roles hold the whole of `arwd` on the table (`relacl` measured below), so the policy is
-- the only thing that could have said no, and it never does - in any direction, for anyone.
--
-- Measured against `tayiyczmacvhokdxfqvm` (PG 17.6) on 2026-09-29, as a real
-- `authenticated` caller who is neither the shadchan nor the profile, inside one rolled-back
-- transaction (`.scratch/mazal-mexa414/probe.mjs`, `PROBE.txt` P4a-P4d; re-measured for this
-- file as the pre-fix control in `.scratch/mazal-mexa419/rehearse.mjs`):
--
--   read every note in the table    -> ALLOWED, returned the seeded
--                                      'PRIVATE: family has yichus concerns; mother
--                                       difficult on the phone'
--   rewrite another shadchan's note
--     and change its `status`       -> ALLOWED, 1 row
--   delete it                       -> ALLOWED, 1 row
--   forge a note under another
--     shadchan's id                 -> ALLOWED, 1 row
--
-- The table holds a matchmaker's private working notes on a candidate: `notes` (free text),
-- `priority`, `status`, `last_contacted_at`, `next_followup_at`, keyed by
-- `shadchan_id` + `profile_id`.
--
-- This is **not** the MEXA-414 / MEXA-406 / MEXA-418 defect class, and the difference
-- changes the fix. That class is *a policy `USING` expression that is invariant under
-- changing a security-relevant column, plus a client grant on that column*, and it is fixed
-- by narrowing the grant. Here there is no ownership filter at all, so the fix is a real
-- policy set. The grant narrowing in section 4 is only for `anon`.
--
-- Not urgent, and not leavable: the table has **0 rows** on live and the shidduch screens
-- are behind `FEATURE_ORTHODOX_MODE` (docs/ROADMAP.md), so nothing is exposed today. But
-- the flag hides the screen, not the table, and the anon key ships inside the app binary.
--
-- =====================================================
-- THE SIBLING SWEEP, BECAUSE ONE `USING (true)` USUALLY MEANS MORE
-- =====================================================
--
-- MEXA-419 asked for the rest of `20250114_shidduch_system_fixed.sql` to be checked before
-- fixing just this one. Asked of the live catalog rather than of the file, so that later
-- migrations are folded in (`.scratch/mazal-mexa419/SCHEMA.txt`). Every permissive policy in
-- `public` whose `qual` or `with_check` is the literal `true`, all 89 policies considered:
--
--   shadchan_notes.shadchan_notes_select_own                 cmd `*`  <- this file
--   colleges."Anyone can view colleges"                      cmd `r`
--   community_settings.community_settings_select_authenticated cmd `r`
--   user_badges."Users can view all badges"                  cmd `r`
--   user_prompts."Users can view all prompts"                cmd `r`
--
-- The other four are SELECT-only on deliberately-readable reference data; whether
-- `user_prompts`/`user_badges` should be world-readable is MEXA-277's question, already
-- filed and out of scope here. **`shadchan_notes` is the only constant-`true` policy on a
-- write command anywhere in the schema.**
--
-- The weaker sibling question - a table from that migration with client write grants and no
-- write policy - was checked too, and every one of them is closed by RLS rather than open:
-- `shidduch_suggestions`, `shidduch_messages`, `family_connections` and `community_settings`
-- each carry a SELECT policy and nothing else, so `anon` and `authenticated` hold
-- INSERT/UPDATE/DELETE grants that RLS denies outright. `shidduch_references`,
-- `shabbat_schedules` and `shidduch_daily_activity` carry owner-scoped `FOR ALL` policies
-- with a real predicate. The remaining hits on that surface (a self-awardable
-- `shidduch_references.is_verified`, a self-awardable `shadchanim.is_verified` and
-- `successful_matches`) are the MEXA-414 grant class, filed as MEXA-420, and are not
-- touched here.
--
-- =====================================================
-- DECISION 1: `shadchan_id` is made a FOREIGN KEY to `shadchanim(id)`
-- =====================================================
--
-- It has no FK today - it is a bare `UUID NOT NULL`. That has to be settled before a policy
-- can exist at all, because a policy needs something to join through.
--
-- It points at **`public.shadchanim(id)`**, the matchmaker identity table from
-- `00005_orthodox_mode.sql`. Reasons, in order of weight:
--
--   1. `shadchanim.user_id` is `UNIQUE` and references `users(id)`, and `users.auth_id` is
--      what `auth.uid()` matches. That is one unambiguous hop from a row to the caller, and
--      it is the only such hop on offer.
--   2. Every other `shadchan_id` column in this schema that has an FK already points there:
--      `shadchan_connections.shadchan_id` and `shadchan_recommendations.shadchan_id`, both
--      `REFERENCES shadchanim(id) ON DELETE CASCADE`. This file matches them, cascade
--      included, so a matchmaker's notes die with the matchmaker row exactly as their
--      connections and recommendations already do.
--   3. The one column that means something else is `users.shadchan_id`, which references
--      `users(id)` - but that is "the matchmaker assigned to this user", a different thing
--      wearing the same name. It is not a precedent for this column.
--   4. An FK makes the policy's join total. Without it, a `shadchan_id` that names no
--      matchmaker is possible, and "this row belongs to nobody" is a state a security
--      predicate should not have to have an opinion about.
--
-- Live has 0 rows, so the constraint validates against nothing and strands nobody. Guard 0f
-- refuses to run if that is ever untrue - on a restored dump, say - rather than silently
-- failing to add it. No index is created: `shadchan_notes_shadchan_id_profile_id_key`
-- already indexes `(shadchan_id, profile_id)` and `shadchan_id` leads it, so both the FK
-- check and the policy predicate are covered.
--
-- =====================================================
-- DECISION 2: the person the notes are ABOUT does not get to read them
-- =====================================================
--
-- MEXA-419 raised this and guessed no. No is right, and it is worth saying why in the file
-- rather than leaving it to be re-litigated.
--
-- These are a matchmaker's working notes, and the seeded example is the argument: *"family
-- has yichus concerns; mother difficult on the phone"*. A shadchan who knows the candidate
-- can read it writes a different note, or no note, and the feature is then a worse version
-- of nothing. The subject's own data is in `shidduch_profiles` and `shidduch_references`,
-- which they own and control. So the rule is **shadchan-only**, and the four policies below
-- say nothing about `profile_id` at all.
--
-- The consequence, stated plainly so a future reader does not mistake it for an oversight:
-- a candidate cannot see, correct or delete what a matchmaker has written about them. That
-- is a product and privacy-policy question, not an RLS one; if Mazal ever needs to answer a
-- deletion request against this table it goes through `service_role`, which bypasses RLS.
--
-- =====================================================
-- DECISION 3: the predicate goes through a SECURITY DEFINER helper, not a join
-- =====================================================
--
-- The obvious predicate is the direct join:
--
--   EXISTS (SELECT 1 FROM shadchanim s
--            WHERE s.id = shadchan_notes.shadchan_id AND s.user_id = <caller>)
--
-- and it is wrong in a way that fails *closed*, quietly. A policy expression is evaluated
-- as the querying user, so `shadchanim`'s own RLS applies inside it, and `shadchanim`'s only
-- SELECT policy is `"Anyone can view active shadchanim" USING (is_active = true)`. A
-- matchmaker who sets `is_active = false` - the deactivate button this feature will
-- eventually have - would stop being able to read, edit or delete **their own notes**, with
-- no error, just empty results. Worse, it makes this table's access control a downstream
-- consequence of whatever `shadchanim`'s SELECT policy happens to say next.
--
-- So section 2 adds `public.current_shadchan_ids()`, SECURITY DEFINER, the same shape and
-- for the same reason as `current_shidduch_profile_ids()` in `00009`. It is pinned
-- `search_path = public, pg_temp` rather than `00009`'s `public`, because `public` alone
-- does not stop a temp object shadowing an unqualified relation name - the finding behind
-- `00028`, and the pin `00032` already ships on live.
--
-- Null handling, since every branch of it has to fail closed: `auth.uid()` is NULL for a
-- caller with no JWT, `auth_id = NULL` is NULL, so the helper returns the empty set and
-- `shadchan_id IN (SELECT ...)` is false. A `shadchanim` row with a NULL `user_id` (the
-- column is nullable) joins to nothing and so belongs to nobody. `shadchan_id` is
-- `NOT NULL`, so the left side is never NULL. There is no input for which the predicate is
-- NULL-and-treated-as-true.
--
-- =====================================================
-- WHAT THIS FILE DOES NOT FIX, SAID PLAINLY
-- =====================================================
--
-- * **`anon` still holds table privileges on 32 other relations in `public`.** Section 4
--   revokes them on this table only. The blanket fix is `00016`, which is written, security
--   reviewed, PASSed and *not applied* (MEXA-364). This file does not wait for it and does
--   not conflict with it: `00016` revokes `anon` everywhere in a loop and asserts the result
--   with `has_table_privilege`, so a subset already revoked is a no-op it still passes.
-- * **Nothing in the app reads or writes `shadchan_notes`.** The only reference in `src/` is
--   the type alias `ShadchanNotes` (src/types/database.types.ts:414). So this file cannot
--   break a screen, and equally it cannot be proven correct by running one - section 7 and
--   the rehearsal are the whole evidence.
-- * **It does not narrow `authenticated`'s column grants.** It does not need to: unlike
--   MEXA-406/418, every column here is the shadchan's own to write, and the one dangerous
--   write - moving a row to another shadchan - is refused by the UPDATE policy itself,
--   because that policy's `USING` reads the very column the write changes. See section 3.
-- * **`INSERT ... RETURNING` is refused by the SELECT policy, not only by the INSERT check.**
--   Measured (`.scratch/mazal-mexa419/diag2.mjs`): with the INSERT policy widened to
--   `WITH CHECK (true)`, a forged `INSERT ... RETURNING id` is still refused 42501, and the
--   same statement without `RETURNING` is ALLOWED. This changes nothing about the fix, but
--   it means a probe written with `RETURNING` does not prove the INSERT check works - the
--   rehearsal's forge probes deliberately drop it. Worth knowing before writing the next
--   one of these.
-- * **`00016`'s rollback would re-grant `anon` SELECT on this table** if `00016` is ever
--   applied and then rolled back. That is survivable *because* the four policies below are
--   `TO authenticated`: the grant would come back, and RLS would still deny `anon` every
--   row, since no policy names it. The revoke and the role restriction are two independent
--   locks on purpose.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================
--
-- Capture what must not move, and refuse to run against a table somebody has already
-- reshaped. Deliberately not idempotent: the ledger row in section 6 is what stops a
-- re-apply, and a second run finding its own policies in place should say so loudly rather
-- than quietly re-writing them.

DO $$
DECLARE
  v_n     INTEGER;
  v_cmd   TEXT;
  v_qual  TEXT;
  v_chk   TEXT;
  v_bad   TEXT;
BEGIN
  -- 0a. The three relations this file reasons about.
  IF to_regclass('public.shadchan_notes') IS NULL THEN
    RAISE EXCEPTION 'MEXA-419: public.shadchan_notes does not exist - 20250114_shidduch_system_fixed.sql is not applied';
  END IF;
  IF to_regclass('public.shadchanim') IS NULL THEN
    RAISE EXCEPTION 'MEXA-419: public.shadchanim does not exist - 00005_orthodox_mode.sql is not applied, and the FK in section 1 has nothing to point at';
  END IF;
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'MEXA-419: public.users does not exist';
  END IF;

  -- 0b. RLS is on. Without it the policies below decide nothing.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.shadchan_notes'::regclass) THEN
    RAISE EXCEPTION 'MEXA-419: row level security is not enabled on shadchan_notes';
  END IF;

  -- 0c. Exactly the one defective policy, exactly as measured. More than one means a policy
  -- this file does not know about is also deciding these writes; a different shape means it
  -- has already been fixed, or superseded, and must not be re-written.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'shadchan_notes';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-419: expected exactly 1 policy on shadchan_notes, found % - inspect them before running this file', v_n;
  END IF;

  SELECT cmd, qual, with_check INTO v_cmd, v_qual, v_chk FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'shadchan_notes' AND policyname = 'shadchan_notes_select_own';
  IF v_cmd IS NULL THEN
    RAISE EXCEPTION 'MEXA-419: the one policy on shadchan_notes is not named shadchan_notes_select_own';
  END IF;
  IF v_cmd <> 'ALL' OR v_qual IS DISTINCT FROM 'true' OR v_chk IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419: shadchan_notes_select_own is not the policy this file was written against (cmd=%, qual=%, with_check=%); 00037 looks applied or superseded', v_cmd, v_qual, v_chk;
  END IF;

  -- 0d. No FK on shadchan_id yet, and no helper yet.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.shadchan_notes'::regclass AND contype = 'f'
       AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                            WHERE attrelid = 'public.shadchan_notes'::regclass AND attname = 'shadchan_id')]
  ) THEN
    RAISE EXCEPTION 'MEXA-419: shadchan_notes.shadchan_id already has a foreign key - read it before adding another';
  END IF;
  IF to_regprocedure('public.current_shadchan_ids()') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419: public.current_shadchan_ids() already exists; 00037 looks applied';
  END IF;

  -- 0e. Nothing else writes this table on a caller's behalf. A SECURITY INVOKER trigger on
  -- another table would write it as the client and could be broken by a revoke (MEXA-418's
  -- probe H1); measured on live, there is no such trigger, no function whose body names the
  -- table, no view over it and no realtime publication membership
  -- (`.scratch/mazal-mexa419/SCHEMA.txt`). Assert the trigger half here, since it is the
  -- half a later migration could change.
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.shadchan_notes'::regclass AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'MEXA-419: shadchan_notes carries a user trigger; inspect what it writes before changing this table''s grants';
  END IF;

  -- 0f. Every existing row must already name a real matchmaker, or section 1 would either
  -- fail with a bare FK violation or - worse, had it been written NOT VALID - leave rows
  -- behind that the policy can never match. Live has 0 rows; say so if that changes.
  SELECT count(*)::text INTO v_bad FROM public.shadchan_notes sn
   WHERE NOT EXISTS (SELECT 1 FROM public.shadchanim s WHERE s.id = sn.shadchan_id);
  IF v_bad <> '0' THEN
    RAISE EXCEPTION 'MEXA-419: % shadchan_notes row(s) have a shadchan_id that is not a shadchanim.id. This file assumes the column means shadchanim.id (see DECISION 1). Decide what those rows are before adding the foreign key - do not widen the policy to accommodate them', v_bad;
  END IF;

  -- 0g. The table comment is NULL today, and the rollback restores NULL. If something has
  -- written one since, this file would silently overwrite it.
  IF obj_description('public.shadchan_notes'::regclass, 'pg_class') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419: shadchan_notes already carries a table comment ("%"); 00037 would overwrite it and its rollback would null it', obj_description('public.shadchan_notes'::regclass, 'pg_class');
  END IF;

  -- 0h. The before-state section 7 proves this file did not move.
  PERFORM set_config('mexa419.rows',
    (SELECT count(*)::text FROM public.shadchan_notes), false);
  PERFORM set_config('mexa419.policies',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public'), false);
  PERFORM set_config('mexa419.relacl',
    (SELECT coalesce(relacl::text, '') FROM pg_class WHERE oid = 'public.shadchan_notes'::regclass), false);
END
$$;

-- ===================================================================================
-- 1. `shadchan_id` names a real matchmaker
-- ===================================================================================
--
-- See DECISION 1. Validated, not `NOT VALID`: guard 0f has just proved there is nothing to
-- validate against, and a `NOT VALID` constraint here would be a promise the policy relies
-- on that the database has not actually checked.

ALTER TABLE public.shadchan_notes
  ADD CONSTRAINT shadchan_notes_shadchan_id_fkey
  FOREIGN KEY (shadchan_id) REFERENCES public.shadchanim(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.shadchan_notes.shadchan_id IS
  'The shadchanim.id whose private notes these are (MEXA-419). It is the owner column: all '
  'four RLS policies on this table are "shadchan_id is one of mine" and nothing else. It had '
  'no foreign key until 00037 - see that file''s DECISION 1 for why it is shadchanim(id) and '
  'not users(id), which is what the unrelated users.shadchan_id column means.';

-- ===================================================================================
-- 2. `current_shadchan_ids()` - who the caller is, as a matchmaker
-- ===================================================================================
--
-- See DECISION 3: SECURITY DEFINER so the predicate does not inherit `shadchanim`'s own RLS,
-- which would silently cut a deactivated matchmaker off from their own notes.

CREATE OR REPLACE FUNCTION public.current_shadchan_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
-- pg_temp last, and named explicitly: Postgres searches the session's temp schema for
-- relation names ahead of everything else unless it is listed (00028's finding, 00032's pin).
SET search_path = public, pg_temp
AS $$
  SELECT s.id
  FROM shadchanim s
  JOIN users u ON u.id = s.user_id
  WHERE u.auth_id = auth.uid();
$$;

COMMENT ON FUNCTION public.current_shadchan_ids() IS
  'The shadchanim.id rows belonging to the caller - usually zero or one, since '
  'shadchanim.user_id is UNIQUE. SECURITY DEFINER so RLS policies on shadchan_notes do not '
  'inherit shadchanim''s own SELECT policy (is_active = true), which would cut a deactivated '
  'matchmaker off from their own notes (MEXA-419). Returns the empty set when auth.uid() is '
  'NULL, so every predicate built on it fails closed.';

-- `FROM PUBLIC, anon`, not `FROM PUBLIC`. This project carries
-- `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon` (grantor
-- `postgres`, measured in `.scratch/mazal-mexa419/SCHEMA.txt`), so a new function is born
-- with `anon=X/postgres` as a **direct** grant to a named role - which `REVOKE ... FROM
-- PUBLIC` does not touch, because `PUBLIC` is a different grantee. 00010 established the
-- `FROM PUBLIC, anon` form for exactly this reason; 00009's helpers use the shorter form and
-- had to be cleaned up afterwards. Written the short way first here, this file's own
-- post-check 7f aborted the apply with `acl={...,anon=X/postgres,...}` - see the issue.
REVOKE ALL ON FUNCTION public.current_shadchan_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_shadchan_ids() TO authenticated, service_role;

-- ===================================================================================
-- 3. Four policies, one per command, each scoped to the owning shadchan
-- ===================================================================================
--
-- `FOR ALL` is not reused. Four separate policies are what make the INSERT and UPDATE checks
-- visible as `with_check` in the catalog instead of being implied by a `USING` clause, which
-- is precisely the reading mistake that let `USING (true)` stand as a write policy for eight
-- months. `TO authenticated` on all four: `anon` is named by no policy, so RLS denies it
-- every row even if a grant is ever handed back (see WHAT THIS FILE DOES NOT FIX).

DROP POLICY "shadchan_notes_select_own" ON public.shadchan_notes;

CREATE POLICY "shadchan_notes_select_own"
  ON public.shadchan_notes FOR SELECT
  TO authenticated
  USING (shadchan_notes.shadchan_id IN (SELECT public.current_shadchan_ids()));

-- The INSERT check is what stops a note being forged under another matchmaker's id - probe
-- P4d, ALLOWED before this file.
CREATE POLICY "shadchan_notes_insert_own"
  ON public.shadchan_notes FOR INSERT
  TO authenticated
  WITH CHECK (shadchan_notes.shadchan_id IN (SELECT public.current_shadchan_ids()));

-- The dangerous UPDATE is `SET shadchan_id = <another matchmaker>`, which plants a note in
-- their list and takes it out of yours - the MEXA-406 / MEXA-418 shape, reachable here
-- through the owner column itself. It is refused, and **the explicit `WITH CHECK` below is
-- not what refuses it.** Measured, `.scratch/mazal-mexa419/diag3.mjs`, scenarios S1-S6:
--
--   UPDATE policy         SELECT policy        C moves their own note into D's list
--   --------------------  -------------------  ------------------------------------
--   USING+CHECK, ours     ours                 refused 42501   (as shipped)
--   USING only, ours      ours                 refused 42501
--   USING only, ours      widened to `true`    refused 42501
--   blind to shadchan_id  ours                 refused 42501
--   ours                  blind to shadchan_id refused 42501
--   blind to shadchan_id  blind to shadchan_id ALLOWED, 1 row
--
-- Two independent locks, and it took mutating each one alone to tell them apart:
--
--   1. For a `FOR UPDATE` policy a NULL `WITH CHECK` **falls back to `USING`**, and this
--      `USING` reads `shadchan_id` - so it already refuses the move. That is the difference
--      from MEXA-406, where the `USING` was blind to the column being changed and the
--      fallback therefore permitted everything. Writing the two expressions out is for the
--      reader, not for the engine: `FOR ALL USING (true)` stood here for eight months
--      partly because nobody reading `pg_policies` saw a `with_check` and asked what
--      governed writes. An explicit one cannot be misread.
--   2. On this server the **SELECT policy is applied to the new row of an UPDATE as well**,
--      so even a `USING`/`WITH CHECK` pair blind to `shadchan_id` is refused while the
--      SELECT policy reads it. Do not lean on that: it is a property of there being a
--      SELECT policy at all, and a future `FOR UPDATE` policy on a table without one would
--      not get it. The two expressions below are the rule; that is the backstop.
--
-- They are identical on purpose: a row is mine before the write and still mine after it.
CREATE POLICY "shadchan_notes_update_own"
  ON public.shadchan_notes FOR UPDATE
  TO authenticated
  USING      (shadchan_notes.shadchan_id IN (SELECT public.current_shadchan_ids()))
  WITH CHECK (shadchan_notes.shadchan_id IN (SELECT public.current_shadchan_ids()));

CREATE POLICY "shadchan_notes_delete_own"
  ON public.shadchan_notes FOR DELETE
  TO authenticated
  USING (shadchan_notes.shadchan_id IN (SELECT public.current_shadchan_ids()));

-- ===================================================================================
-- 4. `anon` loses the table
-- ===================================================================================
--
-- `anon` is the role behind the anon key, which ships in the app binary and in the public
-- git history. It has no business holding `arwd` on a matchmaker's private notes. The
-- policies in section 3 already deny it - no policy names `anon` - so this is the second of
-- two independent locks, not the only one. `authenticated` keeps `arwd`: RLS now scopes all
-- four commands to the owning shadchan, which is what those grants are for.

REVOKE ALL PRIVILEGES ON TABLE public.shadchan_notes FROM anon;

COMMENT ON TABLE public.shadchan_notes IS
  'A shadchan''s private working notes on a candidate, keyed by shadchan_id + profile_id. '
  'Shadchan-only: all four policies are "shadchan_id IN (SELECT current_shadchan_ids())" and '
  'none of them mentions profile_id, so the person the notes are about cannot read them - '
  'see 00037''s DECISION 2 before widening that. shadchan_id is shadchanim.id (DECISION 1). '
  'anon holds nothing here and is named by no policy (MEXA-419). Before 00037 the single '
  'policy was FOR ALL USING (true) and any signed-in user could read, rewrite, delete and '
  'forge every row. Nothing in the app touches this table yet.';

-- =====================================================
-- 5. (intentionally empty)
-- =====================================================
--
-- No column grant is narrowed and no data is migrated. Section numbering is kept so the
-- ledger row and the assertions stay at the numbers the issue comment names.

-- =====================================================
-- 6. Ledger row, in this transaction (MEXA-325)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00037', 'shadchan_notes_belong_to_their_shadchan')
ON CONFLICT DO NOTHING;

-- ===================================================================================
-- 7. Assert the result, in the same transaction
-- ===================================================================================
--
-- A policy that is too wide fails open and stays quiet, and this table holds 0 rows, so
-- nothing in the app would ever notice. These checks are what make the claims above true of
-- the objects that actually landed rather than of the ones this file describes. The
-- behaviour itself - the four probes refused, a real shadchan's own four commands still
-- working - is measured as the real `authenticated` role in
-- `.scratch/mazal-mexa419/rehearse.mjs`, which a policy catalog cannot do.

DO $$
DECLARE
  v_rows_before   INTEGER := current_setting('mexa419.rows')::INTEGER;
  v_pols_before   INTEGER := current_setting('mexa419.policies')::INTEGER;
  v_acl_before    TEXT    := current_setting('mexa419.relacl');
  v_n             INTEGER;
  v_bad           TEXT;
  v_pred CONSTANT TEXT    := '(shadchan_id IN ( SELECT current_shadchan_ids() AS current_shadchan_ids))';
BEGIN
  -- 7a. Exactly four policies, one per command, named and shaped as section 3 wrote them.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'shadchan_notes';
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'MEXA-419: expected 4 policies on shadchan_notes, found %', v_n;
  END IF;

  SELECT string_agg(format('%s:%s', policyname, cmd), ', ' ORDER BY policyname) INTO v_bad
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shadchan_notes';
  IF v_bad <> 'shadchan_notes_delete_own:DELETE, shadchan_notes_insert_own:INSERT, shadchan_notes_select_own:SELECT, shadchan_notes_update_own:UPDATE' THEN
    RAISE EXCEPTION 'MEXA-419: the policy set on shadchan_notes is not the four this file wrote: %', v_bad;
  END IF;

  -- 7b. Not one of them is permissive-and-constant, in either expression. This is the
  -- assertion that would have caught the original defect.
  SELECT string_agg(format('%s qual=%s check=%s', policyname, qual, with_check), '; ' ORDER BY policyname)
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'shadchan_notes'
     AND (qual = 'true' OR with_check = 'true');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419: a shadchan_notes policy still has a constant-true expression: %', v_bad;
  END IF;

  -- 7c. Every expression that exists is the ownership predicate, and no policy is missing
  -- the expression its command needs. SELECT/DELETE: qual only. INSERT: with_check only.
  -- UPDATE: both - the half that stops a row being moved to another shadchan.
  SELECT string_agg(format('%s qual=%s check=%s', policyname, coalesce(qual, '<null>'), coalesce(with_check, '<null>')), '; ' ORDER BY policyname)
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'shadchan_notes'
     AND NOT (
       (policyname IN ('shadchan_notes_select_own', 'shadchan_notes_delete_own')
          AND qual = v_pred AND with_check IS NULL)
    OR (policyname = 'shadchan_notes_insert_own'
          AND qual IS NULL AND with_check = v_pred)
    OR (policyname = 'shadchan_notes_update_own'
          AND qual = v_pred AND with_check = v_pred)
     );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419: a shadchan_notes policy does not carry the expected ownership predicate in the expected halves: %', v_bad;
  END IF;

  -- 7d. All four are permissive and reach `authenticated` only. `public` in `roles` would
  -- silently let `anon` back in if a grant ever returned.
  SELECT string_agg(format('%s roles=%s permissive=%s', policyname, roles::text, permissive), '; ' ORDER BY policyname)
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'shadchan_notes'
     AND (roles::text <> '{authenticated}' OR permissive <> 'PERMISSIVE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419: a shadchan_notes policy is not a PERMISSIVE policy TO authenticated only: %', v_bad;
  END IF;

  -- 7e. The foreign key landed, points where DECISION 1 says, and is validated.
  SELECT pg_get_constraintdef(oid) INTO v_bad FROM pg_constraint
   WHERE conrelid = 'public.shadchan_notes'::regclass AND conname = 'shadchan_notes_shadchan_id_fkey';
  IF v_bad IS DISTINCT FROM 'FOREIGN KEY (shadchan_id) REFERENCES shadchanim(id) ON DELETE CASCADE' THEN
    RAISE EXCEPTION 'MEXA-419: shadchan_notes_shadchan_id_fkey is missing or not the constraint section 1 wrote: %', coalesce(v_bad, '<absent>');
  END IF;
  IF NOT (SELECT convalidated FROM pg_constraint
           WHERE conrelid = 'public.shadchan_notes'::regclass AND conname = 'shadchan_notes_shadchan_id_fkey') THEN
    RAISE EXCEPTION 'MEXA-419: shadchan_notes_shadchan_id_fkey is NOT VALID - the policy would be relying on an unchecked promise';
  END IF;

  -- 7f. The helper is DEFINER, STABLE, pinned with pg_temp last, and reachable by exactly
  -- three roles. The ACL is matched as a whole string rather than probed for `anon`,
  -- because the interesting failure is an entry nobody thought about: the default privilege
  -- on this project hands `anon` EXECUTE on every new function in `public`, and a `PUBLIC`
  -- entry (`=X/postgres`, with an empty grantee) would be invisible to a LIKE on 'anon'.
  SELECT format('secdef=%s volatile=%s config=%s acl=%s', p.prosecdef, p.provolatile, p.proconfig::text, p.proacl::text)
    INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'current_shadchan_ids'
     AND (p.prosecdef IS NOT TRUE
       OR p.provolatile <> 's'
       OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']
       OR p.proacl IS NULL
       OR p.proacl::text <> '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419: public.current_shadchan_ids() is not the function section 2 wrote: %', v_bad;
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'current_shadchan_ids') <> 1 THEN
    RAISE EXCEPTION 'MEXA-419: public.current_shadchan_ids() has more than one signature';
  END IF;

  -- 7g. anon holds nothing on this table, at table OR column level, and authenticated still
  -- holds all four. `has_table_privilege` rather than information_schema, because it folds
  -- in PUBLIC and role membership - a REVOKE that hit nothing is otherwise silent.
  SELECT string_agg(p.priv, ', ' ORDER BY p.priv) INTO v_bad
    FROM (VALUES ('INSERT'),('SELECT'),('UPDATE'),('DELETE'),
                 ('TRUNCATE'),('TRIGGER'),('REFERENCES'),('MAINTAIN')) AS p(priv)
   WHERE has_table_privilege('anon', 'public.shadchan_notes'::regclass, p.priv);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419: anon still holds % on shadchan_notes', v_bad;
  END IF;

  SELECT string_agg(format('%s:%s', a.attname, p.priv), ', ' ORDER BY a.attname, p.priv) INTO v_bad
    FROM pg_attribute a
   CROSS JOIN (VALUES ('INSERT'),('SELECT'),('UPDATE'),('REFERENCES')) AS p(priv)
   WHERE a.attrelid = 'public.shadchan_notes'::regclass AND a.attnum > 0 AND NOT a.attisdropped
     AND has_column_privilege('anon', a.attrelid, a.attnum, p.priv);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419: anon still holds column privileges on shadchan_notes: %', v_bad;
  END IF;

  SELECT string_agg(p.priv, ', ' ORDER BY p.priv) INTO v_bad
    FROM (VALUES ('INSERT'),('SELECT'),('UPDATE'),('DELETE')) AS p(priv)
   WHERE NOT has_table_privilege('authenticated', 'public.shadchan_notes'::regclass, p.priv);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-419: authenticated lost % on shadchan_notes - this file only revokes anon', v_bad;
  END IF;

  -- 7h. Nothing else moved: no rows touched, no column grants invented, and the rest of the
  -- schema still has the policies it started with (one dropped, four created).
  IF (SELECT count(*) FROM public.shadchan_notes) <> v_rows_before THEN
    RAISE EXCEPTION 'MEXA-419: the row count changed (% -> %)', v_rows_before, (SELECT count(*) FROM public.shadchan_notes);
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') <> v_pols_before + 3 THEN
    RAISE EXCEPTION 'MEXA-419: expected % policies in public (% before, -1 +4), found %',
      v_pols_before + 3, v_pols_before, (SELECT count(*) FROM pg_policies WHERE schemaname = 'public');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute
              WHERE attrelid = 'public.shadchan_notes'::regclass AND attnum > 0
                AND NOT attisdropped AND attacl IS NOT NULL) THEN
    RAISE EXCEPTION 'MEXA-419: a column-level grant appeared on shadchan_notes; this file grants nothing';
  END IF;

  -- 7i. The one thing the rollback needs to be able to restore: what `relacl` was, and that
  -- the only difference is anon's entry. Recorded here so a failed apply is diagnosable.
  RAISE NOTICE 'MEXA-419: shadchan_notes relacl % -> %', v_acl_before,
    (SELECT relacl::text FROM pg_class WHERE oid = 'public.shadchan_notes'::regclass);
END
$$;

COMMIT;
