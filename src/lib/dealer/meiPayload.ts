/**
 * Pure functions for mei_text / mei_guaranteed payload logic.
 *
 * Extracted from DealerListingForm.tsx and CatalogMatchPanel.tsx so tests
 * exercise the real code paths instead of copy-pasted reimplementations.
 */

/** Mei types that indicate the item is signed (has a physical inscription). */
export const SIGNED_MEI_TYPES = new Set([
  'zaimei',
  'kinzogan-mei',
  'shumei',
  'kinpunmei',
  'gakumei',
  'orikaeshi-mei',
]);

/**
 * Compute the mei_text value for the listing payload.
 * Returns null for unsigned or empty text.
 */
export function computeMeiText(
  meiType: string | null,
  meiText: string | null,
): string | null {
  if (!meiType || !SIGNED_MEI_TYPES.has(meiType)) return null;
  return meiText || null;
}

/**
 * Compute the mei_guaranteed value for the listing payload.
 * Auto-defaults: true when cert exists + signed, false when no cert + signed.
 * Returns null for unsigned.
 *
 * @param certNone - The sentinel value for "no certification" (e.g. 'none').
 *   Passed as param to avoid importing UI constants.
 */
export function computeMeiGuaranteed(
  meiType: string | null,
  meiGuaranteed: boolean | null,
  certType: string | null,
  certNone: string,
): boolean | null {
  if (!meiType || !SIGNED_MEI_TYPES.has(meiType)) return null;
  return meiGuaranteed ?? (certType && certType !== certNone ? true : false);
}

/**
 * Determine whether to prefill mei_kanji from a Yuhinkai catalog card.
 * For unsigned items, gold_mei_kanji contains the attributed maker's name,
 * not a physical inscription — so we skip prefill.
 *
 * Returns the kanji string to prefill, or undefined to skip.
 */
export function shouldPrefillMeiKanji(
  meiKanji: string | null | undefined,
  meiStatus: string | null | undefined,
): string | undefined {
  if (meiKanji && meiStatus) {
    const normalized = meiStatus.toLowerCase().trim();
    if (normalized !== 'unsigned') {
      return meiKanji;
    }
  }
  return undefined;
}
