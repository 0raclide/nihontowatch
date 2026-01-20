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
 * Get all available images, combining stored and original images.
 *
 * Strategy:
 * 1. Include all stored images first (CDN-optimized, faster loading)
 * 2. Then include all original images (for completeness)
 * 3. Filter out unsupported formats (e.g., .tif files that browsers can't display)
 * 4. Deduplicate by URL
 *
 * Note: We don't try to merge by index because stored_images may be sparse
 * (only some original images get stored) and their filenames indicate the
 * original index, not their position in the stored_images array.
 *
 * @param listing - Object with stored_images and/or images arrays
 * @returns Array of all available image URLs (deduplicated, supported formats only)
 *
 * @example
 * const allImages = getAllImages(listing);
 * // Returns all stored images first, then original images, deduplicated
 */
export function getAllImages(listing: ImageSource | null | undefined): string[] {
  if (!listing) return [];

  const stored = listing.stored_images || [];
  const original = listing.images || [];

  // Combine stored first (optimized), then original (fallback)
  const allUrls = [...stored, ...original];

  // Filter unsupported formats and deduplicate
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of allUrls) {
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
