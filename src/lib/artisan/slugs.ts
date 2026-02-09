/**
 * Artisan slug utilities for artist page URLs.
 *
 * URL format: /artists/masamune-MAS590
 * - Human-readable name prefix for SEO
 * - Artisan code suffix for uniqueness
 *
 * Supported code patterns:
 * - 1-4 uppercase letters + 1-5 digits + optional suffix (e.g., MAS590, MYO3, KAN2655A, FUS17.1, MOR358-0)
 * - Underscore codes: PREFIX_SUFFIX + digits (e.g., HAY_MAT1, NAR_TOU1)
 * - NS-* codes (e.g., NS-Goto, NS-Kokinko, NS-Ko-Bizen) — mixed case allowed
 * - NC-* codes (e.g., NC-NOB672A)
 * - tmp-prefixed codes (e.g., tmpAKI811, tmpKAN1272A)
 */

/** Pattern matching known artisan code formats */
const STANDARD_CODE_PATTERN = /^[A-Z]{1,4}\d{1,5}(?:[.\-]\d)?[A-Za-z]?$/;
const UNDERSCORE_CODE_PATTERN = /^[A-Z]+(?:_[A-Z]+)+\d+$/;
const NS_CODE_PATTERN = /^NS-[A-Za-z]+(?:-[A-Za-z]+)*$/;
const NC_CODE_PATTERN = /^NC-[A-Z]+\d+[A-Za-z]?$/;
const TMP_CODE_PATTERN = /^tmp[A-Z]{1,4}\d+[A-Za-z]?$/;

function isArtisanCode(s: string): boolean {
  return (
    STANDARD_CODE_PATTERN.test(s) ||
    UNDERSCORE_CODE_PATTERN.test(s) ||
    NS_CODE_PATTERN.test(s) ||
    NC_CODE_PATTERN.test(s) ||
    TMP_CODE_PATTERN.test(s)
  );
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
 * Uses regex matching against the end of the slug string.
 * Name prefixes are always lowercase, so uppercase patterns reliably indicate the code.
 *
 * @example extractCodeFromSlug('masamune-MAS590') => 'MAS590'
 * @example extractCodeFromSlug('MAS590') => 'MAS590'
 * @example extractCodeFromSlug('goto-ichijo-GOT042') => 'GOT042'
 * @example extractCodeFromSlug('NS-Goto') => 'NS-Goto'
 * @example extractCodeFromSlug('NS-Ko-Bizen') => 'NS-Ko-Bizen'
 * @example extractCodeFromSlug('myoju-MYO3') => 'MYO3'
 * @example extractCodeFromSlug('moritsugu-MOR358-0') => 'MOR358-0'
 * @example extractCodeFromSlug('fusanobu-FUS17.1') => 'FUS17.1'
 * @example extractCodeFromSlug('kanetsugu-KAN2655A') => 'KAN2655A'
 */
export function extractCodeFromSlug(slug: string): string | null {
  // Try NS-* pattern first (contains hyphens, so needs special handling)
  const nsMatch = slug.match(/NS-[A-Za-z]+(?:-[A-Za-z]+)*$/);
  if (nsMatch) return nsMatch[0];

  // Try NC-* pattern
  const ncMatch = slug.match(/NC-[A-Z]+\d+[A-Za-z]?$/);
  if (ncMatch) return ncMatch[0];

  // Try tmp-prefixed pattern
  const tmpMatch = slug.match(/tmp[A-Z]{1,4}\d+[A-Za-z]?$/);
  if (tmpMatch) return tmpMatch[0];

  // Try underscore codes (e.g., HAY_MAT1)
  const uscoreMatch = slug.match(/[A-Z]+(?:_[A-Z]+)+\d+$/);
  if (uscoreMatch) return uscoreMatch[0];

  // Standard code: 1-4 uppercase + 1-5 digits + optional .N or -N suffix + optional letter
  const stdMatch = slug.match(/[A-Z]{1,4}\d{1,5}(?:[.\-]\d)?[A-Za-z]?$/);
  if (stdMatch) return stdMatch[0];

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
