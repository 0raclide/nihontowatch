/**
 * New Listing Indicator Utilities
 *
 * Determines if a listing should display the "New this week" badge.
 *
 * A listing shows the badge if:
 * 1. The dealer is "established" (baseline is at least 7 days old)
 * 2. The listing was discovered AFTER the dealer's baseline (not part of initial import)
 * 3. The listing was discovered within the last 7 days
 *
 * The baseline is the earliest first_seen_at for any listing from a dealer.
 * Items within 24 hours of the baseline are considered part of the initial import.
 * Dealers need to be established for 7+ days before their new listings show badges.
 */

import { NEW_LISTING } from './constants';

/**
 * Calculates the number of days since a given date.
 * Returns Infinity if the date is null/undefined/invalid.
 */
export function daysSince(date: string | null | undefined): number {
  if (!date) return Infinity;

  const parsedDate = new Date(date);

  // Check for invalid date
  if (isNaN(parsedDate.getTime())) {
    return Infinity;
  }

  const now = new Date();
  const diffMs = now.getTime() - parsedDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays;
}

/**
 * Determines if a listing is within the "new" threshold (7 days by default).
 *
 * @param firstSeenAt - The ISO date string when the listing was first scraped
 * @param thresholdDays - Optional override for the threshold (defaults to NEW_LISTING.THRESHOLD_DAYS)
 * @returns true if the listing is within the "new" threshold
 */
export function isNewListing(
  firstSeenAt: string | null | undefined,
  thresholdDays: number = NEW_LISTING.THRESHOLD_DAYS
): boolean {
  const days = daysSince(firstSeenAt);
  return days <= thresholdDays;
}

/**
 * Returns a human-readable string for how recently a listing was added.
 * Only returns a value if the listing is "new" (within threshold).
 *
 * @param firstSeenAt - The ISO date string when the listing was first scraped
 * @returns A relative time string like "2d ago" or null if not new
 */
export function getNewListingLabel(firstSeenAt: string | null | undefined): string | null {
  const days = daysSince(firstSeenAt);

  if (days > NEW_LISTING.THRESHOLD_DAYS) {
    return null;
  }

  if (days < 1) {
    return 'Today';
  }

  if (days < 2) {
    return '1d ago';
  }

  return `${Math.floor(days)}d ago`;
}

/**
 * Checks if a dealer is "established" - i.e., has been in our system long enough
 * to reliably distinguish new listings from initial import.
 *
 * A dealer is established if their baseline (earliest listing) is >= 7 days old.
 * New dealers don't show badges until they've been in the system for a week.
 *
 * @param dealerEarliestSeenAt - The earliest first_seen_at for any listing from this dealer
 * @param thresholdDays - Days required for dealer to be "established" (default 7)
 * @returns true if the dealer is established
 */
export function isDealerEstablished(
  dealerEarliestSeenAt: string | null | undefined,
  thresholdDays: number = NEW_LISTING.THRESHOLD_DAYS
): boolean {
  if (!dealerEarliestSeenAt) return false; // No data = not established

  const baselineDate = new Date(dealerEarliestSeenAt);
  if (isNaN(baselineDate.getTime())) return false;

  const daysSinceBaseline = (Date.now() - baselineDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceBaseline >= thresholdDays;
}

/**
 * Checks if a listing was part of the initial import batch for a dealer.
 * Items discovered within 24 hours of the dealer's baseline are considered
 * part of the initial import.
 *
 * @param listingFirstSeenAt - When this listing was first scraped
 * @param dealerEarliestSeenAt - The earliest first_seen_at for any listing from this dealer
 * @param windowHours - Hours after baseline considered "initial import" (default 24)
 * @returns true if the listing was part of the initial import
 */
export function isPartOfInitialImport(
  listingFirstSeenAt: string | null | undefined,
  dealerEarliestSeenAt: string | null | undefined,
  windowHours: number = NEW_LISTING.INITIAL_IMPORT_WINDOW_HOURS
): boolean {
  if (!listingFirstSeenAt || !dealerEarliestSeenAt) return true; // No data = assume initial

  const listingDate = new Date(listingFirstSeenAt);
  const baselineDate = new Date(dealerEarliestSeenAt);

  if (isNaN(listingDate.getTime()) || isNaN(baselineDate.getTime())) {
    return true; // Invalid dates = assume initial
  }

  const windowMs = windowHours * 60 * 60 * 1000;
  return listingDate.getTime() <= baselineDate.getTime() + windowMs;
}

/**
 * Full check for whether a listing should show the "New this week" badge.
 *
 * Requirements:
 * 1. Dealer must be "established" (baseline >= 7 days old)
 * 2. Listing was discovered AFTER the dealer's initial import window
 * 3. Listing was discovered within the last 7 days
 *
 * @param listingFirstSeenAt - When this listing was first scraped
 * @param dealerEarliestSeenAt - The earliest first_seen_at for any listing from this dealer
 * @param thresholdDays - Optional override for the threshold (default 7 days)
 * @returns true if the listing should show the "New this week" badge
 */
export function shouldShowNewBadge(
  listingFirstSeenAt: string | null | undefined,
  dealerEarliestSeenAt: string | null | undefined,
  thresholdDays: number = NEW_LISTING.THRESHOLD_DAYS
): boolean {
  // Dealer must be established (in system for at least 7 days)
  // This prevents flooding badges for newly onboarded dealers
  if (!isDealerEstablished(dealerEarliestSeenAt, thresholdDays)) {
    return false;
  }

  // Must not be part of initial import (must be genuinely new)
  if (isPartOfInitialImport(listingFirstSeenAt, dealerEarliestSeenAt)) {
    return false;
  }

  // Must be within the threshold (7 days)
  return isNewListing(listingFirstSeenAt, thresholdDays);
}
