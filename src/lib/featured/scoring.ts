/**
 * Featured Score — shared scoring module
 *
 * Extracted from the cron compute-featured-scores route so that admin
 * mutation endpoints (fix-cert, fix-artisan, hide) can recompute a single
 * listing's score inline without waiting for the next 4-hour cron run.
 *
 * Scoring model:
 *   quality (0-295) = artisan_stature + cert_points + completeness
 *   heat (0-160)    = favorites + dealer_clicks + quickview_opens + views + pinch_zooms
 *   freshness       = multiplier based on listing age (0.3 – 1.4)
 *   featured_score  = (quality + heat) × freshness
 *
 * Listings without images get featured_score = 0.
 */

import { yuhinkaiClient } from '@/lib/supabase/yuhinkai';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CERT_POINTS: Record<string, number> = {
  'Tokuju': 40,
  'Tokubetsu Juyo': 40,
  'tokubetsu_juyo': 40,
  'Juyo': 28,
  'juyo': 28,
  'Juyo Tosogu': 28,
  'TokuHozon': 14,
  'Tokubetsu Hozon': 14,
  'tokubetsu_hozon': 14,
  'Tokubetsu Hozon Tosogu': 14,
  'Hozon': 7,
  'hozon': 7,
  'Hozon Tosogu': 7,
  'Juyo Bijutsuhin': 35,
  'JuBi': 35,
  'TokuKicho': 10,
  'Tokubetsu Kicho': 10,
};

/** Artisan IDs that are catch-all buckets, not real artisan matches */
export const IGNORE_ARTISAN_IDS = new Set(['UNKNOWN', 'unknown']);

/**
 * Rough currency → JPY conversion rates for scoring only.
 * These don't need to be exact — they're used to dampen artisan stature
 * for suspiciously cheap items (a real elite artisan's work ≥ ¥500K).
 */
export const CURRENCY_TO_JPY: Record<string, number> = {
  JPY: 1,
  USD: 150,
  EUR: 160,
  GBP: 190,
  AUD: 100,
  CAD: 110,
  CHF: 170,
  SGD: 110,
  HKD: 19,
  PLN: 38,
};

/** Price (in JPY) at which artisan stature reaches full weight */
export const PRICE_DAMPING_CEILING_JPY = 500_000;

/**
 * Estimate the JPY-equivalent price for scoring purposes.
 * Returns 0 for null price or unknown currency.
 */
export function estimatePriceJpy(
  priceValue: number | null,
  priceCurrency: string | null
): number {
  if (!priceValue || priceValue <= 0) return 0;
  const rate = CURRENCY_TO_JPY[priceCurrency ?? 'JPY'] ?? 0;
  return priceValue * rate;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal listing fields needed for score computation */
export interface ListingScoreInput {
  id: number;
  artisan_id: string | null;
  artisan_elite_factor: number | null;
  artisan_elite_count: number | null;
  cert_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  artisan_confidence: string | null;
  images: unknown;
  first_seen_at: string | null;
  is_initial_import: boolean | null;
  // Completeness fields
  smith: string | null;
  tosogu_maker: string | null;
  school: string | null;
  tosogu_school: string | null;
  era: string | null;
  province: string | null;
  description: string | null;
  nagasa_cm: number | null;
  sori_cm: number | null;
  motohaba_cm: number | null;
  tosogu_height_cm: number | null;
  tosogu_width_cm: number | null;
}

interface EliteSyncOptions {
  syncElite: true;
  artisanId: string;
}

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

export function computeQuality(listing: ListingScoreInput): number {
  const hasRealArtisan = listing.artisan_id && !IGNORE_ARTISAN_IDS.has(listing.artisan_id);
  const eliteFactor = hasRealArtisan ? (listing.artisan_elite_factor ?? 0) : 0;

  const rawArtisanStature = eliteFactor * 200;

  // Price-based damping: cheap items with elite artisan matches are almost certainly
  // wrong attributions. Smooth ramp from 0% at ¥0 to 100% at ¥500K.
  // NULL price (inquiry-based / "Ask") items bypass damping — they're typically expensive.
  const priceJpy = estimatePriceJpy(listing.price_value, listing.price_currency);
  const priceDamping = listing.price_value ? Math.min(priceJpy / PRICE_DAMPING_CEILING_JPY, 1) : 1;
  const artisanStature = rawArtisanStature * priceDamping;

  const certPts = listing.cert_type ? (CERT_POINTS[listing.cert_type] ?? 0) : 0;

  // Completeness sub-score (0–55 pts)
  const imgCount = imageCount(listing);
  const hasAttribution = !!(listing.smith || listing.tosogu_maker);
  const hasMeasurements = !!(listing.nagasa_cm || listing.tosogu_height_cm);
  const hasDesc = !!(listing.description && listing.description.length > 100);
  const hasEra = !!listing.era;
  const hasSchool = !!(listing.school || listing.tosogu_school);

  const completeness =
    Math.min(imgCount * 3, 15) +          // 3 pts per image, max 15 (5+ images)
    (listing.price_value ? 10 : 0) +       // has price
    (hasAttribution ? 8 : 0) +             // has smith/maker
    (hasMeasurements ? 5 : 0) +            // has measurements
    (hasDesc ? 5 : 0) +                    // has description (>100 chars)
    (hasEra ? 4 : 0) +                     // has era/period
    (hasSchool ? 3 : 0) +                  // has school
    (listing.artisan_confidence === 'HIGH' ? 5 : 0); // HIGH confidence match

  return artisanStature + certPts + completeness;
}

export function computeFreshness(listing: ListingScoreInput): number {
  if (listing.is_initial_import) return 1.0;
  if (!listing.first_seen_at) return 1.0;

  const ageMs = Date.now() - new Date(listing.first_seen_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays < 3) return 1.4;
  if (ageDays < 7) return 1.2;
  if (ageDays < 30) return 1.0;
  if (ageDays < 90) return 0.85;
  if (ageDays < 180) return 0.5;
  return 0.3;
}

export function imageCount(listing: ListingScoreInput): number {
  if (!listing.images) return 0;
  if (Array.isArray(listing.images)) return listing.images.length;
  return 0;
}

/**
 * Compute the full featured score given quality, heat, and freshness.
 * Returns 0 if the listing has no images.
 */
export function computeFeaturedScore(
  listing: ListingScoreInput,
  heat: number
): number {
  if (imageCount(listing) === 0) return 0;

  const quality = computeQuality(listing);
  const freshness = computeFreshness(listing);
  return Math.round((quality + heat) * freshness * 100) / 100;
}

// ---------------------------------------------------------------------------
// Score breakdown (for admin diagnostics)
// ---------------------------------------------------------------------------

export interface CompletenessItem {
  label: string;
  active: boolean;
  points: number;
  max: number;
  detail?: string;
}

export interface ScoreBreakdown {
  quality: { total: number; artisanStature: number; certPoints: number; completeness: number };
  artisanDetail: {
    eliteFactor: number;
    eliteFactorPts: number;
    artisanId: string | null;
    isReal: boolean;
    priceDamping: number;
    priceJpy: number;
    rawStature: number;
  };
  certDetail: { certType: string | null; points: number };
  completenessItems: CompletenessItem[];
  freshness: {
    multiplier: number;
    ageDays: number | null;
    bracket: string;
    isInitialImport: boolean;
    firstSeenAt: string | null;
  };
}

/**
 * Decompose a listing's score into its sub-components for diagnostic display.
 * Pure function — no DB access.
 */
export function computeScoreBreakdown(listing: ListingScoreInput): ScoreBreakdown {
  // Artisan stature
  const hasRealArtisan = listing.artisan_id && !IGNORE_ARTISAN_IDS.has(listing.artisan_id);
  const eliteFactor = hasRealArtisan ? (listing.artisan_elite_factor ?? 0) : 0;
  const eliteFactorPts = eliteFactor * 200;
  const rawStature = eliteFactorPts;

  // Price-based damping (mirrors computeQuality)
  const priceJpy = estimatePriceJpy(listing.price_value, listing.price_currency);
  const priceDamping = listing.price_value ? Math.min(priceJpy / PRICE_DAMPING_CEILING_JPY, 1) : 1;
  const artisanStature = rawStature * priceDamping;

  // Cert points
  const certPts = listing.cert_type ? (CERT_POINTS[listing.cert_type] ?? 0) : 0;

  // Completeness
  const imgCount = imageCount(listing);
  const hasAttribution = !!(listing.smith || listing.tosogu_maker);
  const hasMeasurements = !!(listing.nagasa_cm || listing.tosogu_height_cm);
  const hasDesc = !!(listing.description && listing.description.length > 100);
  const hasEra = !!listing.era;
  const hasSchool = !!(listing.school || listing.tosogu_school);
  const hasHighConf = listing.artisan_confidence === 'HIGH';

  const imgPts = Math.min(imgCount * 3, 15);
  const pricePts = listing.price_value ? 10 : 0;
  const attrPts = hasAttribution ? 8 : 0;
  const measPts = hasMeasurements ? 5 : 0;
  const descPts = hasDesc ? 5 : 0;
  const eraPts = hasEra ? 4 : 0;
  const schoolPts = hasSchool ? 3 : 0;
  const confPts = hasHighConf ? 5 : 0;
  const completeness = imgPts + pricePts + attrPts + measPts + descPts + eraPts + schoolPts + confPts;

  const completenessItems: CompletenessItem[] = [
    { label: 'Images', active: imgCount > 0, points: imgPts, max: 15, detail: `${imgCount} image${imgCount !== 1 ? 's' : ''} × 3` },
    { label: 'Price', active: !!listing.price_value, points: pricePts, max: 10 },
    { label: 'Attribution', active: hasAttribution, points: attrPts, max: 8, detail: listing.smith || listing.tosogu_maker || undefined },
    { label: 'Measurements', active: hasMeasurements, points: measPts, max: 5 },
    { label: 'Description', active: hasDesc, points: descPts, max: 5, detail: listing.description ? `${listing.description.length} chars` : undefined },
    { label: 'Era', active: hasEra, points: eraPts, max: 4, detail: listing.era || undefined },
    { label: 'School', active: hasSchool, points: schoolPts, max: 3, detail: listing.school || listing.tosogu_school || undefined },
    { label: 'HIGH confidence', active: hasHighConf, points: confPts, max: 5 },
  ];

  const quality = artisanStature + certPts + completeness;

  // Freshness
  let multiplier: number;
  let ageDays: number | null = null;
  let bracket: string;
  const isInitialImport = !!listing.is_initial_import;

  if (isInitialImport) {
    multiplier = 1.0;
    bracket = 'initial import';
  } else if (!listing.first_seen_at) {
    multiplier = 1.0;
    bracket = 'no date';
  } else {
    const ageMs = Date.now() - new Date(listing.first_seen_at).getTime();
    ageDays = Math.round((ageMs / (1000 * 60 * 60 * 24)) * 10) / 10;
    if (ageDays < 3) { multiplier = 1.4; bracket = '<3 days'; }
    else if (ageDays < 7) { multiplier = 1.2; bracket = '<7 days'; }
    else if (ageDays < 30) { multiplier = 1.0; bracket = '<30 days'; }
    else if (ageDays < 90) { multiplier = 0.85; bracket = '<90 days'; }
    else if (ageDays < 180) { multiplier = 0.5; bracket = '<180 days'; }
    else { multiplier = 0.3; bracket = '≥180 days'; }
  }

  return {
    quality: { total: quality, artisanStature, certPoints: certPts, completeness },
    artisanDetail: {
      eliteFactor,
      eliteFactorPts: Math.round(eliteFactorPts * 100) / 100,
      artisanId: listing.artisan_id,
      isReal: !!hasRealArtisan,
      priceDamping: Math.round(priceDamping * 1000) / 1000,
      priceJpy: Math.round(priceJpy),
      rawStature: Math.round(rawStature * 100) / 100,
    },
    certDetail: { certType: listing.cert_type, points: certPts },
    completenessItems,
    freshness: {
      multiplier,
      ageDays,
      bracket,
      isInitialImport,
      firstSeenAt: listing.first_seen_at,
    },
  };
}

// ---------------------------------------------------------------------------
// Single-listing recompute (for admin mutation endpoints)
// ---------------------------------------------------------------------------

const HEAT_30_DAY_MS = 30 * 24 * 60 * 60 * 1000;

/** Select string for the fields we need from listings */
export const LISTING_SCORE_SELECT =
  'id, artisan_id, artisan_elite_factor, artisan_elite_count, cert_type, price_value, price_currency, artisan_confidence, images, first_seen_at, is_initial_import, smith, tosogu_maker, school, tosogu_school, era, province, description, nagasa_cm, sori_cm, motohaba_cm, tosogu_height_cm, tosogu_width_cm';

/**
 * Fetch elite_factor and elite_count from Yuhinkai for an artisan code.
 * Checks artisan_makers first, then artisan_schools for NS-* codes.
 */
export async function getArtisanEliteStats(artisanCode: string): Promise<{ elite_factor: number; elite_count: number } | null> {
  const { data: artisan } = await yuhinkaiClient
    .from('artisan_makers')
    .select('elite_factor, elite_count')
    .eq('maker_id', artisanCode)
    .single();

  if (artisan?.elite_factor !== undefined) {
    return { elite_factor: artisan.elite_factor, elite_count: artisan.elite_count ?? 0 };
  }

  if (artisanCode.startsWith('NS-')) {
    const { data: school } = await yuhinkaiClient
      .from('artisan_schools')
      .select('elite_factor, elite_count')
      .eq('school_id', artisanCode)
      .single();

    if (school?.elite_factor !== undefined) {
      return { elite_factor: school.elite_factor, elite_count: school.elite_count ?? 0 };
    }
  }

  return null;
}

/**
 * Recompute and persist the featured_score for a single listing.
 *
 * Fetches the listing fields, queries 30-day behavioral data (5 individual
 * count queries scoped to one listing_id), computes the score, and writes
 * `featured_score` back to the listing row.
 *
 * Optionally syncs elite factor/count from Yuhinkai when the artisan has
 * changed (pass `{ syncElite: true, artisanId }` as the third argument).
 *
 * @returns The new score, or null if the listing was not found.
 */
export async function recomputeScoreForListing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  listingId: number,
  options?: EliteSyncOptions
): Promise<number | null> {
  // ---- Optionally sync elite columns from Yuhinkai ----
  if (options?.syncElite && options.artisanId) {
    const eliteStats = await getArtisanEliteStats(options.artisanId);
    if (eliteStats) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: eliteErr } = await (supabase.from('listings') as any)
        .update({
          artisan_elite_factor: eliteStats.elite_factor,
          artisan_elite_count: eliteStats.elite_count,
        })
        .eq('id', listingId);

      if (eliteErr) {
        logger.error('[scoring] Failed to sync elite factor', { listingId, error: eliteErr });
      }
    } else {
      // Artisan not found in Yuhinkai — zero out elite columns
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('listings') as any)
        .update({ artisan_elite_factor: 0, artisan_elite_count: 0 })
        .eq('id', listingId);
    }
  }

  // ---- Fetch the listing (with potentially-updated elite columns) ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: listing, error: fetchErr } = await (supabase.from('listings') as any)
    .select(LISTING_SCORE_SELECT)
    .eq('id', listingId)
    .single() as { data: ListingScoreInput | null; error: { message: string } | null };

  if (fetchErr || !listing) {
    logger.error('[scoring] Listing not found for recompute', { listingId, error: fetchErr });
    return null;
  }

  // ---- Compute heat from 30-day behavioral data ----
  const thirtyDaysAgo = new Date(Date.now() - HEAT_30_DAY_MS).toISOString();

  // Run 5 count queries in parallel, all scoped to this single listing
  const [favResult, clickResult, viewResult, qvResult, pzResult] = await Promise.all([
    // Favorites count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('user_favorites') as any)
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .gte('created_at', thirtyDaysAgo),
    // Dealer clicks count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('dealer_clicks') as any)
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .gte('created_at', thirtyDaysAgo),
    // Views count (listing_views uses viewed_at, not created_at)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('listing_views') as any)
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .gte('viewed_at', thirtyDaysAgo),
    // QuickView opens count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('activity_events') as any)
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .eq('event_type', 'quickview_open')
      .gte('created_at', thirtyDaysAgo),
    // Pinch zooms count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('activity_events') as any)
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .eq('event_type', 'image_pinch_zoom')
      .gte('created_at', thirtyDaysAgo),
  ]);

  const favorites = favResult.count ?? 0;
  const clicks = clickResult.count ?? 0;
  const views = viewResult.count ?? 0;
  const quickviews = qvResult.count ?? 0;
  const pinchZooms = pzResult.count ?? 0;

  const heat =
    Math.min(favorites * 15, 60) +
    Math.min(clicks * 10, 40) +
    Math.min(quickviews * 3, 24) +
    Math.min(views * 1, 20) +
    Math.min(pinchZooms * 8, 16);

  const score = computeFeaturedScore(listing, heat);

  // ---- Persist ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase.from('listings') as any)
    .update({ featured_score: score })
    .eq('id', listingId);

  if (updateErr) {
    logger.error('[scoring] Failed to update featured_score', { listingId, score, error: updateErr });
    return null;
  }

  logger.info('[scoring] Recomputed featured_score', { listingId, score, heat, favorites, clicks, views, quickviews, pinchZooms });
  return score;
}
