'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getListingReturnContext,
  clearListingReturnContext,
  type ListingReturnContext,
} from '@/lib/listing/returnContext';

/**
 * Floating "Return to Listing" pill on artist pages.
 * Appears above bottom bars when user navigated here from a QuickView.
 *
 * Mobile layout (bottom→up):
 *   ArtistProfileBar: 64px + safe-area  (z-40, bottom-0)
 *   SectionJumpNav:   44px              (z-30, sm:hidden, bottom = 64px + safe-area)
 *   ListingReturnBar: this component    (z-35, above both)
 *
 * On sm+ (tablet), SectionJumpNav is hidden so we only clear ArtistProfileBar.
 * On lg+ (desktop), this component is hidden entirely.
 */
export function ListingReturnBar() {
  const router = useRouter();
  const [ctx, setCtx] = useState<ListingReturnContext | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const data = getListingReturnContext();
    if (data) {
      setCtx(data);
      // Delay to trigger slide-up entrance animation
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
    // Wait for exit animation then unmount
    setTimeout(() => setCtx(null), 300);
  };

  if (!ctx) return null;

  const pill = (
    <button
      onClick={handleReturn}
      className={`pointer-events-auto flex items-center gap-2.5 max-w-[340px] w-full
        pl-2 pr-2 py-2 rounded-full
        bg-ink/90 text-white backdrop-blur-md
        shadow-lg shadow-black/20
        transition-all duration-300 ease-out
        active:scale-[0.97]
        ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
      `}
    >
      {/* Back arrow */}
      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/15 shrink-0">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </span>

      {/* Thumbnail */}
      {ctx.thumbnailUrl && (
        <img
          src={ctx.thumbnailUrl}
          alt=""
          className="w-8 h-8 rounded-md object-cover shrink-0"
        />
      )}

      {/* Title */}
      <span className="flex-1 min-w-0 text-left text-[13px] font-medium truncate">
        {ctx.title}
      </span>

      {/* Dismiss X */}
      <span
        role="button"
        aria-label="Dismiss"
        onClick={handleDismiss}
        onTouchEnd={handleDismiss}
        className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/15 transition-colors shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    </button>
  );

  return (
    <>
      {/* Phone: above both SectionJumpNav (44px) + ArtistProfileBar (64px) + gap */}
      <div
        className="sm:hidden fixed left-0 right-0 z-[35] flex justify-center pointer-events-none px-4"
        style={{ bottom: 'calc(120px + env(safe-area-inset-bottom, 0px))' }}
      >
        {pill}
      </div>

      {/* Tablet (sm→lg): SectionJumpNav is hidden, only above ArtistProfileBar */}
      <div
        className="hidden sm:flex lg:hidden fixed left-0 right-0 z-[35] justify-center pointer-events-none px-4"
        style={{ bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}
      >
        {pill}
      </div>
    </>
  );
}
