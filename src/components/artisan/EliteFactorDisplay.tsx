'use client';

/**
 * EliteFactorDisplay — Factual presentation of elite certification ratio.
 *
 * Shows a thin ratio bar and a stat line. No grades, no evaluative text.
 * Museum-quality: restrained and informative.
 */

interface EliteFactorDisplayProps {
  eliteFactor: number;
  percentile: number;
  totalItems: number;
  eliteCount: number;
}

export function EliteFactorDisplay({
  eliteFactor,
  percentile,
  totalItems,
  eliteCount,
}: EliteFactorDisplayProps) {
  const pct = Math.round(eliteFactor * 100);
  const topPct = Math.max(100 - percentile, 1);

  return (
    <div className="space-y-4">
      {/* Ratio bar */}
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
      </div>
    </div>
  );
}
