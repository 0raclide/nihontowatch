'use client';

import { useCallback, useRef } from 'react';
import { getAllImages, type ImageSource } from '@/lib/images';

/**
 * Cache of preloaded image URLs to avoid duplicate requests.
 * Uses a Set for O(1) lookup performance.
 */
const preloadedUrls = new Set<string>();

/**
 * Maximum number of images to preload per listing.
 * Limits bandwidth consumption on hover.
 */
const MAX_PRELOAD_COUNT = 3;

/**
 * Hook for preloading images to improve perceived performance.
 *
 * Images are preloaded by creating off-screen Image objects, which
 * causes the browser to fetch and cache them. When the image is later
 * displayed, it loads instantly from cache.
 *
 * @example
 * ```tsx
 * const { preloadListing } = useImagePreloader();
 *
 * // Preload on hover
 * const handleMouseEnter = () => {
 *   hoverTimer.current = setTimeout(() => {
 *     preloadListing(listing);
 *   }, 150);
 * };
 * ```
 */
export function useImagePreloader() {
  // Track active preload requests to allow cancellation
  const activePreloads = useRef<HTMLImageElement[]>([]);

  /**
   * Preload a single image URL.
   * Skips if already preloaded to avoid duplicate requests.
   */
  const preloadImage = useCallback((url: string): HTMLImageElement | null => {
    if (!url || preloadedUrls.has(url)) {
      return null;
    }

    const img = new Image();
    img.src = url;
    preloadedUrls.add(url);

    // Track for potential cancellation
    activePreloads.current.push(img);

    // Clean up tracking once loaded or failed
    img.onload = img.onerror = () => {
      const index = activePreloads.current.indexOf(img);
      if (index > -1) {
        activePreloads.current.splice(index, 1);
      }
    };

    return img;
  }, []);

  /**
   * Preload images for a listing.
   * Uses getAllImages to prefer CDN URLs over dealer URLs.
   *
   * @param listing - Listing with images to preload
   * @param count - Max number of images to preload (default: 3)
   */
  const preloadListing = useCallback((
    listing: ImageSource | null | undefined,
    count: number = MAX_PRELOAD_COUNT
  ) => {
    if (!listing) return;

    const images = getAllImages(listing);
    const toPreload = images.slice(0, count);

    toPreload.forEach(preloadImage);
  }, [preloadImage]);

  /**
   * Cancel any active preload requests.
   * Useful when user moves mouse away before preloading completes.
   */
  const cancelPreloads = useCallback(() => {
    activePreloads.current.forEach(img => {
      img.src = ''; // Abort the request
    });
    activePreloads.current = [];
  }, []);

  /**
   * Check if a URL has been preloaded.
   * Useful for debugging and testing.
   */
  const isPreloaded = useCallback((url: string): boolean => {
    return preloadedUrls.has(url);
  }, []);

  /**
   * Get count of preloaded URLs.
   * Useful for debugging and monitoring.
   */
  const getPreloadedCount = useCallback((): number => {
    return preloadedUrls.size;
  }, []);

  return {
    preloadImage,
    preloadListing,
    cancelPreloads,
    isPreloaded,
    getPreloadedCount,
  };
}

/**
 * Clear the preload cache.
 * Mainly useful for testing.
 */
export function clearPreloadCache(): void {
  preloadedUrls.clear();
}

export default useImagePreloader;
