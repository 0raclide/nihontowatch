-- Add 'yuhinkai' to the subscription_tier CHECK constraint on profiles
-- Yuhinkai tier gates collection access (private item cataloging)

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'enthusiast', 'collector', 'inner_circle', 'dealer', 'yuhinkai'));
