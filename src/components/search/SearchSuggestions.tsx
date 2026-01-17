'use client';

import { useEffect, useRef } from 'react';
import { SearchResultPreview } from './SearchResultPreview';
import type { SearchSuggestion } from '@/lib/search/types';

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  total: number;
  isLoading: boolean;
  onSelect: (suggestion: SearchSuggestion) => void;
  onViewAll: () => void;
  onClose: () => void;
  highlightedIndex: number;
}

export function SearchSuggestions({
  suggestions,
  total,
  isLoading,
  onSelect,
  onViewAll,
  onClose,
  highlightedIndex,
}: SearchSuggestionsProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && ref.current) {
      const highlightedEl = ref.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      );
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const hasResults = suggestions.length > 0;
  const remainingCount = total - suggestions.length;

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 right-0 mt-1 bg-paper border border-border shadow-lg z-50 overflow-hidden"
      role="listbox"
      aria-label="Search suggestions"
    >
      {/* Loading state */}
      {isLoading && (
        <div className="px-4 py-6 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted">
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-[12px]">Searching...</span>
          </div>
        </div>
      )}

      {/* Results */}
      {!isLoading && hasResults && (
        <>
          <div className="py-1" role="group" aria-label="Suggestions">
            {suggestions.map((suggestion, index) => (
              <div key={suggestion.id} data-index={index}>
                <SearchResultPreview
                  suggestion={suggestion}
                  onClick={() => onSelect(suggestion)}
                  isHighlighted={index === highlightedIndex}
                />
              </div>
            ))}
          </div>

          {/* View all link */}
          {remainingCount > 0 && (
            <div className="border-t border-border/50">
              <button
                onClick={onViewAll}
                className={`w-full px-4 py-2.5 text-[12px] text-center transition-colors ${
                  highlightedIndex === suggestions.length
                    ? 'bg-gold/10 text-gold'
                    : 'text-charcoal hover:bg-hover hover:text-gold'
                }`}
                data-index={suggestions.length}
              >
                View all {total.toLocaleString()} results
              </button>
            </div>
          )}
        </>
      )}

      {/* No results */}
      {!isLoading && !hasResults && (
        <div className="px-4 py-6 text-center">
          <p className="text-[12px] text-muted">
            No results found
          </p>
        </div>
      )}
    </div>
  );
}
