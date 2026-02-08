'use client';

/**
 * EliteFactorDisplay — Visual presentation of elite status.
 *
 * Shows grade letter with a subtle progress indicator and contextual stats.
 * Museum-quality presentation: restrained but informative.
 */

interface EliteFactorDisplayProps {
  eliteFactor: number;
  percentile: number;
  grade: string;
  totalItems: number;
  eliteCount: number;
}

const GRADE_DESCRIPTIONS: Record<string, string> = {
  S: 'Exceptional — among the most elite artisans in history',
  A: 'Distinguished — a significant proportion of elite works',
  B: 'Notable — above-average elite certification rate',
  C: 'Moderate — some works achieved elite designation',
  D: 'Emerging — certified works, few elite designations',
};

export function EliteFactorDisplay({
  eliteFactor,
  percentile,
  grade,
  totalItems,
  eliteCount,
}: EliteFactorDisplayProps) {
  const pct = Math.round(eliteFactor * 100);
  const topPct = Math.max(100 - percentile, 1);
  const description = GRADE_DESCRIPTIONS[grade] || '';

  return (
    <div className="space-y-4">
      {/* Grade + percentage */}
      <div className="flex items-end gap-4">
        <span className="text-4xl font-serif font-light text-gold leading-none">
          {grade}
        </span>
        <div className="pb-0.5">
          <span className="text-2xl font-serif font-light text-ink tabular-nums">{pct}%</span>
          <span className="text-sm text-muted/50 ml-1">elite</span>
        </div>
      </div>

      {/* Visual bar */}
      <div className="w-full">
        <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold/60 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats line */}
      <div className="text-xs text-muted/60 leading-relaxed space-y-0.5">
        <p>
          <span className="text-ink/80">{eliteCount}</span> of{' '}
          <span className="text-ink/80">{totalItems}</span> certified works hold elite designations
        </p>
        <p>
          Top <span className="text-ink/80">{topPct}%</span> among peers
        </p>
        {description && (
          <p className="text-muted/40 italic mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}
