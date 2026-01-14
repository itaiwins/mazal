-- =====================================================
-- Profile Views Tracking
-- Tracks when users view shidduch profiles
-- =====================================================

-- Profile Views Table
CREATE TABLE IF NOT EXISTS shidduch_profile_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES shidduch_profiles(id) ON DELETE CASCADE,
  viewer_profile_id UUID REFERENCES shidduch_profiles(id) ON DELETE SET NULL,
  viewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  view_source TEXT CHECK (view_source IN ('browse', 'suggestion', 'search', 'shared_link')),
  view_duration_seconds INTEGER DEFAULT 0
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_profile_views_profile ON shidduch_profile_views(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer ON shidduch_profile_views(viewer_profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_date ON shidduch_profile_views(viewed_at);

-- RLS Policy - users can see views on their own profiles
ALTER TABLE shidduch_profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_views_select_own"
  ON shidduch_profile_views FOR SELECT
  USING (
    profile_id IN (
      SELECT sp.id FROM shidduch_profiles sp
      WHERE sp.user_id IN (SELECT u.id FROM users u WHERE u.auth_id = auth.uid())
    )
  );

-- Anyone authenticated can insert views
CREATE POLICY "profile_views_insert"
  ON shidduch_profile_views FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Function to get profile stats
CREATE OR REPLACE FUNCTION get_profile_stats(p_profile_id UUID)
RETURNS TABLE (
  profile_views BIGINT,
  unique_viewers BIGINT,
  suggestions_received BIGINT,
  interested_responses BIGINT,
  mutual_matches BIGINT,
  last_view_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM shidduch_profile_views WHERE profile_id = p_profile_id) AS profile_views,
    (SELECT COUNT(DISTINCT viewer_profile_id) FROM shidduch_profile_views WHERE profile_id = p_profile_id AND viewer_profile_id IS NOT NULL) AS unique_viewers,
    (SELECT COUNT(*) FROM shidduch_suggestions WHERE profile_a_id = p_profile_id OR profile_b_id = p_profile_id) AS suggestions_received,
    (SELECT COUNT(*) FROM shidduch_suggestions
     WHERE (profile_a_id = p_profile_id AND profile_b_status = 'interested')
        OR (profile_b_id = p_profile_id AND profile_a_status = 'interested')) AS interested_responses,
    (SELECT COUNT(*) FROM shidduch_suggestions
     WHERE (profile_a_id = p_profile_id OR profile_b_id = p_profile_id)
       AND profile_a_status = 'interested'
       AND profile_b_status = 'interested') AS mutual_matches,
    (SELECT MAX(viewed_at) FROM shidduch_profile_views WHERE profile_id = p_profile_id) AS last_view_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
