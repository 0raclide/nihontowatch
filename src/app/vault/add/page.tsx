'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DealerListingForm, type DealerListingInitialData } from '@/components/dealer/DealerListingForm';
import { useLocale } from '@/i18n/LocaleContext';

// Tosogu item types — used to infer item_category from item_type
const TOSOGU_ITEM_TYPES = new Set([
  'tsuba', 'fuchi_kashira', 'menuki', 'kozuka', 'kogai',
  'mitokoromono', 'futatokoro', 'gotokoromono', 'koshirae', 'tosogu',
]);

/**
 * Read "I Own This" prefill from sessionStorage and map to form initial data.
 * Returns undefined if no prefill exists.
 * Clears sessionStorage after reading (one-shot).
 */
function readCollectionPrefill(): DealerListingInitialData | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem('collection_prefill');
    if (!raw) return undefined;
    sessionStorage.removeItem('collection_prefill');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = JSON.parse(raw) as Record<string, any>;
    const itemType = p.item_type as string | undefined;
    const isTosogu = itemType ? TOSOGU_ITEM_TYPES.has(itemType) : false;

    return {
      id: 0, // Placeholder — not used in add mode
      item_type: itemType || null,
      item_category: isTosogu ? 'tosogu' : 'nihonto',
      title: p.title || null,
      artisan_id: p.artisan_id || null,
      artisan_display_name: p.artisan_display_name || null,
      cert_type: p.cert_type || null,
      cert_session: p.cert_session || null,
      smith: isTosogu ? null : (p.smith || null),
      tosogu_maker: isTosogu ? (p.smith || null) : null,
      school: isTosogu ? null : (p.school || null),
      tosogu_school: isTosogu ? (p.school || null) : null,
      province: p.province || null,
      era: p.era || null,
      mei_type: p.mei_type || null,
      nagasa_cm: p.nagasa_cm || null,
      sori_cm: p.sori_cm || null,
      motohaba_cm: p.motohaba_cm || null,
      sakihaba_cm: p.sakihaba_cm || null,
      price_value: p.price_paid || null,
      price_currency: p.price_paid_currency || null,
      images: Array.isArray(p.images) ? p.images : [],
      source_listing_id: p.source_listing_id || null,
    };
  } catch {
    return undefined;
  }
}

export default function CollectionAddPage() {
  const { t } = useLocale();

  // Read prefill from sessionStorage after mount (avoids SSR/hydration mismatch).
  // The form doesn't render until we've checked — prevents flash of empty form.
  const [prefillData, setPrefillData] = useState<DealerListingInitialData | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefillData(readCollectionPrefill());
    setReady(true);
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-surface/95 backdrop-blur-sm border-b border-border/30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/vault"
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:bg-hover transition-colors"
            aria-label={t('common.back')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-[16px] font-medium">{t('collection.addItem')}</h1>
        </div>
      </div>

      {/* Form — wait for sessionStorage check to avoid empty flash */}
      <div className="max-w-lg mx-auto">
        {ready ? (
          <DealerListingForm mode="add" context="collection" initialData={prefillData} />
        ) : (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
