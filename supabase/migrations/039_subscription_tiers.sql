-- =============================================================================
-- SUBSCRIPTION TIERS
-- Migration: 039_subscription_tiers.sql
-- Description: Adds subscription tier support to profiles for Pro features
-- =============================================================================

-- =============================================================================
-- 1. ADD SUBSCRIPTION FIELDS TO PROFILES
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'enthusiast', 'connoisseur', 'dealer')),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive'
    CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'past_due')),
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Index for tier-based queries (e.g., finding all Connoisseurs)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier
  ON profiles(subscription_tier);

-- Index for finding active subscriptions
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status
  ON profiles(subscription_status)
  WHERE subscription_status = 'active';

-- Index for Stripe customer lookups (webhook handling)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN profiles.subscription_tier IS 'User subscription tier: free, enthusiast ($25/mo), connoisseur ($200/mo), dealer ($150/mo)';
COMMENT ON COLUMN profiles.subscription_status IS 'Stripe subscription status: active, inactive, cancelled, past_due';
COMMENT ON COLUMN profiles.subscription_started_at IS 'When the current subscription started';
COMMENT ON COLUMN profiles.subscription_expires_at IS 'When the current subscription period ends';
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Active Stripe subscription ID';

-- =============================================================================
-- 2. SETSUMEI TRANSLATIONS CACHE
-- =============================================================================

CREATE TABLE IF NOT EXISTS setsumei_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  translator TEXT DEFAULT 'claude' CHECK (translator IN ('claude', 'manual', 'deepl')),
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id)
);

CREATE INDEX IF NOT EXISTS idx_setsumei_listing
  ON setsumei_translations(listing_id);

COMMENT ON TABLE setsumei_translations IS 'Cached translations of NBTHK/NTHK setsumei (certification descriptions)';
COMMENT ON COLUMN setsumei_translations.translator IS 'Translation source: claude (AI), manual (human), deepl';
COMMENT ON COLUMN setsumei_translations.confidence IS 'Translation confidence score 0-1';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_setsumei_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_setsumei_updated ON setsumei_translations;

CREATE TRIGGER on_setsumei_updated
  BEFORE UPDATE ON setsumei_translations
  FOR EACH ROW EXECUTE FUNCTION update_setsumei_updated_at();

-- =============================================================================
-- 3. RLS FOR SETSUMEI TRANSLATIONS
-- =============================================================================

ALTER TABLE setsumei_translations ENABLE ROW LEVEL SECURITY;

-- Anyone can read translations (but feature is gated in application layer)
CREATE POLICY setsumei_select_all ON setsumei_translations
  FOR SELECT
  USING (TRUE);

-- Only service role can insert/update translations
CREATE POLICY setsumei_insert_service ON setsumei_translations
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY setsumei_update_service ON setsumei_translations
  FOR UPDATE
  USING (TRUE)
  WITH CHECK (TRUE);

-- =============================================================================
-- 4. HELPER FUNCTIONS
-- =============================================================================

-- Function to check if user has access to a feature
CREATE OR REPLACE FUNCTION has_feature_access(
  p_user_id UUID,
  p_feature TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
BEGIN
  -- Get user's subscription tier and status
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM profiles
  WHERE id = p_user_id;

  -- No subscription or inactive = free tier
  IF v_tier IS NULL OR v_status != 'active' THEN
    v_tier := 'free';
  END IF;

  -- Check feature access based on tier
  RETURN CASE p_feature
    -- Enthusiast+ features
    WHEN 'fresh_data' THEN v_tier IN ('enthusiast', 'connoisseur', 'dealer')
    WHEN 'setsumei_translation' THEN v_tier IN ('enthusiast', 'connoisseur', 'dealer')
    WHEN 'inquiry_emails' THEN v_tier IN ('enthusiast', 'connoisseur', 'dealer')
    WHEN 'saved_searches' THEN v_tier IN ('enthusiast', 'connoisseur', 'dealer')
    WHEN 'export_data' THEN v_tier IN ('enthusiast', 'connoisseur', 'dealer')
    -- Connoisseur+ features
    WHEN 'search_alerts' THEN v_tier IN ('connoisseur')
    WHEN 'private_listings' THEN v_tier IN ('connoisseur')
    WHEN 'artist_stats' THEN v_tier IN ('connoisseur')
    WHEN 'yuhinkai_discord' THEN v_tier IN ('connoisseur')
    WHEN 'line_access' THEN v_tier IN ('connoisseur')
    -- Dealer features
    WHEN 'dealer_analytics' THEN v_tier IN ('dealer')
    -- Default: no access
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's subscription tier (with fallback to free)
CREATE OR REPLACE FUNCTION get_subscription_tier(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM profiles
  WHERE id = p_user_id;

  -- Return free if no subscription or not active
  IF v_tier IS NULL OR v_status != 'active' THEN
    RETURN 'free';
  END IF;

  RETURN v_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_feature_access IS 'Check if user has access to a specific Pro feature based on subscription tier';
COMMENT ON FUNCTION get_subscription_tier IS 'Get user subscription tier with fallback to free for inactive/no subscription';
