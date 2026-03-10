'use client';

import { Suspense, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { QuickViewModal } from './QuickViewModal';
import { QuickViewContent } from './QuickViewContent';
import { QuickViewMobileSheet } from './QuickViewMobileSheet';
import { StudySetsumeiView } from './StudySetsumeiView';
import dynamic from 'next/dynamic';

const AdminEditView = dynamic(
  () => import('./AdminEditView'),
  { ssr: false }
);
import { AlertContextBanner } from './AlertContextBanner';
import { LazyImage } from '@/components/ui/LazyImage';
import { useQuickView } from '@/contexts/QuickViewContext';
import { useActivityTrackerOptional } from '@/lib/tracking/ActivityTracker';
import { usePinchZoomTracking } from '@/lib/viewport';
import { getAllImages, dealerDoesNotPublishImages, getCachedDimensions, getPlaceholderKanji } from '@/lib/images';
import { getHeroImage } from '@/lib/images/classification';
import { getMediaItems } from '@/lib/media';
import { collectGroupedMedia } from '@/lib/media/groupedMedia';
import { buildContentStream } from '@/lib/media/contentStream';
import { MediaGroupDivider } from './MediaGroupDivider';
import { VideoGalleryItem } from '@/components/video/VideoGalleryItem';
import { ContentStreamRenderer } from './ContentStreamRenderer';
import { StatsCard } from './StatsCard';
import { QUICKVIEW_LAYOUT } from './quickviewLayout';
import { LightboxProvider } from '@/contexts/LightboxContext';
import { useValidatedImages } from '@/hooks/useValidatedImages';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { useAuth } from '@/lib/auth/AuthContext';
import type { ListingWithEnrichment, Currency } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';

// Slot components
import {
  BrowseActionBar,
  CollectionActionBar,
  DealerActionBar,
  ShowcaseActionBar,
  BrowseDealerRow,
  CollectionDealerRow,
  ShowcaseOwnerRow,
  BrowseDescription,
  CollectionNotes,
  CollectionProvenance,
  BrowseAdminTools,
  BrowseCTA,
  CollectionCTA,
  DealerCTA,
  BrowseMobileHeaderActions,
  CollectionMobileHeaderActions,
  DealerMobileHeaderActions,
  ShowcaseMobileHeaderActions,
  BrowseMobileCTA,
  CollectionMobileCTA,
  DealerMobileCTA,
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
    detailLoaded,
  } = useQuickView();

  const activityTracker = useActivityTrackerOptional();
  const { t } = useLocale();
  const { user, isAdmin } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileScrollContainerRef = useRef<HTMLDivElement>(null);
  const [visibleImages, setVisibleImages] = useState<Set<number>>(new Set([0, 1]));
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [isAdminEditMode, setIsAdminEditMode] = useState(false);

  const isCollection = source === 'collection';
  const isDealer = source === 'dealer';
  const isShowcase = source === 'showcase';
  const useContentStream = isDealer || isCollection || isShowcase;

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
    if (!currentListing || !isOpen || source === 'collection' || source === 'showcase') return;

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
      setFailedImageUrls(new Set());
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

  // Track images that fail to load (by URL — stable across hero reordering and group membership)
  const handleImageLoadFailed = useCallback((_index: number, url: string) => {
    setFailedImageUrls(prev => new Set(prev).add(url));
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
    () => validImages.filter(url => !failedImageUrls.has(url)),
    [validImages, failedImageUrls]
  );

  // Reorder images so the hero (cover) image appears first in the scroller
  const displayImages = useMemo(() => {
    if (!currentListing || images.length <= 1) return images;
    const heroUrl = getHeroImage(currentListing);
    if (!heroUrl) return images;
    const pos = images.indexOf(heroUrl);
    if (pos <= 0) return images; // Already first or not found
    return [images[pos], ...images.slice(0, pos), ...images.slice(pos + 1)];
  }, [images, currentListing]);

  // Video media items (ready videos only)
  const videoItems = useMemo(
    () => currentListing ? getMediaItems(currentListing).filter(m => m.type === 'video') : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentListing?.id, currentListing?.videos?.length]
  );

  // Map MediaItem[] → VideoMediaItem[] for collectGroupedMedia
  const videoMediaItems = useMemo(
    () => videoItems.map(m => ({
      streamUrl: m.url,
      thumbnailUrl: m.thumbnailUrl,
      duration: m.duration,
      status: m.status,
      videoId: m.videoId,
    })),
    [videoItems]
  );

  // Grouped media — dealer/collection: sections (koshirae, sayagaki, etc.); browse: flat list
  const groupedMedia = useMemo(
    () => collectGroupedMedia(displayImages, currentListing, detailLoaded, videoMediaItems, useContentStream),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayImages, currentListing?.id, detailLoaded, videoMediaItems, useContentStream,
     currentListing?.sayagaki, currentListing?.hakogaki, currentListing?.koshirae,
     currentListing?.provenance, currentListing?.kanto_hibisho]
  );

  // Total media count for progress bar and counters
  const totalMediaCount = groupedMedia.totalCount;

  // Deferred progress denominator: only expands when user scrolls past current boundary.
  // Prevents the progress bar from jumping when section images load mid-scroll.
  const progressTotalRef = useRef(totalMediaCount);
  // Reset when listing changes (totalMediaCount drops to new listing's count)
  if (totalMediaCount < progressTotalRef.current) {
    progressTotalRef.current = totalMediaCount;
  }
  // Expand when user has scrolled past the current boundary
  if (currentImageIndex >= progressTotalRef.current && totalMediaCount > progressTotalRef.current) {
    progressTotalRef.current = totalMediaCount;
  }
  const progressTotal = progressTotalRef.current;

  // Content stream for dealer/collection QuickView — replaces grouped media scroller
  // MUST be before the early return — hooks cannot be conditional
  const contentStreamResult = useMemo(
    () => useContentStream && currentListing
      ? buildContentStream(displayImages, currentListing, true, videoMediaItems)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [useContentStream, displayImages, currentListing?.id, videoMediaItems,
     currentListing?.sayagaki, currentListing?.hakogaki, currentListing?.koshirae,
     currentListing?.provenance, currentListing?.kiwame, currentListing?.kanto_hibisho,
     currentListing?.ai_curator_note_en, currentListing?.ai_curator_note_ja,
     currentListing?.setsumei_text_en, currentListing?.setsumei_text_ja]
  );

  // Content stream total for progress bar (dealer) vs grouped media total (browse/collection)
  const streamImageCount = contentStreamResult?.imageCount ?? 0;

  // Scroll-spy for section indicator highlighting (dealer content stream)
  // MUST be before early return — hooks cannot be conditional
  const sectionIds = useMemo(
    () => contentStreamResult?.sections?.map(s => s.id) ?? [],
    [contentStreamResult?.sections]
  );
  const desktopActiveSection = useScrollSpy(sectionIds, scrollContainerRef);
  const mobileActiveSection = useScrollSpy(sectionIds, mobileScrollContainerRef);

  // Scroll-to-section handler for section indicator taps
  const scrollToSection = useCallback((sectionId: string) => {
    // Both mobile and desktop layouts render ContentStreamRenderer, creating
    // duplicate DOM IDs. Scope the querySelector to the visible container
    // so we find the target in the correct layout.
    const desktop = scrollContainerRef.current;
    const mobile = mobileScrollContainerRef.current;
    const container = (desktop && desktop.clientHeight > 0) ? desktop : mobile;
    const target = container?.querySelector<HTMLElement>(`#${sectionId}`);
    if (container && target) {
      const offset = target.getBoundingClientRect().top
        - container.getBoundingClientRect().top
        + container.scrollTop;
      container.scrollTo({ top: offset - 8, behavior: 'smooth' });
    }
  }, []);

  const handleSectionClick = useCallback((sectionId: string) => {
    // Mobile: collapse sheet first, then scroll after animation
    if (isSheetExpanded) {
      setIsSheetExpanded(false);
      setTimeout(() => scrollToSection(sectionId), 350);
      return;
    }
    scrollToSection(sectionId);
  }, [isSheetExpanded, scrollToSection]);

  // Dealer status change → optimistic update via refreshCurrentListing
  // MUST be before the early return — hooks cannot be conditional
  const handleDealerStatusChange = useCallback((newStatus: string, patchedFields?: { price_value?: number | null; price_currency?: string }) => {
    const optimistic: Partial<ListingWithEnrichment> = {
      status: newStatus as ListingWithEnrichment['status'],
      is_available: newStatus === 'AVAILABLE',
      is_sold: newStatus === 'SOLD',
    };
    if (patchedFields) {
      if (patchedFields.price_value !== undefined) {
        optimistic.price_value = patchedFields.price_value ?? undefined;
      }
      if (patchedFields.price_currency !== undefined) {
        optimistic.price_currency = patchedFields.price_currency as Currency;
      }
    }
    refreshCurrentListing(optimistic);

    // Notify DealerPageClient to remove the listing from the current tab grid
    if (currentListing) {
      window.dispatchEvent(new CustomEvent('dealer-listing-status-changed', {
        detail: { listingId: currentListing.id, newStatus },
      }));
    }
  }, [refreshCurrentListing, currentListing]);

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
  const handleEditCollection = () => {
    if (collectionItem?.id) {
      window.location.href = `/vault/edit/${collectionItem.id}`;
    }
  };

  // Showcase extension data (for showcase source)
  const showcaseExt = (currentListing as any)?.showcase ?? null;

  // Desktop QuickViewContent slots (4-way: dealer > showcase > collection > browse)
  const desktopActionBarSlot = isDealer
    ? <DealerActionBar listing={currentListing} onStatusChange={handleDealerStatusChange} />
    : isShowcase
      ? <ShowcaseActionBar listing={currentListing} showcase={showcaseExt} />
      : isCollection
        ? <CollectionActionBar onEditCollection={handleEditCollection} />
        : <BrowseActionBar listing={currentListing} isStudyMode={isStudyMode} onToggleStudyMode={toggleStudyMode} onToggleAdminEditMode={toggleAdminEditMode} />;

  const desktopDealerSlot = isShowcase
    ? <ShowcaseOwnerRow showcase={showcaseExt} />
    : isCollection
      ? <CollectionDealerRow collectionItem={collectionItem} />
      : <BrowseDealerRow listing={currentListing} />;

  const desktopDescriptionSlot = isCollection
    ? <CollectionNotes collectionItem={collectionItem} />
    : <BrowseDescription listing={currentListing} />;

  const desktopProvenanceSlot = isCollection
    ? <CollectionProvenance collectionItem={collectionItem} />
    : null;

  const desktopAdminToolsSlot = !isCollection && !isDealer && !isShowcase && isAdmin
    ? <BrowseAdminTools listing={currentListing} />
    : null;

  const desktopCtaSlot = isDealer
    ? <DealerCTA listing={currentListing} onStatusChange={handleDealerStatusChange} />
    : isShowcase
      ? null
      : isCollection
        ? <CollectionCTA collectionItem={collectionItem} onEditCollection={handleEditCollection} />
        : <BrowseCTA listing={currentListing} />;

  // Mobile QuickViewMobileSheet slots (4-way: dealer > showcase > collection > browse)
  const mobileHeaderActionsSlot = isDealer
    ? <DealerMobileHeaderActions listing={currentListing} onStatusChange={handleDealerStatusChange} />
    : isShowcase
      ? <ShowcaseMobileHeaderActions listing={currentListing} showcase={showcaseExt} />
      : isCollection
        ? <CollectionMobileHeaderActions onEditCollection={handleEditCollection} />
        : <BrowseMobileHeaderActions listing={currentListing} isStudyMode={isStudyMode} onToggleStudyMode={toggleStudyMode} isAdminEditMode={isAdminEditMode} onToggleAdminEditMode={toggleAdminEditMode} />;

  const mobileDealerSlot = isShowcase
    ? <ShowcaseOwnerRow showcase={showcaseExt} />
    : isCollection
      ? <CollectionDealerRow collectionItem={collectionItem} />
      : <BrowseDealerRow listing={currentListing} />;

  const mobileDescriptionSlot = isCollection
    ? <CollectionNotes collectionItem={collectionItem} />
    : <BrowseDescription listing={currentListing} maxLines={12} />;

  const mobileCtaSlot = isDealer
    ? <DealerMobileCTA listing={currentListing} onStatusChange={handleDealerStatusChange} />
    : isShowcase
      ? null
      : isCollection
        ? <CollectionMobileCTA collectionItem={collectionItem} onEditCollection={handleEditCollection} />
        : <BrowseMobileCTA listing={currentListing} />;

  // =========================================================================
  // Image rendering helper
  // =========================================================================
  const renderImageList = (keyPrefix: string) => {
    // Empty state — no primary photos at all
    if (displayImages.length === 0) {
      return dealerDoesNotPublishImages(currentListing.dealers?.domain) ? (
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
      );
    }

    // Flat render: pre-computed items with group boundaries (no mutable counter in JSX)
    const { flatItems } = groupedMedia;

    return (
      <>
        {flatItems.map((item) => (
          <div key={`${keyPrefix}-${item.type === 'video' ? `video-${item.videoId}` : item.src}-${item.globalIndex}`}>
            {/* Divider between groups (not before the first) */}
            {item.isFirstInGroup && !item.isFirstGroup && (
              <MediaGroupDivider label={t(item.groupLabelKey)} />
            )}
            {item.type === 'video' ? (
              <VideoGalleryItem
                streamUrl={item.streamUrl || ''}
                thumbnailUrl={item.thumbnailUrl}
                duration={item.duration}
                status={item.videoStatus}
                className="aspect-video"
              />
            ) : (
              <LazyImage
                src={item.src}
                index={item.globalIndex}
                totalImages={totalMediaCount}
                isVisible={visibleImages.has(item.globalIndex)}
                onVisible={handleImageVisible}
                onLoadFailed={handleImageLoadFailed}
                isFirst={item.globalIndex === 0}
                showScrollHint={item.globalIndex === 0 && totalMediaCount > 1 && !hasScrolled}
                title={currentListing.title}
                itemType={currentListing.item_type}
                certType={currentListing.cert_type}
                cachedDimensions={getCachedDimensions(item.src)}
              />
            )}
          </div>
        ))}
      </>
    );
  };

  return (
    <ErrorBoundary>
    <Suspense fallback={null}>
      <QuickViewModal
        isOpen={isOpen}
        onClose={closeQuickView}
        source={source}
      >
        {/* Mobile layout (show below lg, hide on lg+) */}
        <div className="lg:hidden h-full flex flex-col" data-testid="quickview-mobile-layout">
          <AlertContextBanner />
          {isAdminEditMode ? (
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
          ) : useContentStream && contentStreamResult ? (
            <div
              ref={setMobileScrollerRef}
              data-testid="mobile-image-scroller"
              onScroll={handleScroll}
              className="flex-1 min-h-0 overflow-y-auto overscroll-none bg-ink/5 relative"
            >
              {isSold && (
                <div className="sticky top-0 z-20 bg-ink/80 text-white text-center py-2 text-sm font-medium tracking-wider uppercase">
                  Sold
                </div>
              )}

              <div className="space-y-1 p-1">
                <LightboxProvider allImageUrls={contentStreamResult.allImageUrls}>
                  <ContentStreamRenderer
                    blocks={contentStreamResult.blocks}
                    listing={currentListing}
                    onImageVisible={handleImageVisible}
                    onImageLoadFailed={handleImageLoadFailed}
                    visibleImages={visibleImages}
                    hasScrolled={hasScrolled}
                    failedImageUrls={failedImageUrls}
                    totalMediaCount={streamImageCount}
                  />
                </LightboxProvider>
              </div>

              <div style={{ height: mobileBottomPad }} aria-hidden="true" />
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

              {totalMediaCount > 1 && (
                <div className="text-center py-4 text-[11px] text-muted flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {totalMediaCount} items
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
            readable={isCollection || isShowcase}
            collectionItem={isCollection ? collectionItem : undefined}
            headerActionsSlot={mobileHeaderActionsSlot}
            dealerSlot={mobileDealerSlot}
            descriptionSlot={mobileDescriptionSlot}
            ctaSlot={mobileCtaSlot}
            variant={useContentStream ? 'stats' : 'full'}
            sections={contentStreamResult?.sections}
            onSectionClick={handleSectionClick}
            activeSection={mobileActiveSection}
          />
        </div>

        {/* Desktop layout (hide below lg, show on lg+) */}
        <div className="hidden lg:flex flex-row h-full min-h-0 overflow-hidden" data-testid="quickview-desktop-layout">
          {isAdminEditMode ? (
            <div className={`flex-1 min-h-0 ${QUICKVIEW_LAYOUT.leftPanel.default} overflow-y-auto bg-cream`}>
              <AdminEditView
                listing={currentListing}
                onBackToPhotos={toggleAdminEditMode}
                onRefresh={(fields) => refreshCurrentListing(fields)}
              />
            </div>
          ) : isStudyMode ? (
            <div className={`flex-1 min-h-0 ${QUICKVIEW_LAYOUT.leftPanel.default} overflow-hidden`}>
              <StudySetsumeiView
                listing={currentListing as ListingWithEnrichment}
                onBackToPhotos={toggleStudyMode}
              />
            </div>
          ) : useContentStream && contentStreamResult ? (
            /* Content stream — interleaved media + text in left panel (dealer + collection) */
            <div
              ref={scrollContainerRef}
              data-testid="desktop-image-scroller"
              onScroll={handleScroll}
              className={`flex-1 min-h-0 ${QUICKVIEW_LAYOUT.leftPanel.dealer} overflow-y-auto overscroll-contain bg-ink/5 relative`}
            >
              {isSold && (
                <div className="sticky top-0 z-20 bg-ink/80 text-white text-center py-2 text-sm font-medium tracking-wider uppercase">
                  Sold
                </div>
              )}

              <div className="space-y-1 p-2">
                <LightboxProvider allImageUrls={contentStreamResult.allImageUrls}>
                  <ContentStreamRenderer
                    blocks={contentStreamResult.blocks}
                    listing={currentListing}
                    onImageVisible={handleImageVisible}
                    onImageLoadFailed={handleImageLoadFailed}
                    visibleImages={visibleImages}
                    hasScrolled={hasScrolled}
                    failedImageUrls={failedImageUrls}
                    totalMediaCount={streamImageCount}
                  />
                </LightboxProvider>
              </div>
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              data-testid="desktop-image-scroller"
              onScroll={handleScroll}
              className={`flex-1 min-h-0 ${QUICKVIEW_LAYOUT.leftPanel.default} overflow-y-auto overscroll-contain bg-ink/5 relative`}
            >
              {isSold && (
                <div className="sticky top-0 z-20 bg-ink/80 text-white text-center py-2 text-sm font-medium tracking-wider uppercase">
                  Sold
                </div>
              )}

              <div className="space-y-1 p-2">
                {renderImageList('desktop')}
              </div>

              {totalMediaCount > 1 && (
                <div className="text-center py-4 text-[11px] text-muted flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {totalMediaCount} items
                </div>
              )}
            </div>
          )}

          {/* Content Section — StatsCard for dealer/collection, QuickViewContent for browse */}
          {useContentStream && contentStreamResult ? (
            <div data-testid="desktop-content-panel" className={`${QUICKVIEW_LAYOUT.rightPanel.dealer.width} ${QUICKVIEW_LAYOUT.rightPanel.dealer.maxWidth} border-l border-border bg-cream flex flex-col min-h-0 overflow-hidden`}>
              <AlertContextBanner />
              {streamImageCount > 1 && (
                <div className="border-b border-border">
                  <div className="h-0.5 bg-border">
                    <div
                      className="h-full bg-gold transition-all duration-300 ease-out"
                      style={{ width: `${((currentImageIndex + 1) / streamImageCount) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-center py-1.5">
                    <span className="text-[11px] text-muted tabular-nums">
                      {t('quickview.photoCounter', { current: currentImageIndex + 1, total: streamImageCount })}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-hidden">
                <StatsCard
                  listing={currentListing}
                  sections={contentStreamResult.sections}
                  onSectionClick={handleSectionClick}
                  activeSection={desktopActiveSection}
                  collectionItem={isCollection ? collectionItem : undefined}
                  actionBarSlot={desktopActionBarSlot}
                  dealerSlot={desktopDealerSlot}
                  ctaSlot={desktopCtaSlot}
                />
              </div>
            </div>
          ) : (
            <div data-testid="desktop-content-panel" className={`${QUICKVIEW_LAYOUT.rightPanel.default.width} ${QUICKVIEW_LAYOUT.rightPanel.default.maxWidth} border-l border-border bg-cream flex flex-col min-h-0 overflow-hidden`}>
              <AlertContextBanner />
              {!isStudyMode && totalMediaCount > 1 && (
                <div className="border-b border-border">
                  <div className="h-0.5 bg-border">
                    <div
                      className="h-full bg-gold transition-all duration-300 ease-out"
                      style={{ width: `${((currentImageIndex + 1) / progressTotal) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-center py-1.5">
                    <span className="text-[11px] text-muted tabular-nums">
                      {t('quickview.photoCounter', { current: currentImageIndex + 1, total: progressTotal })}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto">
                <QuickViewContent
                  listing={currentListing}
                  onClose={closeQuickView}
                  readable={isCollection || isShowcase}
                  collectionItem={isCollection ? collectionItem : undefined}
                  actionBarSlot={desktopActionBarSlot}
                  dealerSlot={desktopDealerSlot}
                  descriptionSlot={desktopDescriptionSlot}
                  provenanceSlot={desktopProvenanceSlot}
                  adminToolsSlot={desktopAdminToolsSlot}
                  ctaSlot={desktopCtaSlot}
                />
              </div>
            </div>
          )}

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
    </ErrorBoundary>
  );
}

export default QuickView;
