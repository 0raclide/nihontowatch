'use client';

import type { CollectionItem } from '@/types/collection';

interface CollectionNotesProps {
  collectionItem?: CollectionItem | null;
}

export function CollectionNotes({ collectionItem }: CollectionNotesProps) {
  if (!collectionItem?.notes) return null;

  return (
    <div className="px-4 py-3 lg:px-5 border-b border-border">
      <p className="text-[13px] text-charcoal whitespace-pre-wrap">{collectionItem.notes}</p>
    </div>
  );
}
