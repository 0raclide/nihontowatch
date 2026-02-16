import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { LISTING_FILTERS } from '@/lib/constants';
import { createDealerSlug, getCountryFromDomain, getCountryRegion, formatItemType } from '@/lib/dealers/utils';

export const revalidate = 3600; // 1 hour

interface DealerRow {
  id: number;
  name: string;
  domain: string;
}

interface ListingRow {
  dealer_id: number;
  item_type: string | null;
  cert_type: string | null;
}

const BATCH_SIZE = 1000;

async function fetchAllListings(supabase: ReturnType<typeof createServiceClient>): Promise<ListingRow[]> {
  const all: ListingRow[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('listings')
      .select('dealer_id, item_type, cert_type')
      .eq('is_available', true)
      .or(`price_value.is.null,price_jpy.gte.${LISTING_FILTERS.MIN_PRICE_JPY}`)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('[Dealers API] Error fetching listings batch:', error);
      break;
    }

    if (data && data.length > 0) {
      all.push(...(data as ListingRow[]));
      offset += BATCH_SIZE;
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  return all;
}

// Canonical cert labels for display
const CERT_LABELS: Record<string, string> = {
  'Juyo Bijutsuhin': 'Juyo Bijutsuhin',
  'Juyo': 'Juyo',
  'Tokuju': 'Tokuju',
  'TokuHozon': 'Tokubetsu Hozon',
  'Hozon': 'Hozon',
  'TokuKicho': 'Tokubetsu Kicho',
  'NTHK': 'NTHK',
};

// Map raw cert_type values to canonical keys
const CERT_NORMALIZE: Record<string, string> = {
  'Juyo Bijutsuhin': 'Juyo Bijutsuhin',
  'JuBi': 'Juyo Bijutsuhin',
  'jubi': 'Juyo Bijutsuhin',
  'Juyo': 'Juyo',
  'juyo': 'Juyo',
  'Tokuju': 'Tokuju',
  'tokuju': 'Tokuju',
  'Tokubetsu Juyo': 'Tokuju',
  'tokubetsu_juyo': 'Tokuju',
  'TokuHozon': 'TokuHozon',
  'Tokubetsu Hozon': 'TokuHozon',
  'tokubetsu_hozon': 'TokuHozon',
  'Hozon': 'Hozon',
  'hozon': 'Hozon',
  'TokuKicho': 'TokuKicho',
  'Tokubetsu Kicho': 'TokuKicho',
  'tokubetsu_kicho': 'TokuKicho',
  'NTHK': 'NTHK',
  'nthk': 'NTHK',
};

function normalizeCert(raw: string): string | null {
  return CERT_NORMALIZE[raw] || null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sort = searchParams.get('sort') || 'listing_count';
  const q = searchParams.get('q')?.trim().toLowerCase() || '';
  const region = searchParams.get('region') || ''; // 'japan' | 'international' | ''
  const typeParam = searchParams.get('type')?.trim() || '';
  const certParam = searchParams.get('cert')?.trim() || '';
  const typeFilters = typeParam ? typeParam.split(',').filter(Boolean) : [];
  const certFilters = certParam ? certParam.split(',').filter(Boolean) : [];

  const supabase = createServiceClient();

  // Fetch dealers + all listings in parallel
  const [dealersResult, listings] = await Promise.all([
    supabase
      .from('dealers')
      .select('id, name, domain')
      .eq('is_active', true)
      .order('name'),
    fetchAllListings(supabase),
  ]);

  if (dealersResult.error) {
    console.error('[Dealers API] Error fetching dealers:', dealersResult.error);
    return NextResponse.json({ error: 'Failed to fetch dealers' }, { status: 500 });
  }

  const dealers = (dealersResult.data || []) as DealerRow[];

  // Aggregate listing counts, type breakdowns, and cert breakdowns per dealer
  const dealerStats = new Map<number, { count: number; types: Map<string, number>; certs: Map<string, number> }>();
  for (const listing of listings) {
    let stats = dealerStats.get(listing.dealer_id);
    if (!stats) {
      stats = { count: 0, types: new Map(), certs: new Map() };
      dealerStats.set(listing.dealer_id, stats);
    }
    stats.count++;
    if (listing.item_type) {
      stats.types.set(listing.item_type, (stats.types.get(listing.item_type) || 0) + 1);
    }
    if (listing.cert_type) {
      const normalized = normalizeCert(listing.cert_type);
      if (normalized) {
        stats.certs.set(normalized, (stats.certs.get(normalized) || 0) + 1);
      }
    }
  }

  // Build enriched dealer list
  let enrichedDealers = dealers.map((d) => {
    const stats = dealerStats.get(d.id);
    const listing_count = stats?.count || 0;
    const country = getCountryFromDomain(d.domain);

    // Top 5 types sorted by count
    const typeEntries = stats
      ? [...stats.types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      : [];

    // Cert breakdown sorted by count
    const certEntries = stats
      ? [...stats.certs.entries()].sort((a, b) => b[1] - a[1])
      : [];

    return {
      id: d.id,
      name: d.name,
      domain: d.domain,
      country,
      slug: createDealerSlug(d.name),
      listing_count,
      type_breakdown: typeEntries.map(([type, count]) => ({
        type,
        label: formatItemType(type),
        count,
      })),
      cert_breakdown: certEntries.map(([cert, count]) => ({
        cert,
        label: CERT_LABELS[cert] || cert,
        count,
      })),
    };
  });

  // Compute global facets from all enriched dealers BEFORE filtering
  // so counts remain stable regardless of active filters
  const typeDealerCounts = new Map<string, number>();
  const certDealerCounts = new Map<string, number>();
  for (const d of enrichedDealers) {
    for (const t of d.type_breakdown) {
      typeDealerCounts.set(t.type, (typeDealerCounts.get(t.type) || 0) + 1);
    }
    for (const c of d.cert_breakdown) {
      certDealerCounts.set(c.cert, (certDealerCounts.get(c.cert) || 0) + 1);
    }
  }

  const typeFacets = [...typeDealerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, dealerCount]) => ({ value, label: formatItemType(value), dealerCount }));

  const certFacets = [...certDealerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, dealerCount]) => ({ value, label: CERT_LABELS[value] || value, dealerCount }));

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

  // Apply type filter — keep dealers that carry at least one of the selected types
  if (typeFilters.length > 0) {
    enrichedDealers = enrichedDealers.filter((d) =>
      d.type_breakdown.some((t) => typeFilters.includes(t.type))
    );
  }

  // Apply cert filter — keep dealers that have at least one of the selected cert types
  if (certFilters.length > 0) {
    enrichedDealers = enrichedDealers.filter((d) =>
      d.cert_breakdown.some((c) => certFilters.includes(c.cert))
    );
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
    const r = getCountryRegion(getCountryFromDomain(d.domain));
    countryCounts.set(r, (countryCounts.get(r) || 0) + 1);
  }

  const totalListings = listings.length;
  const japanDealers = dealers.filter((d) => getCountryRegion(getCountryFromDomain(d.domain)) === 'Japan').length;
  const internationalDealers = dealers.length - japanDealers;

  return NextResponse.json({
    dealers: enrichedDealers,
    facets: {
      countries: [...countryCounts.entries()].map(([value, count]) => ({ value, count })),
      types: typeFacets,
      certs: certFacets,
    },
    totals: {
      dealers: dealers.length,
      listings: totalListings,
      japanDealers,
      internationalDealers,
    },
  });
}
