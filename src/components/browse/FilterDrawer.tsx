'use client';

import { Drawer } from '@/components/ui/Drawer';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { FilterContent, FilterContentProps } from './FilterContent';

interface FilterDrawerProps {
  facets: FilterContentProps['facets'];
  filters: FilterContentProps['filters'];
  onFilterChange: FilterContentProps['onFilterChange'];
}

export function FilterDrawer({ facets, filters, onFilterChange }: FilterDrawerProps) {
  const { filterDrawerOpen, closeFilterDrawer } = useMobileUI();

  return (
    <Drawer isOpen={filterDrawerOpen} onClose={closeFilterDrawer} title="Filters">
      <FilterContent
        facets={facets}
        filters={filters}
        onFilterChange={onFilterChange}
        onClose={closeFilterDrawer}
      />
    </Drawer>
  );
}
