'use client';

import type { CollectionItem } from '@/types/collection';
import { CollectionCard } from './CollectionCard';
import { AddItemCard } from './AddItemCard';

interface CollectionGridProps {
  items: CollectionItem[];
  onItemClick: (item: CollectionItem) => void;
  onItemEdit: (item: CollectionItem) => void;
  onAddClick: () => void;
}

export function CollectionGrid({ items, onItemClick, onItemEdit, onAddClick }: CollectionGridProps) {
  if (items.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        <AddItemCard onClick={onAddClick} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
      {items.map(item => (
        <CollectionCard
          key={item.id}
          item={item}
          onClick={onItemClick}
          onEdit={onItemEdit}
        />
      ))}
      <AddItemCard onClick={onAddClick} />
    </div>
  );
}
