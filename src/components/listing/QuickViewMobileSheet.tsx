'use client';

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import type { Listing, ListingWithEnrichment } from '@/types';
import { isTosogu, getItemTypeLabel, hasSetsumeiData } from '@/types';
import { useCurrency, formatPriceWithConversion } from '@/hooks/useCurrency';
import { shouldShowNewBadge } from '@/lib/newListing';
import Link from 'next/link';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { ShareButton } from '@/components/share/ShareButton';
import { InquiryModal } from '@/components/inquiry';
import { LoginModal } from '@/components/auth/LoginModal';
import { ArtisanTooltip } from '@/components/artisan/ArtisanTooltip';
import { useAuth } from '@/lib/auth/AuthContext';
import { useActivityTrackerOptional } from '@/lib/tracking/ActivityTracker';
import { MetadataGrid, getCertInfo, getArtisanInfo } from './MetadataGrid';
import { SetsumeiSection } from './SetsumeiSection';
import { TranslatedDescription } from './TranslatedDescription';
import { TranslatedTitle } from './TranslatedTitle';
import { QuickMeasurement } from './QuickMeasurement';

// =============================================================================
// TYPES
// =============================================================================

interface QuickViewMobileSheetProps {
  listing: Listing;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  imageCount: number;
  currentImageIndex: number;
  isStudyMode?: boolean;
  onToggleStudyMode?: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Sheet heights
const COLLAPSED_HEIGHT = 116; // Compact bar height - shows price, badges, and dealer
const HANDLE_HEIGHT = 16; // Swipe handle area

// Gesture thresholds
const SWIPE_THRESHOLD = 40; // Minimum distance to trigger state change
const VELOCITY_THRESHOLD = 0.4; // Minimum velocity for quick swipe (px/ms)

// Snap points as percentage of viewport height
const EXPANDED_RATIO = 0.60; // 60% of screen when expanded

// =============================================================================
// COMPONENT
// =============================================================================

export function QuickViewMobileSheet({
  listing,
  isExpanded,
  onToggle,
  onClose,
  imageCount,
  currentImageIndex,
  isStudyMode,
  onToggleStudyMode,
}: QuickViewMobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);

  // Track current sheet height for smooth gestures
  const [sheetHeight, setSheetHeight] = useState(COLLAPSED_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);

  // Inquiry modal state
  const { user, isAdmin } = useAuth();
  const activityTracker = useActivityTrackerOptional();
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Gesture tracking refs
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const dragStartTime = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);

  // Computed values
  const expandedHeight = useMemo(() =>
    viewportHeight * EXPANDED_RATIO,
    [viewportHeight]
  );

  const { currency, exchangeRates } = useCurrency();
  const certInfo = getCertInfo(listing.cert_type);
  const { artisan, school } = getArtisanInfo(listing);
  const itemTypeLabel = getItemTypeLabel(listing.item_type);
  // Note: Supabase returns 'dealers' (plural) from the join, not 'dealer' (singular)
  const dealerName = listing.dealers?.name || listing.dealer?.name || 'Dealer';
  const priceDisplay = formatPriceWithConversion(
    listing.price_value,
    listing.price_currency,
    currency,
    exchangeRates
  );

  // Handle Inquire button click
  const handleInquire = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setIsInquiryModalOpen(true);
  }, [user]);

  // Track when user clicks through to dealer's website
  const handleDealerLinkClick = useCallback(() => {
    if (activityTracker && listing) {
      activityTracker.trackExternalLinkClick(
        listing.url,
        Number(listing.id),
        listing.dealers?.name || listing.dealer?.name
      );
    }
  }, [activityTracker, listing]);

  // Initialize viewport height
  useEffect(() => {
    const updateViewportHeight = () => {
      // Use visualViewport for accurate height on iOS
      const vh = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(vh);
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('resize', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
    };
  }, []);

  // Sync sheet height with isExpanded prop (for external control)
  useEffect(() => {
    if (!isDragging && viewportHeight > 0) {
      setSheetHeight(isExpanded ? expandedHeight : COLLAPSED_HEIGHT);
    }
  }, [isExpanded, expandedHeight, isDragging, viewportHeight]);

  // Prevent body scroll when sheet is expanded
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  // Handle touch start on the drag handle area
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragStartY.current = touch.clientY;
    dragStartHeight.current = sheetHeight;
    dragStartTime.current = Date.now();
    lastY.current = touch.clientY;
    lastTime.current = Date.now();
    velocity.current = 0;
    setIsDragging(true);
  }, [sheetHeight]);

  // Handle touch move - update sheet height based on gesture
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    const currentY = touch.clientY;
    const currentTime = Date.now();

    // Calculate velocity for momentum
    const dt = currentTime - lastTime.current;
    if (dt > 0) {
      velocity.current = (lastY.current - currentY) / dt; // Positive = dragging up
    }
    lastY.current = currentY;
    lastTime.current = currentTime;

    // Calculate new height: dragging up (negative deltaY) increases height
    const deltaY = dragStartY.current - currentY;
    const newHeight = dragStartHeight.current + deltaY;

    // Clamp height with rubber-band effect at boundaries
    const minH = COLLAPSED_HEIGHT;
    const maxH = expandedHeight;

    let clampedHeight: number;
    if (newHeight < minH) {
      // Rubber-band effect below minimum
      const overflow = minH - newHeight;
      clampedHeight = minH - overflow * 0.3;
    } else if (newHeight > maxH) {
      // Rubber-band effect above maximum
      const overflow = newHeight - maxH;
      clampedHeight = maxH + overflow * 0.3;
    } else {
      clampedHeight = newHeight;
    }

    setSheetHeight(clampedHeight);
  }, [isDragging, expandedHeight]);

  // Handle touch end - snap to nearest state
  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const midpoint = (COLLAPSED_HEIGHT + expandedHeight) / 2;
    const currentVelocity = velocity.current;

    // Determine target based on velocity or position
    let shouldExpand: boolean;

    if (Math.abs(currentVelocity) > VELOCITY_THRESHOLD) {
      // High velocity: use velocity direction
      shouldExpand = currentVelocity > 0;
    } else {
      // Low velocity: use position relative to midpoint
      shouldExpand = sheetHeight > midpoint;
    }

    // Also check if we crossed the threshold from current state
    const dragDistance = Math.abs(sheetHeight - dragStartHeight.current);
    if (dragDistance > SWIPE_THRESHOLD) {
      // Significant drag: toggle based on direction
      shouldExpand = sheetHeight > dragStartHeight.current;
    }

    // Update state if changed
    if (shouldExpand !== isExpanded) {
      onToggle();
    } else {
      // Snap back to current state
      setSheetHeight(isExpanded ? expandedHeight : COLLAPSED_HEIGHT);
    }
  }, [isDragging, sheetHeight, expandedHeight, isExpanded, onToggle]);

  // Handle tap on collapsed bar to expand
  const handleBarTap = useCallback((e: React.MouseEvent) => {
    // Only trigger if not dragging and currently collapsed
    if (!isDragging && !isExpanded) {
      onToggle();
    }
  }, [isDragging, isExpanded, onToggle]);

  // Calculate progress from collapsed to expanded (0-1)
  const progress = useMemo(() => {
    if (expandedHeight <= COLLAPSED_HEIGHT) return 0;
    return Math.max(0, Math.min(1,
      (sheetHeight - COLLAPSED_HEIGHT) / (expandedHeight - COLLAPSED_HEIGHT)
    ));
  }, [sheetHeight, expandedHeight]);

  // Determine if we're in "expanded mode" (for content visibility)
  const showExpandedContent = progress > 0.1;

  // Check if we have a real dealer name (not just the fallback)
  const hasRealDealerName = (listing.dealers?.name || listing.dealer?.name) &&
    (listing.dealers?.name || listing.dealer?.name) !== 'Dealer';

  return (
    <div
      ref={sheetRef}
      data-testid="mobile-sheet"
      className="fixed left-0 right-0 bottom-0 z-50 bg-cream rounded-t-2xl overflow-hidden flex flex-col"
      style={{
        height: sheetHeight,
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
        transition: isDragging ? 'none' : 'height 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        willChange: 'height',
      }}
    >
      {/* Draggable header area - entire top section responds to drag gestures */}
      <div
        className="cursor-grab active:cursor-grabbing shrink-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleBarTap}
      >
        {/* Drag handle pill */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header row: Price + Favorite + Close */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between">
            {/* Left side: Price */}
            <span className={`text-lg font-semibold tabular-nums ${listing.price_value ? 'text-ink' : 'text-muted'}`}>
              {priceDisplay}
            </span>

            {/* Right side: Study + Share + Favorite + Close button */}
            <div className="flex items-center gap-2">
              {/* Study Setsumei button - only show when setsumei data available */}
              {hasSetsumeiData(listing as ListingWithEnrichment) && onToggleStudyMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStudyMode();
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
                    isStudyMode
                      ? 'bg-gold text-white shadow-lg'
                      : 'magical-book'
                  }`}
                  aria-label={isStudyMode ? 'View photos' : 'Study setsumei'}
                  title={isStudyMode ? 'View photos' : 'Read NBTHK evaluation'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </button>
              )}
              <div
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <ShareButton
                  listingId={listing.id}
                  title={listing.title}
                  size="sm"
                  ogImageUrl={listing.og_image_url}
                />
              </div>
              <div
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <FavoriteButton
                  listingId={listing.id}
                  size="sm"
                />
              </div>
              <button
                data-testid="mobile-sheet-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-ink/10 active:bg-ink/20 transition-colors"
                aria-label="Close quick view"
              >
                <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Badges row: Always visible - Item type + Certification + Measurement */}
        <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted uppercase tracking-wide font-medium px-2 py-0.5 bg-linen rounded">
            {itemTypeLabel}
          </span>
          {certInfo && (
            <span
              className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
                certInfo.tier === 'premier'
                  ? 'bg-juyo-bg text-juyo'
                  : certInfo.tier === 'high'
                  ? 'bg-toku-hozon-bg text-toku-hozon'
                  : 'bg-hozon-bg text-hozon'
              }`}
            >
              {certInfo.shortLabel}
            </span>
          )}
          {shouldShowNewBadge(listing.first_seen_at, listing.dealer_earliest_seen_at) && (
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-new-listing-bg text-new-listing">
              New this week
            </span>
          )}
          {listing.artisan_id &&
           listing.artisan_confidence && listing.artisan_confidence !== 'NONE' && (
            isAdmin ? (
              <ArtisanTooltip
                listingId={Number(listing.id)}
                artisanId={listing.artisan_id}
                confidence={listing.artisan_confidence}
              >
                <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded ${
                  listing.artisan_confidence === 'HIGH'
                    ? 'bg-artisan-high-bg text-artisan-high'
                    : listing.artisan_confidence === 'MEDIUM'
                    ? 'bg-artisan-medium-bg text-artisan-medium'
                    : 'bg-artisan-low-bg text-artisan-low'
                }`}>
                  {listing.artisan_id}
                </span>
              </ArtisanTooltip>
            ) : (
              <Link
                href={`/artists/${listing.artisan_id}`}
                data-artisan-tooltip
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded hover:opacity-80 transition-opacity ${
                  listing.artisan_confidence === 'HIGH'
                    ? 'bg-artisan-high-bg text-artisan-high'
                    : listing.artisan_confidence === 'MEDIUM'
                    ? 'bg-artisan-medium-bg text-artisan-medium'
                    : 'bg-artisan-low-bg text-artisan-low'
                }`}
              >
                {listing.artisan_id}
              </Link>
            )
          )}
          <QuickMeasurement listing={listing} />
        </div>

        {/* Dealer row - Always visible if we have a real dealer name */}
        {hasRealDealerName && (
          <div className="px-4 pb-2">
            <div className="flex items-center text-[12px] text-muted">
              <svg className="w-3 h-3 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="truncate">{dealerName}</span>
            </div>
          </div>
        )}
      </div>

      {/* Unified content structure - flex-1 to fill remaining space after header */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* Expandable content - visible as sheet grows */}
        <div
          className="flex flex-col flex-1 min-h-0 overflow-hidden transition-opacity"
          style={{
            opacity: showExpandedContent ? 1 : 0,
            pointerEvents: showExpandedContent ? 'auto' : 'none',
          }}
        >
          {/* Scrollable content area */}
          <div
            ref={scrollContentRef}
            className="flex-1 overflow-y-auto overscroll-contain min-h-0 border-t border-border"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            data-testid="mobile-sheet-scroll-content"
          >
            {/* Attribution & Measurements */}
            <MetadataGrid
              listing={listing}
              variant="full"
              showAttribution={true}
              showMeasurements={true}
            />

            {/* Title (auto-translated if Japanese) */}
            <div className="px-4 py-3 border-b border-border">
              <TranslatedTitle listing={listing} />
            </div>

            {/* Description */}
            <TranslatedDescription listing={listing} maxLines={12} />

            {/* NBTHK Zufu Commentary (Juyo/Tokuju only) - expands in-place */}
            <SetsumeiSection
              listing={listing}
              variant="preview"
              previewLength={300}
            />
          </div>

          {/* Sticky CTA - extra padding for iOS browser chrome */}
          <div
            className="px-4 pt-3 bg-cream border-t border-border shrink-0"
            style={{
              paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px))'
            }}
          >
            <div className="flex gap-2">
              {/* Inquire Button */}
              <button
                onClick={handleInquire}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                data-testid="inquire-button-mobile"
                className="flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-charcoal bg-linen hover:bg-hover border border-border rounded-lg transition-colors active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Inquire
              </button>

              {/* View on Dealer Button */}
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDealerLinkClick();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-[13px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors active:scale-[0.98]"
              >
                View on {dealerName}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Collapsed state hint - visible when mostly collapsed */}
        {!showExpandedContent && (
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-2 pointer-events-none"
            style={{ opacity: 1 - progress * 3 }}
          >
            <svg className="w-5 h-5 text-muted animate-bounce-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Inquiry Modal */}
      <InquiryModal
        isOpen={isInquiryModalOpen}
        onClose={() => setIsInquiryModalOpen(false)}
        listing={listing}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}

export default QuickViewMobileSheet;
