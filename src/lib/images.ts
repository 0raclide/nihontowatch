/**
 * Image URL resolution utilities with smart fallback.
 *
 * Provides a centralized way to get image URLs from listings, with automatic
 * fallback from Supabase-stored images to original dealer URLs.
 *
 * Priority order:
 * 1. stored_images[index] - Supabase Storage (fast, reliable)
 * 2. images[index] - Original dealer URL (fallback)
 * 3. null - No image available
 */

/**
 * Minimal interface for image source fields.
 * Works with any object that has these optional fields.
 */
export interface ImageSource {
  stored_images?: string[] | null;
  images?: string[] | null;
}

/**
 * Get a single image URL with fallback logic.
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

  // Priority 1: Supabase stored images (CDN-optimized)
  if (listing.stored_images?.[index]) {
    return listing.stored_images[index];
  }

  // Priority 2: Original dealer URLs (fallback)
  if (listing.images?.[index]) {
    return listing.images[index];
  }

  return null;
}

/**
 * Get all available images, preferring stored over original.
 *
 * Merges stored_images and images arrays, using stored URLs where available
 * and falling back to original URLs for any missing indices.
 *
 * Useful for image carousels that need all images.
 *
 * @param listing - Object with stored_images and/or images arrays
 * @returns Array of all available image URLs
 *
 * @example
 * const allImages = getAllImages(listing);
 * // If stored_images has 3 URLs and images has 5,
 * // returns [stored[0], stored[1], stored[2], original[3], original[4]]
 */
export function getAllImages(listing: ImageSource | null | undefined): string[] {
  if (!listing) return [];

  const stored = listing.stored_images || [];
  const original = listing.images || [];

  const maxLength = Math.max(stored.length, original.length);
  const combined: string[] = [];

  for (let i = 0; i < maxLength; i++) {
    const url = stored[i] || original[i];
    if (url) combined.push(url);
  }

  return combined;
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
 * Get image count (from whichever source has more).
 *
 * @param listing - Object with stored_images and/or images arrays
 * @returns Number of images available
 */
export function getImageCount(listing: ImageSource | null | undefined): number {
  if (!listing) return 0;
  const storedCount = listing.stored_images?.length || 0;
  const originalCount = listing.images?.length || 0;
  return Math.max(storedCount, originalCount);
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
