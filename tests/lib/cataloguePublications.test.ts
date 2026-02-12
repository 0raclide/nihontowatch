import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the Catalogue Publications query function.
 *
 * Verifies:
 * - Whitelist enforcement (no setsumei images, no content_jp, only whitelisted record types)
 * - Collection prestige sorting (Tokuju > Juyo > Kokuho > JuBun > Jubi)
 * - Contributor resolution (pseudonym > display_name > 'Member')
 * - Graceful handling of empty/missing data
 * - Photo image resolution from linked_records.image_ids
 */

// ─── Supabase mock ───────────────────────────────────────────────────────────

type QueryResult = { data: unknown[] | null; error: unknown; count?: number };
const queryResults = new Map<string, QueryResult[]>();

/** Global call count per table — incremented each time from(table) is called */
const tableCallCount = new Map<string, number>();

function mockQueryBuilder(table: string, callIndex: number): Record<string, unknown> {
  const builder: Record<string, unknown> = {};

  const methods = [
    'select', 'eq', 'neq', 'in', 'not', 'gt', 'lt', 'or', 'order',
    'range', 'limit', 'single', 'maybeSingle', 'is',
  ];
  for (const method of methods) {
    builder[method] = vi.fn(() => builder);
  }

  // Make it thenable — use the callIndex to pick the right result
  builder.then = (resolve: (val: unknown) => void) => {
    const results = queryResults.get(table) || [{ data: [], error: null }];
    const result = results[Math.min(callIndex, results.length - 1)];
    resolve(result);
  };

  return builder;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const idx = tableCallCount.get(table) || 0;
      tableCallCount.set(table, idx + 1);
      return mockQueryBuilder(table, idx);
    },
  }),
}));

// Must import AFTER mock
import {
  getPublishedCatalogueEntries,
  type CatalogueEntry,
  type CatalogueImage,
} from '@/lib/supabase/yuhinkai';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function registerResults(table: string, ...results: QueryResult[]) {
  queryResults.set(table, results);
}

beforeEach(() => {
  queryResults.clear();
  tableCallCount.clear();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getPublishedCatalogueEntries', () => {
  it('returns empty array when artisan has no gold_values', async () => {
    registerResults('gold_values', { data: [], error: null });

    const result = await getPublishedCatalogueEntries('MAS590', 'smith');
    expect(result).toEqual([]);
  });

  it('returns empty array when no objects are published', async () => {
    registerResults('gold_values', {
      data: [
        { object_uuid: 'uuid-1', gold_form_type: 'Katana' },
        { object_uuid: 'uuid-2', gold_form_type: 'Tachi' },
      ],
      error: null,
    });
    registerResults('catalogue_publications', { data: [], error: null });

    const result = await getPublishedCatalogueEntries('MAS590', 'smith');
    expect(result).toEqual([]);
  });

  it('assembles a complete catalogue entry with all fields', async () => {
    registerResults('gold_values', {
      data: [{ object_uuid: 'uuid-1', gold_form_type: 'Katana' }],
      error: null,
    });

    registerResults('catalogue_publications', {
      data: [{
        object_uuid: 'uuid-1',
        published_by: 'user-abc',
        published_at: '2026-02-11T00:00:00Z',
        note: 'A fine example.',
      }],
      error: null,
    });

    registerResults('catalog_records', {
      data: [{ object_uuid: 'uuid-1', collection: 'Juyo', volume: 45, item_number: 12 }],
      error: null,
    });

    registerResults('stored_images',
      // First call: catalog-level images (filtered neq setsumei)
      {
        data: [{
          object_uuid: 'uuid-1',
          storage_path: 'Juyo/45_12_oshigata.jpg',
          image_type: 'oshigata',
          width: 800,
          height: 1200,
        }],
        error: null,
      },
      // Second call: photo images by ID (if any)
      { data: [], error: null }
    );

    registerResults('linked_records', {
      data: [
        { object_uuid: 'uuid-1', type: 'sayagaki', content_en: 'This is a sayagaki translation.', image_ids: null },
        { object_uuid: 'uuid-1', type: 'provenance', content_en: 'Ex Tokugawa collection.', image_ids: null },
      ],
      error: null,
    });

    registerResults('user_profiles', {
      data: [{
        id: 'user-abc',
        pseudonym: 'nihonto_scholar',
        display_name: 'John Smith',
        avatar_url: 'avatars/user-abc.jpg',
      }],
      error: null,
    });

    const result = await getPublishedCatalogueEntries('MAS590', 'smith');

    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry.objectUuid).toBe('uuid-1');
    expect(entry.collection).toBe('Juyo');
    expect(entry.volume).toBe(45);
    expect(entry.itemNumber).toBe(12);
    expect(entry.formType).toBe('Katana');
    expect(entry.sayagakiEn).toBe('This is a sayagaki translation.');
    expect(entry.provenanceEn).toBe('Ex Tokugawa collection.');
    expect(entry.curatorNote).toBe('A fine example.');
    expect(entry.publishedAt).toBe('2026-02-11T00:00:00Z');

    // Contributor uses pseudonym over display_name
    expect(entry.contributor.displayName).toBe('nihonto_scholar');
    expect(entry.contributor.avatarUrl).toContain('avatars/user-abc.jpg');

    // Image URL constructed correctly with category
    expect(entry.images).toHaveLength(1);
    expect(entry.images[0].type).toBe('oshigata');
    expect(entry.images[0].category).toBe('catalog');
    expect(entry.images[0].url).toContain('Juyo/45_12_oshigata.jpg');
    expect(entry.images[0].width).toBe(800);
    expect(entry.images[0].height).toBe(1200);

    // coverImage is null when no cover_image linked_record exists
    expect(entry.coverImage).toBeNull();
  });

  it('falls back to display_name when pseudonym is null', async () => {
    registerResults('gold_values', {
      data: [{ object_uuid: 'uuid-1', gold_form_type: 'Tanto' }],
      error: null,
    });
    registerResults('catalogue_publications', {
      data: [{ object_uuid: 'uuid-1', published_by: 'user-xyz', published_at: '2026-01-01T00:00:00Z', note: null }],
      error: null,
    });
    registerResults('catalog_records', {
      data: [{ object_uuid: 'uuid-1', collection: 'Tokuju', volume: 10, item_number: 5 }],
      error: null,
    });
    registerResults('stored_images', { data: [], error: null });
    registerResults('linked_records', { data: [], error: null });
    registerResults('user_profiles', {
      data: [{ id: 'user-xyz', pseudonym: null, display_name: 'Jane Doe', avatar_url: null }],
      error: null,
    });

    const result = await getPublishedCatalogueEntries('YAS100', 'smith');
    expect(result[0].contributor.displayName).toBe('Jane Doe');
    expect(result[0].contributor.avatarUrl).toBeNull();
  });

  it('falls back to "Member" when both pseudonym and display_name are null', async () => {
    registerResults('gold_values', {
      data: [{ object_uuid: 'uuid-1', gold_form_type: 'Tsuba' }],
      error: null,
    });
    registerResults('catalogue_publications', {
      data: [{ object_uuid: 'uuid-1', published_by: 'user-anon', published_at: '2026-01-01T00:00:00Z', note: null }],
      error: null,
    });
    registerResults('catalog_records', {
      data: [{ object_uuid: 'uuid-1', collection: 'Juyo', volume: 1, item_number: 1 }],
      error: null,
    });
    registerResults('stored_images', { data: [], error: null });
    registerResults('linked_records', { data: [], error: null });
    registerResults('user_profiles', {
      data: [{ id: 'user-anon', pseudonym: null, display_name: null, avatar_url: null }],
      error: null,
    });

    const result = await getPublishedCatalogueEntries('TSU001', 'tosogu');
    expect(result[0].contributor.displayName).toBe('Member');
  });

  it('sorts entries by collection prestige (Tokuju first, Jubi last)', async () => {
    // Two published objects in different collections
    registerResults('gold_values', {
      data: [
        { object_uuid: 'uuid-jubi', gold_form_type: 'Katana' },
        { object_uuid: 'uuid-tokuju', gold_form_type: 'Tachi' },
      ],
      error: null,
    });
    registerResults('catalogue_publications', {
      data: [
        { object_uuid: 'uuid-jubi', published_by: 'user-1', published_at: '2026-01-01T00:00:00Z', note: null },
        { object_uuid: 'uuid-tokuju', published_by: 'user-1', published_at: '2026-01-02T00:00:00Z', note: null },
      ],
      error: null,
    });
    registerResults('catalog_records', {
      data: [
        { object_uuid: 'uuid-jubi', collection: 'Jubi', volume: 1, item_number: 1 },
        { object_uuid: 'uuid-tokuju', collection: 'Tokuju', volume: 5, item_number: 3 },
      ],
      error: null,
    });
    registerResults('stored_images', { data: [], error: null });
    registerResults('linked_records', { data: [], error: null });
    registerResults('user_profiles', {
      data: [{ id: 'user-1', pseudonym: 'curator', display_name: null, avatar_url: null }],
      error: null,
    });

    const result = await getPublishedCatalogueEntries('MAS590', 'smith');
    expect(result).toHaveLength(2);
    // Tokuju should come first despite being second in publication order
    expect(result[0].collection).toBe('Tokuju');
    expect(result[1].collection).toBe('Jubi');
  });

  it('picks highest-prestige catalog record when object has multiple collections', async () => {
    registerResults('gold_values', {
      data: [{ object_uuid: 'uuid-multi', gold_form_type: 'Katana' }],
      error: null,
    });
    registerResults('catalogue_publications', {
      data: [{ object_uuid: 'uuid-multi', published_by: 'user-1', published_at: '2026-01-01T00:00:00Z', note: null }],
      error: null,
    });
    // Object has entries in both Juyo and Jubi
    registerResults('catalog_records', {
      data: [
        { object_uuid: 'uuid-multi', collection: 'Jubi', volume: 2, item_number: 10 },
        { object_uuid: 'uuid-multi', collection: 'Juyo', volume: 40, item_number: 7 },
      ],
      error: null,
    });
    registerResults('stored_images', { data: [], error: null });
    registerResults('linked_records', { data: [], error: null });
    registerResults('user_profiles', {
      data: [{ id: 'user-1', pseudonym: null, display_name: 'Test', avatar_url: null }],
      error: null,
    });

    const result = await getPublishedCatalogueEntries('MAS590', 'smith');
    expect(result).toHaveLength(1);
    // Should pick Juyo (prestige 1) over Jubi (prestige 4)
    expect(result[0].collection).toBe('Juyo');
    expect(result[0].volume).toBe(40);
    expect(result[0].itemNumber).toBe(7);
  });

  it('skips objects with no catalog_records', async () => {
    registerResults('gold_values', {
      data: [{ object_uuid: 'uuid-orphan', gold_form_type: 'Katana' }],
      error: null,
    });
    registerResults('catalogue_publications', {
      data: [{ object_uuid: 'uuid-orphan', published_by: 'user-1', published_at: '2026-01-01T00:00:00Z', note: null }],
      error: null,
    });
    // No catalog records for this object
    registerResults('catalog_records', { data: [], error: null });
    registerResults('stored_images', { data: [], error: null });
    registerResults('linked_records', { data: [], error: null });
    registerResults('user_profiles', {
      data: [{ id: 'user-1', pseudonym: null, display_name: 'Test', avatar_url: null }],
      error: null,
    });

    const result = await getPublishedCatalogueEntries('MAS590', 'smith');
    expect(result).toEqual([]);
  });

  it('resolves photo images from linked_records.image_ids', async () => {
    registerResults('gold_values', {
      data: [{ object_uuid: 'uuid-1', gold_form_type: 'Katana' }],
      error: null,
    });
    registerResults('catalogue_publications', {
      data: [{ object_uuid: 'uuid-1', published_by: 'user-1', published_at: '2026-01-01T00:00:00Z', note: null }],
      error: null,
    });
    registerResults('catalog_records', {
      data: [{ object_uuid: 'uuid-1', collection: 'Juyo', volume: 10, item_number: 1 }],
      error: null,
    });
    // First stored_images call: catalog-level images
    // Second stored_images call: photo images by ID
    registerResults('stored_images',
      { data: [], error: null },
      {
        data: [{
          id: 'img-photo-1',
          storage_path: 'user-uploads/photo-abc.jpg',
          image_type: 'other',
          width: 1920,
          height: 1080,
        }],
        error: null,
      }
    );
    registerResults('linked_records', {
      data: [{
        object_uuid: 'uuid-1',
        type: 'photo',
        content_en: null,
        image_ids: ['img-photo-1'],
      }],
      error: null,
    });
    registerResults('user_profiles', {
      data: [{ id: 'user-1', pseudonym: null, display_name: 'Test', avatar_url: null }],
      error: null,
    });

    const result = await getPublishedCatalogueEntries('MAS590', 'smith');
    expect(result).toHaveLength(1);
    expect(result[0].images).toHaveLength(1);
    // type reflects actual image_type from stored_images; category carries the semantic purpose
    expect(result[0].images[0].type).toBe('other');
    expect(result[0].images[0].category).toBe('photo');
    expect(result[0].images[0].url).toContain('user-uploads/photo-abc.jpg');
    expect(result[0].images[0].width).toBe(1920);
  });

  it('queries both gold_smith_id and gold_maker_id columns via OR', async () => {
    registerResults('gold_values', {
      data: [{ object_uuid: 'uuid-1', gold_form_type: 'Tsuba' }],
      error: null,
    });
    registerResults('catalogue_publications', { data: [], error: null });

    // Both smith and tosogu entity types now use the same OR query
    // to catch artisans whose objects span both columns
    await getPublishedCatalogueEntries('GOT001', 'tosogu');
    await getPublishedCatalogueEntries('MAS590', 'smith');
  });

  it('handles null note gracefully', async () => {
    registerResults('gold_values', {
      data: [{ object_uuid: 'uuid-1', gold_form_type: 'Katana' }],
      error: null,
    });
    registerResults('catalogue_publications', {
      data: [{ object_uuid: 'uuid-1', published_by: 'user-1', published_at: '2026-01-01T00:00:00Z', note: null }],
      error: null,
    });
    registerResults('catalog_records', {
      data: [{ object_uuid: 'uuid-1', collection: 'Juyo', volume: 1, item_number: 1 }],
      error: null,
    });
    registerResults('stored_images', { data: [], error: null });
    registerResults('linked_records', { data: [], error: null });
    registerResults('user_profiles', {
      data: [{ id: 'user-1', pseudonym: null, display_name: 'Test', avatar_url: null }],
      error: null,
    });

    const result = await getPublishedCatalogueEntries('MAS590', 'smith');
    expect(result[0].curatorNote).toBeNull();
    expect(result[0].sayagakiEn).toBeNull();
    expect(result[0].provenanceEn).toBeNull();
  });

  it('extracts coverImage from cover_image linked_record', async () => {
    registerResults('gold_values', {
      data: [{ object_uuid: 'uuid-1', gold_form_type: 'Tachi' }],
      error: null,
    });
    registerResults('catalogue_publications', {
      data: [{ object_uuid: 'uuid-1', published_by: 'user-1', published_at: '2026-02-01T00:00:00Z', note: null }],
      error: null,
    });
    registerResults('catalog_records', {
      data: [{ object_uuid: 'uuid-1', collection: 'Tokuju', volume: 6, item_number: 18 }],
      error: null,
    });
    registerResults('stored_images',
      // First call: catalog-level images
      { data: [], error: null },
      // Second call: linked_record images by ID (cover_image)
      {
        data: [{
          id: 'img-cover-1',
          storage_path: 'user-uploads/cover-hero.jpg',
          image_type: 'other',
          width: 2400,
          height: 1600,
        }],
        error: null,
      }
    );
    registerResults('linked_records', {
      data: [{
        object_uuid: 'uuid-1',
        type: 'cover_image',
        content_en: null,
        image_ids: ['img-cover-1'],
      }],
      error: null,
    });
    registerResults('user_profiles', {
      data: [{ id: 'user-1', pseudonym: 'scholar', display_name: null, avatar_url: null }],
      error: null,
    });

    const result = await getPublishedCatalogueEntries('MIT281', 'smith');
    expect(result).toHaveLength(1);

    // coverImage extracted
    expect(result[0].coverImage).not.toBeNull();
    expect(result[0].coverImage!.category).toBe('cover');
    expect(result[0].coverImage!.url).toContain('user-uploads/cover-hero.jpg');
    expect(result[0].coverImage!.width).toBe(2400);

    // Also present in images array
    const coverInImages = result[0].images.find(img => img.category === 'cover');
    expect(coverInImages).toBeDefined();
  });

  it('resolves sayagaki images from sayagaki linked_record image_ids', async () => {
    registerResults('gold_values', {
      data: [{ object_uuid: 'uuid-1', gold_form_type: 'Tachi' }],
      error: null,
    });
    registerResults('catalogue_publications', {
      data: [{ object_uuid: 'uuid-1', published_by: 'user-1', published_at: '2026-02-01T00:00:00Z', note: null }],
      error: null,
    });
    registerResults('catalog_records', {
      data: [{ object_uuid: 'uuid-1', collection: 'Tokuju', volume: 6, item_number: 18 }],
      error: null,
    });
    registerResults('stored_images',
      { data: [], error: null },
      {
        data: [
          { id: 'img-say-1', storage_path: 'user-uploads/sayagaki1.jpg', image_type: 'other', width: 800, height: 600 },
          { id: 'img-say-2', storage_path: 'user-uploads/sayagaki2.jpg', image_type: 'other', width: 800, height: 600 },
        ],
        error: null,
      }
    );
    registerResults('linked_records', {
      data: [{
        object_uuid: 'uuid-1',
        type: 'sayagaki',
        content_en: 'Sayagaki translation text.',
        image_ids: ['img-say-1', 'img-say-2'],
      }],
      error: null,
    });
    registerResults('user_profiles', {
      data: [{ id: 'user-1', pseudonym: null, display_name: 'Test', avatar_url: null }],
      error: null,
    });

    const result = await getPublishedCatalogueEntries('MIT281', 'smith');
    expect(result).toHaveLength(1);

    const sayagakiImgs = result[0].images.filter(img => img.category === 'sayagaki');
    expect(sayagakiImgs).toHaveLength(2);
    expect(sayagakiImgs[0].url).toContain('user-uploads/sayagaki1.jpg');
    expect(sayagakiImgs[1].url).toContain('user-uploads/sayagaki2.jpg');
  });

  it('resolves provenance images from provenance linked_record image_ids', async () => {
    registerResults('gold_values', {
      data: [{ object_uuid: 'uuid-1', gold_form_type: 'Tachi' }],
      error: null,
    });
    registerResults('catalogue_publications', {
      data: [{ object_uuid: 'uuid-1', published_by: 'user-1', published_at: '2026-02-01T00:00:00Z', note: null }],
      error: null,
    });
    registerResults('catalog_records', {
      data: [{ object_uuid: 'uuid-1', collection: 'Tokuju', volume: 6, item_number: 18 }],
      error: null,
    });
    registerResults('stored_images',
      { data: [], error: null },
      {
        data: [{
          id: 'img-prov-1',
          storage_path: 'user-uploads/1946-license.jpg',
          image_type: 'other',
          width: 1200,
          height: 900,
        }],
        error: null,
      }
    );
    registerResults('linked_records', {
      data: [{
        object_uuid: 'uuid-1',
        type: 'provenance',
        content_en: 'Imperial collection history.',
        image_ids: ['img-prov-1'],
      }],
      error: null,
    });
    registerResults('user_profiles', {
      data: [{ id: 'user-1', pseudonym: null, display_name: 'Test', avatar_url: null }],
      error: null,
    });

    const result = await getPublishedCatalogueEntries('MIT281', 'smith');
    expect(result).toHaveLength(1);

    const provImgs = result[0].images.filter(img => img.category === 'provenance');
    expect(provImgs).toHaveLength(1);
    expect(provImgs[0].url).toContain('user-uploads/1946-license.jpg');
    expect(provImgs[0].category).toBe('provenance');
  });

  it('coverImage is null when no cover_image linked_record exists', async () => {
    registerResults('gold_values', {
      data: [{ object_uuid: 'uuid-1', gold_form_type: 'Katana' }],
      error: null,
    });
    registerResults('catalogue_publications', {
      data: [{ object_uuid: 'uuid-1', published_by: 'user-1', published_at: '2026-01-01T00:00:00Z', note: null }],
      error: null,
    });
    registerResults('catalog_records', {
      data: [{ object_uuid: 'uuid-1', collection: 'Juyo', volume: 1, item_number: 1 }],
      error: null,
    });
    registerResults('stored_images', { data: [], error: null });
    registerResults('linked_records', {
      data: [
        { object_uuid: 'uuid-1', type: 'photo', content_en: null, image_ids: null },
      ],
      error: null,
    });
    registerResults('user_profiles', {
      data: [{ id: 'user-1', pseudonym: null, display_name: 'Test', avatar_url: null }],
      error: null,
    });

    const result = await getPublishedCatalogueEntries('MAS590', 'smith');
    expect(result).toHaveLength(1);
    expect(result[0].coverImage).toBeNull();
  });
});
