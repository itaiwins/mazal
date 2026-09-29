-- Rollback for 00017_matching_actually_matches.sql (MEXA-294 / MEXA-296).
--
-- This restores the state in which mutual matching does not work. Run it only if 00017
-- itself broke something; "no matches are being created" is the state *before* 00017, not
-- a symptom of it.
--
-- A bit-exact inverse of all three parts, taken from the live schema of
-- `tayiyczmacvhokdxfqvm` on 2026-09-29 before 00017:
--
--   check_for_match       prosecdef = false, no proconfig (no SET search_path), and an
--                         unused `new_match_id UUID` declaration with a `RETURNING id
--                         INTO` that never fired. Restored verbatim from 00001.
--   supabase_realtime     had zero tables. Restored by dropping `matches` from it.
--   matches               relreplident = 'd' (default). Restored.
--
-- Note the client half of MEXA-294 is a separate revert. `performSwipe` after 00017 reads
-- the `matches` row the trigger created; with 00017 rolled back that row does not exist,
-- so the match screen stops appearing again - which is the pre-00017 behaviour, not a new
-- break. Nothing in the client errors either way: it is a `maybeSingle()` that comes back
-- null.

BEGIN;

-- 1. check_for_match back to 00001's definition, SECURITY INVOKER and no search_path.
CREATE OR REPLACE FUNCTION public.check_for_match()
RETURNS TRIGGER AS $$
DECLARE
  mutual_like BOOLEAN;
  new_match_id UUID;
BEGIN
  IF NEW.action IN ('like', 'super_like') THEN
    -- Check if there's a mutual like
    SELECT EXISTS(
      SELECT 1 FROM swipes
      WHERE swiper_id = NEW.swiped_id
        AND swiped_id = NEW.swiper_id
        AND action IN ('like', 'super_like')
    ) INTO mutual_like;

    IF mutual_like THEN
      -- Create match (ensure user1_id < user2_id for consistency)
      INSERT INTO matches (user1_id, user2_id)
      VALUES (
        LEAST(NEW.swiper_id, NEW.swiped_id),
        GREATEST(NEW.swiper_id, NEW.swiped_id)
      )
      ON CONFLICT (user1_id, user2_id) DO NOTHING
      RETURNING id INTO new_match_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.check_for_match() IS NULL;

-- 2. matches out of the realtime publication.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.matches;
  END IF;
END
$$;

-- 3. matches back to the default replica identity.
ALTER TABLE public.matches REPLICA IDENTITY DEFAULT;

COMMIT;
