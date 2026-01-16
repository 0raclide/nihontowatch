'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/Header';
import { FavoritesList } from '@/components/favorites/FavoritesList';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

type Currency = 'USD' | 'JPY' | 'EUR';

export default function FavoritesPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Currency state - default to JPY
  const [currency, setCurrency] = useState<Currency>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('preferred_currency') as Currency) || 'JPY';
    }
    return 'JPY';
  });
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Redirect to login (or home page if no login page exists)
        router.push('/');
        return;
      }

      setIsAuthenticated(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

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

  // Show loading state while checking auth
  if (isLoading || isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-cream dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted dark:text-gray-400">Loading favorites...</p>
        </div>
      </div>
    );
  }

  // If not authenticated (shouldn't reach here due to redirect, but just in case)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-cream dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="text-center p-8">
          <h2 className="font-serif text-xl text-ink dark:text-white mb-4">
            Sign in to view favorites
          </h2>
          <p className="text-sm text-muted dark:text-gray-400 mb-6">
            Create an account or sign in to save and manage your favorite items.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink dark:bg-gold text-white dark:text-ink text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900 transition-colors">
      <Header />

      <main className="max-w-[1600px] mx-auto px-4 py-4 lg:px-6 lg:py-8">
        {/* Page Header */}
        <div className="mb-4 lg:mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-xl lg:text-2xl text-ink dark:text-white tracking-tight">
              My Favorites
            </h1>
            <p className="text-[12px] lg:text-[13px] text-muted dark:text-gray-500 mt-1">
              Items you&apos;ve saved for later
            </p>
          </div>

          {/* Controls */}
          <div className="hidden lg:flex items-center gap-6">
            <CurrencySelector value={currency} onChange={handleCurrencyChange} />
          </div>
        </div>

        {/* Subtle divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border dark:via-gray-700 to-transparent mb-4 lg:mb-8" />

        {/* Favorites List */}
        <FavoritesList currency={currency} exchangeRates={exchangeRates} />

        {/* Mobile Bottom Tab Bar */}
        <BottomTabBar activeFilterCount={0} />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 dark:border-gray-800/50 mt-12 lg:mt-20 transition-colors">
        <div className="max-w-[1600px] mx-auto px-4 py-6 lg:px-6">
          <div className="flex flex-col gap-4 items-center lg:flex-row lg:justify-between">
            <div className="flex flex-col items-center gap-2 lg:flex-row lg:gap-6">
              <span className="font-serif text-lg text-ink dark:text-white">
                Nihonto<span className="text-gold">watch</span>
              </span>
              <span className="text-[11px] text-muted dark:text-gray-600 text-center lg:text-left">
                Curated Japanese arms from dealers worldwide
              </span>
            </div>
            <span className="text-[10px] text-muted/60 dark:text-gray-600">
              {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
