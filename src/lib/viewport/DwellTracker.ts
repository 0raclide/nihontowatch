/**
 * DwellTracker - Core class for tracking viewport dwell time
 *
 * Manages timing state for multiple elements, handling:
 * - Start/pause/resume of timers
 * - Accumulated time across visibility changes
 * - Revisit detection (scrolling back to same element)
 * - Threshold-based event emission
 *
 * This class is framework-agnostic and can be tested in isolation.
 */

import {
  MIN_DWELL_MS,
  MAX_DWELL_MS,
  MIN_INTERSECTION_RATIO,
} from './constants';

export interface DwellRecord {
  /** Timestamp when current visibility period started (0 if not visible) */
  visibleSince: number;
  /** Accumulated dwell time from previous visibility periods */
  accumulatedMs: number;
  /** Number of times this element has been viewed */
  viewCount: number;
  /** Last intersection ratio observed */
  lastRatio: number;
  /** Whether this dwell has been reported */
  reported: boolean;
}

export interface DwellEvent {
  listingId: number;
  dwellMs: number;
  intersectionRatio: number;
  isRevisit: boolean;
}

export type DwellEventCallback = (event: DwellEvent) => void;

export class DwellTracker {
  private records: Map<number, DwellRecord> = new Map();
  private onDwell: DwellEventCallback | null = null;
  private minDwellMs: number;
  private maxDwellMs: number;
  private minRatio: number;

  constructor(options?: {
    minDwellMs?: number;
    maxDwellMs?: number;
    minRatio?: number;
    onDwell?: DwellEventCallback;
  }) {
    this.minDwellMs = options?.minDwellMs ?? MIN_DWELL_MS;
    this.maxDwellMs = options?.maxDwellMs ?? MAX_DWELL_MS;
    this.minRatio = options?.minRatio ?? MIN_INTERSECTION_RATIO;
    this.onDwell = options?.onDwell ?? null;
  }

  /**
   * Set the callback for dwell events
   */
  setCallback(callback: DwellEventCallback | null): void {
    this.onDwell = callback;
  }

  /**
   * Handle an intersection change for a listing
   */
  handleIntersection(
    listingId: number,
    isIntersecting: boolean,
    ratio: number
  ): void {
    const now = Date.now();
    const meetsThreshold = isIntersecting && ratio >= this.minRatio;

    let record = this.records.get(listingId);

    if (!record) {
      // First time seeing this element
      record = {
        visibleSince: meetsThreshold ? now : 0,
        accumulatedMs: 0,
        viewCount: meetsThreshold ? 1 : 0,
        lastRatio: ratio,
        reported: false,
      };
      this.records.set(listingId, record);
      return;
    }

    if (meetsThreshold && record.visibleSince === 0) {
      // Element becoming visible
      record.visibleSince = now;
      record.viewCount++;
      record.lastRatio = ratio;
    } else if (!meetsThreshold && record.visibleSince > 0) {
      // Element leaving viewport - accumulate time and maybe emit
      const elapsed = now - record.visibleSince;
      record.accumulatedMs += elapsed;
      record.visibleSince = 0;
      record.lastRatio = ratio;

      this.maybeEmit(listingId, record);
    } else if (meetsThreshold) {
      // Still visible, just update ratio
      record.lastRatio = ratio;
    }
  }

  /**
   * Get current dwell time for a listing (including active time)
   */
  getDwellTime(listingId: number): number {
    const record = this.records.get(listingId);
    if (!record) return 0;

    let total = record.accumulatedMs;
    if (record.visibleSince > 0) {
      total += Date.now() - record.visibleSince;
    }
    return Math.min(total, this.maxDwellMs);
  }

  /**
   * Get view count for a listing
   */
  getViewCount(listingId: number): number {
    return this.records.get(listingId)?.viewCount ?? 0;
  }

  /**
   * Check if a listing has been viewed before (revisit detection)
   */
  isRevisit(listingId: number): boolean {
    const record = this.records.get(listingId);
    return record ? record.viewCount > 1 : false;
  }

  /**
   * Force emit any pending dwell events for visible elements
   * Call this on page unload or when tracking stops
   */
  flush(): DwellEvent[] {
    const events: DwellEvent[] = [];
    const now = Date.now();

    for (const [listingId, record] of this.records) {
      if (record.visibleSince > 0) {
        // Element is currently visible - accumulate time
        record.accumulatedMs += now - record.visibleSince;
        record.visibleSince = 0;
      }

      if (!record.reported && record.accumulatedMs >= this.minDwellMs) {
        const event = this.createEvent(listingId, record);
        events.push(event);
        record.reported = true;
        this.onDwell?.(event);
      }
    }

    return events;
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.records.clear();
  }

  /**
   * Get all tracked listing IDs
   */
  getTrackedIds(): number[] {
    return Array.from(this.records.keys());
  }

  /**
   * Get raw record for testing
   */
  getRecord(listingId: number): DwellRecord | undefined {
    return this.records.get(listingId);
  }

  /**
   * Get summary statistics for testing/debugging
   */
  getStats(): {
    totalTracked: number;
    currentlyVisible: number;
    totalReported: number;
  } {
    let currentlyVisible = 0;
    let totalReported = 0;

    for (const record of this.records.values()) {
      if (record.visibleSince > 0) currentlyVisible++;
      if (record.reported) totalReported++;
    }

    return {
      totalTracked: this.records.size,
      currentlyVisible,
      totalReported,
    };
  }

  private maybeEmit(listingId: number, record: DwellRecord): void {
    if (record.reported) return;
    if (record.accumulatedMs < this.minDwellMs) return;

    const event = this.createEvent(listingId, record);
    record.reported = true;
    this.onDwell?.(event);
  }

  private createEvent(listingId: number, record: DwellRecord): DwellEvent {
    return {
      listingId,
      dwellMs: Math.min(record.accumulatedMs, this.maxDwellMs),
      intersectionRatio: record.lastRatio,
      isRevisit: record.viewCount > 1,
    };
  }
}
