'use client';

import Link from 'next/link';
import { useState, useCallback, useRef, useEffect } from 'react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { MobileNavDrawer } from './MobileNavDrawer';
import { MobileSearchSheet } from './MobileSearchSheet';
import { useSearch } from '@/hooks/useSearch';
import { SearchSuggestions } from '@/components/search/SearchSuggestions';
import type { SearchSuggestion } from '@/lib/search/types';
import { SEARCH } from '@/lib/constants';

export function Header() {
  const { openSearch, openNavDrawer } = useMobileUI();
  const { query, setQuery, suggestions, total, isLoading, clearSuggestions } =
    useSearch({ maxSuggestions: 5 });

  // Debug: log search state changes
  useEffect(() => {
    console.log('[Search Debug]', { query, suggestions: suggestions.length, total, isLoading });
  }, [query, suggestions, total, isLoading]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Show suggestions when we have query and results
  useEffect(() => {
    if (query.length >= SEARCH.MIN_QUERY_LENGTH && (suggestions.length > 0 || isLoading)) {
      setShowSuggestions(true);
    }
  }, [query, suggestions, isLoading]);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigateToSearch(query.trim());
    }
  };

  const navigateToSearch = (searchQuery: string) => {
    window.location.href = `/browse?q=${encodeURIComponent(searchQuery)}`;
  };

  const handleSelect = useCallback(
    (suggestion: SearchSuggestion) => {
      // Navigate to the listing URL directly
      window.location.href = suggestion.url;
      setShowSuggestions(false);
      clearSuggestions();
    },
    [clearSuggestions]
  );

  const handleViewAll = useCallback(() => {
    if (query.trim()) {
      navigateToSearch(query.trim());
    }
    setShowSuggestions(false);
  }, [query]);

  const handleClose = useCallback(() => {
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  }, []);

  const handleInputFocus = () => {
    if (query.length >= SEARCH.MIN_QUERY_LENGTH && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    const maxIndex = total > suggestions.length ? suggestions.length : suggestions.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
        break;
      case 'Enter':
        if (highlightedIndex >= 0) {
          e.preventDefault();
          if (highlightedIndex < suggestions.length) {
            handleSelect(suggestions[highlightedIndex]);
          } else if (highlightedIndex === suggestions.length) {
            // "View all" option
            handleViewAll();
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-cream dark:bg-gray-900 transition-colors">
        <div className="max-w-[1600px] mx-auto px-4 py-3 lg:px-6 lg:py-5">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-baseline">
              <h1 className="font-serif text-xl tracking-tight text-ink dark:text-white">
                Nihonto<span className="text-gold">watch</span>
              </h1>
            </Link>

            {/* Mobile Actions */}
            <div className="flex items-center gap-1">
              {/* Search Button */}
              <button
                onClick={openSearch}
                className="p-2.5 text-charcoal dark:text-gray-400 hover:text-gold transition-colors"
                aria-label="Search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              {/* Menu Button */}
              <button
                onClick={openNavDrawer}
                className="p-2.5 text-charcoal dark:text-gray-400 hover:text-gold transition-colors"
                aria-label="Menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="group flex items-baseline gap-1">
              <h1 className="font-serif text-2xl tracking-tight text-ink dark:text-white">
                Nihonto<span className="text-gold">watch</span>
              </h1>
            </Link>

            {/* Search */}
            <form
              ref={formRef}
              onSubmit={handleSearch}
              className="flex-1 max-w-sm mx-10 relative"
            >
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={handleInputFocus}
                  onKeyDown={handleKeyDown}
                  placeholder="Search collection..."
                  className="w-full px-4 py-2 bg-linen/50 dark:bg-gray-800/50 border-0 text-[13px] text-ink dark:text-white placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-gold/30 transition-all"
                  role="combobox"
                  aria-expanded={showSuggestions}
                  aria-controls="search-suggestions"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    highlightedIndex >= 0 ? `suggestion-${highlightedIndex}` : undefined
                  }
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/50 hover:text-gold transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>

              {/* Search Suggestions Dropdown */}
              {showSuggestions && (query.length >= SEARCH.MIN_QUERY_LENGTH) && (
                <SearchSuggestions
                  suggestions={suggestions}
                  total={total}
                  isLoading={isLoading}
                  onSelect={handleSelect}
                  onViewAll={handleViewAll}
                  onClose={handleClose}
                  highlightedIndex={highlightedIndex}
                />
              )}
            </form>

            {/* Navigation */}
            <nav className="flex items-center gap-8">
              <Link
                href="/browse"
                className="text-[11px] uppercase tracking-[0.2em] text-charcoal dark:text-gray-400 hover:text-gold transition-colors"
              >
                Browse
              </Link>
              <div className="h-3 w-px bg-border dark:bg-gray-700" />
              <ThemeToggle />
            </nav>
          </div>
        </div>

        {/* Subtle bottom border */}
        <div className="h-px bg-gradient-to-r from-transparent via-border dark:via-gray-800 to-transparent" />
      </header>

      {/* Mobile Drawers */}
      <MobileNavDrawer />
      <MobileSearchSheet />
    </>
  );
}
