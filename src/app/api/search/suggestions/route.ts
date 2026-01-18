import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeSearchText } from '@/lib/search';
import { LISTING_FILTERS } from '@/lib/constants';
import type { SearchSuggestion, SearchSuggestionsResponse } from '@/lib/search/types';

export const dynamic = 'force-dynamic';

// Type for the raw Supabase query result
interface ListingQueryResult {
  id: number;
  url: string;
  title: string | null;
  item_type: string | null;
  price_value: number | null;
  price_currency: string;
  images: string[];
  cert_type: string | null;
  smith: string | null;
  tosogu_maker: string | null;
  dealers: { name: string; domain: string };
}

/**
 * GET /api/search/suggestions
 *
 * Lightweight endpoint for instant search suggestions.
 * Target response time: <150ms
 *
 * Query params:
 * - q: search query (min 2 chars)
 * - limit: max results (1-10, default 5)
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  const limit = Math.min(
    Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 5),
    10
  );

  // Return empty for short queries
  if (!query || query.trim().length < 2) {
    return NextResponse.json({
      suggestions: [],
      total: 0,
      query: query || '',
    } satisfies SearchSuggestionsResponse);
  }

  try {
    const supabase = await createClient();
    const normalizedQuery = normalizeSearchText(query);

    // Build ILIKE search across relevant fields
    // Include title, smith, tosogu_maker, school, tosogu_school
    const searchFields = [
      `title.ilike.%${normalizedQuery}%`,
      `smith.ilike.%${normalizedQuery}%`,
      `tosogu_maker.ilike.%${normalizedQuery}%`,
      `school.ilike.%${normalizedQuery}%`,
      `tosogu_school.ilike.%${normalizedQuery}%`,
    ].join(',');

    let dbQuery = supabase
      .from('listings')
      .select(
        `
        id,
        url,
        title,
        item_type,
        price_value,
        price_currency,
        images,
        cert_type,
        smith,
        tosogu_maker,
        dealers!inner(name, domain)
      `,
        { count: 'exact' }
      )
      .or('status.eq.available,is_available.eq.true')
      .or(searchFields);

    // Apply minimum price filter (uses normalized JPY price)
    // Also exclude NULL price_jpy to prevent unpriced items slipping through
    if (LISTING_FILTERS.MIN_PRICE_JPY > 0) {
      dbQuery = dbQuery
        .not('price_jpy', 'is', null)
        .gte('price_jpy', LISTING_FILTERS.MIN_PRICE_JPY);
    }

    const { data, count, error } = await dbQuery
      .order('first_seen_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Search suggestions error:', error);
      return NextResponse.json({
        suggestions: [],
        total: 0,
        query,
      } satisfies SearchSuggestionsResponse);
    }

    // Transform to suggestion format
    const results = (data || []) as ListingQueryResult[];
    const suggestions: SearchSuggestion[] = results.map((item) => ({
      id: String(item.id),
      title: item.title || '',
      item_type: item.item_type,
      price_value: item.price_value,
      price_currency: item.price_currency,
      image_url: Array.isArray(item.images) ? item.images[0] || null : null,
      dealer_name: item.dealers?.name || 'Unknown',
      dealer_domain: item.dealers?.domain || '',
      url: item.url,
      cert_type: item.cert_type,
      smith: item.smith,
      tosogu_maker: item.tosogu_maker,
    }));

    return NextResponse.json({
      suggestions,
      total: count || 0,
      query,
    } satisfies SearchSuggestionsResponse);
  } catch (error) {
    console.error('Search suggestions API error:', error);
    return NextResponse.json(
      {
        suggestions: [],
        total: 0,
        query: query || '',
      } satisfies SearchSuggestionsResponse,
      { status: 500 }
    );
  }
}
