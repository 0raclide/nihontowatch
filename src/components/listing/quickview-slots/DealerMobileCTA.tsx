'use client';

import { useLocale } from '@/i18n/LocaleContext';
import type { Listing } from '@/types';
import { useDealerStatusChange } from './useDealerStatusChange';

interface DealerMobileCTAProps {
  listing: Listing;
  onStatusChange?: (status: string) => void;
}

/**
 * Mobile CTA area for dealer's own listings.
 * Inventory items get a prominent "List for Sale" button.
 * Available/Sold items show status text.
 */
export function DealerMobileCTA({ listing, onStatusChange }: DealerMobileCTAProps) {
  const { t } = useLocale();
  const { isUpdating, handleStatusChange } = useDealerStatusChange({
    listingId: listing.id,
    onStatusChange,
  });

  const isInventory = !listing.is_available && !listing.is_sold;

  if (isInventory) {
    return (
      <div className="py-2 px-1">
        <button
          onClick={() => handleStatusChange('AVAILABLE')}
          disabled={isUpdating}
          className="w-full py-2.5 rounded-lg bg-gold text-white text-[13px] font-medium disabled:opacity-50 transition-all hover:bg-gold/90 active:scale-[0.98]"
        >
          {isUpdating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t('common.loading')}
            </span>
          ) : (
            t('dealer.listForSale')
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-2">
      <span className="text-[11px] text-muted">
        {listing.is_sold ? t('dealer.statusSold') : t('dealer.statusAvailable')}
      </span>
    </div>
  );
}
