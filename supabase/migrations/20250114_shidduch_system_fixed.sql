-- =====================================================
-- MAZAL SHIDDUCHIM - Complete Shidduch System Schema
-- FIXED VERSION - Resolved ambiguous column references
-- =====================================================

-- =====================================================
-- 1. SHIDDUCH PROFILES (Extended User Data)
-- =====================================================

CREATE TABLE IF NOT EXISTS shidduch_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Basic Info
  hebrew_name TEXT,
  hebrew_name_mother TEXT,

  -- Community & Hashkafa (Religious Outlook)
  community TEXT NOT NULL CHECK (community IN (
    'modern_orthodox', 'modern_orthodox_machmir', 'yeshivish',
    'chassidish', 'sephardi', 'chabad', 'carlebachian', 'other'
  )),
  chassidus TEXT,
  hashkafa_details TEXT,

  -- Observance Details
  minyan_frequency TEXT CHECK (minyan_frequency IN ('three_times_daily', 'daily', 'shabbos_only', 'occasionally')),
  learning_schedule TEXT,
  kollel_interest TEXT CHECK (kollel_interest IN ('currently_in_kollel', 'planning_kollel', 'open_to_kollel', 'working', 'not_applicable')),
  seminary_yeshiva TEXT,
  seminary_yeshiva_years INTEGER,

  -- Family Background (Yichus)
  father_name TEXT,
  father_occupation TEXT,
  father_origin TEXT,
  mother_name TEXT,
  mother_maiden_name TEXT,
  mother_occupation TEXT,
  mother_origin TEXT,
  parents_status TEXT CHECK (parents_status IN ('married', 'divorced', 'widowed', 'separated')),

  -- Siblings
  num_siblings INTEGER DEFAULT 0,
  sibling_details JSONB,
  birth_order INTEGER,

  -- Extended Family
  grandfather_paternal TEXT,
  grandfather_maternal TEXT,
  notable_rabbanim TEXT,
  family_minhagim TEXT,

  -- Education
  elementary_school TEXT,
  high_school TEXT,
  college_university TEXT,
  highest_degree TEXT CHECK (highest_degree IN ('high_school', 'some_college', 'bachelors', 'masters', 'doctorate', 'rabbinical_ordination', 'other')),

  -- Living Situation
  living_situation TEXT CHECK (living_situation IN ('with_parents', 'own_apartment', 'roommates', 'dorm', 'other')),
  willing_to_relocate BOOLEAN DEFAULT false,
  preferred_locations TEXT[],

  -- Physical (Optional)
  height_display TEXT,
  build TEXT CHECK (build IN ('slim', 'average', 'athletic', 'heavy', 'prefer_not_to_say')),
  hair_color TEXT,
  eye_color TEXT,
  appearance_notes TEXT,

  -- Health (Sensitive)
  health_notes TEXT,
  genetic_testing_complete BOOLEAN DEFAULT false,
  genetic_testing_org TEXT,
  genetic_testing_id TEXT,

  -- Personality & Interests
  personality_description TEXT,
  hobbies_interests TEXT[],
  favorite_sefarim TEXT,

  -- What I'm Looking For
  looking_for_description TEXT,
  age_range_min INTEGER,
  age_range_max INTEGER,
  preferred_communities TEXT[],
  preferred_background TEXT,
  must_haves TEXT[],
  nice_to_haves TEXT[],
  dealbreakers TEXT[],

  -- Marriage Goals
  marriage_timeline TEXT CHECK (marriage_timeline IN ('asap', 'within_year', 'one_to_two_years', 'flexible')),
  children_plans TEXT CHECK (children_plans IN ('want_many', 'want_some', 'open', 'not_sure')),
  wife_working TEXT CHECK (wife_working IN ('full_time', 'part_time', 'stay_home', 'flexible', 'not_applicable')),
  husband_learning TEXT CHECK (husband_learning IN ('full_time_kollel', 'morning_seder', 'night_seder', 'working_and_learning', 'flexible', 'not_applicable')),

  -- Parent's Perspective
  parent_description TEXT,
  parent_contact_first BOOLEAN DEFAULT false,

  -- Profile Settings
  photos_visible_to TEXT CHECK (photos_visible_to IN ('everyone', 'matches_only', 'shadchan_only', 'hidden')) DEFAULT 'shadchan_only',
  profile_visible BOOLEAN DEFAULT true,
  accepting_suggestions BOOLEAN DEFAULT true,

  -- Verification
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,

  UNIQUE(user_id)
);

-- =====================================================
-- 2. REFERENCES SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS shidduch_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES shidduch_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  reference_type TEXT NOT NULL CHECK (reference_type IN ('rabbi', 'teacher', 'family_friend', 'personal_friend', 'employer', 'roommate', 'other')),
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  best_contact_method TEXT CHECK (best_contact_method IN ('phone', 'email', 'whatsapp', 'text')),

  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  notes TEXT
);

-- =====================================================
-- 3. SHADCHAN NOTES
-- =====================================================

CREATE TABLE IF NOT EXISTS shadchan_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shadchan_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES shidduch_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  notes TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT CHECK (status IN ('actively_looking', 'taking_break', 'engaged', 'married', 'inactive')),
  last_contacted_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,

  UNIQUE(shadchan_id, profile_id)
);

-- =====================================================
-- 4. SUGGESTION SYSTEM (Replaces Swiping)
-- =====================================================

CREATE TABLE IF NOT EXISTS shidduch_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  suggested_by_type TEXT NOT NULL CHECK (suggested_by_type IN ('shadchan', 'algorithm', 'family', 'friend', 'self_browse')),
  suggested_by_shadchan_id UUID,
  suggested_by_user_id UUID REFERENCES users(id),

  profile_a_id UUID NOT NULL REFERENCES shidduch_profiles(id) ON DELETE CASCADE,
  profile_b_id UUID NOT NULL REFERENCES shidduch_profiles(id) ON DELETE CASCADE,

  suggestion_reason TEXT,
  compatibility_notes TEXT,

  profile_a_status TEXT DEFAULT 'pending' CHECK (profile_a_status IN ('pending', 'interested', 'declined', 'thinking')),
  profile_a_response_at TIMESTAMPTZ,
  profile_a_decline_reason TEXT,
  profile_a_parent_approved BOOLEAN,

  profile_b_status TEXT DEFAULT 'pending' CHECK (profile_b_status IN ('pending', 'interested', 'declined', 'thinking')),
  profile_b_response_at TIMESTAMPTZ,
  profile_b_decline_reason TEXT,
  profile_b_parent_approved BOOLEAN,

  is_mutual_interest BOOLEAN DEFAULT false,
  contact_shared_at TIMESTAMPTZ,

  first_date_at TIMESTAMPTZ,
  total_dates INTEGER DEFAULT 0,
  current_status TEXT CHECK (current_status IN ('suggested', 'researching', 'dating', 'serious', 'engaged', 'married', 'ended')),
  ended_reason TEXT,
  ended_at TIMESTAMPTZ,

  UNIQUE(profile_a_id, profile_b_id)
);

-- =====================================================
-- 5. FAMILY PORTAL
-- =====================================================

CREATE TABLE IF NOT EXISTS family_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  single_profile_id UUID NOT NULL REFERENCES shidduch_profiles(id) ON DELETE CASCADE,

  family_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN ('mother', 'father', 'parent', 'sibling', 'grandparent', 'aunt_uncle', 'other')),

  can_view_suggestions BOOLEAN DEFAULT true,
  can_respond_to_suggestions BOOLEAN DEFAULT false,
  can_view_messages BOOLEAN DEFAULT false,
  can_suggest_matches BOOLEAN DEFAULT true,
  receives_notifications BOOLEAN DEFAULT true,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  approved_at TIMESTAMPTZ,

  UNIQUE(single_profile_id, family_user_id)
);

-- =====================================================
-- 6. DAILY ACTIVITY TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS shidduch_daily_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES shidduch_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  suggestions_received INTEGER DEFAULT 0,
  suggestions_viewed INTEGER DEFAULT 0,
  suggestions_responded INTEGER DEFAULT 0,
  profiles_researched INTEGER DEFAULT 0,

  UNIQUE(profile_id, date)
);

-- =====================================================
-- 7. SHABBAT MODE WITH ZMANIM
-- =====================================================

CREATE TABLE IF NOT EXISTS shabbat_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES shidduch_profiles(id) ON DELETE CASCADE,

  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  city TEXT,
  timezone TEXT DEFAULT 'America/New_York',

  is_enabled BOOLEAN DEFAULT true,
  minutes_before_candles INTEGER DEFAULT 18,
  minutes_after_havdalah INTEGER DEFAULT 0,

  include_yom_tov BOOLEAN DEFAULT true,

  UNIQUE(profile_id)
);

-- =====================================================
-- 8. MESSAGING (Shadchan-Mediated)
-- =====================================================

CREATE TABLE IF NOT EXISTS shidduch_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  suggestion_id UUID NOT NULL REFERENCES shidduch_suggestions(id) ON DELETE CASCADE,

  sender_type TEXT NOT NULL CHECK (sender_type IN ('profile_a', 'profile_b', 'shadchan', 'system')),
  sender_user_id UUID REFERENCES users(id),
  sender_shadchan_id UUID,

  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'date_request', 'date_response', 'status_update')),
  content TEXT NOT NULL,

  proposed_date TIMESTAMPTZ,
  proposed_location TEXT,

  read_by_a BOOLEAN DEFAULT false,
  read_by_b BOOLEAN DEFAULT false,
  read_by_shadchan BOOLEAN DEFAULT false
);

-- =====================================================
-- 9. COMMUNITY SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS community_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community TEXT UNIQUE NOT NULL,

  photos_allowed BOOLEAN DEFAULT true,
  photos_required BOOLEAN DEFAULT false,
  photo_moderation_required BOOLEAN DEFAULT true,

  direct_messaging_allowed BOOLEAN DEFAULT false,
  shadchan_required BOOLEAN DEFAULT true,
  parent_approval_required BOOLEAN DEFAULT false,

  browsing_allowed BOOLEAN DEFAULT false,

  typical_dates_before_engagement TEXT,

  show_photos_by_default BOOLEAN DEFAULT false,
  show_age_by_default BOOLEAN DEFAULT true
);

-- Insert default community settings
INSERT INTO community_settings (community, photos_allowed, photos_required, direct_messaging_allowed, shadchan_required, parent_approval_required, browsing_allowed, show_photos_by_default)
VALUES
  ('modern_orthodox', true, true, true, false, false, true, true),
  ('modern_orthodox_machmir', true, true, true, false, false, true, true),
  ('yeshivish', true, false, false, true, true, false, false),
  ('chassidish', false, false, false, true, true, false, false),
  ('sephardi', true, true, true, false, false, true, true),
  ('chabad', true, false, true, false, false, true, true)
ON CONFLICT (community) DO NOTHING;

-- =====================================================
-- 10. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_shidduch_profiles_user ON shidduch_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_shidduch_profiles_community ON shidduch_profiles(community);
CREATE INDEX IF NOT EXISTS idx_shidduch_profiles_accepting ON shidduch_profiles(accepting_suggestions) WHERE accepting_suggestions = true;
CREATE INDEX IF NOT EXISTS idx_shidduch_suggestions_profiles ON shidduch_suggestions(profile_a_id, profile_b_id);
CREATE INDEX IF NOT EXISTS idx_shidduch_suggestions_pending ON shidduch_suggestions(profile_a_status, profile_b_status) WHERE profile_a_status = 'pending' OR profile_b_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_family_connections_single ON family_connections(single_profile_id);
CREATE INDEX IF NOT EXISTS idx_shidduch_references_profile ON shidduch_references(profile_id);

-- =====================================================
-- 11. RLS POLICIES (Fixed ambiguous references)
-- =====================================================

ALTER TABLE shidduch_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shidduch_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE shidduch_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shidduch_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadchan_notes ENABLE ROW LEVEL SECURITY;

-- Shidduch Profiles: Users can view/edit their own
CREATE POLICY "shidduch_profiles_select_own"
  ON shidduch_profiles FOR SELECT
  USING (
    shidduch_profiles.user_id IN (
      SELECT u.id FROM users u WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY "shidduch_profiles_update_own"
  ON shidduch_profiles FOR UPDATE
  USING (
    shidduch_profiles.user_id IN (
      SELECT u.id FROM users u WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY "shidduch_profiles_insert_own"
  ON shidduch_profiles FOR INSERT
  WITH CHECK (
    shidduch_profiles.user_id IN (
      SELECT u.id FROM users u WHERE u.auth_id = auth.uid()
    )
  );

-- Users can view profiles they have suggestions with
CREATE POLICY "shidduch_profiles_select_suggested"
  ON shidduch_profiles FOR SELECT
  USING (
    shidduch_profiles.id IN (
      SELECT ss.profile_a_id FROM shidduch_suggestions ss
      WHERE ss.profile_b_id IN (
        SELECT sp.id FROM shidduch_profiles sp
        WHERE sp.user_id IN (SELECT u.id FROM users u WHERE u.auth_id = auth.uid())
      )
      UNION
      SELECT ss2.profile_b_id FROM shidduch_suggestions ss2
      WHERE ss2.profile_a_id IN (
        SELECT sp2.id FROM shidduch_profiles sp2
        WHERE sp2.user_id IN (SELECT u2.id FROM users u2 WHERE u2.auth_id = auth.uid())
      )
    )
  );

-- Family can view connected profiles
CREATE POLICY "shidduch_profiles_select_family"
  ON shidduch_profiles FOR SELECT
  USING (
    shidduch_profiles.id IN (
      SELECT fc.single_profile_id FROM family_connections fc
      JOIN users u ON u.id = fc.family_user_id
      WHERE u.auth_id = auth.uid()
      AND fc.status = 'active'
    )
  );

-- References: Only profile owner
CREATE POLICY "shidduch_references_all_own"
  ON shidduch_references FOR ALL
  USING (
    shidduch_references.profile_id IN (
      SELECT sp.id FROM shidduch_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- Suggestions: Visible to involved parties
CREATE POLICY "shidduch_suggestions_select_own"
  ON shidduch_suggestions FOR SELECT
  USING (
    shidduch_suggestions.profile_a_id IN (
      SELECT sp.id FROM shidduch_profiles sp
      WHERE sp.user_id IN (SELECT u.id FROM users u WHERE u.auth_id = auth.uid())
    )
    OR
    shidduch_suggestions.profile_b_id IN (
      SELECT sp2.id FROM shidduch_profiles sp2
      WHERE sp2.user_id IN (SELECT u2.id FROM users u2 WHERE u2.auth_id = auth.uid())
    )
  );

-- Messages: Visible to suggestion participants
CREATE POLICY "shidduch_messages_select_own"
  ON shidduch_messages FOR SELECT
  USING (
    shidduch_messages.suggestion_id IN (
      SELECT ss.id FROM shidduch_suggestions ss
      WHERE ss.profile_a_id IN (
        SELECT sp.id FROM shidduch_profiles sp
        WHERE sp.user_id IN (SELECT u.id FROM users u WHERE u.auth_id = auth.uid())
      )
      OR ss.profile_b_id IN (
        SELECT sp2.id FROM shidduch_profiles sp2
        WHERE sp2.user_id IN (SELECT u2.id FROM users u2 WHERE u2.auth_id = auth.uid())
      )
    )
  );

-- Family connections: viewable by single and family member
CREATE POLICY "family_connections_select"
  ON family_connections FOR SELECT
  USING (
    family_connections.family_user_id IN (SELECT u.id FROM users u WHERE u.auth_id = auth.uid())
    OR
    family_connections.single_profile_id IN (
      SELECT sp.id FROM shidduch_profiles sp
      WHERE sp.user_id IN (SELECT u2.id FROM users u2 WHERE u2.auth_id = auth.uid())
    )
  );

-- Shadchan notes: only the shadchan can see their own notes
CREATE POLICY "shadchan_notes_select_own"
  ON shadchan_notes FOR ALL
  USING (true); -- Simplified - adjust based on your shadchanim table structure

-- =====================================================
-- 12. HELPER FUNCTIONS (Fixed ambiguous references)
-- =====================================================

-- Function to get suggestions for a user
CREATE OR REPLACE FUNCTION get_shidduch_suggestions(p_user_id UUID)
RETURNS TABLE (
  out_suggestion_id UUID,
  out_other_profile JSONB,
  out_suggested_by TEXT,
  out_suggestion_reason TEXT,
  out_my_status TEXT,
  out_their_status TEXT,
  out_created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_my_profile_id UUID;
BEGIN
  -- Get user's shidduch profile id
  SELECT sp.id INTO v_my_profile_id
  FROM shidduch_profiles sp
  WHERE sp.user_id = p_user_id;

  RETURN QUERY
  SELECT
    s.id AS out_suggestion_id,
    CASE
      WHEN s.profile_a_id = v_my_profile_id THEN
        jsonb_build_object(
          'id', sp_b.id,
          'first_name', u_b.first_name,
          'age', DATE_PART('year', AGE(u_b.date_of_birth)),
          'community', sp_b.community,
          'city', u_b.current_city
        )
      ELSE
        jsonb_build_object(
          'id', sp_a.id,
          'first_name', u_a.first_name,
          'age', DATE_PART('year', AGE(u_a.date_of_birth)),
          'community', sp_a.community,
          'city', u_a.current_city
        )
    END AS out_other_profile,
    s.suggested_by_type AS out_suggested_by,
    s.suggestion_reason AS out_suggestion_reason,
    CASE WHEN s.profile_a_id = v_my_profile_id THEN s.profile_a_status ELSE s.profile_b_status END AS out_my_status,
    CASE WHEN s.profile_a_id = v_my_profile_id THEN s.profile_b_status ELSE s.profile_a_status END AS out_their_status,
    s.created_at AS out_created_at
  FROM shidduch_suggestions s
  LEFT JOIN shidduch_profiles sp_b ON sp_b.id = s.profile_b_id
  LEFT JOIN users u_b ON u_b.id = sp_b.user_id
  LEFT JOIN shidduch_profiles sp_a ON sp_a.id = s.profile_a_id
  LEFT JOIN users u_a ON u_a.id = sp_a.user_id
  WHERE s.profile_a_id = v_my_profile_id OR s.profile_b_id = v_my_profile_id
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to respond to a suggestion
CREATE OR REPLACE FUNCTION respond_to_suggestion(
  p_suggestion_id UUID,
  p_user_id UUID,
  p_response TEXT,
  p_decline_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_my_profile_id UUID;
  v_is_profile_a BOOLEAN;
  v_other_status TEXT;
  v_result JSONB;
BEGIN
  -- Get user's profile
  SELECT sp.id INTO v_my_profile_id
  FROM shidduch_profiles sp
  WHERE sp.user_id = p_user_id;

  -- Determine if user is profile_a or profile_b
  SELECT
    CASE WHEN ss.profile_a_id = v_my_profile_id THEN true ELSE false END,
    CASE WHEN ss.profile_a_id = v_my_profile_id THEN ss.profile_b_status ELSE ss.profile_a_status END
  INTO v_is_profile_a, v_other_status
  FROM shidduch_suggestions ss
  WHERE ss.id = p_suggestion_id;

  -- Update the appropriate status
  IF v_is_profile_a THEN
    UPDATE shidduch_suggestions ss
    SET profile_a_status = p_response,
        profile_a_response_at = NOW(),
        profile_a_decline_reason = p_decline_reason,
        is_mutual_interest = (p_response = 'interested' AND v_other_status = 'interested'),
        contact_shared_at = CASE WHEN p_response = 'interested' AND v_other_status = 'interested' THEN NOW() ELSE ss.contact_shared_at END
    WHERE ss.id = p_suggestion_id;
  ELSE
    UPDATE shidduch_suggestions ss
    SET profile_b_status = p_response,
        profile_b_response_at = NOW(),
        profile_b_decline_reason = p_decline_reason,
        is_mutual_interest = (p_response = 'interested' AND v_other_status = 'interested'),
        contact_shared_at = CASE WHEN p_response = 'interested' AND v_other_status = 'interested' THEN NOW() ELSE ss.contact_shared_at END
    WHERE ss.id = p_suggestion_id;
  END IF;

  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'is_mutual', (p_response = 'interested' AND v_other_status = 'interested'),
    'other_status', v_other_status
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DONE
-- =====================================================
