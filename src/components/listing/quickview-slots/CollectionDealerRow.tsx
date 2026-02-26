'use client';

import { useLocale } from '@/i18n/LocaleContext';
import type { CollectionItem } from '@/types/collection';

interface CollectionDealerRowProps {
  collectionItem?: CollectionItem | null;
}

export function CollectionDealerRow({ collectionItem }: CollectionDealerRowProps) {
  const { t } = useLocale();

  return (
    <div className="flex items-center gap-1.5">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <span data-testid="dealer-name">
        {collectionItem?.acquired_from
          ? `${t('collection.acquiredFrom')} ${collectionItem.acquired_from}`
          : t('collection.personalCollection')}
      </span>
      {collectionItem?.acquired_date && (
        <span className="text-muted/60 ml-1">
          · {new Date(collectionItem.acquired_date).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}
