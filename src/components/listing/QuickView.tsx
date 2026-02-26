'use client';

import { Suspense, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { QuickViewModal } from './QuickViewModal';
import { QuickViewContent } from './QuickViewContent';
import { QuickViewMobileSheet } from './QuickViewMobileSheet';
import { StudySetsumeiView } from './StudySetsumeiView';
import dynamic from 'next/dynamic';

const AdminEditView = dynamic(
  () => import('./AdminEditView'),
  { ssr: false }
);
const CollectionFormContent = dynamic(
  () => import('@/components/collection/CollectionFormContent').then(mod => mod.CollectionFormContent),
  { ssr: false }
);
import { AlertContextBanner } from './AlertContextBanner';
import { LazyImage } from '@/components/ui/LazyImage';
import { useQuickView } from '@/contexts/QuickViewContext';
import { useActivityTrackerOptional } from '@/lib/tracking/ActivityTracker';
import { usePinchZoomTracking } from '@/lib/viewport';
import { getAllImages, dealerDoesNotPublishImages, getCachedDimensions, getPlaceholderKanji } from '@/lib/images';
import { useValidatedImages } from '@/hooks/useValidatedImages';
import { useAuth } from '@/lib/auth/AuthContext';
import type { ListingWithEnrichment } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';

// Slot components
import {
  BrowseActionBar,
  CollectionActionBar,
  BrowseDealerRow,
  CollectionDealerRow,
  BrowseDescription,
  CollectionNotes,
  CollectionProvenance,
  BrowseAdminTools,
  BrowseCTA,
  CollectionCTA,
  BrowseMobileHeaderActions,
  CollectionMobileHeaderActions,
  BrowseMobileCTA,
  CollectionMobileCTA,
} from './quickview-slots';

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
    refreshCurrentListing,
    source,
    collectionItem,
    collectionMode,
    setCollectionMode,
    onCollectionSaved,
  } = useQuickView();

  const activityTracker = useActivityTrackerOptional();
  const { t } = useLocale();
  const { user, isAdmin } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileScrollContainerRef = useRef<HTMLDivElement>(null);
  const [visibleImages, setVisibleImages] = useState<Set<number>>(new Set([0, 1]));
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [failedImageIndices, setFailedImageIndices] = useState<Set<number>>(new Set());
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [isAdminEditMode, setIsAdminEditMode] = useState(false);

  // Collection edit/add mode (form replaces images in left panel)
  const isCollectionEditMode = source === 'collection' && (collectionMode === 'edit' || collectionMode === 'add');
  const isCollection = source === 'collection';

  // Track when the sheet state last changed for dwell time calculation
  const sheetStateChangeTimeRef = useRef<number>(Date.now());

  // Toggle sheet expanded/collapsed state and track engagement
  const toggleSheet = useCallback(() => {
    const now = Date.now();
    const dwellMs = now - sheetStateChangeTimeRef.current;
    sheetStateChangeTimeRef.current = now;

    const action = isSheetExpanded ? 'collapse' : 'expand';

    if (activityTracker && currentListing) {
      activityTracker.trackQuickViewPanelToggle(
        currentListing.id,
        action,
        dwellMs
      );
    }

    setIsSheetExpanded(prev => !prev);
  }, [isSheetExpanded, activityTracker, currentListing]);

  // Track view via unified pipeline when QuickView opens
  // Skip tracking for collection items — they're personal, not dealer listings
  useEffect(() => {
    if (!currentListing || !isOpen || source === 'collection') return;

    if (activityTracker) {
      activityTracker.trackListingDetailView(currentListing.id, 'browse');
    }
  }, [currentListing?.id, isOpen, activityTracker, source]);

  // Reset scroll and visible images when listing changes
  useEffect(() => {
    if (currentListing) {
      setVisibleImages(new Set([0, 1]));
      setCurrentImageIndex(0);
      setHasScrolled(false);
      setFailedImageIndices(new Set());
      setIsSheetExpanded(false);
      setIsStudyMode(false);
      setIsAdminEditMode(false);
      sheetStateChangeTimeRef.current = Date.now();
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      if (mobileScrollContainerRef.current) {
        mobileScrollContainerRef.current.scrollTop = 0;
        mobileScrollContainerRef.current.style.overscrollBehaviorY = '';
      }
    }
  }, [currentListing?.id]);

  // Track scrolling for hint dismissal
  const handleScroll = useCallback(() => {
    if (!hasScrolled) {
      setHasScrolled(true);
    }
  }, [hasScrolled]);

  // Directional overscroll for mobile image scroller
  useEffect(() => {
    const scroller = mobileScrollContainerRef.current;
    if (!scroller) return;

    const onScroll = () => {
      const value = scroller.scrollTop > 0 ? 'contain' : '';
      if (scroller.style.overscrollBehaviorY !== value) {
        scroller.style.overscrollBehaviorY = value;
      }
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      scroller.style.overscrollBehaviorY = '';
    };
  }, [isStudyMode, isAdminEditMode, isOpen]);

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
    minScaleThreshold: 1.15,
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
      for (let i = Math.max(0, index - 1); i <= index + 2; i++) {
        next.add(i);
      }
      return next;
    });
    setCurrentImageIndex(index);
  }, []);

  // Track images that fail to load
  const handleImageLoadFailed = useCallback((index: number) => {
    setFailedImageIndices(prev => new Set(prev).add(index));
  }, []);

  // Toggle study mode — exits admin edit mode
  const toggleStudyMode = useCallback(() => {
    setIsStudyMode(prev => {
      if (!prev) setIsAdminEditMode(false);
      return !prev;
    });
  }, []);

  // Toggle admin edit mode — exits study mode
  const toggleAdminEditMode = useCallback(() => {
    setIsAdminEditMode(prev => {
      if (!prev) setIsStudyMode(false);
      return !prev;
    });
  }, []);

  // Get and validate images
  const imageFingerprint = currentListing
    ? `${currentListing.id}:${currentListing.images?.length ?? 0}:${currentListing.stored_images?.length ?? 0}`
    : '';
  const rawImages = useMemo(
    () => currentListing ? getAllImages(currentListing) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageFingerprint]
  );
  const { validatedImages: validImages } = useValidatedImages(rawImages);

  const images = useMemo(
    () => validImages.filter((_, i) => !failedImageIndices.has(i)),
    [validImages, failedImageIndices]
  );

  if (!currentListing) return null;

  const showNavigation = listings.length > 1 && currentIndex !== -1;
  const isSold = currentListing.is_sold || currentListing.status === 'sold' || currentListing.status === 'presumed_sold';
  const placeholderKanji = getPlaceholderKanji(currentListing.item_type);

  const hasArtistBlock = !!(
    currentListing.artisan_id &&
    currentListing.artisan_id !== 'UNKNOWN' &&
    currentListing.artisan_confidence && currentListing.artisan_confidence !== 'NONE' &&
    (isAdmin || !currentListing.artisan_id.startsWith('tmp'))
  );
  const mobileBottomPad = hasArtistBlock ? 160 : 116;

  // =========================================================================
  // Assemble slots based on source
  // =========================================================================
  const handleEditCollection = () => setCollectionMode('edit');

  // Desktop QuickViewContent slots
  const desktopActionBarSlot = isCollection
    ? <CollectionActionBar listing={currentListing} collectionItem={collectionItem} onEditCollection={handleEditCollection} />
    : <BrowseActionBar listing={currentListing} isStudyMode={isStudyMode} onToggleStudyMode={toggleStudyMode} onToggleAdminEditMode={toggleAdminEditMode} />;

  const desktopDealerSlot = isCollection
    ? <CollectionDealerRow collectionItem={collectionItem} />
    : <BrowseDealerRow listing={currentListing} />;

  const desktopDescriptionSlot = isCollection
    ? <CollectionNotes collectionItem={collectionItem} />
    : <BrowseDescription listing={currentListing} />;

  const desktopProvenanceSlot = isCollection
    ? <CollectionProvenance collectionItem={collectionItem} />
    : null;

  const desktopAdminToolsSlot = !isCollection && isAdmin
    ? <BrowseAdminTools listing={currentListing} />
    : null;

  const desktopCtaSlot = isCollection
    ? <CollectionCTA collectionItem={collectionItem} onEditCollection={handleEditCollection} />
    : <BrowseCTA listing={currentListing} />;

  // Mobile QuickViewMobileSheet slots
  const mobileHeaderActionsSlot = isCollection
    ? <CollectionMobileHeaderActions listing={currentListing} onEditCollection={handleEditCollection} />
    : <BrowseMobileHeaderActions listing={currentListing} isStudyMode={isStudyMode} onToggleStudyMode={toggleStudyMode} isAdminEditMode={isAdminEditMode} onToggleAdminEditMode={toggleAdminEditMode} />;

  const mobileDealerSlot = isCollection
    ? (collectionItem?.acquired_from ? <CollectionDealerRow collectionItem={collectionItem} /> : null)
    : <BrowseDealerRow listing={currentListing} />;

  const mobileDescriptionSlot = isCollection
    ? <CollectionNotes collectionItem={collectionItem} />
    : <BrowseDescription listing={currentListing} maxLines={12} />;

  const mobileCtaSlot = isCollection
    ? <CollectionMobileCTA onEditCollection={handleEditCollection} />
    : <BrowseMobileCTA listing={currentListing} />;

  // =========================================================================
  // Image rendering helper
  // =========================================================================
  const renderImageList = (keyPrefix: string) => (
    <>
      {images.length === 0 ? (
        dealerDoesNotPublishImages(currentListing.dealers?.domain) ? (
          <div className="aspect-[4/3] bg-linen flex flex-col items-center justify-center text-center">
            <span className="font-serif text-[96px] leading-none text-muted/10 select-none" aria-hidden="true">
              {placeholderKanji}
            </span>
            <span className="text-[10px] text-muted/40 tracking-widest uppercase mt-4">
              Photos not published
            </span>
          </div>
        ) : (
          <div className="aspect-[4/3] bg-linen flex flex-col items-center justify-center">
            <span className="font-serif text-[96px] leading-none text-muted/10 select-none" aria-hidden="true">
              {placeholderKanji}
            </span>
            <span className="text-[10px] text-muted/40 tracking-widest uppercase mt-4">
              No photos available
            </span>
          </div>
        )
      ) : (
        images.map((src, index) => (
          <LazyImage
            key={`${keyPrefix}-${src}-${index}`}
            src={src}
            index={index}
            totalImages={images.length}
            isVisible={visibleImages.has(index)}
            onVisible={handleImageVisible}
            onLoadFailed={handleImageLoadFailed}
            isFirst={index === 0}
            showScrollHint={index === 0 && images.length > 1 && !hasScrolled}
            title={currentListing.title}
            itemType={currentListing.item_type}
            certType={currentListing.cert_type}
            cachedDimensions={getCachedDimensions(src)}
          />
        ))
      )}
    </>
  );

  return (
    <Suspense fallback={null}>
      <QuickViewModal
        isOpen={isOpen}
        onClose={closeQuickView}
      >
        {/* Mobile layout (show below lg, hide on lg+) */}
        <div className="lg:hidden h-full flex flex-col" data-testid="quickview-mobile-layout">
          <AlertContextBanner />
          {isCollectionEditMode ? (
            <div className="flex-1 min-h-0 overflow-y-auto bg-cream">
              <CollectionFormContent
                mode={collectionMode!}
                item={collectionMode === 'edit' ? collectionItem : null}
                prefillData={collectionMode === 'add' ? collectionItem as any : null}
                onSaved={() => { onCollectionSaved?.(); closeQuickView(); }}
                onCancel={() => {
                  if (collectionMode === 'add') closeQuickView();
                  else setCollectionMode('view');
                }}
              />
            </div>
          ) : isAdminEditMode ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <AdminEditView
                listing={currentListing}
                onBackToPhotos={toggleAdminEditMode}
                onRefresh={(fields) => refreshCurrentListing(fields)}
              />
            </div>
          ) : isStudyMode ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <StudySetsumeiView
                listing={currentListing as ListingWithEnrichment}
                onBackToPhotos={toggleStudyMode}
              />
            </div>
          ) : (
            <div
              ref={setMobileScrollerRef}
              data-testid="mobile-image-scroller"
              onScroll={handleScroll}
              onClick={toggleSheet}
              className="flex-1 min-h-0 overflow-y-auto overscroll-none bg-ink/5 relative"
            >
              {isSold && (
                <div className="sticky top-0 z-20 bg-ink/80 text-white text-center py-2 text-sm font-medium tracking-wider uppercase">
                  Sold
                </div>
              )}

              <div className="space-y-1 p-1">
                {renderImageList('mobile')}
              </div>

              {images.length > 1 && (
                <div className="text-center py-4 text-[11px] text-muted flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {images.length} images
                </div>
              )}

              <div style={{ height: mobileBottomPad }} aria-hidden="true" />
            </div>
          )}

          {/* Bottom sheet overlay */}
          <QuickViewMobileSheet
            listing={currentListing}
            isExpanded={isSheetExpanded}
            onToggle={toggleSheet}
            onClose={closeQuickView}
            headerActionsSlot={mobileHeaderActionsSlot}
            dealerSlot={mobileDealerSlot}
            descriptionSlot={mobileDescriptionSlot}
            ctaSlot={mobileCtaSlot}
          />
        </div>

        {/* Desktop layout (hide below lg, show on lg+) */}
        <div className="hidden lg:flex flex-row h-full min-h-0 overflow-hidden" data-testid="quickview-desktop-layout">
          {isCollectionEditMode ? (
            <div className="flex-1 min-h-0 w-3/5 overflow-y-auto bg-cream">
              <CollectionFormContent
                mode={collectionMode!}
                item={collectionMode === 'edit' ? collectionItem : null}
                prefillData={collectionMode === 'add' ? collectionItem as any : null}
                onSaved={() => { onCollectionSaved?.(); closeQuickView(); }}
                onCancel={() => {
                  if (collectionMode === 'add') closeQuickView();
                  else setCollectionMode('view');
                }}
              />
            </div>
          ) : isAdminEditMode ? (
            <div className="flex-1 min-h-0 w-3/5 overflow-y-auto bg-cream">
              <AdminEditView
                listing={currentListing}
                onBackToPhotos={toggleAdminEditMode}
                onRefresh={(fields) => refreshCurrentListing(fields)}
              />
            </div>
          ) : isStudyMode ? (
            <div className="flex-1 min-h-0 w-3/5 overflow-hidden">
              <StudySetsumeiView
                listing={currentListing as ListingWithEnrichment}
                onBackToPhotos={toggleStudyMode}
              />
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              data-testid="desktop-image-scroller"
              onScroll={handleScroll}
              className="flex-1 min-h-0 w-3/5 overflow-y-auto overscroll-contain bg-ink/5 relative"
            >
              {isSold && (
                <div className="sticky top-0 z-20 bg-ink/80 text-white text-center py-2 text-sm font-medium tracking-wider uppercase">
                  Sold
                </div>
              )}

              <div className="space-y-1 p-2">
                {renderImageList('desktop')}
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
          )}

          {/* Content Section */}
          <div data-testid="desktop-content-panel" className="w-2/5 max-w-md border-l border-border bg-cream flex flex-col min-h-0 overflow-hidden">
            <AlertContextBanner />
            {!isStudyMode && images.length > 1 && (
              <div className="border-b border-border">
                <div className="h-0.5 bg-border">
                  <div
                    className="h-full bg-gold transition-all duration-300 ease-out"
                    style={{ width: `${((currentImageIndex + 1) / images.length) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-center py-1.5">
                  <span className="text-[11px] text-muted tabular-nums">
                    {t('quickview.photoCounter', { current: currentImageIndex + 1, total: images.length })}
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto">
              <QuickViewContent
                listing={currentListing}
                onClose={closeQuickView}
                actionBarSlot={desktopActionBarSlot}
                dealerSlot={desktopDealerSlot}
                descriptionSlot={desktopDescriptionSlot}
                provenanceSlot={desktopProvenanceSlot}
                adminToolsSlot={desktopAdminToolsSlot}
                ctaSlot={desktopCtaSlot}
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
            </>
          )}
        </div>
      </QuickViewModal>
    </Suspense>
  );
}

export default QuickView;
