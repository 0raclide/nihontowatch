/**
 * Golden tests for video implementation contracts.
 *
 * These tests verify structural invariants that, if broken, cause silent
 * failures (missing badges, orphaned Bunny videos, N+1 queries).
 *
 * Phase 2b: videos moved from `listing_videos` → `item_videos` (keyed by item_uuid).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf-8');
}

describe('video_count denormalization', () => {
  it('browse API SELECT includes video_count as a plain column', () => {
    const source = readSource('src/app/api/browse/route.ts');
    // Must have video_count in the SELECT (plain column, not a join)
    expect(source).toContain('video_count');
  });

  it('browse API does NOT join listing_videos or item_videos', () => {
    const source = readSource('src/app/api/browse/route.ts');
    // No video table joins — video_count is denormalized
    expect(source).not.toMatch(/listing_videos\s*\(/);
    expect(source).not.toMatch(/item_videos\s*\(/);
  });

  it('migration 125 creates trigger on item_videos (not listing_videos)', () => {
    const source = readSource('supabase/migrations/125_migrate_listing_videos_to_item_videos.sql');
    expect(source).toContain('video_count');
    expect(source).toContain('CREATE TRIGGER');
    expect(source).toContain('item_videos');
    // Must fire on status changes (so webhook status='ready' updates count)
    expect(source).toContain('UPDATE OF status');
  });

  it('migration 125 drops listing_videos table', () => {
    const source = readSource('supabase/migrations/125_migrate_listing_videos_to_item_videos.sql');
    expect(source).toContain('DROP TABLE IF EXISTS listing_videos');
  });

  it('migration 125 copies data from listing_videos to item_videos', () => {
    const source = readSource('supabase/migrations/125_migrate_listing_videos_to_item_videos.sql');
    expect(source).toContain('INSERT INTO item_videos');
    expect(source).toContain('FROM listing_videos');
    expect(source).toContain('JOIN listings');
    // Must use item_uuid from listings
    expect(source).toContain('l.item_uuid');
  });

  it('migration 125 is idempotent (skips existing rows)', () => {
    const source = readSource('supabase/migrations/125_migrate_listing_videos_to_item_videos.sql');
    expect(source).toContain('NOT EXISTS');
  });
});

describe('video_count in listing APIs', () => {
  it('artisan listings API includes video_count', () => {
    const source = readSource('src/app/api/artisan/[code]/listings/route.ts');
    expect(source).toContain('video_count');
  });

  it('favorites API includes video_count', () => {
    const source = readSource('src/app/api/favorites/route.ts');
    expect(source).toContain('video_count');
  });
});

describe('Bunny cleanup on listing delete', () => {
  it('dealer listing DELETE handler imports videoProvider', () => {
    const source = readSource('src/app/api/dealer/listings/[id]/route.ts');
    expect(source).toContain("import { videoProvider, isVideoProviderConfigured }");
  });

  it('dealer listing DELETE handler queries item_videos (not listing_videos)', () => {
    const source = readSource('src/app/api/dealer/listings/[id]/route.ts');
    // Must query item_videos for Bunny cleanup
    expect(source).toContain('selectItemVideos');
    expect(source).toContain("'item_uuid'");
    // Must NOT reference listing_videos
    expect(source).not.toContain('selectListingVideos');
    expect(source).not.toContain("from('listing_videos'");
  });

  it('dealer listing DELETE handler calls deleteVideo before listing delete', () => {
    const source = readSource('src/app/api/dealer/listings/[id]/route.ts');
    // Must query item_videos BEFORE deleting the listing
    const videoQueryIdx = source.indexOf('selectItemVideos');
    const listingDeleteIdx = source.indexOf(".delete()");
    expect(videoQueryIdx).toBeGreaterThan(-1);
    expect(listingDeleteIdx).toBeGreaterThan(-1);
    expect(videoQueryIdx).toBeLessThan(listingDeleteIdx);

    // Must call videoProvider.deleteVideo
    expect(source).toContain('videoProvider.deleteVideo');
  });

  it('Bunny deletion is best-effort (does not block listing delete on failure)', () => {
    const source = readSource('src/app/api/dealer/listings/[id]/route.ts');
    // The deleteVideo call must be inside a .catch() — don't let Bunny errors block deletion
    expect(source).toMatch(/deleteVideo\(.*\)\.catch/);
  });
});

describe('video routes use item_videos (not listing_videos)', () => {
  const videoRouteFiles = [
    'src/app/api/dealer/videos/route.ts',
    'src/app/api/dealer/videos/[id]/route.ts',
    'src/app/api/dealer/videos/webhook/route.ts',
  ];

  for (const file of videoRouteFiles) {
    it(`${file} has no 'as any' casts`, () => {
      const source = readSource(file);
      expect(source).not.toContain('as any');
    });

    it(`${file} does NOT reference listing_videos`, () => {
      const source = readSource(file);
      expect(source).not.toContain('listing_videos');
      expect(source).not.toContain('listingVideos');
      expect(source).not.toContain('ListingVideosRow');
    });
  }

  it('POST /api/dealer/videos inserts into item_videos', () => {
    const source = readSource('src/app/api/dealer/videos/route.ts');
    expect(source).toContain('insertItemVideo');
    expect(source).toContain('item_uuid');
    expect(source).toContain('owner_id');
  });

  it('GET /api/dealer/videos queries item_videos by item_uuid', () => {
    const source = readSource('src/app/api/dealer/videos/route.ts');
    expect(source).toContain('selectItemVideos');
    expect(source).toContain("'item_uuid'");
  });

  it('webhook updates item_videos and stores stream_url', () => {
    const source = readSource('src/app/api/dealer/videos/webhook/route.ts');
    expect(source).toContain('selectItemVideoSingle');
    expect(source).toContain('updateItemVideo');
    expect(source).toContain('stream_url');
  });

  it('DELETE /api/dealer/videos/[id] verifies ownership via owner_id', () => {
    const source = readSource('src/app/api/dealer/videos/[id]/route.ts');
    expect(source).toContain('selectItemVideoSingle');
    expect(source).toContain('deleteItemVideo');
    expect(source).toContain('owner_id');
  });
});

describe('typed helpers', () => {
  it('itemVideos.ts exports all CRUD helpers', () => {
    const source = readSource('src/lib/supabase/itemVideos.ts');
    expect(source).toContain('insertItemVideo');
    expect(source).toContain('selectItemVideos');
    expect(source).toContain('selectItemVideoSingle');
    expect(source).toContain('updateItemVideo');
    expect(source).toContain('deleteItemVideo');
    expect(source).toContain('ItemVideoRow');
  });
});

describe('getListingDetail video enrichment', () => {
  it('getListingDetail does NOT use nested listing_videos select', () => {
    const source = readSource('src/lib/listing/getListingDetail.ts');
    expect(source).not.toMatch(/listing_videos\s*\(/);
  });

  it('getListingDetail queries item_videos by item_uuid', () => {
    const source = readSource('src/lib/listing/getListingDetail.ts');
    expect(source).toContain('selectItemVideos');
    expect(source).toContain('item_uuid');
  });

  it('getListingDetail includes item_uuid in SELECT', () => {
    const source = readSource('src/lib/listing/getListingDetail.ts');
    // item_uuid must be in the LISTING_SELECT so we can query item_videos
    const selectMatch = source.match(/const LISTING_SELECT = `([\s\S]*?)`;/);
    expect(selectMatch).toBeTruthy();
    expect(selectMatch![1]).toContain('item_uuid');
  });
});

describe('unified gallery', () => {
  it('ListingDetailClient uses getMediaItemsFromImages (not dual arrays)', () => {
    const source = readSource('src/app/listing/[id]/ListingDetailClient.tsx');
    // Must use the unified function
    expect(source).toContain('getMediaItemsFromImages');
    // Must NOT have the fragile index arithmetic
    expect(source).not.toContain('images.length + vIdx');
    expect(source).not.toContain('selectedImageIndex - images.length');
  });

  it('getMediaItemsFromImages is exported from media.ts', () => {
    const source = readSource('src/lib/media.ts');
    expect(source).toContain('export function getMediaItemsFromImages');
  });
});

describe('no remaining listing_videos references in production code', () => {
  const productionFiles = [
    'src/app/api/dealer/videos/route.ts',
    'src/app/api/dealer/videos/[id]/route.ts',
    'src/app/api/dealer/videos/webhook/route.ts',
    'src/app/api/dealer/listings/[id]/route.ts',
    'src/lib/listing/getListingDetail.ts',
  ];

  for (const file of productionFiles) {
    it(`${file} has no listing_videos or ListingVideosRow references`, () => {
      const source = readSource(file);
      expect(source).not.toContain("'listing_videos'");
      expect(source).not.toContain('ListingVideosRow');
      expect(source).not.toContain('insertListingVideo');
      expect(source).not.toContain('selectListingVideo');
      expect(source).not.toContain('updateListingVideo');
      expect(source).not.toContain('deleteListingVideo');
    });
  }
});
