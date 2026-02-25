'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocale } from '@/i18n/LocaleContext';

/**
 * EliteFactorDisplay — Factual presentation of elite certification ratio.
 *
 * Shows a thin ratio bar, stat line, and an info icon that reveals
 * a plain-language explanation + high-resolution histogram.
 */

interface EliteFactorDisplayProps {
  eliteFactor: number;
  percentile: number;
  totalItems: number;
  eliteCount: number;
  entityType: 'smith' | 'tosogu';
}

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useLocale();
  const peerLabel = entityType === 'smith' ? t('artists.smiths') : t('artists.makers');

  // Find the last non-zero bucket to trim empty tail
  let lastNonZero = buckets.length - 1;
  while (lastNonZero > 0 && buckets[lastNonZero] === 0) lastNonZero--;
  // Show at least up to the artisan's bucket + a little margin, min 10 buckets
  const rawActiveBucket = Math.min(Math.floor(eliteFactor * 100), 99);
  const visibleCount = Math.max(lastNonZero + 2, rawActiveBucket + 3, 10);

  // Re-bin into wider buckets when range is large to avoid sparse gaps
  const binSize = Math.max(1, Math.ceil(visibleCount / 25));
  const activeBucket = Math.floor(rawActiveBucket / binSize);

  const visible = useMemo(() => {
    const rawVisible = buckets.slice(0, visibleCount);
    const rebinned: number[] = [];
    for (let i = 0; i < rawVisible.length; i += binSize) {
      let sum = 0;
      for (let j = i; j < Math.min(i + binSize, rawVisible.length); j++) {
        sum += rawVisible[j];
      }
      rebinned.push(sum);
    }
    return rebinned;
  }, [buckets, visibleCount, binSize]);

  const maxCount = Math.max(...visible);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const barW = w / visible.length;
    const topPad = 12; // room for the marker above

    ctx.clearRect(0, 0, w, h);

    // Draw bars
    for (let i = 0; i < visible.length; i++) {
      const count = visible[i];
      if (count === 0) continue;

      // Log scale for height
      const logH = Math.log(count + 1) / Math.log(maxCount + 1);
      const barH = Math.max(logH * (h - topPad - 14), 1);
      const x = i * barW;
      const y = h - 14 - barH;

      const isActive = i === activeBucket;

      // Get computed style colors
      ctx.fillStyle = isActive
        ? 'rgba(196, 164, 105, 0.8)'  // gold
        : 'rgba(128, 128, 128, 0.18)'; // neutral

      ctx.fillRect(x + 0.5, y, Math.max(barW - 1, 1), barH);
    }

    // Draw marker arrow above active bucket
    const markerX = (activeBucket + 0.5) * barW;
    ctx.fillStyle = 'rgba(196, 164, 105, 0.9)';
    ctx.beginPath();
    ctx.moveTo(markerX - 4, 2);
    ctx.lineTo(markerX + 4, 2);
    ctx.lineTo(markerX, 8);
    ctx.closePath();
    ctx.fill();

    // Axis labels
    ctx.fillStyle = 'rgba(128, 128, 128, 0.35)';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'start';
    ctx.fillText('0%', 0, h);
    ctx.textAlign = 'end';
    ctx.fillText(`${visibleCount}%`, w, h);
  }, [visible, maxCount, activeBucket, visibleCount, binSize]);

  return (
    <div className="mt-3">
      <p className="text-[11px] text-ink/35 mb-2">
        {t('artist.distributionAmong', { total: total.toLocaleString(), peers: peerLabel, context: t('artist.withRankedWorks') })}
      </p>
      <canvas
        ref={canvasRef}
        className="w-full h-[68px]"
        style={{ imageRendering: 'auto' }}
      />
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
  const { t } = useLocale();
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

  const peerLabel = entityType === 'smith' ? t('artists.smiths') : t('artists.makers');

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
          <span className="text-ink/80">{eliteCount}</span> {t('artist.ofWorksElite', { total: totalItems })}
          {/* Info icon */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="inline-flex items-center justify-center w-[15px] h-[15px] ml-1.5 rounded-full
              border border-ink/20 text-ink/35 hover:text-ink/60 hover:border-ink/40
              transition-colors align-middle cursor-pointer
              relative before:absolute before:-inset-3 before:content-['']"
            aria-label={t('artist.howEliteCalculated')}
            aria-expanded={showInfo}
          >
            <svg className="w-[9px] h-[9px]" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.25 11.5V7h1.5v4.5h-1.5ZM8 5.75a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75Z" />
            </svg>
          </button>
        </p>
        <p>
          {t('artist.topAmong', { pct: topPct, peers: peerLabel })}
        </p>
      </div>

      {/* Explanation panel */}
      {showInfo && (
        <div className="border-t border-border/20 pt-3 space-y-3">
          <div className="text-[12px] text-ink/50 leading-[1.8] space-y-2.5">
            <p>{t('artist.eliteExplanation1', { peers: peerLabel })}</p>
            <p>{t('artist.eliteExplanation2')}</p>
            <p>{t('artist.eliteExplanation3', { pct: topPct, peers: peerLabel })}</p>
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
            <div className="h-[68px] flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-border/30 border-t-gold/50 rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
