'use client';

import { useRef, useCallback, useEffect, useState, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Listing } from '@/types';
import { getItemTypeLabel } from '@/types';
import { useCurrency, formatPriceWithConversion } from '@/hooks/useCurrency';
import { shouldShowNewBadge } from '@/lib/newListing';
import { saveListingReturnContext } from '@/lib/listing/returnContext';
import { MetadataGrid, getCertInfo, getArtisanInfo } from './MetadataGrid';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { TranslatedTitle } from './TranslatedTitle';
import { QuickMeasurement } from './QuickMeasurement';
import { useLocale } from '@/i18n/LocaleContext';
import { useAuth } from '@/lib/auth/AuthContext';

// =============================================================================
// TYPES
// =============================================================================

interface QuickViewMobileSheetProps {
  listing: Listing;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  // Composition slots
  headerActionsSlot?: ReactNode;
  dealerSlot?: ReactNode;
  descriptionSlot?: ReactNode;
  ctaSlot?: ReactNode;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Sheet heights
const COLLAPSED_HEIGHT_BASE = 116;
const COLLAPSED_HEIGHT_ARTIST = 160;

// Gesture thresholds
const SWIPE_THRESHOLD = 40;
const VELOCITY_THRESHOLD = 0.4;

// Snap points as percentage of viewport height
const EXPANDED_RATIO = 0.60;

// =============================================================================
// COMPONENT
// =============================================================================

export function QuickViewMobileSheet({
  listing,
  isExpanded,
  onToggle,
  onClose,
  headerActionsSlot,
  dealerSlot,
  descriptionSlot,
  ctaSlot,
}: QuickViewMobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const { isAdmin } = useAuth();

  // Dynamic collapsed height — taller when artist identity block is shown
  const hasArtistBlock = !!(
    listing.artisan_id &&
    listing.artisan_id !== 'UNKNOWN' &&
    listing.artisan_confidence && listing.artisan_confidence !== 'NONE' &&
    (isAdmin || !listing.artisan_id.startsWith('tmp'))
  );
  const collapsedHeight = hasArtistBlock ? COLLAPSED_HEIGHT_ARTIST : COLLAPSED_HEIGHT_BASE;

  const [sheetHeight, setSheetHeight] = useState(collapsedHeight);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [navigatingToArtist, setNavigatingToArtist] = useState(false);

  const { t, locale } = useLocale();
  const quickView = useQuickViewOptional();
  const detailLoaded = quickView?.detailLoaded ?? true;

  // Gesture tracking refs
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const dragStartTime = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);

  const expandedHeight = useMemo(() =>
    viewportHeight * EXPANDED_RATIO,
    [viewportHeight]
  );

  const { currency, exchangeRates } = useCurrency();
  const certInfo = getCertInfo(listing.cert_type);
  const { artisan } = getArtisanInfo(listing, locale);
  const rawItemTypeLabel = getItemTypeLabel(listing.item_type);
  const itemTypeLabel = (() => { const k = `itemType.${listing.item_type?.toLowerCase()}`; const r = t(k); return r === k ? rawItemTypeLabel : r; })();
  const priceDisplay = formatPriceWithConversion(
    listing.price_value,
    listing.price_currency,
    currency,
    exchangeRates
  );

  // Initialize viewport height
  useEffect(() => {
    const updateViewportHeight = () => {
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

  // Sync sheet height with isExpanded prop
  useEffect(() => {
    if (!isDragging && viewportHeight > 0) {
      setSheetHeight(isExpanded ? expandedHeight : collapsedHeight);
    }
  }, [isExpanded, expandedHeight, collapsedHeight, isDragging, viewportHeight]);

  // NOTE: Body scroll locking is handled by useBodyScrollLock in QuickViewModal.
  // Do NOT manipulate body.style.overflow here — it conflicts with the scroll lock
  // (the else branch clears overflow:hidden on mount, breaking the lock on iOS Safari).
  // See: Safari crash investigation 2026-02-28.

  const isDragCommitted = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragStartY.current = touch.clientY;
    dragStartHeight.current = sheetHeight;
    dragStartTime.current = Date.now();
    lastY.current = touch.clientY;
    lastTime.current = Date.now();
    velocity.current = 0;
    isDragCommitted.current = false;
    setIsDragging(true);
  }, [sheetHeight]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const currentY = touch.clientY;
    const currentTime = Date.now();

    if (!isDragCommitted.current) {
      const distance = Math.abs(currentY - dragStartY.current);
      if (distance < 8) return;
      isDragCommitted.current = true;
    }

    const dt = currentTime - lastTime.current;
    if (dt > 0) {
      velocity.current = (lastY.current - currentY) / dt;
    }
    lastY.current = currentY;
    lastTime.current = currentTime;

    const deltaY = dragStartY.current - currentY;
    const newHeight = dragStartHeight.current + deltaY;

    const minH = collapsedHeight;
    const maxH = expandedHeight;

    let clampedHeight: number;
    if (newHeight < minH) {
      const overflow = minH - newHeight;
      clampedHeight = minH - overflow * 0.3;
    } else if (newHeight > maxH) {
      const overflow = newHeight - maxH;
      clampedHeight = maxH + overflow * 0.3;
    } else {
      clampedHeight = newHeight;
    }

    setSheetHeight(clampedHeight);
  }, [isDragging, collapsedHeight, expandedHeight]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    isDragCommitted.current = false;
    setIsDragging(false);

    const midpoint = (collapsedHeight + expandedHeight) / 2;
    const currentVelocity = velocity.current;

    let shouldExpand: boolean;
    if (Math.abs(currentVelocity) > VELOCITY_THRESHOLD) {
      shouldExpand = currentVelocity > 0;
    } else {
      shouldExpand = sheetHeight > midpoint;
    }

    const dragDistance = Math.abs(sheetHeight - dragStartHeight.current);
    if (dragDistance > SWIPE_THRESHOLD) {
      shouldExpand = sheetHeight > dragStartHeight.current;
    }

    if (shouldExpand !== isExpanded) {
      onToggle();
    } else {
      setSheetHeight(isExpanded ? expandedHeight : collapsedHeight);
    }
  }, [isDragging, sheetHeight, collapsedHeight, expandedHeight, isExpanded, onToggle]);

  const handleBarTap = useCallback((e: React.MouseEvent) => {
    if (!isDragging && !isExpanded) {
      onToggle();
    }
  }, [isDragging, isExpanded, onToggle]);

  const progress = useMemo(() => {
    if (expandedHeight <= collapsedHeight) return 0;
    return Math.max(0, Math.min(1,
      (sheetHeight - collapsedHeight) / (expandedHeight - collapsedHeight)
    ));
  }, [sheetHeight, expandedHeight, collapsedHeight]);

  const showExpandedContent = progress > 0.1;

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
      {/* Draggable header area */}
      <div
        className="cursor-grab active:cursor-grabbing shrink-0"
        style={{ touchAction: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleBarTap}
      >
        {/* Drag handle pill */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header row: Price + Actions + Close */}
        <div className="pl-4 pr-5 pb-2">
          <div className="flex items-center justify-between">
            <span className={`text-lg font-semibold tabular-nums ${listing.price_value ? 'text-ink' : 'text-muted'}`}>
              {priceDisplay}
            </span>

            <div className="flex items-center gap-2">
              {headerActionsSlot}
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

        {/* Badges row */}
        <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted uppercase tracking-wide font-medium px-2 py-0.5 bg-linen rounded">
            {itemTypeLabel}
          </span>
          {certInfo && (
            <span
              className={`text-[10px] uppercase tracking-wider font-bold ${
                certInfo.tier === 'tokuju' ? 'text-tokuju'
                  : certInfo.tier === 'jubi' ? 'text-jubi'
                  : certInfo.tier === 'juyo' ? 'text-juyo'
                  : certInfo.tier === 'tokuho' ? 'text-toku-hozon'
                  : 'text-hozon'
              }`}
            >
              {t(certInfo.certKey)}
            </span>
          )}
          {shouldShowNewBadge(listing.first_seen_at, listing.dealer_earliest_seen_at, listing.is_initial_import) && (
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-new-listing-bg text-new-listing">
              {t('quickview.newThisWeek')}
            </span>
          )}
          {isAdmin && listing.admin_hidden && (
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Hidden
            </span>
          )}
          <QuickMeasurement listing={listing} />
        </div>

        {/* Artist identity block */}
        {listing.artisan_id &&
         listing.artisan_id !== 'UNKNOWN' &&
         listing.artisan_confidence && listing.artisan_confidence !== 'NONE' &&
         (isAdmin || !listing.artisan_id.startsWith('tmp')) && (
          <div
            className="flex items-center gap-2 ml-4 mr-5 mb-2 px-3 py-2 bg-gold/5 rounded-lg"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <a
              href={`/artists/${listing.artisan_id}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (navigatingToArtist) return;
                setNavigatingToArtist(true);
                window.dispatchEvent(new Event('nav-progress-start'));
                saveListingReturnContext(listing);
                quickView?.dismissForNavigation?.();
                router.push(`/artists/${listing.artisan_id}`);
              }}
              className={`group flex items-center gap-3 flex-1 min-w-0 cursor-pointer ${navigatingToArtist ? 'opacity-70' : ''}`}
            >
              <svg className="w-4 h-4 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase tracking-wider text-gold font-medium leading-tight">{t('quickview.artistProfile')}</div>
                <div className="text-[14px] font-semibold text-ink group-hover:text-gold transition-colors truncate">
                  {artisan || listing.artisan_display_name || listing.artisan_id}
                </div>
              </div>
              {listing.artisan_tier && (
                <svg
                  className={`w-3.5 h-3.5 shrink-0 ${
                    listing.artisan_tier === 'kokuho' ? 'text-amber-400' :
                    listing.artisan_tier === 'elite' ? 'text-purple-400' :
                    'text-blue-400'
                  }`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-label={
                    listing.artisan_tier === 'kokuho' ? 'National Treasure designated' :
                    listing.artisan_tier === 'elite' ? 'Elite designated' :
                    'Juyo designated'
                  }
                >
                  <title>{
                    listing.artisan_tier === 'kokuho' ? 'National Treasure' :
                    listing.artisan_tier === 'elite' ? 'Elite' :
                    'Juyo'
                  }</title>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}
              {navigatingToArtist ? (
                <svg className="w-3.5 h-3.5 text-gold animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-gold/60 group-hover:text-gold transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </a>
          </div>
        )}

        {/* Dealer slot */}
        {dealerSlot && (
          <div className="px-4 pb-2">
            <div className="flex items-center text-[12px] text-muted">
              {dealerSlot}
            </div>
          </div>
        )}
      </div>

      {/* Unified content structure */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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

            {/* Title */}
            <div className="px-4 py-3 border-b border-border">
              <TranslatedTitle listing={listing} />
            </div>

            {/* Description slot */}
            {descriptionSlot}
          </div>

          {/* Sticky CTA */}
          <div
            className="px-4 pt-3 bg-cream border-t border-border shrink-0"
            style={{
              paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px))'
            }}
          >
            {ctaSlot}
          </div>
        </div>

        {/* Collapsed state hint */}
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
    </div>
  );
}

export default QuickViewMobileSheet;
