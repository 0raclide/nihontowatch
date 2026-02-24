'use client';

import { useLocale } from '@/i18n/LocaleContext';

/**
 * MeasurementPanel — Box-plot style range bars for blade measurements.
 *
 * Pure CSS visualization showing min → P25 → median → P75 → max
 * for nagasa, sori, motohaba, sakihaba within a specific form type.
 */

interface MeasurementPanelProps {
  measurements: {
    nagasa: number[];
    sori: number[];
    motohaba: number[];
    sakihaba: number[];
  };
}

interface Stats {
  min: number;
  max: number;
  median: number;
  p25: number;
  p75: number;
  n: number;
}

const MEASUREMENT_KEYS = ['nagasa', 'sori', 'motohaba', 'sakihaba'] as const;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function computeStats(values: number[]): Stats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: percentile(sorted, 50),
    p25: percentile(sorted, 25),
    p75: percentile(sorted, 75),
    n: sorted.length,
  };
}

function formatValue(value: number): string {
  // Show 1 decimal for larger values (nagasa), 2 for smaller (sori, motohaba, sakihaba)
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function RangeBar({ stats }: { stats: Stats }) {
  const { min, max, p25, p75, median, n } = stats;
  const range = max - min;

  // Single value — just show the number, no bar
  if (range === 0 || n === 1) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm tabular-nums text-ink/70">{formatValue(median)}</span>
        <span className="text-[10px] text-ink/30">(n={n})</span>
      </div>
    );
  }

  // Position helpers: convert value to percentage within [min, max]
  const toPercent = (v: number) => ((v - min) / range) * 100;

  const p25Pct = toPercent(p25);
  const p75Pct = toPercent(p75);
  const medianPct = toPercent(median);

  return (
    <div className="flex items-center gap-3 min-w-0">
      {/* Range bar */}
      <div className="relative flex-1 h-3 min-w-[100px]">
        {/* Full range track (min to max) */}
        <div className="absolute top-[5px] left-0 right-0 h-[2px] bg-border/25 rounded-full" />

        {/* IQR filled range (P25 to P75) */}
        {n >= 3 && (
          <div
            className="absolute top-[3px] h-[6px] bg-gold/40 rounded-sm"
            style={{ left: `${p25Pct}%`, width: `${Math.max(p75Pct - p25Pct, 1)}%` }}
          />
        )}

        {/* Median tick */}
        <div
          className="absolute top-[1px] w-[2px] h-[10px] bg-gold rounded-full"
          style={{ left: `${medianPct}%` }}
        />

        {/* Min/max labels */}
        <span className="absolute -bottom-3 left-0 text-[9px] text-ink/25 tabular-nums">
          {formatValue(min)}
        </span>
        <span className="absolute -bottom-3 right-0 text-[9px] text-ink/25 tabular-nums">
          {formatValue(max)}
        </span>
      </div>

      {/* Stats text */}
      <div className="flex items-baseline gap-1.5 shrink-0">
        <span className="text-xs tabular-nums text-ink/70 font-light">{formatValue(median)}</span>
        <span className="text-[10px] text-ink/30">cm</span>
        <span className="text-[10px] text-ink/25 tabular-nums">(n={n})</span>
      </div>
    </div>
  );
}

export function MeasurementPanel({ measurements }: MeasurementPanelProps) {
  const { t } = useLocale();
  const metrics = MEASUREMENT_KEYS
    .map(key => ({
      key,
      label: t(`measurement.${key}`),
      stats: computeStats(measurements[key]),
    }))
    .filter(m => m.stats !== null);

  if (metrics.length === 0) return null;

  return (
    <div className="pt-2 pb-3 space-y-4">
      {metrics.map(({ key, label, stats }) => (
        <div key={key} className="flex items-start gap-3">
          <span className="text-[11px] text-ink/40 w-[68px] shrink-0 pt-0.5 tracking-wide">
            {label}
          </span>
          <div className="flex-1 min-w-0">
            <RangeBar stats={stats!} />
          </div>
        </div>
      ))}
    </div>
  );
}
