'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import { createClient } from '@/lib/supabase/client';
import {
  criteriaToHumanReadable,
  generateSearchName,
} from '@/lib/savedSearches/urlToCriteria';
import type { SavedSearchCriteria, NotificationFrequency } from '@/types';

interface SaveSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  criteria: SavedSearchCriteria;
  currentMatchCount?: number;
}

export function SaveSearchModal({
  isOpen,
  onClose,
  criteria,
  currentMatchCount,
}: SaveSearchModalProps) {
  const router = useRouter();
  const { createSavedSearch, isCreating, error } = useSavedSearches({
    autoFetch: false,
  });

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<NotificationFrequency>('daily');
  const [dealerNames, setDealerNames] = useState<Map<number, string>>(new Map());
  const [success, setSuccess] = useState(false);

  // Fetch dealer names for display
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  // Generate default name when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(generateSearchName(criteria));
      setSuccess(false);
    }
  }, [isOpen, criteria]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const result = await createSavedSearch({
        name: name || undefined,
        search_criteria: criteria,
        notification_frequency: frequency,
      });

      if (result) {
        setSuccess(true);
        // Auto-close after showing success
        setTimeout(() => {
          onClose();
          setSuccess(false);
        }, 1500);
      }
    },
    [createSavedSearch, name, criteria, frequency, onClose]
  );

  const handleGoToSavedSearches = useCallback(() => {
    onClose();
    router.push('/saved-searches');
  }, [onClose, router]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-ink-light rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark">
          <h2 className="font-serif text-lg text-ink dark:text-cream">
            Save Search
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-ink dark:hover:text-cream transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Success state */}
        {success ? (
          <div className="p-6 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-ink dark:text-cream font-medium">Search saved!</p>
            <p className="text-[13px] text-muted mt-1">
              You&apos;ll be notified when new items match.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-4 space-y-4">
              {/* Search criteria summary */}
              <div className="p-3 bg-linen dark:bg-ink/50 rounded-lg">
                <p className="text-[11px] uppercase tracking-wider text-muted mb-1">
                  Search Criteria
                </p>
                <p className="text-[13px] text-ink dark:text-cream">
                  {criteriaToHumanReadable(criteria, dealerNames)}
                </p>
                {currentMatchCount !== undefined && (
                  <p className="text-[11px] text-muted mt-1">
                    Currently matches {currentMatchCount.toLocaleString()} items
                  </p>
                )}
              </div>

              {/* Name input */}
              <div>
                <label
                  htmlFor="search-name"
                  className="block text-[12px] font-medium text-ink dark:text-cream mb-1"
                >
                  Name (optional)
                </label>
                <input
                  id="search-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Juyo Katana under 3M"
                  className="w-full px-3 py-2 text-[14px] border border-border dark:border-border-dark rounded-lg bg-white dark:bg-ink text-ink dark:text-cream placeholder-muted focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold"
                />
              </div>

              {/* Notification frequency */}
              <div>
                <label className="block text-[12px] font-medium text-ink dark:text-cream mb-2">
                  Notification Frequency
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 border border-border dark:border-border-dark rounded-lg cursor-pointer hover:bg-linen dark:hover:bg-ink/50 transition-colors">
                    <input
                      type="radio"
                      name="frequency"
                      value="instant"
                      checked={frequency === 'instant'}
                      onChange={(e) =>
                        setFrequency(e.target.value as NotificationFrequency)
                      }
                      className="mt-0.5 text-gold focus:ring-gold"
                    />
                    <div>
                      <p className="text-[13px] font-medium text-ink dark:text-cream">
                        Instant
                      </p>
                      <p className="text-[11px] text-muted">
                        Get notified within 15 minutes of new matches
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-border dark:border-border-dark rounded-lg cursor-pointer hover:bg-linen dark:hover:bg-ink/50 transition-colors">
                    <input
                      type="radio"
                      name="frequency"
                      value="daily"
                      checked={frequency === 'daily'}
                      onChange={(e) =>
                        setFrequency(e.target.value as NotificationFrequency)
                      }
                      className="mt-0.5 text-gold focus:ring-gold"
                    />
                    <div>
                      <p className="text-[13px] font-medium text-ink dark:text-cream">
                        Daily Digest
                      </p>
                      <p className="text-[11px] text-muted">
                        Receive a daily email at 8am UTC with all new matches
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-border dark:border-border-dark rounded-lg cursor-pointer hover:bg-linen dark:hover:bg-ink/50 transition-colors">
                    <input
                      type="radio"
                      name="frequency"
                      value="none"
                      checked={frequency === 'none'}
                      onChange={(e) =>
                        setFrequency(e.target.value as NotificationFrequency)
                      }
                      className="mt-0.5 text-gold focus:ring-gold"
                    />
                    <div>
                      <p className="text-[13px] font-medium text-ink dark:text-cream">
                        No Notifications
                      </p>
                      <p className="text-[11px] text-muted">
                        Save for quick access, no email notifications
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-[13px] text-red-700 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-border dark:border-border-dark">
              <button
                type="button"
                onClick={handleGoToSavedSearches}
                className="text-[12px] text-gold hover:underline"
              >
                View Saved Searches
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-[13px] font-medium text-muted hover:text-ink dark:hover:text-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 text-[13px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Save Search'
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
