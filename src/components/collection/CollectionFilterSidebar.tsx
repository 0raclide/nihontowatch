'use client';

import type { CollectionFacets, CollectionFilters } from '@/types/collection';
import { CollectionFilterContent } from './CollectionFilterContent';

interface CollectionFilterSidebarProps {
  facets: CollectionFacets;
  filters: CollectionFilters;
  onFilterChange: (filters: Partial<CollectionFilters>) => void;
  totalItems: number;
}

export function CollectionFilterSidebar({ facets, filters, onFilterChange, totalItems }: CollectionFilterSidebarProps) {
  return (
    <div className="hidden lg:block w-[264px] flex-shrink-0">
      <div className="sticky top-24 bg-surface-elevated rounded-2xl border border-border/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col max-h-[calc(100vh-7rem)]">
        <div className="flex-1 overflow-y-auto scrollbar-hide pt-3.5">
          <CollectionFilterContent
            facets={facets}
            filters={filters}
            onFilterChange={onFilterChange}
            totalItems={totalItems}
          />
        </div>
      </div>
    </div>
  );
}
