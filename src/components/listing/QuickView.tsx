'use client';

import { Suspense, useRef, useEffect, useState, useCallback } from 'react';
import { QuickViewModal } from './QuickViewModal';
import { QuickViewContent } from './QuickViewContent';
import { QuickViewMobileSheet } from './QuickViewMobileSheet';
import { useQuickView } from '@/contexts/QuickViewContext';

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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileScrollContainerRef = useRef<HTMLDivElement>(null);
  const [visibleImages, setVisibleImages] = useState<Set<number>>(new Set([0, 1]));
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);

  // Toggle sheet expanded/collapsed state
  const toggleSheet = useCallback(() => {
    setIsSheetExpanded(prev => !prev);
  }, []);

  // Reset scroll and visible images when listing changes
  useEffect(() => {
    if (currentListing) {
      setVisibleImages(new Set([0, 1]));
      setCurrentImageIndex(0);
      setHasScrolled(false);
      setIsSheetExpanded(true);
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

  if (!currentListing) return null;

  const images = currentListing.images || [];
  const showNavigation = listings.length > 1 && currentIndex !== -1;
  const isSold = currentListing.is_sold || currentListing.status === 'sold' || currentListing.status === 'presumed_sold';

  return (
    <Suspense fallback={null}>
      <QuickViewModal
        isOpen={isOpen}
        onClose={closeQuickView}
      >
        {/* Mobile layout (show below lg, hide on lg+) */}
        <div className="lg:hidden h-full flex flex-col">
          {/* Full-screen image scroller */}
          <div
            ref={mobileScrollContainerRef}
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
                <div className="aspect-[4/3] bg-linen flex items-center justify-center">
                  <svg className="w-16 h-16 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
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

          {/* Bottom sheet overlay */}
          <QuickViewMobileSheet
            listing={currentListing}
            isExpanded={isSheetExpanded}
            onToggle={toggleSheet}
            onClose={closeQuickView}
            imageCount={images.length}
            currentImageIndex={currentImageIndex}
          />
        </div>

        {/* Desktop layout (hide below lg, show on lg+) */}
        <div className="hidden lg:flex flex-row h-full min-h-0 overflow-hidden">
          {/* Image Section - Scrollable vertical list */}
          <div
            ref={scrollContainerRef}
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
                <div className="aspect-[4/3] bg-linen flex items-center justify-center">
                  <svg className="w-16 h-16 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
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

          {/* Content Section - Fixed on desktop */}
          <div className="w-2/5 max-w-md border-l border-border bg-cream flex flex-col min-h-0 overflow-hidden">
            {/* Desktop image progress */}
            {images.length > 1 && (
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
              <QuickViewContent listing={currentListing} onClose={closeQuickView} />
            </div>
          </div>

          {/* Listing Navigation (Desktop only) */}
          {showNavigation && (
            <>
              <button
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
              <div className="absolute bottom-3 left-2 z-20 px-2 py-1 rounded bg-ink/60 backdrop-blur-sm">
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
 * Lazy-loaded image component with intersection observer
 */
function LazyImage({
  src,
  index,
  totalImages,
  isVisible,
  onVisible,
  isFirst,
  showScrollHint
}: {
  src: string;
  index: number;
  totalImages: number;
  isVisible: boolean;
  onVisible: (index: number) => void;
  isFirst: boolean;
  showScrollHint: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

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

  return (
    <div
      ref={ref}
      className="relative bg-linen rounded overflow-hidden"
    >
      {isVisible ? (
        <>
          {/* Loading skeleton */}
          {!loaded && !error && (
            <div className="absolute inset-0 img-loading" />
          )}

          {/* Error state */}
          {error && (
            <div className="aspect-[3/4] flex items-center justify-center bg-linen">
              <span className="text-muted text-sm">Failed to load</span>
            </div>
          )}

          {/* Actual image - use img tag for external URLs to avoid Next.js domain restrictions */}
          {!error && (
            <img
              src={src}
              alt={`Image ${index + 1}`}
              className={`w-full h-auto transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
              loading="lazy"
              decoding="async"
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
        <div className="aspect-[3/4] bg-linen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-border border-t-gold rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

export default QuickView;
