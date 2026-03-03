'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DealerListingForm } from '@/components/dealer/DealerListingForm';
import { useLocale } from '@/i18n/LocaleContext';

interface DealerEditListingClientProps {
  id: string;
}

export function DealerEditListingClient({ id }: DealerEditListingClientProps) {
  const { t } = useLocale();
  const [listing, setListing] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchListing() {
      try {
        const res = await fetch(`/api/dealer/listings/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || t('dealer.listingNotFound'));
        }
        const data = await res.json();
        setListing(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('dealer.fetchError'));
      } finally {
        setLoading(false);
      }
    }
    fetchListing();
  }, [id, t]);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm border-b border-border/30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/dealer"
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:bg-hover transition-colors"
            aria-label={t('dealer.back')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-[16px] font-medium">{t('dealer.editListing')}</h1>
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
              href="/dealer"
              className="inline-block mt-4 text-[13px] text-gold hover:underline"
            >
              {t('dealer.backToListings')}
            </Link>
          </div>
        )}

        {listing && (
          <DealerListingForm mode="edit" initialData={listing} />
        )}
      </div>
    </div>
  );
}
