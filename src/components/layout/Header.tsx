'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { MobileNavDrawer } from './MobileNavDrawer';
import { MobileSearchSheet } from './MobileSearchSheet';

export function Header() {
  const { openSearch, openNavDrawer } = useMobileUI();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get('q') || '';

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchQuery = (formData.get('q') as string) || '';
    if (searchQuery.trim()) {
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
            <form onSubmit={handleSearch} className="flex-1 max-w-sm mx-10">
              <div className="relative">
                <input
                  type="text"
                  name="q"
                  defaultValue={currentQuery}
                  placeholder="Search collection..."
                  className="w-full px-4 py-2 bg-linen/50 border-0 text-[13px] text-ink placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-gold/30 transition-all"
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
            </form>

            {/* Navigation */}
            <nav className="flex items-center gap-8">
              <Link
                href="/browse"
                className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-gold transition-colors"
              >
                Browse
              </Link>
              <div className="h-3 w-px bg-border" />
              <ThemeSwitcher />
            </nav>
          </div>
        </div>

        {/* Subtle bottom border */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </header>

      {/* Mobile Drawers */}
      <MobileNavDrawer />
      <MobileSearchSheet />
    </>
  );
}
