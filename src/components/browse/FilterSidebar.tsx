'use client';

import { useCallback, useRef } from 'react';
import { FilterContent, FilterContentProps } from './FilterContent';

interface FilterSidebarProps {
  facets: FilterContentProps['facets'];
  filters: FilterContentProps['filters'];
  onFilterChange: FilterContentProps['onFilterChange'];
  isAdmin?: boolean;
}

export function FilterSidebar({ facets, filters, onFilterChange, isAdmin }: FilterSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Prevent scroll events from propagating to the page when at scroll boundaries
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const atTop = scrollTop === 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

    // If scrolling up at the top, or scrolling down at the bottom, prevent propagation
    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
      e.preventDefault();
    }
  }, []);

  return (
    <aside className="hidden lg:block w-60 flex-shrink-0">
      <div className="sticky top-20">
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          className="max-h-[calc(100vh-6rem)] overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent pr-5"
        >
          <FilterContent
            facets={facets}
            filters={filters}
            onFilterChange={onFilterChange}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </aside>
  );
}
