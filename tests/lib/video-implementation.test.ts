/**
 * Golden tests for video implementation contracts.
 *
 * These tests verify structural invariants that, if broken, cause silent
 * failures (missing badges, orphaned Bunny videos, N+1 queries).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf-8');
}

describe('video_count denormalization (Issue #1)', () => {
  it('browse API SELECT includes video_count as a plain column', () => {
    const source = readSource('src/app/api/browse/route.ts');
    // Must have video_count in the SELECT (plain column, not a join)
    expect(source).toContain('video_count');
  });

  it('browse API does NOT join listing_videos', () => {
    const source = readSource('src/app/api/browse/route.ts');
    // The listing_videos join was the performance problem — must stay gone
    expect(source).not.toMatch(/listing_videos\s*\(/);
  });

  it('migration 112 creates trigger on listing_videos', () => {
    const source = readSource('supabase/migrations/112_listing_video_count.sql');
    expect(source).toContain('video_count');
    expect(source).toContain('CREATE TRIGGER');
    expect(source).toContain('listing_videos');
    // Must fire on status changes (so webhook status='ready' updates count)
    expect(source).toContain('UPDATE OF status');
  });
});

describe('video_count in listing APIs (Issue #5)', () => {
  it('artisan listings API includes video_count', () => {
    const source = readSource('src/app/api/artisan/[code]/listings/route.ts');
    expect(source).toContain('video_count');
  });

  it('favorites API includes video_count', () => {
    const source = readSource('src/app/api/favorites/route.ts');
    expect(source).toContain('video_count');
  });
});

describe('Bunny cleanup on listing delete (Issue #3)', () => {
  it('dealer listing DELETE handler imports videoProvider', () => {
    const source = readSource('src/app/api/dealer/listings/[id]/route.ts');
    expect(source).toContain("import { videoProvider, isVideoProviderConfigured }");
  });

  it('dealer listing DELETE handler calls deleteVideo before listing delete', () => {
    const source = readSource('src/app/api/dealer/listings/[id]/route.ts');
    // Must query listing_videos BEFORE deleting the listing
    const videoQueryIdx = source.indexOf('selectListingVideos');
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

describe('as any elimination (Issue #4)', () => {
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
  }

  it('typed helpers exist in listingVideos.ts', () => {
    const source = readSource('src/lib/supabase/listingVideos.ts');
    expect(source).toContain('insertListingVideo');
    expect(source).toContain('selectListingVideos');
    expect(source).toContain('updateListingVideo');
    expect(source).toContain('deleteListingVideo');
    expect(source).toContain('ListingVideosRow');
  });
});

describe('unified gallery (Issue #2)', () => {
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
