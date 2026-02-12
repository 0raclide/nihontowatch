'use client';

import { Suspense, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { QuickViewModal } from '@/components/listing/QuickViewModal';
import { CollectionItemContent } from './CollectionItemContent';
import { CollectionMobileSheet } from './CollectionMobileSheet';
import { CollectionFormContent } from './CollectionFormContent';
import { useCollectionQuickView } from '@/contexts/CollectionQuickViewContext';
import { getPlaceholderKanji } from '@/lib/images';

// Blur placeholder for lazy images (same as browse QuickView)
const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNGYwIi8+PC9zdmc+';

// =============================================================================
// LazyImage — copied from browse QuickView, simplified for collection
// =============================================================================

function LazyImage({
  src,
  index,
  totalImages,
  isVisible,
  onVisible,
  isFirst,
  showScrollHint,
  itemTitle,
  itemType,
}: {
  src: string;
  index: number;
  totalImages: number;
  isVisible: boolean;
  onVisible: (index: number) => void;
  isFirst: boolean;
  showScrollHint: boolean;
  itemTitle?: string;
  itemType?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [useUnoptimized, setUseUnoptimized] = useState(false);

  // Reset state when src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
    setRetryCount(0);
    setUseUnoptimized(false);
  }, [src]);

  // Mobile Safari onLoad fix
  useEffect(() => {
    if (!isVisible || loaded || error) return;

    const checkComplete = () => {
      const container = ref.current;
      if (!container) return false;
      const img = container.querySelector('img');
      if (img && img.complete && img.naturalWidth > 0) {
        setLoaded(true);
        return true;
      }
      return false;
    };

    const immediateCheck = requestAnimationFrame(() => { checkComplete(); });

    let fallbackTimeout: ReturnType<typeof setTimeout> | undefined;
    if (isFirst) {
      fallbackTimeout = setTimeout(() => {
        if (!loaded && !error) {
          if (checkComplete()) return;
          setLoaded(true);
        }
      }, 3000);
    }

    return () => {
      cancelAnimationFrame(immediateCheck);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
    };
  }, [isVisible, loaded, error, isFirst]);

  // IntersectionObserver for lazy loading
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) onVisible(index);
        });
      },
      { rootMargin: '200px 0px', threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [index, onVisible]);

  const handleError = () => {
    if (retryCount === 0) {
      setRetryCount(1);
      setUseUnoptimized(true);
      setLoaded(false);
    } else {
      setError(true);
    }
  };

  return (
    <div ref={ref} className="relative bg-linen rounded overflow-hidden min-h-[200px]">
      {isVisible ? (
        <>
          {!loaded && !error && (
            <div className="absolute inset-0 img-loading min-h-[200px]" />
          )}
          {error && (
            <div className="aspect-[3/4] flex items-center justify-center bg-linen">
              <span className="text-muted text-sm">Failed to load</span>
            </div>
          )}
          {!error && (
            <Image
              key={`${src}-${retryCount}`}
              src={src}
              alt={[itemType, itemTitle, `Photo ${index + 1} of ${totalImages}`].filter(Boolean).join(' - ')}
              width={800}
              height={600}
              className={`w-full h-auto transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              style={{ width: '100%', height: 'auto' }}
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

          {/* Image position indicator */}
          {loaded && totalImages > 1 && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink/70 backdrop-blur-sm">
              <span className="text-[11px] text-white/90 font-medium tabular-nums">{index + 1}</span>
              <span className="text-[11px] text-white/50">/</span>
              <span className="text-[11px] text-white/50 tabular-nums">{totalImages}</span>
            </div>
          )}

          {/* Scroll hint on first image */}
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
        <div className="bg-linen flex items-center justify-center" style={{ aspectRatio: '3 / 4' }}>
          <div className="w-8 h-8 border-2 border-border border-t-gold rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// CollectionQuickView — mirrors browse QuickView layout
// =============================================================================

export function CollectionQuickView() {
  const {
    isOpen,
    mode,
    currentItem,
    prefillData,
    items,
    currentIndex,
    closeQuickView,
    goToNext,
    goToPrevious,
    hasNext,
    hasPrevious,
    onSaved,
  } = useCollectionQuickView();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileScrollContainerRef = useRef<HTMLDivElement>(null);
  const [visibleImages, setVisibleImages] = useState<Set<number>>(new Set([0, 1]));
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);

  // Reset scroll and visible images when item changes
  useEffect(() => {
    if (currentItem) {
      setVisibleImages(new Set([0, 1]));
      setCurrentImageIndex(0);
      setHasScrolled(false);
      setIsSheetExpanded(true);
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
      if (mobileScrollContainerRef.current) mobileScrollContainerRef.current.scrollTop = 0;
    }
  }, [currentItem?.id]);

  const handleScroll = useCallback(() => {
    if (!hasScrolled) setHasScrolled(true);
  }, [hasScrolled]);

  const handleImageVisible = useCallback((index: number) => {
    setVisibleImages(prev => {
      const next = new Set(prev);
      for (let i = Math.max(0, index - 1); i <= index + 2; i++) next.add(i);
      return next;
    });
    setCurrentImageIndex(index);
  }, []);

  const toggleSheet = useCallback(() => {
    setIsSheetExpanded(prev => !prev);
  }, []);

  const images = useMemo(() => currentItem?.images || [], [currentItem?.id, currentItem?.images]);
  const isFormMode = mode === 'add' || mode === 'edit';

  if (!currentItem && !isFormMode) return null;

  const showNavigation = mode === 'view' && items.length > 1 && currentIndex !== -1;
  const placeholderKanji = getPlaceholderKanji(currentItem?.item_type || null);

  // Render empty-image placeholder
  const renderNoImages = () => (
    <div className="aspect-[4/3] bg-linen flex flex-col items-center justify-center">
      <span className="font-serif text-[96px] leading-none text-muted/10 select-none" aria-hidden="true">
        {placeholderKanji}
      </span>
      <span className="text-[10px] text-muted/40 tracking-widest uppercase mt-4">
        No photos yet
      </span>
    </div>
  );

  // Render image list
  const renderImages = (keyPrefix: string) =>
    images.map((src, index) => (
      <LazyImage
        key={`${keyPrefix}-${src}-${index}`}
        src={src}
        index={index}
        totalImages={images.length}
        isVisible={visibleImages.has(index)}
        onVisible={handleImageVisible}
        isFirst={index === 0}
        showScrollHint={index === 0 && images.length > 1 && !hasScrolled}
        itemTitle={currentItem?.title || undefined}
        itemType={currentItem?.item_type}
      />
    ));

  return (
    <Suspense fallback={null}>
      <QuickViewModal isOpen={isOpen} onClose={closeQuickView}>
        {/* ====== FORM MODE: Full-width single column ====== */}
        {isFormMode ? (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Form header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-cream shrink-0">
              <span className="text-[11px] uppercase tracking-[0.1em] font-medium text-muted">
                {mode === 'add' ? 'Add to Collection' : 'Edit Item'}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CollectionFormContent
                mode={mode as 'add' | 'edit'}
                item={currentItem}
                prefillData={prefillData}
                onSaved={() => { onSaved(); closeQuickView(); }}
                onCancel={closeQuickView}
              />
            </div>
          </div>
        ) : currentItem ? (
          <>
            {/* ====== MOBILE layout (below lg) ====== */}
            <div className="lg:hidden h-full flex flex-col" data-testid="collection-quickview-mobile">
              {/* Full-screen image scroller */}
              <div
                ref={mobileScrollContainerRef}
                onScroll={handleScroll}
                onClick={toggleSheet}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-ink/5 relative"
              >
                {/* Status overlay for sold items */}
                {currentItem.status !== 'owned' && (
                  <div className="sticky top-0 z-20 bg-ink/80 text-white text-center py-2 text-sm font-medium tracking-wider uppercase">
                    {currentItem.status === 'sold' ? 'Sold' : currentItem.status === 'lent' ? 'Lent' : 'Consignment'}
                  </div>
                )}

                <div className="space-y-1 p-1">
                  {images.length === 0 ? renderNoImages() : renderImages('mobile')}
                </div>

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
              <CollectionMobileSheet
                item={currentItem}
                isExpanded={isSheetExpanded}
                onToggle={toggleSheet}
                onClose={closeQuickView}
                imageCount={images.length}
                currentImageIndex={currentImageIndex}
              />
            </div>

            {/* ====== DESKTOP layout (lg+) ====== */}
            <div className="hidden lg:flex flex-row h-full min-h-0 overflow-hidden" data-testid="collection-quickview-desktop">
              {/* Image Section — 3/5 width, scrollable vertical list */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 w-3/5 overflow-y-auto overscroll-contain bg-ink/5 relative"
              >
                {/* Status overlay */}
                {currentItem.status !== 'owned' && (
                  <div className="sticky top-0 z-20 bg-ink/80 text-white text-center py-2 text-sm font-medium tracking-wider uppercase">
                    {currentItem.status === 'sold' ? 'Sold' : currentItem.status === 'lent' ? 'Lent' : 'Consignment'}
                  </div>
                )}

                <div className="space-y-1 p-2">
                  {images.length === 0 ? renderNoImages() : renderImages('desktop')}
                </div>

                {images.length > 1 && (
                  <div className="text-center py-4 text-[11px] text-muted flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {images.length} images
                  </div>
                )}
              </div>

              {/* Content Section — 2/5 width, fixed */}
              <div className="w-2/5 max-w-md border-l border-border bg-cream flex flex-col min-h-0 overflow-hidden">
                {/* Image progress bar */}
                {images.length > 1 && (
                  <div className="border-b border-border">
                    <div className="h-0.5 bg-border">
                      <div
                        className="h-full bg-gold transition-all duration-300 ease-out"
                        style={{ width: `${((currentImageIndex + 1) / images.length) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-center py-1.5">
                      <span className="text-[11px] text-muted tabular-nums">
                        Photo {currentImageIndex + 1} of {images.length}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-hidden">
                  <CollectionItemContent item={currentItem} />
                </div>
              </div>

              {/* Navigation arrows (Desktop only) */}
              {showNavigation && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                    disabled={!hasPrevious}
                    className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-cream/95 border border-border shadow-lg transition-all duration-200 ${
                      hasPrevious ? 'hover:bg-cream hover:border-gold hover:scale-105' : 'opacity-40 cursor-not-allowed'
                    }`}
                    aria-label="Previous item (K)"
                  >
                    <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); goToNext(); }}
                    disabled={!hasNext}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-cream/95 border border-border shadow-lg transition-all duration-200 ${
                      hasNext ? 'hover:bg-cream hover:border-gold hover:scale-105' : 'opacity-40 cursor-not-allowed'
                    }`}
                    aria-label="Next item (J)"
                  >
                    <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </>
        ) : null}
      </QuickViewModal>
    </Suspense>
  );
}
