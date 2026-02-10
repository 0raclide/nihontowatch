-- Migration: Change is_initial_import default from TRUE to FALSE
--
-- Problem: The BEFORE INSERT trigger (set_is_initial_import) can fail silently
-- during high-volume batch inserts, causing the column DEFAULT to be used instead.
-- With DEFAULT TRUE, failed triggers make genuine new inventory appear as bulk imports,
-- burying them in the "Newest" sort.
--
-- Fix: Change default to FALSE so trigger failures are fail-safe:
-- - If trigger works → correct value set (no change)
-- - If trigger fails → listing appears as "new" (visible, not buried)
--
-- Data fix: 2,609 Choshuya listings corrected from TRUE → FALSE (2026-02-10)

-- Change the column default
ALTER TABLE listings ALTER COLUMN is_initial_import SET DEFAULT FALSE;
