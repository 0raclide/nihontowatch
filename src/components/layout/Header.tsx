'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { MobileNavDrawer } from './MobileNavDrawer';
import { MobileSearchSheet } from './MobileSearchSheet';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { UserMenu } from '@/components/auth/UserMenu';
import { useActivityOptional } from '@/components/activity/ActivityProvider';

export function Header() {
  const { openSearch, openNavDrawer } = useMobileUI();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get('q') || '';
  const { user, isLoading: authLoading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const activity = useActivityOptional();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchQuery = (formData.get('q') as string) || '';
    if (searchQuery.trim()) {
      setIsSearching(true);
      // Track search event
      if (activity) {
        activity.trackSearch(searchQuery.trim());
      }
      window.location.href = `/?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-cream transition-colors">
        <div className="max-w-[1600px] mx-auto px-4 py-3 lg:px-6 lg:py-5">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-baseline">
              <h1 className="font-serif text-xl tracking-tight text-ink">
                Nihonto<span className="text-gold">watch</span>
              </h1>
            </Link>

            {/* Mobile Actions */}
            <div className="flex items-center gap-1">
              {/* Search Button */}
              <button
                onClick={openSearch}
                className="p-2.5 text-muted hover:text-gold transition-colors"
                aria-label="Search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              {/* Menu Button */}
              <button
                onClick={openNavDrawer}
                className="p-2.5 text-muted hover:text-gold transition-colors"
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
              <h1 className="font-serif text-2xl tracking-tight text-ink">
                Nihonto<span className="text-gold">watch</span>
              </h1>
            </Link>

            {/* Search - Simple form */}
            <form onSubmit={handleSearch} className="flex-1 max-w-md mx-10 group">
              <div className="relative">
                <input
                  type="text"
                  name="q"
                  defaultValue={currentQuery}
                  placeholder="Search swords, smiths, dealers..."
                  disabled={isSearching}
                  className="w-full pl-4 pr-12 py-2.5 bg-linen/50 dark:bg-gray-800/50 border border-transparent text-[13px] text-ink dark:text-white placeholder:text-muted/40 focus:outline-none focus:border-gold/40 focus:bg-white dark:focus:bg-gray-800 focus:shadow-[0_0_0_3px_rgba(181,142,78,0.1)] transition-all duration-200 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted/50 hover:text-gold hover:bg-gold/5 rounded transition-all duration-150 disabled:pointer-events-none"
                >
                  {isSearching ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </button>
                {/* Keyboard hint */}
                <div className="absolute right-12 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 opacity-0 group-focus-within:opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-muted/40 bg-linen/80 dark:bg-gray-700/50 rounded">Enter</kbd>
                </div>
              </div>
            </form>

            {/* Navigation */}
            <nav className="flex items-center gap-6">
              <Link
                href="/browse"
                className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-gold transition-colors"
              >
                Browse
              </Link>
              <Link
                href="/alerts"
                className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-gold transition-colors"
              >
                Alerts
              </Link>
              <div className="h-3 w-px bg-border" />
              <ThemeSwitcher />
              <div className="h-3 w-px bg-border" />
              {/* Auth: Login button or User menu */}
              {authLoading ? (
                <div className="w-8 h-8 rounded-full bg-linen/50 dark:bg-gray-800 animate-pulse" />
              ) : user ? (
                <UserMenu />
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-gold transition-colors"
                >
                  Sign In
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Subtle bottom border */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </header>

      {/* Mobile Drawers */}
      <MobileNavDrawer />
      <MobileSearchSheet />

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  );
}
