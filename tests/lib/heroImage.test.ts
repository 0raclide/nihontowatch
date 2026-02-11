import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Helper: build a chainable Supabase query mock.
 * Each method in the chain returns the same builder.
 * When awaited, resolves to { data, error } from the `_result`.
 */
function mockQueryBuilder(result: { data: unknown[] | null; error: unknown } = { data: [], error: null }) {
  const builder: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'neq', 'in', 'not', 'gt', 'lt', 'or', 'order', 'range', 'limit', 'single', 'is'];
  for (const method of methods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  // Make it thenable so `await query` resolves
  builder.then = (resolve: (val: unknown) => void) => resolve(result);
  return builder;
}

// Track query calls to return different data for different tables/filters
type QueryResult = { data: unknown[] | null; error: unknown };
const queryResults = new Map<string, QueryResult>();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      // Return a chainable builder that resolves to the registered result
      const result = queryResults.get(table) || { data: [], error: null };
      return mockQueryBuilder(result);
    },
  }),
}));

// Mock fetch for HEAD checks
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  getArtisanHeroImage,
  getBulkArtisanHeroImages,
} from '@/lib/supabase/yuhinkai';

/**
 * GOLDEN TESTS: Hero Image Consistency
 *
 * These tests exist because a previous batch-optimized implementation of
 * getBulkArtisanHeroImages used .limit(5000) on bulk queries across all
 * artisans, truncating data and causing directory thumbnails to show
 * DIFFERENT images than profile hero images for the same artisan.
 *
 * Root cause: the batch function duplicated the selection algorithm from
 * getArtisanHeroImage but with truncated data (limits on gold_values,
 * catalog_records, and linked_records shared across all artisans).
 *
 * The fix: getBulkArtisanHeroImages delegates to getArtisanHeroImage()
 * in parallel, guaranteeing identical results by construction.
 *
 * DO NOT replace getBulkArtisanHeroImages with a re-optimized batch
 * implementation unless these tests STILL PASS with the new implementation.
 *
 * REGRESSION: 2026-02-11 — Tomonari TOM134 showed different image on
 * /artists directory vs /artists/tomonari-TOM134 profile page.
 */
describe('Hero image consistency — GOLDEN TESTS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults.clear();
  });

  it('GOLDEN: bulk and single functions return the same URL for each artisan', async () => {
    // Set up mock data: artisan with Tokuju items
    queryResults.set('gold_values', {
      data: [
        { object_uuid: 'uuid-1', gold_collections: ['Tokuju', 'Juyo'], gold_form_type: 'Katana' },
        { object_uuid: 'uuid-2', gold_collections: ['Juyo'], gold_form_type: 'Tachi' },
      ],
      error: null,
    });
    queryResults.set('catalog_records', {
      data: [
        { object_uuid: 'uuid-1', collection: 'Tokuju', volume: 5, item_number: 42 },
        { object_uuid: 'uuid-1', collection: 'Juyo', volume: 10, item_number: 15 },
      ],
      error: null,
    });
    queryResults.set('linked_records', {
      data: [
        { object_uuid: 'uuid-1' },
        { object_uuid: 'uuid-1' },
      ],
      error: null,
    });

    // HEAD check succeeds for the Tokuju image
    mockFetch.mockResolvedValue({ ok: true });

    const singleResult = await getArtisanHeroImage('TOM134', 'smith');
    const bulkResult = await getBulkArtisanHeroImages([{ code: 'TOM134', entityType: 'smith' }]);

    expect(singleResult).not.toBeNull();
    expect(bulkResult.has('TOM134')).toBe(true);

    // THE GOLDEN ASSERTION: both paths produce identical URLs
    expect(bulkResult.get('TOM134')).toBe(singleResult!.imageUrl);
  });

  it('GOLDEN: bulk returns empty map when single returns null', async () => {
    // No gold_values → no image
    queryResults.set('gold_values', { data: [], error: null });

    const singleResult = await getArtisanHeroImage('NOIMG01', 'smith');
    const bulkResult = await getBulkArtisanHeroImages([{ code: 'NOIMG01', entityType: 'smith' }]);

    expect(singleResult).toBeNull();
    expect(bulkResult.has('NOIMG01')).toBe(false);
  });

  it('GOLDEN: bulk handles empty input without calling single', async () => {
    const result = await getBulkArtisanHeroImages([]);
    expect(result.size).toBe(0);
    // No fetch calls should have been made
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
