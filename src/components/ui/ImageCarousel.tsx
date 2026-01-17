'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  TouchEvent,
  MouseEvent,
  KeyboardEvent,
} from 'react';
import Image from 'next/image';

export interface ImageCarouselProps {
  images: string[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  className?: string;
  showDots?: boolean;
  enableZoom?: boolean;
}

// Tiny placeholder for blur effect
const BLUR_PLACEHOLDER =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNGYwIi8+PC9zdmc+';

// Swipe threshold in pixels
const SWIPE_THRESHOLD = 50;
// Velocity threshold for quick flicks (px/ms)
const VELOCITY_THRESHOLD = 0.3;
// Animation duration in ms
const TRANSITION_DURATION = 300;
// Double tap time window in ms
const DOUBLE_TAP_DELAY = 300;
// Max zoom scale
const MAX_ZOOM = 3;
const MIN_ZOOM = 1;

export default function ImageCarousel({
  images,
  initialIndex = 0,
  onIndexChange,
  className = '',
  showDots = true,
  enableZoom = false,
}: ImageCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set([initialIndex]));

  // Touch state
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const touchCurrentX = useRef(0);
  const isDragging = useRef(false);
  const translateX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Zoom state
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const lastTapTime = useRef(0);
  const pinchStartDistance = useRef(0);
  const pinchStartScale = useRef(1);

  // Preload adjacent images
  useEffect(() => {
    const indicesToPreload = [
      currentIndex - 1,
      currentIndex,
      currentIndex + 1,
    ].filter((i) => i >= 0 && i < images.length);

    setLoadedImages((prev) => {
      const next = new Set(prev);
      indicesToPreload.forEach((i) => next.add(i));
      return next;
    });
  }, [currentIndex, images.length]);

  // Notify parent of index changes
  useEffect(() => {
    onIndexChange?.(currentIndex);
  }, [currentIndex, onIndexChange]);

  // Reset zoom when changing images
  useEffect(() => {
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  const goToIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= images.length || isTransitioning) return;
      setIsTransitioning(true);
      setCurrentIndex(index);
      setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION);
    },
    [images.length, isTransitioning]
  );

  const goToNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      goToIndex(currentIndex + 1);
    }
  }, [currentIndex, images.length, goToIndex]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      goToIndex(currentIndex - 1);
    }
  }, [currentIndex, goToIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (zoomScale > 1) return; // Disable nav when zoomed

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
    },
    [zoomScale, goToPrevious, goToNext]
  );

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (isTransitioning) return;

      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      touchCurrentX.current = touch.clientX;
      touchStartTime.current = Date.now();
      isDragging.current = true;
      translateX.current = 0;

      // Handle pinch zoom start
      if (enableZoom && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDistance.current = Math.sqrt(dx * dx + dy * dy);
        pinchStartScale.current = zoomScale;
      }
    },
    [isTransitioning, enableZoom, zoomScale]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging.current) return;

      // Handle pinch zoom
      if (enableZoom && e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const scale = (distance / pinchStartDistance.current) * pinchStartScale.current;
        setZoomScale(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale)));
        return;
      }

      // If zoomed, handle pan instead of swipe
      if (zoomScale > 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchCurrentX.current;
        const deltaY = touch.clientY - touchStartY.current;
        touchCurrentX.current = touch.clientX;

        setZoomPosition((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));
        return;
      }

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;
      touchCurrentX.current = touch.clientX;

      // Determine if horizontal or vertical scroll
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        // User is scrolling vertically, let the page scroll
        isDragging.current = false;
        return;
      }

      // Prevent page scroll for horizontal swipe
      if (Math.abs(deltaX) > 10) {
        e.preventDefault();
      }

      translateX.current = deltaX;

      // Apply resistance at edges
      let adjustedDelta = deltaX;
      if (
        (currentIndex === 0 && deltaX > 0) ||
        (currentIndex === images.length - 1 && deltaX < 0)
      ) {
        adjustedDelta = deltaX * 0.3; // Resistance at edges
      }

      // Update track position with GPU acceleration
      if (trackRef.current) {
        const offset = -currentIndex * 100 + (adjustedDelta / (containerRef.current?.offsetWidth || 1)) * 100;
        trackRef.current.style.transform = `translate3d(${offset}%, 0, 0)`;
        trackRef.current.style.transition = 'none';
      }
    },
    [currentIndex, images.length, enableZoom, zoomScale]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;

      // Handle double tap to zoom
      if (enableZoom && e.changedTouches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime.current < DOUBLE_TAP_DELAY) {
          // Double tap detected
          if (zoomScale > 1) {
            setZoomScale(1);
            setZoomPosition({ x: 0, y: 0 });
          } else {
            setZoomScale(2);
            // Center zoom on tap position
            const touch = e.changedTouches[0];
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              const x = touch.clientX - rect.left - rect.width / 2;
              const y = touch.clientY - rect.top - rect.height / 2;
              setZoomPosition({ x: -x, y: -y });
            }
          }
          lastTapTime.current = 0;
          return;
        }
        lastTapTime.current = now;
      }

      // If zoomed, don't navigate
      if (zoomScale > 1) return;

      const deltaX = translateX.current;
      const elapsed = Date.now() - touchStartTime.current;
      const velocity = Math.abs(deltaX) / elapsed;

      // Restore transition
      if (trackRef.current) {
        trackRef.current.style.transition = `transform ${TRANSITION_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      }

      // Determine if we should navigate
      const shouldNavigate =
        Math.abs(deltaX) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

      if (shouldNavigate) {
        if (deltaX > 0 && currentIndex > 0) {
          goToPrevious();
        } else if (deltaX < 0 && currentIndex < images.length - 1) {
          goToNext();
        } else {
          // Snap back to current
          snapToCurrentIndex();
        }
      } else {
        // Snap back to current
        snapToCurrentIndex();
      }
    },
    [currentIndex, images.length, goToNext, goToPrevious, enableZoom, zoomScale]
  );

  const snapToCurrentIndex = useCallback(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${-currentIndex * 100}%, 0, 0)`;
      trackRef.current.style.transition = `transform ${TRANSITION_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    }
  }, [currentIndex]);

  // Mouse handlers for desktop
  const mouseStartX = useRef(0);
  const isMouseDragging = useRef(false);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (isTransitioning || zoomScale > 1) return;
      e.preventDefault();
      mouseStartX.current = e.clientX;
      touchStartTime.current = Date.now();
      isMouseDragging.current = true;
      translateX.current = 0;
    },
    [isTransitioning, zoomScale]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isMouseDragging.current) return;

      const deltaX = e.clientX - mouseStartX.current;
      translateX.current = deltaX;

      // Apply resistance at edges
      let adjustedDelta = deltaX;
      if (
        (currentIndex === 0 && deltaX > 0) ||
        (currentIndex === images.length - 1 && deltaX < 0)
      ) {
        adjustedDelta = deltaX * 0.3;
      }

      if (trackRef.current) {
        const offset = -currentIndex * 100 + (adjustedDelta / (containerRef.current?.offsetWidth || 1)) * 100;
        trackRef.current.style.transform = `translate3d(${offset}%, 0, 0)`;
        trackRef.current.style.transition = 'none';
      }
    },
    [currentIndex, images.length]
  );

  const handleMouseUp = useCallback(() => {
    if (!isMouseDragging.current) return;
    isMouseDragging.current = false;

    const deltaX = translateX.current;
    const elapsed = Date.now() - touchStartTime.current;
    const velocity = Math.abs(deltaX) / elapsed;

    if (trackRef.current) {
      trackRef.current.style.transition = `transform ${TRANSITION_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    }

    const shouldNavigate =
      Math.abs(deltaX) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

    if (shouldNavigate) {
      if (deltaX > 0 && currentIndex > 0) {
        goToPrevious();
      } else if (deltaX < 0 && currentIndex < images.length - 1) {
        goToNext();
      } else {
        snapToCurrentIndex();
      }
    } else {
      snapToCurrentIndex();
    }
  }, [currentIndex, images.length, goToNext, goToPrevious, snapToCurrentIndex]);

  const handleMouseLeave = useCallback(() => {
    if (isMouseDragging.current) {
      handleMouseUp();
    }
  }, [handleMouseUp]);

  // Update track position when current index changes
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${-currentIndex * 100}%, 0, 0)`;
      trackRef.current.style.transition = `transform ${TRANSITION_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    }
  }, [currentIndex]);

  if (images.length === 0) {
    return (
      <div className={`relative aspect-[4/3] bg-linen rounded-lg overflow-hidden ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-16 h-16 text-muted/30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative aspect-[4/3] bg-linen rounded-lg overflow-hidden select-none ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Image carousel"
      aria-roledescription="carousel"
    >
      {/* Image track */}
      <div
        ref={trackRef}
        className="flex h-full will-change-transform"
        style={{
          transform: `translate3d(${-currentIndex * 100}%, 0, 0)`,
          transition: `transform ${TRANSITION_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {images.map((src, index) => (
          <div
            key={`${src}-${index}`}
            className="relative flex-shrink-0 w-full h-full"
            aria-hidden={index !== currentIndex}
            role="group"
            aria-roledescription="slide"
            aria-label={`Image ${index + 1} of ${images.length}`}
          >
            {loadedImages.has(index) && (
              <div
                className="relative w-full h-full"
                style={{
                  transform:
                    enableZoom && index === currentIndex
                      ? `scale(${zoomScale}) translate(${zoomPosition.x / zoomScale}px, ${zoomPosition.y / zoomScale}px)`
                      : undefined,
                  transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
                }}
              >
                <Image
                  src={src}
                  alt={`Image ${index + 1}`}
                  fill
                  className="object-contain pointer-events-none"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority={index === initialIndex}
                  placeholder="blur"
                  blurDataURL={BLUR_PLACEHOLDER}
                  draggable={false}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation arrows (desktop only) */}
      {images.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            disabled={currentIndex === 0 || zoomScale > 1}
            className={`hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-paper/90 border border-border shadow-sm transition-all duration-200 ${
              currentIndex === 0 || zoomScale > 1
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-paper hover:border-gold hover:scale-105'
            }`}
            aria-label="Previous image"
          >
            <svg
              className="w-5 h-5 text-ink"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={goToNext}
            disabled={currentIndex === images.length - 1 || zoomScale > 1}
            className={`hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-paper/90 border border-border shadow-sm transition-all duration-200 ${
              currentIndex === images.length - 1 || zoomScale > 1
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-paper hover:border-gold hover:scale-105'
            }`}
            aria-label="Next image"
          >
            <svg
              className="w-5 h-5 text-ink"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {showDots && images.length > 1 && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1.5 rounded-full bg-ink/40 backdrop-blur-sm"
          role="tablist"
          aria-label="Image navigation"
        >
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => zoomScale <= 1 && goToIndex(index)}
              disabled={zoomScale > 1}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === currentIndex
                  ? 'bg-white w-4'
                  : 'bg-white/50 hover:bg-white/75'
              } ${zoomScale > 1 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              role="tab"
              aria-selected={index === currentIndex}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Image counter (mobile) */}
      <div className="absolute top-3 right-3 px-2 py-1 rounded bg-ink/40 backdrop-blur-sm lg:hidden">
        <span className="text-[11px] text-white font-medium tabular-nums">
          {currentIndex + 1} / {images.length}
        </span>
      </div>

      {/* Zoom indicator */}
      {enableZoom && zoomScale > 1 && (
        <div className="absolute top-3 left-3 px-2 py-1 rounded bg-ink/40 backdrop-blur-sm">
          <span className="text-[11px] text-white font-medium">
            {Math.round(zoomScale * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
