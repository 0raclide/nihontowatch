'use client';

import { useCallback, useState } from 'react';
import { ShareButton } from '@/components/share/ShareButton';
import { SocialShareButtons } from '@/components/share/SocialShareButtons';
import { useLocale } from '@/i18n/LocaleContext';
import type { Listing } from '@/types';
import type { CollectionItemRow, CollectionVisibility } from '@/types/collectionItem';

const VISIBILITY_OPTIONS: { value: CollectionVisibility; labelKey: string }[] = [
  { value: 'private', labelKey: 'collection.visibility.private' },
  { value: 'collectors', labelKey: 'collection.visibility.collectors' },
  { value: 'dealers', labelKey: 'collection.visibility.dealers' },
];

interface CollectionActionBarProps {
  listing: Listing;
  collectionItem?: CollectionItemRow | null;
  onEditCollection?: () => void;
}

export function CollectionActionBar({ listing, collectionItem, onEditCollection }: CollectionActionBarProps) {
  const { t } = useLocale();
  const [visibility, setVisibility] = useState<CollectionVisibility>(collectionItem?.visibility ?? 'private');
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);

  const handleVisibilityChange = useCallback(async (newVisibility: CollectionVisibility) => {
    if (!collectionItem || newVisibility === visibility) return;
    setVisibility(newVisibility);
    setIsSavingVisibility(true);
    try {
      const res = await fetch(`/api/collection/items/${collectionItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });
      if (!res.ok) {
        setVisibility(visibility); // revert on failure
      }
    } catch {
      setVisibility(visibility); // revert on failure
    } finally {
      setIsSavingVisibility(false);
    }
  }, [collectionItem, visibility]);

  return (
    <>
      {/* Visibility selector */}
      {collectionItem && (
        <div className="flex items-center gap-0.5 rounded-full bg-border/30 p-0.5">
          {VISIBILITY_OPTIONS.map(({ value, labelKey }) => (
            <button
              key={value}
              onClick={() => handleVisibilityChange(value)}
              disabled={isSavingVisibility}
              className={`px-2.5 py-1 text-[11px] rounded-full transition-all duration-200 ${
                visibility === value
                  ? 'bg-cream text-ink shadow-sm font-medium'
                  : 'text-muted hover:text-ink'
              }`}
              title={t(labelKey)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      )}
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
      <SocialShareButtons
        path={`/listing/${listing.id}`}
        title={listing.title || 'NihontoWatch'}
        size="sm"
      />
      <ShareButton listingId={listing.id} title={listing.title} size="sm" ogImageUrl={listing.og_image_url} />
    </>
  );
}
