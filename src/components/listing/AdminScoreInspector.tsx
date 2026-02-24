'use client';

import { useState, useCallback } from 'react';
import type { Listing } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface AdminScoreInspectorProps {
  listing: Listing;
  onScoreRecomputed?: (newScore: number) => void;
}

interface HeatItem {
  metric: string;
  raw: number;
  weight: number;
  contribution: number;
  cap: number;
}

interface CompletenessItem {
  label: string;
  active: boolean;
  points: number;
  max: number;
  detail?: string;
}

interface BreakdownData {
  listingId: number;
  breakdown: {
    quality: { total: number; artisanStature: number; certPoints: number; completeness: number };
    artisanDetail: {
      eliteFactor: number;
      eliteFactorPts: number;
      eliteCount: number;
      eliteCountPts: number;
      artisanId: string | null;
      isReal: boolean;
      priceDamping: number;
      priceJpy: number;
      rawStature: number;
    };
    certDetail: { certType: string | null; points: number };
    completenessItems: CompletenessItem[];
    freshness: {
      multiplier: number;
      ageDays: number | null;
      bracket: string;
      isInitialImport: boolean;
      firstSeenAt: string | null;
    };
  };
  heat: { total: number; max: number; items: HeatItem[] };
  score: { computed: number; stored: number | null; stale: boolean; hasImages: boolean };
  rank: { position: number; total: number; filters: { tab: string; category: string; cert: string | null; dealer: string | null } } | null;
  formula: { expression: string; result: number };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AdminScoreInspector({ listing, onScoreRecomputed }: AdminScoreInspectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [data, setData] = useState<BreakdownData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-section toggles
  const [showQuality, setShowQuality] = useState(true);
  const [showHeat, setShowHeat] = useState(false);
  const [showFreshness, setShowFreshness] = useState(false);

  const fetchBreakdown = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Pass current browse filters from URL for rank context
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const queryParams = new URLSearchParams();
      if (urlParams.get('tab')) queryParams.set('tab', urlParams.get('tab')!);
      if (urlParams.get('cat')) queryParams.set('cat', urlParams.get('cat')!);
      if (urlParams.get('cert')) queryParams.set('cert', urlParams.get('cert')!);
      if (urlParams.get('dealer')) queryParams.set('dealer', urlParams.get('dealer')!);

      const res = await fetch(`/api/listing/${listing.id}/score-breakdown?${queryParams}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch breakdown');
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setIsLoading(false);
    }
  }, [listing.id]);

  const handleToggle = useCallback(() => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next && !data && !isLoading) {
      fetchBreakdown();
    }
  }, [isExpanded, data, isLoading, fetchBreakdown]);

  const handleRecompute = useCallback(async () => {
    setIsRecomputing(true);
    try {
      const res = await fetch(`/api/listing/${listing.id}/recompute-score`, { method: 'POST' });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Recompute failed');
      }

      onScoreRecomputed?.(json.score);
      // Refresh breakdown data
      await fetchBreakdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recompute failed');
    } finally {
      setIsRecomputing(false);
    }
  }, [listing.id, onScoreRecomputed, fetchBreakdown]);

  const storedScore = listing.featured_score ?? null;

  return (
    <div className="mb-3 border border-dashed border-gold/40 rounded-lg bg-gold/5">
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-4 py-2.5 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-[12px] font-medium text-gold uppercase tracking-wider">
            Score Inspector
          </span>
          {/* Score badge */}
          <span className="text-[11px] font-mono font-semibold text-ink tabular-nums">
            {storedScore !== null ? storedScore.toFixed(1) : '—'}
          </span>
          {/* Rank pill (only if data loaded) */}
          {data?.rank && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gold/10 text-gold tabular-nums">
              #{data.rank.position} of {data.rank.total}
            </span>
          )}
          {/* Stale indicator */}
          {data?.score.stale && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
              stale
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gold transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {isLoading && !data && (
            <div className="flex items-center gap-2 py-3">
              <svg className="w-4 h-4 text-gold animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-[12px] text-muted">Loading breakdown...</span>
            </div>
          )}

          {error && (
            <div className="p-2 bg-error/10 border border-error/20 rounded text-[12px] text-error">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Formula bar */}
              <div className="p-2.5 bg-paper border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted font-mono">
                    ({data.breakdown.quality.total} + {data.heat.total}) × {data.breakdown.freshness.multiplier}
                  </span>
                  <span className="text-[13px] font-semibold text-ink font-mono tabular-nums">
                    = {data.score.computed}
                  </span>
                </div>
                {!data.score.hasImages && (
                  <div className="mt-1 text-[10px] text-amber-600">No images → score forced to 0</div>
                )}
                {data.score.stale && (
                  <div className="mt-1 text-[10px] text-amber-600">
                    Stored: {data.score.stored} ≠ Computed: {data.score.computed}
                  </div>
                )}
              </div>

              {/* Quality section */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowQuality(!showQuality)}
                  className="w-full flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-ink uppercase tracking-wider">Quality</span>
                    <span className="text-[11px] font-mono text-muted tabular-nums">
                      {data.breakdown.quality.total} / 395
                    </span>
                  </div>
                  <svg className={`w-3 h-3 text-muted transition-transform ${showQuality ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showQuality && (
                  <div className="ml-2 space-y-2 pb-2">
                    {/* Artisan Stature */}
                    <div className="p-2 bg-paper/50 rounded border border-border/50">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted">Artisan Stature</span>
                        <span className="font-mono text-ink tabular-nums">
                          {Math.round(data.breakdown.quality.artisanStature * 100) / 100}
                        </span>
                      </div>
                      {data.breakdown.artisanDetail.isReal ? (
                        <div className="mt-1 space-y-0.5 text-[10px] text-muted">
                          <div className="flex justify-between">
                            <span>elite_factor ({data.breakdown.artisanDetail.eliteFactor}) × 200</span>
                            <span className="font-mono tabular-nums">{data.breakdown.artisanDetail.eliteFactorPts}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>√elite_count ({data.breakdown.artisanDetail.eliteCount}) × 18</span>
                            <span className="font-mono tabular-nums">{data.breakdown.artisanDetail.eliteCountPts}</span>
                          </div>
                          {data.breakdown.artisanDetail.priceDamping < 1 && (
                            <div className="flex justify-between text-amber-500">
                              <span>price damping (¥{data.breakdown.artisanDetail.priceJpy.toLocaleString()} / ¥500K)</span>
                              <span className="font-mono tabular-nums">×{data.breakdown.artisanDetail.priceDamping}</span>
                            </div>
                          )}
                          <div className="text-[9px] text-muted/60">{data.breakdown.artisanDetail.artisanId}</div>
                        </div>
                      ) : (
                        <div className="mt-1 text-[10px] text-muted/60">
                          No real artisan match → 0
                        </div>
                      )}
                    </div>

                    {/* Cert Points */}
                    <div className="flex justify-between text-[11px] px-2">
                      <span className="text-muted">
                        Cert: {data.breakdown.certDetail.certType || 'none'}
                      </span>
                      <span className="font-mono text-ink tabular-nums">{data.breakdown.certDetail.points} / 40</span>
                    </div>

                    {/* Completeness */}
                    <div className="p-2 bg-paper/50 rounded border border-border/50">
                      <div className="flex justify-between text-[11px] mb-1.5">
                        <span className="text-muted">Completeness</span>
                        <span className="font-mono text-ink tabular-nums">{data.breakdown.quality.completeness} / 55</span>
                      </div>
                      <div className="space-y-1">
                        {data.breakdown.completenessItems.map((item) => (
                          <div key={item.label} className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <span className={item.active ? 'text-green-500' : 'text-muted/40'}>
                                {item.active ? '✓' : '✗'}
                              </span>
                              <span className={item.active ? 'text-ink' : 'text-muted/60'}>
                                {item.label}
                              </span>
                              {item.detail && (
                                <span className="text-muted/40 truncate max-w-[120px]">
                                  ({item.detail})
                                </span>
                              )}
                            </div>
                            <span className="font-mono tabular-nums text-muted">
                              {item.points}/{item.max}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Heat section */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowHeat(!showHeat)}
                  className="w-full flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-ink uppercase tracking-wider">Heat</span>
                    <span className="text-[11px] font-mono text-muted tabular-nums">
                      {data.heat.total} / {data.heat.max}
                    </span>
                  </div>
                  <svg className={`w-3 h-3 text-muted transition-transform ${showHeat ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showHeat && (
                  <div className="ml-2 pb-2">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="text-muted">
                          <th className="text-left font-normal pb-1">Metric</th>
                          <th className="text-right font-normal pb-1">Raw</th>
                          <th className="text-right font-normal pb-1">×W</th>
                          <th className="text-right font-normal pb-1">Pts</th>
                          <th className="text-right font-normal pb-1">Cap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.heat.items.map((item) => (
                          <tr key={item.metric} className={item.raw > 0 ? 'text-ink' : 'text-muted/50'}>
                            <td className="py-0.5">{item.metric}</td>
                            <td className="text-right font-mono tabular-nums">{item.raw}</td>
                            <td className="text-right font-mono tabular-nums">×{item.weight}</td>
                            <td className="text-right font-mono tabular-nums">{item.contribution}</td>
                            <td className="text-right font-mono tabular-nums text-muted/40">/{item.cap}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Freshness section */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowFreshness(!showFreshness)}
                  className="w-full flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-ink uppercase tracking-wider">Freshness</span>
                    <span className="text-[11px] font-mono text-muted tabular-nums">
                      ×{data.breakdown.freshness.multiplier}
                    </span>
                  </div>
                  <svg className={`w-3 h-3 text-muted transition-transform ${showFreshness ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showFreshness && (
                  <div className="ml-2 pb-2 space-y-1 text-[10px]">
                    <div className="flex justify-between text-muted">
                      <span>Age</span>
                      <span className="font-mono tabular-nums text-ink">
                        {data.breakdown.freshness.ageDays !== null ? `${data.breakdown.freshness.ageDays} days` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Bracket</span>
                      <span className="text-ink">{data.breakdown.freshness.bracket}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Multiplier</span>
                      <span className="font-mono tabular-nums text-ink">×{data.breakdown.freshness.multiplier}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Initial import</span>
                      <span className="text-ink">{data.breakdown.freshness.isInitialImport ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Rank */}
              {data.rank && (
                <div className="p-2 bg-paper border border-border rounded text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted">Rank in feed</span>
                    <span className="font-mono font-semibold text-ink tabular-nums">
                      #{data.rank.position} of {data.rank.total}
                    </span>
                  </div>
                  <div className="mt-1 text-[9px] text-muted/60">
                    {data.rank.filters.tab} · {data.rank.filters.category}
                    {data.rank.filters.cert ? ` · ${data.rank.filters.cert}` : ''}
                    {data.rank.filters.dealer ? ` · dealer:${data.rank.filters.dealer}` : ''}
                  </div>
                </div>
              )}

              {/* Recompute button */}
              <button
                type="button"
                onClick={handleRecompute}
                disabled={isRecomputing}
                className="w-full px-3 py-2 text-[12px] font-medium text-gold bg-gold/10 hover:bg-gold/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {isRecomputing ? 'Recomputing...' : 'Recompute Score'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
