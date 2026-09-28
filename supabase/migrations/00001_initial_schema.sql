-- Mazal Dating App - Initial Database Schema
-- This migration creates all tables for the Mazal dating app

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Auth reference
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic info
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  display_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'non_binary', 'other')),
  gender_preference TEXT[] NOT NULL DEFAULT '{}',

  -- Location
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  current_city TEXT,
  current_state TEXT,
  current_country TEXT,
  location_updated_at TIMESTAMPTZ,
  location GEOGRAPHY(POINT, 4326), -- PostGIS geography for distance queries

  -- Profile
  bio TEXT,
  height_cm INTEGER CHECK (height_cm >= 100 AND height_cm <= 250),
  occupation TEXT,
  company TEXT,
  education TEXT,
  school TEXT,

  -- Jewish identity
  jewish_background TEXT NOT NULL CHECK (jewish_background IN (
    'orthodox', 'modern_orthodox', 'conservative', 'reform',
    'reconstructionist', 'secular', 'just_jewish', 'converting',
    'hasidic', 'chabad', 'sephardic', 'mizrachi'
  )),
  observance_level TEXT CHECK (observance_level IN (
    'very_observant', 'somewhat_observant', 'culturally_jewish', 'not_observant'
  )),
  keeps_shabbat TEXT CHECK (keeps_shabbat IN ('always', 'sometimes', 'rarely', 'never')),
  keeps_kosher TEXT CHECK (keeps_kosher IN ('strict', 'kosher_style', 'at_home', 'not_kosher')),
  synagogue_attendance TEXT CHECK (synagogue_attendance IN ('weekly', 'holidays', 'rarely', 'never')),
  jewish_education TEXT CHECK (jewish_education IN ('day_school', 'hebrew_school', 'yeshiva', 'seminary', 'none', 'other')),

  -- Preferences & dealbreakers
  looking_for TEXT NOT NULL CHECK (looking_for IN ('serious', 'casual', 'marriage_minded', 'open')),
  wants_children TEXT CHECK (wants_children IN ('yes', 'no', 'have_and_want_more', 'have_and_done', 'open')),
  partner_must_be_jewish BOOLEAN DEFAULT true,
  raise_children_jewish BOOLEAN DEFAULT true,
  willing_to_relocate BOOLEAN DEFAULT false,

  -- Settings
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  is_photo_verified BOOLEAN DEFAULT false,
  is_premium BOOLEAN DEFAULT false,
  shabbat_mode_enabled BOOLEAN DEFAULT false,
  shabbat_mode_start TIME DEFAULT '18:00',
  shabbat_mode_end TIME DEFAULT '21:00',

  -- Orthodox-only section
  is_orthodox_only BOOLEAN DEFAULT false,

  -- Matching algorithm data
  elo_score INTEGER DEFAULT 1000,
  response_rate DECIMAL(3, 2) DEFAULT 0.5,
  avg_response_time_hours DECIMAL(5, 2),

  -- Instagram integration
  instagram_user_id TEXT,
  instagram_access_token TEXT,
  show_instagram_friends BOOLEAN DEFAULT false,

  -- Onboarding
  onboarding_complete BOOLEAN DEFAULT false
);

-- Index for location queries
CREATE INDEX idx_users_location ON users USING GIST(location);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX idx_users_auth_id ON users(auth_id);

-- =====================================================
-- USER PHOTOS
-- =====================================================
CREATE TABLE user_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  photo_order INTEGER NOT NULL CHECK (photo_order >= 0 AND photo_order <= 5),
  is_primary BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id, photo_order)
);

CREATE INDEX idx_user_photos_user ON user_photos(user_id);

-- =====================================================
-- USER PROMPTS
-- =====================================================
CREATE TABLE user_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  prompt_id TEXT NOT NULL,
  answer TEXT NOT NULL CHECK (char_length(answer) <= 300),
  display_order INTEGER NOT NULL CHECK (display_order >= 0 AND display_order <= 2),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id, display_order)
);

CREATE INDEX idx_user_prompts_user ON user_prompts(user_id);

-- =====================================================
-- USER BADGES
-- =====================================================
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  badge_type TEXT NOT NULL CHECK (badge_type IN (
    'birthright', 'day_school', 'hebrew_speaker', 'yiddish_speaker',
    'israeli', 'verified_jewish', 'photo_verified'
  )),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id, badge_type)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- =====================================================
-- SWIPES
-- =====================================================
CREATE TABLE swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swiper_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  swiped_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('like', 'super_like', 'pass')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(swiper_id, swiped_id),
  CHECK (swiper_id != swiped_id)
);

CREATE INDEX idx_swipes_swiper ON swipes(swiper_id);
CREATE INDEX idx_swipes_swiped ON swipes(swiped_id);
CREATE INDEX idx_swipes_action ON swipes(action) WHERE action IN ('like', 'super_like');

-- =====================================================
-- MATCHES
-- =====================================================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT true,
  user1_unmatched BOOLEAN DEFAULT false,
  user2_unmatched BOOLEAN DEFAULT false,
  last_message_at TIMESTAMPTZ,

  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id) -- Ensure consistent ordering
);

CREATE INDEX idx_matches_user1 ON matches(user1_id) WHERE is_active = true;
CREATE INDEX idx_matches_user2 ON matches(user2_id) WHERE is_active = true;

-- =====================================================
-- MESSAGES
-- =====================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'voice', 'gif', 'icebreaker')),
  media_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_messages_match ON messages(match_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(match_id, is_read) WHERE is_read = false;

-- =====================================================
-- SAFTA MODE - GRANDPARENT MATCHMAKING
-- =====================================================

-- Safta accounts (grandparent/parent accounts)
CREATE TABLE safta_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('parent', 'grandparent', 'aunt_uncle', 'sibling')),
  is_active BOOLEAN DEFAULT true
);

-- Connections between safta and users
CREATE TABLE safta_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  safta_account_id UUID REFERENCES safta_accounts(id) ON DELETE CASCADE NOT NULL,
  connected_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMPTZ,

  UNIQUE(safta_account_id, connected_user_id)
);

CREATE INDEX idx_safta_connections_user ON safta_connections(connected_user_id);

-- Safta likes (when grandparent likes someone for their grandchild)
CREATE TABLE safta_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  safta_account_id UUID REFERENCES safta_accounts(id) ON DELETE CASCADE NOT NULL,
  for_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  liked_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  note TEXT CHECK (char_length(note) <= 200),
  sent_to_user BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(safta_account_id, for_user_id, liked_user_id)
);

CREATE INDEX idx_safta_likes_for_user ON safta_likes(for_user_id);
CREATE INDEX idx_safta_likes_liked_user ON safta_likes(liked_user_id);

-- Aggregated safta stats (materialized for performance)
CREATE TABLE user_safta_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_safta_likes INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- LOCATIONS
-- =====================================================

-- Saved locations
CREATE TABLE saved_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  location_type TEXT CHECK (location_type IN ('college', 'city', 'neighborhood', 'custom')),
  college_name TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius_km DECIMAL(5, 2) DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_saved_locations_user ON saved_locations(user_id);

-- Colleges/Universities database
CREATE TABLE colleges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  campus_radius_km DECIMAL(5, 2) DEFAULT 2,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'USA',
  has_hillel BOOLEAN DEFAULT false,
  has_chabad BOOLEAN DEFAULT false,
  jewish_population_estimate INTEGER
);

CREATE INDEX idx_colleges_name ON colleges(name);
-- An index on an expression needs its own pair of parentheses; without them Postgres
-- rejects the cast with `syntax error at or near "::"` and the whole file fails to parse.
CREATE INDEX idx_colleges_location ON colleges USING GIST(
  (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
);

-- User college affiliations
CREATE TABLE user_colleges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  college_id UUID REFERENCES colleges(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('current_student', 'alumni', 'grad_student', 'faculty')),
  graduation_year INTEGER CHECK (graduation_year >= 1950 AND graduation_year <= 2100),
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id, college_id)
);

CREATE INDEX idx_user_colleges_college ON user_colleges(college_id);

-- =====================================================
-- SUBSCRIPTIONS
-- =====================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('mazal_plus', 'mazal_gold')),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')),
  provider TEXT NOT NULL CHECK (provider IN ('apple', 'google', 'stripe')),
  provider_subscription_id TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_active ON subscriptions(user_id, status) WHERE status = 'active';

-- =====================================================
-- BLOCKS AND REPORTS
-- =====================================================
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reported_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CHECK (reporter_id != reported_id)
);

CREATE INDEX idx_reports_status ON reports(status) WHERE status = 'pending';

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users updated_at
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Update user location geography when lat/long changes
CREATE OR REPLACE FUNCTION update_user_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_latitude IS NOT NULL AND NEW.current_longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.current_longitude, NEW.current_latitude), 4326)::geography;
    NEW.location_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_location_update
  BEFORE INSERT OR UPDATE OF current_latitude, current_longitude ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_location();

-- Check for match when like is created
CREATE OR REPLACE FUNCTION check_for_match()
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

CREATE TRIGGER swipes_check_match
  AFTER INSERT ON swipes
  FOR EACH ROW
  EXECUTE FUNCTION check_for_match();

-- Update match last_message_at when message is sent
CREATE OR REPLACE FUNCTION update_match_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE matches
  SET last_message_at = NEW.created_at
  WHERE id = NEW.match_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_update_match
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_match_last_message();

-- Update safta stats when like is added
CREATE OR REPLACE FUNCTION update_safta_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_safta_stats (user_id, total_safta_likes, updated_at)
  VALUES (NEW.liked_user_id, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET total_safta_likes = user_safta_stats.total_safta_likes + 1,
      updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER safta_likes_update_stats
  AFTER INSERT ON safta_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_safta_stats();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Calculate distance between two users
CREATE OR REPLACE FUNCTION distance_between_users(user1_id UUID, user2_id UUID)
RETURNS FLOAT AS $$
DECLARE
  loc1 GEOGRAPHY;
  loc2 GEOGRAPHY;
BEGIN
  SELECT location INTO loc1 FROM users WHERE id = user1_id;
  SELECT location INTO loc2 FROM users WHERE id = user2_id;

  IF loc1 IS NULL OR loc2 IS NULL THEN
    RETURN NULL;
  END IF;

  -- Returns distance in meters, convert to miles
  RETURN ST_Distance(loc1, loc2) * 0.000621371;
END;
$$ LANGUAGE plpgsql;

-- Get users within radius (miles)
CREATE OR REPLACE FUNCTION users_within_radius(
  center_lat DECIMAL,
  center_lng DECIMAL,
  radius_miles INTEGER
)
RETURNS TABLE(user_id UUID, distance_miles FLOAT) AS $$
DECLARE
  center_point GEOGRAPHY;
  radius_meters FLOAT;
BEGIN
  center_point := ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography;
  radius_meters := radius_miles * 1609.34;

  RETURN QUERY
  SELECT
    u.id,
    ST_Distance(u.location, center_point) * 0.000621371 as distance_miles
  FROM users u
  WHERE u.is_active = true
    AND u.location IS NOT NULL
    AND ST_DWithin(u.location, center_point, radius_meters)
  ORDER BY distance_miles;
END;
$$ LANGUAGE plpgsql;
