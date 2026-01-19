/**
 * URL Normalization Utilities
 *
 * These utilities normalize URLs for comparison and deduplication purposes.
 * The scraper sometimes discovers the same page via different URL variants
 * (http vs https, with/without www), creating duplicate listings.
 *
 * By normalizing URLs, we can detect and handle these duplicates.
 */

/**
 * Normalizes a URL for comparison/deduplication purposes.
 * Removes:
 * - Protocol (http:// or https://)
 * - www. prefix
 * - Trailing slashes
 *
 * @param url - The URL to normalize
 * @returns Normalized URL string
 *
 * @example
 * normalizeUrl('https://www.example.com/page/')
 * // Returns: 'example.com/page'
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';

  return url
    .replace(/^https?:\/\//, '') // Remove http:// or https://
    .replace(/^www\./, '') // Remove www.
    .replace(/\/+$/, ''); // Remove trailing slashes
}

/**
 * Checks if two URLs point to the same resource (ignoring protocol/www/trailing slashes).
 *
 * @param url1 - First URL
 * @param url2 - Second URL
 * @returns true if URLs point to the same resource
 *
 * @example
 * urlsMatch('http://example.com/page', 'https://www.example.com/page/')
 * // Returns: true
 */
export function urlsMatch(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

/**
 * Listing interface for deduplication
 */
interface DeduplicatableListing {
  id: number;
  url: string;
  first_seen_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Deduplicates listings that have the same normalized URL.
 * When duplicates are found, keeps only the listing with the earliest first_seen_at date.
 *
 * This handles the case where the scraper created duplicate entries due to
 * URL variants (http vs https, with/without www).
 *
 * @param listings - Array of listings to deduplicate
 * @returns Array with duplicates removed (keeping oldest version of each)
 *
 * @example
 * const listings = [
 *   { id: 1, url: 'http://example.com/item', first_seen_at: '2026-01-17' },
 *   { id: 2, url: 'https://example.com/item', first_seen_at: '2026-01-02' },
 * ];
 * deduplicateListings(listings)
 * // Returns: [{ id: 2, ... }] (keeps the older one)
 */
export function deduplicateListings<T extends DeduplicatableListing>(
  listings: T[]
): T[] {
  if (!listings || listings.length === 0) return [];

  const byNormalizedUrl = new Map<string, T>();

  for (const listing of listings) {
    const normalized = normalizeUrl(listing.url);
    const existing = byNormalizedUrl.get(normalized);

    if (!existing) {
      byNormalizedUrl.set(normalized, listing);
    } else {
      // Keep the older one (earlier first_seen_at)
      const existingDate = existing.first_seen_at
        ? new Date(existing.first_seen_at).getTime()
        : Infinity;
      const currentDate = listing.first_seen_at
        ? new Date(listing.first_seen_at).getTime()
        : Infinity;

      if (currentDate < existingDate) {
        byNormalizedUrl.set(normalized, listing);
      }
    }
  }

  return Array.from(byNormalizedUrl.values());
}

/**
 * Counts duplicate URL groups in a list of listings.
 * Useful for monitoring/logging.
 *
 * @param listings - Array of listings to check
 * @returns Number of duplicate groups found
 */
export function countDuplicateGroups<T extends { url: string }>(
  listings: T[]
): number {
  if (!listings || listings.length === 0) return 0;

  const urlCounts = new Map<string, number>();

  for (const listing of listings) {
    const normalized = normalizeUrl(listing.url);
    urlCounts.set(normalized, (urlCounts.get(normalized) || 0) + 1);
  }

  // Count groups with more than one listing
  let duplicateGroups = 0;
  for (const count of urlCounts.values()) {
    if (count > 1) {
      duplicateGroups++;
    }
  }

  return duplicateGroups;
}
