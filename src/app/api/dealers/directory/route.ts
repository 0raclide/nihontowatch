import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { LISTING_FILTERS } from '@/lib/constants';
import { createDealerSlug, getCountryRegion, formatItemType } from '@/lib/dealers/utils';

export const revalidate = 3600; // 1 hour

interface DealerRow {
  id: number;
  name: string;
  domain: string;
  country: string;
}

interface ListingRow {
  dealer_id: number;
  item_type: string | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sort = searchParams.get('sort') || 'listing_count';
  const q = searchParams.get('q')?.trim().toLowerCase() || '';
  const region = searchParams.get('region') || ''; // 'japan' | 'international' | ''

  const supabase = createServiceClient();

  // Two parallel queries instead of O(n) per-dealer counts
  const [dealersResult, listingsResult] = await Promise.all([
    supabase
      .from('dealers')
      .select('id, name, domain, country')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('listings')
      .select('dealer_id, item_type')
      .eq('is_available', true)
      .or(`price_value.is.null,price_jpy.gte.${LISTING_FILTERS.MIN_PRICE_JPY}`),
  ]);

  if (dealersResult.error) {
    console.error('[Dealers API] Error fetching dealers:', dealersResult.error);
    return NextResponse.json({ error: 'Failed to fetch dealers' }, { status: 500 });
  }

  const dealers = (dealersResult.data || []) as DealerRow[];
  const listings = (listingsResult.data || []) as ListingRow[];

  // Aggregate listing counts and type breakdowns per dealer
  const dealerStats = new Map<number, { count: number; types: Map<string, number> }>();
  for (const listing of listings) {
    let stats = dealerStats.get(listing.dealer_id);
    if (!stats) {
      stats = { count: 0, types: new Map() };
      dealerStats.set(listing.dealer_id, stats);
    }
    stats.count++;
    if (listing.item_type) {
      stats.types.set(listing.item_type, (stats.types.get(listing.item_type) || 0) + 1);
    }
  }

  // Build enriched dealer list
  let enrichedDealers = dealers.map((d) => {
    const stats = dealerStats.get(d.id);
    const listing_count = stats?.count || 0;

    // Top 5 types sorted by count
    const typeEntries = stats
      ? [...stats.types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      : [];

    return {
      id: d.id,
      name: d.name,
      domain: d.domain,
      country: d.country,
      slug: createDealerSlug(d.name),
      listing_count,
      type_breakdown: typeEntries.map(([type, count]) => ({
        type,
        label: formatItemType(type),
        count,
      })),
    };
  });

  // Apply search filter
  if (q) {
    enrichedDealers = enrichedDealers.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.domain.toLowerCase().includes(q)
    );
  }

  // Apply region filter
  if (region === 'japan') {
    enrichedDealers = enrichedDealers.filter((d) => getCountryRegion(d.country) === 'Japan');
  } else if (region === 'international') {
    enrichedDealers = enrichedDealers.filter((d) => getCountryRegion(d.country) === 'International');
  }

  // Sort
  switch (sort) {
    case 'name':
      enrichedDealers.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'country':
      enrichedDealers.sort((a, b) => {
        const regionCmp = getCountryRegion(a.country).localeCompare(getCountryRegion(b.country));
        return regionCmp !== 0 ? regionCmp : b.listing_count - a.listing_count;
      });
      break;
    case 'listing_count':
    default:
      enrichedDealers.sort((a, b) => b.listing_count - a.listing_count);
      break;
  }

  // Build facets
  const countryCounts = new Map<string, number>();
  for (const d of dealers) {
    const r = getCountryRegion(d.country);
    countryCounts.set(r, (countryCounts.get(r) || 0) + 1);
  }

  const totalListings = listings.length;
  const japanDealers = dealers.filter((d) => getCountryRegion(d.country) === 'Japan').length;
  const internationalDealers = dealers.length - japanDealers;

  return NextResponse.json({
    dealers: enrichedDealers,
    facets: {
      countries: [...countryCounts.entries()].map(([value, count]) => ({ value, count })),
    },
    totals: {
      dealers: dealers.length,
      listings: totalListings,
      japanDealers,
      internationalDealers,
    },
  });
}
