-- Migration: Secondary Bulk Import Detection
--
-- Problem: When an expanded crawler discovers old inventory from an established
-- dealer, the 24h-window trigger marks them as genuine new inventory because
-- their first_seen_at is months after the dealer's baseline. Users then see
-- hundreds of "New this week" items that aren't actually new — they're old
-- stock the scraper hadn't indexed before.
--
-- Solution (three layers):
-- (a) Enhance trigger to respect explicit is_initial_import=TRUE from callers
--     (allows scraper or admin to override auto-detection at insert time)
-- (b) detect_bulk_import_spikes() — read-only function to find suspicious surges
-- (c) flag_dealer_bulk_import() — retroactively mark a dealer's recent listings
--
-- Regression guard: The only change to the existing trigger is an early-return
-- when is_initial_import is already TRUE. Since the column default is FALSE
-- (migration 055), TRUE can only arrive from explicit intent. All existing
-- auto-computation logic is untouched.

------------------------------------------------------------------------
-- (a) Enhanced trigger: respect explicit is_initial_import = TRUE
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_is_initial_import()
RETURNS TRIGGER AS $$
DECLARE
  dealer_baseline TIMESTAMPTZ;
BEGIN
  -- If the caller explicitly set is_initial_import = TRUE, respect it.
  -- The column DEFAULT is FALSE (migration 055), so TRUE can only come
  -- from deliberate intent by the scraper or an admin bulk-flag operation.
  -- This is the "scraper override" path for known bulk discoveries.
  IF NEW.is_initial_import = TRUE THEN
    RETURN NEW;
  END IF;

  -- Original auto-detection logic (unchanged) -------------------------
  SELECT earliest_listing_at INTO dealer_baseline
  FROM dealers
  WHERE id = NEW.dealer_id;

  -- If no baseline yet, this IS the initial import
  -- (The dealer trigger will set baseline after this insert)
  IF dealer_baseline IS NULL THEN
    NEW.is_initial_import := TRUE;
  ELSE
    -- Within 24h of baseline = initial import
    NEW.is_initial_import := (NEW.first_seen_at <= dealer_baseline + INTERVAL '24 hours');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The trigger itself (trigger_set_is_initial_import) does NOT need
-- to be recreated — it already calls set_is_initial_import() and PostgreSQL
-- resolves the function reference at execution time, not creation time.

------------------------------------------------------------------------
-- (b) detect_bulk_import_spikes() — read-only spike detection
------------------------------------------------------------------------

-- Returns established dealers with suspiciously high recent insert volume.
-- Use this to find bulk discoveries that slipped past the 24h trigger window.
--
-- Usage:
--   SELECT * FROM detect_bulk_import_spikes();              -- defaults
--   SELECT * FROM detect_bulk_import_spikes(10, 48);        -- custom
--   SELECT * FROM detect_bulk_import_spikes(p_lookback_hours => 72);

CREATE OR REPLACE FUNCTION detect_bulk_import_spikes(
  p_threshold INT DEFAULT 15,
  p_lookback_hours INT DEFAULT 24
) RETURNS TABLE(
  dealer_id INT,
  dealer_name TEXT,
  unflagged_count BIGINT,
  earliest_insert TIMESTAMPTZ,
  latest_insert TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.name::TEXT,
    COUNT(*)::BIGINT,
    MIN(l.first_seen_at),
    MAX(l.first_seen_at)
  FROM listings l
  JOIN dealers d ON d.id = l.dealer_id
  WHERE l.is_initial_import = FALSE
    AND l.first_seen_at > NOW() - make_interval(hours => p_lookback_hours)
    -- Only flag established dealers (7+ days in system).
    -- New dealers are already handled by isDealerEstablished() in the UI.
    AND d.earliest_listing_at < NOW() - INTERVAL '7 days'
  GROUP BY d.id, d.name
  HAVING COUNT(*) >= p_threshold
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

------------------------------------------------------------------------
-- (c) flag_dealer_bulk_import() — retroactive flagging
------------------------------------------------------------------------

-- Marks a dealer's recent listings as bulk imports (is_initial_import=TRUE).
-- Returns the number of rows updated.
--
-- Safety: Only flags listings where is_initial_import is currently FALSE.
-- Won't touch already-flagged listings. The dealer must be established
-- (7+ days in system) to prevent accidentally burying a new dealer's
-- genuine first inventory.
--
-- Usage:
--   SELECT flag_dealer_bulk_import(42);                     -- last 24h
--   SELECT flag_dealer_bulk_import(42, '2026-02-10'::timestamptz);
--   SELECT flag_dealer_bulk_import(42, NOW() - INTERVAL '3 days');

CREATE OR REPLACE FUNCTION flag_dealer_bulk_import(
  p_dealer_id INT,
  p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
) RETURNS INT AS $$
DECLARE
  affected INT;
  dealer_baseline TIMESTAMPTZ;
BEGIN
  -- Safety check: only flag established dealers
  SELECT earliest_listing_at INTO dealer_baseline
  FROM dealers
  WHERE id = p_dealer_id;

  IF dealer_baseline IS NULL THEN
    RAISE EXCEPTION 'Dealer % has no baseline — cannot flag as bulk import', p_dealer_id;
  END IF;

  IF dealer_baseline > NOW() - INTERVAL '7 days' THEN
    RAISE EXCEPTION 'Dealer % is not established (baseline %). Wait until 7 days after first listing.', p_dealer_id, dealer_baseline;
  END IF;

  UPDATE listings
  SET is_initial_import = TRUE
  WHERE dealer_id = p_dealer_id
    AND first_seen_at >= p_since
    AND is_initial_import = FALSE;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql;
