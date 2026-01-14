-- =====================================================
-- ADD CREATOR TRACKING TO SHIDDUCH PROFILES
-- This migration adds support for parents/grandparents/shadchanim
-- to create and manage profiles for singles
-- =====================================================

-- Add creator tracking columns to shidduch_profiles
ALTER TABLE shidduch_profiles
  ADD COLUMN IF NOT EXISTS created_by_type TEXT CHECK (created_by_type IN ('self', 'parent', 'grandparent', 'uncle', 'aunt', 'shadchan')),
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS single_first_name TEXT,
  ADD COLUMN IF NOT EXISTS single_last_name TEXT,
  ADD COLUMN IF NOT EXISTS single_email TEXT,
  ADD COLUMN IF NOT EXISTS single_phone TEXT;

-- Set default for existing profiles (they created their own)
UPDATE shidduch_profiles
SET created_by_type = 'self',
    created_by_user_id = user_id
WHERE created_by_type IS NULL;

-- Index for looking up profiles by creator (for multi-profile management)
CREATE INDEX IF NOT EXISTS idx_shidduch_profiles_created_by
ON shidduch_profiles(created_by_user_id);

-- Index for looking up profiles by creator type
CREATE INDEX IF NOT EXISTS idx_shidduch_profiles_creator_type
ON shidduch_profiles(created_by_type);

-- =====================================================
-- ROW LEVEL SECURITY UPDATES
-- Allow creators to manage profiles they created
-- =====================================================

-- Drop existing select policy if it exists
DROP POLICY IF EXISTS "Users can view own shidduch profile" ON shidduch_profiles;
DROP POLICY IF EXISTS "Users can view profiles they created" ON shidduch_profiles;
DROP POLICY IF EXISTS "Users can update profiles they created" ON shidduch_profiles;

-- Create new policies that support both profile owners AND creators
CREATE POLICY "Users can view profiles they own or created"
ON shidduch_profiles FOR SELECT
USING (
  user_id = auth.uid()
  OR created_by_user_id = auth.uid()
  OR profile_visible = true
);

CREATE POLICY "Users can update profiles they own or created"
ON shidduch_profiles FOR UPDATE
USING (
  user_id = auth.uid()
  OR created_by_user_id = auth.uid()
);

CREATE POLICY "Users can insert profiles"
ON shidduch_profiles FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR created_by_user_id = auth.uid()
);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get all profiles created by a user
CREATE OR REPLACE FUNCTION get_profiles_by_creator(p_creator_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  single_first_name TEXT,
  single_last_name TEXT,
  hebrew_name TEXT,
  community TEXT,
  created_by_type TEXT,
  profile_visible BOOLEAN,
  accepting_suggestions BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.user_id,
    sp.single_first_name,
    sp.single_last_name,
    sp.hebrew_name,
    sp.community,
    sp.created_by_type,
    sp.profile_visible,
    sp.accepting_suggestions,
    sp.created_at,
    sp.updated_at
  FROM shidduch_profiles sp
  WHERE sp.created_by_user_id = p_creator_id
  ORDER BY sp.created_at DESC;
END;
$$;

-- Function to get profile count by creator
CREATE OR REPLACE FUNCTION get_creator_profile_count(p_creator_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count
  FROM shidduch_profiles
  WHERE created_by_user_id = p_creator_id;

  RETURN profile_count;
END;
$$;

-- =====================================================
-- AI MATCHING SUPPORT
-- Add columns for compatibility scoring
-- =====================================================

-- Add compatibility-related columns if they don't exist
ALTER TABLE shidduch_suggestions
  ADD COLUMN IF NOT EXISTS compatibility_score INTEGER CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

-- Update suggested_by_type to include 'algorithm' if not already there
-- (It should already be there, but let's be safe)
ALTER TABLE shidduch_suggestions
  DROP CONSTRAINT IF EXISTS shidduch_suggestions_suggested_by_type_check;

ALTER TABLE shidduch_suggestions
  ADD CONSTRAINT shidduch_suggestions_suggested_by_type_check
  CHECK (suggested_by_type IN ('shadchan', 'algorithm', 'family', 'friend', 'self_browse'));

-- Index for finding AI-generated suggestions
CREATE INDEX IF NOT EXISTS idx_shidduch_suggestions_algorithm
ON shidduch_suggestions(suggested_by_type)
WHERE suggested_by_type = 'algorithm';

-- =====================================================
-- BROWSE PROFILES SUPPORT
-- Function to browse profiles with filters
-- =====================================================

CREATE OR REPLACE FUNCTION browse_shidduch_profiles(
  p_viewer_id UUID,
  p_gender TEXT DEFAULT NULL,
  p_community TEXT DEFAULT NULL,
  p_age_min INTEGER DEFAULT NULL,
  p_age_max INTEGER DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  single_first_name TEXT,
  hebrew_name TEXT,
  age INTEGER,
  community TEXT,
  city TEXT,
  state TEXT,
  hashkafa_details TEXT,
  looking_for_description TEXT,
  profile_visible BOOLEAN,
  photos_visible_to TEXT,
  created_by_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.single_first_name,
    sp.hebrew_name,
    EXTRACT(YEAR FROM age(COALESCE(u.date_of_birth, NOW())))::INTEGER as age,
    sp.community,
    u.current_city as city,
    u.current_state as state,
    sp.hashkafa_details,
    sp.looking_for_description,
    sp.profile_visible,
    sp.photos_visible_to,
    sp.created_by_type,
    sp.created_at
  FROM shidduch_profiles sp
  JOIN users u ON sp.user_id = u.id
  WHERE sp.profile_visible = true
    AND sp.accepting_suggestions = true
    AND (p_gender IS NULL OR u.gender = p_gender)
    AND (p_community IS NULL OR sp.community = p_community)
    AND (p_city IS NULL OR u.current_city ILIKE '%' || p_city || '%')
    AND (p_state IS NULL OR u.current_state = p_state)
    AND (p_age_min IS NULL OR EXTRACT(YEAR FROM age(u.date_of_birth)) >= p_age_min)
    AND (p_age_max IS NULL OR EXTRACT(YEAR FROM age(u.date_of_birth)) <= p_age_max)
  ORDER BY sp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Success message
SELECT 'Creator tracking migration completed successfully!' as message;
