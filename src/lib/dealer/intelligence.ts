/**
 * Dealer Per-Listing Intelligence — shared types + pure functions.
 *
 * Completeness uses 6 human-meaningful criteria (actionable for dealers),
 * distinct from the 8-factor internal scoring.ts completeness used for
 * featured_score computation.
 */

import { getAttributionName } from '@/lib/listing/attribution';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DealerCompletenessItem {
  key: string;
  filled: boolean;
  tipKey: string;   // i18n key for the improvement tip
  labelKey: string; // i18n key for the criterion name
}

export interface DealerCompleteness {
  score: number;
  total: 6;
  items: DealerCompletenessItem[];
}

export type HeatTrend = 'hot' | 'warm' | 'cool';

export type RankBucket = 'top10' | 'top25' | 'top50' | 'below';

export interface DealerIntelligenceData {
  completeness: DealerCompleteness;
  heatTrend?: HeatTrend;
  interestedCollectors?: number;
}

export interface DealerIntelligenceAPIResponse {
  listings: Record<number, {
    completeness: DealerCompleteness;
    scorePreview: {
      estimatedScore: number;
      rankBucket: RankBucket;
      estimatedPosition: number;
      totalListings: number;
    };
    engagement: {
      views: number;
      favorites: number;
      clicks: number;
      quickviews: number;
      heatScore: number;
      heatTrend: HeatTrend;
    } | null;
    interestedCollectors: number;
  }>;
  percentiles: { p10: number; p25: number; p50: number };
  totalListings: number;
}

// ---------------------------------------------------------------------------
// Criteria summary — aggregated search criteria from matching saved searches
// ---------------------------------------------------------------------------

export interface CriteriaFacetEntry {
  value: string;
  count: number;
}

export interface CriteriaSummary {
  totalCollectors: number;
  facets: {
    itemTypes: CriteriaFacetEntry[];
    certifications: CriteriaFacetEntry[];
    schools: CriteriaFacetEntry[];
    priceRanges: CriteriaFacetEntry[];
  };
}

// ---------------------------------------------------------------------------
// Completeness — 6 actionable criteria
// ---------------------------------------------------------------------------

/** Minimal listing shape needed for completeness computation */
interface CompletenessInput {
  images?: unknown[] | null;
  price_value?: number | null;
  price_raw?: string | null;
  smith?: string | null;
  tosogu_maker?: string | null;
  artisan_id?: string | null;
  nagasa_cm?: number | null;
  height_cm?: number | null;
  width_cm?: number | null;
  description?: string | null;
  cert_type?: string | null;
  source?: string | null;
}

export function computeListingCompleteness(listing: CompletenessInput): DealerCompleteness {
  const hasImages = Array.isArray(listing.images) && listing.images.length > 0;
  // "Ask" / inquiry items: dealer-created listings with null price_value are intentional
  const isAskPrice = listing.price_value == null && listing.source === 'dealer';
  const hasPrice = (listing.price_value != null && listing.price_value > 0) || isAskPrice;
  const hasAttribution = !!getAttributionName(listing) || !!listing.artisan_id;
  const hasMeasurements = !!(listing.nagasa_cm || listing.height_cm || listing.width_cm);
  const hasDescription = !!(listing.description && listing.description.length > 10);
  const hasCert = !!listing.cert_type;

  const items: DealerCompletenessItem[] = [
    { key: 'images', filled: hasImages, tipKey: 'dealer.intel.tipImages', labelKey: 'dealer.intel.images' },
    { key: 'price', filled: hasPrice, tipKey: 'dealer.intel.tipPrice', labelKey: 'dealer.intel.price' },
    { key: 'attribution', filled: hasAttribution, tipKey: 'dealer.intel.tipAttribution', labelKey: 'dealer.intel.attribution' },
    { key: 'measurements', filled: hasMeasurements, tipKey: 'dealer.intel.tipMeasurements', labelKey: 'dealer.intel.measurements' },
    { key: 'description', filled: hasDescription, tipKey: 'dealer.intel.tipDescription', labelKey: 'dealer.intel.description' },
    { key: 'certification', filled: hasCert, tipKey: 'dealer.intel.tipCert', labelKey: 'dealer.intel.cert' },
  ];

  const score = items.filter(i => i.filled).length;

  return { score, total: 6, items };
}

// ---------------------------------------------------------------------------
// Heat trend
// ---------------------------------------------------------------------------

/**
 * Convert a numeric heat score (0–160) to a human-readable trend label.
 * hot: >= 40 (3+ favorites or active clicks)
 * warm: >= 10 (some engagement)
 * cool: < 10
 */
export function heatToTrend(heat: number): HeatTrend {
  if (heat >= 40) return 'hot';
  if (heat >= 10) return 'warm';
  return 'cool';
}

// ---------------------------------------------------------------------------
// Rank bucket
// ---------------------------------------------------------------------------

/**
 * Map a featured score to a rank bucket using percentile thresholds.
 * p10 = score at the 10th percentile from top (i.e., top 10% cutoff).
 */
export function scoreToRankBucket(
  score: number,
  p10: number,
  p25: number,
  p50: number
): RankBucket {
  if (score >= p10) return 'top10';
  if (score >= p25) return 'top25';
  if (score >= p50) return 'top50';
  return 'below';
}

// ---------------------------------------------------------------------------
// Estimated feed position (binary search, O(log n))
// ---------------------------------------------------------------------------

/**
 * Estimate where a listing would appear in the feed given a descending-sorted
 * array of all current featured scores. Returns a 1-based position.
 *
 * Binary-searches for the first score < `score`. Ties land at the end of
 * the tied group (conservative estimate).
 */
export function estimatePosition(score: number, sortedScoresDesc: number[]): number {
  if (sortedScoresDesc.length === 0) return 1;

  let lo = 0;
  let hi = sortedScoresDesc.length;
  // Find the first index where sortedScoresDesc[idx] < score
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedScoresDesc[mid] >= score) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  // lo is the count of items with score >= this score
  // Position is 1-based, so position = lo + 1 if this item isn't already
  // in the array — but ties put us at the END of the tied group, so lo is correct
  return lo + 1;
}
