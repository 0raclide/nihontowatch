'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/i18n/LocaleContext';
import { useQuickView } from '@/contexts/QuickViewContext';
import type { Listing } from '@/types';

interface DealerMobileHeaderActionsProps {
  listing: Listing;
  onStatusChange?: (status: string) => void;
}

/**
 * Mobile header action buttons for dealer's own listings.
 * Only Edit — all status transitions live in the CTA slot at the bottom.
 */
export function DealerMobileHeaderActions({ listing }: DealerMobileHeaderActionsProps) {
  const { t } = useLocale();
  const router = useRouter();
  const { dismissForNavigation } = useQuickView();

  const handleEdit = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    dismissForNavigation();
    router.push(`/dealer/edit/${listing.id}`);
  }, [listing.id, router, dismissForNavigation]);

  return (
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
  );
}
