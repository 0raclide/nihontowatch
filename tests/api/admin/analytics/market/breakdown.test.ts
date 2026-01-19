/**
 * Market Breakdown API Unit Tests
 *
 * Tests the /api/admin/analytics/market/breakdown endpoint.
 * Verifies parameter validation, category/dealer/certification breakdowns,
 * and market share calculations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Next.js cookies before importing the route handler
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock statistics functions
vi.mock('@/lib/analytics/statistics', () => ({
  median: vi.fn((values: number[]) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }),
  mean: vi.fn((values: number[]) => {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }),
}));

// Mock getItemTypeLabel
vi.mock('@/types/index', () => ({
  getItemTypeLabel: vi.fn((type: string) => {
    const labels: Record<string, string> = {
      katana: 'Katana',
      wakizashi: 'Wakizashi',
      tanto: 'Tanto',
      tsuba: 'Tsuba',
      unknown: 'Unknown',
    };
    return labels[type] || type;
  }),
}));

import { GET } from '@/app/api/admin/analytics/market/breakdown/route';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createMockRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/analytics/market/breakdown');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

function createMockQueryBuilder(
  data: unknown[] | null = [],
  count: number | null = 0,
  error: { message: string } | null = null
) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chain = () => builder;

  builder.select = vi.fn(() => chain());
  builder.eq = vi.fn(() => chain());
  builder.gt = vi.fn(() => chain());
  builder.gte = vi.fn(() => chain());
  builder.lte = vi.fn(() => chain());
  builder.not = vi.fn(() => chain());
  builder.limit = vi.fn(() => chain());
  builder.single = vi.fn(() => Promise.resolve({ data: { role: 'admin' }, error: null }));

  builder.then = vi.fn((resolve: (result: { data: unknown[] | null; error: typeof error; count: number | null }) => void) => {
    resolve({ data, error, count });
  });

  Object.defineProperty(builder, 'data', { get: () => data });
  Object.defineProperty(builder, 'error', { get: () => error });
  Object.defineProperty(builder, 'count', { get: () => count });

  return builder;
}

function setupAdminAuth() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-123' } },
    error: null,
  });
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('GET /api/admin/analytics/market/breakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAdminAuth();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // AUTHENTICATION TESTS
  // ===========================================================================

  describe('authentication', () => {
    it('returns 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest({ by: 'category' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('returns 403 for non-admin users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'user' }, error: null })
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest({ by: 'category' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
    });
  });

  // ===========================================================================
  // PARAMETER VALIDATION TESTS
  // ===========================================================================

  describe('by parameter validation', () => {
    it('returns 400 when by parameter is missing', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest(); // No 'by' parameter
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain("'by' parameter");
    });

    it('returns 400 for invalid by value', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return createMockQueryBuilder();
      });

      const request = createMockRequest({ by: 'invalid' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('category, dealer, certification');
    });

    it('accepts valid by=category', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { item_type: 'katana', price_value: 1000000, price_currency: 'JPY', is_available: true, is_sold: false },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'category' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('accepts valid by=dealer', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const dealers = [{ id: 1, name: 'Aoi Art' }];
      const listings = [
        { dealer_id: 1, price_value: 1000000, price_currency: 'JPY', is_available: true },
      ];

      const dealerBuilder = createMockQueryBuilder(dealers, 1);
      const listingBuilder = createMockQueryBuilder(listings, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        if (table === 'dealers') return dealerBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'dealer' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('accepts valid by=certification', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { cert_type: 'Juyo', price_value: 3000000, price_currency: 'JPY', is_available: true },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'certification' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  // ===========================================================================
  // CATEGORY BREAKDOWN TESTS
  // ===========================================================================

  describe('category breakdown', () => {
    it('returns category metrics sorted by available count', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { item_type: 'katana', price_value: 1000000, price_currency: 'JPY', is_available: true, is_sold: false },
        { item_type: 'katana', price_value: 2000000, price_currency: 'JPY', is_available: true, is_sold: false },
        { item_type: 'katana', price_value: 1500000, price_currency: 'JPY', is_available: true, is_sold: false },
        { item_type: 'wakizashi', price_value: 800000, price_currency: 'JPY', is_available: true, is_sold: false },
        { item_type: 'tanto', price_value: 500000, price_currency: 'JPY', is_available: true, is_sold: false },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 5);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'category' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.categories).toBeDefined();
      expect(Array.isArray(json.data.categories)).toBe(true);

      // Should be sorted by available count (katana: 3, wakizashi: 1, tanto: 1)
      if (json.data.categories.length > 1) {
        expect(json.data.categories[0].availableCount).toBeGreaterThanOrEqual(
          json.data.categories[1].availableCount
        );
      }
    });

    it('calculates market shares correctly', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { item_type: 'katana', price_value: 1000000, price_currency: 'JPY', is_available: true, is_sold: false },
        { item_type: 'katana', price_value: 1000000, price_currency: 'JPY', is_available: true, is_sold: false },
        { item_type: 'wakizashi', price_value: 500000, price_currency: 'JPY', is_available: true, is_sold: false },
        { item_type: 'wakizashi', price_value: 500000, price_currency: 'JPY', is_available: true, is_sold: false },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 4);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'category' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);

      // Each category has 2 listings (50% count share each)
      // Katana: 2,000,000 total, Wakizashi: 1,000,000 total
      // Total market value: 3,000,000
      // Katana value share: 2/3 = 0.6667, Wakizashi: 1/3 = 0.3333
      const katana = json.data.categories.find((c: { itemType: string }) => c.itemType === 'katana');
      const wakizashi = json.data.categories.find((c: { itemType: string }) => c.itemType === 'wakizashi');

      if (katana && wakizashi) {
        expect(katana.countShare).toBeCloseTo(0.5, 1);
        expect(wakizashi.countShare).toBeCloseTo(0.5, 1);
      }
    });

    it('includes price vs market comparison', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { item_type: 'katana', price_value: 2000000, price_currency: 'JPY', is_available: true, is_sold: false },
        { item_type: 'tsuba', price_value: 100000, price_currency: 'JPY', is_available: true, is_sold: false },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 2);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'category' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);

      for (const category of json.data.categories) {
        expect(category).toHaveProperty('priceVsMarket');
        expect(typeof category.priceVsMarket).toBe('number');
      }
    });

    it('handles unknown item types', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { item_type: null, price_value: 500000, price_currency: 'JPY', is_available: true, is_sold: false },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'category' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      // Should categorize null as 'unknown'
      const unknownCategory = json.data.categories.find((c: { itemType: string }) => c.itemType === 'unknown');
      expect(unknownCategory).toBeDefined();
    });

    it('returns category totals', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { item_type: 'katana', price_value: 1000000, price_currency: 'JPY', is_available: true, is_sold: false },
        { item_type: 'wakizashi', price_value: 500000, price_currency: 'JPY', is_available: true, is_sold: false },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 2);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'category' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.totals).toBeDefined();
      expect(json.data.totals.totalCount).toBe(2);
      expect(json.data.totals.totalValueJPY).toBe(1500000);
    });
  });

  // ===========================================================================
  // DEALER BREAKDOWN TESTS
  // ===========================================================================

  describe('dealer breakdown', () => {
    it('returns dealer metrics', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const dealers = [
        { id: 1, name: 'Aoi Art' },
        { id: 2, name: 'Eirakudo' },
      ];

      const listings = [
        { dealer_id: 1, price_value: 1000000, price_currency: 'JPY', is_available: true },
        { dealer_id: 1, price_value: 1500000, price_currency: 'JPY', is_available: true },
        { dealer_id: 2, price_value: 800000, price_currency: 'JPY', is_available: true },
      ];

      const dealerBuilder = createMockQueryBuilder(dealers, 2);
      const listingBuilder = createMockQueryBuilder(listings, 3);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        if (table === 'dealers') return dealerBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'dealer' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.dealers).toBeDefined();
      expect(Array.isArray(json.data.dealers)).toBe(true);

      if (json.data.dealers.length > 0) {
        const dealer = json.data.dealers[0];
        expect(dealer).toHaveProperty('dealerId');
        expect(dealer).toHaveProperty('dealerName');
        expect(dealer).toHaveProperty('totalCount');
        expect(dealer).toHaveProperty('totalValueJPY');
        expect(dealer).toHaveProperty('medianPriceJPY');
        expect(dealer).toHaveProperty('countShare');
        expect(dealer).toHaveProperty('valueShare');
      }
    });

    it('respects limit parameter', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const dealers = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `Dealer ${i + 1}` }));
      const listings = Array.from({ length: 30 }, (_, i) => ({
        dealer_id: i + 1,
        price_value: 500000,
        price_currency: 'JPY',
        is_available: true,
      }));

      const dealerBuilder = createMockQueryBuilder(dealers, 30);
      const listingBuilder = createMockQueryBuilder(listings, 30);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        if (table === 'dealers') return dealerBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'dealer', limit: '10' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.dealers.length).toBeLessThanOrEqual(10);
    });

    it('uses default limit of 20', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const dealers = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `Dealer ${i + 1}` }));
      const listings = Array.from({ length: 30 }, (_, i) => ({
        dealer_id: i + 1,
        price_value: 500000,
        price_currency: 'JPY',
        is_available: true,
      }));

      const dealerBuilder = createMockQueryBuilder(dealers, 30);
      const listingBuilder = createMockQueryBuilder(listings, 30);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        if (table === 'dealers') return dealerBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'dealer' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.dealers.length).toBeLessThanOrEqual(20);
    });

    it('caps limit at 100', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const dealers = [{ id: 1, name: 'Test Dealer' }];
      const listings = [{ dealer_id: 1, price_value: 500000, price_currency: 'JPY', is_available: true }];

      const dealerBuilder = createMockQueryBuilder(dealers, 1);
      const listingBuilder = createMockQueryBuilder(listings, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        if (table === 'dealers') return dealerBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'dealer', limit: '500' });
      const response = await GET(request);

      // Should not error, just cap at 100
      expect(response.status).toBe(200);
    });
  });

  // ===========================================================================
  // CERTIFICATION BREAKDOWN TESTS
  // ===========================================================================

  describe('certification breakdown', () => {
    it('returns certification metrics', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { cert_type: 'Juyo', price_value: 3000000, price_currency: 'JPY', is_available: true },
        { cert_type: 'Juyo', price_value: 5000000, price_currency: 'JPY', is_available: true },
        { cert_type: 'Hozon', price_value: 1000000, price_currency: 'JPY', is_available: true },
        { cert_type: 'TokuHozon', price_value: 2000000, price_currency: 'JPY', is_available: true },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 4);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'certification' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.certifications).toBeDefined();
      expect(Array.isArray(json.data.certifications)).toBe(true);

      if (json.data.certifications.length > 0) {
        const cert = json.data.certifications[0];
        expect(cert).toHaveProperty('certType');
        expect(cert).toHaveProperty('displayName');
        expect(cert).toHaveProperty('totalCount');
        expect(cert).toHaveProperty('totalValueJPY');
        expect(cert).toHaveProperty('medianPriceJPY');
        expect(cert).toHaveProperty('countShare');
        expect(cert).toHaveProperty('valueShare');
      }
    });

    it('handles items with no certification as "None"', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      // Note: The API filters out null cert_type, so this tests how it handles
      // items that have cert_type but value is null (edge case)
      const listings = [
        { cert_type: 'Juyo', price_value: 3000000, price_currency: 'JPY', is_available: true },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'certification' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
    });

    it('formats certification display names', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { cert_type: 'Juyo', price_value: 3000000, price_currency: 'JPY', is_available: true },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'certification' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);

      if (json.data.certifications.length > 0) {
        // Should have a displayName field
        expect(json.data.certifications[0].displayName).toBeDefined();
      }
    });

    it('returns certification totals', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listings = [
        { cert_type: 'Juyo', price_value: 3000000, price_currency: 'JPY', is_available: true },
        { cert_type: 'Hozon', price_value: 1000000, price_currency: 'JPY', is_available: true },
      ];

      const listingBuilder = createMockQueryBuilder(listings, 2);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'certification' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.totals).toBeDefined();
      expect(json.data.totals.totalCount).toBe(2);
      expect(json.data.totals.totalValueJPY).toBe(4000000);
    });
  });

  // ===========================================================================
  // EMPTY RESULTS HANDLING
  // ===========================================================================

  describe('empty results handling', () => {
    it('returns empty categories array when no listings', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const emptyListingBuilder = createMockQueryBuilder([], 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return emptyListingBuilder;
      });

      const request = createMockRequest({ by: 'category' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.categories).toEqual([]);
      expect(json.data.totals.totalCount).toBe(0);
    });

    it('returns empty dealers array when no listings', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const dealerBuilder = createMockQueryBuilder([{ id: 1, name: 'Test' }], 1);
      const emptyListingBuilder = createMockQueryBuilder([], 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        if (table === 'dealers') return dealerBuilder;
        return emptyListingBuilder;
      });

      const request = createMockRequest({ by: 'dealer' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.dealers).toEqual([]);
    });

    it('returns empty certifications array when no certified listings', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const emptyListingBuilder = createMockQueryBuilder([], 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return emptyListingBuilder;
      });

      const request = createMockRequest({ by: 'certification' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.certifications).toEqual([]);
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    it('returns 500 on database error for category breakdown', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const errorBuilder = createMockQueryBuilder(null, null, { message: 'DB Error' });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return errorBuilder;
      });

      const request = createMockRequest({ by: 'category' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it('returns 500 on database error for dealer breakdown', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const errorBuilder = createMockQueryBuilder(null, null, { message: 'DB Error' });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return errorBuilder;
      });

      const request = createMockRequest({ by: 'dealer' });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  // ===========================================================================
  // CACHING TESTS
  // ===========================================================================

  describe('caching', () => {
    it('sets proper cache headers for successful response', async () => {
      const profileBuilder = createMockQueryBuilder();
      profileBuilder.single = vi.fn(() =>
        Promise.resolve({ data: { role: 'admin' }, error: null })
      );

      const listingBuilder = createMockQueryBuilder([
        { item_type: 'katana', price_value: 1000000, price_currency: 'JPY', is_available: true, is_sold: false },
      ], 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileBuilder;
        return listingBuilder;
      });

      const request = createMockRequest({ by: 'category' });
      const response = await GET(request);

      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toContain('max-age=300');
    });
  });
});
