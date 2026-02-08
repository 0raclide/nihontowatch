/**
 * Artisan slug utilities for artist page URLs.
 *
 * URL format: /artists/masamune-MAS590
 * - Human-readable name prefix for SEO
 * - Artisan code suffix for uniqueness
 *
 * Supported code patterns:
 * - 2-4 uppercase letters + 2-4 digits (e.g., MAS590, OWA009)
 * - NS-* codes (e.g., NS-Goto, NS-Kokinko) — mixed case allowed
 */

/** Pattern matching known artisan code formats */
const STANDARD_CODE_PATTERN = /^[A-Z]{2,4}\d{2,4}$/;
const NS_CODE_PATTERN = /^NS-[A-Za-z]+$/;

function isArtisanCode(s: string): boolean {
  return STANDARD_CODE_PATTERN.test(s) || NS_CODE_PATTERN.test(s);
}

/**
 * Generate a URL-safe slug from artisan name and code.
 *
 * @example generateArtisanSlug('Masamune', 'MAS590') => 'masamune-MAS590'
 * @example generateArtisanSlug(null, 'MAS590') => 'MAS590'
 * @example generateArtisanSlug('Gotō Ichijō', 'GOT042') => 'goto-ichijo-GOT042'
 * @example generateArtisanSlug('Gotō', 'NS-Goto') => 'NS-Goto' (NS codes have no prefix)
 */
export function generateArtisanSlug(
  nameRomaji: string | null | undefined,
  code: string
): string {
  // NS-* codes are already descriptive enough — no name prefix needed
  if (NS_CODE_PATTERN.test(code)) return code;

  if (!nameRomaji) return code;

  const namePart = nameRomaji
    // Normalize unicode (ō → o, ū → u, etc.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace non-alphanumeric with hyphens
    .replace(/[^a-zA-Z0-9]+/g, '-')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    // Trim leading/trailing hyphens
    .replace(/^-|-$/g, '')
    .toLowerCase();

  if (!namePart) return code;

  return `${namePart}-${code}`;
}

/**
 * Extract the artisan code from a slug.
 * Splits on the last occurrence of a known code pattern.
 *
 * @example extractCodeFromSlug('masamune-MAS590') => 'MAS590'
 * @example extractCodeFromSlug('MAS590') => 'MAS590'
 * @example extractCodeFromSlug('goto-ichijo-GOT042') => 'GOT042'
 * @example extractCodeFromSlug('NS-Goto') => 'NS-Goto'
 */
export function extractCodeFromSlug(slug: string): string | null {
  // Try NS-* pattern first (contains hyphen, so needs special handling)
  const nsMatch = slug.match(/NS-[A-Za-z]+$/);
  if (nsMatch) return nsMatch[0];

  // Split on hyphens and check segments from the end
  const segments = slug.split('-');
  for (let i = segments.length - 1; i >= 0; i--) {
    if (STANDARD_CODE_PATTERN.test(segments[i])) {
      return segments[i];
    }
  }

  // Fallback: if the entire slug looks like a code, return it
  if (isArtisanCode(slug)) {
    return slug;
  }

  return null;
}

/**
 * Check if a string is a bare artisan code (no name prefix).
 * Used for detecting old-format URLs that need redirecting.
 */
export function isBareCode(slug: string): boolean {
  return isArtisanCode(slug);
}
