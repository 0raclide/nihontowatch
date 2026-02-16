/**
 * Shared cert validation with defense-in-depth.
 *
 * The LLM extractor in Oshi-scrapper sometimes misclassifies cert_type when
 * dealer pages contain rich editorial content mentioning certifications of
 * OTHER swords (e.g. "resembles a Juyo Norishige" or "Shizu has 14 Tokubetsu
 * Juyo"). This module provides display-level protection against such
 * false-positive extractions.
 */

export type CertTier = 'tokuju' | 'jubi' | 'juyo' | 'tokuho' | 'hozon';

export interface CertInfo {
  label: string;
  tier: CertTier;
}

export const CERT_LABELS: Record<string, CertInfo> = {
  // Tokubetsu Juyo - highest tier (purple)
  Tokuju: { label: 'Tokuju', tier: 'tokuju' },
  tokuju: { label: 'Tokuju', tier: 'tokuju' },
  tokubetsu_juyo: { label: 'Tokuju', tier: 'tokuju' },
  // Juyo Bijutsuhin - Important Cultural Property (orange/gold)
  'Juyo Bijutsuhin': { label: 'Jubi', tier: 'jubi' },
  JuyoBijutsuhin: { label: 'Jubi', tier: 'jubi' },
  juyo_bijutsuhin: { label: 'Jubi', tier: 'jubi' },
  // Juyo - high tier (blue)
  Juyo: { label: 'Jūyō', tier: 'juyo' },
  juyo: { label: 'Jūyō', tier: 'juyo' },
  // Tokubetsu Hozon - mid tier (brown)
  TokuHozon: { label: 'Tokuho', tier: 'tokuho' },
  tokubetsu_hozon: { label: 'Tokuho', tier: 'tokuho' },
  TokuKicho: { label: 'Tokubetsu Kichō', tier: 'tokuho' },
  // Hozon - standard tier (yellow)
  Hozon: { label: 'Hozon', tier: 'hozon' },
  hozon: { label: 'Hozon', tier: 'hozon' },
  nbthk: { label: 'NBTHK', tier: 'hozon' },
  nthk: { label: 'NTHK', tier: 'hozon' },
};

/**
 * Approximate exchange rates to JPY for plausibility checking.
 * These don't need to be exact — they're just thresholds.
 */
const TO_JPY: Record<string, number> = { USD: 150, EUR: 160, GBP: 185, AUD: 95 };

/**
 * Returns cert display info if the listing's cert_type is plausible, or null
 * if it should be suppressed.
 *
 * Defense rules:
 * 1. Cert must be in our known labels map.
 * 2. If the cert appears in the title or URL, trust it (override price check).
 * 3. Tokuju under ¥5M or Juyo under ¥1M → suppress (likely false-positive).
 */
export function getValidatedCertInfo(listing: {
  cert_type?: string | null;
  title?: string | null;
  title_en?: string | null;
  url?: string | null;
  price_value?: number | null;
  price_currency?: string | null;
}): CertInfo | null {
  if (!listing.cert_type) return null;
  const info = CERT_LABELS[listing.cert_type];
  if (!info) return null;

  // Check if cert appears in title or URL — if so, trust it regardless of price
  const title = (listing.title ?? '') + ' ' + (listing.title_en ?? '');
  const url = listing.url ?? '';
  const titleHasCert =
    /tokubetsu[- ]juyo|特別重要刀剣|特別重要刀装具/i.test(title) ||
    /tokubetsu[- _]juyo|tokuju/i.test(url) ||
    (info.tier === 'juyo' && /\bjuyo\b|重要刀剣|重要刀装具/i.test(title));

  if (!titleHasCert) {
    const price = listing.price_value;
    const currency = listing.price_currency;
    if (price && price > 0 && currency) {
      const priceJpy = currency === 'JPY' ? price : price * (TO_JPY[currency] ?? 150);
      if (info.tier === 'tokuju' && priceJpy < 5_000_000) return null;
      if (info.tier === 'juyo' && priceJpy < 1_000_000) return null;
    }
  }

  return info;
}
