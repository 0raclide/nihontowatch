import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { NextRequest, NextResponse } from 'next/server';
import {
  computeListingCompleteness,
  heatToTrend,
  scoreToRankBucket,
  estimatePosition,
  type DealerIntelligenceAPIResponse,
} from '@/lib/dealer/intelligence';
import {
  computeFeaturedScore,
  type ListingScoreInput,
} from '@/lib/featured/scoring';

export const dynamic = 'force-dynamic';

const LISTING_SELECT =
  'id, item_type, price_value, price_currency, cert_type, images, status, is_available, is_sold, first_seen_at, is_initial_import, smith, tosogu_maker, school, tosogu_school, era, province, description, nagasa_cm, sori_cm, motohaba_cm, tosogu_height_cm, tosogu_width_cm, artisan_id, artisan_elite_factor, artisan_elite_count, artisan_designation_factor, artisan_confidence, dealer_id, source';

const MAX_IDS = 100;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Cache percentiles + sorted scores in memory (refresh every hour)
let percentileCache: {
  p10: number; p25: number; p50: number;
  sortedScores: number[];
  totalCount: number;
  cachedAt: number;
} | null = null;
const PERCENTILE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/dealer/listings/intelligence?listingIds=1,2,3
 * Returns per-listing intelligence data for the dealer's own listings.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await verifyDealer(supabase);
  if (!auth.isDealer) {
    return NextResponse.json(
      { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
      { status: auth.error === 'unauthorized' ? 401 : 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('listingIds') || '';
  const listingIds = idsParam
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n > 0)
    .slice(0, MAX_IDS);

  if (listingIds.length === 0) {
    const emptyResponse: DealerIntelligenceAPIResponse = {
      listings: {},
      percentiles: { p10: 0, p25: 0, p50: 0 },
      totalListings: 0,
    };
    return NextResponse.json(emptyResponse);
  }

  const serviceClient = createServiceClient();

  // 1. Fetch listings + verify ownership (dealer_id match + source='dealer')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: listings, error: fetchErr } = await (serviceClient.from('listings') as any)
    .select(LISTING_SELECT)
    .in('id', listingIds)
    .eq('dealer_id', auth.dealerId)
    .eq('source', 'dealer') as { data: (ListingScoreInput & { dealer_id: number; source: string; is_available: boolean; is_sold: boolean; status: string; tosogu_height_cm?: number; tosogu_width_cm?: number })[] | null; error: unknown };

  if (fetchErr || !listings) {
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }

  // Filter to only IDs that belong to this dealer (double-check)
  const ownedListings = listings.filter(l => l.dealer_id === auth.dealerId);
  const ownedIds = ownedListings.map(l => l.id);

  // 2. Compute completeness (pure functions, no DB)
  const completenessMap = new Map<number, ReturnType<typeof computeListingCompleteness>>();

  for (const listing of ownedListings) {
    completenessMap.set(listing.id, computeListingCompleteness({
      ...listing,
      images: Array.isArray(listing.images) ? listing.images : null,
    }));
  }

  // 3. Fetch score percentiles + sorted scores (cached hourly)
  const scoreData = await getScoreData(serviceClient);
  const percentiles = { p10: scoreData.p10, p25: scoreData.p25, p50: scoreData.p50 };

  // 4. Batch-fetch engagement (only for listed items — available or sold)
  const listedIds = ownedListings
    .filter(l => l.is_available || l.is_sold)
    .map(l => l.id);

  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
  let engagementMap = new Map<number, { views: number; favorites: number; clicks: number; quickviews: number; pinch_zooms: number }>();

  if (listedIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: engData } = await (serviceClient.rpc as any)('get_batch_listing_engagement', {
      p_listing_ids: listedIds,
      p_since: thirtyDaysAgo,
    });

    if (engData && Array.isArray(engData)) {
      for (const row of engData) {
        engagementMap.set(row.listing_id, {
          views: row.views || 0,
          favorites: row.favorites || 0,
          clicks: row.clicks || 0,
          quickviews: row.quickviews || 0,
          pinch_zooms: row.pinch_zooms || 0,
        });
      }
    }
  }

  // 5. Batch-count interested collectors
  let interestedMap = new Map<number, number>();
  if (ownedIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: matchData } = await (serviceClient.rpc as any)('count_matching_saved_searches', {
      p_listing_ids: ownedIds,
    });

    if (matchData && Array.isArray(matchData)) {
      for (const row of matchData) {
        interestedMap.set(row.listing_id, row.match_count || 0);
      }
    }
  }

  // 6. Assemble response
  const result: DealerIntelligenceAPIResponse = {
    listings: {},
    percentiles,
    totalListings: scoreData.totalCount,
  };

  for (const listing of ownedListings) {
    const eng = engagementMap.get(listing.id);
    const heatScore = eng
      ? Math.min(eng.favorites * 15, 60) +
        Math.min(eng.clicks * 10, 40) +
        Math.min(eng.quickviews * 3, 24) +
        Math.min(eng.views * 1, 20) +
        Math.min(eng.pinch_zooms * 8, 16)
      : 0;

    const estimatedScore = computeFeaturedScore(listing, heatScore);

    result.listings[listing.id] = {
      completeness: completenessMap.get(listing.id)!,
      scorePreview: {
        estimatedScore,
        rankBucket: scoreToRankBucket(estimatedScore, percentiles.p10, percentiles.p25, percentiles.p50),
        estimatedPosition: estimatePosition(estimatedScore, scoreData.sortedScores),
        totalListings: scoreData.totalCount,
      },
      engagement: eng ? {
        views: eng.views,
        favorites: eng.favorites,
        clicks: eng.clicks,
        quickviews: eng.quickviews,
        heatScore,
        heatTrend: heatToTrend(heatScore),
      } : null,
      interestedCollectors: interestedMap.get(listing.id) ?? 0,
    };
  }

  return NextResponse.json(result);
}

/**
 * Get featured score percentiles + sorted score array for position estimation.
 * Cached in module-level memory, refreshed hourly.
 */
async function getScoreData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceClient: any
): Promise<{ p10: number; p25: number; p50: number; sortedScores: number[]; totalCount: number }> {
  if (percentileCache && Date.now() - percentileCache.cachedAt < PERCENTILE_TTL_MS) {
    return {
      p10: percentileCache.p10,
      p25: percentileCache.p25,
      p50: percentileCache.p50,
      sortedScores: percentileCache.sortedScores,
      totalCount: percentileCache.totalCount,
    };
  }

  // Fetch all available listing scores, sorted descending
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (serviceClient.from('listings') as any)
    .select('featured_score')
    .eq('is_available', true)
    .not('featured_score', 'is', null)
    .gt('featured_score', 0)
    .order('featured_score', { ascending: false });

  if (error || !data || data.length === 0) {
    return { p10: 100, p25: 50, p50: 20, sortedScores: [], totalCount: 0 };
  }

  const scores: number[] = data.map((r: { featured_score: number }) => r.featured_score);
  const p10 = scores[Math.floor(scores.length * 0.1)] ?? 100;
  const p25 = scores[Math.floor(scores.length * 0.25)] ?? 50;
  const p50 = scores[Math.floor(scores.length * 0.5)] ?? 20;

  percentileCache = { p10, p25, p50, sortedScores: scores, totalCount: scores.length, cachedAt: Date.now() };
  return { p10, p25, p50, sortedScores: scores, totalCount: scores.length };
}
