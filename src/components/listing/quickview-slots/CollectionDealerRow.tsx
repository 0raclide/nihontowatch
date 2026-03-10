'use client';

import { useCallback, useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { useQuickView } from '@/contexts/QuickViewContext';
import type { CollectionItemRow } from '@/types/collectionItem';

interface CollectionDealerRowProps {
  collectionItem?: CollectionItemRow | null;
}

export function CollectionDealerRow({ collectionItem }: CollectionDealerRowProps) {
  const { t } = useLocale();
  const { openQuickView } = useQuickView();
  const [loading, setLoading] = useState(false);

  const handleViewOriginal = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!collectionItem?.source_listing_id || loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/listing/${collectionItem.source_listing_id}`);
      if (!res.ok) return;
      const data = await res.json();
      openQuickView(data, { skipFetch: true, source: 'browse' });
    } finally {
      setLoading(false);
    }
  }, [collectionItem?.source_listing_id, loading, openQuickView]);

  return (
    <div className="flex items-center gap-1.5">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <span data-testid="dealer-name">
        {t('collection.personalCollection')}
      </span>
      {collectionItem?.source_listing_id && (
        <button
          onClick={handleViewOriginal}
          disabled={loading}
          className={`text-gold hover:text-gold-light ml-1 text-[12px] ${loading ? 'opacity-60' : ''}`}
        >
          ({loading ? '...' : t('collection.viewOriginal')})
        </button>
      )}
    </div>
  );
}
