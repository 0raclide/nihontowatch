'use client';

import { useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import type { Listing } from '@/types';
import { useDealerStatusChange } from './useDealerStatusChange';
import { ListForSaleModal } from '@/components/dealer/ListForSaleModal';

interface DealerCTAProps {
  listing: Listing;
  onStatusChange?: (status: string, patchedFields?: { price_value?: number | null; price_currency?: string }) => void;
}

/**
 * CTA area for dealer's own listings in QuickView (desktop).
 * Every state gets prominent action buttons — no tiny icons.
 */
export function DealerCTA({ listing, onStatusChange }: DealerCTAProps) {
  const { t } = useLocale();
  const { isUpdating, error, handleStatusChange } = useDealerStatusChange({
    listingId: listing.id,
    onStatusChange,
  });
  const [showPriceModal, setShowPriceModal] = useState(false);

  const status = listing.status?.toUpperCase();
  const isInventory = status === 'INVENTORY' || status === 'WITHDRAWN';
  const isAvailable = status === 'AVAILABLE';
  const isHold = status === 'HOLD';
  const isSold = listing.is_sold;

  const spinner = (
    <span className="flex items-center justify-center gap-2">
      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      {t('common.loading')}
    </span>
  );

  return (
    <div className="py-3 px-1 space-y-2">
      {error && (
        <p className="text-[11px] text-red-500 dark:text-red-400 text-center animate-pulse">{error}</p>
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
            disabled={isUpdating}
            className="w-full py-2.5 rounded-lg bg-gold text-white text-[13px] font-medium disabled:opacity-50 transition-all hover:bg-gold/90 active:scale-[0.98]"
          >
            {isUpdating ? spinner : t('dealer.markSold')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleStatusChange('HOLD')}
              disabled={isUpdating}
              className="flex-1 py-2 rounded-lg border border-border text-[12px] font-medium text-primary disabled:opacity-50 transition-all hover:bg-hover active:scale-[0.98]"
            >
              {t('dealer.putOnHold')}
            </button>
            <button
              onClick={() => handleStatusChange('INVENTORY')}
              disabled={isUpdating}
              className="flex-1 py-2 rounded-lg border border-border text-[12px] font-medium text-muted disabled:opacity-50 transition-all hover:bg-hover active:scale-[0.98]"
            >
              {t('dealer.moveToInventory')}
            </button>
          </div>
        </>
      )}

      {/* Hold: primary "Mark Sold" + secondary row */}
      {isHold && (
        <>
          <button
            onClick={() => handleStatusChange('SOLD')}
            disabled={isUpdating}
            className="w-full py-2.5 rounded-lg bg-gold text-white text-[13px] font-medium disabled:opacity-50 transition-all hover:bg-gold/90 active:scale-[0.98]"
          >
            {isUpdating ? spinner : t('dealer.markSold')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleStatusChange('AVAILABLE')}
              disabled={isUpdating}
              className="flex-1 py-2 rounded-lg border border-border text-[12px] font-medium text-primary disabled:opacity-50 transition-all hover:bg-hover active:scale-[0.98]"
            >
              {t('dealer.relist')}
            </button>
            <button
              onClick={() => handleStatusChange('INVENTORY')}
              disabled={isUpdating}
              className="flex-1 py-2 rounded-lg border border-border text-[12px] font-medium text-muted disabled:opacity-50 transition-all hover:bg-hover active:scale-[0.98]"
            >
              {t('dealer.moveToInventory')}
            </button>
          </div>
        </>
      )}

      {/* Sold: single CTA to relist */}
      {isSold && (
        <button
          onClick={() => handleStatusChange('INVENTORY')}
          disabled={isUpdating}
          className="w-full py-2.5 rounded-lg border border-border text-[13px] font-medium text-primary disabled:opacity-50 transition-all hover:bg-hover active:scale-[0.98]"
        >
          {isUpdating ? spinner : t('dealer.relist')}
        </button>
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
