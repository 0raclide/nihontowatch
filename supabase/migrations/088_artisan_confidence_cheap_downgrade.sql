-- Migration: Downgrade artisan confidence for cheap elite-matched items
-- Artisan matcher misattributes elite artisans to cheap items (e.g., Horikawa Kunihiro on ¥6,600 tsuba).
-- 148 rows affected at time of execution. Fix: downgrade artisan_confidence to NONE for items with
-- price_jpy < 100000 and artisan_elite_factor > 0.05.
-- Existing display code already hides NONE confidence.
-- NOTE: Backfill already executed against production DB on 2026-02-24. This migration is idempotent.

UPDATE listings
SET artisan_confidence = 'NONE'
WHERE price_jpy < 100000
  AND artisan_elite_factor > 0.05
  AND artisan_id IS NOT NULL
  AND artisan_id != 'UNKNOWN'
  AND artisan_id != 'unknown'
  AND artisan_confidence != 'NONE';
