'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Listing } from '@/types';
import { isTosogu } from '@/types';
import type { ArtisanSearchResult } from '@/app/api/artisan/search/route';

// =============================================================================
// TYPES
// =============================================================================

interface AdminArtisanWidgetProps {
  listing: Listing;
  onArtisanChanged?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Admin widget for manually assigning artisan codes to listings.
 * Follows the same collapsible pattern as AdminSetsumeiWidget.
 */
export function AdminArtisanWidget({ listing, onArtisanChanged }: AdminArtisanWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ArtisanSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const hasArtisan = !!listing.artisan_id;

  // Determine search type hint based on listing item_type
  const searchType = listing.item_type && isTosogu(listing.item_type)
    ? 'tosogu'
    : listing.item_type
      ? 'smith'
      : 'all';

  // Reset state when collapsing
  const handleToggle = useCallback(() => {
    if (isExpanded) {
      setSearchQuery('');
      setSearchResults([]);
      setSearchError(null);
      setError(null);
      setSuccessMessage(null);
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  // Focus search input when expanded
  useEffect(() => {
    if (isExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isExpanded]);

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const debounceTimeout = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);

      try {
        const params = new URLSearchParams({
          q: searchQuery,
          type: searchType,
          limit: '10',
        });
        const response = await fetch(`/api/artisan/search?${params}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.results || []);
        } else {
          const data = await response.json();
          setSearchError(data.error || 'Search failed');
          setSearchResults([]);
        }
      } catch {
        setSearchError('Search failed');
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery, searchType]);

  // Handle setting artisan as UNKNOWN (for later refinement)
  const handleSetUnknown = async () => {
    if (fixing) return;

    setFixing(true);
    setError(null);

    try {
      const response = await fetch(`/api/listing/${listing.id}/fix-artisan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artisan_id: 'UNKNOWN',
          confidence: 'LOW',
        }),
      });

      if (response.ok) {
        setSuccessMessage('Marked as UNKNOWN');
        setSearchQuery('');
        setSearchResults([]);
        onArtisanChanged?.();
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to mark as unknown');
      }
    } catch {
      setError('Failed to mark as unknown');
    } finally {
      setFixing(false);
    }
  };

  // Handle selecting a search result
  const handleSelectArtisan = async (result: ArtisanSearchResult) => {
    if (fixing) return;

    setFixing(true);
    setError(null);

    try {
      const response = await fetch(`/api/listing/${listing.id}/fix-artisan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artisan_id: result.code,
          confidence: 'HIGH',
        }),
      });

      if (response.ok) {
        const displayName = result.name_romaji || result.name_kanji || result.code;
        setSuccessMessage(`Assigned: ${displayName} (${result.code})`);
        setSearchQuery('');
        setSearchResults([]);

        // Notify parent to refresh listing data
        onArtisanChanged?.();

        // Clear success after delay
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to assign artisan');
      }
    } catch {
      setError('Failed to assign artisan');
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="mb-6 border border-dashed border-gold/40 rounded-lg bg-gold/5">
      {/* Header - Always visible */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[12px] font-medium text-gold uppercase tracking-wider">
            Admin: Set Artisan
          </span>
          {hasArtisan ? (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-600 rounded font-mono">
              {listing.artisan_display_name || listing.artisan_id}
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 bg-muted/10 text-muted rounded">
              None
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gold transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Success Message */}
          {successMessage && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-[13px] text-green-600">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg">
              <p className="text-[13px] text-error">{error}</p>
            </div>
          )}

          {/* Search Input */}
          <div>
            <label className="block text-[11px] text-muted uppercase tracking-wider mb-2">
              Search artisan by name, code, or school
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, code, or school..."
                className="w-full px-3 py-2 text-[13px] bg-paper border border-border rounded-lg focus:outline-none focus:border-gold text-ink placeholder:text-muted"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-muted border-t-gold rounded-full animate-spin" />
                </div>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">
              Searching {searchType === 'tosogu' ? 'tosogu makers' : searchType === 'smith' ? 'smiths' : 'all artisans'} based on item type
            </p>
          </div>

          {/* Search Error */}
          {searchError && (
            <p className="text-[11px] text-error">{searchError}</p>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="max-h-64 overflow-y-auto space-y-1 scrollbar-thin">
              {searchResults.map((result) => (
                <button
                  key={result.code}
                  onClick={() => handleSelectArtisan(result)}
                  disabled={fixing}
                  className={`w-full text-left p-2.5 rounded-lg border border-border hover:border-gold/50 hover:bg-gold/5 transition-colors ${
                    fixing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono text-[12px] font-medium text-gold">
                      {result.code}
                    </span>
                    <span className="text-[9px] text-muted uppercase">
                      {result.type === 'smith' ? 'Smith' : 'Tosogu'}
                    </span>
                  </div>
                  <div className="text-[13px] text-ink">
                    {result.name_kanji && (
                      <span className="font-jp mr-1">{result.name_kanji}</span>
                    )}
                    {result.name_romaji && (
                      <span>{result.name_romaji}</span>
                    )}
                    {result.generation && (
                      <span className="text-muted ml-1">({result.generation})</span>
                    )}
                  </div>
                  {(result.school || result.province || result.era) && (
                    <div className="text-[11px] text-muted mt-0.5">
                      {[result.school, result.province, result.era].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {(result.juyo_count > 0 || result.tokuju_count > 0) && (
                    <div className="text-[11px] text-muted mt-0.5">
                      {result.tokuju_count > 0 && `${result.tokuju_count} Tokuju`}
                      {result.tokuju_count > 0 && result.juyo_count > 0 && ' · '}
                      {result.juyo_count > 0 && `${result.juyo_count} Juyo`}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && !searchError && (
            <p className="text-[11px] text-muted text-center py-2">
              No artisans found for &quot;{searchQuery}&quot;
            </p>
          )}

          {/* UNKNOWN option — always visible at bottom */}
          <div className="pt-3 mt-2 border-t border-border/50">
            <button
              onClick={handleSetUnknown}
              disabled={fixing}
              className={`w-full text-left p-2.5 rounded-lg border border-dashed border-muted/40 hover:border-gold/50 hover:bg-gold/5 transition-colors ${
                fixing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-muted">?</span>
                <span className="text-[12px] text-muted">
                  Mark as <span className="font-mono font-medium">UNKNOWN</span>
                </span>
              </div>
              <p className="text-[10px] text-muted/70 mt-0.5 ml-5">
                Flag for later identification
              </p>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
