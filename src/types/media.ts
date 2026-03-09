/**
 * Media types for mixed image/video galleries.
 */

export type MediaType = 'image' | 'video';

export interface MediaItem {
  type: MediaType;
  url: string;
  thumbnailUrl?: string;
  index: number;
  videoId?: string;
  providerId?: string;
  duration?: number;
  status?: 'processing' | 'ready' | 'failed';
}

export interface ListingVideo {
  id: string;
  listing_id: number;
  provider: string;
  provider_id: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
  thumbnail_url?: string;
  status: 'processing' | 'ready' | 'failed';
  sort_order: number;
  original_filename?: string;
  size_bytes?: number;
  created_at: string;
  // Enriched by API (not DB columns)
  stream_url?: string;
}

/**
 * DB row type for `item_videos` table.
 * Re-exported from collectionItem.ts for convenience.
 * @see ItemVideoRow in src/types/collectionItem.ts
 */
export type { ItemVideoRow } from './collectionItem';
