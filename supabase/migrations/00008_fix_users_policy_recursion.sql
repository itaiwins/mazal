-- Mazal - Fix infinite recursion in the users RLS policies
--
-- Found while testing sign-up against a fresh database (MEXA-246). Creating a profile
-- failed outright:
--
--   POST /rest/v1/users -> 500
--   {"code":"42P17","message":"infinite recursion detected in policy for relation \"users\""}
--
-- `"Users can view other profiles"` (00002_rls_policies.sql) is a SELECT policy on
-- `users` whose USING clause runs `SELECT id FROM users WHERE auth_id = auth.uid()`.
-- Reading `users` from inside a policy on `users` re-enters the same policy, so Postgres
-- aborts with 42P17. It fires on INSERT too, because PostgREST reads the new row back
-- when the client sends `Prefer: return=representation` — which is what the onboarding
-- flow does. Result: nobody could ever finish onboarding.
--
-- There are two cycles, not one:
--   1. users -> (SELECT id FROM users ...) -> users
--   2. users -> blocks -> the blocks SELECT policy -> (SELECT id FROM users ...) -> users
-- so removing the self-subquery alone is not enough; the policy must stop reading
-- `blocks` under RLS as well.
--
-- The fix is the standard one: answer both questions in SECURITY DEFINER functions, which
-- run with the owner's rights and therefore do not re-trigger RLS.

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_app_user_id() IS
  'The public.users id of the caller. SECURITY DEFINER so RLS policies can use it without recursing into users.';

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.has_block_between(p_other_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks b
    WHERE (b.blocker_id = public.current_app_user_id() AND b.blocked_id = p_other_user_id)
       OR (b.blocked_id = public.current_app_user_id() AND b.blocker_id = p_other_user_id)
  );
$$;

COMMENT ON FUNCTION public.has_block_between(UUID) IS
  'True when the caller has blocked the given user or has been blocked by them. SECURITY DEFINER so RLS policies on users can check blocks without a users <-> blocks policy cycle.';

REVOKE ALL ON FUNCTION public.has_block_between(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_block_between(UUID) TO authenticated, anon, service_role;

DROP POLICY IF EXISTS "Users can view other profiles" ON users;

CREATE POLICY "Users can view other profiles"
  ON users FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND auth_id IS DISTINCT FROM auth.uid()
    AND NOT public.has_block_between(users.id)
  );

-- Two deliberate differences from the original policy:
--
-- `TO authenticated` — the original had no role clause, so it also applied to `anon`.
-- That was survivable only by accident: `auth_id != auth.uid()` evaluates to NULL for an
-- anonymous caller, and NULL is not true, so the row was filtered out. Discovery is for
-- signed-in users, so say that explicitly instead of relying on three-valued logic.
--
-- `IS DISTINCT FROM` — with the role clause in place, the "not me" test can be written
-- so that it also holds for rows with a NULL auth_id, which `!=` would have hidden.
