/**
 * Media gallery utilities — combines images and videos into a unified MediaItem array.
 *
 * Backward compatible: components that still use getAllImages() are unaffected.
 */

import { getAllImages, type ImageSource } from './images';
import type { MediaItem, ListingVideo } from '@/types/media';

interface ListingWithMedia extends ImageSource {
  videos?: ListingVideo[];
}

/**
 * Build a combined media gallery from a listing's images and videos.
 *
 * Images come first (preserving existing order), then videos (sorted by sort_order).
 * Only videos with status='ready' are included — processing/failed are filtered out.
 */
export function getMediaItems(listing: ListingWithMedia | null | undefined): MediaItem[] {
  if (!listing) return [];

  const images = getAllImages(listing);
  const items: MediaItem[] = [];

  // Images first
  for (let i = 0; i < images.length; i++) {
    items.push({
      type: 'image',
      url: images[i],
      thumbnailUrl: images[i],
      index: i,
    });
  }

  // Then ready videos
  const videos = (listing.videos || [])
    .filter(v => v.status === 'ready')
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const video of videos) {
    items.push({
      type: 'video',
      url: video.stream_url || '',
      thumbnailUrl: video.thumbnail_url || undefined,
      index: items.length,
      videoId: video.id,
      providerId: video.provider_id,
      duration: video.duration_seconds,
      status: video.status,
    });
  }

  return items;
}

/**
 * Build a combined media gallery from pre-validated image URLs and optional videos.
 *
 * Use this when you've already validated/filtered images (e.g., via useValidatedImages)
 * and want a single unified array without re-running getAllImages().
 */
export function getMediaItemsFromImages(
  validatedImages: string[],
  videos?: ListingVideo[]
): MediaItem[] {
  const items: MediaItem[] = [];

  // Images first
  for (let i = 0; i < validatedImages.length; i++) {
    items.push({
      type: 'image',
      url: validatedImages[i],
      thumbnailUrl: validatedImages[i],
      index: i,
    });
  }

  // Then ready videos
  const readyVideos = (videos || [])
    .filter(v => v.status === 'ready')
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const video of readyVideos) {
    items.push({
      type: 'video',
      url: video.stream_url || '',
      thumbnailUrl: video.thumbnail_url || undefined,
      index: items.length,
      videoId: video.id,
      providerId: video.provider_id,
      duration: video.duration_seconds,
      status: video.status,
    });
  }

  return items;
}

/**
 * Check if a listing has any ready videos.
 */
export function hasReadyVideos(listing: ListingWithMedia | null | undefined): boolean {
  return (listing?.videos || []).some(v => v.status === 'ready');
}
