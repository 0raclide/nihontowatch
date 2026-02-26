'use client';

import { useLocale } from '@/i18n/LocaleContext';
import type { CollectionItem } from '@/types/collection';

interface CollectionCTAProps {
  collectionItem?: CollectionItem | null;
  onEditCollection?: () => void;
}

export function CollectionCTA({ collectionItem, onEditCollection }: CollectionCTAProps) {
  const { t } = useLocale();

  return (
    <div className="flex gap-2">
      {/* Collection: Edit button */}
      <button
        onClick={onEditCollection}
        data-testid="cta-button"
        className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-[13px] lg:text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
        {t('common.edit')}
      </button>
      {/* Collection: View Original — only if imported from browse */}
      {collectionItem?.source_listing_id && (
        <a
          href={`/listing/${collectionItem.source_listing_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-charcoal bg-linen hover:bg-hover border border-border rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          {t('collection.viewOriginal')}
        </a>
      )}
    </div>
  );
}
