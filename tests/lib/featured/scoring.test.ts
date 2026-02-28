/**
 * Tests for Featured Score Scoring Module
 *
 * Verifies the scoring math used for browse default sort order.
 * These functions are shared between the 4-hour cron batch recompute
 * and the inline admin recompute (fix-cert, fix-artisan, hide).
 */

import { describe, it, expect } from 'vitest';
import {
  CERT_POINTS,
  IGNORE_ARTISAN_IDS,
  CURRENCY_TO_JPY,
  PRICE_DAMPING_CEILING_JPY,
  DESIGNATION_STATURE_MULTIPLIER,
  ARTISAN_STATURE_CAP,
  estimatePriceJpy,
  computeQuality,
  computeFreshness,
  computeFeaturedScore,
  imageCount,
  type ListingScoreInput,
} from '@/lib/featured/scoring';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal listing with all fields null/empty — baseline for targeted tests */
function baseListing(overrides: Partial<ListingScoreInput> = {}): ListingScoreInput {
  return {
    id: 1,
    artisan_id: null,
    artisan_elite_factor: null,
    artisan_elite_count: null,
    artisan_designation_factor: null,
    cert_type: null,
    price_value: null,
    price_currency: null,
    artisan_confidence: null,
    images: [],
    first_seen_at: null,
    is_initial_import: null,
    smith: null,
    tosogu_maker: null,
    school: null,
    tosogu_school: null,
    era: null,
    province: null,
    description: null,
    nagasa_cm: null,
    sori_cm: null,
    motohaba_cm: null,
    tosogu_height_cm: null,
    tosogu_width_cm: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CERT_POINTS
// ---------------------------------------------------------------------------

describe('CERT_POINTS', () => {
  it('assigns highest points to Tokubetsu Juyo variants', () => {
    expect(CERT_POINTS['Tokuju']).toBe(40);
    expect(CERT_POINTS['Tokubetsu Juyo']).toBe(40);
    expect(CERT_POINTS['tokubetsu_juyo']).toBe(40);
  });

  it('assigns Juyo points', () => {
    expect(CERT_POINTS['Juyo']).toBe(28);
    expect(CERT_POINTS['juyo']).toBe(28);
    expect(CERT_POINTS['Juyo Tosogu']).toBe(28);
  });

  it('assigns Tokubetsu Hozon points', () => {
    expect(CERT_POINTS['TokuHozon']).toBe(14);
    expect(CERT_POINTS['Tokubetsu Hozon']).toBe(14);
    expect(CERT_POINTS['tokubetsu_hozon']).toBe(14);
    expect(CERT_POINTS['Tokubetsu Hozon Tosogu']).toBe(14);
  });

  it('assigns Hozon points', () => {
    expect(CERT_POINTS['Hozon']).toBe(7);
    expect(CERT_POINTS['hozon']).toBe(7);
    expect(CERT_POINTS['Hozon Tosogu']).toBe(7);
  });

  it('assigns Juyo Bijutsuhin points', () => {
    expect(CERT_POINTS['Juyo Bijutsuhin']).toBe(35);
    expect(CERT_POINTS['JuBi']).toBe(35);
  });

  it('assigns TokuKicho points', () => {
    expect(CERT_POINTS['TokuKicho']).toBe(10);
    expect(CERT_POINTS['Tokubetsu Kicho']).toBe(10);
  });

  it('returns undefined for unknown cert types', () => {
    expect(CERT_POINTS['not-a-cert']).toBeUndefined();
    expect(CERT_POINTS['']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// IGNORE_ARTISAN_IDS
// ---------------------------------------------------------------------------

describe('IGNORE_ARTISAN_IDS', () => {
  it('contains UNKNOWN (uppercase)', () => {
    expect(IGNORE_ARTISAN_IDS.has('UNKNOWN')).toBe(true);
  });

  it('contains unknown (lowercase)', () => {
    expect(IGNORE_ARTISAN_IDS.has('unknown')).toBe(true);
  });

  it('does not match real artisan codes', () => {
    expect(IGNORE_ARTISAN_IDS.has('MAS590')).toBe(false);
    expect(IGNORE_ARTISAN_IDS.has('TSU001')).toBe(false);
    expect(IGNORE_ARTISAN_IDS.has('NS-SOSHU')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// estimatePriceJpy
// ---------------------------------------------------------------------------

describe('estimatePriceJpy', () => {
  it('returns 0 for null price', () => {
    expect(estimatePriceJpy(null, 'JPY')).toBe(0);
  });

  it('returns 0 for zero price', () => {
    expect(estimatePriceJpy(0, 'JPY')).toBe(0);
  });

  it('returns 0 for negative price', () => {
    expect(estimatePriceJpy(-100, 'JPY')).toBe(0);
  });

  it('returns 0 for unknown currency', () => {
    expect(estimatePriceJpy(1000, 'XYZ')).toBe(0);
  });

  it('defaults to JPY for null currency (most listings are JPY)', () => {
    // Null currency defaults to JPY via nullish coalescing — most Japanese
    // dealers have price_currency = null because prices are implicitly JPY.
    expect(estimatePriceJpy(1000, null)).toBe(1000);
  });

  it('passes through JPY prices', () => {
    expect(estimatePriceJpy(500000, 'JPY')).toBe(500000);
  });

  it('converts USD to JPY', () => {
    expect(estimatePriceJpy(1000, 'USD')).toBe(150000);
  });

  it('converts EUR to JPY', () => {
    expect(estimatePriceJpy(1000, 'EUR')).toBe(160000);
  });

  it('converts GBP to JPY', () => {
    expect(estimatePriceJpy(1000, 'GBP')).toBe(190000);
  });

  it('converts AUD to JPY', () => {
    expect(estimatePriceJpy(1000, 'AUD')).toBe(100000);
  });

  it('converts PLN to JPY', () => {
    expect(estimatePriceJpy(1000, 'PLN')).toBe(38000);
  });
});

// ---------------------------------------------------------------------------
// PRICE_DAMPING_CEILING_JPY
// ---------------------------------------------------------------------------

describe('PRICE_DAMPING_CEILING_JPY', () => {
  it('is 500,000 JPY', () => {
    expect(PRICE_DAMPING_CEILING_JPY).toBe(500000);
  });
});

// ---------------------------------------------------------------------------
// imageCount
// ---------------------------------------------------------------------------

describe('imageCount', () => {
  it('returns 0 for null images', () => {
    expect(imageCount(baseListing({ images: null }))).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(imageCount(baseListing({ images: [] }))).toBe(0);
  });

  it('returns count for non-empty array', () => {
    expect(imageCount(baseListing({ images: ['a.jpg', 'b.jpg'] }))).toBe(2);
  });

  it('returns 0 for non-array truthy value', () => {
    expect(imageCount(baseListing({ images: 'not-an-array' }))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeQuality
// ---------------------------------------------------------------------------

describe('computeQuality', () => {
  it('returns 0 for completely empty listing', () => {
    expect(computeQuality(baseListing())).toBe(0);
  });

  describe('artisan stature (designation_factor)', () => {
    it('uses designation_factor for real artisans (capped at 200)', () => {
      const listing = baseListing({
        artisan_id: 'MAS590',
        artisan_designation_factor: 1.68,
        price_value: 5000000,
        price_currency: 'JPY',
      });
      const quality = computeQuality(listing);
      // stature = min(1.68 * 119, 200) = min(199.92, 200) = 199.92
      // priceDamping = min(5000000 / 500000, 1) = 1.0
      // artisanStature = round(199.92 * 1.0 * 100) / 100 = 199.92
      // completeness: price = 10
      expect(quality).toBeCloseTo(209.92, 1);
    });

    it('caps stature at 200 for very high designation_factor', () => {
      const listing = baseListing({
        artisan_id: 'TOM134',
        artisan_designation_factor: 1.90,
        price_value: 5000000,
        price_currency: 'JPY',
      });
      const quality = computeQuality(listing);
      // stature = min(1.90 * 119, 200) = min(226.1, 200) = 200
      // completeness: price = 10
      expect(quality).toBe(210);
    });

    it('gives meaningful stature for Juyo-only tosogu (designation_factor > 0)', () => {
      const listing = baseListing({
        artisan_id: 'YAS001',
        artisan_designation_factor: 0.81,
        price_value: 1000000,
        price_currency: 'JPY',
      });
      const quality = computeQuality(listing);
      // stature = min(0.81 * 119, 200) = 96.39
      // priceDamping = 1.0
      // completeness: price = 10
      expect(quality).toBeCloseTo(106.39, 1);
    });

    it('ignores UNKNOWN artisan_id', () => {
      const listing = baseListing({
        artisan_id: 'UNKNOWN',
        artisan_designation_factor: 1.0,
      });
      const quality = computeQuality(listing);
      expect(quality).toBe(0);
    });

    it('ignores lowercase unknown artisan_id', () => {
      const listing = baseListing({
        artisan_id: 'unknown',
        artisan_designation_factor: 0.5,
      });
      expect(computeQuality(listing)).toBe(0);
    });

    it('treats null artisan_id as no artisan', () => {
      const listing = baseListing({
        artisan_id: null,
        artisan_designation_factor: 1.0,
      });
      expect(computeQuality(listing)).toBe(0);
    });

    it('handles null designation_factor gracefully', () => {
      const listing = baseListing({
        artisan_id: 'MAS590',
        artisan_designation_factor: null,
        price_value: 5000000,
        price_currency: 'JPY',
      });
      const quality = computeQuality(listing);
      // stature = 0 (null designation_factor defaults to 0)
      // completeness: price = 10
      expect(quality).toBe(10);
    });

    it('elite_factor alone does NOT drive stature', () => {
      const listing = baseListing({
        artisan_id: 'MAS590',
        artisan_elite_factor: 1.0,
        artisan_elite_count: 100,
        artisan_designation_factor: null,
        price_value: 5000000,
        price_currency: 'JPY',
      });
      const quality = computeQuality(listing);
      // designation_factor is null → stature = 0
      // completeness: price = 10
      expect(quality).toBe(10);
    });
  });

  describe('price damping on artisan stature', () => {
    it('dampens artisan stature for cheap items (¥30K)', () => {
      const listing = baseListing({
        artisan_id: 'MAS590',
        artisan_designation_factor: 1.90,
        price_value: 30000,
        price_currency: 'JPY',
      });
      const quality = computeQuality(listing);
      // rawStature = min(1.90 * 119, 200) = 200
      // priceDamping = 30000 / 500000 = 0.06
      // artisanStature = 200 * 0.06 = 12
      // completeness: price = 10
      // total = 12 + 10 = 22
      expect(quality).toBe(22);
    });

    it('partially dampens artisan stature for mid-price items (¥250K)', () => {
      const listing = baseListing({
        artisan_id: 'MAS590',
        artisan_designation_factor: 1.90,
        price_value: 250000,
        price_currency: 'JPY',
      });
      const quality = computeQuality(listing);
      // rawStature = 200, priceDamping = 250000 / 500000 = 0.5
      // artisanStature = 200 * 0.5 = 100
      // completeness: price = 10
      expect(quality).toBe(110);
    });

    it('no damping at ¥500K ceiling', () => {
      const listing = baseListing({
        artisan_id: 'MAS590',
        artisan_designation_factor: 1.90,
        price_value: 500000,
        price_currency: 'JPY',
      });
      const quality = computeQuality(listing);
      // rawStature = 200, priceDamping = 1.0
      // completeness: price = 10
      expect(quality).toBe(210);
    });

    it('no damping above ceiling', () => {
      const listing = baseListing({
        artisan_id: 'MAS590',
        artisan_designation_factor: 1.90,
        price_value: 2000000,
        price_currency: 'JPY',
      });
      const quality = computeQuality(listing);
      // rawStature = 200, priceDamping = clamped to 1.0
      // completeness: price = 10
      expect(quality).toBe(210);
    });

    it('full stature when no price (null) — inquiry-based items bypass damping', () => {
      const listing = baseListing({
        artisan_id: 'MAS590',
        artisan_designation_factor: 1.90,
        price_value: null,
        price_currency: null,
      });
      const quality = computeQuality(listing);
      // rawStature = 200, priceDamping = 1.0 (NULL price bypasses damping)
      // completeness: no price = 0
      expect(quality).toBe(200);
    });

    it('converts USD price for damping', () => {
      const listing = baseListing({
        artisan_id: 'MAS590',
        artisan_designation_factor: 1.90,
        price_value: 2000,
        price_currency: 'USD',
      });
      const quality = computeQuality(listing);
      // priceJpy = 2000 * 150 = 300000, priceDamping = 300000 / 500000 = 0.6
      // rawStature = 200, artisanStature = 200 * 0.6 = 120
      // completeness: price = 10
      expect(quality).toBe(130);
    });

    it('cheap USD item gets heavily dampened', () => {
      const listing = baseListing({
        artisan_id: 'MAS590',
        artisan_designation_factor: 1.90,
        price_value: 200,
        price_currency: 'USD',
      });
      const quality = computeQuality(listing);
      // priceJpy = 200 * 150 = 30000, priceDamping = 0.06
      // artisanStature = 200 * 0.06 = 12
      // completeness: price = 10
      expect(quality).toBe(22);
    });

    it('does not dampen non-artisan components', () => {
      // Cert points and completeness are unaffected by price damping
      const listing = baseListing({
        cert_type: 'Juyo',
        price_value: 30000,
        price_currency: 'JPY',
        images: ['a', 'b', 'c'],
      });
      const quality = computeQuality(listing);
      // No artisan → stature = 0 (damping irrelevant)
      // cert = 28, completeness = 9 (images) + 10 (price) = 19
      expect(quality).toBe(47);
    });
  });

  describe('certification points', () => {
    it('adds cert points for Juyo', () => {
      const listing = baseListing({ cert_type: 'Juyo' });
      expect(computeQuality(listing)).toBe(28);
    });

    it('adds cert points for Tokubetsu Juyo', () => {
      const listing = baseListing({ cert_type: 'tokubetsu_juyo' });
      expect(computeQuality(listing)).toBe(40);
    });

    it('adds 0 for unknown cert_type', () => {
      const listing = baseListing({ cert_type: 'unknown_cert' });
      expect(computeQuality(listing)).toBe(0);
    });

    it('adds 0 for null cert_type', () => {
      const listing = baseListing({ cert_type: null });
      expect(computeQuality(listing)).toBe(0);
    });
  });

  describe('completeness sub-score', () => {
    it('adds 10 for price_value', () => {
      const listing = baseListing({ price_value: 500000 });
      expect(computeQuality(listing)).toBe(10);
    });

    it('adds 5 for HIGH artisan confidence', () => {
      const listing = baseListing({ artisan_confidence: 'HIGH' });
      expect(computeQuality(listing)).toBe(5);
    });

    it('does not add for MEDIUM artisan confidence', () => {
      const listing = baseListing({ artisan_confidence: 'MEDIUM' });
      expect(computeQuality(listing)).toBe(0);
    });

    it('adds 8 for smith attribution', () => {
      const listing = baseListing({ smith: 'Masamune' });
      expect(computeQuality(listing)).toBe(8);
    });

    it('adds 8 for tosogu_maker attribution', () => {
      const listing = baseListing({ tosogu_maker: 'Goto Ichijo' });
      expect(computeQuality(listing)).toBe(8);
    });

    it('adds 5 for nagasa_cm measurements', () => {
      const listing = baseListing({ nagasa_cm: 70.5 });
      expect(computeQuality(listing)).toBe(5);
    });

    it('adds 5 for tosogu measurements', () => {
      const listing = baseListing({ tosogu_height_cm: 7.5 });
      expect(computeQuality(listing)).toBe(5);
    });

    it('adds 5 for long description (>100 chars)', () => {
      const listing = baseListing({ description: 'x'.repeat(101) });
      expect(computeQuality(listing)).toBe(5);
    });

    it('does not add for short description (<=100 chars)', () => {
      const listing = baseListing({ description: 'x'.repeat(100) });
      expect(computeQuality(listing)).toBe(0);
    });

    it('adds 4 for era', () => {
      const listing = baseListing({ era: 'Kamakura' });
      expect(computeQuality(listing)).toBe(4);
    });

    it('adds 3 for school', () => {
      const listing = baseListing({ school: 'Soshu' });
      expect(computeQuality(listing)).toBe(3);
    });

    it('adds 3 for tosogu_school', () => {
      const listing = baseListing({ tosogu_school: 'Goto' });
      expect(computeQuality(listing)).toBe(3);
    });

    it('caps image points at 15 (5+ images)', () => {
      const listing = baseListing({ images: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
      // min(7 * 3, 15) = 15
      expect(computeQuality(listing)).toBe(15);
    });

    it('gives 3 pts per image up to cap', () => {
      const listing = baseListing({ images: ['a', 'b'] });
      // 2 * 3 = 6
      expect(computeQuality(listing)).toBe(6);
    });
  });

  describe('combined scoring', () => {
    it('sums all components for a fully-filled listing', () => {
      const listing = baseListing({
        artisan_id: 'MAS590',
        artisan_designation_factor: 0.84,
        cert_type: 'Juyo',
        price_value: 2000000,
        price_currency: 'JPY',
        artisan_confidence: 'HIGH',
        images: ['a', 'b', 'c', 'd', 'e'],
        smith: 'Masamune',
        school: 'Soshu',
        era: 'Kamakura',
        nagasa_cm: 70.5,
        description: 'A fine katana from the Kamakura period. '.repeat(5),
      });
      const quality = computeQuality(listing);

      // artisan_stature = min(0.84 * 119, 200) = 99.96
      // priceDamping = min(2000000 / 500000, 1) = 1.0
      // artisanStature = round(99.96 * 1.0 * 100) / 100 = 99.96
      // cert = 28
      // completeness = 55 (all fields filled)
      // total ≈ 99.96 + 28 + 55 = 182.96
      expect(quality).toBeCloseTo(182.96, 1);
    });

    it('gimei item (UNKNOWN artisan) has low quality even with images', () => {
      const listing = baseListing({
        artisan_id: 'UNKNOWN',
        artisan_designation_factor: 0.8,
        cert_type: null,
        price_value: 165000,
        price_currency: 'JPY',
        artisan_confidence: 'LOW',
        images: ['a', 'b', 'c', 'd', 'e', 'f'],
      });
      const quality = computeQuality(listing);

      // artisan_stature = 0 (UNKNOWN is ignored, damping irrelevant)
      // cert = 0 (null)
      // completeness = 15 (images) + 10 (price) + 0 (no attribution, measurements, etc.) = 25
      expect(quality).toBe(25);
    });
  });
});

// ---------------------------------------------------------------------------
// computeFreshness
// ---------------------------------------------------------------------------

describe('computeFreshness', () => {
  it('returns 1.0 for initial imports', () => {
    const listing = baseListing({
      is_initial_import: true,
      first_seen_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(computeFreshness(listing)).toBe(1.0);
  });

  it('returns 1.0 when first_seen_at is null', () => {
    const listing = baseListing({ first_seen_at: null });
    expect(computeFreshness(listing)).toBe(1.0);
  });

  it('returns 1.4 for listings <3 days old', () => {
    const listing = baseListing({
      first_seen_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(computeFreshness(listing)).toBe(1.4);
  });

  it('returns 1.2 for listings 3–7 days old', () => {
    const listing = baseListing({
      first_seen_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(computeFreshness(listing)).toBe(1.2);
  });

  it('returns 1.0 for listings 7–30 days old', () => {
    const listing = baseListing({
      first_seen_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(computeFreshness(listing)).toBe(1.0);
  });

  it('returns 0.85 for listings 30–90 days old', () => {
    const listing = baseListing({
      first_seen_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(computeFreshness(listing)).toBe(0.85);
  });

  it('returns 0.5 for listings 90–180 days old', () => {
    const listing = baseListing({
      first_seen_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(computeFreshness(listing)).toBe(0.5);
  });

  it('returns 0.3 for listings >=180 days old', () => {
    const listing = baseListing({
      first_seen_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(computeFreshness(listing)).toBe(0.3);
  });
});

// ---------------------------------------------------------------------------
// computeFeaturedScore
// ---------------------------------------------------------------------------

describe('computeFeaturedScore', () => {
  it('returns 0 for listings without images', () => {
    const listing = baseListing({
      images: [],
      cert_type: 'Juyo',
      artisan_id: 'MAS590',
      artisan_elite_factor: 1.0,
      artisan_elite_count: 100,
    });
    expect(computeFeaturedScore(listing, 100)).toBe(0);
  });

  it('returns 0 for null images', () => {
    const listing = baseListing({ images: null, cert_type: 'Juyo' });
    expect(computeFeaturedScore(listing, 50)).toBe(0);
  });

  it('combines quality, heat, and freshness correctly', () => {
    const listing = baseListing({
      images: ['a.jpg'],
      cert_type: 'Juyo',        // +28 cert
      price_value: 1000000,     // +10 completeness
      price_currency: 'JPY',
      is_initial_import: true,  // freshness = 1.0
    });
    // quality = 28 (cert) + 3 (1 image * 3) + 10 (price) = 41
    // heat = 0
    // freshness = 1.0 (initial import)
    // score = (41 + 0) * 1.0 = 41.0
    expect(computeFeaturedScore(listing, 0)).toBe(41);
  });

  it('applies freshness multiplier', () => {
    const listing = baseListing({
      images: ['a.jpg'],
      price_value: 1000000,     // +10 completeness
      price_currency: 'JPY',
      first_seen_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });
    // quality = 3 (1 image) + 10 (price) = 13
    // heat = 0
    // freshness = 1.4 (<3 days)
    // score = (13 + 0) * 1.4 = 18.2
    expect(computeFeaturedScore(listing, 0)).toBe(18.2);
  });

  it('includes heat in final score', () => {
    const listing = baseListing({
      images: ['a.jpg'],
      is_initial_import: true,
    });
    // quality = 3 (1 image)
    // freshness = 1.0
    // score = (3 + 50) * 1.0 = 53
    expect(computeFeaturedScore(listing, 50)).toBe(53);
  });

  it('rounds to 2 decimal places', () => {
    const listing = baseListing({
      images: ['a.jpg'],
      price_value: 100000,
      price_currency: 'JPY',
      first_seen_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    });
    // quality = 3 + 10 = 13, freshness = 0.85
    // score = (13 + 0) * 0.85 = 11.05
    const score = computeFeaturedScore(listing, 0);
    expect(score).toBe(11.05);
    // Verify rounding precision
    expect(score.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
  });

  describe('realistic scenarios', () => {
    it('top-tier sword: Juyo by elite smith with strong engagement', () => {
      const listing = baseListing({
        artisan_id: 'MAS590',
        artisan_designation_factor: 1.90,
        cert_type: 'Juyo',
        price_value: 5000000,
        price_currency: 'JPY',
        artisan_confidence: 'HIGH',
        images: ['a', 'b', 'c', 'd', 'e'],
        smith: 'Masamune',
        school: 'Soshu',
        era: 'Kamakura',
        nagasa_cm: 70.5,
        description: 'An exceptional Kamakura-period katana. '.repeat(5),
        first_seen_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // heat = 4*15=60(capped) + 3*10=30 + 2*3=6 + 10*1=10 + 1*8=8 = 114
      const heat = Math.min(4 * 15, 60) + Math.min(3 * 10, 40) + Math.min(2 * 3, 24)
                 + Math.min(10 * 1, 20) + Math.min(1 * 8, 16);

      const score = computeFeaturedScore(listing, heat);
      // Should be a high score (>300)
      expect(score).toBeGreaterThan(300);
    });

    it('gimei tosogu: UNKNOWN artisan, no cert, modest engagement', () => {
      const listing = baseListing({
        artisan_id: 'UNKNOWN',
        artisan_elite_factor: null,
        artisan_elite_count: null,
        cert_type: null,
        price_value: 165000,
        price_currency: 'JPY',
        artisan_confidence: 'LOW',
        images: ['a', 'b', 'c', 'd', 'e', 'f'],
        is_initial_import: true,
      });

      const score = computeFeaturedScore(listing, 5);
      // quality = 0 (UNKNOWN) + 0 (no cert) + 15 (images) + 10 (price) = 25
      // score = (25 + 5) * 1.0 = 30
      expect(score).toBe(30);
      // Must be dramatically lower than top-tier
      expect(score).toBeLessThan(100);
    });

    it('changing artisan from real to UNKNOWN drops score significantly', () => {
      const baseFields = {
        artisan_designation_factor: 0.8,
        cert_type: 'Hozon' as const,
        price_value: 1000000,
        price_currency: 'JPY' as const,
        artisan_confidence: 'HIGH' as const,
        images: ['a', 'b', 'c'],
        is_initial_import: true,
        smith: 'Yasumitsu',
        school: 'Osafune',
      };

      const withArtisan = baseListing({ ...baseFields, artisan_id: 'YAS123' });
      const withUnknown = baseListing({ ...baseFields, artisan_id: 'UNKNOWN' });

      const scoreWithArtisan = computeFeaturedScore(withArtisan, 10);
      const scoreWithUnknown = computeFeaturedScore(withUnknown, 10);

      // The real artisan should score much higher
      expect(scoreWithArtisan).toBeGreaterThan(scoreWithUnknown * 2);
    });

    it('changing cert from Juyo to null drops score', () => {
      const baseFields = {
        artisan_id: null,
        price_value: 500000,
        images: ['a', 'b', 'c'],
        is_initial_import: true,
      };

      const withJuyo = baseListing({ ...baseFields, cert_type: 'Juyo' });
      const withNoCert = baseListing({ ...baseFields, cert_type: null });

      const scoreWithJuyo = computeFeaturedScore(withJuyo, 0);
      const scoreWithNoCert = computeFeaturedScore(withNoCert, 0);

      expect(scoreWithJuyo - scoreWithNoCert).toBe(28); // Juyo = 28 pts
    });
  });
});

// ---------------------------------------------------------------------------
// designation_factor constants
// ---------------------------------------------------------------------------

describe('designation_factor constants', () => {
  it('DESIGNATION_STATURE_MULTIPLIER is 119', () => {
    expect(DESIGNATION_STATURE_MULTIPLIER).toBe(119);
  });

  it('ARTISAN_STATURE_CAP is 200', () => {
    expect(ARTISAN_STATURE_CAP).toBe(200);
  });

  it('Tomonari-level df (1.68) maps to stature ~200', () => {
    const stature = Math.min(1.68 * DESIGNATION_STATURE_MULTIPLIER, ARTISAN_STATURE_CAP);
    expect(stature).toBeCloseTo(199.92, 1);
  });

  it('Yasuchika-level df (0.81) maps to stature ~96', () => {
    const stature = Math.min(0.81 * DESIGNATION_STATURE_MULTIPLIER, ARTISAN_STATURE_CAP);
    expect(stature).toBeCloseTo(96.39, 1);
  });

  it('df=0 maps to stature 0', () => {
    const stature = Math.min(0 * DESIGNATION_STATURE_MULTIPLIER, ARTISAN_STATURE_CAP);
    expect(stature).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Heat computation formula (documenting the weights)
// ---------------------------------------------------------------------------

describe('heat formula weights', () => {
  it('favorites capped at 60 (4 favorites)', () => {
    expect(Math.min(4 * 15, 60)).toBe(60);
    expect(Math.min(5 * 15, 60)).toBe(60); // already capped
  });

  it('clicks capped at 40 (4 clicks)', () => {
    expect(Math.min(4 * 10, 40)).toBe(40);
  });

  it('quickview opens capped at 24 (8 opens)', () => {
    expect(Math.min(8 * 3, 24)).toBe(24);
  });

  it('views capped at 20', () => {
    expect(Math.min(20 * 1, 20)).toBe(20);
    expect(Math.min(100 * 1, 20)).toBe(20);
  });

  it('pinch zooms capped at 16 (2 zooms)', () => {
    expect(Math.min(2 * 8, 16)).toBe(16);
  });

  it('max total heat is 160', () => {
    const maxHeat = 60 + 40 + 24 + 20 + 16;
    expect(maxHeat).toBe(160);
  });
});
