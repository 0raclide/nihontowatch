/**
 * GDPR Region Detection
 *
 * EU/EEA (27 + 3) + UK country codes for geo-gating the cookie consent banner.
 * Used by middleware (edge) and client-side helpers.
 */

/** Cookie name for GDPR region flag (set by middleware) */
export const GDPR_COOKIE = 'nw-gdpr';

/**
 * ISO 3166-1 alpha-2 codes for GDPR jurisdictions:
 * - 27 EU member states
 * - 3 EEA non-EU (Iceland, Liechtenstein, Norway)
 * - UK (post-Brexit UK GDPR)
 */
export const GDPR_COUNTRY_CODES = new Set([
  // EU-27
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'HR', // Croatia
  'CY', // Cyprus
  'CZ', // Czechia
  'DK', // Denmark
  'EE', // Estonia
  'FI', // Finland
  'FR', // France
  'DE', // Germany
  'GR', // Greece
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LV', // Latvia
  'LT', // Lithuania
  'LU', // Luxembourg
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SK', // Slovakia
  'SI', // Slovenia
  'ES', // Spain
  'SE', // Sweden
  // EEA non-EU
  'IS', // Iceland
  'LI', // Liechtenstein
  'NO', // Norway
  // UK GDPR
  'GB', // United Kingdom
]);

/**
 * Check if a country code falls under GDPR jurisdiction.
 * Returns false for null, empty, or unknown codes (safe default for dev/non-Vercel).
 */
export function isGdprCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  return GDPR_COUNTRY_CODES.has(code.toUpperCase());
}
