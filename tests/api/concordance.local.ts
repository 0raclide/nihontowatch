import { describe, it, expect } from 'vitest';

// Use environment variable for API base URL, defaulting to production
// This allows tests to run in CI against production or locally against dev server
const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

interface BrowseResponse {
  listings: Array<{
    id: string;
    item_type: string | null;
    cert_type: string | null;
    dealer_id: number;
  }>;
  total: number;
  facets: {
    itemTypes: Array<{ value: string; count: number }>;
    certifications: Array<{ value: string; count: number }>;
    dealers: Array<{ id: number; name: string; count: number }>;
  };
}

/**
 * TWO-WAY CONCORDANCE TESTS
 *
 * These tests verify that:
 * 1. Facet counts match actual filtered results
 * 2. Total count matches sum of relevant facets
 *
 * If these tests fail, it indicates a mismatch between:
 * - What the facets report as counts
 * - What the API actually returns when filtering
 */
describe('Two-Way Concordance: Facets vs Results', () => {
  describe('Certification Facet Concordance', () => {
    const certifications = ['Juyo', 'TokuHozon', 'Hozon', 'Tokuju', 'TokuKicho'];

    certifications.forEach(cert => {
      it(`should have matching count for certification: ${cert}`, async () => {
        // Get unfiltered results with facets
        const unfilteredRes = await fetch(`${API_BASE}/api/browse?tab=available`);
        const unfilteredData: BrowseResponse = await unfilteredRes.json();

        // Find facet count for this certification
        const facet = unfilteredData.facets.certifications.find(f => f.value === cert);
        const facetCount = facet?.count || 0;

        if (facetCount === 0) {
          // Skip if no items with this certification
          return;
        }

        // Get filtered results for this certification
        const filteredRes = await fetch(`${API_BASE}/api/browse?tab=available&cert=${cert}&limit=100`);
        const filteredData: BrowseResponse = await filteredRes.json();

        // The facet count should match the total from filtered results
        expect(filteredData.total).toBe(facetCount);

        // Also verify all returned items have the correct certification
        filteredData.listings.forEach(listing => {
          expect(listing.cert_type).toBe(cert);
        });
      });
    });
  });

  describe('Item Type Facet Concordance', () => {
    const itemTypes = [
      'katana', 'wakizashi', 'tanto', 'tachi',
      'tsuba', 'kozuka', 'menuki', 'fuchi-kashira', 'koshirae',
      'yari', 'naginata'
    ];

    itemTypes.forEach(type => {
      it(`should have matching count for item type: ${type}`, async () => {
        // Get unfiltered results with facets
        const unfilteredRes = await fetch(`${API_BASE}/api/browse?tab=available`);
        const unfilteredData: BrowseResponse = await unfilteredRes.json();

        // Find facet count for this type (case-insensitive search)
        const facet = unfilteredData.facets.itemTypes.find(
          f => f.value.toLowerCase() === type.toLowerCase()
        );
        const facetCount = facet?.count || 0;

        if (facetCount === 0) {
          // Skip if no items with this type
          return;
        }

        // Get filtered results for this type
        const filteredRes = await fetch(`${API_BASE}/api/browse?tab=available&type=${type}&limit=100`);
        const filteredData: BrowseResponse = await filteredRes.json();

        // The facet count should match the total from filtered results
        expect(filteredData.total).toBe(facetCount);

        // Also verify all returned items have the correct type
        filteredData.listings.forEach(listing => {
          expect(listing.item_type?.toLowerCase()).toBe(type.toLowerCase());
        });
      });
    });
  });

  describe('Dealer Facet Concordance', () => {
    it('should have matching counts for all dealers', async () => {
      // Get unfiltered results with facets
      const unfilteredRes = await fetch(`${API_BASE}/api/browse?tab=available`);
      const unfilteredData: BrowseResponse = await unfilteredRes.json();

      // Test top 5 dealers
      const topDealers = unfilteredData.facets.dealers.slice(0, 5);

      for (const dealer of topDealers) {
        const filteredRes = await fetch(`${API_BASE}/api/browse?tab=available&dealer=${dealer.id}&limit=100`);
        const filteredData: BrowseResponse = await filteredRes.json();

        // The facet count should match the total from filtered results
        expect(filteredData.total).toBe(dealer.count);

        // Also verify all returned items have the correct dealer
        filteredData.listings.forEach(listing => {
          expect(listing.dealer_id).toBe(dealer.id);
        });
      }
    });
  });

  describe('Cross-Tab Concordance', () => {
    it('should have consistent facets between available and sold tabs', async () => {
      const availableRes = await fetch(`${API_BASE}/api/browse?tab=available`);
      const soldRes = await fetch(`${API_BASE}/api/browse?tab=sold`);

      const availableData: BrowseResponse = await availableRes.json();
      const soldData: BrowseResponse = await soldRes.json();

      // Facets should be present for both tabs
      expect(availableData.facets.itemTypes.length).toBeGreaterThan(0);
      expect(availableData.facets.certifications.length).toBeGreaterThan(0);
      expect(availableData.facets.dealers.length).toBeGreaterThan(0);

      expect(soldData.facets.itemTypes.length).toBeGreaterThan(0);
      expect(soldData.facets.dealers.length).toBeGreaterThan(0);
    });
  });

  describe('Total Count Concordance', () => {
    it('should have total equal to sum of dealer facets', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available`);
      const data: BrowseResponse = await res.json();

      const sumOfDealerCounts = data.facets.dealers.reduce((sum, d) => sum + d.count, 0);

      // Total should equal sum of all dealer counts
      expect(data.total).toBe(sumOfDealerCounts);
    });
  });

  describe('Case Sensitivity Concordance', () => {
    it('should handle case variants in item types', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available`);
      const data: BrowseResponse = await res.json();

      // Check for case variants (e.g., "Katana" vs "katana")
      const katanaVariants = data.facets.itemTypes.filter(
        f => f.value.toLowerCase() === 'katana'
      );
      const tachiVariants = data.facets.itemTypes.filter(
        f => f.value.toLowerCase() === 'tachi'
      );

      // Log variants for debugging
      if (katanaVariants.length > 1) {
        console.log('Katana variants found:', katanaVariants);
      }
      if (tachiVariants.length > 1) {
        console.log('Tachi variants found:', tachiVariants);
      }

      // Sum of all case variants should equal filtered total
      if (katanaVariants.length > 0) {
        const totalKatana = katanaVariants.reduce((sum, v) => sum + v.count, 0);

        // Get all katana (would need case-insensitive filter)
        const filteredRes = await fetch(`${API_BASE}/api/browse?tab=available&type=katana&limit=100`);
        const filteredData: BrowseResponse = await filteredRes.json();

        // Note: This may fail if API doesn't handle case-insensitive filtering
        // The total from case-insensitive filter should match sum of variants
        console.log(`Katana: facet sum=${totalKatana}, filtered total=${filteredData.total}`);
      }
    });
  });

  describe('Specific Issue: Tokuju Count', () => {
    it('should have accurate Tokuju certification count', async () => {
      // This test specifically addresses the reported issue:
      // Facets show 2 Tokuju, but results show 3

      // Step 1: Get facet count
      const unfilteredRes = await fetch(`${API_BASE}/api/browse?tab=available`);
      const unfilteredData: BrowseResponse = await unfilteredRes.json();

      const tokujuFacet = unfilteredData.facets.certifications.find(f => f.value === 'Tokuju');
      const facetCount = tokujuFacet?.count || 0;
      console.log(`Tokuju facet count: ${facetCount}`);

      // Step 2: Get filtered results
      const filteredRes = await fetch(`${API_BASE}/api/browse?tab=available&cert=Tokuju`);
      const filteredData: BrowseResponse = await filteredRes.json();
      console.log(`Tokuju filtered total: ${filteredData.total}`);
      console.log(`Tokuju filtered listings count: ${filteredData.listings.length}`);

      // Step 3: Verify each listing actually has Tokuju certification
      const actualTokuju = filteredData.listings.filter(l => l.cert_type === 'Tokuju');
      console.log(`Listings with cert_type='Tokuju': ${actualTokuju.length}`);

      // Log any mismatches
      const nonTokuju = filteredData.listings.filter(l => l.cert_type !== 'Tokuju');
      if (nonTokuju.length > 0) {
        console.log('Non-Tokuju listings returned:', nonTokuju.map(l => ({
          id: l.id,
          cert_type: l.cert_type
        })));
      }

      // The key assertion: facet count should match actual filtered results
      expect(filteredData.total).toBe(facetCount);
      expect(actualTokuju.length).toBe(facetCount);
    });
  });
});

describe('Facet Accuracy Tests', () => {
  it('should not have duplicate facet entries', async () => {
    const res = await fetch(`${API_BASE}/api/browse?tab=available`);
    const data: BrowseResponse = await res.json();

    // Check for duplicate item types
    const itemTypeValues = data.facets.itemTypes.map(f => f.value);
    const uniqueItemTypes = new Set(itemTypeValues);
    expect(itemTypeValues.length).toBe(uniqueItemTypes.size);

    // Check for duplicate certifications
    const certValues = data.facets.certifications.map(f => f.value);
    const uniqueCerts = new Set(certValues);
    expect(certValues.length).toBe(uniqueCerts.size);

    // Check for duplicate dealers
    const dealerIds = data.facets.dealers.map(f => f.id);
    const uniqueDealers = new Set(dealerIds);
    expect(dealerIds.length).toBe(uniqueDealers.size);
  });

  it('should not have null or empty facet values', async () => {
    const res = await fetch(`${API_BASE}/api/browse?tab=available`);
    const data: BrowseResponse = await res.json();

    // No null/empty item types
    data.facets.itemTypes.forEach(f => {
      expect(f.value).toBeTruthy();
      expect(f.value).not.toBe('null');
      expect(f.count).toBeGreaterThan(0);
    });

    // No null/empty certifications
    data.facets.certifications.forEach(f => {
      expect(f.value).toBeTruthy();
      expect(f.value).not.toBe('null');
      expect(f.count).toBeGreaterThan(0);
    });

    // No null/empty dealers
    data.facets.dealers.forEach(f => {
      expect(f.id).toBeTruthy();
      expect(f.name).toBeTruthy();
      expect(f.count).toBeGreaterThan(0);
    });
  });
});
