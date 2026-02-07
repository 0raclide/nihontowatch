'use client';

import { Suspense, useRef, useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { QuickViewModal } from './QuickViewModal';
import { QuickViewContent } from './QuickViewContent';
import { QuickViewMobileSheet } from './QuickViewMobileSheet';
import { StudySetsumeiView } from './StudySetsumeiView';
import { useQuickView } from '@/contexts/QuickViewContext';
import { useActivityTrackerOptional } from '@/lib/tracking/ActivityTracker';
import { trackListingView } from '@/lib/tracking/viewTracker';
import { getSessionId } from '@/lib/activity/sessionManager';
import { usePinchZoomTracking } from '@/lib/viewport';
import { getAllImages, dealerDoesNotPublishImages, getCachedDimensions } from '@/lib/images';
import { useValidatedImages } from '@/hooks/useValidatedImages';
import { useAuth } from '@/lib/auth/AuthContext';
import type { ListingWithEnrichment } from '@/types';

// Blur placeholder for lazy images
const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNGYwIi8+PC9zdmc+';

/**
 * QuickView with vertical scrolling image layout.
 * Designed for tall dealer photos (1:2 to 1:5 aspect ratios).
 * Images load lazily as user scrolls.
 */
export function QuickView() {
  const {
    isOpen,
    currentListing,
    closeQuickView,
    hasNext,
    hasPrevious,
    goToNext,
    goToPrevious,
    currentIndex,
    listings,
  } = useQuickView();

  const activityTracker = useActivityTrackerOptional();
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileScrollContainerRef = useRef<HTMLDivElement>(null);
  const [visibleImages, setVisibleImages] = useState<Set<number>>(new Set([0, 1]));
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);
  const [isStudyMode, setIsStudyMode] = useState(false);

  // Track when the sheet state last changed for dwell time calculation
  const sheetStateChangeTimeRef = useRef<number>(Date.now());

  // Toggle sheet expanded/collapsed state and track engagement
  const toggleSheet = useCallback(() => {
    const now = Date.now();
    const dwellMs = now - sheetStateChangeTimeRef.current;
    sheetStateChangeTimeRef.current = now;

    // Determine the action based on current state
    // If currently expanded and toggling, the action is 'collapse'
    const action = isSheetExpanded ? 'collapse' : 'expand';

    // Track the toggle - 'collapse' is a particularly strong signal
    // (user wants more image space to inspect the item)
    if (activityTracker && currentListing) {
      activityTracker.trackQuickViewPanelToggle(
        currentListing.id,
        action,
        dwellMs
      );
    }

    setIsSheetExpanded(prev => !prev);
  }, [isSheetExpanded, activityTracker, currentListing]);

  // Track view to dedicated listing_views table when QuickView opens
  useEffect(() => {
    if (!currentListing || !isOpen) return;

    const sessionId = getSessionId();
    trackListingView(currentListing.id, sessionId, user?.id, 'browse');
  }, [currentListing?.id, isOpen, user?.id]);

  // Reset scroll and visible images when listing changes
  useEffect(() => {
    if (currentListing) {
      setVisibleImages(new Set([0, 1]));
      setCurrentImageIndex(0);
      setHasScrolled(false);
      setIsSheetExpanded(true);
      setIsStudyMode(false); // Reset study mode when navigating to new listing
      sheetStateChangeTimeRef.current = Date.now(); // Reset timing for new listing
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      if (mobileScrollContainerRef.current) {
        mobileScrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [currentListing?.id]);

  // Track scrolling for hint dismissal
  const handleScroll = useCallback(() => {
    if (!hasScrolled) {
      setHasScrolled(true);
    }
  }, [hasScrolled]);

  // Track pinch zoom gestures on images
  const handlePinchZoom = useCallback(
    (event: { scale: number; durationMs: number }) => {
      if (activityTracker && currentListing) {
        activityTracker.trackImagePinchZoom(
          currentListing.id,
          currentImageIndex,
          {
            zoomScale: event.scale,
            durationMs: event.durationMs,
          }
        );
      }
    },
    [activityTracker, currentListing, currentImageIndex]
  );

  // Pinch zoom tracking for mobile image scroller
  const { ref: pinchZoomRef } = usePinchZoomTracking({
    onPinchZoom: handlePinchZoom,
    minScaleThreshold: 1.15, // 15% zoom to trigger
    enabled: !!currentListing,
  });

  // Combine refs for mobile image scroller
  const setMobileScrollerRef = useCallback(
    (element: HTMLDivElement | null) => {
      mobileScrollContainerRef.current = element;
      pinchZoomRef(element);
    },
    [pinchZoomRef]
  );

  // Intersection observer for lazy loading
  const handleImageVisible = useCallback((index: number) => {
    setVisibleImages(prev => {
      const next = new Set(prev);
      // Load current, previous, and next 2 images
      for (let i = Math.max(0, index - 1); i <= index + 2; i++) {
        next.add(i);
      }
      return next;
    });
    setCurrentImageIndex(index);
  }, []);

  // Toggle study mode (setsumei reading view)
  const toggleStudyMode = useCallback(() => {
    setIsStudyMode(prev => !prev);
  }, []);

  // Get all images and validate them to filter out icons/buttons/tiny UI elements
  // Hook must be called unconditionally, so we handle null listing with empty array
  const rawImages = currentListing ? getAllImages(currentListing) : [];
  const { validatedImages: images } = useValidatedImages(rawImages);

  if (!currentListing) return null;

  const showNavigation = listings.length > 1 && currentIndex !== -1;
  const isSold = currentListing.is_sold || currentListing.status === 'sold' || currentListing.status === 'presumed_sold';

  return (
    <Suspense fallback={null}>
      <QuickViewModal
        isOpen={isOpen}
        onClose={closeQuickView}
      >
        {/* Mobile layout (show below lg, hide on lg+) */}
        <div className="lg:hidden h-full flex flex-col" data-testid="quickview-mobile-layout">
          {/* Study mode or image scroller */}
          {isStudyMode ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <StudySetsumeiView
                listing={currentListing as ListingWithEnrichment}
                onBackToPhotos={toggleStudyMode}
              />
            </div>
          ) : (
            /* Full-screen image scroller with pinch zoom tracking */
            <div
              ref={setMobileScrollerRef}
              data-testid="mobile-image-scroller"
              onScroll={handleScroll}
              onClick={toggleSheet}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-ink/5 relative"
            >
              {/* Sold overlay */}
              {isSold && (
                <div className="sticky top-0 z-20 bg-ink/80 text-white text-center py-2 text-sm font-medium tracking-wider uppercase">
                  Sold
                </div>
              )}

              {/* Vertical image list - full width */}
              <div className="space-y-1 p-1">
                {images.length === 0 ? (
                  dealerDoesNotPublishImages(currentListing.dealers?.domain) ? (
                    <div className="aspect-[4/3] bg-linen flex flex-col items-center justify-center text-center px-6">
                      <svg className="w-14 h-14 text-muted/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-muted/60 font-medium leading-relaxed">
                        This merchant does not publish images
                      </span>
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-linen flex items-center justify-center">
                      <svg className="w-16 h-16 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )
                ) : (
                  images.map((src, index) => (
                    <LazyImage
                      key={`mobile-${src}-${index}`}
                      src={src}
                      index={index}
                      totalImages={images.length}
                      isVisible={visibleImages.has(index)}
                      onVisible={handleImageVisible}
                      isFirst={index === 0}
                      showScrollHint={index === 0 && images.length > 1 && !hasScrolled}
                      listingTitle={currentListing.title}
                      itemType={currentListing.item_type}
                      certType={currentListing.cert_type}
                    />
                  ))
                )}
              </div>

              {/* End marker */}
              {images.length > 1 && (
                <div className="text-center py-4 text-[11px] text-muted flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {images.length} images
                </div>
              )}
            </div>
          )}

          {/* Bottom sheet overlay */}
          <QuickViewMobileSheet
            listing={currentListing}
            isExpanded={isSheetExpanded}
            onToggle={toggleSheet}
            onClose={closeQuickView}
            imageCount={images.length}
            currentImageIndex={currentImageIndex}
            isStudyMode={isStudyMode}
            onToggleStudyMode={toggleStudyMode}
          />
        </div>

        {/* Desktop layout (hide below lg, show on lg+) */}
        <div className="hidden lg:flex flex-row h-full min-h-0 overflow-hidden" data-testid="quickview-desktop-layout">
          {/* Study mode or Image Section */}
          {isStudyMode ? (
            <div className="flex-1 min-h-0 w-3/5 overflow-hidden">
              <StudySetsumeiView
                listing={currentListing as ListingWithEnrichment}
                onBackToPhotos={toggleStudyMode}
              />
            </div>
          ) : (
            /* Image Section - Scrollable vertical list */
            <div
              ref={scrollContainerRef}
              data-testid="desktop-image-scroller"
              onScroll={handleScroll}
              className="flex-1 min-h-0 w-3/5 overflow-y-auto overscroll-contain bg-ink/5 relative"
            >
              {/* Sold overlay */}
              {isSold && (
                <div className="sticky top-0 z-20 bg-ink/80 text-white text-center py-2 text-sm font-medium tracking-wider uppercase">
                  Sold
                </div>
              )}

              {/* Vertical image list */}
              <div className="space-y-1 p-2">
                {images.length === 0 ? (
                  dealerDoesNotPublishImages(currentListing.dealers?.domain) ? (
                    <div className="aspect-[4/3] bg-linen flex flex-col items-center justify-center text-center px-6">
                      <svg className="w-14 h-14 text-muted/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-muted/60 font-medium leading-relaxed">
                        This merchant does not publish images
                      </span>
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-linen flex items-center justify-center">
                      <svg className="w-16 h-16 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )
                ) : (
                  images.map((src, index) => (
                    <LazyImage
                      key={`desktop-${src}-${index}`}
                      src={src}
                      index={index}
                      totalImages={images.length}
                      isVisible={visibleImages.has(index)}
                      onVisible={handleImageVisible}
                      isFirst={index === 0}
                      showScrollHint={index === 0 && images.length > 1 && !hasScrolled}
                      listingTitle={currentListing.title}
                      itemType={currentListing.item_type}
                      certType={currentListing.cert_type}
                    />
                  ))
                )}
              </div>

              {/* End marker */}
              {images.length > 1 && (
                <div className="text-center py-4 text-[11px] text-muted flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {images.length} images
                </div>
              )}
            </div>
          )}

          {/* Content Section - Fixed on desktop */}
          <div data-testid="desktop-content-panel" className="w-2/5 max-w-md border-l border-border bg-cream flex flex-col min-h-0 overflow-hidden">
            {/* Desktop image progress - hide in study mode */}
            {!isStudyMode && images.length > 1 && (
              <div className="border-b border-border">
                {/* Progress bar */}
                <div className="h-0.5 bg-border">
                  <div
                    className="h-full bg-gold transition-all duration-300 ease-out"
                    style={{ width: `${((currentImageIndex + 1) / images.length) * 100}%` }}
                  />
                </div>
                {/* Counter */}
                <div className="flex items-center justify-center py-1.5">
                  <span className="text-[11px] text-muted tabular-nums">
                    Photo {currentImageIndex + 1} of {images.length}
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto">
              <QuickViewContent
                listing={currentListing}
                onClose={closeQuickView}
                isStudyMode={isStudyMode}
                onToggleStudyMode={toggleStudyMode}
              />
            </div>
          </div>

          {/* Listing Navigation (Desktop only) */}
          {showNavigation && (
            <>
              <button
                data-testid="nav-previous"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
                disabled={!hasPrevious}
                className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-cream/95 border border-border shadow-lg transition-all duration-200 ${
                  hasPrevious
                    ? 'hover:bg-cream hover:border-gold hover:scale-105'
                    : 'opacity-40 cursor-not-allowed'
                }`}
                aria-label="Previous listing"
                title="Previous listing (K)"
              >
                <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                data-testid="nav-next"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                disabled={!hasNext}
                className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-cream/95 border border-border shadow-lg transition-all duration-200 ${
                  hasNext
                    ? 'hover:bg-cream hover:border-gold hover:scale-105'
                    : 'opacity-40 cursor-not-allowed'
                }`}
                aria-label="Next listing"
                title="Next listing (J)"
              >
                <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Listing counter */}
              <div data-testid="listing-counter" className="absolute bottom-3 left-2 z-20 px-2 py-1 rounded bg-ink/60 backdrop-blur-sm">
                <span className="text-[11px] text-white font-medium tabular-nums">
                  {currentIndex + 1} / {listings.length}
                </span>
              </div>
            </>
          )}
        </div>
      </QuickViewModal>
    </Suspense>
  );
}

/**
 * Lazy-loaded image component with intersection observer and retry logic.
 *
 * On error, it retries once with unoptimized=true (bypasses Next.js image optimization),
 * which can help when the optimization service has issues with certain images.
 */
function LazyImage({
  src,
  index,
  totalImages,
  isVisible,
  onVisible,
  isFirst,
  showScrollHint,
  listingTitle,
  itemType,
  certType,
}: {
  src: string;
  index: number;
  totalImages: number;
  isVisible: boolean;
  onVisible: (index: number) => void;
  isFirst: boolean;
  showScrollHint: boolean;
  listingTitle?: string;
  itemType?: string;
  certType?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [useUnoptimized, setUseUnoptimized] = useState(false);

  // Get cached dimensions from preload (if available)
  // This allows us to set the correct aspect ratio before the image loads
  const cachedDimensions = getCachedDimensions(src);
  const hasKnownDimensions = !!cachedDimensions;

  // Reset state when src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
    setRetryCount(0);
    setUseUnoptimized(false);
  }, [src]);

  // Mobile Safari fix: onLoad doesn't always fire on initial page load from deep links.
  // This effect checks if the image is already complete (cached) or uses a fallback timeout.
  // See: https://bugs.webkit.org/show_bug.cgi?id=233419
  useEffect(() => {
    if (!isVisible || loaded || error) return;

    // Check if the image is already complete (e.g., from browser cache)
    // Need to wait a tick for the img element to be available in the DOM
    const checkComplete = () => {
      // Find the img element within our container (Next.js Image renders an img)
      const container = ref.current;
      if (!container) return false;

      const img = container.querySelector('img');
      if (img && img.complete && img.naturalWidth > 0) {
        setLoaded(true);
        return true;
      }
      return false;
    };

    // Check immediately after render
    const immediateCheck = requestAnimationFrame(() => {
      checkComplete();
    });

    // Fallback timeout for first image: if onLoad doesn't fire within 3 seconds,
    // assume the image loaded (mobile Safari sometimes doesn't fire onLoad)
    let fallbackTimeout: ReturnType<typeof setTimeout> | undefined;
    if (isFirst) {
      fallbackTimeout = setTimeout(() => {
        if (!loaded && !error) {
          // Double-check if image is complete before forcing loaded state
          if (checkComplete()) return;

          // Force loaded state - the image is likely rendered but onLoad didn't fire
          // This is better UX than showing a perpetual loading spinner
          console.warn(`[LazyImage] Fallback: forcing loaded state for image ${index} after timeout`);
          setLoaded(true);
        }
      }, 3000);
    }

    return () => {
      cancelAnimationFrame(immediateCheck);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
    };
  }, [isVisible, loaded, error, isFirst, index]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onVisible(index);
          }
        });
      },
      {
        rootMargin: '200px 0px', // Load images 200px before they enter viewport
        threshold: 0.1
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [index, onVisible]);

  const handleError = () => {
    // On first error, retry with unoptimized (bypasses Next.js image optimization)
    if (retryCount === 0) {
      setRetryCount(1);
      setUseUnoptimized(true);
      setLoaded(false);
      // Don't set error yet, let the retry happen
    } else {
      // After retry failed, show error state
      setError(true);
    }
  };

  // Container style with dynamic aspect ratio when dimensions are known
  const containerStyle = hasKnownDimensions
    ? { aspectRatio: `${cachedDimensions.width} / ${cachedDimensions.height}` }
    : undefined;

  // When dimensions are unknown, use min-height as fallback
  const containerClass = `relative bg-linen rounded overflow-hidden ${
    !hasKnownDimensions && !loaded && !error && isVisible ? 'min-h-[300px]' : ''
  }`;

  return (
    <div
      ref={ref}
      className={containerClass}
      style={containerStyle}
    >
      {isVisible ? (
        <>
          {/* Loading skeleton - maintains height while image loads */}
          {!loaded && !error && (
            <div className={`absolute inset-0 img-loading ${!hasKnownDimensions ? 'min-h-[300px]' : ''}`} />
          )}

          {/* Error state */}
          {error && (
            <div className="aspect-[3/4] flex items-center justify-center bg-linen">
              <span className="text-muted text-sm">Failed to load</span>
            </div>
          )}

          {/* Actual image - Next.js Image for optimization (AVIF/WebP, sizing) */}
          {/* Uses fill + object-contain when dimensions are known for stable layout */}
          {!error && (
            <Image
              key={`${src}-${retryCount}`}
              src={src}
              alt={[
                itemType,
                certType,
                listingTitle,
                `Photo ${index + 1} of ${totalImages}`,
              ].filter(Boolean).join(' - ')}
              {...(hasKnownDimensions
                ? { fill: true, className: `object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}` }
                : {
                    width: 800,
                    height: 600,
                    className: `w-full h-auto transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`,
                    style: { width: '100%', height: 'auto' },
                  }
              )}
              onLoad={() => setLoaded(true)}
              onError={handleError}
              loading={isFirst ? 'eager' : 'lazy'}
              fetchPriority={isFirst ? 'high' : undefined}
              placeholder="blur"
              blurDataURL={BLUR_PLACEHOLDER}
              sizes="(max-width: 1024px) 100vw, 60vw"
              unoptimized={useUnoptimized}
            />
          )}

          {/* Image position indicator - elegant pill */}
          {loaded && totalImages > 1 && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink/70 backdrop-blur-sm">
              <span className="text-[11px] text-white/90 font-medium tabular-nums">
                {index + 1}
              </span>
              <span className="text-[11px] text-white/50">/</span>
              <span className="text-[11px] text-white/50 tabular-nums">
                {totalImages}
              </span>
            </div>
          )}

          {/* Scroll hint on first image - subtle fade animation */}
          {showScrollHint && loaded && (
            <div className="absolute bottom-16 inset-x-0 flex justify-center pointer-events-none animate-pulse">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-ink/60 backdrop-blur-md">
                <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-[12px] text-white/90 font-medium">
                  {totalImages - 1} more photos
                </span>
              </div>
            </div>
          )}
        </>
      ) : (
        // Placeholder before image enters viewport range
        // Uses cached dimensions if available, otherwise falls back to 3:4
        <div
          className="bg-linen flex items-center justify-center"
          style={hasKnownDimensions
            ? { aspectRatio: `${cachedDimensions.width} / ${cachedDimensions.height}` }
            : { aspectRatio: '3 / 4' }
          }
        >
          <div className="w-8 h-8 border-2 border-border border-t-gold rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

export default QuickView;
