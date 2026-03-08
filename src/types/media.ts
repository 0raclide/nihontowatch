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
 * Row type matching the `listing_videos` DB table exactly.
 * Used for typed Supabase queries where generated types are unavailable.
 */
export interface ListingVideosRow {
  id: string;
  listing_id: number;
  provider: string;
  provider_id: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  thumbnail_url: string | null;
  status: string;
  sort_order: number;
  original_filename: string | null;
  size_bytes: number | null;
  created_by: string | null;
  created_at: string;
}
