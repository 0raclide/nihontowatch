/**
 * Score Breakdown API
 *
 * GET /api/listing/[id]/score-breakdown
 *
 * Returns the full featured score breakdown for a listing, including
 * quality, heat, freshness sub-components and rank within a filtered feed.
 * Admin-only endpoint for diagnostics.
 */

import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/admin/auth';
import {
  apiSuccess,
  apiBadRequest,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from '@/lib/api/responses';
import {
  computeScoreBreakdown,
  computeFeaturedScore,
  imageCount,
  LISTING_SCORE_SELECT,
  type ListingScoreInput,
} from '@/lib/featured/scoring';
import { LISTING_FILTERS } from '@/lib/constants';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Category → item types mapping (mirrors browse/route.ts)
const NIHONTO_TYPES = [
  'katana', 'wakizashi', 'tanto', 'tachi', 'kodachi',
  'naginata', 'naginata naoshi', 'naginata-naoshi',
  'yari', 'ken', 'daisho',
];

const TOSOGU_TYPES = [
  'tsuba', 'fuchi-kashira', 'fuchi_kashira', 'fuchi', 'kashira',
  'kozuka', 'kogatana', 'kogai', 'menuki',
  'futatokoro', 'mitokoromono', 'koshirae', 'tosogu',
];

const ARMOR_TYPES = [
  'armor', 'yoroi', 'gusoku', 'helmet', 'kabuto',
  'menpo', 'mengu', 'kote', 'suneate', 'do',
  'tanegashima', 'hinawaju',
];

const CERT_VARIANTS: Record<string, string[]> = {
  'Juyo Bijutsuhin': ['Juyo Bijutsuhin', 'JuBi', 'jubi'],
  'Juyo': ['Juyo', 'juyo'],
  'Tokuju': ['Tokuju', 'tokuju', 'Tokubetsu Juyo', 'tokubetsu_juyo'],
  'TokuHozon': ['TokuHozon', 'Tokubetsu Hozon', 'tokubetsu_hozon'],
  'Hozon': ['Hozon', 'hozon'],
  'TokuKicho': ['TokuKicho', 'Tokubetsu Kicho', 'tokubetsu_kicho'],
};

const HEAT_30_DAY_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);

    if (isNaN(listingId) || listingId <= 0) {
      return apiBadRequest('Invalid listing ID');
    }

    // Verify admin
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);
    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    const serviceClient = createServiceClient();
    const thirtyDaysAgo = new Date(Date.now() - HEAT_30_DAY_MS).toISOString();

    // Parse browse filter params for rank context
    const searchParams = request.nextUrl.searchParams;
    const tab = searchParams.get('tab') || 'available';
    const category = searchParams.get('cat') || 'nihonto';
    const certFilter = searchParams.get('cert');
    const dealerFilter = searchParams.get('dealer');

    // Three parallel operations: listing fetch, heat counts, stored score
    const [listingResult, favResult, clickResult, viewResult, qvResult, pzResult] = await Promise.all([
      // A. Fetch listing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (serviceClient.from('listings') as any)
        .select(`${LISTING_SCORE_SELECT}, featured_score`)
        .eq('id', listingId)
        .single(),
      // B. Heat counts (5 parallel)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (serviceClient.from('user_favorites') as any)
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .gte('created_at', thirtyDaysAgo),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (serviceClient.from('dealer_clicks') as any)
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .gte('created_at', thirtyDaysAgo),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (serviceClient.from('listing_views') as any)
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .gte('created_at', thirtyDaysAgo),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (serviceClient.from('activity_events') as any)
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .eq('event_type', 'quickview_open')
        .gte('created_at', thirtyDaysAgo),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (serviceClient.from('activity_events') as any)
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .eq('event_type', 'image_pinch_zoom')
        .gte('created_at', thirtyDaysAgo),
    ]);

    if (listingResult.error || !listingResult.data) {
      return apiNotFound(`Listing ${listingId}`);
    }

    const listing = listingResult.data as ListingScoreInput & { featured_score: number | null };

    // Compute breakdown
    const breakdown = computeScoreBreakdown(listing);

    // Compute heat
    const favorites = favResult.count ?? 0;
    const clicks = clickResult.count ?? 0;
    const views = viewResult.count ?? 0;
    const quickviews = qvResult.count ?? 0;
    const pinchZooms = pzResult.count ?? 0;

    const heatItems = [
      { metric: 'Favorites', raw: favorites, weight: 15, contribution: Math.min(favorites * 15, 60), cap: 60 },
      { metric: 'Clicks', raw: clicks, weight: 10, contribution: Math.min(clicks * 10, 40), cap: 40 },
      { metric: 'QuickViews', raw: quickviews, weight: 3, contribution: Math.min(quickviews * 3, 24), cap: 24 },
      { metric: 'Views', raw: views, weight: 1, contribution: Math.min(views * 1, 20), cap: 20 },
      { metric: 'Pinch Zooms', raw: pinchZooms, weight: 8, contribution: Math.min(pinchZooms * 8, 16), cap: 16 },
    ];

    const heatTotal = heatItems.reduce((sum, h) => sum + h.contribution, 0);

    // Compute score
    const hasImages = imageCount(listing) > 0;
    const computedScore = hasImages
      ? Math.round((breakdown.quality.total + heatTotal) * breakdown.freshness.multiplier * 100) / 100
      : 0;
    const storedScore = listing.featured_score;

    // C. Compute rank within filtered feed
    let rank: number | null = null;
    let totalInFeed: number | null = null;

    if (storedScore !== null && storedScore !== undefined) {
      try {
        // Build rank query matching browse API filter logic
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let rankQuery = (serviceClient.from('listings') as any)
          .select('*', { count: 'exact', head: true })
          .gt('featured_score', storedScore)
          .eq('admin_hidden', false);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let totalQuery = (serviceClient.from('listings') as any)
          .select('*', { count: 'exact', head: true })
          .not('featured_score', 'is', null)
          .eq('admin_hidden', false);

        // Status filter
        if (tab === 'available') {
          rankQuery = rankQuery.or('status.eq.available,is_available.eq.true');
          totalQuery = totalQuery.or('status.eq.available,is_available.eq.true');
        } else if (tab === 'sold') {
          rankQuery = rankQuery.or('status.eq.sold,status.eq.presumed_sold,is_sold.eq.true');
          totalQuery = totalQuery.or('status.eq.sold,status.eq.presumed_sold,is_sold.eq.true');
        }

        // Category filter
        const effectiveTypes = category === 'nihonto' ? NIHONTO_TYPES
          : category === 'tosogu' ? TOSOGU_TYPES
          : category === 'armor' ? ARMOR_TYPES
          : undefined;

        if (effectiveTypes?.length) {
          const typeCond = effectiveTypes.map(t => `item_type.ilike.${t}`).join(',');
          rankQuery = rankQuery.or(typeCond);
          totalQuery = totalQuery.or(typeCond);
        }

        // Cert filter
        if (certFilter) {
          const certs = certFilter.split(',');
          const allVariants = certs.flatMap(c => CERT_VARIANTS[c] || [c]);
          rankQuery = rankQuery.in('cert_type', allVariants);
          totalQuery = totalQuery.in('cert_type', allVariants);
        }

        // Dealer filter
        if (dealerFilter) {
          const dealerIds = dealerFilter.split(',').map(Number);
          rankQuery = rankQuery.in('dealer_id', dealerIds);
          totalQuery = totalQuery.in('dealer_id', dealerIds);
        }

        // Min price filter
        if (LISTING_FILTERS.MIN_PRICE_JPY > 0) {
          rankQuery = rankQuery.or(`price_value.is.null,price_jpy.gte.${LISTING_FILTERS.MIN_PRICE_JPY}`);
          totalQuery = totalQuery.or(`price_value.is.null,price_jpy.gte.${LISTING_FILTERS.MIN_PRICE_JPY}`);
        }

        // Exclude non-collectibles
        rankQuery = rankQuery.not('item_type', 'ilike', 'stand').not('item_type', 'ilike', 'book').not('item_type', 'ilike', 'other');
        totalQuery = totalQuery.not('item_type', 'ilike', 'stand').not('item_type', 'ilike', 'book').not('item_type', 'ilike', 'other');

        const [rankResult, totalResult] = await Promise.all([rankQuery, totalQuery]);

        rank = (rankResult.count ?? 0) + 1;
        totalInFeed = totalResult.count ?? 0;
      } catch (err) {
        logger.logError('[score-breakdown] Rank query failed', err, { listingId });
      }
    }

    return apiSuccess({
      listingId,
      breakdown,
      heat: { total: heatTotal, max: 160, items: heatItems },
      score: {
        computed: computedScore,
        stored: storedScore,
        stale: storedScore !== null && Math.abs(computedScore - storedScore) > 0.01,
        hasImages,
      },
      rank: rank !== null ? { position: rank, total: totalInFeed, filters: { tab, category, cert: certFilter, dealer: dealerFilter } } : null,
      formula: {
        expression: `(${breakdown.quality.total} + ${heatTotal}) × ${breakdown.freshness.multiplier}`,
        result: computedScore,
      },
    });
  } catch (error) {
    logger.logError('Score breakdown error', error);
    return apiServerError();
  }
}
