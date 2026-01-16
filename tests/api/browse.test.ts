import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:3020';

describe('Browse API', () => {
  // Wait for server to be ready
  beforeAll(async () => {
    // Give the server a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Basic Endpoint', () => {
    it('should return listings for available tab', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('listings');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('facets');
      expect(Array.isArray(data.listings)).toBe(true);
    });

    it('should return listings for sold tab', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=sold`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('listings');
      expect(data.listings.every((l: { is_sold: boolean; status: string }) =>
        l.is_sold === true || l.status === 'sold' || l.status === 'presumed_sold'
      )).toBe(true);
    });
  });

  describe('Item Type Filters', () => {
    const itemTypes = [
      'katana',
      'wakizashi',
      'tanto',
      'tachi',
      'tsuba',
      'kozuka',
      'menuki',
      'fuchi-kashira',
      'koshirae',
      'yari',
      'naginata',
    ];

    itemTypes.forEach(type => {
      it(`should filter by item_type: ${type}`, async () => {
        const res = await fetch(`${API_BASE}/api/browse?tab=available&type=${type}`);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toHaveProperty('listings');

        // All returned items should match the type (case-insensitive)
        if (data.listings.length > 0) {
          data.listings.forEach((listing: { item_type: string | null }) => {
            expect(listing.item_type?.toLowerCase()).toBe(type.toLowerCase());
          });
        }
      });
    });

    it('should handle multiple item types', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available&type=katana,wakizashi`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('listings');

      if (data.listings.length > 0) {
        data.listings.forEach((listing: { item_type: string | null }) => {
          expect(['katana', 'wakizashi']).toContain(listing.item_type?.toLowerCase());
        });
      }
    });
  });

  describe('Certification Filters', () => {
    const certifications = [
      'Juyo',
      'TokuHozon',
      'Hozon',
      'Tokuju',
    ];

    certifications.forEach(cert => {
      it(`should filter by certification: ${cert}`, async () => {
        const res = await fetch(`${API_BASE}/api/browse?tab=available&cert=${cert}`);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toHaveProperty('listings');

        if (data.listings.length > 0) {
          data.listings.forEach((listing: { cert_type: string | null }) => {
            expect(listing.cert_type).toBe(cert);
          });
        }
      });
    });
  });

  describe('Price Filters', () => {
    it('should filter by minimum price', async () => {
      const minPrice = 1000000;
      const res = await fetch(`${API_BASE}/api/browse?tab=available&minPrice=${minPrice}`);
      const data = await res.json();

      expect(res.status).toBe(200);

      if (data.listings.length > 0) {
        data.listings.forEach((listing: { price_value: number | null }) => {
          if (listing.price_value !== null) {
            expect(listing.price_value).toBeGreaterThanOrEqual(minPrice);
          }
        });
      }
    });

    it('should filter by maximum price', async () => {
      const maxPrice = 500000;
      const res = await fetch(`${API_BASE}/api/browse?tab=available&maxPrice=${maxPrice}`);
      const data = await res.json();

      expect(res.status).toBe(200);

      if (data.listings.length > 0) {
        data.listings.forEach((listing: { price_value: number | null }) => {
          if (listing.price_value !== null) {
            expect(listing.price_value).toBeLessThanOrEqual(maxPrice);
          }
        });
      }
    });

    it('should filter by price range', async () => {
      const minPrice = 500000;
      const maxPrice = 2000000;
      const res = await fetch(`${API_BASE}/api/browse?tab=available&minPrice=${minPrice}&maxPrice=${maxPrice}`);
      const data = await res.json();

      expect(res.status).toBe(200);

      if (data.listings.length > 0) {
        data.listings.forEach((listing: { price_value: number | null }) => {
          if (listing.price_value !== null) {
            expect(listing.price_value).toBeGreaterThanOrEqual(minPrice);
            expect(listing.price_value).toBeLessThanOrEqual(maxPrice);
          }
        });
      }
    });
  });

  describe('Dealer Filters', () => {
    it('should filter by dealer_id', async () => {
      const dealerId = 1; // Aoi Art
      const res = await fetch(`${API_BASE}/api/browse?tab=available&dealer=${dealerId}`);
      const data = await res.json();

      expect(res.status).toBe(200);

      if (data.listings.length > 0) {
        data.listings.forEach((listing: { dealer_id: number }) => {
          expect(listing.dealer_id).toBe(dealerId);
        });
      }
    });

    it('should filter by multiple dealers', async () => {
      const dealerIds = [1, 4]; // Aoi Art, Eirakudo
      const res = await fetch(`${API_BASE}/api/browse?tab=available&dealer=${dealerIds.join(',')}`);
      const data = await res.json();

      expect(res.status).toBe(200);

      if (data.listings.length > 0) {
        data.listings.forEach((listing: { dealer_id: number }) => {
          expect(dealerIds).toContain(listing.dealer_id);
        });
      }
    });
  });

  describe('Text Search', () => {
    it('should search by smith name', async () => {
      const query = 'Masamune';
      const res = await fetch(`${API_BASE}/api/browse?tab=available&q=${query}`);
      const data = await res.json();

      expect(res.status).toBe(200);
      // Results should contain the query in title, smith, or tosogu_maker
    });

    it('should search by title', async () => {
      const query = 'katana';
      const res = await fetch(`${API_BASE}/api/browse?tab=available&q=${query}`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('listings');
    });
  });

  describe('Sorting', () => {
    it('should sort by price ascending', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available&sort=price_asc`);
      const data = await res.json();

      expect(res.status).toBe(200);

      const prices = data.listings
        .map((l: { price_value: number | null }) => l.price_value)
        .filter((p: number | null): p is number => p !== null);

      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    it('should sort by price descending', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available&sort=price_desc`);
      const data = await res.json();

      expect(res.status).toBe(200);

      const prices = data.listings
        .map((l: { price_value: number | null }) => l.price_value)
        .filter((p: number | null): p is number => p !== null);

      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }
    });

    it('should sort by name', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available&sort=name`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('listings');
    });

    it('should sort by recent (default)', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available`);
      const data = await res.json();

      expect(res.status).toBe(200);

      const dates = data.listings.map((l: { first_seen_at: string }) => new Date(l.first_seen_at).getTime());

      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });
  });

  describe('Pagination', () => {
    it('should return paginated results', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available&page=1&limit=10`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.listings.length).toBeLessThanOrEqual(10);
      expect(data.page).toBe(1);
      expect(data.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('should return different results for different pages', async () => {
      const res1 = await fetch(`${API_BASE}/api/browse?tab=available&page=1&limit=10`);
      const res2 = await fetch(`${API_BASE}/api/browse?tab=available&page=2&limit=10`);

      const data1 = await res1.json();
      const data2 = await res2.json();

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      if (data1.totalPages > 1) {
        const ids1 = data1.listings.map((l: { id: string }) => l.id);
        const ids2 = data2.listings.map((l: { id: string }) => l.id);

        // Pages should have different items
        const overlap = ids1.filter((id: string) => ids2.includes(id));
        expect(overlap.length).toBe(0);
      }
    });
  });

  describe('Facets', () => {
    it('should return item type facets', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.facets).toHaveProperty('itemTypes');
      expect(Array.isArray(data.facets.itemTypes)).toBe(true);

      if (data.facets.itemTypes.length > 0) {
        expect(data.facets.itemTypes[0]).toHaveProperty('value');
        expect(data.facets.itemTypes[0]).toHaveProperty('count');
      }
    });

    it('should return certification facets', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.facets).toHaveProperty('certifications');
      expect(Array.isArray(data.facets.certifications)).toBe(true);
    });

    it('should return dealer facets', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.facets).toHaveProperty('dealers');
      expect(Array.isArray(data.facets.dealers)).toBe(true);

      if (data.facets.dealers.length > 0) {
        expect(data.facets.dealers[0]).toHaveProperty('id');
        expect(data.facets.dealers[0]).toHaveProperty('name');
        expect(data.facets.dealers[0]).toHaveProperty('count');
      }
    });
  });

  describe('Combined Filters', () => {
    it('should combine multiple filters correctly', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available&type=katana&cert=Juyo&minPrice=1000000`);
      const data = await res.json();

      expect(res.status).toBe(200);

      if (data.listings.length > 0) {
        data.listings.forEach((listing: { item_type: string | null; cert_type: string | null; price_value: number | null }) => {
          expect(listing.item_type?.toLowerCase()).toBe('katana');
          expect(listing.cert_type).toBe('Juyo');
          if (listing.price_value !== null) {
            expect(listing.price_value).toBeGreaterThanOrEqual(1000000);
          }
        });
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results gracefully', async () => {
      // Use an impossible combination
      const res = await fetch(`${API_BASE}/api/browse?tab=available&type=nonexistent_type`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.listings).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('should handle invalid page numbers', async () => {
      // Page numbers are clamped to max 1000
      const res = await fetch(`${API_BASE}/api/browse?tab=available&page=9999`);
      const data = await res.json();

      expect(res.status).toBe(200);
      // Page is clamped to max 1000, so we get a valid response
      expect(data.page).toBeLessThanOrEqual(1000);
    });

    it('should limit results to max 100', async () => {
      const res = await fetch(`${API_BASE}/api/browse?tab=available&limit=500`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.listings.length).toBeLessThanOrEqual(100);
    });
  });
});
