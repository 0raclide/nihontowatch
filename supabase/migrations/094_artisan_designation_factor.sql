-- Migration 094: Add artisan_designation_factor to listings
--
-- Stores the designation_factor from Yuhinkai's artisan_makers/artisan_schools.
-- Used by scoring module for artisan stature calculation:
--   artisan_stature = min(designation_factor × 119, 200)
--
-- Replaces elite_factor as the primary stature driver. Elite columns kept
-- for backward compatibility and secondary reference.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS artisan_designation_factor NUMERIC;
