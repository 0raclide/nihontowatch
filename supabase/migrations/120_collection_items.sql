-- =============================================================================
-- 120: Create collection_items table
-- =============================================================================
-- Personal collection items. Mirrors listings shared item-data fields exactly.
-- Collection-only columns: visibility, source_listing_id, personal_notes, etc.
-- Column types match listings precisely (see migration 099 for REAL types).

CREATE TABLE collection_items (
  -- Identity
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_uuid       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Visibility
  visibility      TEXT NOT NULL DEFAULT 'private',  -- private | unlisted | public

  -- Link back to browse listing (for "I Own This" imports)
  source_listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,

  -- Personal notes (not shared with listings schema)
  personal_notes  TEXT,

  -- === Shared item-data fields (mirror listings exactly) ===

  -- Classification
  item_type       TEXT,
  item_category   TEXT,
  title           TEXT,
  description     TEXT,

  -- Status & price
  status          TEXT DEFAULT 'available',
  is_available    BOOLEAN DEFAULT true,
  is_sold         BOOLEAN DEFAULT false,
  price_value     NUMERIC,
  price_currency  TEXT,

  -- Sword specifications
  nagasa_cm       NUMERIC,
  sori_cm         NUMERIC,
  motohaba_cm     NUMERIC,
  sakihaba_cm     NUMERIC,
  kasane_cm       NUMERIC,
  weight_g        NUMERIC,
  nakago_cm       NUMERIC,

  -- Tosogu specifications
  tosogu_maker    TEXT,
  tosogu_school   TEXT,
  material        TEXT,
  height_cm       REAL,     -- matches migration 099
  width_cm        REAL,     -- matches migration 099
  thickness_mm    NUMERIC,

  -- Attribution (swords)
  smith           TEXT,
  school          TEXT,
  province        TEXT,
  era             TEXT,
  mei_type        TEXT,
  mei_text        TEXT,
  mei_guaranteed  BOOLEAN,
  nakago_type     TEXT,     -- matches migration 099

  -- Certification
  cert_type       TEXT,
  cert_session    TEXT,     -- TEXT in DB (not INTEGER)
  cert_organization TEXT,

  -- Media
  images          JSONB DEFAULT '[]'::jsonb,
  stored_images   JSONB,

  -- Artisan matching
  artisan_id      TEXT,
  artisan_confidence TEXT,

  -- JSONB section data (same structure as listings)
  sayagaki        JSONB,
  hakogaki        JSONB,
  koshirae        JSONB,
  provenance      JSONB,
  kiwame          JSONB,
  kanto_hibisho   JSONB,

  -- Research notes (AI curator note context)
  research_notes  TEXT,

  -- Setsumei (NBTHK certification translations)
  setsumei_text_en TEXT,
  setsumei_text_ja TEXT,

  -- Translation cache
  title_en        TEXT,
  title_ja        TEXT,
  description_en  TEXT,
  description_ja  TEXT,

  -- AI curator notes
  ai_curator_note_en TEXT,
  ai_curator_note_ja TEXT,

  -- Smart crop focal point
  focal_x         REAL,
  focal_y         REAL,

  -- Hero image selection
  hero_image_index INTEGER,

  -- Video count (denormalized, updated by item_videos trigger)
  video_count     INTEGER DEFAULT 0,

  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_ci_owner_id    ON collection_items(owner_id);
CREATE INDEX idx_ci_item_uuid   ON collection_items(item_uuid);
CREATE INDEX idx_ci_visibility  ON collection_items(visibility);
CREATE INDEX idx_ci_item_type   ON collection_items(item_type);
CREATE INDEX idx_ci_source      ON collection_items(source_listing_id) WHERE source_listing_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Updated_at trigger (reuse existing function from migration 057)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_ci_updated
  BEFORE UPDATE ON collection_items
  FOR EACH ROW EXECUTE FUNCTION public.update_collection_updated_at();
