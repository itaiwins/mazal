-- Mazal - Make mutual matching work, and stop the client reading swipes cross-side
--
-- MEXA-294 (the two client call sites) and MEXA-296 cause 1 (the trigger). One change,
-- because they are one bug: the only SELECT policy on `swipes` is
--
--   USING (swiper_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
--
-- so nothing running as the swiper can see the row in which they are the *swipee*, and
-- "has the other person already liked me?" is exactly that question. Everything that
-- asked it got an empty answer with no error.
--
-- Three things asked it:
--
--   1. `check_for_match`, the AFTER INSERT trigger on `swipes` from 00001. It is
--      SECURITY INVOKER, so its body runs as the swiper and is subject to that policy.
--      Its mutual-like EXISTS was always FALSE, so **no match row has ever been created
--      by the trigger**. Fixed here.
--   2. `performSwipe` in `src/api/mutations/useSwipe.ts`, which repeated the same query
--      from the client and then inserted into `matches` itself. Always null, so the
--      "It's a Match!" screen never appeared. Fixed in the client, not here - it now
--      reads the authoritative `matches` row, which the existing SELECT policy on
--      `matches` already shows to both participants.
--   3. `useLikesSubscription`, a realtime subscription on `swipes` filtered by
--      `swiped_id`. Deleted in the client; see the note on the publication below.
--
-- MEXA-278 fixes a fourth (the discovery deck's `has_liked_me`) in its own migration.
--
-- Not in here on purpose:
--
--   * **No new SELECT policy on `swipes`.** A policy admitting `swiped_id = <me>` would
--     publish every incoming swipe including `pass`, i.e. "who rejected you". The table
--     stays closed and the answers come from objects that run as their owner - the 00010
--     pattern.
--   * **No INSERT policy on `matches`** (MEXA-296 cause 2). Once the trigger owns match
--     creation it runs as its owner and needs none, and the client insert that needed one
--     is deleted. The dead INSERT grant `anon`/`authenticated` still hold on `matches` is
--     left for MEXA-274's privilege sweep - it was already unreachable before this
--     change, because there has never been an INSERT policy for it to pass.

BEGIN;

-- =====================================================
-- 1. check_for_match: SECURITY DEFINER
-- =====================================================

-- Same body as 00001 apart from the two things that were wrong.
--
-- SECURITY DEFINER, because this is system bookkeeping on behalf of *both* people, not
-- an action by the one who happened to swipe second. It is the same reasoning the four
-- `notify_*` triggers in 00005 already use, and like them it is a `RETURNS trigger`
-- function, which Postgres refuses to invoke outside a trigger context and PostgREST
-- does not expose - so unlike 00010's RPCs there is no endpoint to revoke.
--
-- SET search_path = public, which any SECURITY DEFINER function needs so the owner's
-- rights cannot be pointed at a caller-controlled schema. Without it the bare `swipes`
-- and `matches` here resolve through the caller's search_path.
--
-- The dead `new_match_id` variable is gone. `ON CONFLICT DO NOTHING RETURNING id`
-- returns no row when the conflict fires, and nothing read the variable either way.
CREATE OR REPLACE FUNCTION public.check_for_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mutual_like BOOLEAN;
BEGIN
  IF NEW.action IN ('like', 'super_like') THEN
    SELECT EXISTS(
      SELECT 1 FROM swipes
      WHERE swiper_id = NEW.swiped_id
        AND swiped_id = NEW.swiper_id
        AND action IN ('like', 'super_like')
    ) INTO mutual_like;

    IF mutual_like THEN
      -- user1_id < user2_id, matching the UNIQUE (user1_id, user2_id) constraint, so the
      -- pair has one row whichever way round the second like arrives.
      INSERT INTO matches (user1_id, user2_id)
      VALUES (
        LEAST(NEW.swiper_id, NEW.swiped_id),
        GREATEST(NEW.swiper_id, NEW.swiped_id)
      )
      ON CONFLICT (user1_id, user2_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_for_match() IS
  'AFTER INSERT trigger on swipes: creates the matches row when a like is mutual. SECURITY DEFINER because the swipes SELECT policy only admits the swiper''s own rows, so as INVOKER it could never see the other person''s like and no match was ever created (MEXA-296). Owning match creation also means matches needs no INSERT policy.';

-- The trigger itself is unchanged - `swipes_check_match` from 00001 already points at
-- this function, and CREATE OR REPLACE keeps the same oid. Restated as documentation of
-- what is attached, and so a fresh database built from these files in order is explicit.
-- (Nothing to re-create: dropping and re-adding the trigger here would be a no-op.)

-- =====================================================
-- 2. Publish matches to realtime
-- =====================================================

-- `useMatchesSubscription` in the client has always subscribed to postgres_changes on
-- `public.matches`, but `supabase_realtime` was an empty publication on this project
-- (`select count(*) from pg_publication_tables` -> 0), so no row-level event has ever
-- been sent for any table. That is a wider problem than this issue - `messages` and the
-- chat's own subscriptions are in the same position - and it is filed separately. Only
-- `matches` is added here, because it is the table this issue's notifications need.
--
-- `swipes` is deliberately NOT added. Realtime applies the table's SELECT policy to each
-- subscriber, so with the policy as it stands a `swipes` subscription would deliver
-- nothing anyway; and the policy change that would make it deliver something is the one
-- that publishes "who passed on you". Both reasons point the same way.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;
END
$$;

-- Realtime evaluates the subscriber against the table's SELECT policy, which for
-- `matches` is `user1_id = <me> OR user2_id = <me>`. Neither column is in the primary
-- key, so on the default replica identity an UPDATE's old row reaches realtime as the PK
-- alone and the policy cannot be evaluated against it. REPLICA IDENTITY FULL puts the
-- whole old row in the WAL. The client subscribes to UPDATE as well as INSERT (it
-- refreshes a match when `last_message_at` moves), so it needs this.
ALTER TABLE public.matches REPLICA IDENTITY FULL;

COMMIT;
