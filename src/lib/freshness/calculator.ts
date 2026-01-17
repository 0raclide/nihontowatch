/**
 * Freshness calculation logic
 * Determines confidence level based on available data
 */

import type { FreshnessConfidence, FreshnessSource } from './types';

interface ListingFreshnessInput {
  first_seen_at: string;
  listing_published_at?: string | null;
  freshness_source?: FreshnessSource;
  freshness_confidence?: FreshnessConfidence;
  wayback_first_archive_at?: string | null;
}

interface DealerFreshnessInput {
  catalog_baseline_at?: string | null;
}

interface CalculateFreshnessResult {
  confidence: FreshnessConfidence;
  source: FreshnessSource;
  displayDate: string;
}

/**
 * Calculate freshness confidence for a listing
 *
 * Priority order:
 * 1. Explicit listing_published_at from dealer page → high confidence
 * 2. Wayback Machine verification → high confidence
 * 3. Listed after dealer baseline → high confidence (truly new)
 * 4. Listed before dealer baseline → low confidence (could be old)
 * 5. No baseline established → unknown
 */
export function calculateFreshness(
  listing: ListingFreshnessInput,
  dealer: DealerFreshnessInput
): CalculateFreshnessResult {
  // Already has high-confidence data from DB
  if (listing.freshness_confidence === 'high' && listing.freshness_source) {
    const date =
      listing.listing_published_at ||
      listing.wayback_first_archive_at ||
      listing.first_seen_at;
    return {
      confidence: 'high',
      source: listing.freshness_source,
      displayDate: date,
    };
  }

  // 1. If we have explicit publish date from dealer → high confidence
  if (listing.listing_published_at) {
    return {
      confidence: 'high',
      source: 'dealer_meta',
      displayDate: listing.listing_published_at,
    };
  }

  // 2. If we have Wayback data → high confidence
  if (listing.wayback_first_archive_at) {
    return {
      confidence: 'high',
      source: 'wayback',
      displayDate: listing.wayback_first_archive_at,
    };
  }

  // 3. If listing appeared AFTER dealer baseline → high confidence (truly new)
  if (dealer.catalog_baseline_at) {
    const listingDate = new Date(listing.first_seen_at);
    const baselineDate = new Date(dealer.catalog_baseline_at);

    if (listingDate > baselineDate) {
      return {
        confidence: 'high',
        source: 'inferred',
        displayDate: listing.first_seen_at,
      };
    }

    // 4. Listed before/at baseline → low confidence (was in initial import)
    return {
      confidence: 'low',
      source: 'unknown',
      displayDate: listing.first_seen_at,
    };
  }

  // 5. No baseline established → unknown
  return {
    confidence: 'unknown',
    source: 'unknown',
    displayDate: listing.first_seen_at,
  };
}

/**
 * Determine if a listing needs Wayback verification
 */
export function needsWaybackCheck(listing: ListingFreshnessInput): boolean {
  // Already checked
  if (listing.wayback_first_archive_at) return false;

  // Already has high confidence from other source
  if (listing.freshness_confidence === 'high') return false;

  // Needs verification
  return (
    listing.freshness_confidence === 'low' ||
    listing.freshness_confidence === 'unknown' ||
    !listing.freshness_confidence
  );
}
