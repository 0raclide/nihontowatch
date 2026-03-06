-- Migration 101: Dealer Profile Settings
-- Adds columns for dealer branding, contact info, location, policies, and credentials.
-- All nullable — progressive completion (dealers fill in what they can).

ALTER TABLE dealers
  -- Visual identity
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#c4a35a',

  -- Story / about
  ADD COLUMN IF NOT EXISTS bio_en TEXT,
  ADD COLUMN IF NOT EXISTS bio_ja TEXT,
  ADD COLUMN IF NOT EXISTS founded_year INTEGER CHECK (founded_year >= 1600 AND founded_year <= 2100),
  ADD COLUMN IF NOT EXISTS shop_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS specializations TEXT[] DEFAULT '{}',

  -- Contact
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS line_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,

  -- Location
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_visible BOOLEAN DEFAULT false,

  -- Credentials & policies
  ADD COLUMN IF NOT EXISTS memberships TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS return_policy TEXT;
