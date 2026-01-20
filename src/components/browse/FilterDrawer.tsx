'use client';

import { Drawer } from '@/components/ui/Drawer';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { FilterContent, FilterContentProps, AvailabilityStatus } from './FilterContent';

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
  availability?: AvailabilityStatus;
  onAvailabilityChange?: (status: AvailabilityStatus) => void;
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
  availability,
  onAvailabilityChange,
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
        availability={availability}
        onAvailabilityChange={onAvailabilityChange}
      />
    </Drawer>
  );
}
