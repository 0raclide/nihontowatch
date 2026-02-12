'use client';

import { Drawer } from '@/components/ui/Drawer';
import { CollectionFilterContent } from './CollectionFilterContent';
import type { CollectionFacets, CollectionFilters } from '@/types/collection';

interface CollectionFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  facets: CollectionFacets;
  filters: CollectionFilters;
  onFilterChange: (filters: Partial<CollectionFilters>) => void;
  totalItems: number;
}

export function CollectionFilterDrawer({
  isOpen,
  onClose,
  facets,
  filters,
  onFilterChange,
  totalItems,
}: CollectionFilterDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Filters">
      <CollectionFilterContent
        facets={facets}
        filters={filters}
        onFilterChange={onFilterChange}
        totalItems={totalItems}
        onClose={onClose}
      />
    </Drawer>
  );
}
