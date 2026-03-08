import { describe, it, expect } from 'vitest';
import {
  SIGNED_MEI_TYPES,
  computeMeiText,
  computeMeiGuaranteed,
  shouldPrefillMeiKanji,
} from '@/lib/dealer/meiPayload';

/**
 * Tests for mei_text and mei_guaranteed logic.
 *
 * These import the REAL functions from meiPayload.ts — no copy-pasted
 * reimplementations. If someone changes the payload builder, these tests
 * catch the regression.
 *
 * Core business rules:
 * 1. mei_guaranteed auto-defaults to true when cert exists + signed
 * 2. mei_guaranteed auto-defaults to false when no cert + signed
 * 3. mei_guaranteed is null when mumei (unsigned)
 * 4. mei_text is cleared when unsigned
 * 5. Catalog prefill flows gold_mei_kanji through to meiText (unsigned-gated)
 */

const CERT_NONE = 'none';

describe('SIGNED_MEI_TYPES membership', () => {
  it('contains exactly the 6 signed mei types', () => {
    expect(SIGNED_MEI_TYPES).toEqual(
      new Set(['zaimei', 'kinzogan-mei', 'shumei', 'kinpunmei', 'gakumei', 'orikaeshi-mei'])
    );
  });
});

describe('computeMeiGuaranteed', () => {
  it('returns true when cert exists + signed (zaimei)', () => {
    expect(computeMeiGuaranteed('zaimei', null, 'juyo', CERT_NONE)).toBe(true);
  });

  it('returns true for tokubetsu_hozon + kinzogan-mei', () => {
    expect(computeMeiGuaranteed('kinzogan-mei', null, 'tokubetsu_hozon', CERT_NONE)).toBe(true);
  });

  it('returns false when no cert + signed', () => {
    expect(computeMeiGuaranteed('zaimei', null, null, CERT_NONE)).toBe(false);
  });

  it('returns false when cert is CERT_NONE sentinel + signed', () => {
    expect(computeMeiGuaranteed('zaimei', null, 'none', CERT_NONE)).toBe(false);
  });

  it('returns null when mumei (unsigned)', () => {
    expect(computeMeiGuaranteed('mumei', null, 'juyo', CERT_NONE)).toBeNull();
  });

  it('returns null when no mei_type selected', () => {
    expect(computeMeiGuaranteed(null, null, 'juyo', CERT_NONE)).toBeNull();
  });

  it('preserves explicit user override (false with cert)', () => {
    expect(computeMeiGuaranteed('zaimei', false, 'juyo', CERT_NONE)).toBe(false);
  });

  it('respects all signed mei types', () => {
    for (const meiType of SIGNED_MEI_TYPES) {
      const result = computeMeiGuaranteed(meiType, null, 'hozon', CERT_NONE);
      expect(result).toBe(true);
    }
  });
});

describe('computeMeiText', () => {
  it('returns null when switching to mumei', () => {
    expect(computeMeiText('mumei', '備前国長船住景光')).toBeNull();
  });

  it('preserves mei_text for signed item', () => {
    expect(computeMeiText('zaimei', '備前国長船住景光')).toBe('備前国長船住景光');
  });

  it('returns null for empty mei_text', () => {
    expect(computeMeiText('zaimei', '')).toBeNull();
  });

  it('returns null when no mei_type', () => {
    expect(computeMeiText(null, '備前国長船住景光')).toBeNull();
  });
});

describe('shouldPrefillMeiKanji (catalog prefill, unsigned-gated)', () => {
  it('prefills for signed items', () => {
    expect(shouldPrefillMeiKanji('備前国長船住景光', 'Signed')).toBe('備前国長船住景光');
  });

  it('prefills for kinzogan-mei items', () => {
    expect(shouldPrefillMeiKanji('本阿弥光悦', 'Kinzogan-Mei')).toBe('本阿弥光悦');
  });

  it('prefills for shu-mei items', () => {
    expect(shouldPrefillMeiKanji('兼元', 'Shu-Mei')).toBe('兼元');
  });

  it('prefills for gaku-mei items', () => {
    expect(shouldPrefillMeiKanji('相模国住秋広', 'Gaku-Mei')).toBe('相模国住秋広');
  });

  it('does NOT prefill for unsigned items — mei_kanji is attributed maker, not inscription', () => {
    expect(shouldPrefillMeiKanji('正宗', 'Unsigned')).toBeUndefined();
  });

  it('does NOT prefill for unsigned items with long kanji', () => {
    expect(shouldPrefillMeiKanji('古備前正恒', 'unsigned')).toBeUndefined();
  });

  it('does not set meiText when mei_kanji is null', () => {
    expect(shouldPrefillMeiKanji(null, 'Signed')).toBeUndefined();
  });

  it('does not set meiText when mei_status is null', () => {
    expect(shouldPrefillMeiKanji('正宗', null)).toBeUndefined();
  });

  it('handles long inscription with date for signed items', () => {
    expect(shouldPrefillMeiKanji('備前国長船住景光 元亨三年二月日', 'Signed'))
      .toBe('備前国長船住景光 元亨三年二月日');
  });
});

describe('legacy listing handling', () => {
  it('mei_text=null and mei_guaranteed=null display nothing', () => {
    const listing = { mei_text: null, mei_guaranteed: null };
    const showInscription = !!listing.mei_text;
    const showDisclaimer = listing.mei_guaranteed === false;

    expect(showInscription).toBe(false);
    expect(showDisclaimer).toBe(false);
  });
});
