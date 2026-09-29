-- Rollback for 00021_drop_orthodox_discovery_rpc.sql
--
-- NOT a migration. Nothing applies this file automatically; it exists so 00021 can be
-- undone on a database that has it. Running it puts `get_orthodox_discovery_profiles` back
-- exactly as 00010 left it - body, SECURITY DEFINER, `SET search_path = public`, comment
-- and grants - verified byte for byte against `pg_get_functiondef` on the live project
-- `tayiyczmacvhokdxfqvm` on 2026-09-29, before 00021 was applied.
--
-- WHAT RUNNING THIS COSTS YOU
--
-- It re-opens the hole MEXA-327/MEXA-348 describes. The restored function is SECURITY
-- DEFINER, `RETURNS SETOF public.users`, and grants EXECUTE to `authenticated`: one call
-- returns up to 50 whole `users` rows belonging to other people - all 53 columns, including
-- `email`, `phone`, `auth_id`, `current_latitude`, `current_longitude`, `location`,
-- `date_of_birth` and `elo_score` - to **any** signed-in account. The caller's entitlement is
-- never checked, only the pool is filtered, and `is_orthodox_user` is client-set. Nothing
-- in the app calls it, so restoring it buys no functionality; the only reason to run this
-- file is to get a half-applied deploy back to a known state, and 00021 should go straight
-- back on afterwards.
--
-- (`instagram_access_token` is *not* among the columns on today's `users` - 00013 moved it
-- to `user_integrations`. `src/types/supabase.generated.ts` still lists it; that is stale.
-- The other columns above were read back by value from a live call, see 00021's header.)
--
-- **Do not leave this restored with the Orthodox flag on.** With the flag off the pool is
-- empty and the exposure is latent; with the flag on it is live.
--
-- Unlike the older rollback files here, this one **deletes 00021's ledger row itself**
-- (section 4) rather than leaving a `DELETE` in a comment for the operator to remember.
-- 00021 writes that row inside its own transaction, so the inverse belongs inside this one;
-- leaving it would let an apply script consider 00021 applied and never put it back.
--
-- DEPENDENCY
--
-- The body calls `public.current_app_user_id()`, which 00013 creates. That is applied on
-- live, and section 1 below asserts it before restoring, because without it every call
-- would fail at runtime rather than at restore time.

BEGIN;

-- =====================================================
-- 1. Pre-flight
-- =====================================================

DO $$
BEGIN
  IF to_regprocedure('public.get_orthodox_discovery_profiles(uuid,integer,integer,integer,text[])') IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-327 rollback: get_orthodox_discovery_profiles already exists; 00021 is not applied, or something has recreated it. Inspect it before overwriting.';
  END IF;

  IF to_regprocedure('public.current_app_user_id()') IS NULL THEN
    RAISE EXCEPTION 'MEXA-327 rollback: public.current_app_user_id() is missing (00013 not applied); the restored body would fail on every call';
  END IF;
END
$$;

-- =====================================================
-- 2. The function, exactly as 00010 defined it
-- =====================================================

CREATE FUNCTION public.get_orthodox_discovery_profiles(
  requesting_user_id UUID,
  max_distance_km INTEGER DEFAULT 100,
  min_age INTEGER DEFAULT 18,
  max_age INTEGER DEFAULT 99,
  preferred_genders TEXT[] DEFAULT ARRAY['male', 'female']
)
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := public.current_app_user_id();
BEGIN
  IF v_caller_id IS NULL OR requesting_user_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'get_orthodox_discovery_profiles: requesting_user_id must be the calling user'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.*
  FROM public.users u
  WHERE u.is_orthodox_user = TRUE
    AND u.id != v_caller_id
    AND u.is_active = TRUE
    AND u.onboarding_complete = TRUE
    AND u.gender = ANY(preferred_genders)
    AND EXTRACT(YEAR FROM AGE(u.date_of_birth)) BETWEEN min_age AND max_age
    -- Exclude users already swiped
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes s
      WHERE s.swiper_id = v_caller_id AND s.swiped_id = u.id
    )
    -- Exclude blocked users
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = v_caller_id AND b.blocked_id = u.id)
         OR (b.blocker_id = u.id AND b.blocked_id = v_caller_id)
    )
  ORDER BY u.elo_score DESC NULLS LAST
  LIMIT 50;
END;
$$;

COMMENT ON FUNCTION public.get_orthodox_discovery_profiles(UUID, INTEGER, INTEGER, INTEGER, TEXT[]) IS
  'Orthodox discovery deck for the calling user. requesting_user_id must equal current_app_user_id(); SECURITY DEFINER, so it bypasses RLS and has to check identity itself (MEXA-251).';

-- =====================================================
-- 3. Grants, exactly as 00010 left them
-- =====================================================
--
-- Measured ACL before 00021: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}.
-- A fresh CREATE grants EXECUTE to PUBLIC by default, so the REVOKE is not cosmetic here -
-- without it `anon` would end up able to call this, which 00010 did not allow.

REVOKE EXECUTE ON FUNCTION public.get_orthodox_discovery_profiles(UUID, INTEGER, INTEGER, INTEGER, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_orthodox_discovery_profiles(UUID, INTEGER, INTEGER, INTEGER, TEXT[]) TO authenticated, service_role;

-- =====================================================
-- 4. Ledger row back out, in this transaction
-- =====================================================

DELETE FROM supabase_migrations.schema_migrations WHERE version = '00021';

-- =====================================================
-- 5. Post-check: this is the bit-exact inverse of 00021
-- =====================================================

DO $$
DECLARE
  v_oid OID := to_regprocedure('public.get_orthodox_discovery_profiles(uuid,integer,integer,integer,text[])');
  v_txt TEXT;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'MEXA-327 rollback: the function was not restored';
  END IF;

  SELECT pg_get_function_result(v_oid) INTO v_txt;
  IF v_txt <> 'SETOF users' THEN
    RAISE EXCEPTION 'MEXA-327 rollback: return type is %, expected "SETOF users"', v_txt;
  END IF;

  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION 'MEXA-327 rollback: restored function is not SECURITY DEFINER';
  END IF;

  SELECT proconfig::TEXT INTO v_txt FROM pg_proc WHERE oid = v_oid;
  IF v_txt IS DISTINCT FROM '{search_path=public}' THEN
    RAISE EXCEPTION 'MEXA-327 rollback: proconfig is %, expected {search_path=public}', v_txt;
  END IF;

  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-327 rollback: authenticated and service_role should both hold EXECUTE';
  END IF;

  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-327 rollback: anon holds EXECUTE; 00010 did not grant it and the default PUBLIC grant was not revoked';
  END IF;

  -- The identity check from 00010 has to be in the restored body; without it this is the
  -- pre-00010 function, which is a worse hole than the one 00021 closed.
  SELECT pg_get_functiondef(v_oid) INTO v_txt;
  IF v_txt NOT LIKE '%requesting_user_id IS DISTINCT FROM v_caller_id%' THEN
    RAISE EXCEPTION 'MEXA-327 rollback: restored body has no caller identity check - this is not 00010''s version';
  END IF;

  -- The ACL 00010 left, measured before 00021. Asserted rather than assumed because a fresh
  -- CREATE starts from a PUBLIC grant, so getting here by a different route is easy.
  SELECT proacl::TEXT INTO v_txt FROM pg_proc WHERE oid = v_oid;
  IF v_txt IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN
    RAISE EXCEPTION 'MEXA-327 rollback: proacl is %, expected {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}', v_txt;
  END IF;

  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00021') THEN
    RAISE EXCEPTION 'MEXA-327 rollback: 00021 is still in the ledger, so an apply script will skip it';
  END IF;

  RAISE NOTICE 'MEXA-327 rollback: get_orthodox_discovery_profiles is back as 00010 defined it. The MEXA-348 exposure is open again - re-apply 00021.';
END
$$;

COMMIT;
