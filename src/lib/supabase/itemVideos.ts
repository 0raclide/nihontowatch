/**
 * Typed helpers for `item_videos` table queries.
 *
 * The `item_videos` table is not in generated Supabase types, so all
 * `.from('item_videos')` calls require `as any` casts. This module
 * centralizes those casts behind typed wrappers.
 *
 * Follows the pattern established in collectionItems.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemVideoRow } from '@/types/collectionItem';

type SupabaseResponse<T> = {
  data: T | null;
  error: { message: string; details?: string; hint?: string; code?: string } | null;
};

/**
 * Returns a chainable Supabase query builder for `item_videos`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function itemVideosFrom(client: SupabaseClient<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client.from('item_videos' as any) as any;
}

/**
 * INSERT a row into item_videos. Returns the inserted row.
 */
export async function insertItemVideo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  row: Partial<ItemVideoRow>,
): Promise<SupabaseResponse<ItemVideoRow>> {
  return itemVideosFrom(client)
    .insert(row)
    .select('*')
    .single() as Promise<SupabaseResponse<ItemVideoRow>>;
}

/**
 * SELECT item_videos rows matching a filter. Returns typed array.
 */
export async function selectItemVideos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  column: string,
  value: string,
  selectFields = '*',
  orderBy?: { column: string; ascending: boolean },
): Promise<SupabaseResponse<ItemVideoRow[]>> {
  let query = itemVideosFrom(client)
    .select(selectFields)
    .eq(column, value);

  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending });
  }

  return query as Promise<SupabaseResponse<ItemVideoRow[]>>;
}

/**
 * UPDATE an item_videos row by id.
 */
export async function updateItemVideo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  id: string,
  updates: Partial<ItemVideoRow>,
): Promise<SupabaseResponse<null>> {
  return itemVideosFrom(client)
    .update(updates)
    .eq('id', id) as Promise<SupabaseResponse<null>>;
}

/**
 * SELECT a single item_videos row matching a filter. Returns typed single row.
 */
export async function selectItemVideoSingle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  column: string,
  value: string,
  selectFields = '*',
): Promise<SupabaseResponse<ItemVideoRow>> {
  return itemVideosFrom(client)
    .select(selectFields)
    .eq(column, value)
    .single() as Promise<SupabaseResponse<ItemVideoRow>>;
}

/**
 * DELETE an item_videos row by id.
 */
export async function deleteItemVideo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  id: string,
): Promise<SupabaseResponse<null>> {
  return itemVideosFrom(client)
    .delete()
    .eq('id', id) as Promise<SupabaseResponse<null>>;
}
