'use client';

import { useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import type { CollectionItemRow } from '@/types/collectionItem';
import { PromoteToListingModal } from '@/components/dealer/PromoteToListingModal';

interface CollectionCTAProps {
  collectionItem?: CollectionItemRow | null;
  onPromoted?: (listingId: number) => void;
}

export function CollectionCTA({ collectionItem, onPromoted }: CollectionCTAProps) {
  const { t } = useLocale();
  const { isDealer } = useSubscription();
  const [showPromoteModal, setShowPromoteModal] = useState(false);

  // Only render for dealers — collectors have no CTA buttons
  if (!isDealer || !collectionItem) return null;

  return (
    <div className="space-y-2">
      {/* List for Sale — dealer-tier users only */}
      <button
        onClick={() => setShowPromoteModal(true)}
        className="w-full py-2 rounded-lg border border-border text-[12px] font-medium text-primary transition-all hover:bg-hover active:scale-[0.98]"
      >
        {t('dealer.listForSale')}
      </button>

      <PromoteToListingModal
        isOpen={showPromoteModal}
        onClose={() => setShowPromoteModal(false)}
        collectionItemId={collectionItem.id}
        currentPrice={collectionItem.price_value}
        currentCurrency={collectionItem.price_currency}
        onSuccess={(listingId) => {
          setShowPromoteModal(false);
          onPromoted?.(listingId);
          window.dispatchEvent(new CustomEvent('collection-item-promoted', { detail: { listingId, collectionItemId: collectionItem.id } }));
        }}
      />
    </div>
  );
}
