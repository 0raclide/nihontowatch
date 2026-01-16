'use client';

import { useRef, useEffect } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { useSearch } from '@/hooks/useSearch';
import { SearchResultPreview } from '@/components/search/SearchResultPreview';
import type { SearchSuggestion } from '@/lib/search/types';
import { SEARCH } from '@/lib/constants';

const QUICK_SEARCHES = [
  'Katana',
  'Wakizashi',
  'Tanto',
  'Tsuba',
  'Juyo',
  'Tokubetsu Hozon',
];

export function MobileSearchSheet() {
  const { searchOpen, closeSearch } = useMobileUI();
  const { query, setQuery, suggestions, total, isLoading, clearSuggestions } =
    useSearch({ maxSuggestions: 5 });
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  // Clear search when closing
  useEffect(() => {
    if (!searchOpen) {
      setQuery('');
      clearSuggestions();
    }
  }, [searchOpen, setQuery, clearSuggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/browse?q=${encodeURIComponent(query.trim())}`;
      closeSearch();
    }
  };

  const handleQuickSearch = (term: string) => {
    window.location.href = `/browse?q=${encodeURIComponent(term)}`;
    closeSearch();
  };

  const handleSelect = (suggestion: SearchSuggestion) => {
    window.location.href = suggestion.url;
    closeSearch();
  };

  const handleViewAll = () => {
    if (query.trim()) {
      window.location.href = `/browse?q=${encodeURIComponent(query.trim())}`;
      closeSearch();
    }
  };

  const showSuggestions = query.length >= SEARCH.MIN_QUERY_LENGTH;
  const hasResults = suggestions.length > 0;
  const remainingCount = total - suggestions.length;

  return (
    <Drawer isOpen={searchOpen} onClose={closeSearch} title="Search">
      <div className="p-4">
        {/* Search Input */}
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search collection..."
              className="w-full px-4 py-3 bg-linen/50 dark:bg-gray-800/50 border-0 text-[15px] text-ink dark:text-white placeholder:text-muted/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted/70 hover:text-gold transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>

        {/* Instant Results */}
        {showSuggestions && (
          <div className="mt-4">
            {/* Loading state */}
            {isLoading && (
              <div className="py-8 flex items-center justify-center">
                <div className="flex items-center gap-2 text-muted dark:text-gray-500">
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
                  <span className="text-[13px]">Searching...</span>
                </div>
              </div>
            )}

            {/* Results */}
            {!isLoading && hasResults && (
              <div className="border border-border/50 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                <div className="divide-y divide-border/30 dark:divide-gray-800">
                  {suggestions.map((suggestion) => (
                    <SearchResultPreview
                      key={suggestion.id}
                      suggestion={suggestion}
                      onClick={() => handleSelect(suggestion)}
                    />
                  ))}
                </div>

                {/* View all link */}
                {remainingCount > 0 && (
                  <button
                    onClick={handleViewAll}
                    className="w-full px-4 py-3 text-[13px] text-center text-charcoal dark:text-gray-400 border-t border-border/50 dark:border-gray-800 hover:bg-linen/50 dark:hover:bg-gray-800/50 hover:text-gold transition-colors"
                  >
                    View all {total.toLocaleString()} results
                  </button>
                )}
              </div>
            )}

            {/* No results */}
            {!isLoading && !hasResults && (
              <div className="py-8 text-center">
                <p className="text-[13px] text-muted dark:text-gray-500">
                  No results found for &quot;{query}&quot;
                </p>
              </div>
            )}
          </div>
        )}

        {/* Quick Searches - only show when not actively searching */}
        {!showSuggestions && (
          <div className="mt-6">
            <h3 className="text-[11px] uppercase tracking-[0.15em] text-muted dark:text-gray-500 mb-3">
              Popular Searches
            </h3>
            <div className="flex flex-wrap gap-2">
              {QUICK_SEARCHES.map((term) => (
                <button
                  key={term}
                  onClick={() => handleQuickSearch(term)}
                  className="px-3 py-2 text-[13px] bg-linen dark:bg-gray-800 text-charcoal dark:text-gray-300 rounded-lg hover:bg-gold/10 hover:text-gold transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
