/**
 * Centralized dealer display name resolution.
 *
 * For JA locale: returns name_ja (verified kanji/kana) when available, falls back to English.
 * For EN locale: returns English name with normalization (underscore cleanup, etc.)
 *
 * Single source of truth — replaces the DEALER_LABELS map that was in FilterContent.tsx.
 */

// English display name overrides (normalization for DB quirks)
const DEALER_LABELS_EN: Record<string, string> = {
  'Nihonto': 'Nihonto.com',
  'Nihonto Art EU': 'Nihonto Art',
  'Ginza_Seikodo': 'Ginza Seikodo',
  'ginza_seikodo': 'Ginza Seikodo',
  'Katana_Ando': 'Katana Ando',
  'katana_ando': 'Katana Ando',
};

/**
 * Get the display name for a dealer based on locale.
 *
 * @param dealer - Object with at least `name` and optionally `name_ja`
 * @param locale - Current locale ('ja' | 'en')
 * @returns The appropriate display name for the locale
 */
export function getDealerDisplayName(
  dealer: { name: string; name_ja?: string | null },
  locale: string
): string {
  if (locale === 'ja' && dealer.name_ja) {
    return dealer.name_ja;
  }
  return DEALER_LABELS_EN[dealer.name] || dealer.name;
}

/**
 * Get the English display name for a dealer (for slugs, SEO, admin, analytics).
 * Always returns English regardless of locale.
 */
export function getDealerDisplayNameEN(
  dealer: { name: string }
): string {
  return DEALER_LABELS_EN[dealer.name] || dealer.name;
}
