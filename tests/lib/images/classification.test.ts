/**
 * Tests for image classification and hero image resolution utilities.
 */
import { describe, it, expect } from 'vitest';
import {
  isYuhinkaiCatalogImage,
  classifyCatalogImage,
  getHeroImage,
  getHeroImageIndex,
  getKoshiraeHeroImage,
  YUHINKAI_CATALOG_DOMAIN,
} from '@/lib/images/classification';
import type { KoshiraeData } from '@/types';

// =============================================================================
// isYuhinkaiCatalogImage
// =============================================================================

describe('isYuhinkaiCatalogImage', () => {
  it('returns true for Yuhinkai catalog URL', () => {
    expect(isYuhinkaiCatalogImage(
      `https://${YUHINKAI_CATALOG_DOMAIN}/storage/v1/object/public/images/oshigata/abc.jpg`
    )).toBe(true);
  });

  it('returns true for setsumei image', () => {
    expect(isYuhinkaiCatalogImage(
      `https://${YUHINKAI_CATALOG_DOMAIN}/storage/v1/object/public/images/setsumei/def.png`
    )).toBe(true);
  });

  it('returns false for dealer image URL', () => {
    expect(isYuhinkaiCatalogImage('https://aoi-art.com/images/sword.jpg')).toBe(false);
  });

  it('returns false for NihontoWatch Supabase storage URL', () => {
    expect(isYuhinkaiCatalogImage(
      'https://abc123.supabase.co/storage/v1/object/public/listing-images/aoi-art/L001/00.jpg'
    )).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isYuhinkaiCatalogImage('')).toBe(false);
  });

  it('returns false for Yuhinkai domain in dealer-images bucket', () => {
    // The check is specifically for the /images/ bucket path
    expect(isYuhinkaiCatalogImage(
      `https://${YUHINKAI_CATALOG_DOMAIN}/storage/v1/object/public/dealer-images/logo.png`
    )).toBe(false);
  });
});

// =============================================================================
// classifyCatalogImage
// =============================================================================

describe('classifyCatalogImage', () => {
  const base = `https://${YUHINKAI_CATALOG_DOMAIN}/storage/v1/object/public/images`;

  it('classifies _oshigata. images', () => {
    expect(classifyCatalogImage(`${base}/juyo/vol40/item5_oshigata.jpg`)).toBe('oshigata');
  });

  it('classifies _setsumei. images', () => {
    expect(classifyCatalogImage(`${base}/juyo/vol40/item5_setsumei.jpg`)).toBe('setsumei');
  });

  it('classifies _combined. images', () => {
    expect(classifyCatalogImage(`${base}/jubun/vol3/item1_combined.png`)).toBe('combined');
  });

  it('defaults to oshigata for unclassified Yuhinkai images', () => {
    expect(classifyCatalogImage(`${base}/juyo/vol40/item5.jpg`)).toBe('oshigata');
  });

  it('returns null for non-catalog URLs', () => {
    expect(classifyCatalogImage('https://dealer.com/photo.jpg')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(classifyCatalogImage('')).toBeNull();
  });
});

// =============================================================================
// getHeroImage
// =============================================================================

describe('getHeroImage', () => {
  it('returns images[0] when hero_image_index is null', () => {
    const listing = {
      images: ['img0.jpg', 'img1.jpg', 'img2.jpg'],
      hero_image_index: null,
    };
    expect(getHeroImage(listing)).toBe('img0.jpg');
  });

  it('returns images[0] when hero_image_index is undefined', () => {
    const listing = {
      images: ['img0.jpg', 'img1.jpg'],
    };
    expect(getHeroImage(listing)).toBe('img0.jpg');
  });

  it('returns the selected hero image when index is valid', () => {
    const listing = {
      images: ['img0.jpg', 'img1.jpg', 'img2.jpg'],
      hero_image_index: 2,
    };
    expect(getHeroImage(listing)).toBe('img2.jpg');
  });

  it('falls back to index 0 when hero_image_index is out of bounds', () => {
    const listing = {
      images: ['img0.jpg', 'img1.jpg'],
      hero_image_index: 5,
    };
    expect(getHeroImage(listing)).toBe('img0.jpg');
  });

  it('falls back to index 0 when hero_image_index is negative', () => {
    const listing = {
      images: ['img0.jpg', 'img1.jpg'],
      hero_image_index: -1,
    };
    expect(getHeroImage(listing)).toBe('img0.jpg');
  });

  it('returns null when no images', () => {
    expect(getHeroImage({ images: [] })).toBeNull();
    expect(getHeroImage({ images: null })).toBeNull();
  });

  it('returns null for null listing', () => {
    expect(getHeroImage(null as any)).toBeNull();
  });

  it('prefers stored_images over original images (via getAllImages)', () => {
    const listing = {
      images: ['original0.jpg', 'original1.jpg'],
      stored_images: ['stored/00.jpg'],
      hero_image_index: 0,
    };
    // getAllImages merges stored and originals — stored[0] takes priority
    const result = getHeroImage(listing);
    expect(result).toBe('stored/00.jpg');
  });
});

// =============================================================================
// getHeroImageIndex
// =============================================================================

describe('getHeroImageIndex', () => {
  it('returns 0 when hero_image_index is null', () => {
    expect(getHeroImageIndex({ images: ['a.jpg'], hero_image_index: null })).toBe(0);
  });

  it('returns the explicit index when valid', () => {
    expect(getHeroImageIndex({ images: ['a.jpg', 'b.jpg'], hero_image_index: 1 })).toBe(1);
  });

  it('returns 0 when index out of bounds', () => {
    expect(getHeroImageIndex({ images: ['a.jpg'], hero_image_index: 5 })).toBe(0);
  });

  it('returns 0 for empty images', () => {
    expect(getHeroImageIndex({ images: [], hero_image_index: 0 })).toBe(0);
  });
});

// =============================================================================
// getKoshiraeHeroImage
// =============================================================================

describe('getKoshiraeHeroImage', () => {
  const baseKoshirae: KoshiraeData = {
    cert_type: null,
    cert_in_blade_paper: false,
    cert_session: null,
    description: null,
    images: [],
    artisan_id: null,
    artisan_name: null,
    artisan_kanji: null,
    components: [],
    setsumei_text_en: null,
    setsumei_text_ja: null,
    catalog_object_uuid: null,
  };

  it('returns images[0] when hero_image_index is null', () => {
    const k = { ...baseKoshirae, images: ['k0.jpg', 'k1.jpg'], hero_image_index: null };
    expect(getKoshiraeHeroImage(k)).toBe('k0.jpg');
  });

  it('returns images[0] when hero_image_index is undefined', () => {
    const k = { ...baseKoshirae, images: ['k0.jpg', 'k1.jpg'] };
    expect(getKoshiraeHeroImage(k)).toBe('k0.jpg');
  });

  it('returns the selected hero image when index is valid', () => {
    const k = { ...baseKoshirae, images: ['k0.jpg', 'k1.jpg', 'k2.jpg'], hero_image_index: 2 };
    expect(getKoshiraeHeroImage(k)).toBe('k2.jpg');
  });

  it('falls back to index 0 when hero_image_index is out of bounds', () => {
    const k = { ...baseKoshirae, images: ['k0.jpg'], hero_image_index: 5 };
    expect(getKoshiraeHeroImage(k)).toBe('k0.jpg');
  });

  it('returns null when no images', () => {
    const k = { ...baseKoshirae, images: [] };
    expect(getKoshiraeHeroImage(k)).toBeNull();
  });

  it('falls back to index 0 when hero_image_index is negative', () => {
    const k = { ...baseKoshirae, images: ['k0.jpg'], hero_image_index: -1 };
    expect(getKoshiraeHeroImage(k)).toBe('k0.jpg');
  });
});
