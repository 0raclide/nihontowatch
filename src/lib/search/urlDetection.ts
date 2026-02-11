/**
 * URL Detection for Search Queries
 *
 * Detects when a user pastes a URL into the search bar (e.g., a dealer listing URL)
 * and normalizes it for ILIKE matching against the listings.url column.
 *
 * This runs as "Step 0" in the search pipeline — before semantic parsing,
 * numeric filters, and FTS — to short-circuit the entire pipeline for URL lookups.
 */

import { normalizeUrl } from '@/lib/urlNormalization';

/**
 * Regex to detect URL-like input.
 * Matches:
 * - Full URLs: https://ginza.choshuya.co.jp/sale/gj/r8/002/02_kunizane.php
 * - Without protocol: ginza.choshuya.co.jp/sale/gj/r8/002/02_kunizane.php
 * - With www: www.aoijapan.com/katana-123
 * - Domain only: choshuya.co.jp
 * - With port: localhost:3000/listing/123
 *
 * Does NOT match:
 * - Plain text: "katana juyo"
 * - Artisan codes: "MAS590"
 * - Japanese text: "備前国住長船"
 * - Numeric filters: "cm>70"
 * - Short input: "ab"
 */
const URL_PATTERN = /^(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z]{2,})+(?::\d+)?(?:\/\S*)?$/;

/**
 * Detects if a search query is a URL and returns the normalized form for DB matching.
 *
 * @param query - Raw search input from the user
 * @returns Normalized URL string (protocol/www/trailing slashes stripped) or null if not a URL
 *
 * @example
 * detectUrlQuery('https://www.choshuya.co.jp/sale/item.php')
 * // Returns: 'choshuya.co.jp/sale/item.php'
 *
 * detectUrlQuery('katana juyo')
 * // Returns: null
 */
export function detectUrlQuery(query: string): string | null {
  if (!query || query.trim().length < 4) return null;

  const trimmed = query.trim();

  // Quick rejection: if it contains spaces, it's not a URL
  if (trimmed.includes(' ')) return null;

  if (URL_PATTERN.test(trimmed)) {
    return normalizeUrl(trimmed);
  }

  return null;
}
