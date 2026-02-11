'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Drawer } from '@/components/ui/Drawer';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { useActivityOptional } from '@/components/activity/ActivityProvider';

const LISTING_QUICK_SEARCHES = [
  'Katana',
  'Wakizashi',
  'Tanto',
  'Tsuba',
  'Juyo',
  'Tokubetsu Hozon',
];

const ARTIST_QUICK_SEARCHES = [
  'Masamune',
  'Muramasa',
  'Soshu',
  'Bizen',
  'Yamato',
  'Awataguchi',
];

export function MobileSearchSheet() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentQuery = searchParams.get('q') || '';
  const { searchOpen, closeSearch } = useMobileUI();
  const isArtistPage = pathname.startsWith('/artists');
  const searchAction = isArtistPage ? '/artists' : '/';
  const searchPlaceholder = isArtistPage ? 'Search artists by name, kanji, or code...' : 'Search swords, smiths, dealers...';
  const quickSearches = isArtistPage ? ARTIST_QUICK_SEARCHES : LISTING_QUICK_SEARCHES;
  const [isSearching, setIsSearching] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const activity = useActivityOptional();

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

  // Reset searching state when URL changes (navigation completed)
  useEffect(() => {
    setIsSearching(false);
  }, [currentQuery]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (query) {
      // Only show spinner if query is different (otherwise URL won't change and spinner gets stuck)
      if (query !== currentQuery) {
        setIsSearching(true);
      }
      // Track search event
      if (activity) {
        activity.trackSearch(query);
      }
      closeSearch();
      // Use router.push to create history entry (allows back button)
      router.push(`${searchAction}?q=${encodeURIComponent(query)}`);
    }
  };

  const handleQuickSearch = (term: string) => {
    // Only show spinner if query is different (otherwise URL won't change and spinner gets stuck)
    if (term !== currentQuery) {
      setIsSearching(true);
    }
    // Track search event
    if (activity) {
      activity.trackSearch(term);
    }
    closeSearch();
    // Use router.push to create history entry
    router.push(`${searchAction}?q=${encodeURIComponent(term)}`);
  };

  const handleClearInput = () => {
    setInputValue('');
    inputRef.current?.focus();
  };

  return (
    <Drawer isOpen={searchOpen} onClose={closeSearch} title="Search">
      <div className="p-4">
        {/* Search Input - action attribute required for iOS keyboard "Search" button */}
        <form action={searchAction} onSubmit={handleSubmit} role="search">
          <div className="relative">
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              inputMode="search"
              name="q"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={isSearching}
              placeholder={searchPlaceholder}
              className="w-full pl-4 pr-20 py-3.5 bg-linen/50 border border-transparent text-[15px] text-ink placeholder:text-muted/40 rounded-xl focus:outline-none focus:border-gold/40 focus:bg-paper focus:shadow-[0_0_0_4px_rgba(181,142,78,0.1)] transition-all duration-200 disabled:opacity-60"
            />
            {/* Clear button - only show when there's input */}
            {inputValue && !isSearching && (
              <button
                type="button"
                onClick={handleClearInput}
                aria-label="Clear search"
                className="absolute right-12 top-1/2 -translate-y-1/2 p-2 text-muted/40 hover:text-muted rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
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
            {isArtistPage ? 'Popular Artists' : 'Popular Searches'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {quickSearches.map((term) => (
              <button
                key={term}
                onClick={() => handleQuickSearch(term)}
                disabled={isSearching}
                className="px-3.5 py-2.5 text-[13px] bg-linen text-charcoal rounded-lg hover:bg-gold/10 hover:text-gold active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Search tips */}
        <div className="mt-8 p-4 bg-linen/30 rounded-xl">
          <h4 className="text-[11px] uppercase tracking-[0.15em] text-muted mb-2">
            Search Tips
          </h4>
          {isArtistPage ? (
            <ul className="space-y-1.5 text-[12px] text-muted/80">
              <li>By name: &quot;Masamune&quot; or &quot;正宗&quot;</li>
              <li>By school: &quot;Soshu&quot; or &quot;Bizen&quot;</li>
              <li>By code: &quot;MAS590&quot; or &quot;OWA009&quot;</li>
            </ul>
          ) : (
            <ul className="space-y-1.5 text-[12px] text-muted/80">
              <li>Combine: &quot;bizen juyo katana&quot;</li>
              <li>By size: &quot;cm&gt;70&quot; or &quot;nagasa&lt;65&quot;</li>
              <li>By price: &quot;usd&gt;5000&quot; or &quot;eur&lt;2000&quot;</li>
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}
