-- =============================================================================
-- Migration 033: Dealer Contact Information & Inquiry Tracking
-- Purpose: Store dealer contact methods and sales policies for inquiry feature
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Part 1: Dealer Contact & Policy Columns
-- -----------------------------------------------------------------------------

-- Contact information
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS contact_page_url TEXT;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS sales_policy_url TEXT;

-- Shipping & payment policies
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS ships_international BOOLEAN DEFAULT NULL;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS accepts_wire_transfer BOOLEAN DEFAULT NULL;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS accepts_paypal BOOLEAN DEFAULT NULL;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS accepts_credit_card BOOLEAN DEFAULT NULL;

-- Deposit requirements
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS requires_deposit BOOLEAN DEFAULT NULL;
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS deposit_percentage NUMERIC(5,2) DEFAULT NULL;

-- Language support
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS english_support BOOLEAN DEFAULT NULL;

-- Comments for documentation
COMMENT ON COLUMN dealers.contact_email IS 'Primary contact email for inquiries';
COMMENT ON COLUMN dealers.contact_page_url IS 'URL to dealer contact page';
COMMENT ON COLUMN dealers.sales_policy_url IS 'URL to sales/purchasing policy page';
COMMENT ON COLUMN dealers.ships_international IS 'NULL = unknown, true = ships overseas, false = Japan only';
COMMENT ON COLUMN dealers.accepts_wire_transfer IS 'Accepts bank wire transfer payments';
COMMENT ON COLUMN dealers.accepts_paypal IS 'Accepts PayPal payments';
COMMENT ON COLUMN dealers.accepts_credit_card IS 'Accepts credit card payments';
COMMENT ON COLUMN dealers.requires_deposit IS 'Requires deposit before shipping';
COMMENT ON COLUMN dealers.deposit_percentage IS 'Deposit percentage if required (e.g., 30.00 for 30%)';
COMMENT ON COLUMN dealers.english_support IS 'NULL = unknown, true = has English support';

-- -----------------------------------------------------------------------------
-- Part 2: Inquiry History Table (Analytics)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inquiry_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    listing_id INTEGER,
    dealer_id INTEGER NOT NULL,
    intent TEXT NOT NULL CHECK (intent IN ('purchase', 'questions', 'photos', 'shipping', 'other')),
    buyer_country TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_inquiry_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_inquiry_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
    CONSTRAINT fk_inquiry_dealer FOREIGN KEY (dealer_id) REFERENCES dealers(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_inquiry_history_user ON inquiry_history(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_history_dealer ON inquiry_history(dealer_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_history_created ON inquiry_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiry_history_intent ON inquiry_history(intent);

-- Comments
COMMENT ON TABLE inquiry_history IS 'Tracks AI-generated inquiry emails for analytics';
COMMENT ON COLUMN inquiry_history.intent IS 'Inquiry type: purchase, questions, photos, shipping, other';
COMMENT ON COLUMN inquiry_history.buyer_country IS 'Country of the buyer for geographic analytics';

-- -----------------------------------------------------------------------------
-- Part 3: Row Level Security (RLS)
-- -----------------------------------------------------------------------------

ALTER TABLE inquiry_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own inquiry history
CREATE POLICY inquiry_history_select_own ON inquiry_history
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own inquiries
CREATE POLICY inquiry_history_insert_own ON inquiry_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role has full access (for admin analytics)
CREATE POLICY inquiry_history_service_all ON inquiry_history
    FOR ALL
    USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- Part 4: Analytics View
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW inquiry_analytics AS
SELECT
    d.id AS dealer_id,
    d.name AS dealer_name,
    COUNT(ih.id) AS total_inquiries,
    COUNT(DISTINCT ih.user_id) AS unique_users,
    COUNT(CASE WHEN ih.intent = 'purchase' THEN 1 END) AS purchase_intents,
    COUNT(CASE WHEN ih.intent = 'questions' THEN 1 END) AS question_intents,
    COUNT(CASE WHEN ih.intent = 'photos' THEN 1 END) AS photo_requests,
    COUNT(CASE WHEN ih.intent = 'shipping' THEN 1 END) AS shipping_inquiries,
    MIN(ih.created_at) AS first_inquiry,
    MAX(ih.created_at) AS last_inquiry
FROM dealers d
LEFT JOIN inquiry_history ih ON d.id = ih.dealer_id
WHERE d.is_active = true
GROUP BY d.id, d.name
ORDER BY total_inquiries DESC;

COMMENT ON VIEW inquiry_analytics IS 'Aggregated inquiry metrics per dealer for admin dashboard';
