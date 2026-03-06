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
      quality: number;
      freshness: number;
      estimatedScore: number;
      rankBucket: RankBucket;
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
}

// ---------------------------------------------------------------------------
// Completeness — 6 actionable criteria
// ---------------------------------------------------------------------------

/** Minimal listing shape needed for completeness computation */
interface CompletenessInput {
  images?: unknown[] | null;
  price_value?: number | null;
  smith?: string | null;
  tosogu_maker?: string | null;
  nagasa_cm?: number | null;
  tosogu_height_cm?: number | null;
  tosogu_width_cm?: number | null;
  description?: string | null;
  cert_type?: string | null;
}

export function computeListingCompleteness(listing: CompletenessInput): DealerCompleteness {
  const hasImages = Array.isArray(listing.images) && listing.images.length > 0;
  const hasPrice = listing.price_value != null && listing.price_value > 0;
  const hasAttribution = !!getAttributionName(listing);
  const hasMeasurements = !!(listing.nagasa_cm || listing.tosogu_height_cm || listing.tosogu_width_cm);
  const hasDescription = !!(listing.description && listing.description.length > 50);
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
