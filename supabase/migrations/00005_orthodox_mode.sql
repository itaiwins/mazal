-- Orthodox Mode Migration
-- Run this SQL in your Supabase SQL Editor

-- 1. Add Orthodox-specific columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_orthodox_user BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS orthodox_subscription_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shadchan_id UUID REFERENCES public.users(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shabbat_mode_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS shabbat_timezone TEXT DEFAULT 'America/New_York';

-- 2. Create Orthodox emails tracking table (to prevent cross-registration)
CREATE TABLE IF NOT EXISTS public.orthodox_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Shadchanim (matchmakers) table
CREATE TABLE IF NOT EXISTS public.shadchanim (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  years_experience INTEGER DEFAULT 0,
  successful_matches INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Shadchan connections (Orthodox users connecting with matchmakers)
CREATE TABLE IF NOT EXISTS public.shadchan_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  shadchan_id UUID REFERENCES public.shadchanim(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(user_id, shadchan_id)
);

-- 5. Create Shadchan recommendations
CREATE TABLE IF NOT EXISTS public.shadchan_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shadchan_id UUID REFERENCES public.shadchanim(id) ON DELETE CASCADE NOT NULL,
  for_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  recommended_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  note TEXT,
  is_viewed BOOLEAN DEFAULT FALSE,
  is_accepted BOOLEAN DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  UNIQUE(shadchan_id, for_user_id, recommended_user_id)
);

-- 6. Enable RLS on new tables
ALTER TABLE public.orthodox_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadchanim ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadchan_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadchan_recommendations ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for orthodox_emails
CREATE POLICY "Users can view their own orthodox email" ON public.orthodox_emails
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Service role can manage orthodox emails" ON public.orthodox_emails
  FOR ALL USING (auth.role() = 'service_role');

-- 8. RLS Policies for shadchanim
CREATE POLICY "Anyone can view active shadchanim" ON public.shadchanim
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Shadchanim can update their own profile" ON public.shadchanim
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- 9. RLS Policies for shadchan_connections
CREATE POLICY "Users can view their own connections" ON public.shadchan_connections
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Shadchanim can view connections to them" ON public.shadchan_connections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shadchanim s
      WHERE s.id = shadchan_id AND s.user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can create connections" ON public.shadchan_connections
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Shadchanim can update connection status" ON public.shadchan_connections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.shadchanim s
      WHERE s.id = shadchan_id AND s.user_id::text = auth.uid()::text
    )
  );

-- 10. RLS Policies for shadchan_recommendations
CREATE POLICY "Users can view recommendations for them" ON public.shadchan_recommendations
  FOR SELECT USING (auth.uid()::text = for_user_id::text);

CREATE POLICY "Shadchanim can view their recommendations" ON public.shadchan_recommendations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shadchanim s
      WHERE s.id = shadchan_id AND s.user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Shadchanim can create recommendations" ON public.shadchan_recommendations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shadchanim s
      WHERE s.id = shadchan_id AND s.user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can update recommendations for them" ON public.shadchan_recommendations
  FOR UPDATE USING (auth.uid()::text = for_user_id::text);

-- 11. Create index for Orthodox user discovery
CREATE INDEX IF NOT EXISTS idx_users_orthodox ON public.users(is_orthodox_user) WHERE is_orthodox_user = TRUE;

-- 12. Function to check if email is Orthodox-only
CREATE OR REPLACE FUNCTION public.is_orthodox_email(check_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.orthodox_emails WHERE email = LOWER(check_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Function to register Orthodox email
CREATE OR REPLACE FUNCTION public.register_orthodox_email(user_email TEXT, user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.orthodox_emails (email, user_id)
  VALUES (LOWER(user_email), user_uuid)
  ON CONFLICT (email) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Update users RLS to filter Orthodox in discovery
-- Orthodox users should only see other Orthodox users
-- This will be handled in the app query, but we add a helper function

CREATE OR REPLACE FUNCTION public.get_orthodox_discovery_profiles(
  requesting_user_id UUID,
  max_distance_km INTEGER DEFAULT 100,
  min_age INTEGER DEFAULT 18,
  max_age INTEGER DEFAULT 99,
  preferred_genders TEXT[] DEFAULT ARRAY['male', 'female']
)
RETURNS SETOF public.users AS $$
BEGIN
  RETURN QUERY
  SELECT u.*
  FROM public.users u
  WHERE u.is_orthodox_user = TRUE
    AND u.id != requesting_user_id
    AND u.is_active = TRUE
    AND u.onboarding_complete = TRUE
    AND u.gender = ANY(preferred_genders)
    AND EXTRACT(YEAR FROM AGE(u.date_of_birth)) BETWEEN min_age AND max_age
    -- Exclude users already swiped
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes s
      WHERE s.swiper_id = requesting_user_id AND s.swiped_id = u.id
    )
    -- Exclude blocked users
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = u.id)
         OR (b.blocker_id = u.id AND b.blocked_id = requesting_user_id)
    )
  ORDER BY u.elo_score DESC NULLS LAST
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.orthodox_emails IS 'Tracks emails used for Orthodox accounts to prevent cross-registration';
COMMENT ON TABLE public.shadchanim IS 'Verified matchmakers for Orthodox users';
COMMENT ON TABLE public.shadchan_connections IS 'Connections between Orthodox users and their shadchanim';
COMMENT ON TABLE public.shadchan_recommendations IS 'Match recommendations from shadchanim to Orthodox users';
