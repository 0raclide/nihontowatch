'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { useMobileUI } from '@/contexts/MobileUIContext';
import { MobileNavDrawer } from './MobileNavDrawer';
import { MobileSearchSheet } from './MobileSearchSheet';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { UserMenu } from '@/components/auth/UserMenu';
import { useActivityOptional } from '@/components/activity/ActivityProvider';

function HeaderContent() {
  // Note: useMobileUI is imported but openSearch/openNavDrawer are used by MobileNavDrawer/MobileSearchSheet
  useMobileUI(); // Keep context active for child components
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentQuery = searchParams.get('q') || '';
  const loginParam = searchParams.get('login');
  const { user, profile, isLoading: authLoading, isAdmin } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Reset searching state when URL changes (navigation completed)
  useEffect(() => {
    setIsSearching(false);
  }, [currentQuery]);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const activity = useActivityOptional();

  // ── Scroll-linked header: moves with scroll, snaps when idle ──
  // Refinements: progressive shadow, scroll-up hysteresis, asymmetric snap,
  // will-change GPU hint, prefers-reduced-motion respect.
  const lastScrollY = useRef(0);
  const offsetRef = useRef(0);
  const upAccum = useRef(0);        // accumulates upward scroll before reveal starts
  const snapTimer = useRef<number | null>(null);

  useEffect(() => {
    const TOP_ZONE = 100;           // always show near top of page
    const UP_DEAD_ZONE = 12;        // px of upward scroll before reveal begins
    const SNAP_OPEN_RATIO = 0.35;   // snap open when 35%+ revealed (eager to help)
    const SNAP_CLOSE_RATIO = 0.65;  // snap closed when 65%+ hidden (hard to dismiss)

    // Respect prefers-reduced-motion — skip scroll-linked behavior entirely
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const header = headerRef.current;
    if (header) header.style.willChange = 'transform';

    /** Update shadow + backdrop blur proportional to reveal amount */
    const applyDepth = (offset: number, h: number, scrollY: number) => {
      if (!header) return;
      // Progress: 0 = fully hidden, 1 = fully visible
      const progress = 1 - Math.abs(offset) / h;
      // Only show depth when scrolled past the natural header position
      const scrollFactor = Math.min(1, scrollY / 200);
      const depth = progress * scrollFactor;
      header.style.boxShadow = depth > 0.05
        ? `0 1px ${4 + depth * 8}px rgba(0,0,0,${depth * 0.08})`
        : 'none';
      header.style.backdropFilter = depth > 0.05 ? `blur(${depth * 12}px)` : 'none';
      // Slight background opacity when floating (lets content peek through)
      if (depth > 0.05) {
        header.style.backgroundColor = '';  // let CSS class handle base color
      }
    };

    const onScroll = () => {
      if (!header) return;

      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      const h = header.offsetHeight;

      // Always show near page top — ease back with transition
      if (y < TOP_ZONE) {
        if (offsetRef.current !== 0) {
          offsetRef.current = 0;
          header.style.transition = 'transform 0.3s ease-out, box-shadow 0.3s ease-out, backdrop-filter 0.3s ease-out';
          header.style.transform = 'translateY(0)';
        }
        applyDepth(0, h, y);
        upAccum.current = 0;
        lastScrollY.current = y;
        return;
      }

      // Don't hide while search input (or other header element) is focused
      if (header.contains(document.activeElement)) {
        lastScrollY.current = y;
        return;
      }

      // ── Scroll-up hysteresis ──
      // Require UP_DEAD_ZONE of intentional upward scroll before reveal starts.
      // Prevents twitching from scroll-inertia micro-reversals.
      if (delta < 0 && offsetRef.current <= -h) {
        // Header is fully hidden and user is scrolling up
        upAccum.current += Math.abs(delta);
        if (upAccum.current < UP_DEAD_ZONE) {
          lastScrollY.current = y;
          return; // swallow — not enough intent yet
        }
        // Past threshold — fall through to normal movement
      }
      if (delta > 0) {
        upAccum.current = 0; // reset on any downward scroll
      }

      // Move header pixel-by-pixel — no transition, feels physical
      header.style.transition = 'none';
      offsetRef.current = Math.max(-h, Math.min(0, offsetRef.current - delta));
      header.style.transform = `translateY(${offsetRef.current}px)`;
      applyDepth(offsetRef.current, h, y);

      // ── Asymmetric snap on idle ──
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = window.setTimeout(() => {
        const revealed = 1 - Math.abs(offsetRef.current) / h;
        header.style.transition = 'transform 0.25s ease-out, box-shadow 0.25s ease-out, backdrop-filter 0.25s ease-out';
        if (revealed < SNAP_OPEN_RATIO) {
          // Not enough revealed → snap closed
          offsetRef.current = -h;
          header.style.transform = `translateY(${-h}px)`;
          applyDepth(-h, h, y);
        } else if (revealed > SNAP_CLOSE_RATIO) {
          // Mostly revealed → snap open
          offsetRef.current = 0;
          header.style.transform = 'translateY(0)';
          applyDepth(0, h, window.scrollY);
        }
        // Between thresholds: stay put (prevents indecisive snapping)
      }, 150);

      lastScrollY.current = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (snapTimer.current) clearTimeout(snapTimer.current);
      if (header) header.style.willChange = '';
    };
  }, []);

  // Stable callback for closing login modal (prevents re-render loops)
  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  // Handle login redirect from admin pages
  useEffect(() => {
    if (loginParam === 'admin' && !user && !authLoading) {
      setShowLoginModal(true);
      // Clean up URL
      router.replace('/');
    }
  }, [loginParam, user, authLoading, router]);

  // Close admin menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setShowAdminMenu(false);
      }
    };
    if (showAdminMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAdminMenu]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchQuery = (formData.get('q') as string) || '';
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      // Only show spinner if query is different (otherwise URL won't change and spinner gets stuck)
      if (trimmedQuery !== currentQuery) {
        setIsSearching(true);
      }
      // Track search event
      if (activity) {
        activity.trackSearch(trimmedQuery);
      }
      // Use router.push to create history entry (allows back button)
      router.push(`/?q=${encodeURIComponent(trimmedQuery)}`);
    }
  };

  return (
    <>
      {/* Header hidden on mobile - branding moved to page header */}
      <header
        ref={headerRef}
        className="hidden lg:block sticky top-0 z-40 bg-cream"
      >
        <div className="max-w-[1600px] mx-auto px-4 py-3 lg:px-6 lg:py-5">
          {/* Desktop Header */}
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="group flex items-center gap-3">
              <Image
                src="/logo-mon.png"
                alt="NihontoWatch Mon"
                width={36}
                height={36}
                className="opacity-90 group-hover:opacity-100 transition-opacity"
              />
              <h1 className="font-serif text-2xl tracking-tight text-ink">
                Nihonto<span className="text-gold font-medium">Watch</span>
                <sup className="ml-1.5 text-[9px] font-sans font-semibold tracking-widest text-gold/70 border border-gold/30 rounded px-1 py-px align-super">BETA</sup>
              </h1>
            </Link>

            {/* Search - Simple form */}
            <form action="/" onSubmit={handleSearch} role="search" className="flex-1 max-w-md mx-10 group">
              <div className="relative">
                <input
                  type="search"
                  enterKeyHint="search"
                  name="q"
                  defaultValue={currentQuery}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Search swords, smiths, dealers..."
                  disabled={isSearching}
                  onKeyDown={(e) => {
                    // ESC key clears search
                    if (e.key === 'Escape' && currentQuery) {
                      e.currentTarget.value = '';
                      router.push('/');
                    }
                  }}
                  className={`w-full pl-4 ${currentQuery ? 'pr-20' : 'pr-12'} py-2.5 bg-linen/50 border border-transparent text-[13px] text-ink placeholder:text-muted/40 focus:outline-none focus:border-gold/40 focus:bg-paper focus:shadow-[0_0_0_3px_rgba(181,142,78,0.1)] transition-all duration-200 disabled:opacity-60`}
                />
                {/* Clear button - shows when there's a search query */}
                {currentQuery && !isSearching && (
                  <button
                    type="button"
                    onClick={() => {
                      // Clear the input and navigate home
                      const input = document.querySelector('header form[role="search"] input') as HTMLInputElement;
                      if (input) input.value = '';
                      router.push('/');
                    }}
                    aria-label="Clear search"
                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1.5 text-muted/40 hover:text-muted hover:bg-linen rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
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
                {/* Keyboard hint - show ESC when searching, Enter when not */}
                {!currentQuery && (
                  <div className="absolute right-12 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 opacity-0 group-focus-within:opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-muted/40 bg-linen/80 rounded">
                      Enter
                    </kbd>
                  </div>
                )}
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
                href="/artists"
                className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-gold transition-colors"
              >
                Artists
              </Link>
              <Link
                href="/glossary"
                className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-gold transition-colors"
              >
                Glossary
              </Link>
              <Link
                href="/saved"
                className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-gold transition-colors"
              >
                Saved
              </Link>
              <div className="h-3 w-px bg-border" />
              <ThemeSwitcher />
              {/* Admin Quick Menu */}
              {isAdmin && (
                <>
                  <div className="h-3 w-px bg-border" />
                  <div ref={adminMenuRef} className="relative">
                    <button
                      onClick={() => setShowAdminMenu(!showAdminMenu)}
                      className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-gold hover:text-gold/80 transition-colors"
                      aria-expanded={showAdminMenu}
                      aria-haspopup="true"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Admin
                      <svg className={`w-3 h-3 transition-transform ${showAdminMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showAdminMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-cream rounded-lg shadow-lg border border-border py-1 z-50 animate-fadeIn">
                        <a
                          href="/admin"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-ink hover:bg-hover transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                          Dashboard
                        </a>
                        <a
                          href="/admin/dealers"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-ink hover:bg-hover transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          Dealers
                        </a>
                        <a
                          href="/admin/users"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-ink hover:bg-hover transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          Users
                        </a>
                        <a
                          href="/admin/activity"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-ink hover:bg-hover transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Activity
                        </a>
                        <a
                          href="/admin/analytics"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-ink hover:bg-hover transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Analytics
                        </a>
                        <a
                          href="/admin/alerts"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-ink hover:bg-hover transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          Alerts
                        </a>
                      </div>
                    )}
                  </div>
                </>
              )}
              <div className="h-3 w-px bg-border" />
              {/* Auth: Login button or User menu */}
              {authLoading ? (
                // Show skeleton while auth is loading
                <div className="w-8 h-8 rounded-full bg-linen/50 animate-pulse" />
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
      <LoginModal isOpen={showLoginModal} onClose={closeLoginModal} />
    </>
  );
}

// Fallback for Suspense - includes functional form for native submission before JS hydrates
function HeaderFallback() {
  return (
    <header className="hidden lg:block sticky top-0 z-40 bg-cream transition-colors">
      <div className="max-w-[1600px] mx-auto px-4 py-3 lg:px-6 lg:py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-mon.png"
              alt="NihontoWatch Mon"
              width={36}
              height={36}
              className="opacity-90"
            />
            <span className="font-serif text-2xl tracking-tight text-ink">
              Nihonto<span className="text-gold font-medium">Watch</span>
              <sup className="ml-1.5 text-[9px] font-sans font-semibold tracking-widest text-gold/70 border border-gold/30 rounded px-1 py-px align-super">BETA</sup>
            </span>
          </div>
          {/* Functional form that works without JS via native form submission */}
          <form action="/" method="GET" role="search" className="flex-1 max-w-md mx-10">
            <div className="relative">
              <input
                type="search"
                name="q"
                placeholder="Search swords, smiths, dealers..."
                className="w-full pl-4 pr-12 py-2.5 bg-linen/50 border border-transparent text-[13px] text-ink placeholder:text-muted/40 focus:outline-none focus:border-gold/40 focus:bg-paper transition-all duration-200"
              />
              <button
                type="submit"
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted/50 hover:text-gold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
          <nav className="flex items-center gap-6">
            <Link
              href="/browse"
              className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-gold transition-colors"
            >
              Browse
            </Link>
            <Link
              href="/artists"
              className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-gold transition-colors"
            >
              Artists
            </Link>
            <Link
              href="/glossary"
              className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-gold transition-colors"
            >
              Glossary
            </Link>
            <Link
              href="/saved"
              className="text-[11px] uppercase tracking-[0.2em] text-muted hover:text-gold transition-colors"
            >
              Saved
            </Link>
            <div className="h-3 w-px bg-border" />
            <div className="w-8 h-8 bg-linen/50 rounded-full animate-pulse" />
          </nav>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </header>
  );
}

export function Header() {
  return (
    <Suspense fallback={<HeaderFallback />}>
      <HeaderContent />
    </Suspense>
  );
}
