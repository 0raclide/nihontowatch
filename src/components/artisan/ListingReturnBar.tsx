'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getListingReturnContext,
  clearListingReturnContext,
  type ListingReturnContext,
} from '@/lib/listing/returnContext';

/**
 * Floating "Return to listing" pill on artist pages.
 * Appears above ArtistProfileBar when user navigated here from a QuickView.
 * Hidden on desktop (lg+).
 */
export function ListingReturnBar() {
  const router = useRouter();
  const [ctx, setCtx] = useState<ListingReturnContext | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const data = getListingReturnContext();
    if (data) {
      setCtx(data);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    }
  }, []);

  const handleReturn = () => {
    if (!ctx) return;
    clearListingReturnContext();
    router.push(`/?listing=${ctx.listingId}`);
  };

  const handleDismiss = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setVisible(false);
    clearListingReturnContext();
    setTimeout(() => setCtx(null), 300);
  };

  if (!ctx) return null;

  return (
    <div
      className="lg:hidden fixed left-0 right-0 z-[35] flex justify-center pointer-events-none px-4"
      style={{ bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}
    >
      <button
        onClick={handleReturn}
        className={`pointer-events-auto flex items-center gap-2 max-w-[280px] w-auto
          pl-3 pr-1.5 py-2 rounded-full
          bg-cream/95 backdrop-blur-md
          border border-border
          shadow-md
          transition-all duration-300 ease-out
          active:scale-[0.97]
          ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
        `}
      >
        {/* Back arrow */}
        <svg className="w-4 h-4 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>

        <span className="text-[13px] font-medium text-ink">
          Return to listing
        </span>

        {/* Dismiss X */}
        <span
          role="button"
          aria-label="Dismiss"
          onClick={handleDismiss}
          onTouchEnd={handleDismiss}
          className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-border/50 transition-colors shrink-0 ml-1"
        >
          <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      </button>
    </div>
  );
}
