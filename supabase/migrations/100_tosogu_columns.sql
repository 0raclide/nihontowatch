-- Add tosogu measurement columns (referenced in schema docs but never migrated)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS height_cm REAL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS width_cm REAL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS material TEXT;
