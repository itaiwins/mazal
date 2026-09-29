-- Mazal - Pin name resolution: nothing in `public` resolves a name through the caller
--
-- MEXA-319, found by MEXA-296's audit of every trigger function in `public`
-- (`docs/TRIGGER_FUNCTION_SECURITY_AUDIT.md`). Two halves, one rule: **no function in
-- `public` should depend on the caller's `search_path` to decide what a bare name means.**
-- Every fact below was measured on the live dev project `tayiyczmacvhokdxfqvm` on
-- 2026-09-29 (`.scratch/mazal-mexa319/BEFORE.txt`, `SURVEY.txt`, `PROBE_PGTEMP.txt`).
--
-- Numbering: `00019` was asked for on the issue when `00018` was the tip. It is not free
-- any more - `00019`..`00021` and `00023`..`00026` are on `mazal-restart`, `00022` is
-- MEXA-302's and `00027` is MEXA-277's, both on unmerged branches. `00028` is the first
-- number no branch has claimed.
--
-- =====================================================
-- 1. Four SECURITY DEFINER trigger functions do not pin `search_path`
-- =====================================================
--
-- Measured: exactly four functions in `public` are `prosecdef = true` with
-- `proconfig IS NULL` -
--
--   notify_new_match, notify_new_message, notify_safta_like, notify_super_like
--
-- all from `00005_notification_triggers.sql`, all still attached to their triggers on
-- `matches`, `messages`, `safta_likes` and `swipes`. A DEFINER function resolves
-- unqualified names through the *caller's* `search_path`, so the owner's rights (here:
-- `postgres`) get pointed at whatever objects the caller chose. This is Supabase's own
-- `function_search_path_mutable` lint, and `00017` pinned the fifth DEFINER trigger
-- function (`check_for_match`) while leaving these four.
--
-- =====================================================
-- Why the pin is `public, pg_temp` and not `public`
-- =====================================================
--
-- This is the part MEXA-319 did not know when it was filed, and it changes the fix.
--
-- `SET search_path = public` **does not close the hole**, because Postgres searches the
-- session's temp schema for RELATION and TYPE names ahead of everything else whenever
-- `pg_temp` is not named explicitly. Listing it explicitly is the only way to move it,
-- and putting it last means a temp object can no longer win. Measured, in one rolled-back
-- transaction, against a throwaway DEFINER function shaped exactly like
-- `notify_new_match`'s `SELECT first_name FROM users WHERE id = NEW.user1_id`:
--
--   pin                            before a temp table   after `CREATE TEMP TABLE victim`
--   -----------------------------  --------------------  --------------------------------
--   (none - today's notify_*)      real-public-row       ATTACKER-CONTROLLED
--   search_path = public           real-public-row       ATTACKER-CONTROLLED
--   search_path = public, pg_temp  real-public-row       real-public-row
--
-- And the privilege that vector needs is not one grant away, it is already held:
-- `has_database_privilege('authenticated', current_database(), 'TEMP')` is **true**, and
-- true for `anon` too. What is missing is a way to *execute* `CREATE TEMP TABLE` - PostgREST
-- exposes no DDL, and neither role holds `CREATE` on any schema (measured: false on
-- `public`, and they cannot create a schema). So this is still hardening and not an
-- incident: severity unchanged, but the fix is now demonstrably load-bearing rather than
-- lint compliance.
--
-- **26 other DEFINER functions in `public` are pinned to `search_path=public` alone** and
-- therefore still carry this exact gap, `check_for_match` (00017),
-- `send_push_notification` (00010) and `update_safta_stats` (00020) among them. They are
-- deliberately NOT swept here: that is a different set of functions with a different review
-- surface, and folding 26 more ALTERs into a migration filed for 7 would make this file hard
-- to review for the thing it is actually about. Filed as MEXA-379, with an owner.
--
-- The count was 25 when this file was written and reviewed (MEXA-378). `00020` went live on
-- 2026-09-29 and added `update_safta_stats` to the set, which Guts caught on that migration's
-- review (MEXA-353). **Prose only — nothing in this file keys on the number.** Section 0c and
-- section 3 assert against this file's own seven functions and five triggers by name, so
-- `00020` landing first does not affect what `00028` does or whether it applies. Measured
-- after that apply: `select count(*) from pg_proc … where prosecdef and 'search_path=public'
-- = any(proconfig)` returns 26.
--
-- Nothing else in the notification chain needs touching: `send_push_notification(uuid,
-- text, text, jsonb)`, which all four funnel into, is already DEFINER with `EXECUTE`
-- revoked from `anon` and `authenticated` (00010), so a client still cannot push an
-- arbitrary notification to an arbitrary user.
--
-- =====================================================
-- 2. Three functions call postgis unqualified, and postgis is not in `public`
-- =====================================================
--
--   update_user_location()                     BEFORE INSERT/UPDATE OF lat,lng ON users
--   users_within_radius(numeric,numeric,int)   RPC
--   distance_between_users(uuid,uuid)          RPC
--
-- All three are from `00001_initial_schema.sql`, all three are SECURITY INVOKER, and all
-- three use bare `ST_SetSRID` / `ST_MakePoint` / `ST_Distance` / `ST_DWithin` and the bare
-- type name `geography`. Measured: postgis is installed `WITH SCHEMA extensions` (as
-- `00000_extensions.sql` asks), and every one of those four `st_*` symbols and both the
-- `geography` and `geometry` types live in `extensions`, with no copy in `public`.
--
-- It works today only because PostgREST puts `extensions` on the request `search_path`.
-- Take that away and the statement dies before it reaches the function body, at the cast:
--
--   update users set current_latitude = 41.0, current_longitude = -73.0   (search_path = public)
--     -> 42704: type "geography" does not exist
--
-- So **every profile save that carries coordinates depends on a PostgREST setting nothing
-- in this repo controls**, and any future caller on a different path - pg_cron, an Edge
-- Function through the pooler, or a DEFINER function correctly pinned to `public` - breaks.
-- Note the last one: pinning is contagious, and had part 1 been done alone with a
-- `public`-only habit, the next person to pin `update_user_location` would have broken
-- location for everyone.
--
-- The fix is the pin rather than schema-qualifying the bodies. Qualifying would mean
-- rewriting three function bodies - including the `DECLARE loc1 GEOGRAPHY` declarations,
-- which resolve through `search_path` just like the calls do - to fix a name-resolution
-- problem that a one-line ALTER fixes with no body change at all. Fewer lines for a
-- reviewer to check, and no way to accidentally change behaviour while "just qualifying".
--
-- `idx_colleges_location`, the GIST index on `(ST_SetSRID(...)::geography)`, needs nothing:
-- an index expression is parsed once at CREATE INDEX time and stored as OIDs.
--
-- =====================================================
-- What this file does NOT do
-- =====================================================
--
-- * No function body changes. Every statement here is `ALTER FUNCTION ... SET search_path`,
--   which touches `pg_proc.proconfig` and nothing else. Section 3 asserts `prosecdef` and
--   the trigger wiring came through untouched.
-- * No grant, policy or RLS change. Does not overlap MEXA-274 (table grants) or MEXA-289
--   (`USING (true)` reads).
-- * `update_match_last_message` is left alone. MEXA-296 flagged it as an INVOKER function
--   that works only because the `matches` UPDATE policy happens to admit both participants;
--   that is a real finding, but it is about SECURITY INVOKER vs DEFINER, not about name
--   resolution, and it is already written up in the audit doc.

BEGIN;

-- =====================================================
-- 0. Pre-flight
-- =====================================================

DO $$
DECLARE
  v_bad  TEXT;
  v_n    INTEGER;
  v_sig  TEXT;
  c_notify CONSTANT TEXT[] := ARRAY[
    'public.notify_new_match()',
    'public.notify_new_message()',
    'public.notify_safta_like()',
    'public.notify_super_like()'
  ];
  c_geo CONSTANT TEXT[] := ARRAY[
    'public.update_user_location()',
    'public.users_within_radius(numeric,numeric,integer)',
    'public.distance_between_users(uuid,uuid)'
  ];
BEGIN
  -- 0a. Every one of the seven exists, with exactly the signature this file names. A
  -- signature that has drifted means the ALTER below would silently target nothing -
  -- `ALTER FUNCTION` on a missing function errors, but only if the *name* is missing;
  -- an overload added since would make `to_regprocedure` ambiguous rather than wrong,
  -- so 0b also counts overloads.
  FOREACH v_sig IN ARRAY (c_notify || c_geo) LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      RAISE EXCEPTION 'MEXA-319: % does not exist - this database is not at 00001/00005', v_sig;
    END IF;
  END LOOP;

  -- 0b. No overloads, so "the function named X" is unambiguous for all seven.
  SELECT string_agg(format('%s x%s', p.proname, c), ', ')
    INTO v_bad
    FROM (
      SELECT p.proname, count(*) AS c
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('notify_new_match', 'notify_new_message', 'notify_safta_like',
                           'notify_super_like', 'update_user_location',
                           'users_within_radius', 'distance_between_users')
       GROUP BY p.proname
      HAVING count(*) > 1
    ) p;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319: overloaded in public, so the pin would cover only one of each: %', v_bad;
  END IF;

  -- 0c. Refuse a second run rather than re-pinning something a later migration moved.
  SELECT count(*) INTO v_n
    FROM pg_proc p
   WHERE p.oid IN (SELECT to_regprocedure(t.s)::oid FROM unnest(c_notify || c_geo) AS t(s))
     AND p.proconfig IS NOT NULL;
  IF v_n = 7 THEN
    RAISE EXCEPTION 'MEXA-319: all seven functions already pin search_path - 00028 is already applied';
  END IF;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MEXA-319: % of the seven already pin search_path - somebody pinned a subset; reconcile before applying 00028', v_n;
  END IF;

  -- 0d. The four notify_* really are the DEFINER half. If one of them has become INVOKER
  -- since the audit, the header's reasoning no longer describes this database.
  SELECT string_agg(p.oid::regprocedure::text, ', ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid IN (SELECT to_regprocedure(t.s)::oid FROM unnest(c_notify) AS t(s))
     AND p.prosecdef IS NOT TRUE;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319: expected all four notify_* to be SECURITY DEFINER; these are not: %', v_bad;
  END IF;

  -- 0e. The three geo functions are INVOKER, i.e. the pin here is about fragility and not
  -- about privilege. If one has become DEFINER, that is a security change nobody reviewed.
  SELECT string_agg(p.oid::regprocedure::text, ', ')
    INTO v_bad
    FROM pg_proc p
   WHERE p.oid IN (SELECT to_regprocedure(t.s)::oid FROM unnest(c_geo) AS t(s))
     AND p.prosecdef IS TRUE;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319: expected the three postgis functions to be SECURITY INVOKER; these are DEFINER: %', v_bad;
  END IF;

  -- 0f. `extensions` is where postgis actually is. The whole point of section 2 is to name
  -- the schema, so naming the wrong one would be worse than not pinning at all - the
  -- function would resolve nothing instead of resolving through luck.
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'postgis' AND n.nspname = 'extensions'
  ) THEN
    SELECT n.nspname INTO v_bad
      FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'postgis';
    RAISE EXCEPTION 'MEXA-319: postgis is in schema [%], not `extensions` - fix the pin below before applying', coalesce(v_bad, '(not installed)');
  END IF;

  -- 0g. ...and the four symbols and the type the three bodies name are reachable from
  -- `extensions` specifically, not merely somewhere on today's path.
  IF to_regtype('extensions.geography') IS NULL THEN
    RAISE EXCEPTION 'MEXA-319: type extensions.geography does not exist';
  END IF;
  SELECT string_agg(f, ', ') INTO v_bad
    FROM unnest(ARRAY['st_setsrid', 'st_makepoint', 'st_distance', 'st_dwithin']) f
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'extensions' AND p.proname = f
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319: these postgis functions are not in `extensions`: %', v_bad;
  END IF;

  -- 0h. All five triggers are still attached. Pinning a function nothing fires would be a
  -- sign this database has drifted from the repo, and the header claims they are live.
  SELECT string_agg(x.want, ', ') INTO v_bad
    FROM (VALUES
      ('trigger_notify_new_match',   'matches'),
      ('trigger_notify_new_message', 'messages'),
      ('trigger_notify_safta_like',  'safta_likes'),
      ('trigger_notify_super_like',  'swipes'),
      ('users_location_update',      'users')
    ) AS x(want, rel)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
        AND t.tgname = x.want AND c.relname = x.rel
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319: these triggers are missing: %', v_bad;
  END IF;
END
$$;

-- =====================================================
-- 1. The four SECURITY DEFINER notification triggers
-- =====================================================
--
-- `pg_temp` last, for the reason measured in the header. `public` is the only other schema
-- any of these four bodies needs: they read `users`, `matches` and `safta_accounts`, call
-- `send_push_notification`, and otherwise use `jsonb_build_object`, `LEFT` and `LENGTH`,
-- which are in `pg_catalog` and are always searched first regardless of `search_path`.

ALTER FUNCTION public.notify_new_match()   SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_new_message() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_safta_like()  SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_super_like()  SET search_path = public, pg_temp;

-- =====================================================
-- 2. The three postgis callers
-- =====================================================
--
-- `extensions` after `public`, matching the order Supabase gives its roles by default, so
-- a name that exists in both still resolves the way it does today.

ALTER FUNCTION public.update_user_location()                              SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.users_within_radius(NUMERIC, NUMERIC, INTEGER)      SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.distance_between_users(UUID, UUID)                  SET search_path = public, extensions, pg_temp;

COMMENT ON FUNCTION public.update_user_location() IS
  'BEFORE INSERT/UPDATE OF current_latitude, current_longitude ON users: maintains users.location. '
  'search_path is pinned to public, extensions, pg_temp (MEXA-319) because the body names ST_SetSRID, '
  'ST_MakePoint and the geography type unqualified and postgis lives in `extensions`. Without the pin '
  'this trigger works only for callers whose search_path already carries `extensions` - which PostgREST '
  'does and pg_cron, the pooler and any search_path-pinned DEFINER function do not.';

-- =====================================================
-- 3. Ledger, then assert the result in the same transaction
-- =====================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('00028', 'pin_function_search_path')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  -- 3a. Exactly the intended pin on each of the seven - not "is pinned", the literal value.
  SELECT string_agg(format('%s -> %s', x.sig, coalesce(array_to_string(p.proconfig, ' | '), '(none)')), '; ')
    INTO v_bad
    FROM (VALUES
      ('public.notify_new_match()',                          'search_path=public, pg_temp'),
      ('public.notify_new_message()',                        'search_path=public, pg_temp'),
      ('public.notify_safta_like()',                         'search_path=public, pg_temp'),
      ('public.notify_super_like()',                         'search_path=public, pg_temp'),
      ('public.update_user_location()',                      'search_path=public, extensions, pg_temp'),
      ('public.users_within_radius(numeric,numeric,integer)','search_path=public, extensions, pg_temp'),
      ('public.distance_between_users(uuid,uuid)',           'search_path=public, extensions, pg_temp')
    ) AS x(sig, want)
    JOIN pg_proc p ON p.oid = to_regprocedure(x.sig)
   WHERE p.proconfig IS DISTINCT FROM ARRAY[x.want];
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319: wrong search_path after the ALTERs: %', v_bad;
  END IF;

  -- 3b. No function in `public` is left SECURITY DEFINER with a mutable search_path. This
  -- is the lint this migration exists to satisfy, asserted rather than assumed.
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef AND p.proconfig IS NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319: still DEFINER with an unpinned search_path: %', v_bad;
  END IF;

  -- 3c. The ALTERs changed proconfig and nothing else: the DEFINER/INVOKER split is exactly
  -- what section 0 measured going in.
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_bad
    FROM pg_proc p
   WHERE (p.oid = to_regprocedure('public.notify_new_match()')   AND NOT p.prosecdef)
      OR (p.oid = to_regprocedure('public.notify_new_message()') AND NOT p.prosecdef)
      OR (p.oid = to_regprocedure('public.notify_safta_like()')  AND NOT p.prosecdef)
      OR (p.oid = to_regprocedure('public.notify_super_like()')  AND NOT p.prosecdef)
      OR (p.oid = to_regprocedure('public.update_user_location()')                         AND p.prosecdef)
      OR (p.oid = to_regprocedure('public.users_within_radius(numeric,numeric,integer)')   AND p.prosecdef)
      OR (p.oid = to_regprocedure('public.distance_between_users(uuid,uuid)')              AND p.prosecdef);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MEXA-319: prosecdef changed, which this file must not do: %', v_bad;
  END IF;

  -- 3d. The triggers are still wired to the same functions.
  SELECT count(*) INTO v_n
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT t.tgisinternal
     AND t.tgname IN ('trigger_notify_new_match', 'trigger_notify_new_message',
                      'trigger_notify_safta_like', 'trigger_notify_super_like',
                      'users_location_update');
  IF v_n <> 5 THEN
    RAISE EXCEPTION 'MEXA-319: expected the 5 triggers to still be attached, found %', v_n;
  END IF;

  -- 3e. `send_push_notification` is still out of client reach. Not changed here; asserted
  -- because section 1's whole claim is that the chain below these four is already right.
  IF has_function_privilege('authenticated', to_regprocedure('public.send_push_notification(uuid,text,text,jsonb)'), 'EXECUTE')
     OR has_function_privilege('anon', to_regprocedure('public.send_push_notification(uuid,text,text,jsonb)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'MEXA-319: anon or authenticated can EXECUTE send_push_notification - 00010 has been undone';
  END IF;

  -- 3f. The ledger row this file writes.
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '00028') THEN
    RAISE EXCEPTION 'MEXA-319: ledger row 00028 is missing';
  END IF;
END
$$;

COMMIT;
