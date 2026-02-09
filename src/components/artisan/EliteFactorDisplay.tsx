'use client';

import { useState } from 'react';

/**
 * EliteFactorDisplay — Factual presentation of elite certification ratio.
 *
 * Shows a thin ratio bar, stat line, and an info icon that reveals
 * a plain-language explanation of how the metric works.
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
  const [showInfo, setShowInfo] = useState(false);

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
      <div className="text-xs text-ink/50 leading-relaxed space-y-0.5">
        <p>
          <span className="text-ink/80">{eliteCount}</span> of{' '}
          <span className="text-ink/80">{totalItems}</span> works hold elite designations
          {/* Info icon */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="inline-flex items-center justify-center w-[15px] h-[15px] ml-1.5 rounded-full
              border border-ink/20 text-ink/35 hover:text-ink/60 hover:border-ink/40
              transition-colors align-middle cursor-pointer"
            aria-label="How is Elite Standing calculated?"
            aria-expanded={showInfo}
          >
            <svg className="w-[9px] h-[9px]" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.25 11.5V7h1.5v4.5h-1.5ZM8 5.75a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75Z" />
            </svg>
          </button>
        </p>
        <p>
          Top <span className="text-ink/80">{topPct}%</span> among peers
        </p>
      </div>

      {/* Explanation panel */}
      {showInfo && (
        <div className="text-[12px] text-ink/50 leading-[1.8] border-t border-border/20 pt-3 space-y-2.5">
          <p>
            The ratio of this artisan&rsquo;s evaluated works that received Japan&rsquo;s
            five highest cultural designations&mdash;Kokuh&#x14d;, J&#x16b;y&#x14d; Bunkazai,
            J&#x16b;y&#x14d; Bijutsuhin, Gyobutsu, and Tokubetsu J&#x16b;y&#x14d;.
            Regular J&#x16b;y&#x14d; is excluded.
          </p>
          <p>
            A high score means this artisan&rsquo;s works <em>consistently</em> reached
            the top tier&mdash;not just occasionally. It measures concentration of
            excellence across their full body of evaluated work, rather than raw
            count alone.
          </p>
          <p>
            The score is adjusted so that artisans with only a handful of documented
            works don&rsquo;t rank artificially high&mdash;a meaningful body of evaluated
            work is needed for a top score. The percentile ranks this artisan against
            all peers of the same type.
          </p>
        </div>
      )}
    </div>
  );
}
