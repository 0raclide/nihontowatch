/**
 * Impression Tracking Tests
 *
 * Tests that the useViewportTracking hook fires impression callbacks:
 * - Once per listing on first visibility (≥ threshold)
 * - Not on re-entry (scroll away and back)
 * - With correct metadata (position, dealerId)
 * - Not when below intersection threshold
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewportTracking, type ImpressionEvent } from '@/lib/viewport/useViewportTracking';

// =============================================================================
// Mock IntersectionObserver
// =============================================================================

type IOCallback = IntersectionObserverCallback;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  private callback: IOCallback;
  private elements: Set<Element> = new Set();

  constructor(callback: IOCallback) {
    this.callback = callback;
    mockObservers.push(this);
  }

  observe(target: Element): void {
    this.elements.add(target);
  }

  unobserve(target: Element): void {
    this.elements.delete(target);
  }

  disconnect(): void {
    this.elements.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Test helper: simulate an element entering/leaving the viewport */
  triggerEntry(target: Element, isIntersecting: boolean, ratio: number = 0.6): void {
    const entry: IntersectionObserverEntry = {
      target,
      isIntersecting,
      intersectionRatio: ratio,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: performance.now(),
    };
    this.callback([entry], this);
  }
}

let mockObservers: MockIntersectionObserver[] = [];

beforeAll(() => {
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

beforeEach(() => {
  mockObservers = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// =============================================================================
// Helpers
// =============================================================================

function createElement(id: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-testid', id);
  document.body.appendChild(el);
  return el;
}

// =============================================================================
// Tests
// =============================================================================

describe('useViewportTracking — impressions', () => {
  it('fires onImpression on first visibility at threshold', () => {
    const impressions: ImpressionEvent[] = [];
    const onImpression = (e: ImpressionEvent) => impressions.push(e);

    const { result } = renderHook(() =>
      useViewportTracking({ enabled: true, onImpression, threshold: 0.5 })
    );

    const el = createElement('card-1');

    act(() => {
      result.current.trackElement(el, 100, { position: 3, dealerId: 7 });
    });

    const observer = mockObservers[0];

    // Simulate card entering viewport above threshold
    act(() => {
      observer.triggerEntry(el, true, 0.6);
    });

    expect(impressions).toHaveLength(1);
    expect(impressions[0]).toEqual({
      listingId: 100,
      position: 3,
      dealerId: 7,
    });

    el.remove();
  });

  it('does NOT fire impression twice for the same listing', () => {
    const impressions: ImpressionEvent[] = [];
    const onImpression = (e: ImpressionEvent) => impressions.push(e);

    const { result } = renderHook(() =>
      useViewportTracking({ enabled: true, onImpression, threshold: 0.5 })
    );

    const el = createElement('card-2');

    act(() => {
      result.current.trackElement(el, 200, { position: 5 });
    });

    const observer = mockObservers[0];

    // Enter viewport
    act(() => observer.triggerEntry(el, true, 0.7));
    expect(impressions).toHaveLength(1);

    // Leave viewport
    act(() => observer.triggerEntry(el, false, 0));

    // Re-enter viewport (scroll back)
    act(() => observer.triggerEntry(el, true, 0.8));

    // Still only 1 impression
    expect(impressions).toHaveLength(1);

    el.remove();
  });

  it('fires separate impressions for different listings', () => {
    const impressions: ImpressionEvent[] = [];
    const onImpression = (e: ImpressionEvent) => impressions.push(e);

    const { result } = renderHook(() =>
      useViewportTracking({ enabled: true, onImpression, threshold: 0.5 })
    );

    const el1 = createElement('card-a');
    const el2 = createElement('card-b');

    act(() => {
      result.current.trackElement(el1, 301, { position: 0, dealerId: 1 });
      result.current.trackElement(el2, 302, { position: 1, dealerId: 2 });
    });

    const observer = mockObservers[0];

    act(() => {
      observer.triggerEntry(el1, true, 0.6);
      observer.triggerEntry(el2, true, 0.6);
    });

    expect(impressions).toHaveLength(2);
    expect(impressions[0].listingId).toBe(301);
    expect(impressions[1].listingId).toBe(302);

    el1.remove();
    el2.remove();
  });

  it('does NOT fire impression when ratio is below threshold', () => {
    const impressions: ImpressionEvent[] = [];
    const onImpression = (e: ImpressionEvent) => impressions.push(e);

    const { result } = renderHook(() =>
      useViewportTracking({ enabled: true, onImpression, threshold: 0.5 })
    );

    const el = createElement('card-3');

    act(() => {
      result.current.trackElement(el, 400);
    });

    const observer = mockObservers[0];

    // Below threshold — should NOT fire
    act(() => observer.triggerEntry(el, true, 0.3));
    expect(impressions).toHaveLength(0);

    // Above threshold — NOW fires
    act(() => observer.triggerEntry(el, true, 0.6));
    expect(impressions).toHaveLength(1);

    el.remove();
  });

  it('does NOT fire impression when not intersecting', () => {
    const impressions: ImpressionEvent[] = [];
    const onImpression = (e: ImpressionEvent) => impressions.push(e);

    const { result } = renderHook(() =>
      useViewportTracking({ enabled: true, onImpression, threshold: 0.5 })
    );

    const el = createElement('card-4');

    act(() => {
      result.current.trackElement(el, 500);
    });

    const observer = mockObservers[0];

    // Not intersecting even with high ratio
    act(() => observer.triggerEntry(el, false, 0.9));
    expect(impressions).toHaveLength(0);

    el.remove();
  });

  it('handles missing metadata gracefully', () => {
    const impressions: ImpressionEvent[] = [];
    const onImpression = (e: ImpressionEvent) => impressions.push(e);

    const { result } = renderHook(() =>
      useViewportTracking({ enabled: true, onImpression, threshold: 0.5 })
    );

    const el = createElement('card-5');

    // No metadata passed
    act(() => {
      result.current.trackElement(el, 600);
    });

    const observer = mockObservers[0];

    act(() => observer.triggerEntry(el, true, 0.6));

    expect(impressions).toHaveLength(1);
    expect(impressions[0]).toEqual({
      listingId: 600,
      position: undefined,
      dealerId: undefined,
    });

    el.remove();
  });

  it('does NOT fire when tracking is disabled', () => {
    const impressions: ImpressionEvent[] = [];
    const onImpression = (e: ImpressionEvent) => impressions.push(e);

    const { result } = renderHook(() =>
      useViewportTracking({ enabled: false, onImpression, threshold: 0.5 })
    );

    const el = createElement('card-6');

    act(() => {
      result.current.trackElement(el, 700, { position: 0 });
    });

    // No observer created when disabled
    expect(mockObservers).toHaveLength(0);
    expect(impressions).toHaveLength(0);

    el.remove();
  });

  it('cleans up metadata on untrackElement', () => {
    const impressions: ImpressionEvent[] = [];
    const onImpression = (e: ImpressionEvent) => impressions.push(e);

    const { result } = renderHook(() =>
      useViewportTracking({ enabled: true, onImpression, threshold: 0.5 })
    );

    const el = createElement('card-7');

    act(() => {
      result.current.trackElement(el, 800, { position: 10, dealerId: 5 });
    });

    // Untrack before it becomes visible
    act(() => {
      result.current.untrackElement(el);
    });

    const observer = mockObservers[0];

    // Triggering on the untracked element should not fire
    // (element removed from elementMapRef, so listingId lookup returns undefined)
    act(() => observer.triggerEntry(el, true, 0.6));

    expect(impressions).toHaveLength(0);

    el.remove();
  });

  it('still fires dwell events alongside impressions', () => {
    const impressions: ImpressionEvent[] = [];
    const dwells: Array<{ listingId: number }> = [];

    const { result } = renderHook(() =>
      useViewportTracking({
        enabled: true,
        onImpression: (e) => impressions.push(e),
        onDwell: (e) => dwells.push({ listingId: e.listingId }),
        threshold: 0.5,
      })
    );

    const el = createElement('card-8');

    act(() => {
      result.current.trackElement(el, 900, { position: 2 });
    });

    const observer = mockObservers[0];

    // Card becomes visible
    act(() => observer.triggerEntry(el, true, 0.7));

    // Impression fires immediately
    expect(impressions).toHaveLength(1);

    // Advance time past dwell threshold (2s default)
    act(() => vi.advanceTimersByTime(3000));

    // Card leaves viewport, triggering dwell flush
    act(() => observer.triggerEntry(el, false, 0));

    // Dwell should have fired too
    expect(dwells.length).toBeGreaterThanOrEqual(1);

    el.remove();
  });
});
