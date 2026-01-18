/**
 * Interest Score Calculation Tests
 *
 * Tests for the engagement signal scoring system.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateInterestScore,
  getInterestTier,
  mergeSignals,
  type EngagementSignals,
} from '@/lib/viewport/interestScore';
import { INTEREST_WEIGHTS, INTEREST_TIERS } from '@/lib/viewport/constants';

describe('calculateInterestScore', () => {
  describe('viewport dwell scoring', () => {
    it('should score viewport dwell time correctly', () => {
      const result = calculateInterestScore({
        viewportDwellMs: 10000, // 10 seconds
      });

      // 10 seconds * 0.5 points/second = 5 points
      expect(result.breakdown.viewportDwell).toBe(5);
    });

    it('should cap viewport dwell points at maximum', () => {
      const result = calculateInterestScore({
        viewportDwellMs: 300000, // 5 minutes
      });

      expect(result.breakdown.viewportDwell).toBe(
        INTEREST_WEIGHTS.viewportDwellMaxPoints
      );
    });

    it('should handle zero dwell time', () => {
      const result = calculateInterestScore({
        viewportDwellMs: 0,
      });

      expect(result.breakdown.viewportDwell).toBe(0);
    });
  });

  describe('detail view scoring', () => {
    it('should score detail view duration correctly', () => {
      const result = calculateInterestScore({
        detailViewMs: 25000, // 25 seconds
      });

      // 25 seconds * 0.2 points/second = 5 points
      expect(result.breakdown.detailView).toBe(5);
    });

    it('should cap detail view points at maximum', () => {
      const result = calculateInterestScore({
        detailViewMs: 600000, // 10 minutes
      });

      expect(result.breakdown.detailView).toBe(
        INTEREST_WEIGHTS.detailViewMaxPoints
      );
    });
  });

  describe('return visit scoring', () => {
    it('should score return visits correctly', () => {
      const result = calculateInterestScore({
        returnVisits: 2,
      });

      expect(result.breakdown.returnVisits).toBe(20);
    });

    it('should cap return visit points at maximum', () => {
      const result = calculateInterestScore({
        returnVisits: 10,
      });

      expect(result.breakdown.returnVisits).toBe(
        INTEREST_WEIGHTS.returnVisitMaxPoints
      );
    });
  });

  describe('image view scoring', () => {
    it('should score image views correctly', () => {
      const result = calculateInterestScore({
        imageViews: 3,
      });

      expect(result.breakdown.imageViews).toBe(6);
    });

    it('should cap image view points at maximum', () => {
      const result = calculateInterestScore({
        imageViews: 20,
      });

      expect(result.breakdown.imageViews).toBe(
        INTEREST_WEIGHTS.imageViewMaxPoints
      );
    });
  });

  describe('scroll depth scoring', () => {
    it('should award bonus for scroll depth > 75%', () => {
      const result = calculateInterestScore({
        scrollDepth: 0.8,
      });

      expect(result.breakdown.scrollDepth).toBe(INTEREST_WEIGHTS.scrollDepthBonus);
    });

    it('should not award bonus for scroll depth <= 75%', () => {
      const result = calculateInterestScore({
        scrollDepth: 0.75,
      });

      expect(result.breakdown.scrollDepth).toBe(0);
    });

    it('should not award bonus for scroll depth at 50%', () => {
      const result = calculateInterestScore({
        scrollDepth: 0.5,
      });

      expect(result.breakdown.scrollDepth).toBe(0);
    });
  });

  describe('explicit action scoring', () => {
    it('should score favorite action', () => {
      const result = calculateInterestScore({
        favorited: true,
      });

      expect(result.breakdown.favorite).toBe(INTEREST_WEIGHTS.favoritePoints);
    });

    it('should score alert creation', () => {
      const result = calculateInterestScore({
        alertCreated: true,
      });

      expect(result.breakdown.alert).toBe(INTEREST_WEIGHTS.alertPoints);
    });

    it('should score external click', () => {
      const result = calculateInterestScore({
        externalClicked: true,
      });

      expect(result.breakdown.externalClick).toBe(
        INTEREST_WEIGHTS.externalClickPoints
      );
    });

    it('should not score false explicit actions', () => {
      const result = calculateInterestScore({
        favorited: false,
        alertCreated: false,
        externalClicked: false,
      });

      expect(result.breakdown.favorite).toBe(0);
      expect(result.breakdown.alert).toBe(0);
      expect(result.breakdown.externalClick).toBe(0);
    });
  });

  describe('total score calculation', () => {
    it('should sum all signal scores', () => {
      const result = calculateInterestScore({
        viewportDwellMs: 4000, // 2 points
        detailViewMs: 10000, // 2 points
        returnVisits: 1, // 10 points
        imageViews: 2, // 4 points
        scrollDepth: 0.8, // 5 points
        favorited: true, // 50 points
      });

      // Total: 2 + 2 + 10 + 4 + 5 + 50 = 73
      expect(result.score).toBe(73);
    });

    it('should cap total score at 100', () => {
      const result = calculateInterestScore({
        favorited: true, // 50
        alertCreated: true, // 40
        externalClicked: true, // 30
        returnVisits: 3, // 30
      });

      // Would be 150 without cap
      expect(result.score).toBe(100);
    });

    it('should round score to integer', () => {
      const result = calculateInterestScore({
        viewportDwellMs: 3000, // 1.5 points
      });

      expect(Number.isInteger(result.score)).toBe(true);
    });
  });

  describe('empty signals', () => {
    it('should return zero score for empty signals', () => {
      const result = calculateInterestScore({});

      expect(result.score).toBe(0);
      expect(result.tier).toBe('GLANCED');
    });

    it('should return zero score for undefined signals', () => {
      const result = calculateInterestScore({
        viewportDwellMs: undefined,
        detailViewMs: undefined,
      });

      expect(result.score).toBe(0);
    });
  });
});

describe('getInterestTier', () => {
  it('should return GLANCED for score 0-10', () => {
    expect(getInterestTier(0)).toBe('GLANCED');
    expect(getInterestTier(5)).toBe('GLANCED');
    expect(getInterestTier(10)).toBe('GLANCED');
  });

  it('should return BROWSED for score 11-30', () => {
    expect(getInterestTier(11)).toBe('BROWSED');
    expect(getInterestTier(20)).toBe('BROWSED');
    expect(getInterestTier(30)).toBe('BROWSED');
  });

  it('should return INTERESTED for score 31-60', () => {
    expect(getInterestTier(31)).toBe('INTERESTED');
    expect(getInterestTier(45)).toBe('INTERESTED');
    expect(getInterestTier(60)).toBe('INTERESTED');
  });

  it('should return HIGHLY_INTERESTED for score 61-80', () => {
    expect(getInterestTier(61)).toBe('HIGHLY_INTERESTED');
    expect(getInterestTier(70)).toBe('HIGHLY_INTERESTED');
    expect(getInterestTier(80)).toBe('HIGHLY_INTERESTED');
  });

  it('should return READY_TO_BUY for score 81-100', () => {
    expect(getInterestTier(81)).toBe('READY_TO_BUY');
    expect(getInterestTier(90)).toBe('READY_TO_BUY');
    expect(getInterestTier(100)).toBe('READY_TO_BUY');
  });
});

describe('calculateInterestScore tier labels', () => {
  it('should include correct tier label', () => {
    const glanced = calculateInterestScore({});
    expect(glanced.tierLabel).toBe(INTEREST_TIERS.GLANCED.label);

    const interested = calculateInterestScore({
      favorited: true, // 50 points
    });
    expect(interested.tier).toBe('INTERESTED');
    expect(interested.tierLabel).toBe(INTEREST_TIERS.INTERESTED.label);
  });
});

describe('mergeSignals', () => {
  it('should merge numeric signals by taking max', () => {
    const signals1: EngagementSignals = {
      viewportDwellMs: 5000,
      detailViewMs: 3000,
    };
    const signals2: EngagementSignals = {
      viewportDwellMs: 8000,
      detailViewMs: 1000,
    };

    const merged = mergeSignals(signals1, signals2);

    expect(merged.viewportDwellMs).toBe(8000);
    expect(merged.detailViewMs).toBe(3000);
  });

  it('should merge boolean signals with OR', () => {
    const signals1: EngagementSignals = {
      favorited: true,
      alertCreated: false,
    };
    const signals2: EngagementSignals = {
      favorited: false,
      externalClicked: true,
    };

    const merged = mergeSignals(signals1, signals2);

    expect(merged.favorited).toBe(true);
    // alertCreated: false values are not merged (undefined means not set)
    expect(merged.alertCreated).toBeUndefined();
    expect(merged.externalClicked).toBe(true);
  });

  it('should handle undefined values', () => {
    const signals1: EngagementSignals = {
      viewportDwellMs: 5000,
    };
    const signals2: EngagementSignals = {
      returnVisits: 2,
    };

    const merged = mergeSignals(signals1, signals2);

    expect(merged.viewportDwellMs).toBe(5000);
    expect(merged.returnVisits).toBe(2);
  });

  it('should merge multiple signal sets', () => {
    const signals1: EngagementSignals = { viewportDwellMs: 1000 };
    const signals2: EngagementSignals = { viewportDwellMs: 2000 };
    const signals3: EngagementSignals = { viewportDwellMs: 1500 };

    const merged = mergeSignals(signals1, signals2, signals3);

    expect(merged.viewportDwellMs).toBe(2000);
  });

  it('should return empty object for no inputs', () => {
    const merged = mergeSignals();

    expect(merged).toEqual({});
  });
});

describe('interest score scenarios', () => {
  describe('typical user journeys', () => {
    it('should score casual browser correctly', () => {
      // User scrolls past quickly, pauses briefly on a few items
      const result = calculateInterestScore({
        viewportDwellMs: 3000, // 3 seconds pause
      });

      expect(result.tier).toBe('GLANCED');
      expect(result.score).toBeLessThan(10);
    });

    it('should score interested browser correctly', () => {
      // User pauses on item, views detail page briefly
      const result = calculateInterestScore({
        viewportDwellMs: 8000, // 8 seconds in grid
        detailViewMs: 15000, // 15 seconds on detail
        imageViews: 3,
      });

      expect(result.tier).toBe('BROWSED');
      expect(result.score).toBeGreaterThan(10);
      expect(result.score).toBeLessThanOrEqual(30);
    });

    it('should score serious consideration correctly', () => {
      // User views multiple times, scrolls through detail
      // Score breakdown:
      // - viewportDwellMs: 15000 = 7.5 points (capped at 20)
      // - detailViewMs: 30000 = 6 points (capped at 15)
      // - returnVisits: 2 = 20 points
      // - imageViews: 3 = 6 points
      // - scrollDepth: 0.9 = 5 points
      // Total: ~44.5 points -> INTERESTED tier
      const result = calculateInterestScore({
        viewportDwellMs: 15000,
        detailViewMs: 30000,
        returnVisits: 2,
        imageViews: 3,
        scrollDepth: 0.9,
      });

      expect(result.tier).toBe('INTERESTED');
      expect(result.score).toBeGreaterThan(30);
      expect(result.score).toBeLessThanOrEqual(60);
    });

    it('should score ready to buy correctly', () => {
      // User favorites, creates alert, clicks external link
      const result = calculateInterestScore({
        favorited: true,
        alertCreated: true,
        externalClicked: true,
      });

      expect(result.tier).toBe('READY_TO_BUY');
      expect(result.score).toBe(100); // Capped
    });
  });

  describe('edge cases', () => {
    it('should handle very high dwell times', () => {
      const result = calculateInterestScore({
        viewportDwellMs: 3600000, // 1 hour (user left tab open)
      });

      // Should be capped
      expect(result.breakdown.viewportDwell).toBe(
        INTEREST_WEIGHTS.viewportDwellMaxPoints
      );
    });

    it('should handle fractional scroll depth', () => {
      const result = calculateInterestScore({
        scrollDepth: 0.751,
      });

      expect(result.breakdown.scrollDepth).toBe(INTEREST_WEIGHTS.scrollDepthBonus);
    });
  });
});
