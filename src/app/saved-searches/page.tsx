'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import { createClient } from '@/lib/supabase/client';
import {
  criteriaToUrl,
  criteriaToHumanReadable,
} from '@/lib/savedSearches/urlToCriteria';
import type { SavedSearch, NotificationFrequency } from '@/types';

interface DealerMap {
  [id: number]: string;
}

export default function SavedSearchesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [dealerNames, setDealerNames] = useState<Map<number, string>>(new Map());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const {
    savedSearches,
    isLoading,
    error,
    toggleSavedSearch,
    updateSavedSearch,
    updateNotificationFrequency,
    deleteSavedSearch,
    isUpdating,
    isDeleting,
  } = useSavedSearches({ autoFetch: !!user });

  // Fetch dealer names for display
  useEffect(() => {
    const fetchDealers = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('dealers')
          .select('id, name')
          .eq('is_active', true);

        const dealers = data as { id: number; name: string }[] | null;
        if (dealers) {
          const map = new Map<number, string>();
          dealers.forEach((d) => map.set(d.id, d.name));
          setDealerNames(map);
        }
      } catch (err) {
        console.error('Failed to fetch dealers:', err);
      }
    };
    fetchDealers();
  }, []);

  const handleRunSearch = useCallback(
    (search: SavedSearch) => {
      const url = criteriaToUrl(search.search_criteria);
      router.push(url);
    },
    [router]
  );

  const handleToggle = useCallback(
    async (id: string, isActive: boolean) => {
      await toggleSavedSearch(id, isActive);
    },
    [toggleSavedSearch]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      await deleteSavedSearch(id);
      setDeletingId(null);
    },
    [deleteSavedSearch]
  );

  const handleFrequencyChange = useCallback(
    async (id: string, frequency: NotificationFrequency) => {
      await updateNotificationFrequency(id, frequency);
    },
    [updateNotificationFrequency]
  );

  const handleStartEdit = useCallback((search: SavedSearch) => {
    setEditingId(search.id);
    setEditingName(search.name || '');
  }, []);

  const handleSaveName = useCallback(
    async (id: string) => {
      await updateSavedSearch(id, { name: editingName || undefined });
      setEditingId(null);
      setEditingName('');
    },
    [editingName, updateSavedSearch]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

  // Authentication loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-cream dark:bg-ink transition-colors">
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
        <div className="min-h-screen bg-cream dark:bg-ink transition-colors">
          <Header />
          <main className="max-w-[1200px] mx-auto px-4 py-8 lg:px-6 lg:py-12">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-linen dark:bg-ink-light flex items-center justify-center mb-4">
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
              <h2 className="font-serif text-xl text-ink dark:text-cream mb-2">
                Sign in to manage saved searches
              </h2>
              <p className="text-[14px] text-muted text-center max-w-sm mb-6">
                Save your favorite searches and get notified when new items match your
                criteria.
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
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-ink transition-colors">
      <Header />

      <main className="max-w-[1200px] mx-auto px-4 py-4 lg:px-6 lg:py-8">
        {/* Page Header */}
        <div className="mb-6 lg:mb-8">
          <h1 className="font-serif text-xl lg:text-2xl text-ink dark:text-cream tracking-tight">
            Saved Searches
          </h1>
          <p className="text-[12px] lg:text-[13px] text-muted mt-1">
            Your saved search filters with notification preferences
          </p>
        </div>

        {/* Subtle divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border dark:via-border-dark to-transparent mb-6 lg:mb-8" />

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && savedSearches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-linen dark:bg-ink-light flex items-center justify-center mb-4">
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h2 className="font-serif text-lg text-ink dark:text-cream mb-2">
              No saved searches yet
            </h2>
            <p className="text-[14px] text-muted text-center max-w-sm mb-6">
              Browse listings and save your search to get notified when new items match
              your criteria.
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
            >
              Browse Listings
            </button>
          </div>
        )}

        {/* Saved searches list */}
        {!isLoading && !error && savedSearches.length > 0 && (
          <div className="space-y-4">
            {savedSearches.map((search) => (
              <div
                key={search.id}
                className={`bg-white dark:bg-ink-light rounded-lg border border-border dark:border-border-dark p-4 lg:p-5 transition-opacity ${
                  !search.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left: Search info */}
                  <div className="flex-1 min-w-0">
                    {/* Name */}
                    {editingId === search.id ? (
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Search name..."
                          className="flex-1 px-3 py-1.5 text-[14px] border border-border dark:border-border-dark rounded-md bg-white dark:bg-ink focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName(search.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <button
                          onClick={() => handleSaveName(search.id)}
                          disabled={isUpdating}
                          className="px-3 py-1.5 text-[12px] font-medium text-white bg-gold hover:bg-gold-light rounded-md transition-colors disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 text-[12px] font-medium text-muted hover:text-ink dark:hover:text-cream rounded-md transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-ink dark:text-cream truncate">
                          {search.name || 'Unnamed search'}
                        </h3>
                        <button
                          onClick={() => handleStartEdit(search)}
                          className="p-1 text-muted hover:text-ink dark:hover:text-cream transition-colors"
                          title="Edit name"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Criteria summary */}
                    <p className="text-[13px] text-muted mb-3">
                      {criteriaToHumanReadable(search.search_criteria, dealerNames)}
                    </p>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                      {search.last_notified_at && (
                        <span>
                          Last notified:{' '}
                          {new Date(search.last_notified_at).toLocaleDateString()}
                        </span>
                      )}
                      {search.last_match_count > 0 && (
                        <span>{search.last_match_count} matches last time</span>
                      )}
                      <span>
                        Created {new Date(search.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col gap-3 lg:items-end">
                    {/* Notification frequency */}
                    <div className="flex items-center gap-2">
                      <label className="text-[12px] text-muted">Notify:</label>
                      <select
                        value={search.notification_frequency}
                        onChange={(e) =>
                          handleFrequencyChange(
                            search.id,
                            e.target.value as NotificationFrequency
                          )
                        }
                        disabled={isUpdating}
                        className="px-2 py-1 text-[12px] border border-border dark:border-border-dark rounded-md bg-white dark:bg-ink text-ink dark:text-cream focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold disabled:opacity-50"
                      >
                        <option value="instant">Instant (15 min)</option>
                        <option value="daily">Daily digest</option>
                        <option value="none">No notifications</option>
                      </select>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {/* Run search */}
                      <button
                        onClick={() => handleRunSearch(search)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gold hover:text-gold-light transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                        Run
                      </button>

                      {/* Toggle active */}
                      <button
                        onClick={() => handleToggle(search.id, !search.is_active)}
                        disabled={isUpdating}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${
                          search.is_active
                            ? 'text-amber-600 hover:text-amber-700 dark:text-amber-500'
                            : 'text-green-600 hover:text-green-700 dark:text-green-500'
                        }`}
                      >
                        {search.is_active ? (
                          <>
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Pause
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Resume
                          </>
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(search.id)}
                        disabled={isDeleting && deletingId === search.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:text-red-700 dark:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {isDeleting && deletingId === search.id ? (
                          <div className="w-3.5 h-3.5 border border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tip */}
        {!isLoading && !error && savedSearches.length > 0 && (
          <div className="mt-8 p-4 bg-linen dark:bg-ink-light/50 rounded-lg border border-border dark:border-border-dark">
            <p className="text-[13px] text-muted">
              <strong className="text-ink dark:text-cream">Tip:</strong> To save a new
              search, go to the{' '}
              <button
                onClick={() => router.push('/')}
                className="text-gold hover:underline"
              >
                browse page
              </button>
              , apply your filters, and click the &quot;Save Search&quot; button.
            </p>
          </div>
        )}
      </main>

      <BottomTabBar activeFilterCount={0} />
    </div>
  );
}
