/**
 * Interest Score Calculation
 *
 * Calculates a 0-100 interest score based on user engagement signals.
 * Higher scores indicate stronger purchase intent.
 */

import { INTEREST_WEIGHTS, INTEREST_TIERS } from './constants';

export interface EngagementSignals {
  /** Viewport dwell time in milliseconds */
  viewportDwellMs?: number;
  /** Detail page view duration in milliseconds */
  detailViewMs?: number;
  /** Number of return visits to this listing */
  returnVisits?: number;
  /** Number of images viewed */
  imageViews?: number;
  /** Scroll depth on detail page (0-1) */
  scrollDepth?: number;
  /** User favorited this listing */
  favorited?: boolean;
  /** User created alert for this listing */
  alertCreated?: boolean;
  /** User clicked external link to dealer */
  externalClicked?: boolean;
}

export type InterestTier =
  | 'GLANCED'
  | 'BROWSED'
  | 'INTERESTED'
  | 'HIGHLY_INTERESTED'
  | 'READY_TO_BUY';

export interface InterestScoreResult {
  /** Total interest score (0-100) */
  score: number;
  /** Interest tier based on score */
  tier: InterestTier;
  /** Human-readable tier label */
  tierLabel: string;
  /** Breakdown of points from each signal */
  breakdown: {
    viewportDwell: number;
    detailView: number;
    returnVisits: number;
    imageViews: number;
    scrollDepth: number;
    favorite: number;
    alert: number;
    externalClick: number;
  };
}

/**
 * Calculate interest score from engagement signals
 */
export function calculateInterestScore(
  signals: EngagementSignals
): InterestScoreResult {
  const w = INTEREST_WEIGHTS;
  const breakdown = {
    viewportDwell: 0,
    detailView: 0,
    returnVisits: 0,
    imageViews: 0,
    scrollDepth: 0,
    favorite: 0,
    alert: 0,
    externalClick: 0,
  };

  // Viewport dwell time (points per second, capped)
  if (signals.viewportDwellMs) {
    const seconds = signals.viewportDwellMs / 1000;
    breakdown.viewportDwell = Math.min(
      seconds * w.viewportDwellPerSecond,
      w.viewportDwellMaxPoints
    );
  }

  // Detail page view duration (points per second, capped)
  if (signals.detailViewMs) {
    const seconds = signals.detailViewMs / 1000;
    breakdown.detailView = Math.min(
      seconds * w.detailViewPerSecond,
      w.detailViewMaxPoints
    );
  }

  // Return visits (points per visit, capped)
  if (signals.returnVisits) {
    breakdown.returnVisits = Math.min(
      signals.returnVisits * w.returnVisitPoints,
      w.returnVisitMaxPoints
    );
  }

  // Image views (points per image, capped)
  if (signals.imageViews) {
    breakdown.imageViews = Math.min(
      signals.imageViews * w.imageViewPoints,
      w.imageViewMaxPoints
    );
  }

  // Scroll depth bonus (if > 75%)
  if (signals.scrollDepth && signals.scrollDepth > 0.75) {
    breakdown.scrollDepth = w.scrollDepthBonus;
  }

  // Explicit actions (high weight)
  if (signals.favorited) {
    breakdown.favorite = w.favoritePoints;
  }
  if (signals.alertCreated) {
    breakdown.alert = w.alertPoints;
  }
  if (signals.externalClicked) {
    breakdown.externalClick = w.externalClickPoints;
  }

  // Calculate total (capped at 100)
  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  const score = Math.min(Math.round(total), 100);

  // Determine tier
  const tier = getInterestTier(score);
  const tierLabel = INTEREST_TIERS[tier].label;

  return {
    score,
    tier,
    tierLabel,
    breakdown,
  };
}

/**
 * Get interest tier from score
 */
export function getInterestTier(score: number): InterestTier {
  if (score >= INTEREST_TIERS.READY_TO_BUY.min) return 'READY_TO_BUY';
  if (score >= INTEREST_TIERS.HIGHLY_INTERESTED.min) return 'HIGHLY_INTERESTED';
  if (score >= INTEREST_TIERS.INTERESTED.min) return 'INTERESTED';
  if (score >= INTEREST_TIERS.BROWSED.min) return 'BROWSED';
  return 'GLANCED';
}

/**
 * Merge multiple engagement signal objects
 * Takes the max of numeric values and OR of booleans
 */
export function mergeSignals(
  ...signalSets: EngagementSignals[]
): EngagementSignals {
  const merged: EngagementSignals = {};

  for (const signals of signalSets) {
    // Numeric signals - take max
    if (signals.viewportDwellMs !== undefined) {
      merged.viewportDwellMs = Math.max(
        merged.viewportDwellMs ?? 0,
        signals.viewportDwellMs
      );
    }
    if (signals.detailViewMs !== undefined) {
      merged.detailViewMs = Math.max(
        merged.detailViewMs ?? 0,
        signals.detailViewMs
      );
    }
    if (signals.returnVisits !== undefined) {
      merged.returnVisits = Math.max(
        merged.returnVisits ?? 0,
        signals.returnVisits
      );
    }
    if (signals.imageViews !== undefined) {
      merged.imageViews = Math.max(merged.imageViews ?? 0, signals.imageViews);
    }
    if (signals.scrollDepth !== undefined) {
      merged.scrollDepth = Math.max(
        merged.scrollDepth ?? 0,
        signals.scrollDepth
      );
    }

    // Boolean signals - OR
    if (signals.favorited) merged.favorited = true;
    if (signals.alertCreated) merged.alertCreated = true;
    if (signals.externalClicked) merged.externalClicked = true;
  }

  return merged;
}
