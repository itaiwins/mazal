-- Migration: Notification Triggers
-- Description: Create triggers to send push notifications on key events

-- =====================================================
-- HELPER FUNCTION: Send notification via Edge Function
-- =====================================================
CREATE OR REPLACE FUNCTION send_push_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
) RETURNS void AS $$
DECLARE
  edge_function_url TEXT;
BEGIN
  -- Get the Edge Function URL from app settings or use default
  edge_function_url := current_setting('app.settings.edge_function_url', true);

  IF edge_function_url IS NULL THEN
    -- Default to the Supabase project URL pattern
    edge_function_url := 'https://' || current_setting('app.settings.project_ref', true) || '.supabase.co/functions/v1/send-notification';
  END IF;

  -- Queue the notification (actual sending happens via pg_net or Edge Function invocation)
  -- For now, we'll use the http extension if available, otherwise just log
  RAISE NOTICE 'Notification queued for user %: % - %', p_user_id, p_title, p_body;

  -- Insert into a notifications queue table for processing
  INSERT INTO notification_queue (user_id, title, body, data, created_at)
  VALUES (p_user_id, p_title, p_body, p_data, NOW())
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- NOTIFICATION QUEUE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_pending
  ON notification_queue(status, created_at)
  WHERE status = 'pending';

-- =====================================================
-- TRIGGER: New Match Notification
-- =====================================================
CREATE OR REPLACE FUNCTION notify_new_match()
RETURNS TRIGGER AS $$
DECLARE
  user1_name TEXT;
  user2_name TEXT;
BEGIN
  -- Get user names
  SELECT first_name INTO user1_name FROM users WHERE id = NEW.user1_id;
  SELECT first_name INTO user2_name FROM users WHERE id = NEW.user2_id;

  -- Notify user1
  PERFORM send_push_notification(
    NEW.user1_id,
    'Mazal Tov! New Match!',
    'You matched with ' || user2_name || '! Start a conversation.',
    jsonb_build_object('type', 'new_match', 'matchId', NEW.id, 'userId', NEW.user2_id)
  );

  -- Notify user2
  PERFORM send_push_notification(
    NEW.user2_id,
    'Mazal Tov! New Match!',
    'You matched with ' || user1_name || '! Start a conversation.',
    jsonb_build_object('type', 'new_match', 'matchId', NEW.id, 'userId', NEW.user1_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_match
  AFTER INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_match();

-- =====================================================
-- TRIGGER: New Message Notification
-- =====================================================
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  recipient_id UUID;
  match_record RECORD;
BEGIN
  -- Get sender name
  SELECT first_name INTO sender_name FROM users WHERE id = NEW.sender_id;

  -- Get match details
  SELECT * INTO match_record FROM matches WHERE id = NEW.match_id;

  -- Determine recipient (the other user in the match)
  IF match_record.user1_id = NEW.sender_id THEN
    recipient_id := match_record.user2_id;
  ELSE
    recipient_id := match_record.user1_id;
  END IF;

  -- Send notification to recipient
  PERFORM send_push_notification(
    recipient_id,
    sender_name || ' sent you a message',
    CASE
      WHEN NEW.message_type = 'image' THEN 'Sent you a photo'
      WHEN NEW.message_type = 'gif' THEN 'Sent you a GIF'
      WHEN NEW.message_type = 'voice' THEN 'Sent you a voice message'
      ELSE LEFT(NEW.content, 50) || CASE WHEN LENGTH(NEW.content) > 50 THEN '...' ELSE '' END
    END,
    jsonb_build_object('type', 'new_message', 'matchId', NEW.match_id, 'senderId', NEW.sender_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- =====================================================
-- TRIGGER: Super Like Notification
-- =====================================================
CREATE OR REPLACE FUNCTION notify_super_like()
RETURNS TRIGGER AS $$
DECLARE
  swiper_name TEXT;
BEGIN
  -- Only notify for super likes
  IF NEW.action != 'super_like' THEN
    RETURN NEW;
  END IF;

  -- Get swiper name
  SELECT first_name INTO swiper_name FROM users WHERE id = NEW.swiper_id;

  -- Notify the swiped user
  PERFORM send_push_notification(
    NEW.swiped_id,
    'Someone Super Liked you!',
    swiper_name || ' thinks you are special!',
    jsonb_build_object('type', 'super_like', 'userId', NEW.swiper_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_super_like
  AFTER INSERT ON swipes
  FOR EACH ROW
  EXECUTE FUNCTION notify_super_like();

-- =====================================================
-- TRIGGER: Safta Like Notification
-- =====================================================
CREATE OR REPLACE FUNCTION notify_safta_like()
RETURNS TRIGGER AS $$
DECLARE
  safta_name TEXT;
BEGIN
  -- Only notify when the like is sent to the user
  IF NEW.sent_to_user = false THEN
    RETURN NEW;
  END IF;

  -- Get safta name
  SELECT display_name INTO safta_name FROM safta_accounts WHERE id = NEW.safta_account_id;

  -- Notify the user that their safta found someone
  PERFORM send_push_notification(
    NEW.for_user_id,
    'Your family found someone!',
    safta_name || ' thinks you should meet someone special.',
    jsonb_build_object('type', 'safta_like', 'userId', NEW.liked_user_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_safta_like
  AFTER INSERT OR UPDATE OF sent_to_user ON safta_likes
  FOR EACH ROW
  WHEN (NEW.sent_to_user = true)
  EXECUTE FUNCTION notify_safta_like();
