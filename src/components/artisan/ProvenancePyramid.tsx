'use client';

import { useState } from 'react';
import {
  PROVENANCE_TIERS,
  formatKoku,
  type ProvenanceAnalysis,
  type TierKey,
} from '@/lib/artisan/provenanceMock';

/**
 * ProvenancePyramid — Companion to PrestigePyramid.
 *
 * Shows the distribution of an artisan's provenanced works across
 * collector prestige tiers, from Imperial/Shogunal at the apex
 * to Named Collectors at the base.
 *
 * Visual language mirrors PrestigePyramid: indentation, proportional
 * bars, museum catalog typography. Each tier has its own color
 * (Japanese court rank palette).
 */

const TIER_COLORS: Record<TierKey, string> = {
  imperial: 'var(--prov-imperial)',
  premier:  'var(--prov-premier)',
  major:    'var(--prov-major)',
  mid:      'var(--prov-mid)',
  minor:    'var(--prov-minor)',
};

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
                <span className={`text-sm ${active ? 'text-ink' : 'text-ink/25'}`}>
                  {hasDetail && (
                    <span className="text-ink/30 text-[10px] mr-1.5 inline-block w-2">
                      {isExpanded ? '▾' : '▸'}
                    </span>
                  )}
                  {tier.label}
                </span>
                <span className={`tabular-nums text-sm font-light ${
                  active ? 'text-ink' : 'text-ink/20'
                }`}>
                  {active ? count : '—'}
                </span>
              </div>
              {active && (
                <div className="h-0.5 bg-border/20 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: TIER_COLORS[tier.key],
                      opacity: 0.5,
                    }}
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
                      <span className="text-sm text-ink/60 font-light">{c.name}</span>
                      <span className="text-xs text-ink/25 tabular-nums ml-4 shrink-0">
                        {c.works > 1 ? `${c.works} works` : '1 work'}
                      </span>
                    </div>
                    {/* Koku metadata line — the killer detail */}
                    {(c.meta.koku || c.meta.domain || c.meta.type) && (
                      <div className="text-[11px] text-ink/30 mt-0.5 tracking-wide">
                        {[
                          c.meta.domain,
                          c.meta.koku ? `${formatKoku(c.meta.koku)} koku` : null,
                          c.meta.type,
                        ].filter(Boolean).join('  ·  ')}
                      </div>
                    )}
                    {/* Expanded family members */}
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
 * Shows the computed provenance factor with interpretation.
 */
export function ProvenanceFactorDisplay({ analysis }: { analysis: ProvenanceAnalysis }) {
  const { factor, count, apex } = analysis;

  // Interpretation based on factor value
  let interpretation: string;
  let apexLabel: string;

  if (factor >= 8) {
    interpretation = 'Legendary provenance';
  } else if (factor >= 6) {
    interpretation = 'Premier provenance';
  } else if (factor >= 4.5) {
    interpretation = 'Distinguished provenance';
  } else if (factor >= 3) {
    interpretation = 'Notable provenance';
  } else {
    interpretation = 'Documented provenance';
  }

  if (apex >= 10) apexLabel = 'Reached Imperial & Shogunal collections';
  else if (apex >= 8) apexLabel = 'Reached Premier Daimyō collections';
  else if (apex >= 6) apexLabel = 'Reached Major Daimyō collections';
  else if (apex >= 4) apexLabel = 'Held by institutions & mid-rank daimyō';
  else apexLabel = 'Documented in named collections';

  return (
    <div>
      <h3 className="text-[12px] uppercase tracking-[0.12em] text-ink/50 font-medium mb-3">
        Provenance Factor
      </h3>
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-3xl font-light tabular-nums text-ink">
          {factor.toFixed(1)}
        </span>
        <span className="text-sm text-ink/40 font-light">/ 10</span>
      </div>
      <p className="text-sm text-ink/50 font-light mb-1">{interpretation}</p>
      <p className="text-xs text-ink/30 font-light">{apexLabel}</p>
      <p className="text-xs text-ink/30 font-light mt-1">
        Across {count} documented collection{count !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
