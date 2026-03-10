'use client';

import { useState, useEffect } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import type { CollectionStats } from '@/app/api/collection/stats/route';

export function CollectionStatsCard() {
  const { t } = useLocale();
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      try {
        const res = await fetch('/api/collection/stats');
        if (!res.ok) return;
        const data: CollectionStats = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        // silently fail — stats card is non-critical
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchStats();
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <div className="bg-paper border border-border rounded-lg p-4 mb-6 animate-pulse">
        <div className="h-4 bg-border/30 rounded w-24 mb-3" />
        <div className="flex gap-6">
          <div className="h-8 bg-border/30 rounded w-16" />
          <div className="h-8 bg-border/30 rounded w-16" />
          <div className="h-8 bg-border/30 rounded w-16" />
        </div>
      </div>
    );
  }

  if (!stats || !stats.by_visibility || stats.total_items === 0) return null;

  const sharedCount = (stats.by_visibility.collectors ?? 0) + (stats.by_visibility.dealers ?? 0);

  // Type distribution bar
  const typeEntries = Object.entries(stats.by_type).sort((a, b) => b[1] - a[1]);
  const typeColors: Record<string, string> = {
    KATANA: 'bg-ink/70',
    WAKIZASHI: 'bg-ink/50',
    TANTO: 'bg-ink/35',
    TACHI: 'bg-ink/25',
    TSUBA: 'bg-gold/70',
    MENUKI: 'bg-gold/50',
    KOZUKA: 'bg-gold/35',
    FUCHI_KASHIRA: 'bg-gold/25',
  };

  return (
    <div className="bg-paper border border-border rounded-lg p-4 mb-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {/* Total */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted">{t('stats.totalItems')}</div>
          <div className="text-xl font-serif text-ink">{stats.total_items}</div>
        </div>

        {/* Shared */}
        {sharedCount > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted">{t('stats.visibility')}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {stats.by_visibility.collectors > 0 && (
                <span className="px-2 py-0.5 text-[11px] rounded-full bg-border/30 text-muted">
                  {t('collection.visibility.collectors')} {stats.by_visibility.collectors}
                </span>
              )}
              {stats.by_visibility.dealers > 0 && (
                <span className="px-2 py-0.5 text-[11px] rounded-full bg-border/30 text-muted">
                  {t('collection.visibility.dealers')} {stats.by_visibility.dealers}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Listed / Sold */}
        {(stats.listed_for_sale > 0 || stats.sold > 0) && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted">{t('stats.listedForSale')}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {stats.listed_for_sale > 0 && (
                <span className="text-sm text-ink">{stats.listed_for_sale} listed</span>
              )}
              {stats.sold > 0 && (
                <span className="text-sm text-muted">{stats.sold} sold</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Type distribution bar */}
      {typeEntries.length > 1 && (
        <div className="mt-3">
          <div className="h-2 rounded-full overflow-hidden flex bg-border/20">
            {typeEntries.map(([type, count]) => (
              <div
                key={type}
                className={`${typeColors[type] || 'bg-muted/30'} transition-all`}
                style={{ width: `${(count / stats.total_items) * 100}%` }}
                title={`${type}: ${count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            {typeEntries.slice(0, 5).map(([type, count]) => (
              <span key={type} className="text-[10px] text-muted">
                {type.replace('_', ' ')} ({count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
