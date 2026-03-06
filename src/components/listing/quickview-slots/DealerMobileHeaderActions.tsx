'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/i18n/LocaleContext';
import { useQuickView } from '@/contexts/QuickViewContext';
import type { Listing } from '@/types';
import { useDealerStatusChange } from './useDealerStatusChange';

interface DealerMobileHeaderActionsProps {
  listing: Listing;
  onStatusChange?: (status: string) => void;
}

/**
 * Mobile header action buttons for dealer's own listings.
 * Shows edit + mark sold + withdraw/relist buttons.
 */
export function DealerMobileHeaderActions({ listing, onStatusChange }: DealerMobileHeaderActionsProps) {
  const { t } = useLocale();
  const router = useRouter();
  const { dismissForNavigation } = useQuickView();
  const { isUpdating, error, handleStatusChange } = useDealerStatusChange({
    listingId: listing.id,
    onStatusChange,
  });

  const handleEdit = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    dismissForNavigation();
    router.push(`/dealer/edit/${listing.id}`);
  }, [listing.id, router, dismissForNavigation]);

  const status = listing.status?.toUpperCase();
  const isAvailable = status === 'AVAILABLE';
  const isHold = status === 'HOLD';

  return (
    <>
      {/* Error indicator */}
      {error && (
        <span className="text-[10px] text-red-500 dark:text-red-400 animate-pulse" role="alert">!</span>
      )}

      {/* Edit */}
      <button
        onClick={handleEdit}
        onTouchStart={(e) => e.stopPropagation()}
        className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-gold hover:bg-gold/10 transition-all duration-200"
        aria-label={t('dealer.editListing')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      {/* Put on Hold (For Sale only) */}
      {isAvailable && (
        <button
          onClick={(e) => { e.stopPropagation(); handleStatusChange('HOLD'); }}
          onTouchStart={(e) => e.stopPropagation()}
          disabled={isUpdating}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all duration-200"
          aria-label={t('dealer.putOnHold')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}

      {/* Mark Sold (For Sale + Hold) */}
      {(isAvailable || isHold) && (
        <button
          onClick={(e) => { e.stopPropagation(); handleStatusChange('SOLD'); }}
          onTouchStart={(e) => e.stopPropagation()}
          disabled={isUpdating}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-green-600 hover:bg-green-50/50 dark:hover:bg-green-950/30 transition-all duration-200"
          aria-label={t('dealer.markSold')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}

      {/* Relist (Hold → For Sale) */}
      {isHold && (
        <button
          onClick={(e) => { e.stopPropagation(); handleStatusChange('AVAILABLE'); }}
          onTouchStart={(e) => e.stopPropagation()}
          disabled={isUpdating}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-green-600 hover:bg-green-50/50 dark:hover:bg-green-950/30 transition-all duration-200"
          aria-label={t('dealer.relist')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}

      {/* Withdraw to Inventory (For Sale + Hold) */}
      {(isAvailable || isHold) && (
        <button
          onClick={(e) => { e.stopPropagation(); handleStatusChange('INVENTORY'); }}
          onTouchStart={(e) => e.stopPropagation()}
          disabled={isUpdating}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-all duration-200"
          aria-label={t('dealer.moveToInventory')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </button>
      )}
    </>
  );
}
