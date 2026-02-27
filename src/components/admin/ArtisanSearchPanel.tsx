'use client';

import { useState, useRef, useEffect } from 'react';
import type { ArtisanSearchResult } from '@/app/api/artisan/search/route';

/** 5 tiny dots visualizing elite_factor magnitude. Hidden when 0. */
function EliteDots({ factor }: { factor: number }) {
  if (!factor) return null;
  const filled =
    factor > 0.20 ? 5 :
    factor > 0.10 ? 4 :
    factor > 0.05 ? 3 :
    factor > 0.02 ? 2 : 1;
  const pct = (factor * 100).toFixed(1);
  return (
    <span className="inline-flex gap-px items-center ml-1.5" title={`Elite factor: ${pct}%`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`w-1 h-1 rounded-full ${i < filled ? 'bg-gold' : 'bg-border'}`}
        />
      ))}
    </span>
  );
}

interface ArtisanSearchPanelProps {
  onSelect: (result: ArtisanSearchResult) => void;
  onSetUnknown: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  successMessage?: string | null;
  errorMessage?: string | null;
  autoFocus?: boolean;
}

export function ArtisanSearchPanel({
  onSelect,
  onSetUnknown,
  onCancel,
  disabled = false,
  successMessage,
  errorMessage,
  autoFocus = false,
}: ArtisanSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ArtisanSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-clear when successMessage transitions from falsy → truthy
  const prevSuccessRef = useRef(successMessage);
  useEffect(() => {
    if (successMessage && !prevSuccessRef.current) {
      setSearchQuery('');
      setSearchResults([]);
      setSearchError(null);
    }
    prevSuccessRef.current = successMessage;
  }, [successMessage]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/artisan/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        } else {
          const data = await res.json();
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

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const displayError = errorMessage || searchError;

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted mb-2">
        Search for artisan:
      </div>

      <div className="relative mb-2">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Name, code, or school..."
          className="w-full px-3 py-2 text-xs bg-surface border border-border rounded focus:outline-none focus:border-gold/50 text-ink placeholder:text-muted"
        />
        {searchLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-muted border-t-gold rounded-full animate-spin" />
          </div>
        )}
      </div>

      {displayError && (
        <p className="text-[10px] text-red-500 mb-2">{displayError}</p>
      )}

      {searchResults.length > 0 && (
        <div className="max-h-64 overflow-y-auto space-y-1 scrollbar-thin">
          {searchResults.map((result) => (
            <button
              key={result.code}
              onClick={() => onSelect(result)}
              disabled={disabled}
              className={`w-full text-left p-2 rounded border border-border hover:border-gold/50 hover:bg-gold/5 transition-colors ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="flex items-center">
                  <span className="font-mono text-xs font-medium text-gold">
                    {result.code}
                  </span>
                  <EliteDots factor={result.elite_factor} />
                </span>
                <span className="text-[9px] text-muted uppercase">
                  {result.type === 'school' ? 'School' : result.type === 'smith' ? 'Smith' : 'Tosogu'}
                </span>
              </div>
              <div className="text-xs text-ink">
                {result.name_kanji && (
                  <span className="font-jp mr-1">{result.name_kanji}</span>
                )}
                {(result.display_name || result.name_romaji) && (
                  <span>{result.display_name || result.name_romaji}</span>
                )}
                {result.generation && (
                  <span className="text-muted ml-1">({result.generation})</span>
                )}
              </div>
              {(result.school || result.province || result.era) && (
                <div className="text-[10px] text-muted mt-0.5">
                  {[result.school, result.province].filter(Boolean).join(' · ')}
                  {(result.school || result.province) && result.era ? ' · ' : ''}
                  {result.era}
                  {result.period && !result.era?.includes(result.period) && <span className="text-muted/60"> ({result.period})</span>}
                </div>
              )}
              {(result.tokuju_count > 0 || result.juyo_count > 0 || result.total_items > 0 || result.teacher_text) && (
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] mt-0.5">
                  {result.tokuju_count > 0 && (
                    <span className="text-tokuju font-medium">TJ {result.tokuju_count}</span>
                  )}
                  {result.juyo_count > 0 && (
                    <span className="text-juyo font-medium">Juyo {result.juyo_count}</span>
                  )}
                  {result.total_items > 0 && (
                    <span className="text-muted">{result.total_items} works</span>
                  )}
                  {result.teacher_text && (
                    <span className="text-muted">teacher: {result.teacher_text}</span>
                  )}
                </div>
              )}
              {(result.hawley || result.fujishiro) && (
                <div className="text-[10px] text-muted mt-0.5">
                  {result.hawley != null && `Hawley ${result.hawley}`}
                  {result.hawley != null && result.fujishiro && ' · '}
                  {result.fujishiro && result.fujishiro}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && !searchError && (
        <p className="text-[10px] text-muted text-center py-2">
          No artisans found for &quot;{searchQuery}&quot;
        </p>
      )}

      {/* UNKNOWN option */}
      <div className="pt-2 mt-2 border-t border-border/50">
        <button
          onClick={onSetUnknown}
          disabled={disabled}
          className={`w-full text-left p-2 rounded border border-dashed border-muted/40 hover:border-gold/50 hover:bg-gold/5 transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted">?</span>
            <span className="text-[11px] text-muted">
              Mark as <span className="font-mono font-medium">UNKNOWN</span>
            </span>
          </div>
          <p className="text-[9px] text-muted/70 mt-0.5 ml-5">
            Flag for later identification
          </p>
        </button>
      </div>

      {/* Cancel button (optional) */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-2 w-full py-1.5 text-[10px] text-muted hover:text-ink transition-colors"
        >
          Cancel search
        </button>
      )}
    </div>
  );
}

export default ArtisanSearchPanel;
