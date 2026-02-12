'use client';

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import type { CollectionItem } from '@/types/collection';
import { CERT_LABELS, STATUS_LABELS, CONDITION_LABELS, getCertTierClass, getItemTypeLabel, formatPrice, formatDate } from '@/lib/collection/labels';
import { useCollectionQuickView } from '@/contexts/CollectionQuickViewContext';

// =============================================================================
// Constants (matching browse QuickViewMobileSheet exactly)
// =============================================================================

const COLLAPSED_HEIGHT = 116;
const SWIPE_THRESHOLD = 40;
const VELOCITY_THRESHOLD = 0.4;
const EXPANDED_RATIO = 0.60;

// =============================================================================
// Component
// =============================================================================

interface CollectionMobileSheetProps {
  item: CollectionItem;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  imageCount: number;
  currentImageIndex: number;
}

export function CollectionMobileSheet({
  item,
  isExpanded,
  onToggle,
  onClose,
  imageCount,
  currentImageIndex,
}: CollectionMobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const { openEditForm } = useCollectionQuickView();

  const [sheetHeight, setSheetHeight] = useState(COLLAPSED_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);

  // Gesture tracking refs
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);

  const expandedHeight = useMemo(() => viewportHeight * EXPANDED_RATIO, [viewportHeight]);

  const certInfo = item.cert_type ? CERT_LABELS[item.cert_type] : null;
  const itemTypeLabel = getItemTypeLabel(item.item_type);
  const heroPrice = formatPrice(item.current_value || item.price_paid, item.current_value_currency || item.price_paid_currency);

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
      setSheetHeight(isExpanded ? expandedHeight : COLLAPSED_HEIGHT);
    }
  }, [isExpanded, expandedHeight, isDragging, viewportHeight]);

  // Note: body scroll lock is handled by parent QuickViewModal via useBodyScrollLock

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragStartY.current = touch.clientY;
    dragStartHeight.current = sheetHeight;
    lastY.current = touch.clientY;
    lastTime.current = Date.now();
    velocity.current = 0;
    setIsDragging(true);
  }, [sheetHeight]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const currentY = touch.clientY;
    const currentTime = Date.now();
    const dt = currentTime - lastTime.current;
    if (dt > 0) {
      velocity.current = (lastY.current - currentY) / dt;
    }
    lastY.current = currentY;
    lastTime.current = currentTime;

    const deltaY = dragStartY.current - currentY;
    const newHeight = dragStartHeight.current + deltaY;
    const minH = COLLAPSED_HEIGHT;
    const maxH = expandedHeight;

    let clampedHeight: number;
    if (newHeight < minH) {
      clampedHeight = minH - (minH - newHeight) * 0.3;
    } else if (newHeight > maxH) {
      clampedHeight = maxH + (newHeight - maxH) * 0.3;
    } else {
      clampedHeight = newHeight;
    }
    setSheetHeight(clampedHeight);
  }, [isDragging, expandedHeight]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const midpoint = (COLLAPSED_HEIGHT + expandedHeight) / 2;
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
      setSheetHeight(isExpanded ? expandedHeight : COLLAPSED_HEIGHT);
    }
  }, [isDragging, sheetHeight, expandedHeight, isExpanded, onToggle]);

  const handleBarTap = useCallback(() => {
    if (!isDragging && !isExpanded) {
      onToggle();
    }
  }, [isDragging, isExpanded, onToggle]);

  const progress = useMemo(() => {
    if (expandedHeight <= COLLAPSED_HEIGHT) return 0;
    return Math.max(0, Math.min(1,
      (sheetHeight - COLLAPSED_HEIGHT) / (expandedHeight - COLLAPSED_HEIGHT)
    ));
  }, [sheetHeight, expandedHeight]);

  const showExpandedContent = progress > 0.1;

  // Expanded content data
  const displayName = item.artisan_display_name || (item.smith ? item.smith : null);
  const statusLabel = STATUS_LABELS[item.status] || item.status;
  const conditionLabel = item.condition ? (CONDITION_LABELS[item.condition] || item.condition) : null;
  const pricePaid = formatPrice(item.price_paid, item.price_paid_currency);
  const currentValue = formatPrice(item.current_value, item.current_value_currency);
  const acquiredDate = formatDate(item.acquired_date);

  return (
    <div
      ref={sheetRef}
      data-testid="collection-mobile-sheet"
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleBarTap}
      >
        {/* Drag handle pill */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header row: Price + Close */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between">
            <span className={`text-lg font-semibold tabular-nums ${heroPrice ? 'text-ink' : 'text-muted'}`}>
              {heroPrice || 'No value set'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); openEditForm(item); }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-ink/10 active:bg-ink/20 transition-colors"
                aria-label="Edit item"
              >
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                data-testid="collection-mobile-sheet-close"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
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
            <span className={`text-[10px] uppercase tracking-wider font-bold ${getCertTierClass(certInfo.tier)}`}>
              {certInfo.shortLabel}
            </span>
          )}
          {item.status !== 'owned' && (
            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              {statusLabel}
            </span>
          )}
          {/* Measurements preview */}
          {item.nagasa_cm && (
            <span className="text-[11px] text-muted tabular-nums">
              {item.nagasa_cm}cm
            </span>
          )}
        </div>

        {/* Source row */}
        {item.acquired_from && (
          <div className="px-4 pb-2">
            <div className="flex items-center text-[12px] text-muted">
              <svg className="w-3 h-3 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="truncate">{item.acquired_from}</span>
            </div>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Expandable content */}
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
          >
            {/* Metadata Grid */}
            <div className="px-4 py-3 border-b border-border">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {displayName && (
                  <div className="col-span-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">
                      {item.item_type && ['tsuba', 'kozuka', 'kogai', 'menuki', 'fuchi-kashira', 'tosogu'].includes(item.item_type.toLowerCase()) ? 'Maker' : 'Smith'}
                    </span>
                    <span className="text-[13px] text-ink font-medium">{displayName}</span>
                  </div>
                )}
                {item.era && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Era</span>
                    <span className="text-[13px] text-ink font-medium">{item.era}</span>
                  </div>
                )}
                {item.province && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Province</span>
                    <span className="text-[13px] text-ink font-medium">{item.province}</span>
                  </div>
                )}
                {item.mei_type && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">Signature</span>
                    <span className="text-[13px] text-ink font-medium capitalize">{item.mei_type}</span>
                  </div>
                )}
              </div>

              {/* Measurements */}
              {(item.nagasa_cm || item.sori_cm || item.motohaba_cm || item.sakihaba_cm) && (
                <div className="mt-3 pt-3 border-t border-border/30 flex flex-wrap gap-x-4 gap-y-1">
                  {item.nagasa_cm && (
                    <span className="text-[12px]">
                      <span className="text-muted">Nagasa</span>{' '}
                      <span className="text-ink font-medium tabular-nums">{item.nagasa_cm}</span>
                      <span className="text-muted/60 text-[10px] ml-0.5">cm</span>
                    </span>
                  )}
                  {item.sori_cm && (
                    <span className="text-[12px]">
                      <span className="text-muted">Sori</span>{' '}
                      <span className="text-ink font-medium tabular-nums">{item.sori_cm}</span>
                      <span className="text-muted/60 text-[10px] ml-0.5">cm</span>
                    </span>
                  )}
                  {item.motohaba_cm && (
                    <span className="text-[12px]">
                      <span className="text-muted">Motohaba</span>{' '}
                      <span className="text-ink font-medium tabular-nums">{item.motohaba_cm}</span>
                      <span className="text-muted/60 text-[10px] ml-0.5">cm</span>
                    </span>
                  )}
                  {item.sakihaba_cm && (
                    <span className="text-[12px]">
                      <span className="text-muted">Sakihaba</span>{' '}
                      <span className="text-ink font-medium tabular-nums">{item.sakihaba_cm}</span>
                      <span className="text-muted/60 text-[10px] ml-0.5">cm</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Title */}
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-[16px] font-serif text-ink leading-snug">
                {item.title || itemTypeLabel}
              </h2>
            </div>

            {/* Provenance */}
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted mb-2">Provenance</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                {item.acquired_from && (
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider block mb-0.5">Source</span>
                    <span className="text-ink font-medium">{item.acquired_from}</span>
                  </div>
                )}
                {acquiredDate && (
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider block mb-0.5">Date</span>
                    <span className="text-ink font-medium">{acquiredDate}</span>
                  </div>
                )}
                {pricePaid && (
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider block mb-0.5">Paid</span>
                    <span className="text-ink font-medium">{pricePaid}</span>
                  </div>
                )}
                {currentValue && (
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider block mb-0.5">Value</span>
                    <span className="text-ink font-medium">{currentValue}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted text-[10px] uppercase tracking-wider block mb-0.5">Status</span>
                  <span className="text-ink font-medium">{statusLabel}</span>
                </div>
                {conditionLabel && (
                  <div>
                    <span className="text-muted text-[10px] uppercase tracking-wider block mb-0.5">Condition</span>
                    <span className="text-ink font-medium">{conditionLabel}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {item.notes && (
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted mb-2">Notes</h3>
                <p className="text-[13px] text-ink whitespace-pre-wrap leading-relaxed">{item.notes}</p>
              </div>
            )}
          </div>

          {/* Sticky CTA — extra padding for iOS */}
          <div
            className="px-4 pt-3 bg-cream border-t border-border shrink-0"
            style={{ paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px))' }}
          >
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); openEditForm(item); }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors active:scale-[0.98]"
              >
                Edit Item
              </button>
              {item.source_listing_id && (
                <Link
                  href={`/listing/${item.source_listing_id}`}
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e: React.TouchEvent) => e.stopPropagation()}
                  className="flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-charcoal bg-linen hover:bg-hover border border-border rounded-lg transition-colors active:scale-[0.98]"
                >
                  Original
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
              )}
            </div>
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
