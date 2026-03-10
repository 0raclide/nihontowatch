/**
 * Type definitions for the unified collection system.
 *
 * CollectionItemRow = the `collection_items` DB table shape.
 * CollectionEvent = the `collection_events` audit log shape.
 * ItemVideoRow = the `item_videos` DB table shape.
 *
 * Named `CollectionItemRow` to avoid collision with existing
 * `CollectionItem` in src/types/collection.ts (old system, removed in Phase 5).
 */

import type { ItemDataFields } from './itemData';

// =============================================================================
// COLLECTION ITEM
// =============================================================================

export type CollectionVisibility = 'private' | 'collectors' | 'dealers';

export interface CollectionItemRow extends ItemDataFields {
  // Identity
  id: string;             // UUID PK
  item_uuid: string;      // UUID, always set (DEFAULT gen_random_uuid())
  owner_id: string;       // auth.users FK

  // Collection-only fields
  visibility: CollectionVisibility;
  source_listing_id: number | null;
  personal_notes: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// =============================================================================
// COLLECTION EVENTS (audit log)
// =============================================================================

export type CollectionEventType =
  | 'created'
  | 'updated'
  | 'promoted'
  | 'delisted'
  | 'sold'
  | 'deleted';

export interface CollectionEvent {
  id: string;
  item_uuid: string;
  actor_id: string;
  event_type: CollectionEventType;
  payload: Record<string, unknown> | null;
  created_at: string;
}

// =============================================================================
// ITEM VIDEOS
// =============================================================================

export interface ItemVideoRow {
  id: string;
  item_uuid: string;
  owner_id: string;
  provider: string;
  provider_id: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  thumbnail_url: string | null;
  stream_url: string | null;
  status: 'processing' | 'ready' | 'failed';
  sort_order: number;
  original_filename: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
}
