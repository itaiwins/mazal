-- Mazal Dating App - Row Level Security Policies
-- This migration adds RLS policies for all tables

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE safta_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE safta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE safta_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_safta_stats ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USERS POLICIES
-- =====================================================

-- Users can view their own full profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = auth_id);

-- Users can view other active users (for discovery)
-- Excludes blocked users
CREATE POLICY "Users can view other profiles"
  ON users FOR SELECT
  USING (
    is_active = true
    AND auth_id != auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM blocks
      WHERE (blocker_id = (SELECT id FROM users WHERE auth_id = auth.uid())
             AND blocked_id = users.id)
         OR (blocker_id = users.id
             AND blocked_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
    )
  );

-- Users can insert their own profile
CREATE POLICY "Users can create own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = auth_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = auth_id);

-- =====================================================
-- USER PHOTOS POLICIES
-- =====================================================

-- Users can view their own photos
CREATE POLICY "Users can view own photos"
  ON user_photos FOR SELECT
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Users can view photos of active, non-blocked users
CREATE POLICY "Users can view other photos"
  ON user_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_photos.user_id
        AND u.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM blocks
          WHERE (blocker_id = (SELECT id FROM users WHERE auth_id = auth.uid())
                 AND blocked_id = u.id)
             OR (blocker_id = u.id
                 AND blocked_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
        )
    )
  );

-- Users can manage their own photos
CREATE POLICY "Users can insert own photos"
  ON user_photos FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update own photos"
  ON user_photos FOR UPDATE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can delete own photos"
  ON user_photos FOR DELETE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- =====================================================
-- USER PROMPTS POLICIES
-- =====================================================

CREATE POLICY "Users can view all prompts"
  ON user_prompts FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own prompts"
  ON user_prompts FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update own prompts"
  ON user_prompts FOR UPDATE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can delete own prompts"
  ON user_prompts FOR DELETE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- =====================================================
-- USER BADGES POLICIES
-- =====================================================

CREATE POLICY "Users can view all badges"
  ON user_badges FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own badges"
  ON user_badges FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update own badges"
  ON user_badges FOR UPDATE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- =====================================================
-- SWIPES POLICIES
-- =====================================================

-- Users can only see their own swipes
CREATE POLICY "Users can view own swipes"
  ON swipes FOR SELECT
  USING (swiper_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Users can create swipes
CREATE POLICY "Users can create swipes"
  ON swipes FOR INSERT
  WITH CHECK (swiper_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- =====================================================
-- MATCHES POLICIES
-- =====================================================

-- Users can see matches they're part of
CREATE POLICY "Users can view own matches"
  ON matches FOR SELECT
  USING (
    user1_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR user2_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Users can update matches they're part of (for unmatch)
CREATE POLICY "Users can update own matches"
  ON matches FOR UPDATE
  USING (
    user1_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    OR user2_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- =====================================================
-- MESSAGES POLICIES
-- =====================================================

-- Users can view messages in their matches
CREATE POLICY "Users can view messages in own matches"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND (m.user1_id = (SELECT id FROM users WHERE auth_id = auth.uid())
             OR m.user2_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
    )
  );

-- Users can send messages in their matches
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND m.is_active = true
        AND (m.user1_id = sender_id OR m.user2_id = sender_id)
    )
  );

-- Users can update their own messages (for read receipts)
CREATE POLICY "Users can update messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = messages.match_id
        AND (m.user1_id = (SELECT id FROM users WHERE auth_id = auth.uid())
             OR m.user2_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
    )
  );

-- =====================================================
-- SAFTA POLICIES
-- =====================================================

-- Safta accounts
CREATE POLICY "Safta can view own account"
  ON safta_accounts FOR SELECT
  USING (auth_id = auth.uid());

CREATE POLICY "Safta can create account"
  ON safta_accounts FOR INSERT
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Safta can update own account"
  ON safta_accounts FOR UPDATE
  USING (auth_id = auth.uid());

-- Safta connections
CREATE POLICY "Safta can view own connections"
  ON safta_connections FOR SELECT
  USING (
    safta_account_id IN (SELECT id FROM safta_accounts WHERE auth_id = auth.uid())
    OR connected_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Safta can create connections"
  ON safta_connections FOR INSERT
  WITH CHECK (
    safta_account_id IN (SELECT id FROM safta_accounts WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users can update connection status"
  ON safta_connections FOR UPDATE
  USING (
    connected_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- Safta likes
CREATE POLICY "Safta can view own likes"
  ON safta_likes FOR SELECT
  USING (
    safta_account_id IN (SELECT id FROM safta_accounts WHERE auth_id = auth.uid())
    OR for_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Safta can create likes"
  ON safta_likes FOR INSERT
  WITH CHECK (
    safta_account_id IN (SELECT id FROM safta_accounts WHERE auth_id = auth.uid())
  );

-- Safta stats (read-only for users)
CREATE POLICY "Users can view safta stats"
  ON user_safta_stats FOR SELECT
  USING (true);

-- =====================================================
-- LOCATIONS POLICIES
-- =====================================================

CREATE POLICY "Users can manage own saved locations"
  ON saved_locations FOR ALL
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Colleges are public
CREATE POLICY "Anyone can view colleges"
  ON colleges FOR SELECT
  USING (true);

-- User colleges
CREATE POLICY "Users can view all college affiliations"
  ON user_colleges FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own college affiliations"
  ON user_colleges FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update own college affiliations"
  ON user_colleges FOR UPDATE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can delete own college affiliations"
  ON user_colleges FOR DELETE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- =====================================================
-- SUBSCRIPTIONS POLICIES
-- =====================================================

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Subscriptions are managed by service role only (webhooks)
-- No insert/update/delete policies for regular users

-- =====================================================
-- BLOCKS AND REPORTS POLICIES
-- =====================================================

CREATE POLICY "Users can view own blocks"
  ON blocks FOR SELECT
  USING (blocker_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can create blocks"
  ON blocks FOR INSERT
  WITH CHECK (blocker_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can delete own blocks"
  ON blocks FOR DELETE
  USING (blocker_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  WITH CHECK (reporter_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (reporter_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
