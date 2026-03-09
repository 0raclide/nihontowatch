/**
 * Golden tests for collection schema synchronization.
 *
 * Verifies that the `collection_items` SQL migration, the `ItemDataFields`
 * TypeScript interface, and the SHARED/LISTING_ONLY/COLLECTION_ONLY column
 * sets stay in sync. If any drift, these tests fail immediately.
 *
 * Follows the structural testing pattern from video-implementation.test.ts.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf-8');
}

describe('collection_items SQL migration has all shared columns', () => {
  const migrationSql = readSource('supabase/migrations/120_collection_items.sql');

  // Every shared column must appear in the SQL migration
  const SHARED_COLUMNS = [
    'item_uuid',
    'item_type',
    'item_category',
    'title',
    'description',
    'status',
    'is_available',
    'is_sold',
    'price_value',
    'price_currency',
    'nagasa_cm',
    'sori_cm',
    'motohaba_cm',
    'sakihaba_cm',
    'kasane_cm',
    'weight_g',
    'nakago_cm',
    'tosogu_maker',
    'tosogu_school',
    'material',
    'height_cm',
    'width_cm',
    'thickness_mm',
    'smith',
    'school',
    'province',
    'era',
    'mei_type',
    'mei_text',
    'mei_guaranteed',
    'nakago_type',
    'cert_type',
    'cert_session',
    'cert_organization',
    'images',
    'stored_images',
    'artisan_id',
    'artisan_confidence',
    'sayagaki',
    'hakogaki',
    'koshirae',
    'provenance',
    'kiwame',
    'kanto_hibisho',
    'research_notes',
    'setsumei_text_en',
    'setsumei_text_ja',
    'title_en',
    'title_ja',
    'description_en',
    'description_ja',
    'ai_curator_note_en',
    'ai_curator_note_ja',
    'focal_x',
    'focal_y',
    'hero_image_index',
    'video_count',
  ];

  for (const col of SHARED_COLUMNS) {
    it(`SQL migration defines column '${col}'`, () => {
      // Column must appear as a SQL column definition (word boundary match)
      const regex = new RegExp(`\\b${col}\\b`);
      expect(migrationSql).toMatch(regex);
    });
  }
});

describe('ItemDataFields TypeScript interface has all shared fields', () => {
  const typeSource = readSource('src/types/itemData.ts');

  const SHARED_FIELDS = [
    'item_type',
    'item_category',
    'title',
    'description',
    'status',
    'is_available',
    'is_sold',
    'price_value',
    'price_currency',
    'nagasa_cm',
    'sori_cm',
    'motohaba_cm',
    'sakihaba_cm',
    'kasane_cm',
    'weight_g',
    'nakago_cm',
    'tosogu_maker',
    'tosogu_school',
    'material',
    'height_cm',
    'width_cm',
    'thickness_mm',
    'smith',
    'school',
    'province',
    'era',
    'mei_type',
    'mei_text',
    'mei_guaranteed',
    'nakago_type',
    'cert_type',
    'cert_session',
    'cert_organization',
    'images',
    'stored_images',
    'artisan_id',
    'artisan_confidence',
    'sayagaki',
    'hakogaki',
    'koshirae',
    'provenance',
    'kiwame',
    'kanto_hibisho',
    'research_notes',
    'setsumei_text_en',
    'setsumei_text_ja',
    'title_en',
    'title_ja',
    'description_en',
    'description_ja',
    'ai_curator_note_en',
    'ai_curator_note_ja',
    'focal_x',
    'focal_y',
    'hero_image_index',
    'video_count',
  ];

  for (const field of SHARED_FIELDS) {
    it(`ItemDataFields declares '${field}'`, () => {
      // Must appear as a property in the interface (with optional ? or required :)
      const regex = new RegExp(`\\b${field}[?]?\\s*:`);
      expect(typeSource).toMatch(regex);
    });
  }
});

describe('LISTING_ONLY and COLLECTION_ONLY sets do not overlap', () => {
  const typeSource = readSource('src/types/itemData.ts');

  it('LISTING_ONLY_COLUMNS is exported', () => {
    expect(typeSource).toContain('export const LISTING_ONLY_COLUMNS');
  });

  it('COLLECTION_ONLY_COLUMNS is exported', () => {
    expect(typeSource).toContain('export const COLLECTION_ONLY_COLUMNS');
  });

  it('SHARED_COLUMNS is exported', () => {
    expect(typeSource).toContain('export const SHARED_COLUMNS');
  });

  it('no column appears in both LISTING_ONLY and COLLECTION_ONLY', () => {
    // Extract array contents from source using regex
    const extractArray = (varName: string): string[] => {
      const match = typeSource.match(new RegExp(`${varName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s*const`));
      if (!match) return [];
      return match[1]
        .split('\n')
        .map(line => {
          const m = line.match(/'([^']+)'/);
          return m ? m[1] : null;
        })
        .filter((x): x is string => x !== null);
    };

    const listingOnly = extractArray('LISTING_ONLY_COLUMNS');
    const collectionOnly = extractArray('COLLECTION_ONLY_COLUMNS');
    const sharedColumns = extractArray('SHARED_COLUMNS');

    expect(listingOnly.length).toBeGreaterThan(0);
    expect(collectionOnly.length).toBeGreaterThan(0);
    expect(sharedColumns.length).toBeGreaterThan(0);

    // No overlap between LISTING_ONLY and COLLECTION_ONLY
    const overlap = listingOnly.filter(c => collectionOnly.includes(c));
    expect(overlap).toEqual([]);

    // No overlap between SHARED and LISTING_ONLY
    const sharedListingOverlap = sharedColumns.filter(c => listingOnly.includes(c));
    expect(sharedListingOverlap).toEqual([]);

    // No overlap between SHARED and COLLECTION_ONLY (except owner_id which is in both tables but different semantics)
    // owner_id is in listings (nullable FK) AND collection_items (required FK) — it's intentionally in COLLECTION_ONLY
    // because it's a collection identity column, not a shared data field
    const sharedCollectionOverlap = sharedColumns.filter(c => collectionOnly.includes(c));
    expect(sharedCollectionOverlap).toEqual([]);
  });
});

describe('collection_items migration structural invariants', () => {
  const migrationSql = readSource('supabase/migrations/120_collection_items.sql');

  it('uses UUID primary key (not INTEGER)', () => {
    expect(migrationSql).toMatch(/id\s+UUID\s+PRIMARY KEY/);
  });

  it('has owner_id FK to auth.users', () => {
    expect(migrationSql).toContain('REFERENCES auth.users(id)');
  });

  it('item_uuid has UNIQUE constraint', () => {
    expect(migrationSql).toMatch(/item_uuid\s+UUID\s+NOT NULL\s+UNIQUE/);
  });

  it('reuses update_collection_updated_at trigger function', () => {
    expect(migrationSql).toContain('update_collection_updated_at');
  });

  it('height_cm is REAL (matches migration 099)', () => {
    expect(migrationSql).toMatch(/height_cm\s+REAL/);
  });

  it('width_cm is REAL (matches migration 099)', () => {
    expect(migrationSql).toMatch(/width_cm\s+REAL/);
  });

  it('source_listing_id references listings(id) with ON DELETE SET NULL', () => {
    expect(migrationSql).toMatch(/source_listing_id\s+INTEGER\s+REFERENCES\s+listings\(id\)\s+ON DELETE SET NULL/);
  });
});

describe('collection_events migration structural invariants', () => {
  const migrationSql = readSource('supabase/migrations/121_collection_events.sql');

  it('has NO foreign key to listings or collection_items', () => {
    // Audit log is self-contained — no FK to either table
    expect(migrationSql).not.toMatch(/REFERENCES\s+(listings|collection_items)/);
  });

  it('item_uuid is NOT NULL', () => {
    expect(migrationSql).toMatch(/item_uuid\s+UUID\s+NOT NULL/);
  });

  it('actor_id references auth.users', () => {
    expect(migrationSql).toContain('REFERENCES auth.users(id)');
  });
});

describe('item_videos migration structural invariants', () => {
  const migrationSql = readSource('supabase/migrations/122_item_videos.sql');

  it('uses item_uuid (not listing_id) as a column', () => {
    expect(migrationSql).toContain('item_uuid');
    // Must NOT have listing_id as a SQL column definition (comments mentioning it are fine)
    // A column definition would look like: listing_id INTEGER or listing_id UUID
    expect(migrationSql).not.toMatch(/^\s+listing_id\s+(INTEGER|UUID|TEXT|BIGINT)/m);
  });

  it('has NO foreign key on item_uuid', () => {
    // item_uuid has no FK because item may be in either table
    // The only FK should be owner_id → auth.users
    const lines = migrationSql.split('\n');
    const itemUuidLine = lines.find(l => l.includes('item_uuid') && l.includes('UUID'));
    expect(itemUuidLine).toBeDefined();
    expect(itemUuidLine).not.toContain('REFERENCES');
  });

  it('has stream_url column (unlike listing_videos)', () => {
    expect(migrationSql).toContain('stream_url');
  });

  it('has updated_at column (unlike listing_videos)', () => {
    expect(migrationSql).toContain('updated_at');
  });
});

describe('listings migration 119 adds item_uuid and owner_id', () => {
  const migrationSql = readSource('supabase/migrations/119_listing_item_uuid_owner.sql');

  it('adds item_uuid with UNIQUE constraint', () => {
    expect(migrationSql).toContain('item_uuid');
    expect(migrationSql).toContain('UNIQUE');
  });

  it('adds owner_id with FK to auth.users', () => {
    expect(migrationSql).toContain('owner_id');
    expect(migrationSql).toContain('auth.users(id)');
  });

  it('creates partial indexes (WHERE NOT NULL)', () => {
    expect(migrationSql).toMatch(/WHERE\s+item_uuid\s+IS\s+NOT\s+NULL/);
    expect(migrationSql).toMatch(/WHERE\s+owner_id\s+IS\s+NOT\s+NULL/);
  });
});

describe('RLS policies exist for all new tables', () => {
  const rlsSql = readSource('supabase/migrations/123_collection_rls.sql');

  it('enables RLS on collection_items', () => {
    expect(rlsSql).toContain('ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY');
  });

  it('enables RLS on collection_events', () => {
    expect(rlsSql).toContain('ALTER TABLE collection_events ENABLE ROW LEVEL SECURITY');
  });

  it('enables RLS on item_videos', () => {
    expect(rlsSql).toContain('ALTER TABLE item_videos ENABLE ROW LEVEL SECURITY');
  });

  it('has owner policy for collection_items', () => {
    expect(rlsSql).toContain('ci_owner_all');
  });

  it('has service role policy for collection_items', () => {
    expect(rlsSql).toContain('ci_service_role');
  });
});

describe('backfill migration 124 is safe', () => {
  const backfillSql = readSource('supabase/migrations/124_backfill_dealer_item_uuid.sql');

  it('sets owner_id BEFORE item_uuid', () => {
    const ownerIdx = backfillSql.indexOf('SET owner_id');
    const uuidIdx = backfillSql.indexOf('SET item_uuid');
    expect(ownerIdx).toBeGreaterThan(-1);
    expect(uuidIdx).toBeGreaterThan(-1);
    expect(ownerIdx).toBeLessThan(uuidIdx);
  });

  it('only touches dealer listings (WHERE source = \'dealer\')', () => {
    // Both UPDATE statements should filter by source = 'dealer'
    const matches = backfillSql.match(/source\s*=\s*'dealer'/g);
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });

  it('is idempotent (WHERE ... IS NULL guard)', () => {
    // Both statements must have IS NULL guard
    const nullGuards = backfillSql.match(/IS NULL/g);
    expect(nullGuards?.length).toBeGreaterThanOrEqual(2);
  });
});
