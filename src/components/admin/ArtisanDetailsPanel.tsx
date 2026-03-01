'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { ArtisanDetails } from '@/app/api/artisan/[code]/route';
import type { ArtisanCandidate } from '@/types/artisan';
import { useLocale } from '@/i18n/LocaleContext';
import { eraToBroadPeriod } from '@/lib/artisan/eraPeriods';

// =============================================================================
// TYPES
// =============================================================================

interface ArtisanDetailsPanelProps {
  artisanId: string;
  confidence?: string | null;
  method?: string | null;
  candidates?: ArtisanCandidate[] | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Display panel showing artisan details fetched from the Yuhinkai database.
 * Used in AdminEditView to give admins full context about the matched artisan.
 */
export function ArtisanDetailsPanel({
  artisanId,
  confidence,
  method,
  candidates,
}: ArtisanDetailsPanelProps) {
  const { t } = useLocale();
  const td = (category: string, v: string | null | undefined) => {
    if (!v) return v;
    const k = `${category}.${v}`;
    const r = t(k);
    return r === k ? v : r;
  };

  const [artisan, setArtisan] = useState<ArtisanDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track which artisanId we've fetched to prevent re-fetching on re-render
  const fetchedForRef = useRef<string | null>(null);

  const fetchArtisan = useCallback(async (code: string) => {
    if (!code || code === 'UNKNOWN') return;
    if (fetchedForRef.current === code) return;

    fetchedForRef.current = code;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/artisan/${encodeURIComponent(code)}`);
      if (response.ok) {
        const data = await response.json();
        setArtisan(data.artisan);
      } else if (response.status === 404) {
        setArtisan(null);
      } else {
        setError('Failed to load artisan details');
      }
    } catch {
      setError('Failed to load artisan details');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and when artisanId changes
  useEffect(() => {
    if (artisanId && artisanId !== 'UNKNOWN') {
      // Reset if artisanId changed
      if (fetchedForRef.current !== artisanId) {
        setArtisan(null);
        fetchedForRef.current = null;
      }
      fetchArtisan(artisanId);
    } else {
      setArtisan(null);
      fetchedForRef.current = null;
    }
  }, [artisanId, fetchArtisan]);

  // --- Loading state ---
  if (loading) {
    return (
      <div className="mb-3 p-3 bg-cream/50 border border-border rounded-lg">
        <div className="flex items-center justify-center py-4" data-testid="artisan-details-loading">
          <div className="w-5 h-5 border-2 border-muted border-t-gold rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="mb-3 p-3 bg-cream/50 border border-border rounded-lg">
        <p className="text-xs text-red-500">{error}</p>
      </div>
    );
  }

  // --- UNKNOWN artisan ---
  if (artisanId === 'UNKNOWN') {
    return (
      <div className="mb-3 p-3 bg-cream/50 border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-semibold text-ink">UNKNOWN</span>
          {confidence && (
            <span className={`text-[10px] font-medium ${
              confidence === 'HIGH' ? 'text-artisan-high'
                : confidence === 'MEDIUM' ? 'text-artisan-medium'
                : 'text-artisan-low'
            }`}>
              {confidence}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted">Flagged for later identification</p>
      </div>
    );
  }

  // --- No data loaded yet (or 404) ---
  if (!artisan) {
    return (
      <div className="mb-3 p-3 bg-cream/50 border border-border rounded-lg">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-sm font-semibold text-ink">{artisanId}</span>
          {confidence && (
            <span className={`text-[10px] font-medium ${
              confidence === 'HIGH' ? 'text-artisan-high'
                : confidence === 'MEDIUM' ? 'text-artisan-medium'
                : 'text-artisan-low'
            }`}>
              {confidence}
            </span>
          )}
        </div>
        <p className="text-xs text-muted">No artisan data found</p>
      </div>
    );
  }

  // --- Full artisan details ---
  const hasCerts = (
    artisan.kokuho_count > 0 || artisan.jubun_count > 0 || artisan.jubi_count > 0 ||
    artisan.gyobutsu_count > 0 || artisan.tokuju_count > 0 || artisan.juyo_count > 0
  );

  return (
    <div className="mb-3 p-3 bg-cream/50 border border-border rounded-lg" data-testid="artisan-details-panel">
      {/* Name: kanji (gold) + romaji + school badge */}
      <div className="mb-2">
        {artisan.name_kanji && (
          <span className="text-lg font-jp text-gold mr-2">{artisan.name_kanji}</span>
        )}
        {artisan.name_romaji && (
          <span className="text-sm text-ink">{artisan.name_romaji}</span>
        )}
        {artisan.is_school_code && (
          <span className="ml-2 text-[9px] uppercase tracking-wider text-muted bg-surface px-1.5 py-0.5 rounded">
            School
          </span>
        )}
        {confidence && (
          <span className={`ml-2 text-[10px] font-medium ${
            confidence === 'HIGH' ? 'text-artisan-high'
              : confidence === 'MEDIUM' ? 'text-artisan-medium'
              : 'text-artisan-low'
          }`}>
            {confidence}
          </span>
        )}
      </div>

      {/* Details grid: School, Province, Era */}
      {(artisan.school || artisan.province || artisan.era) && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-xs">
          {artisan.school && (
            <>
              <span className="text-muted">School</span>
              <span className="text-ink">{td('school', artisan.school)}</span>
            </>
          )}
          {artisan.province && (
            <>
              <span className="text-muted">Province</span>
              <span className="text-ink">{td('province', artisan.province)}</span>
            </>
          )}
          {artisan.era && (
            <>
              <span className="text-muted">Era</span>
              <span className="text-ink">{td('period', eraToBroadPeriod(artisan.era) || artisan.era)}</span>
            </>
          )}
        </div>
      )}

      {/* Elite Standing */}
      {artisan.elite_factor !== null && artisan.elite_factor !== undefined && (
        <div className="mb-3 py-2 border-t border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted">Elite Standing</span>
            <span className="text-sm font-semibold text-gold" data-testid="elite-percentage">
              {artisan.elite_factor.toFixed(2)}
            </span>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold/60 to-gold rounded-full transition-all duration-300"
              style={{ width: `${Math.min(artisan.elite_factor / 2.0 * 100, 100)}%` }}
              data-testid="elite-bar"
            />
          </div>
          <div className="text-[9px] text-muted mt-1">
            {artisan.elite_count || 0} elite works / {artisan.total_items || 0} total
          </div>
        </div>
      )}

      {/* Certification Counts - 2 rows of 3 */}
      {hasCerts && (
        <div className="mb-3 py-2 border-t border-b border-border" data-testid="cert-counts">
          {/* Row 1: Kokuho, Jubun, Jubi */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="text-center">
              <div className={`text-lg font-semibold ${artisan.kokuho_count > 0 ? 'text-gold' : 'text-muted/30'}`}>
                {artisan.kokuho_count || 0}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-muted">Kokuho</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-semibold ${artisan.jubun_count > 0 ? 'text-ink' : 'text-muted/30'}`}>
                {artisan.jubun_count || 0}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-muted">Jubun</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-semibold ${artisan.jubi_count > 0 ? 'text-ink' : 'text-muted/30'}`}>
                {artisan.jubi_count || 0}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-muted">Jubi</div>
            </div>
          </div>
          {/* Row 2: Imperial, Tokuju, Juyo */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className={`text-lg font-semibold ${artisan.gyobutsu_count > 0 ? 'text-ink' : 'text-muted/30'}`}>
                {artisan.gyobutsu_count || 0}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-muted">Imperial</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-semibold ${artisan.tokuju_count > 0 ? 'text-ink' : 'text-muted/30'}`}>
                {artisan.tokuju_count || 0}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-muted">Tokuju</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-semibold ${artisan.juyo_count > 0 ? 'text-ink' : 'text-muted/30'}`}>
                {artisan.juyo_count || 0}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-muted">Juyo</div>
            </div>
          </div>
        </div>
      )}

      {/* Match method */}
      {method && (
        <div className="mb-3">
          <span className="text-[10px] uppercase tracking-wider text-muted">Match: </span>
          <span className="text-[10px] font-mono text-ink">{method}</span>
        </div>
      )}

      {/* Alternative Candidates */}
      {candidates && candidates.length > 0 && (
        <div className="mb-3" data-testid="artisan-candidates">
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
            Alternative candidates:
          </div>
          <div className="space-y-1.5">
            {candidates.slice(0, 3).map((c, i) => {
              const displayName = c.name_romaji || c.name_kanji || '';
              const genSuffix = c.generation ? ` (${c.generation})` : '';
              return (
                <div key={i} className="text-[10px] border-l-2 border-border pl-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-medium text-ink">{c.artisan_id}</span>
                    {c.is_school_code && (
                      <span className="text-[8px] uppercase text-muted bg-surface px-1 rounded">school</span>
                    )}
                  </div>
                  {displayName && (
                    <div className="text-ink/80">{displayName}{genSuffix}</div>
                  )}
                  {c.school && (
                    <div className="text-muted">{c.school}</div>
                  )}
                  {c.retrieval_method && (
                    <div className="text-[9px] text-muted/70 italic">via {c.retrieval_method.replace(/_/g, ' ')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View Profile link */}
      <Link
        href={`/artists/${artisanId}`}
        className="block pt-2 border-t border-border text-center text-xs font-medium text-gold hover:text-gold-light transition-colors"
        data-testid="view-profile-link"
      >
        View Profile →
      </Link>
    </div>
  );
}

export default ArtisanDetailsPanel;
