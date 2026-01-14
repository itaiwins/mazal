-- Safta Pro Migration
-- Run this SQL in your Supabase SQL Editor

-- 1. Add subscription columns to safta_accounts table
ALTER TABLE public.safta_accounts
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'cancelled', 'expired')),
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'safta_pro')),
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) DEFAULT NULL;

-- 2. Create Safta daily usage tracking table
CREATE TABLE IF NOT EXISTS public.safta_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  safta_account_id UUID REFERENCES public.safta_accounts(id) ON DELETE CASCADE NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recommendations_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(safta_account_id, usage_date)
);

-- 3. Enable RLS on new table
ALTER TABLE public.safta_daily_usage ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for safta_daily_usage
CREATE POLICY "Saftas can view their own usage" ON public.safta_daily_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.safta_accounts sa
      WHERE sa.id = safta_account_id AND sa.auth_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Saftas can update their own usage" ON public.safta_daily_usage
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.safta_accounts sa
      WHERE sa.id = safta_account_id AND sa.auth_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Saftas can insert their own usage" ON public.safta_daily_usage
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.safta_accounts sa
      WHERE sa.id = safta_account_id AND sa.auth_id::text = auth.uid()::text
    )
  );

-- 5. Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_safta_daily_usage_date ON public.safta_daily_usage(safta_account_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_safta_accounts_subscription ON public.safta_accounts(subscription_status) WHERE subscription_status = 'active';

-- 6. Function to get daily recommendation count
CREATE OR REPLACE FUNCTION public.get_safta_daily_recommendations(safta_id UUID)
RETURNS INTEGER AS $$
DECLARE
  rec_count INTEGER;
BEGIN
  SELECT COALESCE(recommendations_count, 0) INTO rec_count
  FROM public.safta_daily_usage
  WHERE safta_account_id = safta_id AND usage_date = CURRENT_DATE;

  RETURN COALESCE(rec_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to increment daily recommendation count
CREATE OR REPLACE FUNCTION public.increment_safta_recommendation(safta_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO public.safta_daily_usage (safta_account_id, usage_date, recommendations_count)
  VALUES (safta_id, CURRENT_DATE, 1)
  ON CONFLICT (safta_account_id, usage_date)
  DO UPDATE SET
    recommendations_count = safta_daily_usage.recommendations_count + 1,
    updated_at = NOW()
  RETURNING recommendations_count INTO new_count;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to check if safta can recommend (respects daily limit for free tier)
CREATE OR REPLACE FUNCTION public.can_safta_recommend(safta_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sub_plan TEXT;
  daily_count INTEGER;
  daily_limit INTEGER := 10; -- Free tier limit
BEGIN
  -- Get subscription plan
  SELECT subscription_plan INTO sub_plan FROM public.safta_accounts WHERE id = safta_id;

  -- Pro users have unlimited
  IF sub_plan = 'safta_pro' THEN
    RETURN TRUE;
  END IF;

  -- Check daily count for free tier
  daily_count := public.get_safta_daily_recommendations(safta_id);

  RETURN daily_count < daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to get safta connection count
CREATE OR REPLACE FUNCTION public.get_safta_connection_count(safta_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM public.safta_connections
    WHERE safta_account_id = safta_id AND status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to check if safta can add more connections
CREATE OR REPLACE FUNCTION public.can_safta_add_connection(safta_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sub_plan TEXT;
  connection_count INTEGER;
  connection_limit INTEGER := 1; -- Free tier limit
BEGIN
  -- Get subscription plan
  SELECT subscription_plan INTO sub_plan FROM public.safta_accounts WHERE id = safta_id;

  -- Pro users have unlimited
  IF sub_plan = 'safta_pro' THEN
    RETURN TRUE;
  END IF;

  -- Check connection count for free tier
  connection_count := public.get_safta_connection_count(safta_id);

  RETURN connection_count < connection_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Add comments
COMMENT ON COLUMN public.safta_accounts.subscription_status IS 'Subscription status: free, active, cancelled, expired';
COMMENT ON COLUMN public.safta_accounts.subscription_plan IS 'Subscription plan: free or safta_pro';
COMMENT ON TABLE public.safta_daily_usage IS 'Tracks daily recommendation usage for free Safta tier limits';
