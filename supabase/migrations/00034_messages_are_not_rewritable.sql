-- Mazal - a match participant can no longer rewrite the other person's messages
--
-- MEXA-406. Rollback: supabase/rollback/00034_messages_are_not_rewritable_rollback.sql
--
-- =====================================================
-- WHAT IS WRONG TODAY
-- =====================================================
--
-- Measured by execution against `tayiyczmacvhokdxfqvm` on 2026-09-29, as a real
-- `authenticated` caller inside rolled-back transactions
-- (`.scratch/mazal-mexa373/probe_messages.mjs`, then `.scratch/mazal-mexa406/`), not
-- inferred from the catalog:
--
--   * u1 sets `content` on a message **u2 sent**        -> UPDATE affected 1 row
--   * u1 sets `sender_id` on u2's message to u1         -> UPDATE affected 1 row
--   * u1 sets `is_read` / `read_at`                     -> UPDATE affected 1 row
--
-- The third is the legitimate use of the policy and the reason it exists. The first two are
-- the defect: one participant can put words in the other's mouth and then screenshot them,
-- and can reassign authorship of a message to themselves. `messages` has no audit column,
-- so afterwards nothing in the database says which version was real.
--
-- =====================================================
-- WHY IT IS POSSIBLE - AND NOT FOR THE REASON THE ISSUE FIRST GAVE
-- =====================================================
--
-- MEXA-406 was filed saying the cause was the UPDATE policy's NULL `with_check`, on the
-- reading that "`qual` gates which rows you may touch, `with_check` gates what you may turn
-- them into, and when it is NULL the USING clause is **not** reused for the new row".
--
-- **That is backwards, and it was settled by execution rather than by argument**
-- (`.scratch/mazal-mexa406/semantics.mjs`, PostgreSQL 17.6). For an UPDATE policy a NULL
-- `with_check` means the `USING` expression **is** applied to the new row as well. The
-- discriminating test is a write that changes the one column `USING` actually reads:
--
--   as u1, UPDATE messages SET match_id = <a match u1 is NOT in>
--     -> 42501, "new row violates row-level security policy for table messages"
--   as u1, UPDATE messages SET content = 'rewritten'   (match_id untouched)
--     -> ALLOWED, 1 row
--
-- So the new row *is* checked. The reason the rewrite gets through is different, and it
-- matters because it changes what the fix has to be:
--
--   **the policy's row filter is MATCH MEMBERSHIP, and a content rewrite does not change
--   match membership.** The check passes because it is true both before and after. The
--   expression says nothing about `content` or `sender_id`, so it cannot refuse a change
--   to either.
--
-- The same script proves the corollary directly: adding a `WITH CHECK` that mirrors the
-- `USING` clause changes **nothing** - both probes return identical results with and
-- without it. An earlier draft of this migration added exactly that mirror and called it
-- defence in depth. It was removed, because a no-op statement in a security migration is
-- worse than no statement: the next reader believes it is doing work.
--
-- This file therefore **does not touch the policy at all**, and section 4a asserts that.
--
-- =====================================================
-- WHY THE GRANT IS THE ONLY MECHANISM THAT CAN CLOSE IT
-- =====================================================
--
-- An RLS `WITH CHECK` expression sees only the NEW row; there is no `OLD` in a policy. So
-- no policy, however written, can say "content must not change". Column immutability is
-- expressible in exactly two places: a column privilege, or a `BEFORE UPDATE` trigger.
--
-- This file uses the column privilege. It is declarative, it is visible in the catalog and
-- in `information_schema.column_privileges`, it costs nothing per row, and it is the same
-- mechanism `00015` already uses on `public.users`. A trigger was considered and rejected:
-- it would add a per-row function to the one table that is also published to realtime and
-- cascade-deleted from `matches`, to enforce a rule the privilege system enforces for free.
--
-- The other half of the pair, also measured: `public.messages` grants table-wide SELECT,
-- INSERT, UPDATE, DELETE to BOTH `authenticated` and `anon` (relacl: anon=arwd,
-- authenticated=arwd). That is the grant this file narrows.
--
-- WHAT THE CLIENT ACTUALLY WRITES
--
-- Exactly one client path UPDATEs this table. `useMarkMessagesAsRead`
-- (src/api/mutations/useMessage.ts:82) sends `{ is_read: true, read_at: <now> }` filtered
-- by `.eq('match_id', …).neq('sender_id', user.id).eq('is_read', false)`. Nothing else in
-- `src/` or `app/` updates `messages` - the other six references are INSERT and SELECT.
-- So `GRANT UPDATE (is_read, read_at)` is the whole write surface the app needs, measured
-- against the code rather than assumed.
--
-- =====================================================
-- WHAT THIS MEANS FOR THE OTHER "NULL with_check" FINDINGS
-- =====================================================
--
-- Recorded here because the same wrong reading is written into two earlier issues. The
-- sweep MEXA-406 asked for - "every UPDATE policy in `public` with a NULL `with_check`" -
-- is **not** the right sweep: 19 policies match it and most are not findings at all,
-- because their `USING` clause is own-row (`user_id = me`) and therefore *does* refuse a
-- row that moves to another owner. Measured on three of them: repointing a `matches` row
-- at a stranger, moving a `user_photos` row onto another profile, and re-registering a
-- `push_tokens` row as the victim's are **all refused**, "new row violates row-level
-- security policy".
--
-- The real defect class, and the one worth sweeping for, is: **a client role holds an
-- over-broad UPDATE grant on a table whose policy `USING` expression is invariant under
-- changing a security-relevant column.** That is what `messages` is (membership-scoped
-- filter, free-text body), and it is also what `safta_accounts.subscription_status`
-- (MEXA-345) and `users.orthodox_subscription_status` (MEXA-292) are (own-row filter,
-- entitlement column). Same class, correctly stated. Follow-ups are on MEXA-406.
--
-- =====================================================
-- ORDER, AND THE OTHER MIGRATIONS THAT TOUCH THIS TABLE
-- =====================================================
--
-- Depends on 00001 (the table). Applied.
--
-- Checked against every migration in the repo that names `messages`, because a grant
-- narrowing is exactly the change that makes someone else's post-check abort:
--
--   * 00016 section 3 revokes `messages` DELETE from `authenticated`, and its section 7b
--     asserts `['messages','DELETE']` is gone. This file does not touch DELETE.
--   * 00016 section 7c is the "these grants must STILL be granted" list. It names
--     matches:INSERT, safta_likes:UPDATE, shidduch_suggestions:INSERT/UPDATE. It does
--     **not** name messages:UPDATE, so narrowing it here cannot make 00016 abort.
--   * 00016 section 6 writes `COMMENT ON TABLE public.messages`. This file deliberately
--     writes COLUMN comments instead, so the two do not overwrite each other and neither
--     rollback has to know about the other (MEXA-361's lesson on 00025/00026).
--   * 00018 publishes `messages` to `supabase_realtime`. Replication does not run as
--     `authenticated`, so a client grant change does not affect it; asserted in 4f anyway.
--   * 00005 / 00001 put two AFTER INSERT triggers on the table. Untouched, asserted in 4g.
--
-- `useDeleteMessage` (src/api/mutations/useMessage.ts:122) is dead code either way: there
-- is no DELETE policy on `messages`, so RLS refuses every delete regardless of the grant.
-- That is 00016's business, not this file's.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================
--
-- Deliberately not idempotent. The ledger row in section 3 is what records the apply; a
-- second run should say so loudly rather than quietly re-revoking and re-granting, which on
-- a live project is a privilege flap rather than a no-op.

DO $$
DECLARE
  v_bad TEXT;
BEGIN
  -- 0a. The objects this file edits.
  IF to_regclass('public.messages') IS NULL THEN
    RAISE EXCEPTION 'MEXA-406: public.messages does not exist';
  END IF;

  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00034') THEN
    RAISE EXCEPTION 'MEXA-406: 00034 is already in the ledger';
  END IF;

  -- 0b. The defect, as it is on live right now, and the second-apply guard. This is also
  -- the MEXA-359 trap in its other direction: a column-level REVOKE cannot cut back a
  -- table-wide GRANT, which is why section 1 revokes at the TABLE level first - but if the
  -- table grant is already gone then this database is not the one that was measured, and
  -- section 1's re-grant would be handing out a privilege rather than narrowing one.
  IF NOT has_table_privilege('authenticated', 'public.messages', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-406: authenticated has no TABLE-level UPDATE on public.messages; either 00034 is applied or this is not the database that was measured';
  END IF;

  -- 0c. The policy this file relies on and must not change. If the row filter is not the
  -- membership test any more, the reasoning in the header no longer describes this
  -- database and the grant narrowing should be re-argued, not applied blind.
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'messages'
         AND policyname = 'Users can update messages'
         AND qual LIKE '%m.id = messages.match_id%'
         AND qual LIKE '%users.auth_id = auth.uid()%') THEN
    RAISE EXCEPTION 'MEXA-406: the UPDATE policy "Users can update messages" is missing or is no longer the match-membership filter';
  END IF;

  -- 0d. The columns section 1 names must exist.
  SELECT string_agg(c, ', ') INTO v_bad
    FROM unnest(ARRAY['is_read','read_at','content','sender_id','match_id']) AS c
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = 'messages'
                        AND column_name = c);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-406: public.messages is missing columns this file names: %', v_bad;
  END IF;

  -- 0e. No role outside the platform's own can write this table. Narrowing `authenticated`
  -- closes one door; a grant to some third role would leave another standing.
  SELECT string_agg(format('%s:%s', grantee, privilege_type), ', ')
    INTO v_bad
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'messages'
     AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
     AND grantee NOT IN ('postgres', 'service_role', 'authenticated', 'anon');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-406: an unexpected role can write public.messages: %', v_bad;
  END IF;

  -- Before-picture, so section 4 can prove this file moved exactly what it names.
  PERFORM set_config('mexa406.colprivs',
    (SELECT coalesce(string_agg(format('%s:%s:%s', grantee, privilege_type, column_name),
                                ',' ORDER BY grantee, privilege_type, column_name), '')
       FROM information_schema.column_privileges
      WHERE table_schema = 'public' AND table_name = 'messages'), false);
  PERFORM set_config('mexa406.pol',
    (SELECT coalesce(qual, '') || '||' || coalesce(with_check, '<null>')
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages'
        AND policyname = 'Users can update messages'), false);
  PERFORM set_config('mexa406.rows', (SELECT count(*)::text FROM public.messages), false);
  PERFORM set_config('mexa406.policies', (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public'), false);
  PERFORM set_config('mexa406.msgpolicies',
    (SELECT coalesce(string_agg(policyname || ':' || cmd, ',' ORDER BY policyname), '')
       FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages'), false);
END
$$;

-- =====================================================
-- 1. The fix: the client may write the read-receipt columns and nothing else
-- =====================================================
--
-- TABLE-level first, then the two columns back. The order matters and the direction
-- matters: `REVOKE UPDATE (col)` does NOT cut back a table-wide `GRANT UPDATE ON TABLE`
-- (MEXA-359), so a column-only revoke here would run clean and change nothing.
--
-- After this, a client that tries to write `content`, `sender_id`, `match_id`,
-- `message_type`, `media_url`, `created_at` or `id` gets
-- `42501: permission denied for table messages` - a hard refusal, not a silent drop, so a
-- stale build that still attempts it fails visibly.
--
-- `anon` gets nothing back. The anon key ships inside the app binary, so `anon` is the
-- whole internet; it has no business writing a two-person chat thread. 00016 (reviewed, on
-- `mazal-restart`, NOT applied) revokes every `anon` table privilege in `public` and
-- asserts it in its section 7a - this file does not wait for that, and revoking twice is a
-- no-op in either order.

REVOKE UPDATE ON TABLE public.messages FROM authenticated;
REVOKE UPDATE ON TABLE public.messages FROM anon;

GRANT UPDATE (is_read, read_at) ON TABLE public.messages TO authenticated;

-- =====================================================
-- 2. Record the invariant where the next reader will look
-- =====================================================
--
-- Column comments, not a table comment: 00016 section 6 owns
-- `COMMENT ON TABLE public.messages` and is not applied yet, so a table comment here would
-- be silently blanked the day 00016 runs and each rollback would have to know about the
-- other (MEXA-361).

COMMENT ON COLUMN public.messages.content IS
  'The message body. NOT client-writable after it is sent (MEXA-406): `authenticated` holds '
  'UPDATE on `is_read` and `read_at` only. Before 00034 the grant was table-wide and either '
  'participant in a match could rewrite the other person''s message body - measured on live, '
  '1 row affected. Note the reason, because it is not the one MEXA-406 was filed with: the '
  'UPDATE policy''s NULL with_check does NOT leave the new row unchecked (Postgres reuses '
  'USING as the check), it is that the USING expression tests MATCH MEMBERSHIP, which a '
  'content rewrite does not change. No policy can fix that - WITH CHECK has no OLD row - so '
  'the column grant is the rule. Editing or redacting a sent message is an unmade product '
  'decision; making it means a server-side path that keeps the original, not a GRANT.';

COMMENT ON COLUMN public.messages.sender_id IS
  'Who sent it. NOT client-writable after INSERT (MEXA-406) - before 00034 a match '
  'participant could reassign authorship of the other person''s message to themselves. '
  'The INSERT policy "Users can send messages" is what pins it at write time '
  '(sender_id = me AND sender is a participant of an active match); this column carries no '
  'UPDATE grant so nothing can move it afterwards.';

COMMENT ON COLUMN public.messages.is_read IS
  'Read receipt, written by the RECIPIENT (useMarkMessagesAsRead filters '
  '.neq(sender_id, me)). One of exactly two columns `authenticated` may UPDATE on this '
  'table (MEXA-406). Whether a sender may SEE it is a separate, open question - MEXA-373.';

COMMENT ON COLUMN public.messages.read_at IS
  'When the recipient marked it read. The second of the two columns `authenticated` may '
  'UPDATE on this table (MEXA-406). Client-supplied, so it is the device''s clock and is '
  'not evidence of anything; nothing server-side should reason from it.';

-- =====================================================
-- 3. Ledger row, in this transaction (MEXA-325)
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00034', 'messages_are_not_rewritable');

-- =====================================================
-- 4. Assert the result, in the same transaction
-- =====================================================
--
-- A revoke that did not take is invisible: the column keeps working and the app keeps
-- writing. These make the claims above true of what actually landed. The behaviour itself -
-- a real `authenticated` session getting 42501 on `content` while its read-receipt write
-- still succeeds - is measured as the real role in
-- `.scratch/mazal-mexa406/rehearse_00034.mjs`, which a privilege catalog cannot do.

DO $$
DECLARE
  v_cols_before  TEXT    := current_setting('mexa406.colprivs');
  v_pol_before   TEXT    := current_setting('mexa406.pol');
  v_rows_before  INTEGER := current_setting('mexa406.rows')::INTEGER;
  v_pols_before  INTEGER := current_setting('mexa406.policies')::INTEGER;
  v_msgp_before  TEXT    := current_setting('mexa406.msgpolicies');
  v_n            INTEGER;
  v_bad          TEXT;
BEGIN
  -- 4a. This file writes no policy. It is a REVOKE, a GRANT, four COMMENTs and a ledger
  -- row - and the header's whole argument is that the policy is not where the fix lives,
  -- so a policy that moved here would mean the file is not what it says it is.
  SELECT coalesce(qual, '') || '||' || coalesce(with_check, '<null>')
    INTO v_bad FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'messages'
     AND policyname = 'Users can update messages';
  IF v_bad IS DISTINCT FROM v_pol_before THEN
    RAISE EXCEPTION 'MEXA-406: the UPDATE policy on public.messages changed; this file must not touch it'
      USING DETAIL = format('before: %s%safter:  %s', v_pol_before, chr(10), v_bad);
  END IF;

  SELECT coalesce(string_agg(policyname || ':' || cmd, ',' ORDER BY policyname), '')
    INTO v_bad FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages';
  IF v_bad IS DISTINCT FROM v_msgp_before THEN
    RAISE EXCEPTION 'MEXA-406: the policy set on public.messages changed: "%" -> "%"', v_msgp_before, v_bad;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'public';
  IF v_n <> v_pols_before THEN
    RAISE EXCEPTION 'MEXA-406: public policy count changed % -> %', v_pols_before, v_n;
  END IF;

  -- 4b. The point of the file. `has_column_privilege` is true if EITHER a column-level or a
  -- table-level grant covers the column, so false here rules out both routes at once.
  SELECT string_agg(c, ', ') INTO v_bad
    FROM unnest(ARRAY['id','match_id','sender_id','content','message_type','media_url','created_at']) AS c
   WHERE has_column_privilege('authenticated', 'public.messages', c, 'UPDATE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-406: authenticated can still UPDATE these columns of public.messages: %', v_bad;
  END IF;

  IF has_table_privilege('authenticated', 'public.messages', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-406: authenticated still holds a TABLE-level UPDATE on public.messages, so the column grant is not the rule';
  END IF;

  -- 4c. And the feature still works. Without this the file could close the hole by taking
  -- the write away entirely, which would break read receipts app-wide and look like a UI bug.
  IF NOT (has_column_privilege('authenticated', 'public.messages', 'is_read', 'UPDATE')
      AND has_column_privilege('authenticated', 'public.messages', 'read_at', 'UPDATE')) THEN
    RAISE EXCEPTION 'MEXA-406: authenticated cannot UPDATE the read-receipt columns; useMarkMessagesAsRead would 42501';
  END IF;

  -- 4d. anon is out of this table's write path entirely.
  IF has_table_privilege('anon', 'public.messages', 'UPDATE')
     OR has_column_privilege('anon', 'public.messages', 'is_read', 'UPDATE')
     OR has_column_privilege('anon', 'public.messages', 'content', 'UPDATE') THEN
    RAISE EXCEPTION 'MEXA-406: anon can still UPDATE public.messages';
  END IF;

  -- 4e. Nothing this file was not asked to move has moved. Sending and reading are the two
  -- paths a clumsy REVOKE would break, and both are how the chat screen works at all.
  IF NOT has_column_privilege('authenticated', 'public.messages', 'content', 'INSERT') THEN
    RAISE EXCEPTION 'MEXA-406: authenticated lost INSERT on messages.content; sending a message would break';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.messages', 'content', 'SELECT') THEN
    RAISE EXCEPTION 'MEXA-406: authenticated lost SELECT on messages.content; the chat screen would be blank';
  END IF;

  -- The column-privilege picture is exactly "before, minus authenticated's UPDATE on the
  -- seven columns section 1 closed, minus anon's UPDATE on all nine". Derived by
  -- subtraction rather than by re-listing the after-picture, so a second, unnoticed change
  -- fails here.
  SELECT coalesce(string_agg(format('%s:%s:%s', grantee, privilege_type, column_name),
                             ',' ORDER BY grantee, privilege_type, column_name), '')
    INTO v_bad
    FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND table_name = 'messages';

  IF v_bad IS DISTINCT FROM (
      SELECT coalesce(string_agg(format('%s:%s:%s', p.grantee, p.privilege_type, p.column_name),
                                 ',' ORDER BY p.grantee, p.privilege_type, p.column_name), '')
        FROM (SELECT unnest(string_to_array(v_cols_before, ',')) AS e) s
        CROSS JOIN LATERAL (SELECT split_part(s.e, ':', 1) AS grantee,
                                   split_part(s.e, ':', 2) AS privilege_type,
                                   split_part(s.e, ':', 3) AS column_name) p
       WHERE s.e <> ''
         AND NOT (p.privilege_type = 'UPDATE'
                  AND (p.grantee = 'anon'
                       OR (p.grantee = 'authenticated'
                           AND p.column_name NOT IN ('is_read', 'read_at'))))
  ) THEN
    RAISE EXCEPTION 'MEXA-406: column privileges on public.messages are not "before minus the UPDATEs this file closed"'
      USING DETAIL = format('actual: %s', v_bad);
  END IF;

  -- 4f. No row moved, and the realtime publication still carries this table.
  SELECT count(*) INTO v_n FROM public.messages;
  IF v_n <> v_rows_before THEN
    RAISE EXCEPTION 'MEXA-406: messages row count changed % -> %', v_rows_before, v_n;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages') THEN
    RAISE EXCEPTION 'MEXA-406: public.messages left the supabase_realtime publication; 00018 would be undone';
  END IF;

  -- 4g. The two AFTER INSERT triggers are untouched - update_match_last_message keeps the
  -- matches list ordered and notify_new_message queues the push.
  SELECT count(*) INTO v_n FROM pg_trigger
   WHERE tgrelid = 'public.messages'::regclass AND NOT tgisinternal;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'MEXA-406: expected 2 user triggers on public.messages, found %', v_n;
  END IF;

  -- 4h. RLS is still on. A column grant is only half the rule; with RLS off the USING
  -- clause stops running and every row in every thread is reachable.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.messages'::regclass) THEN
    RAISE EXCEPTION 'MEXA-406: row level security is off on public.messages';
  END IF;

  -- 4i. The comments actually say the new thing, by content and not merely non-NULL.
  IF coalesce(col_description('public.messages'::regclass,
       (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.messages'::regclass AND attname = 'content')), '')
     NOT LIKE '%NOT client-writable after it is sent%' THEN
    RAISE EXCEPTION 'MEXA-406: the messages.content comment was not written';
  END IF;
  IF coalesce(col_description('public.messages'::regclass,
       (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.messages'::regclass AND attname = 'sender_id')), '')
     NOT LIKE '%NOT client-writable after INSERT%' THEN
    RAISE EXCEPTION 'MEXA-406: the messages.sender_id comment was not written';
  END IF;

  RAISE NOTICE 'MEXA-406: authenticated may now UPDATE only messages.is_read and messages.read_at; anon may update nothing';
END
$$;

COMMIT;
