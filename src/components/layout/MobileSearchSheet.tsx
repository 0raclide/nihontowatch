'use client';

import { useState, useRef, useEffect } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { useMobileUI } from '@/contexts/MobileUIContext';

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
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

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

        {/* Quick Searches */}
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
      </div>
    </Drawer>
  );
}
