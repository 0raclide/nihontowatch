import { createServiceClient } from '@/lib/supabase/server';

/**
 * Server-side preview data for the home page SSR fallback.
 * Fetches enough data for Googlebot to see meaningful content
 * (H1, item count, listing titles/links) in the initial HTML.
 */

export interface HomePreviewListing {
  id: number;
  title: string;
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  cert_type: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  stored_images: string[] | null;
  images: string[] | null;
  dealer_name: string;
}

export interface HomePreviewData {
  listings: HomePreviewListing[];
  totalCount: number;
  dealerCount: number;
}

export async function getHomePreview(): Promise<HomePreviewData> {
  try {
    const supabase = createServiceClient();

    const [listingsResult, dealerCountResult] = await Promise.all([
      supabase
        .from('listings')
        .select(
          'id, title, item_type, price_value, price_currency, cert_type, smith, tosogu_maker, stored_images, images, dealers!inner(name)',
          { count: 'exact' }
        )
        .eq('is_available', true)
        .eq('admin_hidden', false)
        .order('featured_score', { ascending: false, nullsFirst: false })
        .limit(24),
      supabase
        .from('dealers')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
    ]);

    if (listingsResult.error) {
      console.error('[HomePreview] Listings query error:', listingsResult.error);
    }
    if (dealerCountResult.error) {
      console.error('[HomePreview] Dealer count error:', dealerCountResult.error);
    }

    return {
      listings: (listingsResult.data || []).map((l: Record<string, unknown>) => ({
        id: l.id as number,
        title: l.title as string,
        item_type: l.item_type as string | null,
        price_value: l.price_value as number | null,
        price_currency: l.price_currency as string | null,
        cert_type: l.cert_type as string | null,
        smith: l.smith as string | null,
        tosogu_maker: l.tosogu_maker as string | null,
        stored_images: l.stored_images as string[] | null,
        images: l.images as string[] | null,
        dealer_name: ((l.dealers as Record<string, unknown>)?.name as string) || '',
      })),
      totalCount: listingsResult.count || 0,
      dealerCount: dealerCountResult.count || 0,
    };
  } catch (error) {
    console.error('[HomePreview] Error:', error);
    return { listings: [], totalCount: 0, dealerCount: 0 };
  }
}
