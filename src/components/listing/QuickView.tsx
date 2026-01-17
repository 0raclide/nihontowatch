'use client';

import { Suspense, useRef, useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { QuickViewModal } from './QuickViewModal';
import { QuickViewContent } from './QuickViewContent';
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
  const [visibleImages, setVisibleImages] = useState<Set<number>>(new Set([0, 1]));
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Reset scroll and visible images when listing changes
  useEffect(() => {
    if (currentListing) {
      setVisibleImages(new Set([0, 1]));
      setCurrentImageIndex(0);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [currentListing?.id]);

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
        listingId={currentListing.id}
      >
        <div className="flex flex-col lg:flex-row h-full overflow-hidden">
          {/* Image Section - Scrollable vertical list */}
          <div
            ref={scrollContainerRef}
            className="flex-1 lg:w-3/5 overflow-y-auto overscroll-contain bg-ink/5"
          >
            {/* Sold overlay */}
            {isSold && (
              <div className="sticky top-0 z-10 bg-ink/80 text-white text-center py-2 text-sm font-medium tracking-wider uppercase">
                Sold
              </div>
            )}

            {/* Image counter - sticky on mobile */}
            {images.length > 1 && (
              <div className="sticky top-0 z-10 flex justify-center py-2 bg-gradient-to-b from-ink/60 to-transparent lg:hidden">
                <span className="text-[12px] text-white font-medium tabular-nums px-3 py-1 rounded-full bg-ink/40 backdrop-blur-sm">
                  {currentImageIndex + 1} / {images.length}
                </span>
              </div>
            )}

            {/* Vertical image list */}
            <div className="space-y-1 p-1 lg:p-2">
              {images.length === 0 ? (
                <div className="aspect-[4/3] bg-linen flex items-center justify-center">
                  <svg className="w-16 h-16 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              ) : (
                images.map((src, index) => (
                  <LazyImage
                    key={`${src}-${index}`}
                    src={src}
                    index={index}
                    isVisible={visibleImages.has(index)}
                    onVisible={handleImageVisible}
                  />
                ))
              )}
            </div>

            {/* End marker */}
            {images.length > 1 && (
              <div className="text-center py-4 text-[11px] text-muted">
                {images.length} images
              </div>
            )}
          </div>

          {/* Content Section - Fixed on desktop, scrolls on mobile */}
          <div className="lg:w-2/5 lg:max-w-md lg:border-l lg:border-border bg-cream flex flex-col overflow-hidden">
            {/* Desktop image counter */}
            {images.length > 1 && (
              <div className="hidden lg:flex justify-center py-2 border-b border-border">
                <span className="text-[11px] text-muted tabular-nums">
                  Image {currentImageIndex + 1} of {images.length}
                </span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
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
                className={`hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-cream/95 border border-border shadow-lg transition-all duration-200 ${
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
                className={`hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-cream/95 border border-border shadow-lg transition-all duration-200 ${
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
              <div className="hidden lg:flex absolute bottom-3 left-2 z-20 px-2 py-1 rounded bg-ink/60 backdrop-blur-sm">
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
  isVisible,
  onVisible
}: {
  src: string;
  index: number;
  isVisible: boolean;
  onVisible: (index: number) => void;
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
