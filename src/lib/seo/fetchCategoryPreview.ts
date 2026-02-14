import { createServiceClient } from '@/lib/supabase/server';
import type { CategoryDef } from './categories';

interface PreviewListing {
  id: number;
  title: string;
  price_value: number | null;
  price_currency: string | null;
  cert_type: string | null;
  images: string[] | null;
  stored_images: string[] | null;
}

/**
 * Fetch a handful of preview listings + total count for a category page.
 * Runs server-side only.
 */
export async function fetchCategoryPreview(
  category: CategoryDef,
  limit = 8
): Promise<{ listings: PreviewListing[]; totalCount: number }> {
  const supabase = await createServiceClient();

  let query = supabase
    .from('listings')
    .select('id, title, price_value, price_currency, cert_type, images, stored_images', { count: 'exact' })
    .eq('is_available', true)
    .eq('admin_hidden', false);

  // Apply the correct filter based on param type
  if (category.filterParam === 'type') {
    query = query.in('item_type', category.filterValues);
  } else if (category.filterParam === 'cert') {
    query = query.in('cert_type', category.filterValues);
  }

  query = query
    .order('first_seen_at', { ascending: false })
    .limit(limit);

  const { data, count } = await query;

  return {
    listings: (data || []) as PreviewListing[],
    totalCount: count || 0,
  };
}
