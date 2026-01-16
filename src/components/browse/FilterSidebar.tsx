'use client';

import { FilterContent, FilterContentProps } from './FilterContent';

interface FilterSidebarProps {
  facets: FilterContentProps['facets'];
  filters: FilterContentProps['filters'];
  onFilterChange: FilterContentProps['onFilterChange'];
}

export function FilterSidebar({ facets, filters, onFilterChange }: FilterSidebarProps) {
  return (
    <aside className="hidden lg:block w-56 flex-shrink-0">
      <div className="sticky top-20">
        <FilterContent
          facets={facets}
          filters={filters}
          onFilterChange={onFilterChange}
        />
      </div>
    </aside>
  );
}
