'use client';

import { useLocale } from '@/i18n/LocaleContext';

interface DealerCardIndicatorsProps {
  completeness?: { score: number; total: number };
  heatTrend?: 'hot' | 'warm' | 'cool';
  interestedCollectors?: number;
}

const HEAT_COLORS: Record<string, string> = {
  hot: 'bg-red-500',
  warm: 'bg-amber-400',
  cool: 'bg-muted/40',
};

const HEAT_LABEL_KEYS: Record<string, string> = {
  hot: 'dealer.intel.hot',
  warm: 'dealer.intel.warm',
  cool: 'dealer.intel.cool',
};

export function DealerCardIndicators({
  completeness,
  heatTrend,
  interestedCollectors,
}: DealerCardIndicatorsProps) {
  const { t } = useLocale();

  if (!completeness) return null;

  return (
    <div className="flex items-center gap-3 text-[9px] text-muted py-0.5">
      {/* Completeness dots */}
      <div className="flex items-center gap-1">
        <div className="flex gap-[2px]">
          {Array.from({ length: completeness.total }, (_, i) => (
            <span
              key={i}
              className={`inline-block w-[5px] h-[5px] rounded-full ${
                i < completeness.score
                  ? 'bg-gold'
                  : 'border border-border bg-transparent'
              }`}
            />
          ))}
        </div>
        <span className="tabular-nums">{completeness.score}/{completeness.total}</span>
      </div>

      {/* Heat dot — hidden if no engagement data yet */}
      {heatTrend && (
        <div className="flex items-center gap-1">
          <span className={`inline-block w-[5px] h-[5px] rounded-full ${HEAT_COLORS[heatTrend]}`} />
          <span>{t(HEAT_LABEL_KEYS[heatTrend])}</span>
        </div>
      )}

      {/* Interested collectors — hidden when 0 or not loaded */}
      {interestedCollectors != null && interestedCollectors > 0 && (
        <div className="flex items-center gap-0.5">
          <svg className="w-[10px] h-[10px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="tabular-nums">{interestedCollectors}</span>
        </div>
      )}
    </div>
  );
}
