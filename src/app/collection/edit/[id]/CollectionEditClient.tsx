'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DealerListingForm, type DealerListingInitialData } from '@/components/dealer/DealerListingForm';
import { useLocale } from '@/i18n/LocaleContext';

interface CollectionEditClientProps {
  id: string;
}

export function CollectionEditClient({ id }: CollectionEditClientProps) {
  const { t } = useLocale();
  const [item, setItem] = useState<DealerListingInitialData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchItem() {
      try {
        const res = await fetch(`/api/collection/items/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Item not found');
        }
        const data = await res.json();
        setItem(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load item');
      } finally {
        setLoading(false);
      }
    }
    fetchItem();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-surface/95 backdrop-blur-sm border-b border-border/30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/collection"
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:bg-hover transition-colors"
            aria-label={t('common.back')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-[16px] font-medium">{t('collection.editItem')}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-4 py-16 text-center">
            <p className="text-[13px] text-muted">{error}</p>
            <Link
              href="/collection"
              className="inline-block mt-4 text-[13px] text-gold hover:underline"
            >
              {t('common.back')}
            </Link>
          </div>
        )}

        {item && (
          <DealerListingForm mode="edit" initialData={item} context="collection" />
        )}
      </div>
    </div>
  );
}
