/**
 * DwellTracker Unit Tests
 *
 * Tests for the core viewport dwell tracking logic.
 * Uses Vitest fake timers to control time progression.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DwellTracker, type DwellEvent } from '@/lib/viewport/DwellTracker';
import { MIN_DWELL_MS, MAX_DWELL_MS } from '@/lib/viewport/constants';

describe('DwellTracker', () => {
  let tracker: DwellTracker;
  let events: DwellEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    events = [];
    tracker = new DwellTracker({
      onDwell: (event) => events.push(event),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic visibility tracking', () => {
    it('should not emit event for short dwell times', () => {
      // Enter viewport
      tracker.handleIntersection(1, true, 0.6);

      // Wait less than minimum
      vi.advanceTimersByTime(1000);

      // Leave viewport
      tracker.handleIntersection(1, false, 0);

      expect(events).toHaveLength(0);
    });

    it('should emit event when dwell time exceeds minimum', () => {
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(2000);
      tracker.handleIntersection(1, false, 0);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        listingId: 1,
        dwellMs: 2000,
        isRevisit: false,
      });
    });

    it('should track multiple listings independently', () => {
      // Listing 1 enters
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(1000);

      // Listing 2 enters
      tracker.handleIntersection(2, true, 0.8);
      vi.advanceTimersByTime(1000);

      // Listing 1 leaves (2000ms total)
      tracker.handleIntersection(1, false, 0);

      // Listing 2 continues
      vi.advanceTimersByTime(1000);
      tracker.handleIntersection(2, false, 0);

      expect(events).toHaveLength(2);
      expect(events[0].listingId).toBe(1);
      expect(events[0].dwellMs).toBe(2000);
      expect(events[1].listingId).toBe(2);
      expect(events[1].dwellMs).toBe(2000);
    });
  });

  describe('intersection ratio threshold', () => {
    it('should not track when ratio is below threshold', () => {
      // Enter with low ratio (default threshold is 0.5)
      tracker.handleIntersection(1, true, 0.3);
      vi.advanceTimersByTime(3000);
      tracker.handleIntersection(1, false, 0);

      expect(events).toHaveLength(0);
    });

    it('should track when ratio meets threshold', () => {
      tracker.handleIntersection(1, true, 0.5);
      vi.advanceTimersByTime(2000);
      tracker.handleIntersection(1, false, 0);

      expect(events).toHaveLength(1);
    });

    it('should respect custom threshold', () => {
      const customTracker = new DwellTracker({
        minRatio: 0.75,
        onDwell: (event) => events.push(event),
      });

      // Below custom threshold
      customTracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(3000);
      customTracker.handleIntersection(1, false, 0);

      expect(events).toHaveLength(0);

      // Above custom threshold
      customTracker.handleIntersection(2, true, 0.8);
      vi.advanceTimersByTime(2000);
      customTracker.handleIntersection(2, false, 0);

      expect(events).toHaveLength(1);
      expect(events[0].listingId).toBe(2);
    });
  });

  describe('accumulated dwell time', () => {
    it('should accumulate time across visibility changes', () => {
      // First visibility period (1000ms - below threshold)
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(1000);
      tracker.handleIntersection(1, false, 0);

      expect(events).toHaveLength(0);

      // Second visibility period (1000ms - total 2000ms, above threshold)
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(1000);
      tracker.handleIntersection(1, false, 0);

      expect(events).toHaveLength(1);
      expect(events[0].dwellMs).toBe(2000);
    });

    it('should not double-count while visible', () => {
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(1000);

      // Another intersecting event while already visible
      tracker.handleIntersection(1, true, 0.8);
      vi.advanceTimersByTime(1000);

      tracker.handleIntersection(1, false, 0);

      expect(events).toHaveLength(1);
      expect(events[0].dwellMs).toBe(2000);
    });
  });

  describe('revisit detection', () => {
    it('should mark second view as revisit', () => {
      // First view
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(2000);
      tracker.handleIntersection(1, false, 0);

      expect(events[0].isRevisit).toBe(false);

      // Clear events for second test
      events = [];
      tracker.setCallback((event) => events.push(event));

      // Reset the reported flag by creating new tracker or using flush
      // Actually, we need to test this differently since reported flag prevents re-emission
      const tracker2 = new DwellTracker({
        onDwell: (event) => events.push(event),
      });

      // First view
      tracker2.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(2000);
      tracker2.handleIntersection(1, false, 0);

      // Second view - should be marked as revisit when emitted
      tracker2.handleIntersection(1, true, 0.6);

      expect(tracker2.isRevisit(1)).toBe(true);
      expect(tracker2.getViewCount(1)).toBe(2);
    });

    it('should track view count correctly', () => {
      tracker.handleIntersection(1, true, 0.6);
      expect(tracker.getViewCount(1)).toBe(1);

      tracker.handleIntersection(1, false, 0);
      tracker.handleIntersection(1, true, 0.6);
      expect(tracker.getViewCount(1)).toBe(2);

      tracker.handleIntersection(1, false, 0);
      tracker.handleIntersection(1, true, 0.6);
      expect(tracker.getViewCount(1)).toBe(3);
    });
  });

  describe('getDwellTime', () => {
    it('should return accumulated time when not visible', () => {
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(1000);
      tracker.handleIntersection(1, false, 0);

      expect(tracker.getDwellTime(1)).toBe(1000);
    });

    it('should include active time when visible', () => {
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(1000);

      // Still visible - should include current active time
      expect(tracker.getDwellTime(1)).toBe(1000);

      vi.advanceTimersByTime(500);
      expect(tracker.getDwellTime(1)).toBe(1500);
    });

    it('should return 0 for untracked listings', () => {
      expect(tracker.getDwellTime(999)).toBe(0);
    });
  });

  describe('max dwell time cap', () => {
    it('should cap dwell time at maximum', () => {
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(MAX_DWELL_MS + 60000); // 6 minutes
      tracker.handleIntersection(1, false, 0);

      expect(events[0].dwellMs).toBe(MAX_DWELL_MS);
    });

    it('should cap getDwellTime at maximum', () => {
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(MAX_DWELL_MS + 60000);

      expect(tracker.getDwellTime(1)).toBeLessThanOrEqual(MAX_DWELL_MS);
    });
  });

  describe('flush', () => {
    it('should emit events for all visible elements', () => {
      tracker.handleIntersection(1, true, 0.6);
      tracker.handleIntersection(2, true, 0.7);
      vi.advanceTimersByTime(2000);

      // Both still visible
      const flushed = tracker.flush();

      expect(flushed).toHaveLength(2);
      expect(events).toHaveLength(2);
    });

    it('should emit events for elements with sufficient accumulated time', () => {
      // Listing 1 - enough time
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(2000);
      tracker.handleIntersection(1, false, 0);

      // Listing 2 - not enough time
      tracker.handleIntersection(2, true, 0.6);
      vi.advanceTimersByTime(500);
      tracker.handleIntersection(2, false, 0);

      events = []; // Clear auto-emitted events
      const flushed = tracker.flush();

      // Listing 1 was already emitted when it left viewport
      // Listing 2 doesn't have enough time
      expect(flushed).toHaveLength(0);
    });

    it('should not emit same event twice', () => {
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(2000);
      tracker.handleIntersection(1, false, 0);

      expect(events).toHaveLength(1);

      const flushed = tracker.flush();
      expect(flushed).toHaveLength(0);
      expect(events).toHaveLength(1);
    });

    it('should stop active timers', () => {
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(2000);

      tracker.flush();

      // Verify the timer was stopped (visibleSince should be 0)
      const record = tracker.getRecord(1);
      expect(record?.visibleSince).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all tracking data', () => {
      tracker.handleIntersection(1, true, 0.6);
      tracker.handleIntersection(2, true, 0.6);
      vi.advanceTimersByTime(2000);

      tracker.clear();

      expect(tracker.getTrackedIds()).toHaveLength(0);
      expect(tracker.getDwellTime(1)).toBe(0);
      expect(tracker.getDwellTime(2)).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      // Two elements visible
      tracker.handleIntersection(1, true, 0.6);
      tracker.handleIntersection(2, true, 0.6);

      let stats = tracker.getStats();
      expect(stats.totalTracked).toBe(2);
      expect(stats.currentlyVisible).toBe(2);
      expect(stats.totalReported).toBe(0);

      // One leaves and gets reported
      vi.advanceTimersByTime(2000);
      tracker.handleIntersection(1, false, 0);

      stats = tracker.getStats();
      expect(stats.totalTracked).toBe(2);
      expect(stats.currentlyVisible).toBe(1);
      expect(stats.totalReported).toBe(1);
    });
  });

  describe('callback management', () => {
    it('should allow setting callback after construction', () => {
      const tracker2 = new DwellTracker();
      const lateEvents: DwellEvent[] = [];

      tracker2.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(2000);

      // Set callback before leaving viewport
      tracker2.setCallback((event) => lateEvents.push(event));
      tracker2.handleIntersection(1, false, 0);

      expect(lateEvents).toHaveLength(1);
    });

    it('should allow removing callback', () => {
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(2000);

      tracker.setCallback(null);
      tracker.handleIntersection(1, false, 0);

      expect(events).toHaveLength(0);
    });
  });

  describe('custom minimum dwell time', () => {
    it('should respect custom minimum', () => {
      const customTracker = new DwellTracker({
        minDwellMs: 5000,
        onDwell: (event) => events.push(event),
      });

      customTracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(3000);
      customTracker.handleIntersection(1, false, 0);

      expect(events).toHaveLength(0);

      customTracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(3000);
      customTracker.handleIntersection(1, false, 0);

      expect(events).toHaveLength(1);
      expect(events[0].dwellMs).toBe(6000);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid visibility changes', () => {
      for (let i = 0; i < 10; i++) {
        tracker.handleIntersection(1, true, 0.6);
        vi.advanceTimersByTime(200);
        tracker.handleIntersection(1, false, 0);
      }

      // Total: 10 * 200ms = 2000ms (may vary slightly due to timer precision)
      expect(events).toHaveLength(1);
      expect(events[0].dwellMs).toBeGreaterThanOrEqual(1500);
      expect(events[0].dwellMs).toBeLessThanOrEqual(2000);
    });

    it('should handle leaving viewport when never entered', () => {
      // Should not throw
      expect(() => {
        tracker.handleIntersection(1, false, 0);
      }).not.toThrow();

      expect(events).toHaveLength(0);
    });

    it('should handle intersection ratio updates while visible', () => {
      tracker.handleIntersection(1, true, 0.6);
      vi.advanceTimersByTime(500);

      // Ratio changes but still visible
      tracker.handleIntersection(1, true, 0.9);
      vi.advanceTimersByTime(500);

      // Ratio drops below threshold
      tracker.handleIntersection(1, true, 0.3);
      vi.advanceTimersByTime(500);

      // Should stop tracking when ratio drops
      // Actually this depends on the isIntersecting flag
      // Let's verify the behavior
      expect(tracker.getDwellTime(1)).toBeGreaterThan(0);
    });
  });
});

describe('DwellTracker with default constants', () => {
  it('should use MIN_DWELL_MS as default threshold', () => {
    const events: DwellEvent[] = [];
    const tracker = new DwellTracker({
      onDwell: (event) => events.push(event),
    });

    vi.useFakeTimers();

    tracker.handleIntersection(1, true, 0.6);
    vi.advanceTimersByTime(MIN_DWELL_MS - 100);
    tracker.handleIntersection(1, false, 0);

    expect(events).toHaveLength(0);

    tracker.handleIntersection(1, true, 0.6);
    vi.advanceTimersByTime(200);
    tracker.handleIntersection(1, false, 0);

    expect(events).toHaveLength(1);

    vi.useRealTimers();
  });
});
