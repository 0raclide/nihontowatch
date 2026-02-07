/**
 * Image URL resolution utilities with smart fallback and quality validation.
 *
 * Provides a centralized way to get image URLs from listings, with automatic
 * fallback from Supabase-stored images to original dealer URLs.
 *
 * Priority order:
 * 1. stored_images[index] - Supabase Storage (fast, reliable)
 * 2. images[index] - Original dealer URL (fallback)
 * 3. null - No image available
 *
 * Image Quality Validation:
 * The scraper sometimes captures UI icons, buttons, and navigation elements
 * alongside actual product images. Use `isValidItemImage()` to filter these
 * out after loading images and checking their natural dimensions.
 */

import { IMAGE_QUALITY, DEALERS_WITHOUT_IMAGES } from './constants';

// =============================================================================
// DIMENSION CACHE
// =============================================================================

/**
 * Cached image dimensions for layout stability.
 * Populated during preload, used to set correct aspect ratio before image loads.
 */
export interface ImageDimensionsCache {
  width: number;
  height: number;
  aspectRatio: number;
}

const dimensionCache = new Map<string, ImageDimensionsCache>();

/**
 * Get cached dimensions for an image URL.
 */
export function getCachedDimensions(url: string): ImageDimensionsCache | undefined {
  return dimensionCache.get(url);
}

/**
 * Cache dimensions for an image URL.
 */
export function setCachedDimensions(url: string, width: number, height: number): void {
  dimensionCache.set(url, {
    width,
    height,
    aspectRatio: width / height,
  });
}

/**
 * Clear the dimension cache (mainly for testing).
 */
export function clearDimensionCache(): void {
  dimensionCache.clear();
}

// =============================================================================
// VALIDATION CACHE
// =============================================================================

/**
 * Global cache for image validation results.
 * Prevents double-loading images for dimension checks.
 *
 * Key: image URL
 * Value: 'valid' | 'invalid' | Promise (pending validation)
 */
const validationCache = new Map<string, 'valid' | 'invalid' | Promise<'valid' | 'invalid'>>();

/**
 * Check if an image URL has a cached validation result.
 * Returns the result if available, or undefined if not cached.
 */
export function getCachedValidation(url: string): 'valid' | 'invalid' | undefined {
  const cached = validationCache.get(url);
  if (cached === 'valid' || cached === 'invalid') {
    return cached;
  }
  return undefined;
}

/**
 * Get pending validation promise if one exists.
 */
export function getPendingValidation(url: string): Promise<'valid' | 'invalid'> | undefined {
  const cached = validationCache.get(url);
  if (cached instanceof Promise) {
    return cached;
  }
  return undefined;
}

/**
 * Cache a validation result for an image URL.
 */
export function setCachedValidation(url: string, result: 'valid' | 'invalid'): void {
  validationCache.set(url, result);
}

/**
 * Set a pending validation promise for an image URL.
 * Returns the promise for chaining.
 */
export function setPendingValidation(url: string, promise: Promise<'valid' | 'invalid'>): Promise<'valid' | 'invalid'> {
  validationCache.set(url, promise);
  return promise;
}

/**
 * Clear the validation cache (mainly for testing).
 */
export function clearValidationCache(): void {
  validationCache.clear();
}

/**
 * Get the current size of the validation cache (for debugging).
 */
export function getValidationCacheSize(): number {
  return validationCache.size;
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Minimal interface for image source fields.
 * Works with any object that has these optional fields.
 */
export interface ImageSource {
  stored_images?: string[] | null;
  images?: string[] | null;
}

/**
 * File extensions that browsers cannot display natively.
 * These are filtered out from image arrays.
 */
const UNSUPPORTED_EXTENSIONS = ['.tif', '.tiff', '.bmp', '.psd', '.raw', '.cr2', '.nef'];

/**
 * Extract the original image index from a stored image URL.
 *
 * Stored images follow the pattern: {dealer-slug}/L{listing_id}/{index}.{ext}
 * Example: aoi-art/L00204/00.jpg → 0
 *          aoi-art/L00204/05.webp → 5
 *
 * @param url - The stored image URL
 * @returns The index number, or null if not parseable
 */
function extractStoredImageIndex(url: string): number | null {
  // Match pattern: /00.jpg, /05.webp, etc. at end of URL path
  // Must be exactly 2 digits before the extension
  const match = url.match(/\/(\d{2})\.[a-z]+$/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Check if an image URL has a supported file format.
 * Filters out formats like .tif that browsers cannot display.
 */
function isSupportedImageFormat(url: string): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return !UNSUPPORTED_EXTENSIONS.some(ext => lowerUrl.endsWith(ext));
}

/**
 * Dimensions of an image for validation purposes.
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Result of image validation with reason for rejection.
 */
export interface ImageValidationResult {
  isValid: boolean;
  reason?: 'too_narrow' | 'too_short' | 'too_small_area' | 'aspect_ratio';
}

/**
 * Validate whether an image has acceptable dimensions for display as a product image.
 *
 * This filters out:
 * - Tiny icons (< 100px in either dimension)
 * - Navigation buttons scraped from dealer pages
 * - Extreme aspect ratio images (banners, ribbons)
 * - Very small area images that somehow pass individual dimension checks
 *
 * @param dimensions - The natural width and height of the image
 * @returns Validation result with reason if invalid
 *
 * @example
 * const img = new Image();
 * img.onload = () => {
 *   const result = isValidItemImage({ width: img.naturalWidth, height: img.naturalHeight });
 *   if (!result.isValid) console.log('Filtered:', result.reason);
 * };
 */
export function isValidItemImage(dimensions: ImageDimensions): ImageValidationResult {
  const { width, height } = dimensions;

  // Check minimum width
  if (width < IMAGE_QUALITY.MIN_WIDTH) {
    return { isValid: false, reason: 'too_narrow' };
  }

  // Check minimum height
  if (height < IMAGE_QUALITY.MIN_HEIGHT) {
    return { isValid: false, reason: 'too_short' };
  }

  // Check minimum area (catches long thin images that pass individual checks)
  const area = width * height;
  if (area < IMAGE_QUALITY.MIN_AREA) {
    return { isValid: false, reason: 'too_small_area' };
  }

  // Check aspect ratio (catches extreme banners/ribbons)
  const aspectRatio = width / height;
  if (aspectRatio < IMAGE_QUALITY.MIN_ASPECT_RATIO || aspectRatio > IMAGE_QUALITY.MAX_ASPECT_RATIO) {
    return { isValid: false, reason: 'aspect_ratio' };
  }

  return { isValid: true };
}

/**
 * Get a single image URL with fallback logic.
 *
 * Uses getAllImages() to get the combined list and returns the requested index.
 * This ensures consistent behavior with filtering and deduplication.
 *
 * @param listing - Object with stored_images and/or images arrays
 * @param index - Which image to get (default: 0 for first/cover image)
 * @returns Image URL or null if none available
 *
 * @example
 * const coverUrl = getImageUrl(listing); // First image
 * const secondUrl = getImageUrl(listing, 1); // Second image
 */
export function getImageUrl(
  listing: ImageSource | null | undefined,
  index: number = 0
): string | null {
  if (!listing) return null;

  const allImages = getAllImages(listing);
  return allImages[index] || null;
}

/**
 * Get all available images, merging stored and original images by index.
 *
 * Strategy:
 * Stored images are CDN copies of original images, named by their original index:
 * - stored `00.jpg` is a copy of `images[0]`
 * - stored `05.jpg` is a copy of `images[5]`
 *
 * For each image position, we show either the stored version (preferred) or
 * the original - never both. This eliminates duplicates while preserving all
 * unique photos.
 *
 * Algorithm:
 * 1. Build a map of stored images by their original index
 * 2. For each position (0 to max index), prefer stored version if available
 * 3. Filter out unsupported formats (e.g., .tif files)
 * 4. Deduplicate any remaining duplicates by URL
 *
 * @param listing - Object with stored_images and/or images arrays
 * @returns Array of all available image URLs (merged, supported formats only)
 *
 * @example
 * // stored_images: ['supabase/01.jpg', 'supabase/02.jpg']
 * // images: ['dealer/img0.jpg', 'dealer/img1.jpg', 'dealer/img2.jpg']
 * // Returns: ['dealer/img0.jpg', 'supabase/01.jpg', 'supabase/02.jpg']
 * // (img0 has no stored version, img1 and img2 use stored versions)
 */
export function getAllImages(listing: ImageSource | null | undefined): string[] {
  if (!listing) return [];

  const stored = listing.stored_images || [];
  const original = listing.images || [];

  // If no stored images, just return originals (with filtering)
  if (stored.length === 0) {
    return original.filter(url => url && isSupportedImageFormat(url));
  }

  // If no originals, just return stored (with filtering)
  if (original.length === 0) {
    return stored.filter(url => url && isSupportedImageFormat(url));
  }

  // Build a map of stored images by their original index
  const storedByIndex = new Map<number, string>();
  for (const url of stored) {
    if (!url || !isSupportedImageFormat(url)) continue;
    const index = extractStoredImageIndex(url);
    if (index !== null) {
      storedByIndex.set(index, url);
    }
  }

  // If we couldn't parse any stored image indices, fall back to old behavior
  // (show all stored + all original, deduplicated by URL)
  if (storedByIndex.size === 0) {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const url of [...stored, ...original]) {
      if (url && !seen.has(url) && isSupportedImageFormat(url)) {
        seen.add(url);
        result.push(url);
      }
    }
    return result;
  }

  // Merge by index: for each position, prefer stored version if available
  const result: string[] = [];
  const seen = new Set<string>();

  // Find the maximum index we need to cover
  const maxStoredIndex = Math.max(...storedByIndex.keys());
  const maxIndex = Math.max(maxStoredIndex, original.length - 1);

  for (let i = 0; i <= maxIndex; i++) {
    let url: string | undefined;

    // Prefer stored version if available for this index
    if (storedByIndex.has(i)) {
      url = storedByIndex.get(i);
    } else if (i < original.length && original[i]) {
      url = original[i];
    }

    // Add to result if valid and not already seen
    if (url && !seen.has(url) && isSupportedImageFormat(url)) {
      seen.add(url);
      result.push(url);
    }
  }

  return result;
}

/**
 * Check if listing has any stored (Supabase) images.
 *
 * @param listing - Object with stored_images field
 * @returns True if stored_images array has at least one image
 */
export function hasStoredImages(listing: ImageSource | null | undefined): boolean {
  return (listing?.stored_images?.length || 0) > 0;
}

/**
 * Get the source type for a specific image.
 *
 * Useful for debugging and analytics.
 *
 * @param listing - Object with stored_images and/or images arrays
 * @param index - Image index to check
 * @returns 'stored', 'original', or 'none'
 */
export function getImageSource(
  listing: ImageSource | null | undefined,
  index: number = 0
): 'stored' | 'original' | 'none' {
  if (!listing) return 'none';
  if (listing.stored_images?.[index]) return 'stored';
  if (listing.images?.[index]) return 'original';
  return 'none';
}

/**
 * Get image count (total unique images with supported formats).
 *
 * @param listing - Object with stored_images and/or images arrays
 * @returns Number of images available
 */
export function getImageCount(listing: ImageSource | null | undefined): number {
  return getAllImages(listing).length;
}

/**
 * Check if any images are available.
 *
 * @param listing - Object with stored_images and/or images arrays
 * @returns True if at least one image is available
 */
export function hasAnyImages(listing: ImageSource | null | undefined): boolean {
  return getImageCount(listing) > 0;
}

/**
 * Check if a dealer is known to never publish product images.
 *
 * Some dealers (e.g., Katana Ando) operate without listing photos.
 * This function identifies such dealers so we can show an appropriate
 * placeholder message instead of a generic "no image" icon.
 *
 * @param dealerDomain - The dealer's domain (e.g., 'katana-ando.com')
 * @returns True if the dealer is known to not publish images
 */
export function dealerDoesNotPublishImages(dealerDomain: string | undefined): boolean {
  if (!dealerDomain) return false;
  return DEALERS_WITHOUT_IMAGES.includes(dealerDomain.toLowerCase());
}
