'use client';

import { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { FavoritesList } from '@/components/favorites/FavoritesList';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

type Currency = 'USD' | 'JPY' | 'EUR';

export default function FavoritesPage() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Currency state - default to JPY
  const [currency, setCurrency] = useState<Currency>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('preferred_currency') as Currency) || 'JPY';
    }
    return 'JPY';
  });
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);

  // Fetch exchange rates
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch('/api/exchange-rates');
        const rates = await res.json();
        setExchangeRates(rates);
      } catch (error) {
        console.error('Failed to fetch exchange rates:', error);
      }
    };
    fetchRates();
  }, []);

  // Persist currency preference
  const handleCurrencyChange = useCallback((newCurrency: Currency) => {
    setCurrency(newCurrency);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred_currency', newCurrency);
    }
  }, []);

  // Authentication loading state - also show loading if we have cached profile but no user yet
  if (authLoading || (profile && !user)) {
    return (
      <div className="min-h-screen bg-cream transition-colors">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Not authenticated state
  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-cream transition-colors">
          <Header />
          <main className="max-w-[1200px] mx-auto px-4 py-8 lg:px-6 lg:py-12">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-linen flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h2 className="font-serif text-xl text-ink mb-2">Sign in to view favorites</h2>
              <p className="text-[14px] text-muted text-center max-w-sm mb-6">
                Create an account or sign in to save and manage your favorite items.
              </p>
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-6 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
              >
                Sign In
              </button>
            </div>
          </main>
          <BottomTabBar activeFilterCount={0} />
        </div>
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-cream transition-colors">
      <Header />

      <main className="max-w-[1600px] mx-auto px-4 py-4 lg:px-6 lg:py-8">
        {/* Page Header */}
        <div className="mb-4 lg:mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-xl lg:text-2xl text-ink tracking-tight">
              My Favorites
            </h1>
            <p className="text-[12px] lg:text-[13px] text-muted mt-1">
              Items you&apos;ve saved for later
            </p>
          </div>

          {/* Controls */}
          <div className="hidden lg:flex items-center gap-6">
            <CurrencySelector value={currency} onChange={handleCurrencyChange} />
          </div>
        </div>

        {/* Subtle divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-4 lg:mb-8" />

        {/* Favorites List */}
        <FavoritesList currency={currency} exchangeRates={exchangeRates} />

        {/* Mobile Bottom Tab Bar */}
        <BottomTabBar activeFilterCount={0} />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-12 lg:mt-20 transition-colors">
        <div className="max-w-[1600px] mx-auto px-4 py-6 lg:px-6">
          <div className="flex flex-col gap-4 items-center lg:flex-row lg:justify-between">
            <div className="flex flex-col items-center gap-2 lg:flex-row lg:gap-6">
              <span className="font-serif text-lg text-ink">
                Nihonto<span className="text-gold">watch</span>
              </span>
              <span className="text-[11px] text-muted text-center lg:text-left">
                Curated Japanese arms from dealers worldwide
              </span>
            </div>
            <span className="text-[10px] text-muted/60">
              {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
