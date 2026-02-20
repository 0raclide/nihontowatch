-- Add correlation_id to user_searches for client-side CTR linking
-- The unified event pipeline generates a UUID on the client and passes it
-- with both the search event and the subsequent search_click event.

ALTER TABLE user_searches ADD COLUMN IF NOT EXISTS correlation_id UUID;

CREATE INDEX IF NOT EXISTS idx_user_searches_correlation
  ON user_searches(correlation_id)
  WHERE correlation_id IS NOT NULL;
