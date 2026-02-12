'use client';

import { SORT_OPTIONS } from '@/lib/collection/labels';

interface CollectionBottomBarProps {
  activeFilterCount: number;
  onOpenFilters: () => void;
  onAddClick: () => void;
  sort: string;
  onSortChange: (sort: string) => void;
}

export function CollectionBottomBar({
  activeFilterCount,
  onOpenFilters,
  onAddClick,
  sort,
  onSortChange,
}: CollectionBottomBarProps) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-cream border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {/* Filters button */}
        <button
          onClick={onOpenFilters}
          className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium text-ink rounded-lg hover:bg-hover transition-colors relative"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-gold rounded-full flex items-center justify-center leading-none">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Add button */}
        <button
          onClick={onAddClick}
          className="flex items-center gap-1.5 px-5 py-2.5 text-[12px] font-medium text-white bg-gold rounded-lg hover:bg-gold-light transition-colors active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>

        {/* Sort select */}
        <div className="flex items-center gap-1 px-3 py-2.5">
          <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            className="text-[12px] font-medium text-ink bg-transparent border-none focus:outline-none cursor-pointer appearance-none pr-4"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
