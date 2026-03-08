/**
 * Image classification and hero image resolution utilities.
 *
 * Centralizes the Yuhinkai catalog domain check (previously duplicated in 4 files),
 * classifies catalog images by type (oshigata vs setsumei), and resolves
 * hero images from listings and koshirae data.
 */

import { getAllImages, type ImageSource } from '@/lib/images';
import type { KoshiraeData } from '@/types';

// =============================================================================
// YUHINKAI CATALOG DOMAIN (single source of truth)
// =============================================================================

/**
 * Yuhinkai catalog image storage path.
 * This identifies images from the Yuhinkai Supabase `images` bucket
 * (oshigata, setsumei page scans). Does NOT match dealer-uploaded photos
 * in `dealer-images` or `listing-images` buckets.
 *
 * Previously duplicated in:
 * - ShowcaseDocumentation.tsx
 * - ShowcaseImageGallery.tsx
 * - DealerListingForm.tsx
 * - KoshiraeSection.tsx
 */
export const YUHINKAI_CATALOG_DOMAIN = 'itbhfhyptogxcjbjfzwx.supabase.co';
const YUHINKAI_CATALOG_PATH = `${YUHINKAI_CATALOG_DOMAIN}/storage/v1/object/public/images/`;

/**
 * Check if a URL points to a Yuhinkai catalog image.
 */
export function isYuhinkaiCatalogImage(url: string): boolean {
  return url.includes(YUHINKAI_CATALOG_PATH);
}

// =============================================================================
// CATALOG IMAGE CLASSIFICATION
// =============================================================================

export type CatalogImageType = 'oshigata' | 'setsumei' | 'combined';

/**
 * Classify a Yuhinkai catalog image by its filename pattern.
 *
 * - `_oshigata.` → blade rubbing diagrams
 * - `_setsumei.` → NBTHK setsumei page scans
 * - `_combined.` → JuBun combined format (oshigata + setsumei on one page)
 * - not a Yuhinkai URL → null
 */
export function classifyCatalogImage(url: string): CatalogImageType | null {
  if (!isYuhinkaiCatalogImage(url)) return null;

  if (url.includes('_oshigata.')) return 'oshigata';
  if (url.includes('_setsumei.')) return 'setsumei';
  if (url.includes('_combined.')) return 'combined';

  // Default: unclassified Yuhinkai image — treat as oshigata (legacy behavior)
  return 'oshigata';
}

// =============================================================================
// HERO IMAGE RESOLUTION
// =============================================================================

/**
 * Resolve the hero (cover) image for a listing.
 *
 * If `hero_image_index` is set and valid, returns that image.
 * Otherwise falls back to index 0 (current default behavior).
 */
export function getHeroImage(
  listing: ImageSource & { hero_image_index?: number | null }
): string | null {
  const allImages = getAllImages(listing);
  if (allImages.length === 0) return null;

  const idx = listing.hero_image_index;
  if (typeof idx === 'number' && idx >= 0 && idx < allImages.length) {
    return allImages[idx];
  }

  return allImages[0];
}

/**
 * Resolve the hero image index for a listing (0-based into getAllImages result).
 * Returns the explicit index if valid, otherwise 0.
 */
export function getHeroImageIndex(
  listing: ImageSource & { hero_image_index?: number | null }
): number {
  const allImages = getAllImages(listing);
  const idx = listing.hero_image_index;
  if (typeof idx === 'number' && idx >= 0 && idx < allImages.length) {
    return idx;
  }
  return 0;
}

/**
 * Resolve the hero image for koshirae data.
 *
 * If `hero_image_index` is set and valid, returns that image.
 * Otherwise falls back to index 0.
 */
export function getKoshiraeHeroImage(koshirae: KoshiraeData): string | null {
  const images = koshirae.images || [];
  if (images.length === 0) return null;

  const idx = koshirae.hero_image_index;
  if (typeof idx === 'number' && idx >= 0 && idx < images.length) {
    return images[idx];
  }

  return images[0];
}
