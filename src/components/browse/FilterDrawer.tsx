'use client';

import { Drawer } from '@/components/ui/Drawer';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { FilterContent, FilterContentProps } from './FilterContent';

type Currency = 'USD' | 'JPY' | 'EUR';

interface FilterDrawerProps {
  facets: FilterContentProps['facets'];
  filters: FilterContentProps['filters'];
  onFilterChange: FilterContentProps['onFilterChange'];
  isUpdating?: boolean;
  sort?: string;
  onSortChange?: (sort: string) => void;
  currency?: Currency;
  onCurrencyChange?: (currency: Currency) => void;
}

export function FilterDrawer({
  facets,
  filters,
  onFilterChange,
  isUpdating,
  sort,
  onSortChange,
  currency,
  onCurrencyChange,
}: FilterDrawerProps) {
  const { filterDrawerOpen, closeFilterDrawer } = useMobileUI();

  return (
    <Drawer isOpen={filterDrawerOpen} onClose={closeFilterDrawer}>
      <FilterContent
        facets={facets}
        filters={filters}
        onFilterChange={onFilterChange}
        onClose={closeFilterDrawer}
        isUpdating={isUpdating}
        sort={sort}
        onSortChange={onSortChange}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
      />
    </Drawer>
  );
}
