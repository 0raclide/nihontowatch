'use client';

import Link from 'next/link';
import { DealerListingForm } from '@/components/dealer/DealerListingForm';
import { useLocale } from '@/i18n/LocaleContext';

export function DealerNewListingClient() {
  const { t } = useLocale();

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
          <h1 className="text-[16px] font-medium">{t('dealer.newListing')}</h1>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-lg mx-auto">
        <DealerListingForm mode="add" />
      </div>
    </div>
  );
}
