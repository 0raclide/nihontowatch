/**
 * Pinch Zoom Tracking Hook
 *
 * Detects pinch-to-zoom gestures on touch devices and reports
 * zoom events for engagement tracking.
 *
 * This is a strong interest signal - users who zoom in on images
 * are examining details closely, indicating high purchase intent.
 */

import { useCallback, useRef, useEffect } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface PinchZoomEvent {
  /** Final zoom scale achieved (1.0 = no zoom, 2.0 = 2x zoom) */
  scale: number;
  /** Duration of the pinch gesture in milliseconds */
  durationMs: number;
  /** Starting timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
}

export interface PinchZoomTrackingOptions {
  /** Callback when a pinch zoom gesture completes */
  onPinchZoom?: (event: PinchZoomEvent) => void;
  /** Minimum scale change to trigger event (default: 1.1 = 10% zoom) */
  minScaleThreshold?: number;
  /** Minimum duration to track (ms, default: 100) */
  minDurationMs?: number;
  /** Whether tracking is enabled (default: true) */
  enabled?: boolean;
}

export interface PinchZoomTrackingResult {
  /** Ref callback to attach to the element */
  ref: (element: HTMLElement | null) => void;
  /** Whether a pinch gesture is currently active */
  isPinching: boolean;
  /** Current scale during active gesture */
  currentScale: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate the distance between two touch points
 */
function getTouchDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function usePinchZoomTracking(
  options: PinchZoomTrackingOptions = {}
): PinchZoomTrackingResult {
  const {
    onPinchZoom,
    minScaleThreshold = 1.1,
    minDurationMs = 100,
    enabled = true,
  } = options;

  // Track gesture state
  const isPinchingRef = useRef(false);
  const initialDistanceRef = useRef(0);
  const startTimeRef = useRef(0);
  const maxScaleRef = useRef(1);
  const elementRef = useRef<HTMLElement | null>(null);

  // Handle touch start
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      if (e.touches.length !== 2) return;

      // Two fingers detected - start tracking pinch
      isPinchingRef.current = true;
      initialDistanceRef.current = getTouchDistance(e.touches[0], e.touches[1]);
      startTimeRef.current = Date.now();
      maxScaleRef.current = 1;
    },
    [enabled]
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      if (!isPinchingRef.current) return;
      if (e.touches.length !== 2) return;

      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialDistanceRef.current;

      // Track maximum scale achieved during gesture
      if (scale > maxScaleRef.current) {
        maxScaleRef.current = scale;
      }
    },
    [enabled]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      if (!isPinchingRef.current) return;

      // Gesture ended (one or both fingers lifted)
      if (e.touches.length < 2) {
        const endTime = Date.now();
        const durationMs = endTime - startTimeRef.current;
        const scale = maxScaleRef.current;

        // Only report if gesture meets thresholds
        if (scale >= minScaleThreshold && durationMs >= minDurationMs) {
          onPinchZoom?.({
            scale,
            durationMs,
            startTime: startTimeRef.current,
            endTime,
          });
        }

        // Reset state
        isPinchingRef.current = false;
        initialDistanceRef.current = 0;
        startTimeRef.current = 0;
        maxScaleRef.current = 1;
      }
    },
    [enabled, minScaleThreshold, minDurationMs, onPinchZoom]
  );

  // Ref callback to attach/detach listeners
  const refCallback = useCallback(
    (element: HTMLElement | null) => {
      // Clean up old element
      if (elementRef.current) {
        elementRef.current.removeEventListener('touchstart', handleTouchStart);
        elementRef.current.removeEventListener('touchmove', handleTouchMove);
        elementRef.current.removeEventListener('touchend', handleTouchEnd);
        elementRef.current.removeEventListener('touchcancel', handleTouchEnd);
      }

      elementRef.current = element;

      // Attach to new element
      if (element && enabled) {
        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: true });
        element.addEventListener('touchend', handleTouchEnd, { passive: true });
        element.addEventListener('touchcancel', handleTouchEnd, { passive: true });
      }
    },
    [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (elementRef.current) {
        elementRef.current.removeEventListener('touchstart', handleTouchStart);
        elementRef.current.removeEventListener('touchmove', handleTouchMove);
        elementRef.current.removeEventListener('touchend', handleTouchEnd);
        elementRef.current.removeEventListener('touchcancel', handleTouchEnd);
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    ref: refCallback,
    isPinching: isPinchingRef.current,
    currentScale: maxScaleRef.current,
  };
}

export default usePinchZoomTracking;
