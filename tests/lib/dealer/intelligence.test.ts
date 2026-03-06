import { describe, it, expect } from 'vitest';
import {
  computeListingCompleteness,
  heatToTrend,
  scoreToRankBucket,
} from '@/lib/dealer/intelligence';

// =============================================================================
// Dealer Intelligence — Unit Tests
// =============================================================================

describe('computeListingCompleteness', () => {
  const baseListing = {
    images: null,
    price_value: null,
    smith: null,
    tosogu_maker: null,
    nagasa_cm: null,
    tosogu_height_cm: null,
    tosogu_width_cm: null,
    description: null,
    cert_type: null,
  };

  it('returns 0/6 for empty listing', () => {
    const result = computeListingCompleteness(baseListing);
    expect(result.score).toBe(0);
    expect(result.total).toBe(6);
    expect(result.items).toHaveLength(6);
    expect(result.items.every(i => !i.filled)).toBe(true);
  });

  it('returns 6/6 for fully complete listing', () => {
    const result = computeListingCompleteness({
      images: ['img1.jpg', 'img2.jpg'],
      price_value: 500000,
      smith: 'Masamune',
      tosogu_maker: null,
      nagasa_cm: 70.5,
      tosogu_height_cm: null,
      tosogu_width_cm: null,
      description: 'A magnificent katana by the legendary smith. This blade exhibits exceptional workmanship.',
      cert_type: 'Juyo',
    });
    expect(result.score).toBe(6);
    expect(result.items.every(i => i.filled)).toBe(true);
  });

  it('counts images only when array has elements', () => {
    expect(computeListingCompleteness({ ...baseListing, images: [] }).items[0].filled).toBe(false);
    expect(computeListingCompleteness({ ...baseListing, images: ['a.jpg'] }).items[0].filled).toBe(true);
  });

  it('counts price only when > 0', () => {
    expect(computeListingCompleteness({ ...baseListing, price_value: 0 }).items[1].filled).toBe(false);
    expect(computeListingCompleteness({ ...baseListing, price_value: 100 }).items[1].filled).toBe(true);
  });

  it('counts attribution via smith OR tosogu_maker', () => {
    expect(computeListingCompleteness({ ...baseListing, smith: 'Kunimitsu' }).items[2].filled).toBe(true);
    expect(computeListingCompleteness({ ...baseListing, tosogu_maker: 'Goto' }).items[2].filled).toBe(true);
    expect(computeListingCompleteness({ ...baseListing }).items[2].filled).toBe(false);
  });

  it('counts measurements via nagasa_cm OR tosogu dimensions', () => {
    expect(computeListingCompleteness({ ...baseListing, nagasa_cm: 70 }).items[3].filled).toBe(true);
    expect(computeListingCompleteness({ ...baseListing, tosogu_height_cm: 8.5 }).items[3].filled).toBe(true);
    expect(computeListingCompleteness({ ...baseListing, tosogu_width_cm: 7.2 }).items[3].filled).toBe(true);
    expect(computeListingCompleteness({ ...baseListing }).items[3].filled).toBe(false);
  });

  it('counts description only when > 50 chars', () => {
    expect(computeListingCompleteness({ ...baseListing, description: 'Short' }).items[4].filled).toBe(false);
    expect(computeListingCompleteness({ ...baseListing, description: 'A'.repeat(50) }).items[4].filled).toBe(false);
    expect(computeListingCompleteness({ ...baseListing, description: 'A'.repeat(51) }).items[4].filled).toBe(true);
  });

  it('counts certification when cert_type is non-null', () => {
    expect(computeListingCompleteness({ ...baseListing, cert_type: 'Hozon' }).items[5].filled).toBe(true);
    expect(computeListingCompleteness({ ...baseListing, cert_type: null }).items[5].filled).toBe(false);
  });

  it('each item has key, tipKey, and labelKey', () => {
    const result = computeListingCompleteness(baseListing);
    for (const item of result.items) {
      expect(item.key).toBeTruthy();
      expect(item.tipKey).toMatch(/^dealer\.intel\.tip/);
      expect(item.labelKey).toMatch(/^dealer\.intel\./);
    }
  });

  it('handles null images gracefully', () => {
    const result = computeListingCompleteness({ ...baseListing, images: null });
    expect(result.items[0].filled).toBe(false);
  });
});

describe('heatToTrend', () => {
  it('returns hot for heat >= 40', () => {
    expect(heatToTrend(40)).toBe('hot');
    expect(heatToTrend(100)).toBe('hot');
    expect(heatToTrend(160)).toBe('hot');
  });

  it('returns warm for heat >= 10 and < 40', () => {
    expect(heatToTrend(10)).toBe('warm');
    expect(heatToTrend(25)).toBe('warm');
    expect(heatToTrend(39)).toBe('warm');
  });

  it('returns cool for heat < 10', () => {
    expect(heatToTrend(0)).toBe('cool');
    expect(heatToTrend(5)).toBe('cool');
    expect(heatToTrend(9)).toBe('cool');
  });

  it('handles boundary values exactly', () => {
    expect(heatToTrend(9)).toBe('cool');
    expect(heatToTrend(10)).toBe('warm');
    expect(heatToTrend(39)).toBe('warm');
    expect(heatToTrend(40)).toBe('hot');
  });
});

describe('scoreToRankBucket', () => {
  const p10 = 200;
  const p25 = 100;
  const p50 = 50;

  it('returns top10 when score >= p10', () => {
    expect(scoreToRankBucket(200, p10, p25, p50)).toBe('top10');
    expect(scoreToRankBucket(300, p10, p25, p50)).toBe('top10');
  });

  it('returns top25 when score >= p25 but < p10', () => {
    expect(scoreToRankBucket(100, p10, p25, p50)).toBe('top25');
    expect(scoreToRankBucket(150, p10, p25, p50)).toBe('top25');
    expect(scoreToRankBucket(199, p10, p25, p50)).toBe('top25');
  });

  it('returns top50 when score >= p50 but < p25', () => {
    expect(scoreToRankBucket(50, p10, p25, p50)).toBe('top50');
    expect(scoreToRankBucket(75, p10, p25, p50)).toBe('top50');
    expect(scoreToRankBucket(99, p10, p25, p50)).toBe('top50');
  });

  it('returns below when score < p50', () => {
    expect(scoreToRankBucket(0, p10, p25, p50)).toBe('below');
    expect(scoreToRankBucket(25, p10, p25, p50)).toBe('below');
    expect(scoreToRankBucket(49, p10, p25, p50)).toBe('below');
  });
});
