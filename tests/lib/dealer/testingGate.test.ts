import { describe, it, expect, vi, afterEach } from 'vitest';

// =============================================================================
// Testing Gate — Golden Tests
//
// The testing gate hides dealer listings from public browse until the feature
// flag NEXT_PUBLIC_DEALER_LISTINGS_LIVE is set to 'true'.
// Three insertion points: browse API, getListingDetail, featured scores cron.
// =============================================================================

describe('testing gate — getListingDetail', () => {
  // Replicate the gate logic from getListingDetail
  function shouldShowListing(source: string | null, flagValue: string | undefined): boolean {
    if (source === 'dealer' && flagValue !== 'true') {
      return false; // hidden
    }
    return true;
  }

  it('GOLDEN: hides dealer listing when flag is off', () => {
    expect(shouldShowListing('dealer', undefined)).toBe(false);
  });

  it('GOLDEN: hides dealer listing when flag is "false"', () => {
    expect(shouldShowListing('dealer', 'false')).toBe(false);
  });

  it('GOLDEN: shows dealer listing when flag is "true"', () => {
    expect(shouldShowListing('dealer', 'true')).toBe(true);
  });

  it('shows scraper listing regardless of flag', () => {
    expect(shouldShowListing('scraper', undefined)).toBe(true);
    expect(shouldShowListing('scraper', 'true')).toBe(true);
  });

  it('shows listing with null source regardless of flag', () => {
    expect(shouldShowListing(null, undefined)).toBe(true);
  });

  it('flag check is case-sensitive (only lowercase "true" opens gate)', () => {
    expect(shouldShowListing('dealer', 'TRUE')).toBe(false);
    expect(shouldShowListing('dealer', 'True')).toBe(false);
    expect(shouldShowListing('dealer', '1')).toBe(false);
  });
});

describe('testing gate — browse API filter', () => {
  // Replicate the browse API's dealer listing filter logic
  function buildDealerFilter(flagValue: string | undefined): { column: string; op: string; value: string } | null {
    if (flagValue !== 'true') {
      return { column: 'source', op: 'neq', value: 'dealer' };
    }
    return null; // no filter needed when flag is on
  }

  it('GOLDEN: adds .neq("source","dealer") filter when flag is off', () => {
    const filter = buildDealerFilter(undefined);
    expect(filter).toEqual({ column: 'source', op: 'neq', value: 'dealer' });
  });

  it('GOLDEN: no filter when flag is "true"', () => {
    const filter = buildDealerFilter('true');
    expect(filter).toBeNull();
  });

  it('adds filter when flag is empty string', () => {
    const filter = buildDealerFilter('');
    expect(filter).toEqual({ column: 'source', op: 'neq', value: 'dealer' });
  });
});

describe('testing gate — featured scores cron', () => {
  // Replicate the cron's dealer listing exclusion logic
  function shouldIncludeInScoring(source: string | null, flagValue: string | undefined): boolean {
    if (source === 'dealer' && flagValue !== 'true') {
      return false;
    }
    return true;
  }

  it('excludes dealer listings from scoring when flag is off', () => {
    expect(shouldIncludeInScoring('dealer', undefined)).toBe(false);
  });

  it('includes dealer listings in scoring when flag is on', () => {
    expect(shouldIncludeInScoring('dealer', 'true')).toBe(true);
  });

  it('includes scraper listings regardless of flag', () => {
    expect(shouldIncludeInScoring('scraper', undefined)).toBe(true);
    expect(shouldIncludeInScoring('scraper', 'true')).toBe(true);
  });
});

// =============================================================================
// Phase 3 go-live simulation
// =============================================================================

describe('Phase 3 go-live — all gates open simultaneously', () => {
  it('GOLDEN: all three gates open when flag is "true"', () => {
    const flag = 'true';

    // Browse API
    const browseFilter = flag !== 'true'
      ? { column: 'source', op: 'neq', value: 'dealer' }
      : null;
    expect(browseFilter).toBeNull();

    // getListingDetail
    const detailVisible = !(flag !== 'true');
    expect(detailVisible).toBe(true);

    // Featured scores cron
    const cronIncludes = !(flag !== 'true');
    expect(cronIncludes).toBe(true);
  });

  it('GOLDEN: all three gates closed when flag is undefined', () => {
    const flag = undefined;

    const browseFilter = flag !== 'true'
      ? { column: 'source', op: 'neq', value: 'dealer' }
      : null;
    expect(browseFilter).not.toBeNull();

    const detailVisible = !(flag !== 'true');
    expect(detailVisible).toBe(false);

    const cronIncludes = !(flag !== 'true');
    expect(cronIncludes).toBe(false);
  });
});
