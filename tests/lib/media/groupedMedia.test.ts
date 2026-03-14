import { describe, it, expect } from 'vitest';
import { collectGroupedMedia } from '@/lib/media/groupedMedia';
import type { VideoMediaItem } from '@/lib/media/groupedMedia';
import type { Listing } from '@/types';

// Yuhinkai catalog domain for test URLs
const CATALOG_DOMAIN = 'itbhfhyptogxcjbjfzwx.supabase.co/storage/v1/object/public/images/';

// Minimal listing factory
function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 1,
    url: 'https://example.com/1',
    dealer_id: 1,
    status: 'available',
    is_available: true,
    is_sold: false,
    page_exists: true,
    title: 'Test Katana',
    item_type: 'katana',
    price_currency: 'JPY',
    images: [],
    first_seen_at: '2026-01-01',
    last_scraped_at: '2026-01-01',
    scrape_count: 1,
    ...overrides,
  } as Listing;
}

function makeVideo(id: string): VideoMediaItem {
  return {
    streamUrl: `https://cdn.example.com/video/${id}/playlist.m3u8`,
    thumbnailUrl: `https://cdn.example.com/video/${id}/thumb.jpg`,
    duration: 30,
    status: 'ready',
    videoId: id,
  };
}

describe('collectGroupedMedia', () => {
  // =========================================================================
  // Browse (isDealerSource=false) — flat image list, no grouping
  // =========================================================================

  describe('browse listings (isDealerSource=false)', () => {
    it('returns flat photos group for null listing', () => {
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], null, false);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
      expect(result.groups[0].images).toEqual(['a.jpg', 'b.jpg']);
      expect(result.totalCount).toBe(2);
      expect(result.allImageUrls).toEqual(['a.jpg', 'b.jpg']);
    });

    it('does NOT add section groups even when detailLoaded=true', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k1.jpg'], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true);
      // Only primary group — no sections for browse
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
      expect(result.totalCount).toBe(1);
    });

    it('keeps catalog images in primary group (no filtering)', () => {
      const cat1 = `https://${CATALOG_DOMAIN}32_47_oshigata.jpg`;
      const cat2 = `https://${CATALOG_DOMAIN}32_47_setsumei.jpg`;
      const result = collectGroupedMedia(['a.jpg', cat1, cat2], null, false);
      // All images stay in primary — no Documentation group
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].images).toEqual(['a.jpg', cat1, cat2]);
      expect(result.totalCount).toBe(3);
    });

    it('includes videos in totalCount', () => {
      const videos = [makeVideo('v1'), makeVideo('v2')];
      const result = collectGroupedMedia(['a.jpg'], null, false, videos);
      expect(result.totalCount).toBe(3); // 1 image + 2 videos
      expect(result.allImageUrls).toEqual(['a.jpg']);
    });

    it('returns empty flatItems when no images', () => {
      const result = collectGroupedMedia([], null, false);
      expect(result.flatItems).toEqual([]);
    });
  });

  // =========================================================================
  // Dealer listings (isDealerSource=true) — section grouping, no catalog filter
  // =========================================================================

  describe('dealer listings (isDealerSource=true)', () => {
    it('returns only photos group when detailLoaded=false', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg'], listing, false, [], true);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
      expect(result.allImageUrls).toEqual(['a.jpg']);
    });

    it('returns only photos group when no section data', () => {
      const listing = makeListing();
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true, [], true);
      expect(result.groups).toHaveLength(1);
      expect(result.totalCount).toBe(2);
    });

    it('includes sayagaki images as a separate group', () => {
      const listing = makeListing({
        sayagaki: [
          { id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg', 's2.jpg'] },
        ],
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true, [], true);
      expect(result.groups).toHaveLength(2);
      expect(result.groups[1].labelKey).toBe('dealer.sayagaki');
      expect(result.groups[1].images).toEqual(['s1.jpg', 's2.jpg']);
      expect(result.totalCount).toBe(3);
      expect(result.allImageUrls).toEqual(['a.jpg', 's1.jpg', 's2.jpg']);
    });

    it('deduplicates section images that are in primary photos', () => {
      const listing = makeListing({
        sayagaki: [
          { id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['a.jpg', 's1.jpg'] },
        ],
      });
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true, [], true);
      expect(result.groups).toHaveLength(2);
      expect(result.groups[1].images).toEqual(['s1.jpg']);
      expect(result.totalCount).toBe(3);
    });

    it('deduplicates across sections (cross-section dedup)', () => {
      const listing = makeListing({
        sayagaki: [
          { id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['shared.jpg'] },
        ],
        hakogaki: [
          { id: '2', author: null, content: null, images: ['shared.jpg', 'h1.jpg'] },
        ],
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true, [], true);
      expect(result.groups).toHaveLength(3);
      expect(result.groups[1].labelKey).toBe('dealer.sayagaki');
      expect(result.groups[1].images).toEqual(['shared.jpg']);
      expect(result.groups[2].labelKey).toBe('dealer.hakogaki');
      expect(result.groups[2].images).toEqual(['h1.jpg']);
      expect(result.totalCount).toBe(3);
    });

    it('omits empty sections', () => {
      const listing = makeListing({
        sayagaki: [],
        hakogaki: [
          { id: '1', author: null, content: null, images: ['h1.jpg'] },
        ],
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: [], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true, [], true);
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
      expect(result.groups[1].labelKey).toBe('dealer.hakogaki');
    });

    it('handles all section types — order: koshirae, sayagaki, hakogaki, kanto hibisho, provenance', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
        hakogaki: [{ id: '2', author: null, content: null, images: ['h1.jpg'] }],
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k1.jpg'], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
        provenance: { entries: [{ id: '3', owner_name: 'Tokugawa', owner_name_ja: null, notes: null, portrait_image: null }], documents: ['p1.jpg'] },
        kanto_hibisho: { volume: '2', entry_number: '1110', text: null, images: ['kh1.jpg'] },
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true, [], true);
      expect(result.groups).toHaveLength(6);
      expect(result.groups.map(g => g.labelKey)).toEqual([
        'quickview.sectionPhotos',
        'dealer.koshirae',
        'dealer.sayagaki',
        'dealer.hakogaki',
        'dealer.kantoHibisho',
        'dealer.provenance',
      ]);
      expect(result.totalCount).toBe(6);
    });

    it('handles multiple sayagaki entries with images', () => {
      const listing = makeListing({
        sayagaki: [
          { id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg', 's2.jpg'] },
          { id: '2', author: 'honma_junji', author_custom: null, content: null, images: ['s3.jpg'] },
        ],
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true, [], true);
      expect(result.groups[1].images).toEqual(['s1.jpg', 's2.jpg', 's3.jpg']);
    });

    it('handles empty primary photos with section images', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
      });
      const result = collectGroupedMedia([], listing, true, [], true);
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].images).toEqual([]);
      expect(result.groups[1].images).toEqual(['s1.jpg']);
      expect(result.totalCount).toBe(1);
    });

    it('filters out falsy URLs from section images', () => {
      const listing = makeListing({
        sayagaki: [
          { id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['', 's1.jpg', ''] },
        ],
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true, [], true);
      expect(result.groups[1].images).toEqual(['s1.jpg']);
    });

    it('handles null section fields gracefully', () => {
      const listing = makeListing({
        sayagaki: null,
        hakogaki: null,
        koshirae: null,
        provenance: null,
        kanto_hibisho: null,
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true, [], true);
      expect(result.groups).toHaveLength(1);
    });

    it('keeps catalog images in primary group (no filtering)', () => {
      const cat1 = `https://${CATALOG_DOMAIN}32_47_oshigata.jpg`;
      const cat2 = `https://${CATALOG_DOMAIN}32_47_setsumei.jpg`;
      const result = collectGroupedMedia(['a.jpg', cat1, cat2], null, false, [], true);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].images).toEqual(['a.jpg', cat1, cat2]);
      expect(result.totalCount).toBe(3);
    });

    it('keeps catalog images in section groups (no filtering)', () => {
      const koshiraeCatalog = `https://${CATALOG_DOMAIN}59_109_setsumei.jpg`;
      const listing = makeListing({
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k_photo.jpg', koshiraeCatalog], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true, [], true);
      expect(result.groups[1].labelKey).toBe('dealer.koshirae');
      expect(result.groups[1].images).toEqual(['k_photo.jpg', koshiraeCatalog]);
      expect(result.groups.map(g => g.labelKey)).not.toContain('quickview.sectionDocumentation');
    });
  });

  // =========================================================================
  // Video integration (works for both browse and dealer)
  // =========================================================================

  describe('video items', () => {
    it('video items appear in flatItems with type=video', () => {
      const videos = [makeVideo('v1')];
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], null, false, videos);
      const videoItems = result.flatItems.filter(i => i.type === 'video');
      expect(videoItems).toHaveLength(1);
      expect(videoItems[0].streamUrl).toBe('https://cdn.example.com/video/v1/playlist.m3u8');
      expect(videoItems[0].thumbnailUrl).toBe('https://cdn.example.com/video/v1/thumb.jpg');
      expect(videoItems[0].duration).toBe(30);
      expect(videoItems[0].videoStatus).toBe('ready');
      expect(videoItems[0].videoId).toBe('v1');
    });

    it('videos appear after hero image, before remaining photos', () => {
      const videos = [makeVideo('v1')];
      const result = collectGroupedMedia(['hero.jpg', 'photo2.jpg', 'photo3.jpg'], null, false, videos);
      expect(result.flatItems.map(i => i.type === 'video' ? `video:${i.videoId}` : i.src)).toEqual([
        'hero.jpg',
        'video:v1',
        'photo2.jpg',
        'photo3.jpg',
      ]);
    });

    it('multiple videos all appear after hero', () => {
      const videos = [makeVideo('v1'), makeVideo('v2')];
      const result = collectGroupedMedia(['hero.jpg', 'photo2.jpg'], null, false, videos);
      expect(result.flatItems.map(i => i.type === 'video' ? `video:${i.videoId}` : i.src)).toEqual([
        'hero.jpg',
        'video:v1',
        'video:v2',
        'photo2.jpg',
      ]);
    });

    it('videos with no photos — videos are the only primary content', () => {
      const videos = [makeVideo('v1')];
      const result = collectGroupedMedia([], null, false, videos);
      expect(result.flatItems).toHaveLength(1);
      expect(result.flatItems[0].type).toBe('video');
      expect(result.flatItems[0].isFirstGroup).toBe(true);
    });

    it('video globalIndex is contiguous with surrounding images', () => {
      const videos = [makeVideo('v1')];
      const result = collectGroupedMedia(['hero.jpg', 'photo2.jpg'], null, false, videos);
      expect(result.flatItems.map(i => i.globalIndex)).toEqual([0, 1, 2]);
    });

    it('video items are in the primary group (isFirstGroup=true)', () => {
      const videos = [makeVideo('v1')];
      const result = collectGroupedMedia(['hero.jpg'], null, false, videos);
      expect(result.flatItems.every(i => i.isFirstGroup)).toBe(true);
    });

    it('totalCount includes both images and videos', () => {
      const videos = [makeVideo('v1'), makeVideo('v2')];
      const result = collectGroupedMedia(['a.jpg'], null, false, videos);
      expect(result.totalCount).toBe(3);
    });

    it('allImageUrls excludes videos', () => {
      const videos = [makeVideo('v1')];
      const result = collectGroupedMedia(['a.jpg'], null, false, videos);
      expect(result.allImageUrls).toEqual(['a.jpg']);
    });
  });

  // =========================================================================
  // flatItems (dealer mode — with sections)
  // =========================================================================

  describe('flatItems', () => {
    it('assigns correct globalIndex across groups', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg', 's2.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true, [], true);
      expect(result.flatItems).toHaveLength(4);
      expect(result.flatItems.map(i => i.globalIndex)).toEqual([0, 1, 2, 3]);
      expect(result.flatItems.map(i => i.src)).toEqual(['a.jpg', 'b.jpg', 's1.jpg', 's2.jpg']);
    });

    it('marks isFirstInGroup correctly', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg', 's2.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true, [], true);
      expect(result.flatItems.map(i => i.isFirstInGroup)).toEqual([true, false, true, false]);
    });

    it('marks isFirstGroup correctly', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true, [], true);
      expect(result.flatItems[0].isFirstGroup).toBe(true);
      expect(result.flatItems[1].isFirstGroup).toBe(false);
    });

    it('carries correct groupLabelKey', () => {
      const listing = makeListing({
        hakogaki: [{ id: '1', author: null, content: null, images: ['h1.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true, [], true);
      expect(result.flatItems[0].groupLabelKey).toBe('quickview.sectionPhotos');
      expect(result.flatItems[1].groupLabelKey).toBe('dealer.hakogaki');
    });

    it('all image flatItems have type=image', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k1.jpg'], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      });
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true, [], true);
      expect(result.flatItems.every(i => i.type === 'image')).toBe(true);
    });

    it('flatItems count matches allImageUrls + videoItems', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
      });
      const videos = [makeVideo('v1')];
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true, videos, true);
      const imageItems = result.flatItems.filter(i => i.type === 'image');
      const videoFlatItems = result.flatItems.filter(i => i.type === 'video');
      expect(imageItems).toHaveLength(result.allImageUrls.length);
      expect(videoFlatItems).toHaveLength(videos.length);
    });
  });

  // =========================================================================
  // Combined: dealer with videos + sections
  // =========================================================================

  describe('combined: dealer with videos + sections', () => {
    it('full ordering: hero → videos → photos → koshirae → sayagaki', () => {
      const listing = makeListing({
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k1.jpg'], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
      });
      const videos = [makeVideo('v1')];
      const result = collectGroupedMedia(['hero.jpg', 'photo2.jpg'], listing, true, videos, true);

      // Groups: photos, koshirae, sayagaki (no documentation — no catalog filtering)
      expect(result.groups.map(g => g.labelKey)).toEqual([
        'quickview.sectionPhotos',
        'dealer.koshirae',
        'dealer.sayagaki',
      ]);

      // flatItems: hero → video → photo2 → k1 → s1
      expect(result.flatItems.map(i => i.type === 'video' ? `video:${i.videoId}` : i.src)).toEqual([
        'hero.jpg',
        'video:v1',
        'photo2.jpg',
        'k1.jpg',
        's1.jpg',
      ]);

      expect(result.totalCount).toBe(5); // 4 images + 1 video
    });

    it('catalog images stay in-place for dealer (no filtering)', () => {
      const catalogUrl = `https://${CATALOG_DOMAIN}oshigata_1.jpg`;
      const listing = makeListing({
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k1.jpg'], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      });
      const result = collectGroupedMedia(['hero.jpg', catalogUrl, 'photo2.jpg'], listing, true, [], true);

      // Catalog image stays in primary group
      expect(result.groups[0].images).toEqual(['hero.jpg', catalogUrl, 'photo2.jpg']);
      // No Documentation group
      expect(result.groups.map(g => g.labelKey)).not.toContain('quickview.sectionDocumentation');
    });
  });
});
