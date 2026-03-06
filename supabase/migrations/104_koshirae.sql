-- Add koshirae (拵 — mountings) JSONB column to listings
-- Schema: { cert_type, cert_in_blade_paper, description, images, components }
ALTER TABLE listings ADD COLUMN IF NOT EXISTS koshirae JSONB DEFAULT NULL;
