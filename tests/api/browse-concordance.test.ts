/**
 * Browse API Concordance Tests
 *
 * These tests verify that facet counts are mathematically consistent
 * across different filter combinations. They catch bugs where facet
 * counts don't properly reflect the user's filter selections.
 *
 * Key invariants tested:
 * 1. Facet counts for categories should be subsets of 'all' counts
 * 2. nihonto + tosogu facet counts should approximately equal 'all' counts
 * 3. Changing filters must change facet counts (not return stale data)
 * 4. Facet counts should never exceed total count
 * 5. Each facet must be filtered by OTHER active filters
 *
 * Run with: npm test -- browse-concordance
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Types for API response
interface Facet {
  value: string;
  count: number;
}

interface DealerFacet {
  id: number;
  name: string;
  count: number;
}

interface BrowseResponse {
  listings: unknown[];
  total: number;
  page: number;
  totalPages: number;
  facets: {
    itemTypes: Facet[];
    certifications: Facet[];
    dealers: DealerFacet[];
  };
  lastUpdated: string | null;
}

// API base URL - use environment variable or default to production
const API_BASE_URL = process.env.TEST_API_URL || 'https://nihontowatch.com';

// Helper to fetch browse API
async function fetchBrowse(params: Record<string, string> = {}): Promise<BrowseResponse> {
  const searchParams = new URLSearchParams({
    tab: 'available',
    ...params,
    // Add cache buster to ensure fresh data
    _t: Date.now().toString(),
  });

  const response = await fetch(`${API_BASE_URL}/api/browse?${searchParams}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Helper to get facet count by value
function getCertCount(facets: Facet[], certValue: string): number {
  const facet = facets.find(f => f.value === certValue);
  return facet?.count ?? 0;
}

// Helper to sum all facet counts
function sumFacetCounts(facets: Facet[]): number {
  return facets.reduce((sum, f) => sum + f.count, 0);
}

// Helper to sum dealer facet counts
function sumDealerCounts(facets: DealerFacet[]): number {
  return facets.reduce((sum, f) => sum + f.count, 0);
}

// =============================================================================
// CONCORDANCE TEST SUITE
// =============================================================================

describe('Browse API Concordance Tests', () => {
  // Cache responses to avoid hammering the API
  let allResponse: BrowseResponse;
  let nihontoResponse: BrowseResponse;
  let tosoguResponse: BrowseResponse;
  let armorResponse: BrowseResponse;

  beforeAll(async () => {
    // Fetch all four category responses in parallel
    [allResponse, nihontoResponse, tosoguResponse, armorResponse] = await Promise.all([
      fetchBrowse({}),
      fetchBrowse({ cat: 'nihonto' }),
      fetchBrowse({ cat: 'tosogu' }),
      fetchBrowse({ cat: 'armor' }),
    ]);
  }, 30000); // 30 second timeout for API calls

  // ===========================================================================
  // CRITICAL INVARIANT: Category facet counts must differ
  // ===========================================================================

  describe('Critical: Category filter must affect certification facet counts', () => {
    it('nihonto cert counts must differ from all cert counts', () => {
      const allJuyo = getCertCount(allResponse.facets.certifications, 'Juyo');
      const nihontoJuyo = getCertCount(nihontoResponse.facets.certifications, 'Juyo');

      // If these are equal when totals differ, facets aren't being filtered
      if (allResponse.total !== nihontoResponse.total) {
        expect(nihontoJuyo).not.toBe(allJuyo);
      }
    });

    it('tosogu cert counts must differ from all cert counts', () => {
      const allJuyo = getCertCount(allResponse.facets.certifications, 'Juyo');
      const tosoguJuyo = getCertCount(tosoguResponse.facets.certifications, 'Juyo');

      // If these are equal when totals differ, facets aren't being filtered
      if (allResponse.total !== tosoguResponse.total) {
        expect(tosoguJuyo).not.toBe(allJuyo);
      }
    });

    it('nihonto cert counts must differ from tosogu cert counts', () => {
      const nihontoJuyo = getCertCount(nihontoResponse.facets.certifications, 'Juyo');
      const tosoguJuyo = getCertCount(tosoguResponse.facets.certifications, 'Juyo');

      // Nihonto and tosogu should have different cert distributions
      // (unless both are 0, which is valid)
      if (nihontoJuyo > 0 || tosoguJuyo > 0) {
        expect(nihontoJuyo).not.toBe(tosoguJuyo);
      }
    });
  });

  // ===========================================================================
  // INVARIANT: Subset relationship
  // ===========================================================================

  describe('Category facet counts must be subsets of all counts', () => {
    it('nihonto cert counts <= all cert counts for each certification', () => {
      for (const cert of allResponse.facets.certifications) {
        const nihontoCount = getCertCount(nihontoResponse.facets.certifications, cert.value);
        expect(nihontoCount).toBeLessThanOrEqual(cert.count);
      }
    });

    it('tosogu cert counts <= all cert counts for each certification', () => {
      for (const cert of allResponse.facets.certifications) {
        const tosoguCount = getCertCount(tosoguResponse.facets.certifications, cert.value);
        expect(tosoguCount).toBeLessThanOrEqual(cert.count);
      }
    });

    it('nihonto total <= all total', () => {
      expect(nihontoResponse.total).toBeLessThanOrEqual(allResponse.total);
    });

    it('tosogu total <= all total', () => {
      expect(tosoguResponse.total).toBeLessThanOrEqual(allResponse.total);
    });
  });

  // ===========================================================================
  // INVARIANT: Approximate additivity (nihonto + tosogu + armor ≈ all)
  // ===========================================================================

  describe('Category counts should approximately sum to all (with tolerance)', () => {
    // Allow for items that don't fit any category (e.g., unknown, tanegashima)
    const TOLERANCE_PERCENT = 0.15; // 15% tolerance for uncategorized items

    it('nihonto + tosogu + armor totals should approximately equal all total', () => {
      const sumTotals = nihontoResponse.total + tosoguResponse.total + armorResponse.total;
      const allTotal = allResponse.total;

      // Sum should be close to all (within tolerance)
      // Could be less (items in neither category) or slightly more (if categories overlap)
      const lowerBound = allTotal * (1 - TOLERANCE_PERCENT);
      const upperBound = allTotal * (1 + TOLERANCE_PERCENT);

      expect(sumTotals).toBeGreaterThanOrEqual(lowerBound);
      expect(sumTotals).toBeLessThanOrEqual(upperBound);
    });

    it('nihonto + tosogu + armor cert counts should approximately equal all cert counts', () => {
      for (const cert of allResponse.facets.certifications) {
        const nihontoCount = getCertCount(nihontoResponse.facets.certifications, cert.value);
        const tosoguCount = getCertCount(tosoguResponse.facets.certifications, cert.value);
        const armorCount = getCertCount(armorResponse.facets.certifications, cert.value);
        const sumCount = nihontoCount + tosoguCount + armorCount;

        // Allow for tolerance
        const lowerBound = cert.count * (1 - TOLERANCE_PERCENT);
        const upperBound = cert.count * (1 + TOLERANCE_PERCENT);

        expect(sumCount).toBeGreaterThanOrEqual(lowerBound);
        expect(sumCount).toBeLessThanOrEqual(upperBound);
      }
    });
  });

  // ===========================================================================
  // INVARIANT: Facet counts must not exceed total
  // ===========================================================================

  describe('Facet counts must not exceed total count', () => {
    it('no single cert facet count should exceed total for all', () => {
      for (const cert of allResponse.facets.certifications) {
        expect(cert.count).toBeLessThanOrEqual(allResponse.total);
      }
    });

    it('no single cert facet count should exceed total for nihonto', () => {
      for (const cert of nihontoResponse.facets.certifications) {
        expect(cert.count).toBeLessThanOrEqual(nihontoResponse.total);
      }
    });

    it('no single cert facet count should exceed total for tosogu', () => {
      for (const cert of tosoguResponse.facets.certifications) {
        expect(cert.count).toBeLessThanOrEqual(tosoguResponse.total);
      }
    });

    it('no single dealer facet count should exceed total', () => {
      for (const dealer of allResponse.facets.dealers) {
        expect(dealer.count).toBeLessThanOrEqual(allResponse.total);
      }
    });

    it('no single item type facet count should exceed total', () => {
      for (const type of allResponse.facets.itemTypes) {
        expect(type.count).toBeLessThanOrEqual(allResponse.total);
      }
    });
  });

  // ===========================================================================
  // INVARIANT: Dealer facets must also be filtered by category
  // ===========================================================================

  describe('Dealer facets must reflect category filter', () => {
    it('dealer counts for nihonto should differ from all dealer counts', () => {
      // At least some dealers should have different counts
      let differenceFound = false;
      for (const dealer of allResponse.facets.dealers) {
        const nihontoDealer = nihontoResponse.facets.dealers.find(d => d.id === dealer.id);
        if (nihontoDealer && nihontoDealer.count !== dealer.count) {
          differenceFound = true;
          break;
        }
      }
      expect(differenceFound).toBe(true);
    });

    it('dealer counts for tosogu should differ from all dealer counts', () => {
      let differenceFound = false;
      for (const dealer of allResponse.facets.dealers) {
        const tosoguDealer = tosoguResponse.facets.dealers.find(d => d.id === dealer.id);
        if (tosoguDealer && tosoguDealer.count !== dealer.count) {
          differenceFound = true;
          break;
        }
      }
      expect(differenceFound).toBe(true);
    });

    it('nihonto dealer counts <= all dealer counts for each dealer', () => {
      for (const dealer of allResponse.facets.dealers) {
        const nihontoDealer = nihontoResponse.facets.dealers.find(d => d.id === dealer.id);
        const nihontoCount = nihontoDealer?.count ?? 0;
        expect(nihontoCount).toBeLessThanOrEqual(dealer.count);
      }
    });

    it('tosogu dealer counts <= all dealer counts for each dealer', () => {
      for (const dealer of allResponse.facets.dealers) {
        const tosoguDealer = tosoguResponse.facets.dealers.find(d => d.id === dealer.id);
        const tosoguCount = tosoguDealer?.count ?? 0;
        expect(tosoguCount).toBeLessThanOrEqual(dealer.count);
      }
    });
  });

  // ===========================================================================
  // CROSS-FILTER CONCORDANCE
  // ===========================================================================

  describe('Cross-filter concordance', () => {
    it('selecting a cert should reduce total count', async () => {
      // Pick the first certification that exists
      const firstCert = allResponse.facets.certifications[0];
      if (!firstCert) return;

      const certFilteredResponse = await fetchBrowse({ cert: firstCert.value });

      // Total should be reduced compared to all (filtering narrows results)
      expect(certFilteredResponse.total).toBeLessThanOrEqual(allResponse.total);
      // Total should be positive if cert count was positive
      if (firstCert.count > 0) {
        expect(certFilteredResponse.total).toBeGreaterThan(0);
      }
    });

    it('selecting a dealer should reduce total count', async () => {
      const firstDealer = allResponse.facets.dealers[0];
      if (!firstDealer) return;

      const dealerFilteredResponse = await fetchBrowse({ dealer: firstDealer.id.toString() });

      // Total should be reduced compared to all
      expect(dealerFilteredResponse.total).toBeLessThanOrEqual(allResponse.total);
      // Total should be positive if dealer count was positive
      if (firstDealer.count > 0) {
        expect(dealerFilteredResponse.total).toBeGreaterThan(0);
      }
    });

    it('combining category and cert filter should narrow results further', async () => {
      const firstCert = nihontoResponse.facets.certifications[0];
      if (!firstCert) return;

      const combinedResponse = await fetchBrowse({
        cat: 'nihonto',
        cert: firstCert.value,
      });

      // Combined filters should narrow results compared to either alone
      expect(combinedResponse.total).toBeLessThanOrEqual(nihontoResponse.total);
      // Should have some results if cert count was positive
      if (firstCert.count > 0) {
        expect(combinedResponse.total).toBeGreaterThan(0);
      }
    });

    it(
      'facet count should approximately match filtered total (same request)',
      async () => {
        // Make a fresh request and verify internal consistency
        const fresh = await fetchBrowse({});
        const firstCert = fresh.facets.certifications[0];
        if (!firstCert) return;

        // Now filter by that cert in the same timeframe
        const filtered = await fetchBrowse({ cert: firstCert.value });

        // The filtered total should closely match the facet count
        // Allow 20% tolerance for:
        // 1. CDN edge caching may serve slightly stale data
        // 2. Minor timing differences between requests
        // 3. Cert variant expansions (filter may match slightly more variants)
        //
        // NOTE: If this test fails with >50% discrepancy, the facet pagination
        // may have regressed. See src/app/api/browse/route.ts facet functions.
        const tolerance = Math.max(firstCert.count * 0.2, 10);

        // Log for debugging
        if (filtered.total > firstCert.count + tolerance) {
          console.log(
            `Facet mismatch: facet=${firstCert.count}, filtered=${filtered.total}, tolerance=${tolerance}`
          );
        }

        expect(filtered.total).toBeGreaterThanOrEqual(firstCert.count - tolerance);
        expect(filtered.total).toBeLessThanOrEqual(firstCert.count + tolerance);
      },
      15000  // Increased timeout - test makes multiple API calls against production
    );
  });

  // ===========================================================================
  // REGRESSION: Stale data detection
  // ===========================================================================

  describe('Stale data detection', () => {
    it('multiple requests with different categories should return different cert counts', async () => {
      // Make fresh requests (not using cached responses)
      const fresh1 = await fetchBrowse({ cat: 'nihonto' });
      const fresh2 = await fetchBrowse({ cat: 'tosogu' });

      // Get any certification that exists in both
      const commonCert = fresh1.facets.certifications.find(c =>
        fresh2.facets.certifications.some(c2 => c2.value === c.value)
      );

      if (commonCert) {
        const count1 = commonCert.count;
        const count2 = getCertCount(fresh2.facets.certifications, commonCert.value);

        // Should be different (unless both are 0)
        if (count1 > 0 || count2 > 0) {
          expect(count1).not.toBe(count2);
        }
      }
    });

    it('totals must change when category changes', async () => {
      // This is a critical check - if totals are the same, something is wrong
      const allTotal = allResponse.total;
      const nihontoTotal = nihontoResponse.total;
      const tosoguTotal = tosoguResponse.total;

      // At least one category should have different total than all
      const allTotalsSame = nihontoTotal === allTotal && tosoguTotal === allTotal;
      expect(allTotalsSame).toBe(false);
    });
  });

  // ===========================================================================
  // MATHEMATICAL CONSISTENCY
  // ===========================================================================

  describe('Mathematical consistency checks', () => {
    it('all facet counts must be non-negative', () => {
      for (const cert of allResponse.facets.certifications) {
        expect(cert.count).toBeGreaterThanOrEqual(0);
      }
      for (const dealer of allResponse.facets.dealers) {
        expect(dealer.count).toBeGreaterThanOrEqual(0);
      }
      for (const type of allResponse.facets.itemTypes) {
        expect(type.count).toBeGreaterThanOrEqual(0);
      }
    });

    it('total must be non-negative', () => {
      expect(allResponse.total).toBeGreaterThanOrEqual(0);
      expect(nihontoResponse.total).toBeGreaterThanOrEqual(0);
      expect(tosoguResponse.total).toBeGreaterThanOrEqual(0);
    });

    it('sum of item type facets should not exceed total', () => {
      // Item type facets should not exceed total (some items may lack item_type)
      const sumTypes = sumFacetCounts(allResponse.facets.itemTypes);
      const total = allResponse.total;

      // Sum should not exceed total by more than 1% (tolerance for live API timing/data inconsistencies)
      // Note: Some items may have multiple type classifications or data may change between facet/total calc
      expect(sumTypes).toBeLessThanOrEqual(total * 1.01);
      // Should have at least some items with types (at least 30% - many items have unknown type)
      expect(sumTypes).toBeGreaterThanOrEqual(total * 0.3);
    });

    it('nihonto item types should be subset of all item types', () => {
      for (const type of nihontoResponse.facets.itemTypes) {
        const allType = allResponse.facets.itemTypes.find(t => t.value === type.value);
        if (allType) {
          expect(type.count).toBeLessThanOrEqual(allType.count);
        }
      }
    });
  });

  // ===========================================================================
  // SPECIFIC CERTIFICATION CONCORDANCE
  // ===========================================================================

  describe('Specific certification concordance', () => {
    const CERT_TYPES = ['Juyo', 'Tokuju', 'TokuHozon', 'Hozon', 'TokuKicho'];

    for (const certType of CERT_TYPES) {
      it(`${certType} counts: nihonto + tosogu <= all`, () => {
        const allCount = getCertCount(allResponse.facets.certifications, certType);
        const nihontoCount = getCertCount(nihontoResponse.facets.certifications, certType);
        const tosoguCount = getCertCount(tosoguResponse.facets.certifications, certType);

        expect(nihontoCount + tosoguCount).toBeLessThanOrEqual(allCount * 1.05); // 5% tolerance for rounding
      });

      it(`${certType} nihonto count <= all count`, () => {
        const allCount = getCertCount(allResponse.facets.certifications, certType);
        const nihontoCount = getCertCount(nihontoResponse.facets.certifications, certType);

        expect(nihontoCount).toBeLessThanOrEqual(allCount);
      });

      it(`${certType} tosogu count <= all count`, () => {
        const allCount = getCertCount(allResponse.facets.certifications, certType);
        const tosoguCount = getCertCount(tosoguResponse.facets.certifications, certType);

        expect(tosoguCount).toBeLessThanOrEqual(allCount);
      });
    }
  });

  // ===========================================================================
  // SNAPSHOT REGRESSION TESTS
  // ===========================================================================

  describe('Snapshot regression tests', () => {
    it('should have expected response structure', () => {
      expect(allResponse).toHaveProperty('listings');
      expect(allResponse).toHaveProperty('total');
      expect(allResponse).toHaveProperty('page');
      expect(allResponse).toHaveProperty('totalPages');
      expect(allResponse).toHaveProperty('facets');
      expect(allResponse.facets).toHaveProperty('itemTypes');
      expect(allResponse.facets).toHaveProperty('certifications');
      expect(allResponse.facets).toHaveProperty('dealers');
    });

    it('certification facets should have expected structure', () => {
      for (const cert of allResponse.facets.certifications) {
        expect(cert).toHaveProperty('value');
        expect(cert).toHaveProperty('count');
        expect(typeof cert.value).toBe('string');
        expect(typeof cert.count).toBe('number');
      }
    });

    it('dealer facets should have expected structure', () => {
      for (const dealer of allResponse.facets.dealers) {
        expect(dealer).toHaveProperty('id');
        expect(dealer).toHaveProperty('name');
        expect(dealer).toHaveProperty('count');
        expect(typeof dealer.id).toBe('number');
        expect(typeof dealer.name).toBe('string');
        expect(typeof dealer.count).toBe('number');
      }
    });
  });
});

// =============================================================================
// EDGE CASE TESTS
// =============================================================================

describe('Browse API Edge Cases', () => {
  it('empty category should default to all', async () => {
    const response = await fetchBrowse({ cat: '' });
    const allResponse = await fetchBrowse({});

    // Should behave like 'all'
    expect(response.total).toBe(allResponse.total);
  });

  it('invalid category should fallback gracefully', async () => {
    const response = await fetchBrowse({ cat: 'invalid_category' });

    // Should not throw and should return valid response
    expect(response).toHaveProperty('listings');
    expect(response).toHaveProperty('facets');
  });

  it('multiple filters should compound correctly', async () => {
    const allResponse = await fetchBrowse({});

    // Pick first cert and first dealer
    const firstCert = allResponse.facets.certifications[0];
    const firstDealer = allResponse.facets.dealers[0];

    if (firstCert && firstDealer) {
      const combinedResponse = await fetchBrowse({
        cert: firstCert.value,
        dealer: firstDealer.id.toString(),
      });

      // Combined should be less than or equal to either individual filter
      expect(combinedResponse.total).toBeLessThanOrEqual(firstCert.count);
      expect(combinedResponse.total).toBeLessThanOrEqual(firstDealer.count);
    }
  });

  it('askOnly filter should affect facet counts', async () => {
    const allResponse = await fetchBrowse({});
    const askOnlyResponse = await fetchBrowse({ ask: 'true' });

    // Ask only should have fewer or equal items
    expect(askOnlyResponse.total).toBeLessThanOrEqual(allResponse.total);

    // Facet counts should also be reduced
    for (const cert of askOnlyResponse.facets.certifications) {
      const allCert = allResponse.facets.certifications.find(c => c.value === cert.value);
      if (allCert) {
        expect(cert.count).toBeLessThanOrEqual(allCert.count);
      }
    }
  });
});

// =============================================================================
// MINIMUM PRICE FILTER TESTS
// =============================================================================

describe('Minimum price filter', () => {
  const MIN_PRICE_JPY = 100000; // Must match LISTING_FILTERS.MIN_PRICE_JPY in constants.ts

  it('no priced items below minimum should appear in results', async () => {
    const response = await fetchBrowse({});

    // Check all listings for low prices
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lowPriceItems = response.listings.filter((listing: any) => {
      // ASK listings (null price_value) are allowed
      if (listing.price_value === null) return false;

      // Items with price_jpy should be >= minimum
      if (listing.price_jpy !== null && listing.price_jpy < MIN_PRICE_JPY) {
        return true;
      }

      return false;
    });

    // No low-price items should slip through the filter
    expect(lowPriceItems.length).toBe(0);
  });

  it('ASK listings (no price) should still appear', async () => {
    const response = await fetchBrowse({ ask: 'true' });

    // If there are ASK items in the system, they should appear
    if (response.total > 0) {
      // All items should have null price_value
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allAsk = response.listings.every((listing: any) => listing.price_value === null);
      expect(allAsk).toBe(true);
    }
  });

  it('items with price_value but missing price_jpy should not appear if low-priced', async () => {
    // This test catches the data quality issue where price_jpy wasn't populated
    // The filter now checks price_value IS NULL for ASK detection, not price_jpy
    const response = await fetchBrowse({});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badItems = response.listings.filter((listing: any) => {
      // If item has a price_value but it's below the minimum (in any currency),
      // and price_jpy is null, it shouldn't have slipped through
      if (listing.price_value !== null && listing.price_jpy === null) {
        // This is a data quality issue - item has price but no normalized JPY
        // For JPY items, this should never happen after the backfill
        if (listing.price_currency === 'JPY' && listing.price_value < MIN_PRICE_JPY) {
          return true;
        }
      }
      return false;
    });

    expect(badItems.length).toBe(0);
  });
});

// =============================================================================
// PERFORMANCE SAFEGUARD TESTS
// =============================================================================

describe('Performance safeguards', () => {
  it('API response time should be reasonable', async () => {
    const start = Date.now();
    await fetchBrowse({});
    const duration = Date.now() - start;

    // Should respond within 5 seconds
    expect(duration).toBeLessThan(5000);
  });

  it('facet arrays should have reasonable size', async () => {
    const response = await fetchBrowse({});

    // Certifications should be limited (we only have ~5 types)
    expect(response.facets.certifications.length).toBeLessThan(20);

    // Item types should be limited
    expect(response.facets.itemTypes.length).toBeLessThan(50);

    // Dealers should be limited (we have ~27)
    expect(response.facets.dealers.length).toBeLessThan(50);
  });
});
