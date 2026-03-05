'use client';

import { useLocale } from '@/i18n/LocaleContext';
import type { Listing } from '@/types';

interface DealerMobileCTAProps {
  listing: Listing;
}

/**
 * Mobile CTA area for dealer's own listings.
 * Shows status instead of "Visit Dealer".
 */
export function DealerMobileCTA({ listing }: DealerMobileCTAProps) {
  const { t } = useLocale();

  return (
    <div className="text-center py-2">
      <span className="text-[11px] text-muted">
        {listing.is_sold ? t('dealer.statusSold') : listing.is_available ? t('dealer.statusAvailable') : t('dealer.statusInventory')}
      </span>
    </div>
  );
}
