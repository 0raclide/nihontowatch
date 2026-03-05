'use client';

import { useLocale } from '@/i18n/LocaleContext';
import type { Listing } from '@/types';

interface DealerCTAProps {
  listing: Listing;
}

/**
 * CTA area for dealer's own listings in QuickView.
 * Shows simple stats instead of "Visit Dealer" button.
 */
export function DealerCTA({ listing }: DealerCTAProps) {
  const { t } = useLocale();

  return (
    <div className="text-center py-3">
      <span className="text-[11px] text-muted">
        {listing.is_sold ? t('dealer.statusSold') : listing.is_available ? t('dealer.statusAvailable') : t('dealer.statusInventory')}
      </span>
    </div>
  );
}
