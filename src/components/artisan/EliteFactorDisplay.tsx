'use client';

import { useState, useEffect } from 'react';

/**
 * EliteFactorDisplay — Factual presentation of elite certification ratio.
 *
 * Shows a thin ratio bar, stat line, and an info icon that reveals
 * a plain-language explanation + histogram of where this artisan stands.
 */

interface EliteFactorDisplayProps {
  eliteFactor: number;
  percentile: number;
  totalItems: number;
  eliteCount: number;
  entityType: 'smith' | 'tosogu';
}

const BUCKET_LABELS = ['0–10%', '10–20%', '20–30%', '30–40%', '40–50%', '50–60%', '60–70%', '70–80%', '80–90%', '90–100%'];

function EliteHistogram({
  buckets,
  total,
  eliteFactor,
  entityType,
}: {
  buckets: number[];
  total: number;
  eliteFactor: number;
  entityType: 'smith' | 'tosogu';
}) {
  const maxCount = Math.max(...buckets);
  const activeBucket = Math.min(Math.floor(eliteFactor * 10), 9);
  const peerLabel = entityType === 'smith' ? 'smiths' : 'tosogu makers';

  return (
    <div className="mt-3">
      <p className="text-[11px] text-ink/35 mb-2">
        Distribution across {total.toLocaleString()} {peerLabel} with ranked works
      </p>

      {/* Bars */}
      <div className="flex items-end gap-[3px] h-[52px]">
        {buckets.map((count, i) => {
          const isActive = i === activeBucket;
          // Log scale so the dominant first bucket doesn't flatten everything else
          const logH = maxCount > 0
            ? Math.log(count + 1) / Math.log(maxCount + 1)
            : 0;
          const heightPct = Math.max(logH * 100, count > 0 ? 3 : 0);

          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative group">
              <div
                className={`w-full rounded-[1.5px] transition-all duration-500 ${
                  isActive
                    ? 'bg-gold/70'
                    : 'bg-border/30'
                }`}
                style={{ height: `${heightPct}%` }}
              />
              {isActive && (
                <div className="absolute -top-[14px] left-1/2 -translate-x-1/2">
                  <svg className="w-2 h-2 text-gold/80" viewBox="0 0 8 8" fill="currentColor">
                    <path d="M4 6L1 2h6L4 6z" />
                  </svg>
                </div>
              )}
              {/* Tooltip on hover */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block
                bg-surface border border-border/30 rounded px-1.5 py-0.5 text-[10px] text-ink/60 whitespace-nowrap shadow-sm z-10">
                {BUCKET_LABELS[i]}: {count.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Axis labels */}
      <div className="flex justify-between mt-1 text-[9px] text-ink/25 tabular-nums">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export function EliteFactorDisplay({
  eliteFactor,
  percentile,
  totalItems,
  eliteCount,
  entityType,
}: EliteFactorDisplayProps) {
  const pct = Math.round(eliteFactor * 100);
  const topPct = Math.max(100 - percentile, 1);
  const [showInfo, setShowInfo] = useState(false);
  const [distribution, setDistribution] = useState<{ buckets: number[]; total: number } | null>(null);

  // Lazy-load distribution when info panel opens
  useEffect(() => {
    if (!showInfo || distribution) return;
    fetch(`/api/artisan/elite-distribution?type=${entityType}`)
      .then(r => r.json())
      .then(d => setDistribution(d))
      .catch(() => {});
  }, [showInfo, distribution, entityType]);

  const peerLabel = entityType === 'smith' ? 'smiths' : 'tosogu makers';

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
          Top <span className="text-ink/80">{topPct}%</span> among {peerLabel}
        </p>
      </div>

      {/* Explanation panel */}
      {showInfo && (
        <div className="border-t border-border/20 pt-3 space-y-3">
          <div className="text-[12px] text-ink/50 leading-[1.8] space-y-2.5">
            <p>
              Every artisan here already has works certified at the J&#x16b;y&#x14d; level
              or above&mdash;a distinction held by a fraction of all historical {peerLabel}.
              Elite Standing goes further: it measures what proportion of those
              certified works reached the <em>very highest</em> tiers&mdash;Kokuh&#x14d;,
              J&#x16b;y&#x14d; Bunkazai, J&#x16b;y&#x14d; Bijutsuhin, Gyobutsu,
              or Tokubetsu J&#x16b;y&#x14d;.
            </p>
            <p>
              A high ratio means this artisan&rsquo;s works didn&rsquo;t just occasionally
              reach the top&mdash;they did so <em>consistently</em>. It separates
              artisans whose output was routinely judged among the finest from those
              with one or two exceptional pieces in a larger body of work.
            </p>
            <p>
              The score is smoothed so that artisans with only a few documented works
              can&rsquo;t rank artificially high. This artisan places
              in the <span className="text-ink/80">top {topPct}%</span> of
              all {peerLabel} with ranked works.
            </p>
          </div>

          {/* Histogram */}
          {distribution ? (
            <EliteHistogram
              buckets={distribution.buckets}
              total={distribution.total}
              eliteFactor={eliteFactor}
              entityType={entityType}
            />
          ) : (
            <div className="h-[52px] flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-border/30 border-t-gold/50 rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
