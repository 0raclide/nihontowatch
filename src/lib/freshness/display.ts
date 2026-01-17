/**
 * Freshness display formatting
 * Handles UI text and icon decisions
 */

import type {
  FreshnessConfidence,
  FreshnessSource,
  FreshnessDisplayResult,
} from './types';

interface Listing {
  first_seen_at: string;
  listing_published_at?: string | null;
  freshness_source?: FreshnessSource;
  freshness_confidence?: FreshnessConfidence;
  wayback_first_archive_at?: string | null;
}

/**
 * Format time ago string
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
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
