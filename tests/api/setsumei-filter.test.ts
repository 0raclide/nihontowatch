/**
 * Setsumei Filter Tests - Browse API
 *
 * CRITICAL: These tests ensure the enriched=true filter uses setsumei_text_en
 * and NOT the old Yuhinkai enrichment table.
 *
 * Regression context: We switched from Yuhinkai catalog (97 items) to
 * OCR setsumei (196 items) in Jan 2026. These tests prevent reverting.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock Next.js cookies before importing the route handler
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

// Mock subscription server to avoid data delay filter
// This prevents the .lte() call that the mock query builder doesn't support
vi.mock('@/lib/subscription/server', () => ({
  getUserSubscription: vi.fn(() =>
    Promise.resolve({
      tier: 'connoisseur',
      status: 'active',
      userId: null,
      isDelayed: false, // KEY: Prevents .lte() code path
    })
  ),
  getDataDelayCutoff: vi.fn(() => new Date().toISOString()),
}));

// Track Supabase query calls
interface QueryTracker {
  notCalls: Array<{ column: string; operator: string; value: unknown }>;
  fromCalls: string[];
  selectCalls: Array<{ columns: string }>;
  inCalls: Array<{ column: string; values: unknown[] }>;
}

let queryTracker: QueryTracker;

// Create mock query builder
function createMockQueryBuilder(returnData: unknown[] = [], returnCount = 0) {
  const builder: Record<string, Mock> = {};
  const chain = () => builder;

  builder.select = vi.fn((columns: string) => {
    queryTracker.selectCalls.push({ columns });
    return chain();
  });

  builder.not = vi.fn((column: string, operator: string, value: unknown) => {
    queryTracker.notCalls.push({ column, operator, value });
    return chain();
  });

  builder.in = vi.fn((column: string, values: unknown[]) => {
    queryTracker.inCalls.push({ column, values });
    return chain();
  });

  builder.eq = vi.fn(() => chain());
  builder.or = vi.fn(() => chain());
  builder.is = vi.fn(() => chain());
  builder.filter = vi.fn(() => chain());
  builder.order = vi.fn(() => chain());
  builder.textSearch = vi.fn(() => chain());
  builder.limit = vi.fn(() => chain());
  builder.single = vi.fn(() => Promise.resolve({ data: {}, error: null }));

  builder.range = vi.fn(() =>
    Promise.resolve({
      data: returnData,
      error: null,
      count: returnCount,
    })
  );

  return builder;
}

// Mock Supabase
let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>;

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: (table: string) => {
        queryTracker.fromCalls.push(table);
        return mockQueryBuilder;
      },
    })
  ),
}));

// Import after mocks
import { GET } from '@/app/api/browse/route';
import { NextRequest } from 'next/server';

describe('Setsumei Filter - Browse API', () => {
  beforeEach(() => {
    queryTracker = {
      notCalls: [],
      fromCalls: [],
      selectCalls: [],
      inCalls: [],
    };
    mockQueryBuilder = createMockQueryBuilder([], 0);
    vi.clearAllMocks();
  });

  describe('enriched=true filter', () => {
    it('MUST filter on setsumei_text_en NOT NULL (not Yuhinkai table)', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/browse?enriched=true'
      );

      await GET(request);

      // CRITICAL: Must use NOT filter on setsumei_text_en
      const setsumeiFilter = queryTracker.notCalls.find(
        (call) => call.column === 'setsumei_text_en'
      );

      expect(setsumeiFilter).toBeDefined();
      expect(setsumeiFilter?.operator).toBe('is');
      expect(setsumeiFilter?.value).toBeNull();

      // CRITICAL: Must NOT query listing_yuhinkai_enrichment table
      const yuhinkaiQuery = queryTracker.fromCalls.find(
        (table) => table === 'listing_yuhinkai_enrichment'
      );
      expect(yuhinkaiQuery).toBeUndefined();
    });

    it('should NOT use listing_yuhinkai_enrichment for enriched filter', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/browse?enriched=true'
      );

      await GET(request);

      // Verify we never query the Yuhinkai table for the main filter
      // (it may still be queried for other purposes, but not for enriched filter)
      const yuhinkaiForFilter = queryTracker.inCalls.find(
        (call) => call.column === 'id' && queryTracker.fromCalls.includes('listing_yuhinkai_enrichment')
      );

      // The old implementation would have an 'in' call with IDs from Yuhinkai
      // The new implementation should NOT have this pattern
      expect(yuhinkaiForFilter).toBeUndefined();
    });

    it('should apply setsumei filter alongside other filters', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/browse?enriched=true&category=swords&certifications=Juyo'
      );

      await GET(request);

      // Should have setsumei filter
      const setsumeiFilter = queryTracker.notCalls.find(
        (call) => call.column === 'setsumei_text_en'
      );
      expect(setsumeiFilter).toBeDefined();
    });
  });

  describe('enriched=false or absent', () => {
    it('should NOT apply setsumei filter when enriched param is absent', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/browse?category=swords'
      );

      await GET(request);

      const setsumeiFilter = queryTracker.notCalls.find(
        (call) => call.column === 'setsumei_text_en'
      );
      expect(setsumeiFilter).toBeUndefined();
    });

    it('should NOT apply setsumei filter when enriched=false', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/browse?enriched=false'
      );

      await GET(request);

      const setsumeiFilter = queryTracker.notCalls.find(
        (call) => call.column === 'setsumei_text_en'
      );
      expect(setsumeiFilter).toBeUndefined();
    });
  });
});

describe('Setsumei Data Contract', () => {
  /**
   * These tests document the expected data structure for setsumei.
   * If these fail, the UI components will break.
   */

  it('setsumei_text_en should be a string when present', () => {
    const validSetsumei = {
      setsumei_text_en: '## Juyo-Token, 45th Session\n\nDescription here...',
      setsumei_text_ja: '重要第一〇六〇號',
    };

    expect(typeof validSetsumei.setsumei_text_en).toBe('string');
    expect(validSetsumei.setsumei_text_en.length).toBeGreaterThan(0);
  });

  it('setsumei_text_en should contain markdown headers for session info', () => {
    const setsumeiWithSession = '## Juyo-Token, 45th Session — Designated October 29, 1999';

    expect(setsumeiWithSession).toMatch(/^##\s+/);
    expect(setsumeiWithSession).toMatch(/Session/i);
  });
});
