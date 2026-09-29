-- Rollback for 00022_safta_public_profiles.sql (MEXA-302)
--
-- 00022 adds ONE object and changes nothing else - no policy, no grant, no column on any
-- existing table - so this is the rare rollback that is a clean inverse: drop the view and
-- the database is bit-for-bit what it was.
--
-- WHAT DROPPING IT COSTS. Nothing a user can see today: every reader is behind
-- `FEATURE_SAFTA_MODE`, which is off. If the flag is ever on when you run this, the
-- grandchild's Safta list (app/(tabs)/matches.tsx) goes empty and the Safta chat header
-- reads 'Unknown Safta' - i.e. the behaviour 00022 fixed comes back. It does not break the
-- app: the app-side change in the same commit reads the view in its own query and treats a
-- missing row as a missing name, and a dropped view returns `42P01` on that one query
-- rather than taking the connection list down with it.
--
-- WHAT IT CANNOT COST. It gives nobody any privilege back and opens nothing: the view was
-- the only thing that ever let a grandchild read another account's row, and
-- `safta_accounts` keeps the owner-scoped SELECT policy `00002` gave it either way. So
-- unlike 00013's or 00019's rollbacks, there is no section here that re-opens a hole, and
-- no reason to run only part of it.
--
-- REVOKE/GRANT ARE NOT UNDONE, because they cannot outlive their object: dropping a view
-- drops its ACL with it. There is nothing to restore - the default privileges Supabase
-- would have applied were never a state the database was in, section 2 of 00022 revoked
-- them inside the same transaction that created the view.

BEGIN;

DROP VIEW IF EXISTS public.safta_public_profiles;

-- Assert the inverse actually happened, and that nothing else moved with it.
DO $$
DECLARE
  v_n   INT;
  v_bad TEXT;
BEGIN
  IF to_regclass('public.safta_public_profiles') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-302 rollback: safta_public_profiles still exists';
  END IF;

  -- The base table came through untouched: `00002`'s single owner-scoped SELECT policy,
  -- and all eleven columns. A rollback that took a column or a policy with it would be a
  -- worse outage than the bug.
  SELECT count(*) INTO v_n
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_accounts' AND cmd = 'SELECT';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'MEXA-302 rollback: safta_accounts has % SELECT policies, expected 1', v_n;
  END IF;

  SELECT qual INTO v_bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'safta_accounts' AND cmd = 'SELECT';
  IF v_bad IS DISTINCT FROM '(auth_id = auth.uid())' THEN
    RAISE EXCEPTION 'MEXA-302 rollback: the safta_accounts SELECT policy is "%", expected "(auth_id = auth.uid())"', v_bad;
  END IF;

  SELECT count(*) INTO v_n
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'safta_accounts';
  IF v_n <> 11 THEN
    RAISE EXCEPTION 'MEXA-302 rollback: safta_accounts has % columns, expected 11', v_n;
  END IF;

  RAISE NOTICE 'MEXA-302 rollback: safta_public_profiles dropped; safta_accounts intact.';
END
$$;

COMMIT;
