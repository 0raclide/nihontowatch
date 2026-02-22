'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { SearchesTab } from '@/components/saved/SearchesTab';
import { WatchlistTab } from '@/components/saved/WatchlistTab';
import { useLocale } from '@/i18n/LocaleContext';

type TabType = 'searches' | 'watchlist';

function SavedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLocale();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Mark notifications as read when visiting this page
  useEffect(() => {
    localStorage.setItem('lastSavedPageVisit', new Date().toISOString());
  }, []);

  // Get active tab from URL or default to 'searches'
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabType>(
    tabParam === 'watchlist' ? 'watchlist' : 'searches'
  );

  // Update URL when tab changes
  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'searches') {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const newUrl = params.toString() ? `/saved?${params.toString()}` : '/saved';
      router.replace(newUrl, { scroll: false });
    },
    [router, searchParams]
  );

  // Sync tab state with URL on mount/navigation
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl === 'watchlist' && activeTab !== 'watchlist') {
      setActiveTab('watchlist');
    } else if (tabFromUrl !== 'watchlist' && activeTab !== 'searches') {
      setActiveTab('searches');
    }
  }, [searchParams, activeTab]);

  // Authentication loading state
  if (authLoading) {
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
                <svg
                  className="w-8 h-8 text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
              </div>
              <h2 className="font-serif text-xl text-ink mb-2">
                {t('saved.signInToView')}
              </h2>
              <p className="text-[14px] text-muted text-center max-w-sm mb-6">
                {t('saved.signInDescription')}
              </p>
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-6 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
              >
                {t('saved.signIn')}
              </button>
            </div>
          </main>
          <BottomTabBar activeFilterCount={0} />
        </div>
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-cream transition-colors">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 py-4 lg:px-6 lg:py-8">
        {/* Page Header */}
        <div className="mb-4 lg:mb-6">
          <h1 className="font-serif text-xl lg:text-2xl text-ink tracking-tight">
            {t('saved.title')}
          </h1>
          <p className="text-[12px] lg:text-[13px] text-muted mt-1">
            {t('saved.subtitle')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          <button
            onClick={() => handleTabChange('searches')}
            className={`px-4 py-2.5 text-[14px] font-medium transition-colors relative ${
              activeTab === 'searches'
                ? 'text-gold'
                : 'text-muted hover:text-ink'
            }`}
          >
            {t('saved.searches')}
            {activeTab === 'searches' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
          <button
            onClick={() => handleTabChange('watchlist')}
            className={`px-4 py-2.5 text-[14px] font-medium transition-colors relative ${
              activeTab === 'watchlist'
                ? 'text-gold'
                : 'text-muted hover:text-ink'
            }`}
          >
            {t('saved.watchlist')}
            {activeTab === 'watchlist' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'searches' ? <SearchesTab /> : <WatchlistTab />}
      </main>

      <BottomTabBar activeFilterCount={0} />
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-cream transition-colors">
      <Header />
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}

export default function SavedPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SavedPageContent />
    </Suspense>
  );
}
