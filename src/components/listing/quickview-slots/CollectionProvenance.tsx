'use client';

import { useLocale } from '@/i18n/LocaleContext';
import type { CollectionItemRow } from '@/types/collectionItem';

interface CollectionProvenanceProps {
  collectionItem?: CollectionItemRow | null;
}

export function CollectionProvenance({ collectionItem }: CollectionProvenanceProps) {
  const { t } = useLocale();

  if (!collectionItem?.status) return null;

  return (
    <div className="px-4 py-3 lg:px-5 border-b border-border space-y-2">
      <div className="flex justify-between text-[14px]">
        <span className="text-muted">{t('collection.status')}</span>
        <span className="text-ink capitalize">{collectionItem.status}</span>
      </div>
    </div>
  );
}
