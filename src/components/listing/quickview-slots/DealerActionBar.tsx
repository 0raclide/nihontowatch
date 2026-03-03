'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/i18n/LocaleContext';
import { useQuickView } from '@/contexts/QuickViewContext';
import type { Listing } from '@/types';
import { useDealerStatusChange } from './useDealerStatusChange';

interface DealerActionBarProps {
  listing: Listing;
  onStatusChange?: (status: string) => void;
}

export function DealerActionBar({ listing, onStatusChange }: DealerActionBarProps) {
  const { t } = useLocale();
  const router = useRouter();
  const { dismissForNavigation } = useQuickView();
  const { isUpdating, error, handleStatusChange } = useDealerStatusChange({
    listingId: listing.id,
    onStatusChange,
  });

  const handleEdit = useCallback(() => {
    dismissForNavigation();
    router.push(`/dealer/edit/${listing.id}`);
  }, [listing.id, router, dismissForNavigation]);

  const isSold = listing.is_sold;
  const isAvailable = listing.is_available;

  return (
    <>
      {/* Error indicator */}
      {error && (
        <span className="text-[10px] text-red-500 dark:text-red-400 animate-pulse" role="alert">!</span>
      )}

      {/* Edit */}
      <button
        onClick={handleEdit}
        className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-gold hover:bg-gold/10 transition-all duration-200"
        aria-label={t('dealer.editListing')}
        title={t('dealer.editListing')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      {/* Mark Sold */}
      {isAvailable && !isSold && (
        <button
          onClick={() => handleStatusChange('SOLD')}
          disabled={isUpdating}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-green-600 hover:bg-green-50/50 dark:hover:bg-green-950/30 transition-all duration-200"
          aria-label={t('dealer.markSold')}
          title={t('dealer.markSold')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}

      {/* Withdraw / Relist */}
      {isAvailable ? (
        <button
          onClick={() => handleStatusChange('WITHDRAWN')}
          disabled={isUpdating}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-all duration-200"
          aria-label={t('dealer.withdraw')}
          title={t('dealer.withdraw')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </button>
      ) : !isSold ? (
        <button
          onClick={() => handleStatusChange('AVAILABLE')}
          disabled={isUpdating}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-green-600 hover:bg-green-50/50 dark:hover:bg-green-950/30 transition-all duration-200"
          aria-label={t('dealer.relist')}
          title={t('dealer.relist')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      ) : null}
    </>
  );
}
