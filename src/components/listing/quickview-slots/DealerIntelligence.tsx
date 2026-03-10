'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import type { DealerIntelligenceAPIResponse, HeatTrend, RankBucket } from '@/lib/dealer/intelligence';

interface DealerIntelligenceProps {
  listingId?: number;
  collectionItemId?: string;
  tab: 'inventory' | 'available' | 'hold' | 'sold';
}

const HEAT_COLORS: Record<HeatTrend, string> = {
  hot: 'bg-red-500',
  warm: 'bg-amber-400',
  cool: 'bg-muted/40',
};

const RANK_COLORS: Record<RankBucket, string> = {
  top10: 'bg-gold/15 text-gold',
  top25: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  top50: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  below: 'bg-muted/10 text-muted',
};

const RANK_I18N: Record<RankBucket, string> = {
  top10: 'dealer.intel.top10',
  top25: 'dealer.intel.top25',
  top50: 'dealer.intel.top50',
  below: 'dealer.intel.below',
};

export function DealerIntelligence({ listingId, collectionItemId, tab }: DealerIntelligenceProps) {
  const { t } = useLocale();
  const [data, setData] = useState<DealerIntelligenceAPIResponse['listings'][number] | null>(null);
  const [loading, setLoading] = useState(true);

  const itemKey = collectionItemId ?? listingId;

  useEffect(() => {
    if (!itemKey) return;
    let cancelled = false;
    setLoading(true);

    const url = collectionItemId
      ? `/api/collection/items/${collectionItemId}/intelligence`
      : `/api/dealer/listings/intelligence?listingIds=${listingId}`;

    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then((resp: DealerIntelligenceAPIResponse | null) => {
        // listings map is keyed by number (listings) or string (collection items)
        // JS object keys are always strings, so cast to access either
        const listings = resp?.listings as Record<string, DealerIntelligenceAPIResponse['listings'][number]> | undefined;
        if (!cancelled && listings?.[String(itemKey!)]) {
          setData(listings[String(itemKey!)]);
        }
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [listingId, collectionItemId, itemKey]);

  if (loading) {
    return (
      <div className="px-4 py-4 lg:px-5 border-b border-border space-y-3" data-testid="dealer-intelligence-skeleton">
        <div className="h-3 w-24 bg-muted/20 rounded animate-pulse" />
        <div className="h-8 w-full bg-muted/10 rounded animate-pulse" />
        <div className="h-3 w-32 bg-muted/20 rounded animate-pulse" />
        <div className="h-20 w-full bg-muted/10 rounded animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const isSoldTab = tab === 'sold';
  const isInventory = tab === 'inventory';

  return (
    <div className="px-4 py-4 lg:px-5 border-b border-border space-y-4" data-testid="dealer-intelligence">
      {/* Section 1: Alert Count — hero callout (hidden if 0 or sold tab) */}
      {!isSoldTab && data.interestedCollectors > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-gold/10 px-3 py-2.5" data-testid="alert-callout">
          <svg className="w-5 h-5 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-[13px] font-medium text-ink">
            {t(isInventory ? 'dealer.intel.interestedInventory' : 'dealer.intel.interestedListed', { count: data.interestedCollectors })}
          </span>
        </div>
      )}

      {/* Section 2: Feed Position */}
      <div>
        <h4 className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">
          {isInventory ? t('dealer.intel.estimatedPosition') : t('dealer.intel.feedPosition')}
        </h4>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-[13px] font-semibold tabular-nums ${RANK_COLORS[data.scorePreview.rankBucket]}`}>
            ~#{data.scorePreview.estimatedPosition.toLocaleString()}
          </span>
          <span className="text-[12px] text-muted">
            {t('dealer.intel.ofListings', { total: data.scorePreview.totalListings.toLocaleString() })}
          </span>
          <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium ${RANK_COLORS[data.scorePreview.rankBucket]}`}>
            {t(RANK_I18N[data.scorePreview.rankBucket])}
          </span>
        </div>
      </div>

      {/* Section 3: Completeness */}
      <div>
        <h4 className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">
          {t('dealer.intel.completeness')}
        </h4>
        {/* Progress bar */}
        <div className="h-1.5 bg-border/30 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gold rounded-full transition-all"
            style={{ width: `${(data.completeness.score / data.completeness.total) * 100}%` }}
          />
        </div>
        {/* Checklist */}
        <div className="space-y-1.5">
          {data.completeness.items.map(item => (
            <div key={item.key} className="flex items-start gap-2 text-[12px]">
              {item.filled ? (
                <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-muted/40 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <div className="flex-1 min-w-0">
                <span className={item.filled ? 'text-ink' : 'text-muted'}>
                  {t(item.labelKey)}
                </span>
                {!item.filled && (
                  <p className="text-[10px] text-muted/70 mt-0.5">{t(item.tipKey)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Engagement */}
      <div>
        <h4 className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">
          {isSoldTab ? t('dealer.intel.performance') : t('dealer.intel.engagement30d')}
        </h4>
        {isInventory ? (
          <p className="text-[12px] text-muted italic">{t('dealer.intel.trackedWhenListed')}</p>
        ) : data.engagement ? (
          <div className="flex items-center gap-4 text-[12px]">
            <div className="text-center">
              <div className="font-medium tabular-nums text-ink">{data.engagement.views}</div>
              <div className="text-[10px] text-muted">{t('dealer.intel.views')}</div>
            </div>
            <div className="text-center">
              <div className="font-medium tabular-nums text-ink">{data.engagement.favorites}</div>
              <div className="text-[10px] text-muted">{t('dealer.intel.favorites')}</div>
            </div>
            <div className="text-center">
              <div className="font-medium tabular-nums text-ink">{data.engagement.clicks}</div>
              <div className="text-[10px] text-muted">{t('dealer.intel.clicks')}</div>
            </div>
            {/* Heat pill */}
            <div className="flex items-center gap-1 ml-auto">
              <span className={`inline-block w-2 h-2 rounded-full ${HEAT_COLORS[data.engagement.heatTrend]}`} />
              <span className="text-[11px] text-muted">{t(`dealer.intel.${data.engagement.heatTrend}`)}</span>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-muted italic">{t('dealer.intel.trackedWhenListed')}</p>
        )}
      </div>
    </div>
  );
}
