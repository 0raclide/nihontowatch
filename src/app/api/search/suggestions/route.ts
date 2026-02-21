import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeSearchText } from '@/lib/search';
import { detectUrlQuery } from '@/lib/search/urlDetection';
import { toTraditionalKanji, hasKanjiVariants } from '@/lib/search/textNormalization';
import { containsCJK } from '@/lib/search/cjkDetection';
import { LISTING_FILTERS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import type { SearchSuggestion, SearchSuggestionsResponse } from '@/lib/search/types';

// Enable edge caching for search suggestions
// 60s cache + 5min stale-while-revalidate reduces DB load significantly
export const revalidate = 60;

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

  // Return empty for short queries (allow single CJK characters like 刀)
  const trimmedQuery = query?.trim() || '';
  if (!query || (trimmedQuery.length < 2 && !containsCJK(trimmedQuery))) {
    const response = NextResponse.json({
      suggestions: [],
      total: 0,
      query: query || '',
    } satisfies SearchSuggestionsResponse);
    // Cache empty responses too
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return response;
  }

  try {
    const supabase = await createClient();
    const normalizedQuery = normalizeSearchText(query);

    // URL detection: search url column directly instead of text fields
    const detectedUrl = detectUrlQuery(query);

    let dbQuery;

    if (detectedUrl) {
      // URL search: ILIKE on url column, no status/price filter (find any matching listing)
      dbQuery = supabase
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
        .ilike('url', `%${detectedUrl}%`);
    } else if (containsCJK(normalizedQuery)) {
      // CJK search path: ILIKE on structured fields + description
      // PostgreSQL FTS can't tokenize CJK with 'simple' config, so use ILIKE
      // Also expand shinjitai↔kyujitai variants for broader coverage
      const variants = [normalizedQuery];
      if (hasKanjiVariants(normalizedQuery)) {
        variants.push(toTraditionalKanji(normalizedQuery));
      }
      const searchFields = variants.flatMap(term => [
        `title.ilike.%${term}%`,
        `smith.ilike.%${term}%`,
        `tosogu_maker.ilike.%${term}%`,
        `school.ilike.%${term}%`,
        `tosogu_school.ilike.%${term}%`,
        `description.ilike.%${term}%`,
      ]).join(',');

      dbQuery = supabase
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

      // Apply minimum price filter
      if (LISTING_FILTERS.MIN_PRICE_JPY > 0) {
        dbQuery = dbQuery
          .not('price_jpy', 'is', null)
          .gte('price_jpy', LISTING_FILTERS.MIN_PRICE_JPY);
      }
    } else {
      // Standard romaji text search across relevant fields
      const searchFields = [
        `title.ilike.%${normalizedQuery}%`,
        `smith.ilike.%${normalizedQuery}%`,
        `tosogu_maker.ilike.%${normalizedQuery}%`,
        `school.ilike.%${normalizedQuery}%`,
        `tosogu_school.ilike.%${normalizedQuery}%`,
      ].join(',');

      dbQuery = supabase
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
    }

    const { data, count, error } = await dbQuery
      .order('first_seen_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Search suggestions error', { error, query });
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

    const response = NextResponse.json({
      suggestions,
      total: count || 0,
      query,
    } satisfies SearchSuggestionsResponse);

    // Cache for 60 seconds at edge, serve stale for 5 minutes while revalidating
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    );

    return response;
  } catch (error) {
    logger.logError('Search suggestions API error', error);
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
