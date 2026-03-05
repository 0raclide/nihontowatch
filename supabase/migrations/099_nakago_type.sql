-- Add nakago_type column for tang condition (separate from mei_type signature)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS nakago_type TEXT;
