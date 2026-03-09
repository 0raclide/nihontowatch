'use client';

import type { CollectionItemRow } from '@/types/collectionItem';

interface CollectionNotesProps {
  collectionItem?: CollectionItemRow | null;
}

export function CollectionNotes({ collectionItem }: CollectionNotesProps) {
  if (!collectionItem?.personal_notes) return null;

  return (
    <div className="px-4 py-3 lg:px-5 border-b border-border">
      <p className="text-[13px] text-charcoal whitespace-pre-wrap">{collectionItem.personal_notes}</p>
    </div>
  );
}
