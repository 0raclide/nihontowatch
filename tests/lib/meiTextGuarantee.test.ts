import { describe, it, expect } from 'vitest';

/**
 * Tests for mei_text and mei_guaranteed logic.
 *
 * This tests the core business rules:
 * 1. mei_guaranteed auto-defaults to true when cert exists + signed
 * 2. mei_guaranteed auto-defaults to false when no cert + signed
 * 3. mei_guaranteed is null when mumei
 * 4. mei_text is cleared when switching to mumei or tosogu
 * 5. Catalog prefill flows gold_mei_kanji through to meiText
 */

// Replicate the SIGNED_MEI_TYPES set from DealerListingForm.tsx
const SIGNED_MEI_TYPES = new Set(['zaimei', 'kinzogan-mei', 'shumei', 'kinpunmei', 'gakumei', 'orikaeshi-mei']);
const CERT_NONE = 'none';

// Replicate the mei_guaranteed auto-default logic from DealerListingForm.tsx payload builder
function computeMeiGuaranteed(
  category: string,
  meiType: string | null,
  meiGuaranteed: boolean | null,
  certType: string | null,
): boolean | null {
  if (category !== 'nihonto') return null;
  if (!meiType || !SIGNED_MEI_TYPES.has(meiType)) return null;
  return meiGuaranteed ?? (certType && certType !== CERT_NONE ? true : false);
}

function computeMeiText(
  category: string,
  meiType: string | null,
  meiText: string | null,
): string | null {
  if (category !== 'nihonto') return null;
  if (!meiType || !SIGNED_MEI_TYPES.has(meiType)) return null;
  return meiText || null;
}

describe('mei_guaranteed auto-default logic', () => {
  it('returns true when cert exists + signed (zaimei)', () => {
    expect(computeMeiGuaranteed('nihonto', 'zaimei', null, 'juyo')).toBe(true);
  });

  it('returns true for tokubetsu_hozon + kinzogan-mei', () => {
    expect(computeMeiGuaranteed('nihonto', 'kinzogan-mei', null, 'tokubetsu_hozon')).toBe(true);
  });

  it('returns false when no cert + signed', () => {
    expect(computeMeiGuaranteed('nihonto', 'zaimei', null, null)).toBe(false);
  });

  it('returns false when cert is CERT_NONE sentinel + signed', () => {
    expect(computeMeiGuaranteed('nihonto', 'zaimei', null, 'none')).toBe(false);
  });

  it('returns null when mumei (unsigned)', () => {
    expect(computeMeiGuaranteed('nihonto', 'mumei', null, 'juyo')).toBeNull();
  });

  it('returns null when no mei_type selected', () => {
    expect(computeMeiGuaranteed('nihonto', null, null, 'juyo')).toBeNull();
  });

  it('returns null for tosogu category', () => {
    expect(computeMeiGuaranteed('tosogu', 'zaimei', null, 'juyo')).toBeNull();
  });

  it('preserves explicit user override (false with cert)', () => {
    // User manually checked "not guaranteed" even though cert exists
    expect(computeMeiGuaranteed('nihonto', 'zaimei', false, 'juyo')).toBe(false);
  });

  it('respects all signed mei types', () => {
    for (const meiType of SIGNED_MEI_TYPES) {
      const result = computeMeiGuaranteed('nihonto', meiType, null, 'hozon');
      expect(result).toBe(true);
    }
  });
});

describe('mei_text clearing logic', () => {
  it('returns null when switching to mumei', () => {
    expect(computeMeiText('nihonto', 'mumei', '備前国長船住景光')).toBeNull();
  });

  it('returns null when switching to tosogu', () => {
    expect(computeMeiText('tosogu', 'zaimei', '備前国長船住景光')).toBeNull();
  });

  it('preserves mei_text for signed nihonto', () => {
    expect(computeMeiText('nihonto', 'zaimei', '備前国長船住景光')).toBe('備前国長船住景光');
  });

  it('returns null for empty mei_text', () => {
    expect(computeMeiText('nihonto', 'zaimei', '')).toBeNull();
  });

  it('returns null when no mei_type', () => {
    expect(computeMeiText('nihonto', null, '備前国長船住景光')).toBeNull();
  });
});

// Replicate the gated prefill logic from CatalogMatchPanel.handleCardSelect
function catalogPrefillMeiText(
  meiKanji: string | null,
  meiStatus: string | null,
): string | undefined {
  if (meiKanji && meiStatus) {
    const normalized = meiStatus.toLowerCase().trim();
    if (normalized !== 'unsigned') {
      return meiKanji;
    }
  }
  return undefined;
}

describe('catalog prefill: gold_mei_kanji → meiText (unsigned-gated)', () => {
  it('prefills for signed items', () => {
    expect(catalogPrefillMeiText('備前国長船住景光', 'Signed')).toBe('備前国長船住景光');
  });

  it('prefills for kinzogan-mei items', () => {
    expect(catalogPrefillMeiText('本阿弥光悦', 'Kinzogan-Mei')).toBe('本阿弥光悦');
  });

  it('prefills for shu-mei items', () => {
    expect(catalogPrefillMeiText('兼元', 'Shu-Mei')).toBe('兼元');
  });

  it('prefills for gaku-mei items', () => {
    expect(catalogPrefillMeiText('相模国住秋広', 'Gaku-Mei')).toBe('相模国住秋広');
  });

  it('does NOT prefill for unsigned items — mei_kanji is attributed maker, not inscription', () => {
    // 85.3% of unsigned items have mei_kanji = smith_name_kanji (e.g., "正宗")
    // This is the attributed maker, not a physical inscription on the tang
    expect(catalogPrefillMeiText('正宗', 'Unsigned')).toBeUndefined();
  });

  it('does NOT prefill for unsigned items with long kanji', () => {
    expect(catalogPrefillMeiText('古備前正恒', 'unsigned')).toBeUndefined();
  });

  it('does not set meiText when mei_kanji is null', () => {
    expect(catalogPrefillMeiText(null, 'Signed')).toBeUndefined();
  });

  it('does not set meiText when mei_status is null', () => {
    expect(catalogPrefillMeiText('正宗', null)).toBeUndefined();
  });

  it('handles long inscription with date for signed items', () => {
    expect(catalogPrefillMeiText('備前国長船住景光 元亨三年二月日', 'Signed'))
      .toBe('備前国長船住景光 元亨三年二月日');
  });
});

describe('legacy listing handling', () => {
  it('mei_text=null and mei_guaranteed=null display nothing', () => {
    const listing = { mei_text: null, mei_guaranteed: null };
    // Display logic: only show when mei_text is truthy or mei_guaranteed === false
    const showInscription = !!listing.mei_text;
    const showDisclaimer = listing.mei_guaranteed === false;

    expect(showInscription).toBe(false);
    expect(showDisclaimer).toBe(false);
  });
});
