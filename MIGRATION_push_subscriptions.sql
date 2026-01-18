-- Push subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES room_members(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_member ON push_subscriptions(member_id);
