'use client';

import { useCallback, useState } from 'react';
import { ShareButton } from '@/components/share/ShareButton';
import { SocialShareButtons } from '@/components/share/SocialShareButtons';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { useLocale } from '@/i18n/LocaleContext';
import type { Listing } from '@/types';
import type { CollectionItem } from '@/types/collection';

interface CollectionActionBarProps {
  listing: Listing;
  collectionItem?: CollectionItem | null;
  onEditCollection?: () => void;
}

export function CollectionActionBar({ listing, collectionItem, onEditCollection }: CollectionActionBarProps) {
  const quickView = useQuickViewOptional();
  const { t } = useLocale();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteCollectionItem = useCallback(async () => {
    if (!collectionItem || !window.confirm(t('collection.confirmDelete'))) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/collection/items?id=${collectionItem.id}`, { method: 'DELETE' });
      if (res.ok) {
        quickView?.onCollectionSaved?.();
        quickView?.closeQuickView();
      }
    } catch {
      // silently fail
    } finally {
      setIsDeleting(false);
    }
  }, [collectionItem, quickView, t]);

  return (
    <>
      {/* Collection: Edit button */}
      {onEditCollection && (
        <button
          onClick={onEditCollection}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-border/50 transition-all duration-200"
          aria-label={t('common.edit')}
          title={t('common.edit')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
        </button>
      )}
      {/* Collection: Delete button */}
      <button
        onClick={handleDeleteCollectionItem}
        disabled={isDeleting}
        className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-red-500 hover:bg-red-50 transition-all duration-200"
        aria-label={t('common.delete')}
        title={t('common.delete')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
      <SocialShareButtons
        path={`/listing/${listing.id}`}
        title={listing.title || 'NihontoWatch'}
        size="sm"
      />
      <ShareButton listingId={listing.id} title={listing.title} size="sm" ogImageUrl={listing.og_image_url} />
    </>
  );
}
