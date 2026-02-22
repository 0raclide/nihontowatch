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
import { useLocale } from '@/i18n/LocaleContext';

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
  const { t } = useLocale();
  const { createSavedSearch, isCreating, error } = useSavedSearches({
    autoFetch: false,
  });

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<NotificationFrequency>('instant');
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
    router.push('/saved');
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
      <div className="relative w-full max-w-md bg-cream rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-serif text-lg text-ink">
            {t('saveSearch.heading')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-ink transition-colors"
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
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-green-600"
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
            <p className="text-ink font-medium">{t('saveSearch.searchSaved')}</p>
            <p className="text-[13px] text-muted mt-1">
              {t('saveSearch.notifyNew')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-4 space-y-4">
              {/* Search criteria summary */}
              <div className="p-3 bg-linen rounded-lg">
                <p className="text-[11px] uppercase tracking-wider text-muted mb-1">
                  {t('saveSearch.criteria')}
                </p>
                <p className="text-[13px] text-ink">
                  {criteriaToHumanReadable(criteria, dealerNames)}
                </p>
                {currentMatchCount !== undefined && (
                  <p className="text-[11px] text-muted mt-1">
                    {t('saveSearch.currentlyMatches', { count: currentMatchCount.toLocaleString() })}
                  </p>
                )}
              </div>

              {/* Name input */}
              <div>
                <label
                  htmlFor="search-name"
                  className="block text-[12px] font-medium text-ink mb-1"
                >
                  {t('saveSearch.nameOptional')}
                </label>
                <input
                  id="search-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('saveSearch.namePlaceholder')}
                  className="w-full px-3 py-2 text-[14px] border border-border rounded-lg bg-paper text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold"
                />
              </div>

              {/* Notification frequency */}
              <div>
                <label className="block text-[12px] font-medium text-ink mb-2">
                  {t('saveSearch.frequency')}
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-linen transition-colors">
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
                      <p className="text-[13px] font-medium text-ink">
                        {t('saveSearch.instant')}
                      </p>
                      <p className="text-[11px] text-muted">
                        {t('saveSearch.instantDesc')}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-linen transition-colors">
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
                      <p className="text-[13px] font-medium text-ink">
                        {t('saveSearch.dailyDigest')}
                      </p>
                      <p className="text-[11px] text-muted">
                        {t('saveSearch.dailyDesc')}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-linen transition-colors">
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
                      <p className="text-[13px] font-medium text-ink">
                        {t('saveSearch.noNotifications')}
                      </p>
                      <p className="text-[11px] text-muted">
                        {t('saveSearch.noNotificationsDesc')}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-[13px] text-red-700">
                    {error}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-border">
              <button
                type="button"
                onClick={handleGoToSavedSearches}
                className="text-[12px] text-gold hover:underline"
              >
                {t('saveSearch.viewSaved')}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-[13px] font-medium text-muted hover:text-ink transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 text-[13px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      {t('saveSearch.saving')}
                    </span>
                  ) : (
                    t('saveSearch.saveSearch')
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
