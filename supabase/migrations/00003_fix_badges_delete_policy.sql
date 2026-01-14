-- Fix missing DELETE policy for user_badges table
-- This migration adds the DELETE policy that was missing from the initial RLS setup

-- Drop existing policy if exists (for idempotency)
DROP POLICY IF EXISTS "Users can delete own badges" ON user_badges;

-- Create DELETE policy for user_badges
CREATE POLICY "Users can delete own badges"
  ON user_badges FOR DELETE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
