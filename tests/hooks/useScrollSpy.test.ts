import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { useScrollSpy } from '@/hooks/useScrollSpy';

// Mock IntersectionObserver
type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void;

let mockCallback: IntersectionCallback | null = null;
let mockObservedElements: Element[] = [];

class MockIntersectionObserver {
  constructor(callback: IntersectionCallback, _options?: IntersectionObserverInit) {
    mockCallback = callback;
    mockObservedElements = [];
  }
  observe(el: Element) {
    mockObservedElements.push(el);
  }
  unobserve(_el: Element) {}
  disconnect() {
    mockObservedElements = [];
    mockCallback = null;
  }
}

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  mockCallback = null;
  mockObservedElements = [];
  document.body.innerHTML = '';
});

function createSectionElement(id: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
  return el;
}

function makeEntry(target: Element, isIntersecting: boolean, ratio = 0.5): IntersectionObserverEntry {
  return {
    target,
    isIntersecting,
    intersectionRatio: ratio,
    boundingClientRect: {} as DOMRectReadOnly,
    intersectionRect: {} as DOMRectReadOnly,
    rootBounds: null,
    time: Date.now(),
  };
}

describe('useScrollSpy', () => {
  it('returns null when sectionIds is empty', () => {
    const ref = { current: document.createElement('div') };
    const { result } = renderHook(() => useScrollSpy([], ref));
    expect(result.current).toBeNull();
  });

  it('returns the id of a single section in view', () => {
    const container = document.createElement('div');
    const ref = { current: container };
    const el = createSectionElement('stream-setsumei');

    const { result } = renderHook(() =>
      useScrollSpy(['stream-setsumei'], ref)
    );

    // Initially null
    expect(result.current).toBeNull();

    // Simulate intersection
    act(() => {
      mockCallback?.([makeEntry(el, true, 0.8)]);
    });

    expect(result.current).toBe('stream-setsumei');
  });

  it('picks the section with the highest intersection ratio', () => {
    const container = document.createElement('div');
    const ref = { current: container };
    const el1 = createSectionElement('stream-setsumei');
    const el2 = createSectionElement('stream-koshirae');

    const { result } = renderHook(() =>
      useScrollSpy(['stream-setsumei', 'stream-koshirae'], ref)
    );

    act(() => {
      mockCallback?.([
        makeEntry(el1, true, 0.3),
        makeEntry(el2, true, 0.7),
      ]);
    });

    expect(result.current).toBe('stream-koshirae');
  });

  it('removes section from tracking when it leaves view', () => {
    const container = document.createElement('div');
    const ref = { current: container };
    const el = createSectionElement('stream-sayagaki');

    const { result } = renderHook(() =>
      useScrollSpy(['stream-sayagaki'], ref)
    );

    act(() => {
      mockCallback?.([makeEntry(el, true, 0.5)]);
    });
    expect(result.current).toBe('stream-sayagaki');

    act(() => {
      mockCallback?.([makeEntry(el, false, 0)]);
    });
    expect(result.current).toBeNull();
  });

  it('cleans up observer on unmount', () => {
    const container = document.createElement('div');
    const ref = { current: container };
    createSectionElement('stream-test');

    const { unmount } = renderHook(() =>
      useScrollSpy(['stream-test'], ref)
    );

    expect(mockCallback).not.toBeNull();
    unmount();
    expect(mockCallback).toBeNull();
  });
});
