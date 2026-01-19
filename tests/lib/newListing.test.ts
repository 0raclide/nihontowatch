import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isNewListing, daysSince, getNewListingLabel, isPartOfInitialImport, shouldShowNewBadge, isDealerEstablished } from '@/lib/newListing';
import { NEW_LISTING } from '@/lib/constants';

describe('daysSince', () => {
  beforeEach(() => {
    // Mock Date.now() to a fixed point in time for consistent tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('valid date inputs', () => {
    it('returns 0 for today', () => {
      const result = daysSince('2026-01-15T12:00:00Z');
      expect(result).toBe(0);
    });

    it('returns ~1 for yesterday', () => {
      const result = daysSince('2026-01-14T12:00:00Z');
      expect(result).toBeCloseTo(1, 1);
    });

    it('returns ~7 for a week ago', () => {
      const result = daysSince('2026-01-08T12:00:00Z');
      expect(result).toBeCloseTo(7, 1);
    });

    it('returns ~14 for two weeks ago', () => {
      const result = daysSince('2026-01-01T12:00:00Z');
      expect(result).toBeCloseTo(14, 1);
    });

    it('returns ~30 for a month ago', () => {
      const result = daysSince('2025-12-16T12:00:00Z');
      expect(result).toBeCloseTo(30, 1);
    });

    it('handles partial days correctly', () => {
      // 12 hours ago should be 0.5 days
      const result = daysSince('2026-01-15T00:00:00Z');
      expect(result).toBeCloseTo(0.5, 1);
    });
  });

  describe('invalid/null inputs', () => {
    it('returns Infinity for null', () => {
      expect(daysSince(null)).toBe(Infinity);
    });

    it('returns Infinity for undefined', () => {
      expect(daysSince(undefined)).toBe(Infinity);
    });

    it('returns Infinity for empty string', () => {
      expect(daysSince('')).toBe(Infinity);
    });

    it('returns Infinity for invalid date string', () => {
      expect(daysSince('not-a-date')).toBe(Infinity);
    });

    it('returns Infinity for malformed ISO string', () => {
      expect(daysSince('2026-99-99')).toBe(Infinity);
    });
  });
});

describe('isNewListing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('with default threshold (7 days)', () => {
    it('returns true for listing discovered today', () => {
      expect(isNewListing('2026-01-15T10:00:00Z')).toBe(true);
    });

    it('returns true for listing discovered yesterday', () => {
      expect(isNewListing('2026-01-14T12:00:00Z')).toBe(true);
    });

    it('returns true for listing discovered exactly at threshold (7 days)', () => {
      expect(isNewListing('2026-01-08T12:00:00Z')).toBe(true);
    });

    it('returns false for listing discovered 8 days ago', () => {
      expect(isNewListing('2026-01-07T12:00:00Z')).toBe(false);
    });

    it('returns false for listing discovered 14 days ago', () => {
      expect(isNewListing('2026-01-01T12:00:00Z')).toBe(false);
    });

    it('returns false for listing discovered a year ago', () => {
      expect(isNewListing('2025-01-15T12:00:00Z')).toBe(false);
    });
  });

  describe('with custom threshold', () => {
    it('returns true within 3-day threshold', () => {
      expect(isNewListing('2026-01-13T12:00:00Z', 3)).toBe(true);
    });

    it('returns false outside 3-day threshold', () => {
      expect(isNewListing('2026-01-11T12:00:00Z', 3)).toBe(false);
    });

    it('returns true within 14-day threshold', () => {
      expect(isNewListing('2026-01-02T12:00:00Z', 14)).toBe(true);
    });

    it('handles 1-day threshold correctly', () => {
      // Just under 1 day
      expect(isNewListing('2026-01-14T13:00:00Z', 1)).toBe(true);
      // Just over 1 day
      expect(isNewListing('2026-01-14T11:00:00Z', 1)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for null date', () => {
      expect(isNewListing(null)).toBe(false);
    });

    it('returns false for undefined date', () => {
      expect(isNewListing(undefined)).toBe(false);
    });

    it('returns false for invalid date string', () => {
      expect(isNewListing('invalid-date')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isNewListing('')).toBe(false);
    });
  });

  describe('timezone handling', () => {
    it('correctly handles UTC dates', () => {
      expect(isNewListing('2026-01-10T00:00:00Z')).toBe(true);
    });

    it('correctly handles dates with timezone offset', () => {
      // This is equivalent to a time within threshold
      expect(isNewListing('2026-01-10T00:00:00+09:00')).toBe(true);
    });
  });
});

describe('getNewListingLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('returns correct labels for new listings', () => {
    it('returns "Today" for listings discovered today', () => {
      expect(getNewListingLabel('2026-01-15T10:00:00Z')).toBe('Today');
    });

    it('returns "1d ago" for listings discovered yesterday', () => {
      // About 1.5 days ago (should round to "1d ago" since it's between 1-2 days)
      expect(getNewListingLabel('2026-01-14T00:00:00Z')).toBe('1d ago');
    });

    it('returns "5d ago" for listings discovered 5 days ago', () => {
      expect(getNewListingLabel('2026-01-10T12:00:00Z')).toBe('5d ago');
    });

    it('returns "7d ago" for listings at threshold boundary', () => {
      expect(getNewListingLabel('2026-01-08T12:00:00Z')).toBe('7d ago');
    });
  });

  describe('returns null for old listings', () => {
    it('returns null for listings older than threshold', () => {
      expect(getNewListingLabel('2026-01-07T12:00:00Z')).toBeNull();
    });

    it('returns null for listings from a month ago', () => {
      expect(getNewListingLabel('2025-12-15T12:00:00Z')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null for null date', () => {
      expect(getNewListingLabel(null)).toBeNull();
    });

    it('returns null for undefined date', () => {
      expect(getNewListingLabel(undefined)).toBeNull();
    });

    it('returns null for invalid date', () => {
      expect(getNewListingLabel('not-a-date')).toBeNull();
    });
  });
});

describe('integration with constants', () => {
  it('uses the correct threshold from constants', () => {
    // Verify the constant exists and has expected value
    expect(NEW_LISTING.THRESHOLD_DAYS).toBe(7);
    expect(NEW_LISTING.INITIAL_IMPORT_WINDOW_HOURS).toBe(24);
  });

  it('isNewListing uses constants threshold by default', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

    // 7 days ago should be included (at threshold)
    const atThreshold = isNewListing('2026-01-08T12:00:00Z');
    expect(atThreshold).toBe(true);

    // 8 days ago should be excluded (over threshold)
    const overThreshold = isNewListing('2026-01-07T12:00:00Z');
    expect(overThreshold).toBe(false);

    vi.useRealTimers();
  });
});

describe('isPartOfInitialImport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('within initial import window', () => {
    it('returns true when listing is at the baseline', () => {
      const baseline = '2026-01-01T12:00:00Z';
      const listing = '2026-01-01T12:00:00Z';
      expect(isPartOfInitialImport(listing, baseline)).toBe(true);
    });

    it('returns true when listing is 1 hour after baseline', () => {
      const baseline = '2026-01-01T12:00:00Z';
      const listing = '2026-01-01T13:00:00Z';
      expect(isPartOfInitialImport(listing, baseline)).toBe(true);
    });

    it('returns true when listing is 23 hours after baseline', () => {
      const baseline = '2026-01-01T12:00:00Z';
      const listing = '2026-01-02T11:00:00Z';
      expect(isPartOfInitialImport(listing, baseline)).toBe(true);
    });

    it('returns true when listing is exactly 24 hours after baseline', () => {
      const baseline = '2026-01-01T12:00:00Z';
      const listing = '2026-01-02T12:00:00Z';
      expect(isPartOfInitialImport(listing, baseline)).toBe(true);
    });
  });

  describe('outside initial import window', () => {
    it('returns false when listing is 25 hours after baseline', () => {
      const baseline = '2026-01-01T12:00:00Z';
      const listing = '2026-01-02T13:00:00Z';
      expect(isPartOfInitialImport(listing, baseline)).toBe(false);
    });

    it('returns false when listing is 2 days after baseline', () => {
      const baseline = '2026-01-01T12:00:00Z';
      const listing = '2026-01-03T12:00:00Z';
      expect(isPartOfInitialImport(listing, baseline)).toBe(false);
    });

    it('returns false when listing is a week after baseline', () => {
      const baseline = '2026-01-01T12:00:00Z';
      const listing = '2026-01-08T12:00:00Z';
      expect(isPartOfInitialImport(listing, baseline)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns true for null listing date', () => {
      const baseline = '2026-01-01T12:00:00Z';
      expect(isPartOfInitialImport(null, baseline)).toBe(true);
    });

    it('returns true for null baseline', () => {
      const listing = '2026-01-01T12:00:00Z';
      expect(isPartOfInitialImport(listing, null)).toBe(true);
    });

    it('returns true for both null', () => {
      expect(isPartOfInitialImport(null, null)).toBe(true);
    });

    it('returns true for invalid dates', () => {
      expect(isPartOfInitialImport('invalid', '2026-01-01T12:00:00Z')).toBe(true);
      expect(isPartOfInitialImport('2026-01-01T12:00:00Z', 'invalid')).toBe(true);
    });
  });

  describe('custom window', () => {
    it('respects custom 48-hour window', () => {
      const baseline = '2026-01-01T12:00:00Z';
      // 30 hours later - would be outside 24h but inside 48h
      const listing = '2026-01-02T18:00:00Z';
      expect(isPartOfInitialImport(listing, baseline, 48)).toBe(true);
    });

    it('respects custom 1-hour window', () => {
      const baseline = '2026-01-01T12:00:00Z';
      // 2 hours later - outside 1h window
      const listing = '2026-01-01T14:00:00Z';
      expect(isPartOfInitialImport(listing, baseline, 1)).toBe(false);
    });
  });
});

describe('isDealerEstablished', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('established dealers (7+ days)', () => {
    it('returns true for dealer with baseline 7 days ago', () => {
      const baseline = '2026-01-08T12:00:00Z'; // Exactly 7 days ago
      expect(isDealerEstablished(baseline)).toBe(true);
    });

    it('returns true for dealer with baseline 14 days ago', () => {
      const baseline = '2026-01-01T12:00:00Z'; // 14 days ago
      expect(isDealerEstablished(baseline)).toBe(true);
    });

    it('returns true for dealer with baseline 30 days ago', () => {
      const baseline = '2025-12-16T12:00:00Z'; // 30 days ago
      expect(isDealerEstablished(baseline)).toBe(true);
    });

    it('returns true for dealer with baseline months ago', () => {
      const baseline = '2025-06-01T12:00:00Z'; // ~7 months ago
      expect(isDealerEstablished(baseline)).toBe(true);
    });
  });

  describe('new dealers (not established)', () => {
    it('returns false for dealer with baseline 1 day ago', () => {
      const baseline = '2026-01-14T12:00:00Z'; // 1 day ago
      expect(isDealerEstablished(baseline)).toBe(false);
    });

    it('returns false for dealer with baseline 3 days ago', () => {
      const baseline = '2026-01-12T12:00:00Z'; // 3 days ago
      expect(isDealerEstablished(baseline)).toBe(false);
    });

    it('returns false for dealer with baseline 6 days ago', () => {
      const baseline = '2026-01-09T12:00:00Z'; // 6 days ago
      expect(isDealerEstablished(baseline)).toBe(false);
    });

    it('returns false for dealer onboarded today', () => {
      const baseline = '2026-01-15T10:00:00Z'; // Today
      expect(isDealerEstablished(baseline)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for null baseline', () => {
      expect(isDealerEstablished(null)).toBe(false);
    });

    it('returns false for undefined baseline', () => {
      expect(isDealerEstablished(undefined)).toBe(false);
    });

    it('returns false for invalid date string', () => {
      expect(isDealerEstablished('not-a-date')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isDealerEstablished('')).toBe(false);
    });
  });

  describe('custom threshold', () => {
    it('respects custom 14-day threshold', () => {
      const baseline = '2026-01-08T12:00:00Z'; // 7 days ago
      expect(isDealerEstablished(baseline, 14)).toBe(false); // Not 14 days yet
    });

    it('respects custom 3-day threshold', () => {
      const baseline = '2026-01-12T12:00:00Z'; // 3 days ago
      expect(isDealerEstablished(baseline, 3)).toBe(true); // Meets 3-day threshold
    });
  });
});

describe('shouldShowNewBadge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('genuinely new listings (after initial import)', () => {
    // Baseline: Jan 1st. Listing: Jan 10th (9 days after baseline, 5 days ago)
    const baseline = '2026-01-01T12:00:00Z';

    it('shows badge for listing discovered after initial import and within 7 days', () => {
      const listing = '2026-01-10T12:00:00Z'; // 5 days ago, well after baseline
      expect(shouldShowNewBadge(listing, baseline)).toBe(true);
    });

    it('shows badge for listing discovered yesterday', () => {
      const listing = '2026-01-14T12:00:00Z'; // 1 day ago
      expect(shouldShowNewBadge(listing, baseline)).toBe(true);
    });

    it('shows badge for listing discovered today', () => {
      const listing = '2026-01-15T10:00:00Z'; // Today
      expect(shouldShowNewBadge(listing, baseline)).toBe(true);
    });

    it('hides badge for listing older than 7 days (even if after baseline)', () => {
      const listing = '2026-01-05T12:00:00Z'; // 10 days ago, after baseline but too old
      expect(shouldShowNewBadge(listing, baseline)).toBe(false);
    });
  });

  describe('initial import listings (should not show badge)', () => {
    const baseline = '2026-01-01T12:00:00Z';

    it('hides badge for listing at baseline', () => {
      const listing = '2026-01-01T12:00:00Z';
      expect(shouldShowNewBadge(listing, baseline)).toBe(false);
    });

    it('hides badge for listing 12 hours after baseline', () => {
      const listing = '2026-01-02T00:00:00Z'; // 12 hours after baseline
      expect(shouldShowNewBadge(listing, baseline)).toBe(false);
    });

    it('hides badge for listing exactly 24 hours after baseline', () => {
      const listing = '2026-01-02T12:00:00Z'; // Exactly 24h after baseline
      expect(shouldShowNewBadge(listing, baseline)).toBe(false);
    });
  });

  describe('newly onboarded dealer (recent baseline - NOT established)', () => {
    // Dealer was just added 3 days ago - NOT established yet
    const recentBaseline = '2026-01-12T12:00:00Z';

    it('hides badge for all listings from newly onboarded dealer (not established)', () => {
      // Listing from same day as baseline
      expect(shouldShowNewBadge('2026-01-12T14:00:00Z', recentBaseline)).toBe(false);
    });

    it('hides badge even for listings after 24h window (dealer not established)', () => {
      // Listing 2 days after the recent baseline (outside 24h window)
      // But dealer is only 3 days old, not 7+ days, so NO badge
      const listing = '2026-01-14T14:00:00Z';
      expect(shouldShowNewBadge(listing, recentBaseline)).toBe(false);
    });

    it('hides badge for all new listings until dealer is established', () => {
      // Even a listing from today won't show badge because dealer is too new
      const listing = '2026-01-15T10:00:00Z';
      expect(shouldShowNewBadge(listing, recentBaseline)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('hides badge when dealer baseline is null', () => {
      const newListing = '2026-01-13T12:00:00Z';
      expect(shouldShowNewBadge(newListing, null)).toBe(false);
    });

    it('hides badge when listing date is null', () => {
      const baseline = '2025-10-01T12:00:00Z';
      expect(shouldShowNewBadge(null, baseline)).toBe(false);
    });

    it('hides badge when both dates are null', () => {
      expect(shouldShowNewBadge(null, null)).toBe(false);
    });

    it('hides badge when listing date is undefined', () => {
      const baseline = '2025-10-01T12:00:00Z';
      expect(shouldShowNewBadge(undefined, baseline)).toBe(false);
    });
  });

  describe('real-world scenarios', () => {
    it('scenario: established dealer adds new inventory', () => {
      // Dealer has been in our system for months (established)
      const baseline = '2025-10-01T12:00:00Z';
      // New sword added 2 days ago
      const newSword = '2026-01-13T09:00:00Z';
      expect(shouldShowNewBadge(newSword, baseline)).toBe(true);
    });

    it('scenario: new dealer just onboarded with existing inventory', () => {
      // Dealer added yesterday (NOT established), we scraped all their existing items
      const baseline = '2026-01-14T10:00:00Z';
      // All their items have first_seen_at within the import window
      const existingItem = '2026-01-14T14:00:00Z';
      // No badge: dealer not established (only 1 day old)
      expect(shouldShowNewBadge(existingItem, baseline)).toBe(false);
    });

    it('scenario: new dealer gets fresh inventory after onboarding (dealer not established yet)', () => {
      // Dealer added 3 days ago (NOT established - needs 7+ days)
      const baseline = '2026-01-12T10:00:00Z';
      // They just got new inventory today (outside 24h window)
      const freshItem = '2026-01-15T08:00:00Z';
      // No badge: dealer is only 3 days old, not established yet
      expect(shouldShowNewBadge(freshItem, baseline)).toBe(false);
    });

    it('scenario: established dealer gets fresh inventory', () => {
      // Dealer added 10 days ago (established)
      const baseline = '2026-01-05T10:00:00Z';
      // They just got new inventory today (outside 24h window)
      const freshItem = '2026-01-15T08:00:00Z';
      // Shows badge: dealer is established AND listing is new AND outside import window
      expect(shouldShowNewBadge(freshItem, baseline)).toBe(true);
    });

    it('scenario: URL reuse detected (item changed)', () => {
      // When change detection finds a new item at an old URL,
      // the first_seen_at is reset to the discovery time
      const baseline = '2025-06-01T12:00:00Z'; // Dealer established long ago
      const resetDate = '2026-01-14T08:00:00Z';
      expect(shouldShowNewBadge(resetDate, baseline)).toBe(true);
    });

    it('scenario: World Seiyudo bug - new dealer flooding badges', () => {
      // This was the actual bug: World Seiyudo had baseline 3 days ago
      // and ALL their listings after 24h were showing badges
      const worldSeiyudoBaseline = '2026-01-12T12:00:00Z'; // 3 days ago
      const listing = '2026-01-14T10:00:00Z'; // 1 day ago, outside 24h window

      // Old (buggy) behavior would have returned true
      // New (correct) behavior returns false - dealer not established
      expect(shouldShowNewBadge(listing, worldSeiyudoBaseline)).toBe(false);
    });

    it('scenario: Aoi Art (established) adds new listing', () => {
      // Aoi Art has been in system for weeks (established)
      const aoiArtBaseline = '2025-12-31T12:00:00Z'; // ~15 days ago
      const newListing = '2026-01-14T10:00:00Z'; // 1 day ago

      // Shows badge: dealer is established + listing is new + outside import window
      expect(shouldShowNewBadge(newListing, aoiArtBaseline)).toBe(true);
    });
  });
});

describe('real-world timestamp formats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles typical Supabase timestamp format', () => {
    // Supabase returns timestamps like: 2026-01-10T14:30:00.000000+00:00
    const supabaseTimestamp = '2026-01-10T14:30:00.000000+00:00';
    expect(isNewListing(supabaseTimestamp)).toBe(true);
    expect(getNewListingLabel(supabaseTimestamp)).toBe('4d ago');
  });

  it('handles ISO string without timezone', () => {
    const isoNoTz = '2026-01-12T10:00:00';
    expect(isNewListing(isoNoTz)).toBe(true);
  });

  it('handles date-only string', () => {
    const dateOnly = '2026-01-10';
    expect(isNewListing(dateOnly)).toBe(true);
  });
});
