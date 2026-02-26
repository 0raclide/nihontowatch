'use client';

import { useLocale } from '@/i18n/LocaleContext';
import type { CollectionItem } from '@/types/collection';

interface CollectionProvenanceProps {
  collectionItem?: CollectionItem | null;
}

export function CollectionProvenance({ collectionItem }: CollectionProvenanceProps) {
  const { t } = useLocale();

  if (!collectionItem) return null;

  const hasContent = collectionItem.price_paid != null ||
    collectionItem.current_value != null ||
    collectionItem.condition ||
    collectionItem.status;

  if (!hasContent) return null;

  return (
    <div className="px-4 py-3 lg:px-5 border-b border-border space-y-2">
      {collectionItem.price_paid != null && (
        <div className="flex justify-between text-[13px]">
          <span className="text-muted">{t('collection.pricePaid')}</span>
          <span className="text-ink font-medium">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: collectionItem.price_paid_currency || 'USD',
              minimumFractionDigits: 0,
            }).format(collectionItem.price_paid)}
          </span>
        </div>
      )}
      {collectionItem.current_value != null && (
        <div className="flex justify-between text-[13px]">
          <span className="text-muted">{t('collection.currentValue')}</span>
          <span className="text-ink font-medium">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: collectionItem.current_value_currency || 'USD',
              minimumFractionDigits: 0,
            }).format(collectionItem.current_value)}
          </span>
        </div>
      )}
      {collectionItem.condition && (
        <div className="flex justify-between text-[13px]">
          <span className="text-muted">{t('collection.condition')}</span>
          <span className="text-ink capitalize">{collectionItem.condition}</span>
        </div>
      )}
      {collectionItem.status && (
        <div className="flex justify-between text-[13px]">
          <span className="text-muted">{t('collection.status')}</span>
          <span className="text-ink capitalize">{collectionItem.status}</span>
        </div>
      )}
    </div>
  );
}
