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

import { IMAGE_QUALITY } from './constants';

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
  // Match pattern: /00.jpg, /05.webp, etc. at end of URL
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
 * Get all available images, combining stored and original images with smart deduplication.
 *
 * Strategy:
 * 1. Parse stored image filenames to determine which original indices they cover
 *    (stored images are named {index:02d}.{ext}, e.g., 00.jpg = images[0])
 * 2. Include all stored images first (CDN-optimized, faster loading)
 * 3. Include original images only if their index isn't covered by a stored version
 * 4. Filter out unsupported formats (e.g., .tif files that browsers can't display)
 * 5. Deduplicate by URL
 *
 * This prevents duplicate images when both stored_images and images contain
 * the same photos (just with different URLs).
 *
 * @param listing - Object with stored_images and/or images arrays
 * @returns Array of all available image URLs (deduplicated, supported formats only)
 *
 * @example
 * const allImages = getAllImages(listing);
 * // Returns stored images, plus original images that don't have stored versions
 */
export function getAllImages(listing: ImageSource | null | undefined): string[] {
  if (!listing) return [];

  const stored = listing.stored_images || [];
  const original = listing.images || [];

  // Track which original indices are covered by stored versions
  const coveredIndices = new Set<number>();
  for (const url of stored) {
    const index = extractStoredImageIndex(url);
    if (index !== null) {
      coveredIndices.add(index);
    }
  }

  // Build result: stored first (preferred), then originals that aren't covered
  const seen = new Set<string>();
  const result: string[] = [];

  // Add all stored images first
  for (const url of stored) {
    if (url && !seen.has(url) && isSupportedImageFormat(url)) {
      seen.add(url);
      result.push(url);
    }
  }

  // Add original images only if their index isn't covered by a stored version
  for (let i = 0; i < original.length; i++) {
    const url = original[i];
    if (url && !seen.has(url) && isSupportedImageFormat(url) && !coveredIndices.has(i)) {
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
