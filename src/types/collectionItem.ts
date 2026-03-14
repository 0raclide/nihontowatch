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

export type HoldingStatus = 'owned' | 'sold' | 'consigned' | 'gifted' | 'lost';

export interface CollectionItemRow extends ItemDataFields {
  // Identity
  id: string;             // UUID PK
  item_uuid: string;      // UUID, always set (DEFAULT gen_random_uuid())
  owner_id: string;       // auth.users FK

  // Collection-only fields
  visibility: CollectionVisibility;
  source_listing_id: number | null;
  personal_notes: string | null;

  // Holding status (orthogonal to listing lifecycle status/is_sold/is_available)
  holding_status: HoldingStatus;

  // Financial fields (collection-only, not shared with listings)
  purchase_price?: number | null;
  purchase_currency?: string | null;
  purchase_date?: string | null;
  purchase_source?: string | null;
  current_value?: number | null;
  current_currency?: string | null;
  location?: string | null;

  // Sold fields (populated when holding_status = 'sold')
  sold_price?: number | null;
  sold_currency?: string | null;
  sold_date?: string | null;
  sold_to?: string | null;
  sold_venue?: string | null;

  // Ordering
  sort_order: number;

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
