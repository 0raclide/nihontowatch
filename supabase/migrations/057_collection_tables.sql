-- =============================================================================
-- 057: Collection Manager Tables
-- =============================================================================
-- Personal collection cataloging for authenticated users.
-- Reuses item_type/cert_type/artisan vocabulary from listings.

-- ---------------------------------------------------------------------------
-- 0. Drop old collection tables (different schema from Dec 2025 prototype)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.user_collection_items CASCADE;
DROP TABLE IF EXISTS public.user_collection_folders CASCADE;

-- ---------------------------------------------------------------------------
-- 1. user_collection_items
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_collection_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Link to browse listing (nullable - only for "I own this" imports)
  source_listing_id INTEGER REFERENCES public.listings(id) ON DELETE SET NULL,

  -- Classification
  item_type       TEXT,          -- katana, tsuba, etc.
  title           TEXT,          -- User's custom title

  -- Artisan
  artisan_id            TEXT,    -- Yuhinkai smith/tosogu code (MAS590)
  artisan_display_name  TEXT,    -- Cached display name

  -- Certification
  cert_type         TEXT,        -- Juyo, Hozon, Tokubetsu Juyo, etc.
  cert_session      INTEGER,
  cert_organization TEXT,

  -- Attribution
  smith     TEXT,                -- Swordsmith or tosogu maker name
  school    TEXT,
  province  TEXT,
  era       TEXT,
  mei_type  TEXT,

  -- Measurements (sword)
  nagasa_cm   NUMERIC,
  sori_cm     NUMERIC,
  motohaba_cm NUMERIC,
  sakihaba_cm NUMERIC,

  -- Provenance & value
  price_paid            NUMERIC,
  price_paid_currency   TEXT,    -- JPY, USD, EUR
  current_value         NUMERIC,
  current_value_currency TEXT,
  acquired_date         DATE,
  acquired_from         TEXT,    -- Free text (dealer name, auction, etc.)

  -- Status & condition
  condition TEXT DEFAULT 'good', -- mint/excellent/good/fair/project
  status    TEXT DEFAULT 'owned', -- owned/sold/lent/consignment
  notes     TEXT,

  -- Media
  images    JSONB DEFAULT '[]'::jsonb,  -- Supabase Storage paths

  -- Yuhinkai catalog reference
  catalog_reference JSONB,       -- {collection, volume, item_number, object_uuid}

  -- Visibility
  is_public BOOLEAN DEFAULT false,

  -- Organization (folder support reserved for Phase 2)
  folder_id  UUID,
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. user_collection_folders (schema only, UI deferred)
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_collection_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Add FK after both tables exist
ALTER TABLE public.user_collection_items
  ADD CONSTRAINT fk_collection_folder
  FOREIGN KEY (folder_id) REFERENCES public.user_collection_folders(id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_collection_items_user      ON public.user_collection_items (user_id);
CREATE INDEX idx_collection_items_type      ON public.user_collection_items (item_type);
CREATE INDEX idx_collection_items_cert      ON public.user_collection_items (cert_type);
CREATE INDEX idx_collection_items_status    ON public.user_collection_items (status);
CREATE INDEX idx_collection_items_condition ON public.user_collection_items (condition);
CREATE INDEX idx_collection_items_source    ON public.user_collection_items (source_listing_id);
CREATE INDEX idx_collection_items_artisan   ON public.user_collection_items (artisan_id);
CREATE INDEX idx_collection_folders_user    ON public.user_collection_folders (user_id);

-- ---------------------------------------------------------------------------
-- 4. RLS Policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_collection_folders ENABLE ROW LEVEL SECURITY;

-- Items: owner full access
CREATE POLICY "collection_items_owner_select"
  ON public.user_collection_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "collection_items_owner_insert"
  ON public.user_collection_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collection_items_owner_update"
  ON public.user_collection_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "collection_items_owner_delete"
  ON public.user_collection_items FOR DELETE
  USING (auth.uid() = user_id);

-- Items: public items readable by anyone
CREATE POLICY "collection_items_public_read"
  ON public.user_collection_items FOR SELECT
  USING (is_public = true);

-- Items: service role bypass (for admin)
CREATE POLICY "collection_items_service_role"
  ON public.user_collection_items FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Folders: owner full access
CREATE POLICY "collection_folders_owner_select"
  ON public.user_collection_folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "collection_folders_owner_insert"
  ON public.user_collection_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collection_folders_owner_update"
  ON public.user_collection_folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "collection_folders_owner_delete"
  ON public.user_collection_folders FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_collection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_collection_items_updated
  BEFORE UPDATE ON public.user_collection_items
  FOR EACH ROW EXECUTE FUNCTION public.update_collection_updated_at();

CREATE TRIGGER trg_collection_folders_updated
  BEFORE UPDATE ON public.user_collection_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_collection_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Storage bucket for collection images
-- ---------------------------------------------------------------------------
-- NOTE: Storage bucket creation must be done via Supabase dashboard or CLI:
--   supabase storage create collection-images --public
-- RLS on storage: users can only write to their own {user_id}/ prefix.
-- Max 5MB per file, accepted: JPEG/PNG/WebP
