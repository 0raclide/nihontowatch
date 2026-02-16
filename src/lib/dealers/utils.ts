/**
 * Shared dealer utilities — single source of truth.
 * Replaces duplicate helpers in page.tsx, [slug]/page.tsx, and sitemap.ts.
 */

/** Create a URL-friendly slug from a dealer name. */
export function createDealerSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const FLAG_MAP: Record<string, string> = {
  JP: '\u{1F1EF}\u{1F1F5}',
  Japan: '\u{1F1EF}\u{1F1F5}',
  US: '\u{1F1FA}\u{1F1F8}',
  USA: '\u{1F1FA}\u{1F1F8}',
  UK: '\u{1F1EC}\u{1F1E7}',
  DE: '\u{1F1E9}\u{1F1EA}',
  Germany: '\u{1F1E9}\u{1F1EA}',
  Italy: '\u{1F1EE}\u{1F1F9}',
  IT: '\u{1F1EE}\u{1F1F9}',
  Australia: '\u{1F1E6}\u{1F1FA}',
  AU: '\u{1F1E6}\u{1F1FA}',
};

/** Return an emoji flag for a country code / name. */
export function getCountryFlag(country: string): string {
  return FLAG_MAP[country] || '\u{1F310}';
}

/** Classify a country as 'Japan' or 'International'. */
export function getCountryRegion(country: string): 'Japan' | 'International' {
  return country === 'Japan' || country === 'JP' ? 'Japan' : 'International';
}

const DISPLAY_NAMES: Record<string, string> = {
  JP: 'Japan',
  Japan: 'Japan',
  US: 'United States',
  USA: 'United States',
  UK: 'United Kingdom',
  DE: 'Germany',
  Germany: 'Germany',
  Italy: 'Italy',
  IT: 'Italy',
  Australia: 'Australia',
  AU: 'Australia',
};

/** Human-readable country display name. */
export function getCountryDisplayName(country: string): string {
  return DISPLAY_NAMES[country] || country;
}

/**
 * Derive country from dealer domain.
 * International dealers are explicitly mapped; everything else defaults to Japan.
 */
const INTERNATIONAL_DOMAINS: Record<string, string> = {
  'giuseppepiva.com': 'Italy',
  'legacyswords.com': 'USA',
  'nihonto.com': 'USA',
  'nihontoart.com': 'USA',
  'nihonto.com.au': 'Australia',
  'nihontocraft.com': 'USA',
  'swordsofjapan.com': 'USA',
  'tetsugendo.com': 'USA',
};

export function getCountryFromDomain(domain: string): string {
  return INTERNATIONAL_DOMAINS[domain] || 'Japan';
}

/** Format an item type slug for display (e.g. "fuchi_kashira" → "Fuchi Kashira"). */
export function formatItemType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
