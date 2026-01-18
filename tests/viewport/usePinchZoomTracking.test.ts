/**
 * Pinch Zoom Tracking Hook Tests
 *
 * Tests for the pinch-to-zoom gesture detection hook.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePinchZoomTracking, type PinchZoomEvent } from '@/lib/viewport/usePinchZoomTracking';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock TouchEvent with specified touch points
 */
function createTouchEvent(
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  touches: Array<{ clientX: number; clientY: number }>
): TouchEvent {
  const touchList = touches.map((t, i) => ({
    identifier: i,
    clientX: t.clientX,
    clientY: t.clientY,
    screenX: t.clientX,
    screenY: t.clientY,
    pageX: t.clientX,
    pageY: t.clientY,
    radiusX: 10,
    radiusY: 10,
    rotationAngle: 0,
    force: 1,
    target: document.createElement('div'),
  })) as unknown as Touch[];

  const event = new Event(type, { bubbles: true }) as TouchEvent;
  Object.defineProperty(event, 'touches', {
    value: touchList,
    writable: false,
  });
  return event;
}

/**
 * Calculate distance between two points
 */
function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// =============================================================================
// Tests
// =============================================================================

describe('usePinchZoomTracking', () => {
  let element: HTMLDivElement;
  let pinchEvents: PinchZoomEvent[];

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
    pinchEvents = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.removeChild(element);
    vi.useRealTimers();
  });

  describe('basic gesture detection', () => {
    it('should attach event listeners when ref is set', () => {
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

      const { result } = renderHook(() =>
        usePinchZoomTracking({
          onPinchZoom: (e) => pinchEvents.push(e),
        })
      );

      act(() => {
        result.current.ref(element);
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        { passive: true }
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'touchmove',
        expect.any(Function),
        { passive: true }
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'touchend',
        expect.any(Function),
        { passive: true }
      );
    });

    it('should remove event listeners when ref is cleared', () => {
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      const { result } = renderHook(() =>
        usePinchZoomTracking({
          onPinchZoom: (e) => pinchEvents.push(e),
        })
      );

      act(() => {
        result.current.ref(element);
      });

      act(() => {
        result.current.ref(null);
      });

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function)
      );
    });

    it('should not track single-finger touches', () => {
      const { result } = renderHook(() =>
        usePinchZoomTracking({
          onPinchZoom: (e) => pinchEvents.push(e),
          minScaleThreshold: 1.0, // Any zoom
        })
      );

      act(() => {
        result.current.ref(element);
      });

      // Single finger touch
      const touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      element.dispatchEvent(touchStart);

      vi.advanceTimersByTime(500);

      const touchEnd = createTouchEvent('touchend', []);
      element.dispatchEvent(touchEnd);

      expect(pinchEvents).toHaveLength(0);
    });
  });

  describe('pinch zoom detection', () => {
    it('should detect zoom-in gesture', () => {
      const { result } = renderHook(() =>
        usePinchZoomTracking({
          onPinchZoom: (e) => pinchEvents.push(e),
          minScaleThreshold: 1.1,
          minDurationMs: 50,
        })
      );

      act(() => {
        result.current.ref(element);
      });

      // Start with fingers 100px apart
      const touchStart = createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      element.dispatchEvent(touchStart);

      vi.advanceTimersByTime(100);

      // Move fingers to 150px apart (1.5x zoom)
      const touchMove = createTouchEvent('touchmove', [
        { clientX: 75, clientY: 100 },
        { clientX: 225, clientY: 100 },
      ]);
      element.dispatchEvent(touchMove);

      vi.advanceTimersByTime(100);

      // End gesture
      const touchEnd = createTouchEvent('touchend', []);
      element.dispatchEvent(touchEnd);

      expect(pinchEvents).toHaveLength(1);
      expect(pinchEvents[0].scale).toBeCloseTo(1.5, 1);
      expect(pinchEvents[0].durationMs).toBeGreaterThanOrEqual(100);
    });

    it('should not trigger for small zoom gestures below threshold', () => {
      const { result } = renderHook(() =>
        usePinchZoomTracking({
          onPinchZoom: (e) => pinchEvents.push(e),
          minScaleThreshold: 1.2, // 20% minimum zoom
          minDurationMs: 50,
        })
      );

      act(() => {
        result.current.ref(element);
      });

      // Start with fingers 100px apart
      const touchStart = createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      element.dispatchEvent(touchStart);

      vi.advanceTimersByTime(100);

      // Move fingers to only 110px apart (1.1x zoom - below 1.2 threshold)
      const touchMove = createTouchEvent('touchmove', [
        { clientX: 95, clientY: 100 },
        { clientX: 205, clientY: 100 },
      ]);
      element.dispatchEvent(touchMove);

      vi.advanceTimersByTime(100);

      // End gesture
      const touchEnd = createTouchEvent('touchend', []);
      element.dispatchEvent(touchEnd);

      expect(pinchEvents).toHaveLength(0);
    });

    it('should not trigger for very short gestures', () => {
      const { result } = renderHook(() =>
        usePinchZoomTracking({
          onPinchZoom: (e) => pinchEvents.push(e),
          minScaleThreshold: 1.1,
          minDurationMs: 200, // Require 200ms minimum
        })
      );

      act(() => {
        result.current.ref(element);
      });

      // Start with fingers 100px apart
      const touchStart = createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      element.dispatchEvent(touchStart);

      // Quick gesture - only 50ms
      vi.advanceTimersByTime(50);

      // Move fingers to 150px apart (1.5x zoom)
      const touchMove = createTouchEvent('touchmove', [
        { clientX: 75, clientY: 100 },
        { clientX: 225, clientY: 100 },
      ]);
      element.dispatchEvent(touchMove);

      // End gesture immediately
      const touchEnd = createTouchEvent('touchend', []);
      element.dispatchEvent(touchEnd);

      expect(pinchEvents).toHaveLength(0);
    });
  });

  describe('disabled state', () => {
    it('should not track when disabled', () => {
      const { result } = renderHook(() =>
        usePinchZoomTracking({
          onPinchZoom: (e) => pinchEvents.push(e),
          enabled: false,
          minScaleThreshold: 1.0,
        })
      );

      act(() => {
        result.current.ref(element);
      });

      // Start with fingers 100px apart
      const touchStart = createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      element.dispatchEvent(touchStart);

      vi.advanceTimersByTime(100);

      // Move fingers to 200px apart (2x zoom)
      const touchMove = createTouchEvent('touchmove', [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 },
      ]);
      element.dispatchEvent(touchMove);

      vi.advanceTimersByTime(100);

      // End gesture
      const touchEnd = createTouchEvent('touchend', []);
      element.dispatchEvent(touchEnd);

      expect(pinchEvents).toHaveLength(0);
    });
  });

  describe('gesture cancellation', () => {
    it('should handle touchcancel event', () => {
      const { result } = renderHook(() =>
        usePinchZoomTracking({
          onPinchZoom: (e) => pinchEvents.push(e),
          minScaleThreshold: 1.1,
          minDurationMs: 50,
        })
      );

      act(() => {
        result.current.ref(element);
      });

      // Start pinch
      const touchStart = createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      element.dispatchEvent(touchStart);

      vi.advanceTimersByTime(100);

      // Move to zoom
      const touchMove = createTouchEvent('touchmove', [
        { clientX: 75, clientY: 100 },
        { clientX: 225, clientY: 100 },
      ]);
      element.dispatchEvent(touchMove);

      vi.advanceTimersByTime(100);

      // Cancel gesture
      const touchCancel = createTouchEvent('touchcancel', []);
      element.dispatchEvent(touchCancel);

      // Should still trigger since threshold was met before cancel
      expect(pinchEvents).toHaveLength(1);
    });
  });

  describe('maximum scale tracking', () => {
    it('should report maximum scale achieved during gesture', () => {
      const { result } = renderHook(() =>
        usePinchZoomTracking({
          onPinchZoom: (e) => pinchEvents.push(e),
          minScaleThreshold: 1.1,
          minDurationMs: 50,
        })
      );

      act(() => {
        result.current.ref(element);
      });

      // Start with fingers 100px apart
      const touchStart = createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      element.dispatchEvent(touchStart);

      vi.advanceTimersByTime(50);

      // Zoom to 2x
      const touchMove1 = createTouchEvent('touchmove', [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 },
      ]);
      element.dispatchEvent(touchMove1);

      vi.advanceTimersByTime(50);

      // Zoom back to 1.5x (user reduced zoom)
      const touchMove2 = createTouchEvent('touchmove', [
        { clientX: 75, clientY: 100 },
        { clientX: 225, clientY: 100 },
      ]);
      element.dispatchEvent(touchMove2);

      vi.advanceTimersByTime(50);

      // End gesture
      const touchEnd = createTouchEvent('touchend', []);
      element.dispatchEvent(touchEnd);

      // Should report the max scale (2x), not the final scale (1.5x)
      expect(pinchEvents).toHaveLength(1);
      expect(pinchEvents[0].scale).toBeCloseTo(2.0, 1);
    });
  });
});
