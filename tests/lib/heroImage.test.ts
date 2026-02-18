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
    rpc: vi.fn().mockResolvedValue({ data: { artists: [], total: 0, facets: null }, error: null }),
  }),
}));

// Mock fetch for HEAD checks (still used by getArtisanHeroImage for live computation)
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  getArtisanHeroImage,
  getHeroImagesFromTable,
  getHeroImageForDetailPage,
} from '@/lib/supabase/yuhinkai';

/**
 * Tests for hero image functions.
 *
 * getHeroImagesFromTable: Queries the pre-computed artisan_hero_images table.
 * Used by the directory AND detail pages (via getHeroImageForDetailPage).
 *
 * getHeroImageForDetailPage: Reads from the pre-computed table, parses URL
 * metadata, and fetches formType. Guarantees directory == detail page images.
 *
 * getArtisanHeroImage: Live computation from gold_values — used only by the
 * pre-computation batch job.
 */
describe('Hero image functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults.clear();
  });

  describe('getHeroImagesFromTable', () => {
    it('returns a map of code → image_url from artisan_hero_images table', async () => {
      queryResults.set('artisan_hero_images', {
        data: [
          { code: 'MAS590', image_url: 'https://example.com/storage/v1/object/public/images/Tokuju/5_42_oshigata.jpg' },
          { code: 'OWA009', image_url: 'https://example.com/storage/v1/object/public/images/Juyo/10_15_oshigata.jpg' },
        ],
        error: null,
      });

      const result = await getHeroImagesFromTable(['MAS590', 'OWA009'], 'smith');

      expect(result.size).toBe(2);
      expect(result.get('MAS590')).toContain('Tokuju/5_42_oshigata.jpg');
      expect(result.get('OWA009')).toContain('Juyo/10_15_oshigata.jpg');
    });

    it('returns empty map for empty input', async () => {
      const result = await getHeroImagesFromTable([], 'smith');
      expect(result.size).toBe(0);
    });

    it('handles database errors gracefully', async () => {
      queryResults.set('artisan_hero_images', {
        data: null,
        error: { message: 'connection error' },
      });

      const result = await getHeroImagesFromTable(['MAS590'], 'smith');
      expect(result.size).toBe(0);
    });
  });

  describe('getHeroImageForDetailPage', () => {
    it('returns null when no image in pre-computed table', async () => {
      queryResults.set('artisan_hero_images', { data: [], error: null });

      const result = await getHeroImageForDetailPage('NOIMG01', 'smith');
      expect(result).toBeNull();
    });

    it('parses volume-based URL and returns full ArtisanHeroImage', async () => {
      queryResults.set('artisan_hero_images', {
        data: [
          { code: 'MAS590', image_url: 'https://example.com/storage/v1/object/public/images/Tokuju/5_42_oshigata.jpg' },
        ],
        error: null,
      });
      // catalog_records query for formType lookup
      queryResults.set('catalog_records', {
        data: [{ object_uuid: 'uuid-1' }],
        error: null,
      });
      queryResults.set('gold_values', {
        data: [{ gold_form_type: 'Katana' }],
        error: null,
      });

      const result = await getHeroImageForDetailPage('MAS590', 'smith');
      expect(result).not.toBeNull();
      expect(result!.collection).toBe('Tokuju');
      expect(result!.volume).toBe(5);
      expect(result!.itemNumber).toBe(42);
      expect(result!.imageType).toBe('oshigata');
      expect(result!.formType).toBe('Katana');
      expect(result!.imageUrl).toContain('Tokuju/5_42_oshigata.jpg');
    });

    it('returns same imageUrl as getHeroImagesFromTable (directory match)', async () => {
      const url = 'https://example.com/storage/v1/object/public/images/Juyo/3_7_oshigata.jpg';
      queryResults.set('artisan_hero_images', {
        data: [{ code: 'TOM134', image_url: url }],
        error: null,
      });
      queryResults.set('catalog_records', { data: [], error: null });

      const detailResult = await getHeroImageForDetailPage('TOM134', 'smith');
      const directoryResult = await getHeroImagesFromTable(['TOM134'], 'smith');

      expect(detailResult!.imageUrl).toBe(directoryResult.get('TOM134'));
    });
  });

  describe('getArtisanHeroImage (live computation)', () => {
    it('returns null when no gold_values exist', async () => {
      queryResults.set('gold_values', { data: [], error: null });

      const result = await getArtisanHeroImage('NOIMG01', 'smith');
      expect(result).toBeNull();
    });

    it('returns image URL when gold_values + catalog_records exist', async () => {
      queryResults.set('gold_values', {
        data: [
          { object_uuid: 'uuid-1', gold_collections: ['Tokuju', 'Juyo'], gold_form_type: 'Katana' },
        ],
        error: null,
      });
      queryResults.set('catalog_records', {
        data: [
          { object_uuid: 'uuid-1', collection: 'Tokuju', volume: 5, item_number: 42 },
        ],
        error: null,
      });
      queryResults.set('linked_records', {
        data: [{ object_uuid: 'uuid-1' }],
        error: null,
      });

      mockFetch.mockResolvedValue({ ok: true });

      const result = await getArtisanHeroImage('TOM134', 'smith');
      expect(result).not.toBeNull();
      expect(result!.collection).toBe('Tokuju');
      expect(result!.imageUrl).toContain('5_42_oshigata.jpg');
    });
  });
});
