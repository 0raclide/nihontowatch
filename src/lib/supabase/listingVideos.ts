/**
 * Typed helpers for `listing_videos` table queries.
 *
 * The `listing_videos` table is not in generated Supabase types, so all
 * `.from('listing_videos')` calls require `as any` casts. This module
 * centralizes those casts behind typed wrappers so the rest of the codebase
 * stays clean.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ListingVideosRow } from '@/types/media';

type SupabaseResponse<T> = { data: T | null; error: { message: string; details?: string; hint?: string; code?: string } | null };

/**
 * SELECT from listing_videos. Returns a chainable Supabase query.
 *
 * Usage:
 *   const { data, error } = await selectListingVideos(client)
 *     .select('id, provider_id')
 *     .eq('listing_id', 42);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listingVideosFrom(client: SupabaseClient<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client.from('listing_videos' as any) as any;
}

/**
 * INSERT a row into listing_videos. Returns the inserted row.
 */
export async function insertListingVideo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  row: Partial<ListingVideosRow>
): Promise<SupabaseResponse<ListingVideosRow>> {
  return listingVideosFrom(client)
    .insert(row)
    .select('*')
    .single() as Promise<SupabaseResponse<ListingVideosRow>>;
}

/**
 * SELECT listing_videos rows matching a filter. Returns typed array.
 */
export async function selectListingVideos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  column: string,
  value: string | number,
  selectFields = '*',
  orderBy?: { column: string; ascending: boolean }
): Promise<SupabaseResponse<ListingVideosRow[]>> {
  let query = listingVideosFrom(client)
    .select(selectFields)
    .eq(column, value);

  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending });
  }

  return query as Promise<SupabaseResponse<ListingVideosRow[]>>;
}

/**
 * SELECT a single listing_videos row matching a filter. Returns typed single row.
 */
export async function selectListingVideoSingle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  column: string,
  value: string | number,
  selectFields = '*'
): Promise<SupabaseResponse<ListingVideosRow>> {
  return listingVideosFrom(client)
    .select(selectFields)
    .eq(column, value)
    .single() as Promise<SupabaseResponse<ListingVideosRow>>;
}

/**
 * UPDATE listing_videos rows matching a filter.
 */
export async function updateListingVideo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  id: string,
  updates: Partial<ListingVideosRow>
): Promise<SupabaseResponse<null>> {
  return listingVideosFrom(client)
    .update(updates)
    .eq('id', id) as Promise<SupabaseResponse<null>>;
}

/**
 * DELETE listing_videos row by id.
 */
export async function deleteListingVideo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  id: string
): Promise<SupabaseResponse<null>> {
  return listingVideosFrom(client)
    .delete()
    .eq('id', id) as Promise<SupabaseResponse<null>>;
}
