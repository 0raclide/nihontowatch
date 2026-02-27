'use client';

import { useState, useEffect, useCallback } from 'react';
import { isTosogu, type Listing } from '@/types';
import type { ArtisanSearchResult } from '@/app/api/artisan/search/route';
import type { ArtisanCandidate } from '@/types/artisan';
import { CertPillRow } from '@/components/admin/CertPillRow';
import { ArtisanSearchPanel } from '@/components/admin/ArtisanSearchPanel';
import { ArtisanDetailsPanel } from '@/components/admin/ArtisanDetailsPanel';
import { FieldEditSection } from '@/components/admin/FieldEditSection';

// =============================================================================
// TYPES
// =============================================================================

interface AdminEditViewProps {
  listing: Listing;
  onBackToPhotos: () => void;
  onRefresh: (optimisticFields?: Partial<Listing>) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AdminEditView({ listing, onBackToPhotos, onRefresh }: AdminEditViewProps) {
  // --- Artisan state ---
  const [artisanId, setArtisanId] = useState(listing.artisan_id || '');
  const [confidence, setConfidence] = useState<'HIGH' | 'MEDIUM' | 'LOW'>(
    (listing.artisan_confidence as 'HIGH' | 'MEDIUM' | 'LOW') || 'LOW'
  );
  const [verified, setVerified] = useState<'correct' | 'incorrect' | null>(
    (listing.artisan_verified as 'correct' | 'incorrect' | null) ?? null
  );
  const [method, setMethod] = useState<string | null>(listing.artisan_method ?? null);
  const [candidates, setCandidates] = useState<ArtisanCandidate[] | null>(
    (listing.artisan_candidates as ArtisanCandidate[] | null) ?? null
  );
  const [verifying, setVerifying] = useState(false);
  const hasArtisan = !!artisanId && artisanId !== 'UNKNOWN';

  // --- Search state ---
  const [showSearch, setShowSearch] = useState(!listing.artisan_id || listing.artisan_id === 'UNKNOWN');
  const [fixing, setFixing] = useState(false);
  const [fixSuccess, setFixSuccess] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // --- Hide state ---
  const [localHidden, setLocalHidden] = useState(listing.admin_hidden ?? false);

  // --- Status override state ---
  const [localSold, setLocalSold] = useState(listing.is_sold ?? false);
  const [localStatusLocked, setLocalStatusLocked] = useState(listing.status_admin_locked ?? false);

  // --- Error ---
  const [error, setError] = useState<string | null>(null);

  // Derive artisan search domain from item type
  const searchDomain = listing.item_type
    ? isTosogu(listing.item_type) ? 'tosogu' as const : 'smith' as const
    : undefined;

  // Sync state when listing changes
  useEffect(() => {
    setArtisanId(listing.artisan_id || '');
    setConfidence((listing.artisan_confidence as 'HIGH' | 'MEDIUM' | 'LOW') || 'LOW');
    setMethod(listing.artisan_method ?? null);
    setCandidates((listing.artisan_candidates as ArtisanCandidate[] | null) ?? null);
    setVerified((listing.artisan_verified as 'correct' | 'incorrect' | null) ?? null);
    setLocalHidden(listing.admin_hidden ?? false);
    setLocalSold(listing.is_sold ?? false);
    setLocalStatusLocked(listing.status_admin_locked ?? false);
    setShowSearch(!listing.artisan_id || listing.artisan_id === 'UNKNOWN');
    setFixSuccess(false);
    setSearchError(null);
    setError(null);
  }, [listing.id]);

  // Helper to dispatch listing-refreshed event
  const dispatchRefresh = useCallback((fields: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent('listing-refreshed', {
      detail: { id: listing.id, ...fields },
    }));
  }, [listing.id]);

  // --- Verify artisan ---
  const handleVerify = async (newStatus: 'correct' | 'incorrect') => {
    if (verifying) return;
    const status = verified === newStatus ? null : newStatus;
    setVerifying(true);
    try {
      const res = await fetch(`/api/listing/${listing.id}/verify-artisan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: status }),
      });
      if (res.ok) {
        setVerified(status);
        if (status === 'incorrect') {
          setShowSearch(true);
        } else {
          setShowSearch(false);
        }
      }
    } catch {
      // silent
    } finally {
      setVerifying(false);
    }
  };

  // --- Select artisan from search ---
  const handleSelectArtisan = async (result: ArtisanSearchResult) => {
    if (fixing) return;
    setFixing(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/listing/${listing.id}/fix-artisan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artisan_id: result.code, confidence: 'HIGH' }),
      });
      if (res.ok) {
        setArtisanId(result.code);
        setConfidence('HIGH');
        setMethod('ADMIN_CORRECTION');
        setCandidates(null);
        setVerified('correct');
        setFixSuccess(true);
        setShowSearch(false);
        const optimistic = {
          artisan_id: result.code,
          artisan_confidence: 'HIGH',
          artisan_method: 'ADMIN_CORRECTION',
          artisan_verified: 'correct',
          artisan_candidates: null,
          artisan_display_name: result.display_name || result.name_romaji || result.code,
        };
        onRefresh(optimistic as Partial<Listing>);
        dispatchRefresh(optimistic);
        setTimeout(() => setFixSuccess(false), 3000);
      } else {
        const data = await res.json();
        setSearchError(data.error || 'Failed to update artisan');
      }
    } catch {
      setSearchError('Failed to update artisan');
    } finally {
      setFixing(false);
    }
  };

  // --- Mark as UNKNOWN ---
  const handleSetUnknown = async () => {
    if (fixing) return;
    setFixing(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/listing/${listing.id}/fix-artisan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artisan_id: 'UNKNOWN', confidence: 'LOW' }),
      });
      if (res.ok) {
        setArtisanId('UNKNOWN');
        setConfidence('LOW');
        setMethod('ADMIN_CORRECTION');
        setCandidates(null);
        setVerified('correct');
        setFixSuccess(true);
        setShowSearch(false);
        const optimistic = {
          artisan_id: 'UNKNOWN',
          artisan_confidence: 'LOW',
          artisan_method: 'ADMIN_CORRECTION',
          artisan_verified: 'correct',
          artisan_candidates: null,
          artisan_display_name: 'Unlisted artist',
        };
        onRefresh(optimistic as Partial<Listing>);
        dispatchRefresh(optimistic);
        setTimeout(() => setFixSuccess(false), 3000);
      } else {
        const data = await res.json();
        setSearchError(data.error || 'Failed to mark as unknown');
      }
    } catch {
      setSearchError('Failed to mark as unknown');
    } finally {
      setFixing(false);
    }
  };

  // --- Toggle hide ---
  const handleToggleHidden = async () => {
    const newHidden = !localHidden;
    const action = newHidden ? 'hide' : 'unhide';
    if (!window.confirm(`Are you sure you want to ${action} this listing?`)) return;

    setLocalHidden(newHidden);
    try {
      const res = await fetch(`/api/listing/${listing.id}/hide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: newHidden }),
      });
      if (res.ok) {
        onRefresh({ admin_hidden: newHidden } as Partial<Listing>);
        dispatchRefresh({ admin_hidden: newHidden });
      } else {
        setLocalHidden(!newHidden); // revert
      }
    } catch {
      setLocalHidden(!newHidden); // revert
    }
  };

  // --- Toggle sold/available ---
  const handleToggleSold = async () => {
    const markAsSold = !localSold;
    const action = markAsSold ? 'mark as sold' : 'mark as available';
    if (!window.confirm(`Are you sure you want to ${action}?`)) return;

    setLocalSold(markAsSold);
    setLocalStatusLocked(true);
    try {
      const res = await fetch(`/api/listing/${listing.id}/set-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sold: markAsSold }),
      });
      if (res.ok) {
        const optimistic = {
          status: markAsSold ? 'sold' : 'available',
          is_available: !markAsSold,
          is_sold: markAsSold,
          status_admin_locked: true,
        };
        onRefresh(optimistic as Partial<Listing>);
        dispatchRefresh(optimistic);
      } else {
        setLocalSold(!markAsSold); // revert
        setLocalStatusLocked(listing.status_admin_locked ?? false);
      }
    } catch {
      setLocalSold(!markAsSold); // revert
      setLocalStatusLocked(listing.status_admin_locked ?? false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-linen" data-testid="admin-edit-view">
      {/* Sticky header — matches StudySetsumeiView pattern */}
      <div className="px-4 py-3 border-b border-gold/20 bg-cream/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] uppercase tracking-wider text-gold font-semibold">
            Admin Edit
          </h2>
          <button
            onClick={onBackToPhotos}
            className="flex items-center gap-1.5 text-[12px] text-gold hover:text-gold-light transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            View Photos
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-4 space-y-4">

          {/* Error banner */}
          {error && (
            <div className="py-2 px-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-500">
              {error}
            </div>
          )}

          {/* Hidden status banner */}
          {localHidden && (
            <div className="py-2 px-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              <span className="text-xs font-medium text-red-700 dark:text-red-400">
                This listing is hidden from public views
              </span>
            </div>
          )}

          {/* ─── Certification Designation ─── */}
          <div className="pb-4 border-b border-border">
            <CertPillRow
              listingId={listing.id}
              initialCertType={listing.cert_type}
              onChanged={(cert) => {
                onRefresh({ cert_type: cert } as Partial<Listing>);
                dispatchRefresh({ cert_type: cert });
              }}
            />
          </div>

          {/* ─── Field Editing (collapsed by default — 95% of corrections are cert/artisan) ─── */}
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-2 text-[10px] uppercase tracking-wider text-muted hover:text-ink transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
              <span>Edit Metadata Fields</span>
              <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="pt-1">
              <FieldEditSection listing={listing} onRefresh={onRefresh} />
            </div>
          </details>

          {/* ─── Artisan Section ─── */}
          <div className="pb-4 border-b border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-2.5">
              Artisan
            </div>

            {/* Current artisan details */}
            {(hasArtisan || artisanId === 'UNKNOWN') ? (
              <ArtisanDetailsPanel
                artisanId={artisanId}
                confidence={confidence}
                method={method}
                candidates={candidates}
              />
            ) : (
              <p className="text-xs text-muted mb-3">No artisan assigned</p>
            )}

            {/* Verify buttons */}
            {(hasArtisan || artisanId === 'UNKNOWN') && (
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => handleVerify('correct')}
                  disabled={verifying}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    verified === 'correct'
                      ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/50'
                      : 'bg-surface border border-border text-muted hover:text-ink hover:border-green-500/50'
                  } ${verifying ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Correct
                </button>
                <button
                  onClick={() => handleVerify('incorrect')}
                  disabled={verifying}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    verified === 'incorrect'
                      ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/50'
                      : 'bg-surface border border-border text-muted hover:text-ink hover:border-red-500/50'
                  } ${verifying ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Incorrect
                </button>
              </div>
            )}

            {/* Success message */}
            {fixSuccess && (
              <div className="mb-3 py-2 px-3 bg-green-500/10 border border-green-500/30 rounded-lg text-xs text-green-500 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Artisan updated
              </div>
            )}

            {/* Search / Reassign button */}
            {!showSearch && !fixSuccess && (
              <button
                onClick={() => setShowSearch(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium bg-surface border border-border text-muted hover:text-ink hover:border-gold/50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {hasArtisan ? 'Reassign Artisan' : 'Search & Assign'}
              </button>
            )}

            {/* Search panel */}
            {showSearch && !fixSuccess && (
              <div className="mt-3 p-3 bg-cream/50 border border-border rounded-lg">
                <ArtisanSearchPanel
                  onSelect={handleSelectArtisan}
                  onSetUnknown={handleSetUnknown}
                  onCancel={() => {
                    setShowSearch(false);
                    setSearchError(null);
                  }}
                  disabled={fixing}
                  successMessage={fixSuccess ? 'Artisan updated' : null}
                  errorMessage={searchError}
                  autoFocus
                  domain={searchDomain}
                />
              </div>
            )}
          </div>

          {/* ─── Status Override (Sold / Available) ─── */}
          <div>
            {localStatusLocked && (
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wider">
                  Status manually overridden
                </span>
              </div>
            )}
            <button
              onClick={handleToggleSold}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                localSold
                  ? 'bg-surface border border-green-500/30 text-green-600 hover:bg-green-500/10 dark:text-green-400'
                  : 'bg-surface border border-amber-500/30 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400'
              }`}
            >
              {localSold ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Mark as Available
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Mark as Sold
                </>
              )}
            </button>
          </div>

          {/* ─── Hide / Unhide ─── */}
          <div>
            <button
              onClick={handleToggleHidden}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                localHidden
                  ? 'bg-surface border border-green-500/30 text-green-600 hover:bg-green-500/10 dark:text-green-400'
                  : 'bg-surface border border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400'
              }`}
            >
              {localHidden ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Unhide Listing
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  Hide Listing
                </>
              )}
            </button>
          </div>

        </div>

        {/* Bottom safe area padding */}
        <div className="h-4" />
      </div>
    </div>
  );
}

export default AdminEditView;
