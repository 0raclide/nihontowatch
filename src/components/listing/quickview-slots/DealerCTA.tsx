'use client';

import { useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import type { Listing } from '@/types';
import { useDealerStatusChange } from './useDealerStatusChange';
import { useDelistAction } from './useDelistAction';
import { ListForSaleModal } from '@/components/dealer/ListForSaleModal';

interface DealerCTAProps {
  listing: Listing;
  onStatusChange?: (status: string, patchedFields?: { price_value?: number | null; price_currency?: string }) => void;
  onDelisted?: () => void;
}

/**
 * CTA area for dealer's own listings in QuickView (desktop).
 * Every state gets prominent action buttons — no tiny icons.
 */
export function DealerCTA({ listing, onStatusChange, onDelisted }: DealerCTAProps) {
  const { t } = useLocale();
  const { isUpdating, error, handleStatusChange } = useDealerStatusChange({
    listingId: listing.id,
    onStatusChange,
  });
  const { isDelisting, delistError, handleDelist } = useDelistAction({
    listingId: listing.id,
    onDelisted,
  });
  const [showPriceModal, setShowPriceModal] = useState(false);

  const status = listing.status?.toUpperCase();
  const isInventory = status === 'INVENTORY' || status === 'WITHDRAWN';
  const isAvailable = status === 'AVAILABLE';
  const isHold = status === 'HOLD';
  const isSold = listing.is_sold;
  const canDelist = !!listing.item_uuid && (isAvailable || isHold || isSold);

  const spinner = (
    <span className="flex items-center justify-center gap-2">
      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      {t('common.loading')}
    </span>
  );

  return (
    <div className="py-3 px-1 space-y-2">
      {(error || delistError) && (
        <p className="text-[11px] text-red-500 dark:text-red-400 text-center animate-pulse">{error || delistError}</p>
      )}

      {/* Inventory: open price modal to list for sale */}
      {isInventory && (
        <button
          onClick={() => setShowPriceModal(true)}
          disabled={isUpdating}
          className="w-full py-2.5 rounded-lg bg-gold text-white text-[13px] font-medium disabled:opacity-50 transition-all hover:bg-gold/90 active:scale-[0.98]"
        >
          {isUpdating ? spinner : t('dealer.listForSale')}
        </button>
      )}

      {/* For Sale: primary "Mark Sold" + secondary row */}
      {isAvailable && (
        <>
          <button
            onClick={() => handleStatusChange('SOLD')}
            disabled={isUpdating || isDelisting}
            className="w-full py-2.5 rounded-lg bg-gold text-white text-[13px] font-medium disabled:opacity-50 transition-all hover:bg-gold/90 active:scale-[0.98]"
          >
            {isUpdating ? spinner : t('dealer.markSold')}
          </button>
          <button
            onClick={() => handleStatusChange('HOLD')}
            disabled={isUpdating || isDelisting}
            className="w-full py-2 rounded-lg border border-border text-[12px] font-medium text-primary disabled:opacity-50 transition-all hover:bg-hover active:scale-[0.98]"
          >
            {t('dealer.putOnHold')}
          </button>
          {canDelist && (
            <button
              onClick={handleDelist}
              disabled={isUpdating || isDelisting}
              className="w-full py-2 rounded-lg border border-border/50 text-[11px] font-medium text-muted disabled:opacity-50 transition-all hover:bg-hover active:scale-[0.98]"
            >
              {isDelisting ? spinner : t('dealer.returnToVault')}
            </button>
          )}
        </>
      )}

      {/* Hold: primary "Mark Sold" + secondary row */}
      {isHold && (
        <>
          <button
            onClick={() => handleStatusChange('SOLD')}
            disabled={isUpdating || isDelisting}
            className="w-full py-2.5 rounded-lg bg-gold text-white text-[13px] font-medium disabled:opacity-50 transition-all hover:bg-gold/90 active:scale-[0.98]"
          >
            {isUpdating ? spinner : t('dealer.markSold')}
          </button>
          <button
            onClick={() => handleStatusChange('AVAILABLE')}
            disabled={isUpdating || isDelisting}
            className="w-full py-2 rounded-lg border border-border text-[12px] font-medium text-primary disabled:opacity-50 transition-all hover:bg-hover active:scale-[0.98]"
          >
            {t('dealer.relist')}
          </button>
          {canDelist && (
            <button
              onClick={handleDelist}
              disabled={isUpdating || isDelisting}
              className="w-full py-2 rounded-lg border border-border/50 text-[11px] font-medium text-muted disabled:opacity-50 transition-all hover:bg-hover active:scale-[0.98]"
            >
              {isDelisting ? spinner : t('dealer.returnToVault')}
            </button>
          )}
        </>
      )}

      {/* Sold: relist (back to For Sale) + return to vault */}
      {isSold && (
        <>
          <button
            onClick={() => setShowPriceModal(true)}
            disabled={isUpdating || isDelisting}
            className="w-full py-2.5 rounded-lg bg-gold text-white text-[13px] font-medium disabled:opacity-50 transition-all hover:bg-gold/90 active:scale-[0.98]"
          >
            {t('dealer.relist')}
          </button>
          {canDelist && (
            <button
              onClick={handleDelist}
              disabled={isUpdating || isDelisting}
              className="w-full py-2 rounded-lg border border-border/50 text-[11px] font-medium text-muted disabled:opacity-50 transition-all hover:bg-hover active:scale-[0.98]"
            >
              {isDelisting ? spinner : t('dealer.returnToVault')}
            </button>
          )}
        </>
      )}

      <ListForSaleModal
        isOpen={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        listingId={listing.id}
        currentPrice={listing.price_value}
        currentCurrency={listing.price_currency}
        onSuccess={(newStatus, patchedFields) => {
          onStatusChange?.(newStatus, patchedFields);
        }}
      />
    </div>
  );
}
