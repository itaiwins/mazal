-- Mazal - Extension bootstrap
--
-- Must run before 00001_initial_schema.sql.
--
-- 00001 declares `CREATE EXTENSION IF NOT EXISTS "postgis"` at the top and then uses
-- `GEOGRAPHY(POINT, 4326)` and `::geography` further down. Postgres parses a whole
-- multi-statement batch before executing any of it, so applying 00001 to a database
-- without PostGIS fails at parse time with `syntax error at or near "::"` — the
-- extension its own first line would have created is not visible yet.
--
-- Both extensions go in the `extensions` schema, which is Supabase's convention and is
-- already on the search_path for postgres, anon, authenticated and service_role. A new
-- Supabase project ships uuid-ossp there, so that line is normally a no-op.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
