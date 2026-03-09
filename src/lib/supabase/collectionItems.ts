/**
 * Typed helpers for `collection_items` and `collection_events` table queries.
 *
 * These tables are not in generated Supabase types, so all `.from()` calls
 * require `as any` casts. This module centralizes those casts behind typed
 * wrappers so the rest of the codebase stays clean.
 *
 * Follows the pattern established in itemVideos.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollectionItemRow, CollectionEvent } from '@/types/collectionItem';

type SupabaseResponse<T> = {
  data: T | null;
  error: { message: string; details?: string; hint?: string; code?: string } | null;
};

// =============================================================================
// collection_items
// =============================================================================

/**
 * Returns a chainable Supabase query builder for `collection_items`.
 *
 * Usage:
 *   const { data, error } = await collectionItemsFrom(client)
 *     .select('*')
 *     .eq('owner_id', userId);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function collectionItemsFrom(client: SupabaseClient<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client.from('collection_items' as any) as any;
}

/**
 * INSERT a row into collection_items. Returns the inserted row.
 */
export async function insertCollectionItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  row: Partial<CollectionItemRow>,
): Promise<SupabaseResponse<CollectionItemRow>> {
  return collectionItemsFrom(client)
    .insert(row)
    .select('*')
    .single() as Promise<SupabaseResponse<CollectionItemRow>>;
}

/**
 * SELECT collection_items rows matching a filter. Returns typed array.
 */
export async function selectCollectionItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  column: string,
  value: string | number,
  selectFields = '*',
  orderBy?: { column: string; ascending: boolean },
): Promise<SupabaseResponse<CollectionItemRow[]>> {
  let query = collectionItemsFrom(client)
    .select(selectFields)
    .eq(column, value);

  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending });
  }

  return query as Promise<SupabaseResponse<CollectionItemRow[]>>;
}

/**
 * SELECT a single collection_items row. Returns typed single row.
 */
export async function selectCollectionItemSingle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  column: string,
  value: string | number,
  selectFields = '*',
): Promise<SupabaseResponse<CollectionItemRow>> {
  return collectionItemsFrom(client)
    .select(selectFields)
    .eq(column, value)
    .single() as Promise<SupabaseResponse<CollectionItemRow>>;
}

/**
 * UPDATE a collection_items row by id.
 */
export async function updateCollectionItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  id: string,
  updates: Partial<CollectionItemRow>,
): Promise<SupabaseResponse<null>> {
  return collectionItemsFrom(client)
    .update(updates)
    .eq('id', id) as Promise<SupabaseResponse<null>>;
}

/**
 * DELETE a collection_items row by id.
 */
export async function deleteCollectionItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  id: string,
): Promise<SupabaseResponse<null>> {
  return collectionItemsFrom(client)
    .delete()
    .eq('id', id) as Promise<SupabaseResponse<null>>;
}

// =============================================================================
// collection_events
// =============================================================================

/**
 * Returns a chainable Supabase query builder for `collection_events`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function collectionEventsFrom(client: SupabaseClient<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client.from('collection_events' as any) as any;
}

/**
 * INSERT a collection event.
 */
export async function insertCollectionEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  event: Omit<CollectionEvent, 'id' | 'created_at'>,
): Promise<SupabaseResponse<CollectionEvent>> {
  return collectionEventsFrom(client)
    .insert(event)
    .select('*')
    .single() as Promise<SupabaseResponse<CollectionEvent>>;
}

/**
 * SELECT collection events for an item_uuid.
 */
export async function selectCollectionEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  itemUuid: string,
  selectFields = '*',
): Promise<SupabaseResponse<CollectionEvent[]>> {
  return collectionEventsFrom(client)
    .select(selectFields)
    .eq('item_uuid', itemUuid)
    .order('created_at', { ascending: false }) as Promise<SupabaseResponse<CollectionEvent[]>>;
}
