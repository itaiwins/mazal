-- Mazal - an unmatch can no longer be undone by the person who was unmatched
--
-- MEXA-418. Rollback: supabase/rollback/00036_unmatch_is_one_way_rollback.sql
--
-- =====================================================
-- WHAT IS WRONG TODAY
-- =====================================================
--
-- Measured by execution against `tayiyczmacvhokdxfqvm` on 2026-09-29, as real
-- `authenticated` callers inside a rolled-back transaction (MEXA-414's
-- `.scratch/mazal-mexa414/probe.mjs`, probes P1a-P1h; re-measured for this file in
-- `.scratch/mazal-mexa418/rehearse.mjs`):
--
--   B unmatches A - the app's own write, `user2_unmatched = true, is_active = false`
--                                                     -> ALLOWED, 1 row
--   A's match list (`… .eq('is_active', true)`)       -> 0 rows, the match is gone
--   A sends into the dead thread                      -> refused 42501 (messages INSERT
--                                                        policy does check `m.is_active`)
--   A sets `is_active = true, user2_unmatched = false`-> **ALLOWED, 1 row**
--   A sends again                                     -> ALLOWED, 1 row
--   B's match list afterwards                         -> 1 row, both flags false
--
-- Unmatching is the app's "get this person away from me" control (`useUnmatch`,
-- src/api/mutations/useMatch.ts:41). Today the person it was used against can put the
-- match back and resume the thread, and nothing in the row records that it ever happened -
-- the resurrecting write clears the flag too.
--
-- =====================================================
-- WHY IT IS POSSIBLE
-- =====================================================
--
-- The same class 00034 (MEXA-406) closed on `messages`: **a client role holds an
-- over-broad UPDATE grant on a table whose policy `USING` expression is invariant under
-- changing a security-relevant column.**
--
-- `Users can update own matches` is `USING (user1_id = me OR user2_id = me)` with a NULL
-- `with_check`. A NULL `with_check` on an UPDATE policy means the `USING` expression is
-- applied to the new row as well (settled by execution in 00034, not by argument), so the
-- policy is not missing a check - it is checking the wrong thing. Flipping `is_active` or
-- either `*_unmatched` flag does not change match membership, so the expression is true
-- before and after and has nothing to say. The control in the same run: repointing the row
-- at a stranger (`user1_id = <someone else>`) **is** refused, because `USING` reads that
-- column.
--
-- And `authenticated` (and `anon`) hold UPDATE on the table, which expands to every column:
-- `is_active`, `user1_unmatched`, `user2_unmatched` included.
--
-- No policy can close this. A `WITH CHECK` expression sees only the NEW row; there is no
-- `OLD`, so "is_active may go true->false but never false->true" is not expressible there.
-- That leaves a column privilege or a trigger - and a column privilege alone cannot express
-- it either, because `is_active` is the column the legitimate unmatch writes. The write has
-- to move somewhere that can see both the old row and the caller. That is this file's
-- `public.unmatch(uuid)`.
--
-- =====================================================
-- WHAT THE CLIENT ACTUALLY WRITES TO `matches`
-- =====================================================
--
-- `git grep "from('matches')"` finds ten call sites. Eight are SELECT. The two writes are
-- both in src/api/mutations/useMatch.ts:
--
--   useUnmatch (:41)     UPDATE { <my side>_unmatched: true, is_active: false } WHERE id
--   useBlockUser (:100)  UPDATE { is_active: false } WHERE id IN (my matches with them)
--
-- Both are unmatches, and the same commit as this migration routes both through the new
-- function. `useBlockUser` gains something on the way: today it sets `is_active = false`
-- and leaves **both** `*_unmatched` flags false, so a block records no side at all. Through
-- `unmatch()` it sets the blocker's flag, like every other unmatch.
--
-- **Rewind does not write this table.** MEXA-418 asked for the Rewind path to be measured
-- first, because 00025 was thought to reactivate a match it had just deactivated. It does
-- not: `public.undo_last_swipe()` refuses outright when the pair has a `matches` row
-- (`reason = 'matched'`) and never touches `matches` at all - read 00025's "Why a rewind
-- refuses once the pair has matched". Re-measured in the rehearsal after this file is
-- applied: `undo_last_swipe()` still returns `matched` for a matched pair and still deletes
-- the swipe for an unmatched one. Nothing in the Rewind path needs the grant this file
-- takes away.
--
-- Re-matching after an unmatch is likewise not a thing that goes through here:
-- `check_for_match()` (00017) is the only INSERT into `matches`, it is SECURITY DEFINER so
-- it is unaffected by client grants, and it is `ON CONFLICT (user1_id, user2_id) DO
-- NOTHING`, so a second mutual like on an unmatched pair cannot revive the row either.
--
-- =====================================================
-- THE ONE GRANT THAT HAS TO SURVIVE: last_message_at
-- =====================================================
--
-- This is the trap in this migration, and it is why the fix is not a bare
-- `REVOKE UPDATE ON matches`.
--
-- `update_match_last_message()` (00001) is an AFTER INSERT trigger on `messages` that runs
-- `UPDATE matches SET last_message_at = NEW.created_at WHERE id = NEW.match_id`. It is
-- **SECURITY INVOKER**, so it runs as `authenticated` and needs a real UPDATE privilege on
-- `matches`. docs/TRIGGER_FUNCTION_SECURITY_AUDIT.md finding 1 (MEXA-296) already says it
-- "works by accident, not by design"; 00028 deliberately left it alone.
--
-- Measured in the rehearsal: with UPDATE revoked outright, **every message send fails**
-- with `42501 permission denied for table matches`. The whole chat feature, not a corner of
-- it. So this file grants the one column back:
--
--   GRANT UPDATE (last_message_at) ON public.matches TO authenticated;
--
-- What that hands a patched client is the ability to set `last_message_at` on a match it is
-- in. `git grep last_message_at` over `src/` and `app/` finds it **only in the generated
-- types** - no screen reads it, no query orders by it (`useMatches` orders by `created_at`).
-- So the cost is writing a column nothing reads, and the benefit is that chat keeps working
-- without changing a trigger function on the message-send hot path in a security migration.
--
-- The alternative - making `update_match_last_message()` SECURITY DEFINER and granting no
-- column at all - is strictly tighter and is the right end state. It is deliberately **not**
-- done here: it is MEXA-296's finding, it changes behaviour for every message sent, and it
-- wants its own review rather than riding along on this one. Filed as a follow-up. If it
-- lands, the correct change to this file's result is to drop the column grant; section 4's
-- post-check names the trigger so that migration cannot forget this one exists.
--
-- =====================================================
-- ORDER, AND THE OTHER MIGRATIONS THAT TOUCH `matches`
-- =====================================================
--
-- Depends on 00001 (the table), 00002 (the policy) and 00010 (`current_app_user_id()`). All
-- applied. Checked against every migration in the repo that names `matches`, because a grant
-- narrowing is exactly the change that makes someone else's post-check abort:
--
--   * **00016 is on the branch and NOT applied** (live still shows `authenticated:DELETE`
--     on `matches` and `anon` holding everything). Its section 3 revokes `matches` DELETE
--     and its 7b asserts that stuck - this file does not touch DELETE. Its 7c is the "must
--     STILL be granted" list: `matches:INSERT`, `safta_likes:UPDATE`,
--     `shidduch_suggestions:INSERT/UPDATE`. **`matches:UPDATE` is not in it**, so narrowing
--     it here cannot make 00016 abort in either order. Its 7a requires `anon` to hold no
--     table privilege anywhere, which this file moves towards, not away from.
--   * 00016 section 6 writes `COMMENT ON TABLE public.matches`. This file writes **column**
--     comments instead, so neither overwrites the other and neither rollback has to know
--     about the other (00034's handling of the same collision, and MEXA-361's lesson).
--   * 00017 made `check_for_match()` SECURITY DEFINER and left `matches` with no INSERT
--     policy on purpose. Untouched here; section 4 asserts it is still DEFINER.
--   * 00025/00033/00035 own `undo_last_swipe()`, which does not write `matches`. Untouched;
--     section 5l asserts the function is still there, still refuses on `matched`, and still
--     contains no UPDATE of this table. **00035 is not applied to `tayiyczmacvhokdxfqvm`**
--     (the live ledger on 2026-09-29 runs 00000-00011, 00013-00015, 00017-00025, 00030,
--     00032-00034 plus the two dated files - no 00012, 00016, 00026, 00028, 00029, 00031 or
--     00035), so live runs 00033's body with no entitlement gate; 5l branches on the ledger
--     rather than assuming.
--   * 00018/00294's realtime work published `matches`. A grant change does not alter a
--     publication; section 4 asserts membership survived.
--
-- =====================================================
-- WHAT THIS FILE DELIBERATELY DOES NOT DO
-- =====================================================
--
--   * **No policy change.** Asserted in section 4a. See "why it is possible" - a mirrored
--     `WITH CHECK` would be a no-op, and a no-op statement in a security migration is worse
--     than no statement because the next reader believes it is doing work (00034's lesson).
--   * **No change to `matches` INSERT, SELECT or DELETE grants.** INSERT is refused by the
--     absent policy and 00016 owns the decision to keep it; DELETE is 00016's.
--   * **No revival path, for anyone.** There is deliberately no `rematch()`. Two people who
--     want to be matched again after an unmatch have no route back today (their `swipes`
--     rows persist, so neither reappears in the other's deck), and inventing one inside a
--     security fix would be shipping a product decision nobody made.
--   * **No account-deletion or re-entry change.** 00012/00029 run as `service_role` or as
--     DEFINER functions, neither of which is affected by a client grant.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================
--
-- Everything below is a fact the rest of this file relies on. Checking them here means a
-- database that does not match gets an abort instead of a half-applied narrowing.

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 0a. Not already applied.
  IF to_regprocedure('public.unmatch(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-418: public.unmatch(uuid) already exists - 00036 is already applied';
  END IF;

  -- 0b. No other function is already called `unmatch` in `public`. PostgREST publishes by
  -- name, and the REVOKE/GRANT in section 2 names one signature.
  SELECT count(*) INTO v_n
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname = 'unmatch';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MEXA-418: % function(s) already named public.unmatch - reconcile before applying', v_n;
  END IF;

  -- 0c. The identity helper from 00010. The function takes a match id, never a user id, and
  -- this is where the caller comes from.
  IF to_regprocedure('public.current_app_user_id()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-418: public.current_app_user_id() is missing - apply 00010 first';
  END IF;
  SELECT string_agg(format('secdef=%s config=%s', p.prosecdef, p.proconfig), ', ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.current_app_user_id()')
     AND (p.prosecdef IS NOT TRUE OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-418: current_app_user_id() is not DEFINER with search_path=public: %', v_bad;
  END IF;

  -- 0d. `matches` is the shape this file reads and writes, by name. If a column was added
  -- since the measurement, the "which columns may a client write" answer has changed and
  -- somebody has to decide about the new one rather than have it silently revoked.
  SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
    INTO v_bad
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'matches';
  IF v_bad IS DISTINCT FROM 'id,user1_id,user2_id,created_at,is_active,user1_unmatched,user2_unmatched,last_message_at' THEN
    RAISE EXCEPTION 'MEXA-418: public.matches columns are [%], not the eight this file was measured against', v_bad;
  END IF;

  -- 0e. RLS is on and the UPDATE policy is the one described above. A column grant is only
  -- half a rule: with RLS off the `USING` clause stops running and `last_message_at` would
  -- be writable on *every* match, not just the caller's own.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.matches'::regclass) THEN
    RAISE EXCEPTION 'MEXA-418: row level security is off on public.matches';
  END IF;

  SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname)
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'matches';
  IF v_bad IS DISTINCT FROM 'Users can update own matches:UPDATE, Users can view own matches:SELECT' THEN
    RAISE EXCEPTION 'MEXA-418: public.matches policies are [%], not the two from 00002 - reconcile before narrowing the grant', v_bad;
  END IF;

  -- 0f. The grant this file narrows is actually there. If it is already gone, somebody else
  -- has been here and the column grant below could be re-widening rather than narrowing.
  IF NOT has_table_privilege('authenticated', 'public.matches'::regclass, 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-418: authenticated does not hold table-wide UPDATE on public.matches - the state this file was measured against is gone';
  END IF;

  -- 0g. No column-level UPDATE grants exist yet. `REVOKE UPDATE ON TABLE` removes the
  -- table-wide grant but **cannot** cut a column grant, so one hiding here would survive
  -- section 1 and silently keep a column writable.
  SELECT string_agg(format('%s:%s:%s', a.attname, g.grantee, g.privilege_type), ', ' ORDER BY a.attname)
    INTO v_bad
    FROM pg_attribute a
   CROSS JOIN LATERAL aclexplode(a.attacl) g
   WHERE a.attrelid = 'public.matches'::regclass
     AND a.attacl IS NOT NULL
     AND g.privilege_type = 'UPDATE';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-418: public.matches already carries column-level UPDATE grants [%] - a table REVOKE will not remove them', v_bad;
  END IF;

  -- 0h. The invoker trigger that makes the column grant in section 1 necessary. If it is
  -- gone or has become DEFINER, `GRANT UPDATE (last_message_at)` is handing out a privilege
  -- nothing needs, and this file should be reduced to the bare revoke.
  SELECT string_agg(format('%s(secdef=%s)', p.proname, p.prosecdef), ', ')
    INTO v_bad
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE t.tgrelid = 'public.messages'::regclass
     AND t.tgname = 'messages_update_match';
  IF v_bad IS NULL THEN
    RAISE EXCEPTION 'MEXA-418: trigger messages_update_match is missing from public.messages - re-decide the last_message_at grant before applying';
  END IF;
  IF v_bad NOT LIKE '%update_match_last_message(secdef=f)%' THEN
    RAISE EXCEPTION 'MEXA-418: messages_update_match is now [%]; it is no longer the SECURITY INVOKER trigger that needs UPDATE (last_message_at) - drop the grant in section 1 instead', v_bad;
  END IF;
END
$$;

-- =====================================================
-- 1. The grant: UPDATE on one column, for one role
-- =====================================================
--
-- Table-wide first. A column REVOKE cannot cut a table-wide grant, so the order matters:
-- revoke the table privilege, then hand back exactly the column that has to stay writable.
--
-- `anon` gets nothing back. Every policy on this table resolves `auth.uid()`, which is NULL
-- for `anon`, so it can already reach no row - but the anon key ships in every app binary
-- and is in this repo's public git history, so the grant is surface with no use. 00016
-- removes the rest of anon's privileges on every table; this is the same direction.
--
-- `service_role` is untouched: it keeps table-wide UPDATE, it holds BYPASSRLS, and anything
-- server-side that has to correct a match row does it directly.
REVOKE UPDATE ON TABLE public.matches FROM anon, authenticated;

-- The one write the client still makes to this table, and it is not the client's own
-- statement: `update_match_last_message()` is SECURITY INVOKER, so the AFTER INSERT trigger
-- on `messages` runs as the sender. Without this, every message send is
-- `42501 permission denied for table matches`. See the header.
GRANT UPDATE (last_message_at) ON TABLE public.matches TO authenticated;

-- =====================================================
-- 2. public.unmatch(uuid)
-- =====================================================
--
-- SECURITY DEFINER, so it runs as the owner and is not subject to the grant section 1 just
-- took away - which is the point: `authenticated` never needs UPDATE on `is_active` or on
-- either flag again.
--
-- It therefore checks identity itself. The caller comes from `current_app_user_id()`, never
-- from an argument, and the only row it will touch is one the caller is a participant in.
-- The side is decided by comparing the caller against `user1_id`/`user2_id`, which is the
-- thing a column grant could never express: `GRANT UPDATE (user1_unmatched)` does not know
-- which side you are.
--
-- **One-way by construction.** There is no branch anywhere in this body that writes
-- `is_active = TRUE` or `*_unmatched = FALSE`. It is also idempotent: called twice, the
-- second call rewrites the same two values and still answers `ok = true`, because "you are
-- not matched with this person" is true either way and the client should not have to tell a
-- fresh unmatch from a repeated one.
--
-- It does **not** ask whether the match is already inactive before writing. If the *other*
-- side unmatched first, this call still records the caller's own flag - so the row ends up
-- saying both people ended it, which is what happened. Losing that would be the same bug in
-- miniature.
--
-- `SET search_path = public` per supabase/MIGRATIONS.md.
--
-- Returns one row, always, rather than raising on the expected refusal:
--
--   ok=true,  reason=NULL         you are unmatched from this person
--   ok=false, reason='not_found'  no such match, or the caller is not in it
--
-- Deliberately one refusal string for both: telling a caller "that match exists but is not
-- yours" would confirm the existence of a row they cannot see, and the `matches` SELECT
-- policy is own-rows-only for exactly that reason. A refusal is data, not an exception, for
-- 00025's reason - PostgREST's SQLSTATE-to-HTTP mapping is not something this file should
-- bet the client's error handling on.
CREATE OR REPLACE FUNCTION public.unmatch(p_match_id UUID)
RETURNS TABLE (
  ok            BOOLEAN,
  reason        TEXT,
  match_id      UUID,
  other_user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := public.current_app_user_id();
  v_match  public.matches;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unmatch: no public.users row for this session'
      USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE so two taps in flight at once cannot interleave with each other, or with the
  -- other participant's unmatch, between the read of the side and the write of the flag.
  SELECT m.* INTO v_match
    FROM public.matches m
   WHERE m.id = p_match_id
     AND (m.user1_id = v_caller OR m.user2_id = v_caller)
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'not_found'::TEXT, p_match_id, NULL::UUID;
    RETURN;
  END IF;

  IF v_match.user1_id = v_caller THEN
    UPDATE public.matches
       SET user1_unmatched = TRUE, is_active = FALSE
     WHERE id = v_match.id;
    RETURN QUERY SELECT TRUE, NULL::TEXT, v_match.id, v_match.user2_id;
  ELSE
    UPDATE public.matches
       SET user2_unmatched = TRUE, is_active = FALSE
     WHERE id = v_match.id;
    RETURN QUERY SELECT TRUE, NULL::TEXT, v_match.id, v_match.user1_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.unmatch(UUID) IS
  'Ends a match, one way (MEXA-418). SECURITY DEFINER: the caller comes from '
  'current_app_user_id() and the side (user1_unmatched vs user2_unmatched) is decided from '
  'it, which is why public.matches needs no client UPDATE grant on is_active or on either '
  'flag. Nothing in this body sets is_active = true or a flag back to false, so an unmatch '
  'cannot be reversed by either participant. Idempotent. Returns one row: ok, plus '
  'reason = ''not_found'' when the match does not exist or is not the caller''s.';

-- PostgREST publishes every non-trigger function in `public` at /rest/v1/rpc/<name>, and
-- Supabase's ALTER DEFAULT PRIVILEGES has already granted EXECUTE to anon, authenticated
-- and service_role at CREATE time. Say it explicitly (supabase/MIGRATIONS.md).
--
-- `service_role` is left out on purpose, as in 00025: this function acts as "the signed-in
-- person", service_role has no `public.users` row, so every call would raise 42501 - and it
-- keeps table-wide UPDATE anyway.
REVOKE EXECUTE ON FUNCTION public.unmatch(UUID) FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION public.unmatch(UUID) TO authenticated;

-- =====================================================
-- 3. Column comments, so the next reader sees the rule in `\d+`
-- =====================================================
--
-- Column comments, not a table comment: 00016 section 6 writes `COMMENT ON TABLE
-- public.matches` and is not applied yet. Two files writing the same comment is how one
-- rollback quietly undoes another (MEXA-361).

COMMENT ON COLUMN public.matches.is_active IS
  'False once either participant has unmatched. NOT client-writable (MEXA-418): the write '
  'goes through public.unmatch(uuid), which only ever sets it false. Before 00036 the '
  'person who had been unmatched could set it back to true and resume the thread.';

COMMENT ON COLUMN public.matches.user1_unmatched IS
  'Set by public.unmatch(uuid) when user1_id ends the match. NOT client-writable '
  '(MEXA-418) - a column grant cannot tell which side the caller is, so the function picks '
  'the side from current_app_user_id().';

COMMENT ON COLUMN public.matches.user2_unmatched IS
  'Set by public.unmatch(uuid) when user2_id ends the match. NOT client-writable '
  '(MEXA-418) - see user1_unmatched.';

COMMENT ON COLUMN public.matches.last_message_at IS
  'Bumped by the update_match_last_message() AFTER INSERT trigger on messages. The only '
  'column of this table authenticated may UPDATE (MEXA-418), and only because that trigger '
  'is SECURITY INVOKER and would otherwise fail every message send with 42501. Nothing in '
  'src/ or app/ reads it. If MEXA-296 makes that trigger SECURITY DEFINER, revoke this '
  'column grant in the same migration.';

-- =====================================================
-- 4. Ledger row, in this transaction (MEXA-325)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00036', 'unmatch_is_one_way')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. Assert the result, in the same transaction
-- =====================================================
--
-- Catalog assertions only. What a real `authenticated` caller gets back is proven by
-- executing it - see the rehearsal named in supabase/MIGRATIONS.md - because a grant that
-- looks right in `information_schema` can still leave a path open.

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 5a. The policies are untouched. This file fixes the grant, not the policy, and a
  -- reader who finds a third policy here later should know it did not come from 00036.
  SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname)
    INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'matches';
  IF v_bad IS DISTINCT FROM 'Users can update own matches:UPDATE, Users can view own matches:SELECT' THEN
    RAISE EXCEPTION 'MEXA-418: public.matches policies are now [%] - 00036 must not change them', v_bad;
  END IF;

  -- 5b. RLS is still on. Without it the column grant in section 1 applies to every row.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.matches'::regclass) THEN
    RAISE EXCEPTION 'MEXA-418: row level security is off on public.matches';
  END IF;

  -- 5c. Neither client role holds table-wide UPDATE any more.
  --
  -- `has_table_privilege` is deliberately the test here: it answers about the **table**
  -- privilege and is blind to column grants, so it is exactly "is the broad grant gone?"
  -- and is not satisfied by the narrow one added below it.
  IF has_table_privilege('authenticated', 'public.matches'::regclass, 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-418: authenticated still holds table-wide UPDATE on public.matches';
  END IF;
  IF has_table_privilege('anon', 'public.matches'::regclass, 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-418: anon still holds table-wide UPDATE on public.matches';
  END IF;

  -- 5d. ...and the columns that carry the unmatch are not reachable by either of them
  -- through any grant, table or column. This is the assertion that actually says "the bug
  -- is closed"; 5c alone would pass with a column grant on is_active.
  SELECT string_agg(format('%s:%s', r.rolname, c.col), ', ' ORDER BY r.rolname, c.col)
    INTO v_bad
    FROM (VALUES ('anon'), ('authenticated')) AS r(rolname)
   CROSS JOIN (VALUES ('is_active'), ('user1_unmatched'), ('user2_unmatched'),
                      ('id'), ('user1_id'), ('user2_id'), ('created_at')) AS c(col)
   WHERE has_column_privilege(r.rolname, 'public.matches'::regclass, c.col, 'UPDATE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-418: these client roles can still UPDATE these matches columns: %', v_bad;
  END IF;

  -- 5e. ...and the one column that has to stay writable, is. The negative assertion above
  -- would also pass if section 1 had granted nothing, and that state breaks every message
  -- send.
  IF NOT has_column_privilege('authenticated', 'public.matches'::regclass, 'last_message_at', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-418: authenticated cannot UPDATE matches.last_message_at - update_match_last_message() would fail every message send with 42501';
  END IF;
  IF has_column_privilege('anon', 'public.matches'::regclass, 'last_message_at', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-418: anon holds UPDATE on matches.last_message_at - it was not meant to get anything back';
  END IF;

  -- 5f. SELECT, INSERT and DELETE are exactly as they were. This file narrows UPDATE and
  -- nothing else; 00016 owns INSERT and DELETE on this table.
  IF NOT has_table_privilege('authenticated', 'public.matches'::regclass, 'SELECT') THEN
    RAISE EXCEPTION 'MEXA-418: authenticated lost SELECT on public.matches - the whole matches list would go empty';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.matches'::regclass, 'INSERT') THEN
    RAISE EXCEPTION 'MEXA-418: authenticated lost INSERT on public.matches - 00016 section 7c asserts it is still granted';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.matches'::regclass, 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-418: service_role lost UPDATE on public.matches - the server-side correction path is gone';
  END IF;

  -- 5g. The function exists with the flags the argument above depends on. `provolatile`
  -- must be 'v': a STABLE function is not allowed to write, and PostgREST would publish it
  -- on GET.
  IF to_regprocedure('public.unmatch(uuid)') IS NULL THEN
    RAISE EXCEPTION 'MEXA-418: public.unmatch(uuid) was not created';
  END IF;
  SELECT string_agg(format('secdef=%s config=%s volatile=%s nargs=%s',
                           p.prosecdef, p.proconfig, p.provolatile, p.pronargs), ', ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.unmatch(uuid)')
     AND (p.prosecdef IS NOT TRUE
          OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']
          OR p.provolatile <> 'v'
          OR p.pronargs <> 1);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-418: unmatch(uuid) has the wrong flags: %', v_bad;
  END IF;

  -- 5h. No overloads. A second signature would be a second endpoint and the REVOKE above
  -- only covers this one.
  SELECT count(*) INTO v_n
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname = 'unmatch';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-418: % functions named unmatch in public, expected 1', v_n;
  END IF;

  -- 5i. The body is one-way, read off the catalog rather than trusted from the file. A
  -- later `CREATE OR REPLACE` that adds a revival branch fails this, and the whole point of
  -- the function is that there is no such branch.
  SELECT p.prosrc INTO v_bad FROM pg_proc p WHERE p.oid = to_regprocedure('public.unmatch(uuid)');
  IF v_bad ~* 'is_active\s*=\s*TRUE' OR v_bad ~* 'unmatched\s*=\s*FALSE' THEN
    RAISE EXCEPTION 'MEXA-418: the body of unmatch(uuid) contains a revival branch - it is meant to be one-way';
  END IF;

  -- 5j. The endpoint is reachable by exactly one role.
  --
  -- PUBLIC is checked off `proacl`, not with `has_function_privilege('public', ...)`: there
  -- is no role named `public`, so that call raises `undefined_object` instead of answering.
  -- `aclexplode` reports the PUBLIC entry as `grantee = 0`. A NULL `proacl` has to fail too
  -- - for a function the built-in default is EXECUTE **to PUBLIC**, so "no explicit ACL" is
  -- the open case, not the closed one.
  IF (SELECT p.proacl FROM pg_proc p WHERE p.oid = to_regprocedure('public.unmatch(uuid)')) IS NULL THEN
    RAISE EXCEPTION 'MEXA-418: unmatch(uuid) has no explicit ACL, which for a function means EXECUTE TO PUBLIC';
  END IF;

  SELECT string_agg(CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END, ', '
                    ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END)
    INTO v_bad
    FROM pg_proc p
   CROSS JOIN aclexplode(p.proacl) a
   WHERE p.oid = to_regprocedure('public.unmatch(uuid)')
     AND a.privilege_type = 'EXECUTE'
     AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) <> 'authenticated')
     AND a.grantee <> p.proowner;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-418: EXECUTE on unmatch(uuid) is held by [%] besides authenticated and the owner', v_bad;
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.unmatch(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-418: authenticated cannot EXECUTE unmatch(uuid) - unmatching would 403 for every real caller';
  END IF;
  IF has_function_privilege('anon', 'public.unmatch(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-418: anon still holds EXECUTE on unmatch(uuid)';
  END IF;

  -- 5k. The two neighbours this file leans on are untouched.
  --
  -- The invoker trigger is why section 1 grants a column back; if a later migration makes
  -- it DEFINER, this assertion is the one that should be deleted in the same change as the
  -- grant.
  SELECT string_agg(format('%s(secdef=%s)', p.proname, p.prosecdef), ', ')
    INTO v_bad
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
   WHERE t.tgrelid = 'public.messages'::regclass AND t.tgname = 'messages_update_match';
  IF v_bad IS DISTINCT FROM 'update_match_last_message(secdef=f)' THEN
    RAISE EXCEPTION 'MEXA-418: messages_update_match is now [%] - the last_message_at grant was justified by it being SECURITY INVOKER', v_bad;
  END IF;

  -- `check_for_match` is the only thing that creates a match, and it has to stay DEFINER:
  -- as INVOKER it would now be the *second* thing broken by the revoke.
  IF NOT (SELECT p.prosecdef FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
           WHERE t.tgrelid = 'public.swipes'::regclass AND t.tgname = 'swipes_check_match') THEN
    RAISE EXCEPTION 'MEXA-418: swipes_check_match is no longer SECURITY DEFINER - apply/repair 00017';
  END IF;

  -- 5l. Rewind is untouched. MEXA-418 named it as the path that must not break; it does not
  -- write `matches` at all, and this asserts the function is still there and still carries
  -- the branch that keeps it away from this table.
  --
  -- The `not_entitled` half is conditional on the ledger, not assumed: **00035 is not
  -- applied to `tayiyczmacvhokdxfqvm`** (measured 2026-09-29 - the ledger there ends
  -- 00033, 00034), so on live the body is 00033's and has no entitlement gate. Asserting it
  -- unconditionally aborted this migration's first rehearsal.
  IF to_regprocedure('public.undo_last_swipe()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-418: public.undo_last_swipe() is gone';
  END IF;
  SELECT p.prosrc INTO v_bad FROM pg_proc p WHERE p.oid = to_regprocedure('public.undo_last_swipe()');
  IF v_bad NOT LIKE '%matched%' THEN
    RAISE EXCEPTION 'MEXA-418: undo_last_swipe() no longer carries the "matched" branch - the one thing that keeps Rewind away from public.matches';
  END IF;
  IF v_bad ~* 'update\s+(public\.)?matches' THEN
    RAISE EXCEPTION 'MEXA-418: undo_last_swipe() now UPDATEs public.matches - it would need a grant this file has taken away';
  END IF;
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00035')
     AND v_bad NOT LIKE '%not_entitled%' THEN
    RAISE EXCEPTION 'MEXA-418: 00035 is in the ledger but undo_last_swipe() has no entitlement gate - its body has been overwritten';
  END IF;

  -- 5m. `matches` is still published to realtime (00018/MEXA-294). A grant change does not
  -- touch a publication, so this failing means something else did.
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'matches') THEN
    RAISE EXCEPTION 'MEXA-418: public.matches left the supabase_realtime publication';
  END IF;

  -- 5n. The comments actually say the new thing, by content and not merely non-NULL.
  IF coalesce(col_description('public.matches'::regclass,
       (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.matches'::regclass AND attname = 'is_active')), '')
     NOT LIKE '%NOT client-writable%' THEN
    RAISE EXCEPTION 'MEXA-418: the matches.is_active comment was not written';
  END IF;
  IF coalesce(col_description('public.matches'::regclass,
       (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.matches'::regclass AND attname = 'last_message_at')), '')
     NOT LIKE '%update_match_last_message%' THEN
    RAISE EXCEPTION 'MEXA-418: the matches.last_message_at comment does not say why the grant survives';
  END IF;

  -- 5o. The ledger row this file writes, so a later reader does not have to guess.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00036') THEN
    RAISE EXCEPTION 'MEXA-418: ledger row 00036 is missing';
  END IF;
END
$$;

COMMIT;
