-- 097_dealer_portal.sql
-- Dealer Portal MVP — Phase 1 & 2 schema changes

-- 1a. Fix stale CHECK constraint on profiles.subscription_tier
-- The existing constraint may still reference 'connoisseur' from the old tier system.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'enthusiast', 'collector', 'inner_circle', 'dealer'));

-- 1b. Link user accounts to dealers
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dealer_id INTEGER REFERENCES dealers(id);
CREATE INDEX IF NOT EXISTS idx_profiles_dealer_id ON profiles(dealer_id) WHERE dealer_id IS NOT NULL;

-- 1c. Distinguish scraper-crawled from dealer-uploaded listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'scraper';
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source) WHERE source = 'dealer';

-- 1d. Inquiries table (Phase 2 — create now so schema is ready)
CREATE TABLE IF NOT EXISTS inquiries (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  dealer_id INTEGER NOT NULL REFERENCES dealers(id),
  collector_id UUID NOT NULL REFERENCES auth.users(id),
  collector_name TEXT,
  collector_tier TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inquiries_dealer_id ON inquiries(dealer_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_listing_id ON inquiries(listing_id);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- RLS: Collectors can create inquiries for their own user
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Collectors can create inquiries') THEN
    CREATE POLICY "Collectors can create inquiries" ON inquiries
      FOR INSERT WITH CHECK (auth.uid() = collector_id);
  END IF;
END $$;

-- RLS: Users can read their own inquiries, dealers can read inquiries for their listings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own inquiries') THEN
    CREATE POLICY "Users can read own inquiries" ON inquiries
      FOR SELECT USING (
        auth.uid() = collector_id
        OR dealer_id IN (SELECT p.dealer_id FROM profiles p WHERE p.id = auth.uid())
      );
  END IF;
END $$;

-- 1e. LINE notification token for dealers
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS line_notify_token TEXT;
