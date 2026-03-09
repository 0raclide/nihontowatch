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
  it('returns only photos group for null listing', () => {
    const result = collectGroupedMedia(['a.jpg', 'b.jpg'], null, false);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
    expect(result.groups[0].images).toEqual(['a.jpg', 'b.jpg']);
    expect(result.totalCount).toBe(2);
    expect(result.allImageUrls).toEqual(['a.jpg', 'b.jpg']);
  });

  it('returns only photos group when detailLoaded=false', () => {
    const listing = makeListing({
      sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
    });
    const result = collectGroupedMedia(['a.jpg'], listing, false);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
    expect(result.allImageUrls).toEqual(['a.jpg']);
  });

  it('returns only photos group when no section data', () => {
    const listing = makeListing();
    const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true);
    expect(result.groups).toHaveLength(1);
    expect(result.totalCount).toBe(2);
  });

  it('includes sayagaki images as a separate group', () => {
    const listing = makeListing({
      sayagaki: [
        { id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg', 's2.jpg'] },
      ],
    });
    const result = collectGroupedMedia(['a.jpg'], listing, true);
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
    const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true);
    // 'a.jpg' is in primary, so sayagaki should only have 's1.jpg'
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
    const result = collectGroupedMedia(['a.jpg'], listing, true);
    // 'shared.jpg' appears in sayagaki first — hakogaki should only have 'h1.jpg'
    expect(result.groups).toHaveLength(3);
    expect(result.groups[1].labelKey).toBe('dealer.sayagaki');
    expect(result.groups[1].images).toEqual(['shared.jpg']);
    expect(result.groups[2].labelKey).toBe('dealer.hakogaki');
    expect(result.groups[2].images).toEqual(['h1.jpg']);
    expect(result.totalCount).toBe(3);
  });

  it('omits empty sections', () => {
    const listing = makeListing({
      sayagaki: [], // empty array
      hakogaki: [
        { id: '1', author: null, content: null, images: ['h1.jpg'] },
      ],
      koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: [], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
    });
    const result = collectGroupedMedia(['a.jpg'], listing, true);
    // sayagaki empty → omitted, koshirae.images empty → omitted
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
    expect(result.groups[1].labelKey).toBe('dealer.hakogaki');
  });

  it('handles all section types populated — new order: koshirae, sayagaki, hakogaki, kanto hibisho, provenance', () => {
    const listing = makeListing({
      sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
      hakogaki: [{ id: '2', author: null, content: null, images: ['h1.jpg'] }],
      koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k1.jpg'], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      provenance: [{ id: '3', owner_name: 'Tokugawa', owner_name_ja: null, notes: null, images: ['p1.jpg'] }],
      kanto_hibisho: { volume: '2', entry_number: '1110', text: null, images: ['kh1.jpg'] },
    });
    const result = collectGroupedMedia(['a.jpg'], listing, true);
    expect(result.groups).toHaveLength(6); // photos + 5 sections
    expect(result.groups.map(g => g.labelKey)).toEqual([
      'quickview.sectionPhotos',
      'dealer.koshirae',
      'dealer.sayagaki',
      'dealer.hakogaki',
      'dealer.kantoHibisho',
      'dealer.provenance',
    ]);
    expect(result.totalCount).toBe(6); // 1 photo + 5 section images
    expect(result.allImageUrls).toHaveLength(6);
  });

  it('includes video items in totalCount', () => {
    const listing = makeListing();
    const videos = [makeVideo('v1'), makeVideo('v2'), makeVideo('v3')];
    const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true, videos);
    expect(result.totalCount).toBe(5); // 2 images + 3 videos
    expect(result.allImageUrls).toHaveLength(2); // videos don't go in allImageUrls
  });

  it('handles multiple sayagaki entries with images', () => {
    const listing = makeListing({
      sayagaki: [
        { id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg', 's2.jpg'] },
        { id: '2', author: 'honma_junji', author_custom: null, content: null, images: ['s3.jpg'] },
      ],
    });
    const result = collectGroupedMedia(['a.jpg'], listing, true);
    expect(result.groups[1].images).toEqual(['s1.jpg', 's2.jpg', 's3.jpg']);
  });

  it('handles empty primary photos with section images', () => {
    const listing = makeListing({
      sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
    });
    const result = collectGroupedMedia([], listing, true);
    // Photos group always present (even if empty) + sayagaki
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
    const result = collectGroupedMedia(['a.jpg'], listing, true);
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
    const result = collectGroupedMedia(['a.jpg'], listing, true);
    expect(result.groups).toHaveLength(1);
  });

  // =========================================================================
  // Catalog image filtering + Documentation group
  // =========================================================================

  describe('catalog image filtering', () => {
    it('splits catalog images out of primary group into Documentation at end', () => {
      const catalogUrl = `https://${CATALOG_DOMAIN}oshigata_123.jpg`;
      const result = collectGroupedMedia(['a.jpg', catalogUrl, 'b.jpg'], null, false);
      // Primary group has only regular photos
      expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
      expect(result.groups[0].images).toEqual(['a.jpg', 'b.jpg']);
      // Documentation group at end
      expect(result.groups[1].labelKey).toBe('quickview.sectionDocumentation');
      expect(result.groups[1].images).toEqual([catalogUrl]);
      expect(result.totalCount).toBe(3);
      expect(result.allImageUrls).toEqual(['a.jpg', 'b.jpg', catalogUrl]);
    });

    it('no Documentation group when no catalog images', () => {
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], null, false);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
    });

    it('Documentation group appears after all sections', () => {
      const catalogUrl = `https://${CATALOG_DOMAIN}setsumei_456.jpg`;
      const listing = makeListing({
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k1.jpg'], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      });
      const result = collectGroupedMedia(['a.jpg', catalogUrl], listing, true);
      expect(result.groups.map(g => g.labelKey)).toEqual([
        'quickview.sectionPhotos',
        'dealer.koshirae',
        'quickview.sectionDocumentation',
      ]);
    });

    it('multiple catalog images grouped together', () => {
      const oshigata = `https://${CATALOG_DOMAIN}oshigata_1.jpg`;
      const setsumei = `https://${CATALOG_DOMAIN}setsumei_1.jpg`;
      const result = collectGroupedMedia(['a.jpg', oshigata, setsumei], null, false);
      expect(result.groups[1].images).toEqual([oshigata, setsumei]);
    });

    it('all catalog images → empty primary, Documentation group only', () => {
      const cat1 = `https://${CATALOG_DOMAIN}oshigata_1.jpg`;
      const cat2 = `https://${CATALOG_DOMAIN}setsumei_1.jpg`;
      const result = collectGroupedMedia([cat1, cat2], null, false);
      expect(result.groups[0].labelKey).toBe('quickview.sectionPhotos');
      expect(result.groups[0].images).toEqual([]);
      expect(result.groups[1].labelKey).toBe('quickview.sectionDocumentation');
      expect(result.groups[1].images).toEqual([cat1, cat2]);
    });

    it('catalog images in section data (koshirae) are pulled to Documentation', () => {
      const koshiraeCatalog = `https://${CATALOG_DOMAIN}59_109_setsumei.jpg`;
      const listing = makeListing({
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k_photo.jpg', koshiraeCatalog], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true);
      // Koshirae group has only the regular photo
      expect(result.groups[1].labelKey).toBe('dealer.koshirae');
      expect(result.groups[1].images).toEqual(['k_photo.jpg']);
      // Documentation group has the koshirae catalog image
      expect(result.groups[2].labelKey).toBe('quickview.sectionDocumentation');
      expect(result.groups[2].images).toEqual([koshiraeCatalog]);
    });

    it('catalog images from primary + sections all merge into Documentation', () => {
      const bladeCatalog = `https://${CATALOG_DOMAIN}32_47_oshigata.jpg`;
      const koshiraeCatalog = `https://${CATALOG_DOMAIN}59_109_setsumei.jpg`;
      const listing = makeListing({
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k_photo.jpg', koshiraeCatalog], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      });
      const result = collectGroupedMedia(['a.jpg', bladeCatalog], listing, true);
      // Primary: just regular photos
      expect(result.groups[0].images).toEqual(['a.jpg']);
      // Koshirae: just regular photos
      expect(result.groups[1].images).toEqual(['k_photo.jpg']);
      // Documentation: blade + koshirae catalog images merged
      expect(result.groups[2].labelKey).toBe('quickview.sectionDocumentation');
      expect(result.groups[2].images).toEqual([bladeCatalog, koshiraeCatalog]);
    });

    it('section with only catalog images is omitted (no empty section group)', () => {
      const koshiraeCatalog = `https://${CATALOG_DOMAIN}59_109_oshigata.jpg`;
      const listing = makeListing({
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: [koshiraeCatalog], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true);
      // Should be: photos + documentation (no empty koshirae group)
      expect(result.groups.map(g => g.labelKey)).toEqual([
        'quickview.sectionPhotos',
        'quickview.sectionDocumentation',
      ]);
    });
  });

  // =========================================================================
  // Video integration
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
      expect(result.totalCount).toBe(3); // 1 image + 2 videos
    });

    it('allImageUrls excludes videos', () => {
      const videos = [makeVideo('v1')];
      const result = collectGroupedMedia(['a.jpg'], null, false, videos);
      expect(result.allImageUrls).toEqual(['a.jpg']);
    });
  });

  // =========================================================================
  // flatItems tests
  // =========================================================================

  describe('flatItems', () => {
    it('assigns correct globalIndex across groups', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg', 's2.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true);
      expect(result.flatItems).toHaveLength(4);
      expect(result.flatItems.map(i => i.globalIndex)).toEqual([0, 1, 2, 3]);
      expect(result.flatItems.map(i => i.src)).toEqual(['a.jpg', 'b.jpg', 's1.jpg', 's2.jpg']);
    });

    it('marks isFirstInGroup correctly', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg', 's2.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true);
      expect(result.flatItems.map(i => i.isFirstInGroup)).toEqual([true, false, true, false]);
    });

    it('marks isFirstGroup correctly', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true);
      expect(result.flatItems[0].isFirstGroup).toBe(true);
      expect(result.flatItems[1].isFirstGroup).toBe(false);
    });

    it('carries correct groupLabelKey', () => {
      const listing = makeListing({
        hakogaki: [{ id: '1', author: null, content: null, images: ['h1.jpg'] }],
      });
      const result = collectGroupedMedia(['a.jpg'], listing, true);
      expect(result.flatItems[0].groupLabelKey).toBe('quickview.sectionPhotos');
      expect(result.flatItems[1].groupLabelKey).toBe('dealer.hakogaki');
    });

    it('returns empty flatItems when no images', () => {
      const result = collectGroupedMedia([], null, false);
      expect(result.flatItems).toEqual([]);
    });

    it('all image flatItems have type=image', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k1.jpg'], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
      });
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true);
      expect(result.flatItems.every(i => i.type === 'image')).toBe(true);
    });

    it('flatItems count matches allImageUrls + videoItems', () => {
      const listing = makeListing({
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
      });
      const videos = [makeVideo('v1')];
      const result = collectGroupedMedia(['a.jpg', 'b.jpg'], listing, true, videos);
      const imageItems = result.flatItems.filter(i => i.type === 'image');
      const videoFlatItems = result.flatItems.filter(i => i.type === 'video');
      expect(imageItems).toHaveLength(result.allImageUrls.length);
      expect(videoFlatItems).toHaveLength(videos.length);
    });
  });

  // =========================================================================
  // Combined scenarios
  // =========================================================================

  describe('combined: videos + catalog + sections', () => {
    it('full ordering: hero → videos → photos → koshirae → sayagaki → documentation', () => {
      const bladeCatalog = `https://${CATALOG_DOMAIN}oshigata_1.jpg`;
      const koshiraeCatalog = `https://${CATALOG_DOMAIN}59_109_setsumei.jpg`;
      const listing = makeListing({
        koshirae: { cert_type: null, cert_in_blade_paper: false, cert_session: null, description: null, images: ['k1.jpg', koshiraeCatalog], artisan_id: null, artisan_name: null, artisan_kanji: null, components: [], setsumei_text_en: null, setsumei_text_ja: null, catalog_object_uuid: null },
        sayagaki: [{ id: '1', author: 'tanobe_michihiro', author_custom: null, content: null, images: ['s1.jpg'] }],
      });
      const videos = [makeVideo('v1')];
      const result = collectGroupedMedia(['hero.jpg', bladeCatalog, 'photo2.jpg'], listing, true, videos);

      // Groups: photos (hero, photo2), koshirae (k1 only), sayagaki, documentation (blade + koshirae catalog)
      expect(result.groups.map(g => g.labelKey)).toEqual([
        'quickview.sectionPhotos',
        'dealer.koshirae',
        'dealer.sayagaki',
        'quickview.sectionDocumentation',
      ]);

      // Documentation group merges catalog images from primary + koshirae
      expect(result.groups[3].images).toEqual([bladeCatalog, koshiraeCatalog]);

      // flatItems: hero → video → photo2 → k1 → s1 → bladeCatalog → koshiraeCatalog
      expect(result.flatItems.map(i => i.type === 'video' ? `video:${i.videoId}` : i.src)).toEqual([
        'hero.jpg',
        'video:v1',
        'photo2.jpg',
        'k1.jpg',
        's1.jpg',
        bladeCatalog,
        koshiraeCatalog,
      ]);

      // totalCount includes all
      expect(result.totalCount).toBe(7); // 6 images + 1 video
    });
  });
});
