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
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    // Reset searching state when opened
    if (searchOpen) {
      setIsSearching(false);
    }
  }, [searchOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = (formData.get('q') as string) || '';
    if (query.trim()) {
      setIsSearching(true);
      window.location.href = `/?q=${encodeURIComponent(query.trim())}`;
    }
  };

  const handleQuickSearch = (term: string) => {
    setIsSearching(true);
    window.location.href = `/?q=${encodeURIComponent(term)}`;
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
              name="q"
              disabled={isSearching}
              placeholder="Search swords, smiths, dealers..."
              className="w-full pl-4 pr-12 py-3.5 bg-linen/50 dark:bg-gray-800/50 border border-transparent text-[15px] text-ink dark:text-white placeholder:text-muted/40 rounded-xl focus:outline-none focus:border-gold/40 focus:bg-white dark:focus:bg-gray-800 focus:shadow-[0_0_0_4px_rgba(181,142,78,0.1)] transition-all duration-200 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted/50 hover:text-gold hover:bg-gold/5 rounded-lg transition-all duration-150 disabled:pointer-events-none"
            >
              {isSearching ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>
          </div>
        </form>

        {/* Quick Searches */}
        <div className="mt-6">
          <h3 className="text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            Popular Searches
          </h3>
          <div className="flex flex-wrap gap-2">
            {QUICK_SEARCHES.map((term) => (
              <button
                key={term}
                onClick={() => handleQuickSearch(term)}
                disabled={isSearching}
                className="px-3.5 py-2.5 text-[13px] bg-linen dark:bg-gray-800 text-charcoal dark:text-gray-200 rounded-lg hover:bg-gold/10 hover:text-gold active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Search tips */}
        <div className="mt-8 p-4 bg-linen/30 dark:bg-gray-800/30 rounded-xl">
          <h4 className="text-[11px] uppercase tracking-[0.15em] text-muted mb-2">
            Search Tips
          </h4>
          <ul className="space-y-1.5 text-[12px] text-muted/80">
            <li>Search by smith name: "Masamune", "Sadamune"</li>
            <li>Search by type: "katana", "wakizashi", "tsuba"</li>
            <li>Search by certification: "Juyo", "Tokubetsu Hozon"</li>
          </ul>
        </div>
      </div>
    </Drawer>
  );
}
