-- Mazal - Close the RLS gaps left by earlier migrations
--
-- Found while applying every migration to a fresh database (MEXA-246). Four public
-- tables were created without `ENABLE ROW LEVEL SECURITY`, and Supabase grants
-- SELECT/INSERT/UPDATE/DELETE on public tables to `anon` and `authenticated` by default.
-- Through PostgREST that made them fully readable and writable by an unauthenticated
-- caller holding only the anon key:
--
--   notification_queue        title/body of every push, incl. match names and message
--                             previews, keyed by user_id  (00005_notification_triggers)
--   shabbat_schedules         per-profile latitude/longitude and city
--                             (20250114_shidduch_system_fixed)
--   shidduch_daily_activity   per-profile activity counters (same migration)
--   community_settings        community configuration (same migration)
--
-- No client code reads any of these four, so denying access breaks nothing in the app.
-- The owner-scoped policies below exist so the shidduch feature still works when its
-- flag is turned back on (see docs/ROADMAP.md).

-- =====================================================
-- notification_queue
-- =====================================================
-- Written only by send_push_notification(), which is SECURITY DEFINER, and read only by
-- the notification worker using service_role. Both bypass RLS, so no policy is needed:
-- enabling RLS with no policy denies anon and authenticated outright.
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- shabbat_schedules
-- =====================================================
ALTER TABLE shabbat_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shabbat_schedules_all_own"
  ON shabbat_schedules FOR ALL
  USING (
    shabbat_schedules.profile_id IN (
      SELECT sp.id FROM shidduch_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    shabbat_schedules.profile_id IN (
      SELECT sp.id FROM shidduch_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- =====================================================
-- shidduch_daily_activity
-- =====================================================
ALTER TABLE shidduch_daily_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shidduch_daily_activity_all_own"
  ON shidduch_daily_activity FOR ALL
  USING (
    shidduch_daily_activity.profile_id IN (
      SELECT sp.id FROM shidduch_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    shidduch_daily_activity.profile_id IN (
      SELECT sp.id FROM shidduch_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- =====================================================
-- community_settings
-- =====================================================
-- Reference data, not user data. Signed-in users may read it; nobody but service_role
-- may change it.
ALTER TABLE community_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_settings_select_authenticated"
  ON community_settings FOR SELECT
  TO authenticated
  USING (true);
