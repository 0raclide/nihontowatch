-- Simplify subscription tiers: 6 → 3 (free, inner_circle, dealer)
-- Removed tiers: enthusiast ("Pro"), collector ("Collector"), yuhinkai
--
-- All previously-paid features (fresh_data, setsumei, alerts, etc.) are now free.
-- Inner Circle gates: exclusive access (private listings, Discord, LINE, collection).
-- Dealer gates: analytics dashboard + collection access.

-- 1. Migrate existing users on removed tiers to free
UPDATE profiles SET subscription_tier = 'free'
WHERE subscription_tier IN ('enthusiast', 'collector', 'yuhinkai');

-- 2. Update CHECK constraint on profiles table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'inner_circle', 'dealer'));

-- 3. Update RLS: collectors visibility policy already fixed in 138 to inner_circle only.
--    No further RLS changes needed — existing policies reference 'inner_circle' and 'dealer' only.
