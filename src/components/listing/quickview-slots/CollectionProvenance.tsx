'use client';

import { useLocale } from '@/i18n/LocaleContext';
import type { CollectionItemRow } from '@/types/collectionItem';

interface CollectionProvenanceProps {
  collectionItem?: CollectionItemRow | null;
}

export function CollectionProvenance({ collectionItem }: CollectionProvenanceProps) {
  const { t } = useLocale();

  if (!collectionItem) return null;

  const hasContent = collectionItem.visibility !== 'private' || collectionItem.status;

  if (!hasContent) return null;

  return (
    <div className="px-4 py-3 lg:px-5 border-b border-border space-y-2">
      {collectionItem.status && (
        <div className="flex justify-between text-[13px]">
          <span className="text-muted">{t('collection.status')}</span>
          <span className="text-ink capitalize">{collectionItem.status}</span>
        </div>
      )}
      {collectionItem.visibility && collectionItem.visibility !== 'private' && (
        <div className="flex justify-between text-[13px]">
          <span className="text-muted">{t('collection.visibility') || 'Visibility'}</span>
          <span className="text-ink capitalize">{collectionItem.visibility}</span>
        </div>
      )}
    </div>
  );
}
