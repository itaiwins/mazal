-- Safta Messages Table
-- Enables messaging between Saftas and the users they're helping

-- Create safta_messages table
CREATE TABLE IF NOT EXISTS safta_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID REFERENCES safta_connections(id) ON DELETE CASCADE NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('safta', 'user')),
  sender_id UUID NOT NULL, -- Either safta_account_id or user_id depending on sender_type
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX idx_safta_messages_connection ON safta_messages(connection_id);
CREATE INDEX idx_safta_messages_created_at ON safta_messages(created_at DESC);

-- Enable RLS
ALTER TABLE safta_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for safta_messages

-- Both parties can view messages in their connections
CREATE POLICY "Users can view own safta messages"
  ON safta_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM safta_connections sc
      WHERE sc.id = safta_messages.connection_id
        AND (
          sc.connected_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
          OR sc.safta_account_id IN (SELECT id FROM safta_accounts WHERE auth_id = auth.uid())
        )
    )
  );

-- Users can send messages in their connections
CREATE POLICY "Users can send safta messages"
  ON safta_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM safta_connections sc
      WHERE sc.id = connection_id
        AND sc.status = 'accepted'
        AND (
          (sender_type = 'user' AND sc.connected_user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
          OR (sender_type = 'safta' AND sc.safta_account_id IN (SELECT id FROM safta_accounts WHERE auth_id = auth.uid()))
        )
    )
  );

-- Users can update read status of messages sent to them
CREATE POLICY "Users can mark safta messages as read"
  ON safta_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM safta_connections sc
      WHERE sc.id = safta_messages.connection_id
        AND (
          (sender_type = 'safta' AND sc.connected_user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
          OR (sender_type = 'user' AND sc.safta_account_id IN (SELECT id FROM safta_accounts WHERE auth_id = auth.uid()))
        )
    )
  );
