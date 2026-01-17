'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import type { Listing } from '@/types';
import { isTosogu, getItemTypeLabel } from '@/types';
import { useCurrency, formatPriceWithConversion } from '@/hooks/useCurrency';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';

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
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CERT_CONFIG: Record<string, { label: string; shortLabel: string; tier: 'premier' | 'high' | 'standard' }> = {
  Juyo: { label: 'Juyo', shortLabel: 'Juyo', tier: 'premier' },
  juyo: { label: 'Juyo', shortLabel: 'Juyo', tier: 'premier' },
  'Tokubetsu Juyo': { label: 'Tokubetsu Juyo', shortLabel: 'TokuJu', tier: 'premier' },
  tokubetsu_juyo: { label: 'Tokubetsu Juyo', shortLabel: 'TokuJu', tier: 'premier' },
  Tokuju: { label: 'Tokubetsu Juyo', shortLabel: 'TokuJu', tier: 'premier' },
  tokuju: { label: 'Tokubetsu Juyo', shortLabel: 'TokuJu', tier: 'premier' },
  'Tokubetsu Hozon': { label: 'Tokubetsu Hozon', shortLabel: 'TokuHo', tier: 'high' },
  tokubetsu_hozon: { label: 'Tokubetsu Hozon', shortLabel: 'TokuHo', tier: 'high' },
  TokuHozon: { label: 'Tokubetsu Hozon', shortLabel: 'TokuHo', tier: 'high' },
  Hozon: { label: 'Hozon', shortLabel: 'Hozon', tier: 'standard' },
  hozon: { label: 'Hozon', shortLabel: 'Hozon', tier: 'standard' },
  'Juyo Tosogu': { label: 'Juyo Tosogu', shortLabel: 'Juyo', tier: 'premier' },
  'Tokubetsu Hozon Tosogu': { label: 'Toku Hozon Tosogu', shortLabel: 'TokuHo', tier: 'high' },
  'Hozon Tosogu': { label: 'Hozon Tosogu', shortLabel: 'Hozon', tier: 'standard' },
  'NTHK Kanteisho': { label: 'NTHK', shortLabel: 'NTHK', tier: 'standard' },
};

// Gesture thresholds
const SWIPE_THRESHOLD = 50; // Minimum distance to trigger state change
const VELOCITY_THRESHOLD = 0.3; // Minimum velocity to trigger quick swipe

// =============================================================================
// HELPERS
// =============================================================================

function getArtisanName(listing: Listing): string | null {
  if (isTosogu(listing.item_type)) {
    return listing.tosogu_maker || null;
  }
  return listing.smith || null;
}

function getCertInfo(certType: string | undefined): { label: string; shortLabel: string; tier: 'premier' | 'high' | 'standard' } | null {
  if (!certType) return null;
  return CERT_CONFIG[certType] || null;
}

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
}: QuickViewMobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef(0);
  const dragStartTime = useRef(0);
  const lastY = useRef(0);

  const { currency, exchangeRates } = useCurrency();
  const certInfo = getCertInfo(listing.cert_type);
  const artisanName = getArtisanName(listing);
  const itemTypeLabel = getItemTypeLabel(listing.item_type);
  const dealerName = listing.dealer?.name || 'Dealer';
  const priceDisplay = formatPriceWithConversion(
    listing.price_value,
    listing.price_currency,
    currency,
    exchangeRates
  );

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragStartY.current = touch.clientY;
    dragStartTime.current = Date.now();
    lastY.current = touch.clientY;
    setIsDragging(true);
    setDragOffset(0);
  }, []);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - dragStartY.current;
    lastY.current = touch.clientY;

    // When expanded, only allow dragging down (positive deltaY)
    // When collapsed, only allow dragging up (negative deltaY)
    if (isExpanded) {
      setDragOffset(Math.max(0, deltaY));
    } else {
      setDragOffset(Math.min(0, deltaY));
    }
  }, [isDragging, isExpanded]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;

    const duration = Date.now() - dragStartTime.current;
    const velocity = Math.abs(dragOffset) / duration;
    const shouldToggle = Math.abs(dragOffset) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

    if (shouldToggle) {
      onToggle();
    }

    setIsDragging(false);
    setDragOffset(0);
  }, [isDragging, dragOffset, onToggle]);

  // Handle click on collapsed bar
  const handleCollapsedClick = useCallback(() => {
    if (!isDragging && !isExpanded) {
      onToggle();
    }
  }, [isDragging, isExpanded, onToggle]);

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

  // Calculate transform based on drag state
  const getTransformStyle = () => {
    if (isDragging) {
      return {
        transform: `translateY(${dragOffset}px)`,
        transition: 'none',
      };
    }
    return {
      transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
    };
  };

  return (
    <div
      ref={sheetRef}
      data-testid="mobile-sheet"
      className={`
        fixed left-0 right-0 bottom-0 z-50
        bg-cream rounded-t-2xl
        shadow-lg
        ${isExpanded ? 'sheet-expanded' : 'sheet-collapsed'}
      `}
      style={{
        ...getTransformStyle(),
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe indicator handle */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>

      {isExpanded ? (
        // EXPANDED STATE
        <div className="px-4 pb-4 safe-area-bottom">
          {/* Close button - uses touch handlers to prevent sheet drag gestures from intercepting */}
          <button
            type="button"
            data-testid="mobile-sheet-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onTouchStart={(e) => {
              // Stop propagation to prevent sheet's drag handling from starting
              e.stopPropagation();
            }}
            onTouchEnd={(e) => {
              // Stop propagation and trigger close immediately on touch for responsive mobile UX
              e.stopPropagation();
              e.preventDefault(); // Prevent click from also firing
              onClose();
            }}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-linen text-ink active:bg-border transition-colors z-10"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Price row with favorite button */}
          <div className="pt-1 pb-3 flex items-center justify-between">
            <span className={`text-2xl font-semibold tabular-nums ${listing.price_value ? 'text-ink' : 'text-muted'}`}>
              {priceDisplay}
            </span>
            <FavoriteButton
              listingId={listing.id}
              size="sm"
            />
          </div>

          {/* Badges row: Item type + Certification */}
          <div className="flex items-center gap-2 mb-3">
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
          </div>

          {/* Artisan name */}
          {artisanName && (
            <p className="text-[14px] text-ink font-medium truncate mb-1">
              {artisanName}
            </p>
          )}

          {/* Dealer name */}
          <div className="flex items-center gap-1.5 text-[12px] text-muted mb-4">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="truncate">{dealerName}</span>
          </div>

          {/* CTA Button - stop propagation to prevent sheet drag interference on mobile */}
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-2 w-full px-5 py-3 text-[13px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors active:scale-[0.98]"
          >
            See Full Listing
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      ) : (
        // COLLAPSED STATE
        <div
          className="flex items-center justify-between px-4 py-2 safe-area-bottom cursor-pointer"
          onClick={handleCollapsedClick}
          role="button"
          tabIndex={0}
          aria-label="Expand details"
        >
          {/* Price on left */}
          <span className={`text-[15px] font-semibold tabular-nums ${listing.price_value ? 'text-ink' : 'text-muted'}`}>
            {priceDisplay}
          </span>

          {/* Swipe up chevron in center */}
          <div className="flex flex-col items-center gap-0.5">
            <svg className="w-5 h-5 text-muted animate-bounce-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </div>

          {/* Right side: Favorite button + Image counter */}
          <div className="flex items-center gap-3">
            <div
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <FavoriteButton
                listingId={listing.id}
                size="sm"
              />
            </div>
            {imageCount > 0 && (
              <span className="text-[12px] text-muted tabular-nums">
                {currentImageIndex + 1}/{imageCount}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default QuickViewMobileSheet;
