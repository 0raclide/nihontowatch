'use client';

import { useLocale } from '@/i18n/LocaleContext';
import type { CollectionItemRow } from '@/types/collectionItem';

interface CollectionDealerRowProps {
  collectionItem?: CollectionItemRow | null;
}

export function CollectionDealerRow({ collectionItem }: CollectionDealerRowProps) {
  const { t } = useLocale();

  return (
    <div className="flex items-center gap-1.5">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <span data-testid="dealer-name">
        {t('collection.personalCollection')}
      </span>
      {collectionItem?.source_listing_id && (
        <a
          href={`/listing/${collectionItem.source_listing_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold hover:text-gold-light ml-1 text-[12px]"
        >
          ({t('collection.viewOriginal')})
        </a>
      )}
    </div>
  );
}
