/**
 * Lightweight i18n system for NihontoWatch.
 *
 * No external dependencies — the app has ~500 strings, no translated routes,
 * and no Japanese SEO. A custom t() function with JSON locale files is simpler
 * than next-intl or i18next.
 *
 * Usage:
 *   import { t } from '@/i18n';
 *   t('ja', 'nav.browse')          // → '一覧'
 *   t('en', 'nav.browse')          // → 'Browse'
 *   t('ja', 'listing.count', { n: '42' }) // → '42件の出品'
 */

import en from './locales/en.json';
import ja from './locales/ja.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Locale = 'en' | 'ja';

export const LOCALE_COOKIE = 'nw-locale';
export const SUPPORTED_LOCALES: Locale[] = ['en', 'ja'];
export const DEFAULT_LOCALE: Locale = 'en';

// ---------------------------------------------------------------------------
// Locale data
// ---------------------------------------------------------------------------

const locales: Record<Locale, Record<string, string>> = {
  en: en as Record<string, string>,
  ja: ja as Record<string, string>,
};

// ---------------------------------------------------------------------------
// t() — translate a key with optional interpolation
// ---------------------------------------------------------------------------

/**
 * Look up a translation key for the given locale.
 *
 * Fallback chain: ja.json → en.json → raw key.
 * Supports `{param}` interpolation:
 *   t('ja', 'listing.count', { n: '42' }) → '42件の出品'
 */
export function t(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  let value = locales[locale]?.[key] ?? locales.en[key] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return value;
}

/**
 * Check if a locale string is a supported locale.
 */
export function isLocale(s: string | undefined | null): s is Locale {
  return s === 'en' || s === 'ja';
}
