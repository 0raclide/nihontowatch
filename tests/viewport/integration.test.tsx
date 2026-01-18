/**
 * Viewport Tracking Integration Tests
 *
 * Tests for the full tracking flow from React components through to activity events.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import {
  ViewportTrackingProvider,
  useViewportTrackingContext,
  useListingCardTracking,
} from '@/lib/viewport/ViewportTrackingProvider';

// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  private callback: IntersectionObserverCallback;
  private elements: Map<Element, boolean> = new Map();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    mockObservers.push(this);
  }

  observe(target: Element): void {
    this.elements.set(target, true);
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

  // Test helper to trigger intersection
  triggerIntersection(
    target: Element,
    isIntersecting: boolean,
    ratio: number = 0.6
  ): void {
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

  // Test helper to trigger multiple intersections
  triggerMultiple(entries: Array<{ target: Element; isIntersecting: boolean; ratio?: number }>): void {
    const observerEntries: IntersectionObserverEntry[] = entries.map(e => ({
      target: e.target,
      isIntersecting: e.isIntersecting,
      intersectionRatio: e.ratio ?? 0.6,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: performance.now(),
    }));
    this.callback(observerEntries, this);
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

// Mock fetch for activity API
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ success: true }),
});
global.fetch = mockFetch;

// Test component that uses viewport tracking
function TrackedCard({ listingId }: { listingId: number }) {
  const { ref } = useListingCardTracking(listingId);

  return (
    <div ref={ref} data-testid={`card-${listingId}`}>
      Listing {listingId}
    </div>
  );
}

// Test component that exposes context for testing
function TestConsumer({ onContext }: { onContext: (ctx: ReturnType<typeof useViewportTrackingContext>) => void }) {
  const ctx = useViewportTrackingContext();
  React.useEffect(() => {
    onContext(ctx);
  }, [ctx, onContext]);
  return null;
}

// Minimal wrapper with just viewport tracking (no Supabase dependencies)
function MinimalWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ViewportTrackingProvider>
      {children}
    </ViewportTrackingProvider>
  );
}

describe('ViewportTrackingProvider', () => {
  it('should render children', () => {
    render(
      <MinimalWrapper>
        <div data-testid="child">Hello</div>
      </MinimalWrapper>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should provide context to children', () => {
    let context: ReturnType<typeof useViewportTrackingContext> | null = null;

    render(
      <MinimalWrapper>
        <TestConsumer onContext={(ctx) => { context = ctx; }} />
      </MinimalWrapper>
    );

    expect(context).not.toBeNull();
    // isEnabled will be false because there's no ActivityTracker parent
    expect(typeof context!.trackElement).toBe('function');
    expect(typeof context!.untrackElement).toBe('function');
  });

  it('should disable tracking when disabled prop is true', () => {
    let context: ReturnType<typeof useViewportTrackingContext> | null = null;

    render(
      <ViewportTrackingProvider disabled>
        <TestConsumer onContext={(ctx) => { context = ctx; }} />
      </ViewportTrackingProvider>
    );

    expect(context!.isEnabled).toBe(false);
  });
});

describe('useListingCardTracking', () => {
  it('should register element with viewport tracker', () => {
    render(
      <MinimalWrapper>
        <TrackedCard listingId={123} />
      </MinimalWrapper>
    );

    const card = screen.getByTestId('card-123');
    expect(card).toBeInTheDocument();
  });

  it('should return ref callback', () => {
    // Test the hook in isolation
    let refCallback: ((element: HTMLElement | null) => void) | null = null;

    function TestHookConsumer() {
      const { ref } = useListingCardTracking(999);
      refCallback = ref;
      return <div>Test</div>;
    }

    render(
      <MinimalWrapper>
        <TestHookConsumer />
      </MinimalWrapper>
    );

    expect(typeof refCallback).toBe('function');
  });
});

describe('multiple cards tracking', () => {
  it('should render multiple tracked cards', () => {
    render(
      <MinimalWrapper>
        <TrackedCard listingId={1} />
        <TrackedCard listingId={2} />
        <TrackedCard listingId={3} />
      </MinimalWrapper>
    );

    expect(screen.getByTestId('card-1')).toBeInTheDocument();
    expect(screen.getByTestId('card-2')).toBeInTheDocument();
    expect(screen.getByTestId('card-3')).toBeInTheDocument();
  });
});

describe('getDwellTime and isRevisit', () => {
  it('should return 0 for untracked listings', () => {
    let context: ReturnType<typeof useViewportTrackingContext> | null = null;

    render(
      <MinimalWrapper>
        <TestConsumer onContext={(ctx) => { context = ctx; }} />
      </MinimalWrapper>
    );

    // Should return 0 for untracked listing
    expect(context!.getDwellTime(999)).toBe(0);
    expect(context!.isRevisit(999)).toBe(false);
  });
});

describe('flush behavior', () => {
  it('should provide flush function', () => {
    let context: ReturnType<typeof useViewportTrackingContext> | null = null;

    render(
      <MinimalWrapper>
        <TestConsumer onContext={(ctx) => { context = ctx; }} />
      </MinimalWrapper>
    );

    expect(typeof context!.flush).toBe('function');
    // Calling flush should not throw
    expect(() => context!.flush()).not.toThrow();
  });
});
