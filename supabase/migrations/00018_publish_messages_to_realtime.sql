-- Mazal - Publish `messages` to realtime, so the chat live-updates
--
-- MEXA-313. `supabase_realtime` is an empty publication on this project
-- (`select count(*) from pg_publication_tables where pubname='supabase_realtime'` -> 0,
-- `puballtables` false), and Postgres only writes row-level changes to the WAL for
-- published tables. So every `postgres_changes` subscription in the app has always
-- received nothing, silently: `subscribe()` reports `SUBSCRIBED` as normal because the
-- socket and the channel are fine, and no event ever follows. This is upstream of RLS -
-- the events are not filtered out, they are never produced.
--
-- Two subscriptions on `messages` are affected, both mounted today:
--
--   * `useMessagesSubscription` (src/api/realtime/useMessagesSubscription.ts), INSERT and
--     UPDATE filtered by `match_id`, mounted at app/(tabs)/messages/[matchId].tsx:201.
--     This is the chat. A message arrived only when something else happened to refetch.
--   * `useAllMessagesSubscription`, INSERT unfiltered, mounted at
--     app/(tabs)/matches.tsx:339, for the unread badge.
--
-- `matches` is added by 00017 (MEXA-294), so this migration is only about `messages`.
-- Nothing else is added. Every published table is WAL volume plus a per-subscriber RLS
-- check on a free-plan project, so the publication holds exactly the tables the client
-- subscribes to with `postgres_changes`: `matches` and `messages`. `swipes` in
-- particular stays off it, for the reasons 00017 gives.
--
-- =====================================================
-- Why NO `REPLICA IDENTITY FULL` here
-- =====================================================
--
-- The reflex is to set it, on the theory that realtime evaluates the subscriber's SELECT
-- policy against the WAL's old row, which on the default replica identity is the primary
-- key alone - and `messages`'s SELECT policy keys on `match_id`, which is not in the PK:
--
--   EXISTS (SELECT 1 FROM matches m WHERE m.id = messages.match_id
--           AND (m.user1_id = <me> OR m.user2_id = <me>))
--
-- That theory is wrong, and this project's own installed realtime code says so. The
-- visibility check is built by `realtime.build_prepared_statement_sql`, and what it
-- builds is
--
--   select exists(select 1 from public.messages where id='<pk>')
--
-- executed as the subscriber's role with their JWT claims. Realtime **re-reads the live
-- row by primary key** and lets RLS run against the real row, so the policy can reference
-- any column it likes. `realtime.apply_rls` takes the PK values for that statement from
-- `wal->'columns'`, the new tuple, which is complete for INSERT and UPDATE whatever the
-- replica identity is; `wal->'identity'`, the part the replica identity governs, is used
-- only for `old_record` and for the DELETE path. The client's filter
-- (`match_id=eq.<id>`) is checked against that same new tuple. So on INSERT and UPDATE,
-- delivery and the RLS check both work on the default replica identity. Verified by
-- subscribing for real, not by reading: see scripts/e2e/mexa313-realtime-messages.mjs.
--
-- What the default replica identity does cost, and why it is still the right trade:
--
--   * `payload.old` on UPDATE carries the primary key only. No caller reads it.
--   * A TOASTed column that an UPDATE does not change is omitted from the WAL, and
--     realtime recovers such a value from the old tuple - which is empty here. So on the
--     read-receipt UPDATE, `payload.new.content` is **absent** for a message body big
--     enough to be stored out of line. `content` is uncapped `text` with extended
--     storage, so that is reachable. The fix is in the client, which now merges
--     `payload.new` into the cached message instead of replacing it; a partial payload is
--     something a realtime consumer has to tolerate anyway. Case 6 of the e2e script
--     proves the payload really is partial and that the merge survives it.
--
-- `REPLICA IDENTITY FULL` would put the whole old row in the WAL on every UPDATE and
-- DELETE of the busiest table in the app, to spare the client a one-line merge. On the
-- free plan that is the wrong way round.
--
-- =====================================================
-- Two things the live run turned up, for whoever applies this next
-- =====================================================
--
-- 1. **Realtime does not pick the change up instantly.** The e2e script run straight
--    after this migration was applied to `tayiyczmacvhokdxfqvm` still missed the first
--    three events, then started delivering mid-run; re-run about two minutes later it
--    passed 11/11 unchanged. So applying this has a short window in which the chat still
--    does not live-update, and a check run immediately after the apply reports a false
--    failure. Wait, then verify - do not "fix" anything in that window.
--
-- 2. **DELETE bypasses RLS in realtime, by design, and this table is now in scope for
--    that.** `realtime.apply_rls` short-circuits (`if not is_rls_enabled or action =
--    'DELETE' then` -> every subscriber is visible), so any authenticated client may now
--    subscribe to DELETE on `messages` and see one event per deleted message. Measured,
--    not assumed: case 11 of the e2e script has a user who is in no match at all receive
--    the DELETE, with `old_record` keys = `id` and nothing else. The same function
--    filters a DELETE's old row to the primary key whenever RLS is enabled
--    (`and (not is_rls_enabled or (c).is_pkey)`), so no message content, sender or
--    match_id is exposed, and `REPLICA IDENTITY FULL` would not change that either.
--    What leaks is that *a* message with a given uuid was deleted, and when. Nothing
--    ties that uuid to a person. Deletes here come from cascades (a deleted account, an
--    unmatched pair) since `messages` has no DELETE policy at all. Recorded because it
--    is new surface that did not exist while the publication was empty.

BEGIN;

-- Idempotent: `ALTER PUBLICATION ... ADD TABLE` errors if the table is already a member,
-- and this project is shared with in-flight work, so guard it rather than assume.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END
$$;

-- Deliberately NOT `ALTER TABLE public.messages REPLICA IDENTITY FULL` - see the header.

COMMIT;
