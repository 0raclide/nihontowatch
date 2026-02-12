'use client';

import { useState } from 'react';
import {
  PROVENANCE_TIERS,
  formatKoku,
  type ProvenanceAnalysis,
  type TierKey,
  type ProvenanceTierData,
} from '@/lib/artisan/provenanceMock';

/**
 * ProvenancePyramid — Companion to PrestigePyramid.
 *
 * Shows the distribution of an artisan's provenanced works across
 * collector prestige tiers, from Imperial at the apex to Named
 * Collectors at the base. Uses uniform gold bars matching the
 * designation pyramid visual language.
 */

interface ProvenancePyramidProps {
  analysis: ProvenanceAnalysis;
}

export function ProvenancePyramid({ analysis }: ProvenancePyramidProps) {
  const [expandedTiers, setExpandedTiers] = useState<Set<TierKey>>(new Set());
  const maxCount = Math.max(...Object.values(analysis.tierCounts), 1);

  const toggleTier = (key: TierKey) => {
    setExpandedTiers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-0">
      {PROVENANCE_TIERS.map((tier, i) => {
        const count = analysis.tierCounts[tier.key];
        const active = count > 0;
        const barWidth = active ? Math.max((count / maxCount) * 100, 8) : 0;
        const isExpanded = expandedTiers.has(tier.key);
        const tierData = analysis.tiers.find(t => t.key === tier.key);
        const hasDetail = active && tierData && tierData.collectors.length > 0;

        const labelColor = active ? 'text-ink' : 'text-ink/20';
        const countColor = active ? 'text-ink' : 'text-ink/15';

        return (
          <div
            key={tier.key}
            className={`${
              i < PROVENANCE_TIERS.length - 1 ? 'border-b border-border/20' : ''
            }`}
            style={{ paddingLeft: `${tier.indent * 16}px` }}
          >
            {/* Tier row — clickable if has collectors */}
            <button
              type="button"
              disabled={!hasDetail}
              onClick={() => hasDetail && toggleTier(tier.key)}
              className={`w-full text-left py-2.5 ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className={`text-sm ${labelColor}`}>
                  {hasDetail && (
                    <span className="text-[10px] mr-1.5 inline-block w-2 text-ink/30">
                      {isExpanded ? '▾' : '▸'}
                    </span>
                  )}
                  {tier.label}
                </span>
                <span className={`tabular-nums text-sm font-light ${countColor}`}>
                  {active ? count : '—'}
                </span>
              </div>
              {active && (
                <div className="h-0.5 bg-border/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold/40 rounded-full"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              )}
            </button>

            {/* Expanded detail — collectors within this tier */}
            {isExpanded && tierData && (
              <div className="pb-3 pl-5">
                {tierData.collectors.map(c => (
                  <div key={c.name} className="py-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-light text-ink/60">
                        {c.name}
                      </span>
                      <span className="text-xs tabular-nums ml-4 shrink-0 text-ink/25">
                        {c.works > 1 ? `${c.works} works` : '1 work'}
                      </span>
                    </div>
                    {(c.meta.koku || c.meta.domain || c.meta.type) && (
                      <div className="text-[11px] text-ink/30 mt-0.5 tracking-wide">
                        {[
                          c.meta.domain,
                          c.meta.koku ? `${formatKoku(c.meta.koku)} koku` : null,
                          c.meta.type,
                        ].filter(Boolean).join('  ·  ')}
                      </div>
                    )}
                    {c.isGroup && c.children && (
                      <div className="pl-4 mt-1">
                        {c.children.map(child => (
                          <div key={child.name} className="flex items-baseline justify-between py-0.5">
                            <span className="text-xs text-ink/35 font-light">{child.name}</span>
                            {child.works > 1 && (
                              <span className="text-[10px] text-ink/20 tabular-nums ml-3">
                                {child.works}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * ProvenanceFactorDisplay — Companion to EliteFactorDisplay.
 *
 * Matches Elite Standing pattern: ratio bar, stats line with (i) icon,
 * percentile, expandable explanation. Percentile is mocked until
 * backend provenance_factor column + distribution API exists.
 */

interface ProvenanceFactorDisplayProps {
  analysis: ProvenanceAnalysis;
  entityType: 'smith' | 'tosogu';
  /** Real percentile from DB (null = use mock estimate) */
  percentile?: number | null;
  /** Real factor from DB (null = use mock from analysis) */
  dbFactor?: number | null;
}

/** Fallback percentile estimate when DB value not available */
function estimatePercentile(factor: number): number {
  if (factor >= 8) return 99;
  if (factor >= 6) return 95;
  if (factor >= 4.5) return 85;
  if (factor >= 3.5) return 70;
  if (factor >= 2.5) return 50;
  return 30;
}

export function ProvenanceFactorDisplay({ analysis, entityType, percentile: dbPercentile, dbFactor }: ProvenanceFactorDisplayProps) {
  const { factor: mockFactor, count, apex, tiers } = analysis;
  const factor = dbFactor ?? mockFactor;
  const [showInfo, setShowInfo] = useState(false);

  const percentile = dbPercentile ?? estimatePercentile(factor);
  const topPct = Math.max(100 - percentile, 1);
  const peerLabel = entityType === 'smith' ? 'smiths' : 'tosogu makers';

  // Bar width: factor is 0-10, show as percentage
  const barPct = Math.min((factor / 10) * 100, 100);

  // Count scored works (top 4 tiers: imperial, shogunal, premier, major)
  const scoredTiers = tiers.filter((t: ProvenanceTierData) => {
    const def = PROVENANCE_TIERS.find(p => p.key === t.key);
    return def?.scored;
  });
  const scoredWorks = scoredTiers.reduce((sum: number, t: ProvenanceTierData) => sum + t.totalWorks, 0);

  return (
    <div className="space-y-4">
      {/* Ratio bar */}
      <div className="w-full">
        <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold/60 rounded-full transition-all duration-700"
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      {/* Stats line */}
      <div className="text-xs text-ink/50 leading-relaxed space-y-0.5">
        <p>
          <span className="text-ink/80">{scoredWorks}</span> work{scoredWorks !== 1 ? 's' : ''} held
          in elite collections across{' '}
          <span className="text-ink/80">{count}</span> documented provenance{count !== 1 ? 's' : ''}
          {/* Info icon */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="inline-flex items-center justify-center w-[15px] h-[15px] ml-1.5 rounded-full
              border border-ink/20 text-ink/35 hover:text-ink/60 hover:border-ink/40
              transition-colors align-middle cursor-pointer
              relative before:absolute before:-inset-3 before:content-['']"
            aria-label="How is Provenance Standing calculated?"
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
        <p className="text-ink/30">
          Raw score: <span className="tabular-nums">{factor.toFixed(2)}</span> / 10
        </p>
      </div>

      {/* Explanation panel */}
      {showInfo && (
        <div className="border-t border-border/20 pt-3 space-y-3">
          <div className="text-[12px] text-ink/50 leading-[1.8] space-y-2.5">
            <p>
              Provenance Standing measures how consistently an artisan&rsquo;s
              certified works were held in historically prestigious collections&mdash;Imperial
              and Shogunal households, premier daim&#x79;&#x14d; clans, and the great
              domain lords of the Edo period.
            </p>
            <p>
              Each documented owner is scored by historical rank: Imperial &amp;
              Shogunal collections score highest, followed by premier daim&#x79;&#x14d;
              houses (500,000+ <em>koku</em>) and major daim&#x79;&#x14d;
              (200,000+ <em>koku</em>). Every provenance observation contributes
              to the weighted average&mdash;works held only by lesser-known collectors
              dilute the score, rewarding both concentration and depth.
            </p>
            <p>
              The score is smoothed with a Bayesian prior so that artisans with
              only one or two documented provenances can&rsquo;t rank
              artificially high. This artisan places in the{' '}
              <span className="text-ink/80">top {topPct}%</span> of
              all {peerLabel} with documented provenance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
