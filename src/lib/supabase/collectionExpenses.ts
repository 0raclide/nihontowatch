/**
 * Typed helpers for `collection_expenses` table queries.
 *
 * The `collection_expenses` table is not in generated Supabase types, so all
 * `.from()` calls require `as any` casts. This module centralizes those casts
 * behind typed wrappers.
 *
 * Follows the pattern established in itemVideos.ts and collectionItems.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollectionExpense } from '@/types/expense';

type SupabaseResponse<T> = {
  data: T | null;
  error: { message: string; details?: string; hint?: string; code?: string } | null;
};

/**
 * Returns a chainable Supabase query builder for `collection_expenses`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function collectionExpensesFrom(client: SupabaseClient<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client.from('collection_expenses' as any) as any;
}

/**
 * SELECT expenses for a given item_id, ordered by expense_date DESC.
 */
export async function selectExpensesForItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  itemId: string,
): Promise<SupabaseResponse<CollectionExpense[]>> {
  return collectionExpensesFrom(client)
    .select('*')
    .eq('item_id', itemId)
    .order('expense_date', { ascending: false, nullsFirst: false }) as Promise<SupabaseResponse<CollectionExpense[]>>;
}

/**
 * INSERT a new expense row. Returns the inserted row.
 */
export async function insertExpense(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  row: Partial<CollectionExpense>,
): Promise<SupabaseResponse<CollectionExpense>> {
  return collectionExpensesFrom(client)
    .insert(row)
    .select('*')
    .single() as Promise<SupabaseResponse<CollectionExpense>>;
}

/**
 * UPDATE an expense row by id.
 */
export async function updateExpense(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  id: string,
  updates: Partial<CollectionExpense>,
): Promise<SupabaseResponse<CollectionExpense>> {
  return collectionExpensesFrom(client)
    .update(updates)
    .eq('id', id)
    .select('*')
    .single() as Promise<SupabaseResponse<CollectionExpense>>;
}

/**
 * DELETE an expense row by id.
 */
export async function deleteExpense(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  id: string,
): Promise<SupabaseResponse<null>> {
  return collectionExpensesFrom(client)
    .delete()
    .eq('id', id) as Promise<SupabaseResponse<null>>;
}

/**
 * Get expense totals per item, grouped by currency.
 * Returns a map: { [item_id]: { [currency]: totalAmount } }
 */
export async function getExpenseTotals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  itemIds: string[],
): Promise<Record<string, Record<string, number>>> {
  if (itemIds.length === 0) return {};

  const { data, error } = await collectionExpensesFrom(client)
    .select('item_id, currency, amount')
    .in('item_id', itemIds);

  if (error || !data) return {};

  const totals: Record<string, Record<string, number>> = {};
  for (const row of data as Array<{ item_id: string; currency: string; amount: number }>) {
    if (!totals[row.item_id]) totals[row.item_id] = {};
    totals[row.item_id][row.currency] = (totals[row.item_id][row.currency] || 0) + Number(row.amount);
  }

  return totals;
}

/**
 * Count expenses for a given item_id.
 */
export async function countExpensesForItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  itemId: string,
): Promise<number> {
  const { count, error } = await collectionExpensesFrom(client)
    .select('*', { count: 'exact', head: true })
    .eq('item_id', itemId);

  if (error) return 0;
  return count || 0;
}
