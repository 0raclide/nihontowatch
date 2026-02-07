'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ArtisanDetails } from '@/app/api/artisan/[code]/route';

interface ArtisanCandidate {
  artisan_id: string;
  name_kanji?: string;
  name_romaji?: string;
  school?: string;
  generation?: string;
  is_school_code?: boolean;
  retrieval_method?: string;
  retrieval_score?: number;
}

interface ArtisanTooltipProps {
  listingId: number;
  artisanId: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  method?: string | null;
  candidates?: ArtisanCandidate[] | null;
  verified?: 'correct' | 'incorrect' | null;
  onVerify?: (status: 'correct' | 'incorrect' | null) => void;
  children: React.ReactNode;
}

export function ArtisanTooltip({
  listingId,
  artisanId,
  confidence,
  method,
  candidates,
  verified: initialVerified,
  onVerify,
  children,
}: ArtisanTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const [artisan, setArtisan] = useState<ArtisanDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<'correct' | 'incorrect' | null>(initialVerified ?? null);
  const [verifying, setVerifying] = useState(false);
  const termRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync verified prop with state
  useEffect(() => {
    setVerified(initialVerified ?? null);
  }, [initialVerified]);

  // Fetch artisan details when tooltip opens
  const fetchArtisan = useCallback(async () => {
    if (artisan || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/artisan/${encodeURIComponent(artisanId)}`);
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
  }, [artisanId, artisan, loading]);

  // Fetch on open
  useEffect(() => {
    if (isOpen && !artisan && !loading) {
      fetchArtisan();
    }
  }, [isOpen, artisan, loading, fetchArtisan]);

  // Position tooltip relative to viewport
  useEffect(() => {
    if (isOpen && termRef.current) {
      const rect = termRef.current.getBoundingClientRect();
      const tooltipWidth = 320; // w-80 = 20rem = 320px
      const tooltipHeight = 350; // approximate height
      const padding = 12;

      // Calculate horizontal position
      let left = rect.left;
      if (left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding;
      }
      if (left < padding) {
        left = padding;
      }

      // Calculate vertical position
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top: number;
      if (spaceBelow >= tooltipHeight + padding || spaceBelow >= spaceAbove) {
        // Show below
        top = rect.bottom + 8;
      } else {
        // Show above
        top = rect.top - tooltipHeight - 8;
      }

      setTooltipStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${tooltipWidth}px`,
        zIndex: 10001,
      });
    }
  }, [isOpen]);

  // Close on click outside, window scroll, and escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        termRef.current &&
        !termRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    // Only close on window/document scroll, not scroll inside modals
    const handleScroll = (e: Event) => {
      if (e.target === document || e.target === document.documentElement) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  // Handle verification button click
  const handleVerify = async (newStatus: 'correct' | 'incorrect') => {
    if (verifying) return;

    // Toggle if clicking the same button
    const status = verified === newStatus ? null : newStatus;

    setVerifying(true);
    try {
      const response = await fetch(`/api/listing/${listingId}/verify-artisan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: status }),
      });

      if (response.ok) {
        setVerified(status);
        onVerify?.(status);
      } else {
        console.error('Failed to save verification');
      }
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setVerifying(false);
    }
  };

  // Confidence badge color
  const confidenceColor = {
    HIGH: 'bg-artisan-high-bg text-artisan-high',
    MEDIUM: 'bg-artisan-medium-bg text-artisan-medium',
    LOW: 'bg-artisan-low-bg text-artisan-low',
  }[confidence];

  // Create tooltip portal
  const tooltip =
    isOpen && mounted
      ? createPortal(
          <div
            ref={tooltipRef}
            style={tooltipStyle}
            className="p-4 rounded-lg bg-surface-elevated border border-border shadow-xl animate-fadeIn"
            role="tooltip"
            aria-live="polite"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with code and confidence */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-mono font-semibold text-ink">{artisanId}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${confidenceColor}`}>
                {confidence}
              </span>
            </div>

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-muted border-t-gold rounded-full animate-spin" />
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <p className="text-xs text-red-500 py-2">{error}</p>
            )}

            {/* Artisan details */}
            {!loading && !error && (
              <>
                {/* Name (kanji + romaji) */}
                {artisan ? (
                  <div className="mb-3">
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
                  </div>
                ) : (
                  <p className="text-xs text-muted mb-3">No artisan data found</p>
                )}

                {/* Details grid */}
                {artisan && (artisan.school || artisan.province || artisan.era) && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-xs">
                    {artisan.school && (
                      <>
                        <span className="text-muted">School</span>
                        <span className="text-ink">{artisan.school}</span>
                      </>
                    )}
                    {artisan.province && (
                      <>
                        <span className="text-muted">Province</span>
                        <span className="text-ink">{artisan.province}</span>
                      </>
                    )}
                    {artisan.era && (
                      <>
                        <span className="text-muted">Era</span>
                        <span className="text-ink">{artisan.era}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Stats */}
                {artisan && (artisan.juyo_count > 0 || artisan.tokuju_count > 0) && (
                  <div className="flex gap-4 mb-3 py-2 border-t border-b border-border">
                    {artisan.juyo_count > 0 && (
                      <div className="text-center">
                        <div className="text-lg font-semibold text-ink">{artisan.juyo_count}</div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Juyo</div>
                      </div>
                    )}
                    {artisan.tokuju_count > 0 && (
                      <div className="text-center">
                        <div className="text-lg font-semibold text-ink">{artisan.tokuju_count}</div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Tokuju</div>
                      </div>
                    )}
                    {artisan.total_items > 0 && (
                      <div className="text-center">
                        <div className="text-lg font-semibold text-ink">{artisan.total_items}</div>
                        <div className="text-[9px] uppercase tracking-wider text-muted">Total</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Match method */}
                {method && (
                  <div className="mb-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted">Match: </span>
                    <span className="text-[10px] font-mono text-ink">{method}</span>
                  </div>
                )}

                {/* Alternative Candidates (for QA) */}
                {candidates && candidates.length > 0 && (
                  <div className="mb-3">
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

                {/* Verification buttons */}
                <div className="flex gap-2 pt-3 border-t border-border">
                  <button
                    onClick={() => handleVerify('correct')}
                    disabled={verifying}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                      verified === 'correct'
                        ? 'bg-green-500/20 text-green-500 border border-green-500/50'
                        : 'bg-surface border border-border text-muted hover:text-ink hover:border-green-500/50'
                    } ${verifying ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Correct
                  </button>
                  <button
                    onClick={() => handleVerify('incorrect')}
                    disabled={verifying}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                      verified === 'incorrect'
                        ? 'bg-red-500/20 text-red-500 border border-red-500/50'
                        : 'bg-surface border border-border text-muted hover:text-ink hover:border-red-500/50'
                    } ${verifying ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Incorrect
                  </button>
                </div>
              </>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={termRef}
        type="button"
        data-artisan-tooltip
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className="cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {children}
      </button>
      {tooltip}
    </>
  );
}

export default ArtisanTooltip;
