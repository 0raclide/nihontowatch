/**
 * Freshness display formatting
 * Handles UI text and icon decisions
 */

import type {
  FreshnessConfidence,
  FreshnessSource,
  FreshnessDisplayResult,
  MarketTimeDisplay,
  MarketTimeTier,
} from './types';

interface Listing {
  first_seen_at: string;
  listing_published_at?: string | null;
  freshness_source?: FreshnessSource;
  freshness_confidence?: FreshnessConfidence;
  wayback_first_archive_at?: string | null;
}

/**
 * Format time ago string - always shows exact days for precision
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

/**
 * Format freshness for UI display
 *
 * Returns:
 * - text: The display string ("Listed 3 days ago" or "First seen 3 days ago")
 * - show: Whether to show the freshness at all
 * - isVerified: Whether to show verification checkmark
 */
export function formatFreshnessDisplay(listing: Listing): FreshnessDisplayResult {
  const confidence = listing.freshness_confidence || 'unknown';

  // Pick the best available date
  const date =
    listing.listing_published_at ||
    listing.wayback_first_archive_at ||
    listing.first_seen_at;

  const timeAgo = formatTimeAgo(date);

  if (confidence === 'high') {
    return {
      text: `Listed ${timeAgo}`,
      show: true,
      isVerified: true,
    };
  }

  // Medium, low, or unknown - show "First seen" to indicate it's our scrape date
  return {
    text: `First seen ${timeAgo}`,
    show: true,
    isVerified: false,
  };
}

/**
 * Get icon name based on verification status
 */
export function getFreshnessIcon(isVerified: boolean): 'verified' | 'unverified' {
  return isVerified ? 'verified' : 'unverified';
}

/**
 * Get market time display data for listings with high confidence dates.
 * Returns null if freshness_confidence is not 'high'.
 *
 * Time Buckets:
 * - fresh: < 1 day ("Just listed")
 * - recent: 1-7 days ("X days")
 * - standard: 8-30 days ("~X weeks")
 * - aging: 31-180 days ("X months")
 * - long: 181+ days ("Over a year")
 */
export function getMarketTimeDisplay(listing: Listing): MarketTimeDisplay | null {
  // Only show for high confidence data
  if (listing.freshness_confidence !== 'high') {
    return null;
  }

  // Use verified date sources only
  const startDate = listing.listing_published_at || listing.wayback_first_archive_at;
  if (!startDate) {
    return null;
  }

  const date = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle future dates (clock skew) - treat as just listed
  if (diffMs < 0) {
    return {
      label: 'Just listed',
      shortLabel: 'New',
      daysOnMarket: 0,
      tier: 'fresh',
      startDate,
    };
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Determine tier and labels
  let tier: MarketTimeTier;
  let label: string;
  let shortLabel: string;

  if (diffDays < 1) {
    tier = 'fresh';
    label = 'Just listed';
    shortLabel = 'New';
  } else if (diffDays <= 7) {
    tier = 'recent';
    label = diffDays === 1 ? '1 day' : `${diffDays} days`;
    shortLabel = `${diffDays}d`;
  } else if (diffDays <= 30) {
    tier = 'standard';
    const weeks = Math.floor(diffDays / 7);
    label = weeks === 1 ? '~1 week' : `~${weeks} weeks`;
    shortLabel = `${weeks}w`;
  } else if (diffDays <= 180) {
    tier = 'aging';
    const months = Math.floor(diffDays / 30);
    label = months === 1 ? '1 month' : `${months} months`;
    shortLabel = `${months}mo`;
  } else {
    tier = 'long';
    if (diffDays > 365) {
      label = 'Over a year';
      shortLabel = '1y+';
    } else {
      const months = Math.floor(diffDays / 30);
      label = `${months} months`;
      shortLabel = `${months}mo`;
    }
  }

  return {
    label,
    shortLabel,
    daysOnMarket: diffDays,
    tier,
    startDate,
  };
}
