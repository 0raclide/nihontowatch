-- Market price observations table
-- Denormalized feature table for price model training.
-- Populated from scraped listings + manual entries (auction results, private sales, etc.)
--
-- Each row = one price observation with all model features pre-joined.

CREATE TABLE market_price_observations (
  id              BIGSERIAL PRIMARY KEY,

  -- Source tracking
  source          TEXT NOT NULL DEFAULT 'scraped',  -- scraped | manual | auction | private_sale
  listing_id      INTEGER REFERENCES listings(id) ON DELETE SET NULL,  -- NULL for manual entries
  listing_url     TEXT,                             -- For reference / dedup

  -- Price (always stored in original currency + converted JPY)
  price_value     NUMERIC NOT NULL,
  price_currency  TEXT NOT NULL DEFAULT 'JPY',
  price_jpy       NUMERIC NOT NULL,                 -- Pre-converted for model use

  -- Observation date
  observed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),  -- When the price was observed/recorded
  sold_at         TIMESTAMPTZ,                         -- When actually sold (if known)

  -- Status at time of observation
  was_sold        BOOLEAN NOT NULL DEFAULT false,   -- true = sold price, false = asking price

  -- Item classification
  item_type       TEXT,                             -- katana, wakizashi, tanto, tsuba, etc.
  item_category   TEXT,                             -- blade, tosogu, koshirae, other

  -- Certification (the ladder)
  cert_type       TEXT,                             -- Hozon, Tokubetsu Hozon, Juyo, etc.
  cert_ordinal    SMALLINT,                         -- 0=none, 3=Hozon, 4=TokuHozon, 5=Juyo, 6=Tokuju

  -- Artisan identification
  artisan_id      TEXT,                             -- Yuhinkai maker_id or school_id (e.g., MAS590, NS-Goto)
  artisan_name    TEXT,                             -- Display name for reference

  -- Artisan rating features (pre-joined from Yuhinkai)
  elite_factor    REAL,                             -- Designation-based Bayesian shrinkage (0–1.88)
  toko_taikan     INTEGER,                          -- Toko Taikan rating (450–3500)
  hawley          INTEGER,                          -- Hawley rating (50–400)
  fujishiro       TEXT,                             -- Fujishiro grade text
  fujishiro_ord   SMALLINT,                         -- 1=chu, 2=chujo, 3=jo, 4=jojo, 5=saijo

  -- Physical attributes (may affect price)
  nagasa_cm       REAL,
  condition_notes TEXT,                             -- Free text for private observations

  -- Dealer context
  dealer_id       INTEGER,
  dealer_name     TEXT,
  dealer_country  TEXT,                             -- JP, US, UK, etc.

  -- Metadata
  notes           TEXT,                             -- Free text: provenance, auction house, context
  added_by        TEXT,                             -- Who entered this observation
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for model queries
CREATE INDEX idx_mpo_item_category ON market_price_observations(item_category);
CREATE INDEX idx_mpo_cert_ordinal ON market_price_observations(cert_ordinal);
CREATE INDEX idx_mpo_artisan_id ON market_price_observations(artisan_id);
CREATE INDEX idx_mpo_source ON market_price_observations(source);
CREATE INDEX idx_mpo_listing_id ON market_price_observations(listing_id) WHERE listing_id IS NOT NULL;

-- Prevent duplicate scraped entries for the same listing
CREATE UNIQUE INDEX idx_mpo_listing_dedup ON market_price_observations(listing_id) WHERE source = 'scraped' AND listing_id IS NOT NULL;

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_mpo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mpo_updated_at
  BEFORE UPDATE ON market_price_observations
  FOR EACH ROW EXECUTE FUNCTION update_mpo_updated_at();

COMMENT ON TABLE market_price_observations IS 'Denormalized price observations for market price model. Sources: scraped listings, manual entries, auction results, private sales.';
COMMENT ON COLUMN market_price_observations.cert_ordinal IS '0=none/reg, 1=kicho, 2=tokukicho, 3=hozon, 4=tokuhozon, 5=juyo, 6=tokuju';
COMMENT ON COLUMN market_price_observations.fujishiro_ord IS '1=chu, 2=chujo, 3=jo, 4=jojo, 5=saijo';
COMMENT ON COLUMN market_price_observations.price_jpy IS 'Price converted to JPY at time of observation. Used directly by model.';
