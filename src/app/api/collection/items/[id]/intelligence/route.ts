/**
 * GET /api/collection/items/[id]/intelligence
 *
 * Returns dealer intelligence data for a collection item that hasn't been
 * promoted to a listing yet. Computes completeness, estimates featured score
 * (with elite stats from Yuhinkai), and counts matching saved searches in JS.
 *
 * Used by the PromoteToListingModal to show dealers what their item's
 * feed position and alert reach would look like once listed.
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { NextRequest, NextResponse } from 'next/server';
import {
  computeListingCompleteness,
  scoreToRankBucket,
  estimatePosition,
} from '@/lib/dealer/intelligence';
import {
  computeFeaturedScore,
  getArtisanEliteStats,
  type ListingScoreInput,
} from '@/lib/featured/scoring';
import { getScoreData } from '@/lib/dealer/percentileCache';
import { selectCollectionItemSingle } from '@/lib/supabase/collectionItems';

export const dynamic = 'force-dynamic';

// Fields needed from collection_items for completeness + score estimation
const COLLECTION_ITEM_SELECT =
  'id, item_uuid, owner_id, item_type, item_category, price_value, price_currency, cert_type, images, smith, tosogu_maker, school, tosogu_school, era, province, description, nagasa_cm, sori_cm, motohaba_cm, height_cm, width_cm, artisan_id, artisan_confidence, source_listing_id';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const auth = await verifyDealer(supabase);
  if (!auth.isDealer) {
    return NextResponse.json(
      { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
      { status: auth.error === 'unauthorized' ? 401 : 403 }
    );
  }

  const serviceClient = createServiceClient();

  // 1. Fetch the collection item and verify ownership
  const { data: item, error: fetchErr } = await selectCollectionItemSingle(
    serviceClient, 'id', id, COLLECTION_ITEM_SELECT
  );

  if (fetchErr || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  if (item.owner_id !== auth.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Compute completeness (treat as dealer source for "Ask" price detection)
  const completeness = computeListingCompleteness({
    ...item,
    images: Array.isArray(item.images) ? item.images : null,
    source: 'dealer',
  });

  // 3. Fetch elite stats from Yuhinkai if artisan is set
  let artisanEliteFactor = 0;
  let artisanEliteCount = 0;
  let artisanDesignationFactor = 0;

  if (item.artisan_id) {
    const eliteStats = await getArtisanEliteStats(item.artisan_id);
    if (eliteStats) {
      artisanEliteFactor = eliteStats.elite_factor;
      artisanEliteCount = eliteStats.elite_count;
      artisanDesignationFactor = eliteStats.designation_factor;
    }
  }

  // 4. Estimate featured score — simulate as a brand-new genuine listing
  const scoreInput: ListingScoreInput = {
    id: 0, // placeholder — not a real listing yet
    artisan_id: item.artisan_id ?? null,
    artisan_elite_factor: artisanEliteFactor,
    artisan_elite_count: artisanEliteCount,
    artisan_designation_factor: artisanDesignationFactor,
    artisan_confidence: item.artisan_confidence ?? null,
    cert_type: item.cert_type ?? null,
    price_value: item.price_value ?? null,
    price_currency: item.price_currency ?? null,
    images: Array.isArray(item.images) ? item.images : null,
    first_seen_at: new Date().toISOString(), // treat as brand new
    is_initial_import: false,
    smith: item.smith ?? null,
    tosogu_maker: item.tosogu_maker ?? null,
    school: item.school ?? null,
    tosogu_school: item.tosogu_school ?? null,
    era: item.era ?? null,
    province: item.province ?? null,
    description: item.description ?? null,
    nagasa_cm: item.nagasa_cm ?? null,
    sori_cm: item.sori_cm ?? null,
    motohaba_cm: item.motohaba_cm ?? null,
    tosogu_height_cm: item.height_cm ?? null,
    tosogu_width_cm: item.width_cm ?? null,
  };

  const estimatedScore = computeFeaturedScore(scoreInput, 0); // no engagement yet

  // 5. Get percentile data for ranking
  const scoreData = await getScoreData(serviceClient);
  const percentiles = { p10: scoreData.p10, p25: scoreData.p25, p50: scoreData.p50 };

  // 6. Count matching saved searches (JS-side, mirrors SQL RPC logic)
  let interestedCollectors = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: searches } = await (serviceClient.from('saved_searches') as any)
      .select('id, search_criteria')
      .eq('is_active', true)
      .neq('notification_frequency', 'none');

    if (searches && Array.isArray(searches)) {
      for (const search of searches) {
        const c = search.search_criteria;
        if (!c) continue;

        // item_type match
        if (c.itemTypes && c.itemTypes.length > 0) {
          const itemTypeLower = (item.item_type ?? '').toLowerCase();
          if (!c.itemTypes.some((t: string) => t.toLowerCase() === itemTypeLower)) continue;
        }

        // certification match (with alias expansion, mirrors SQL)
        if (c.certifications && c.certifications.length > 0) {
          const certLower = (item.cert_type ?? '').toLowerCase();
          const matches = c.certifications.some((cert: string) => {
            const cl = cert.toLowerCase();
            if (cl === certLower) return true;
            if (cl === 'juyo' && ['juyo', 'juyo tosogu'].includes(certLower)) return true;
            if (cl === 'hozon' && ['hozon', 'hozon tosogu'].includes(certLower)) return true;
            if (cl === 'tokubetsu hozon' && ['tokubetsu hozon', 'tokubetsu hozon tosogu', 'tokuhozon'].includes(certLower)) return true;
            if (cl === 'tokubetsu juyo' && ['tokubetsu juyo', 'tokuju'].includes(certLower)) return true;
            return false;
          });
          if (!matches) continue;
        }

        // category match
        if (c.category && c.category.length > 0) {
          if (c.category.toLowerCase() !== (item.item_category ?? '').toLowerCase()) continue;
        }

        // price range match
        if (c.minPrice != null && (item.price_value == null || item.price_value < c.minPrice)) continue;
        if (c.maxPrice != null && (item.price_value == null || item.price_value > c.maxPrice)) continue;

        interestedCollectors++;
      }
    }
  } catch {
    // Non-fatal — just show 0
  }

  // 7. Assemble response (same shape as listings intelligence)
  return NextResponse.json({
    listings: {
      [id]: {
        completeness,
        scorePreview: {
          estimatedScore,
          rankBucket: scoreToRankBucket(estimatedScore, percentiles.p10, percentiles.p25, percentiles.p50),
          estimatedPosition: estimatePosition(estimatedScore, scoreData.sortedScores),
          totalListings: scoreData.totalCount,
        },
        engagement: null, // no engagement data yet — item hasn't been listed
        interestedCollectors,
      },
    },
    percentiles,
    totalListings: scoreData.totalCount,
  });
}
