/**
 * Viewport Tracking Constants
 *
 * Configuration values for viewport dwell time tracking.
 * These thresholds determine what counts as "meaningful" engagement.
 */

/** Minimum time (ms) an element must be visible to count as a dwell */
export const MIN_DWELL_MS = 1500;

/** Maximum dwell time (ms) to track - caps outliers */
export const MAX_DWELL_MS = 300000; // 5 minutes

/** Minimum intersection ratio to consider element "visible" */
export const MIN_INTERSECTION_RATIO = 0.5;

/** How often to flush accumulated dwell times (ms) */
export const FLUSH_INTERVAL_MS = 10000; // 10 seconds

/** Debounce time for scroll events before processing (ms) */
export const SCROLL_DEBOUNCE_MS = 100;

/**
 * Interest score weights for different signals
 * Used to calculate aggregate interest in a listing
 */
export const INTEREST_WEIGHTS = {
  /** Points per second of viewport dwell (capped) */
  viewportDwellPerSecond: 0.5,
  viewportDwellMaxPoints: 20,

  /** Points per second of detail view (capped) */
  detailViewPerSecond: 0.2,
  detailViewMaxPoints: 15,

  /** Points per return visit (capped) */
  returnVisitPoints: 10,
  returnVisitMaxPoints: 30,

  /** Points per image viewed (capped) */
  imageViewPoints: 2,
  imageViewMaxPoints: 10,

  /** Points for scroll depth > 75% */
  scrollDepthBonus: 5,

  /** Points for explicit actions */
  favoritePoints: 50,
  alertPoints: 40,
  externalClickPoints: 30,

  /** Points for QuickView engagement signals */
  panelCollapsePoints: 15, // User collapsed data panel to see more image
  panelExpandPoints: 5, // User expanded panel (less strong signal)
  pinchZoomPoints: 20, // User pinch-zoomed on image (strong inspection signal)
} as const;

/**
 * Interest score tiers for categorizing engagement level
 */
export const INTEREST_TIERS = {
  GLANCED: { min: 0, max: 10, label: 'Glanced' },
  BROWSED: { min: 11, max: 30, label: 'Browsed' },
  INTERESTED: { min: 31, max: 60, label: 'Interested' },
  HIGHLY_INTERESTED: { min: 61, max: 80, label: 'Highly Interested' },
  READY_TO_BUY: { min: 81, max: 100, label: 'Ready to Buy' },
} as const;
