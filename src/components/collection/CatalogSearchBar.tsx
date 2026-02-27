'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CreateCollectionItemInput, CatalogSearchResult } from '@/types/collection';
import { useLocale } from '@/i18n/LocaleContext';
import { mapCatalogToCollectionItem } from '@/lib/collection/catalogMapping';
import { formatArtisanStats } from '@/types/artisan';

interface CatalogSearchBarProps {
  onSelect: (data: Partial<CreateCollectionItemInput>) => void;
}

interface ArtisanResult {
  code: string;
  type: 'smith' | 'tosogu';
  name_romaji: string | null;
  name_kanji: string | null;
  display_name: string | null;
  school: string | null;
  province: string | null;
  era: string | null;
  hawley: number | null;
  fujishiro: string | null;
  elite_factor: number;
  juyo_count: number;
  tokuju_count: number;
  total_items: number;
  teacher_text: string | null;
  period: string | null;
}

export function CatalogSearchBar({ onSelect }: CatalogSearchBarProps) {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [cert, setCert] = useState('');
  const [session, setSession] = useState('');
  const [nagasa, setNagasa] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  const [catalogResults, setCatalogResults] = useState<CatalogSearchResult[]>([]);
  const [artisanResults, setArtisanResults] = useState<ArtisanResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string, c: string, s: string, n: string) => {
    if (q.length < 2 && !c) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const [catalogRes, artisanRes] = await Promise.all([
        // Catalog search
        (c || q.length >= 2) ? fetch(
          `/api/collection/catalog-search?${new URLSearchParams({
            ...(q && { q }),
            ...(c && { cert: c }),
            ...(s && { session: s }),
            ...(n && { nagasa: n }),
          })}`,
          { signal: controller.signal }
        ).then(r => r.ok ? r.json() : { results: [] }) : Promise.resolve({ results: [] }),
        // Artisan search
        q.length >= 2 ? fetch(
          `/api/collection/artisan-search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        ).then(r => r.ok ? r.json() : { results: [] }) : Promise.resolve({ results: [] }),
      ]);

      setCatalogResults(catalogRes.results || []);
      setArtisanResults(artisanRes.results || []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setCatalogResults([]);
      setArtisanResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2 && !cert) {
      setCatalogResults([]);
      setArtisanResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query, cert, session, nagasa), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, cert, session, nagasa, doSearch]);

  const handleCatalogSelect = useCallback((result: CatalogSearchResult) => {
    const mapped = mapCatalogToCollectionItem(result);
    onSelect(mapped);
    setCatalogResults([]);
    setArtisanResults([]);
    setQuery('');
    setHasSearched(false);
  }, [onSelect]);

  const handleArtisanSelect = useCallback((artisan: ArtisanResult) => {
    onSelect({
      artisan_id: artisan.code,
      artisan_display_name: artisan.name_romaji || undefined,
      smith: artisan.name_romaji || undefined,
      school: artisan.school || undefined,
      province: artisan.province || undefined,
      era: artisan.era || undefined,
    });
    setCatalogResults([]);
    setArtisanResults([]);
    setQuery('');
    setHasSearched(false);
  }, [onSelect]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[11px] uppercase tracking-[0.1em] font-medium text-muted">
          {t('collection.catalogLookup')}
        </label>
        <span className="text-[10px] text-muted/50">{t('collection.catalogHelper')}</span>
      </div>

      {/* Search input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('collection.catalogPlaceholder')}
            className="form-input w-full pr-8"
          />
          {isSearching && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <button
          onClick={() => setShowRefine(!showRefine)}
          className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-medium border rounded transition-colors ${
            showRefine ? 'border-gold text-gold bg-gold/5' : 'border-border/60 text-muted hover:border-gold/40'
          }`}
        >
          {t('collection.refine')}
        </button>
      </div>

      {/* Refinement fields */}
      {showRefine && (
        <div className="flex gap-2 mt-2">
          <select value={cert} onChange={e => setCert(e.target.value)} className="form-select text-[12px]">
            <option value="">{t('collection.certType')}</option>
            <option value="Juyo">{t('cert.Juyo')}</option>
            <option value="Tokuju">{t('cert.Tokuju')}</option>
            <option value="Kokuho">{t('cert.Kokuho')}</option>
          </select>
          <input type="number" value={session} onChange={e => setSession(e.target.value)} placeholder={t('collection.sessionNum')} className="form-input w-24 text-[12px]" />
          <input type="number" step="0.1" value={nagasa} onChange={e => setNagasa(e.target.value)} placeholder={t('collection.nagasaCm')} className="form-input w-28 text-[12px]" />
        </div>
      )}

      {/* Results */}
      {hasSearched && (catalogResults.length > 0 || artisanResults.length > 0) && (
        <div className="mt-3 border border-border/40 rounded-lg overflow-hidden max-h-[280px] overflow-y-auto bg-white">
          {/* Catalog Results */}
          {catalogResults.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-linen/50 text-[10px] uppercase tracking-wider font-semibold text-muted border-b border-border/20">
                {t('collection.catalogRecords')}
              </div>
              {catalogResults.map((r, i) => (
                <button
                  key={r.object_uuid || i}
                  onClick={() => handleCatalogSelect(r)}
                  className="w-full text-left px-3 py-2 hover:bg-gold/5 border-b border-border/10 last:border-b-0 transition-colors"
                >
                  <div className="text-[12px] font-medium text-ink">
                    {r.collection} {r.volume && `Vol. ${r.volume}`} {r.item_number && `#${r.item_number}`}
                    {r.smith_name && ` — ${r.smith_name}`}
                  </div>
                  <div className="text-[10px] text-muted">
                    {r.form_type && `${r.form_type}`}
                    {r.nagasa && `, ${r.nagasa}cm`}
                    {r.province && `, ${r.province}`}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Artisan Results */}
          {artisanResults.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-linen/50 text-[10px] uppercase tracking-wider font-semibold text-muted border-b border-border/20">
                {t('collection.artisans')}
              </div>
              {artisanResults.map(a => (
                <button
                  key={a.code}
                  onClick={() => handleArtisanSelect(a)}
                  className="w-full text-left px-3 py-2 hover:bg-gold/5 border-b border-border/10 last:border-b-0 transition-colors"
                >
                  <div className="text-[12px] font-medium text-ink">
                    {a.name_kanji && <span className="mr-1.5">{a.name_kanji}</span>}
                    {a.name_romaji} <span className="text-muted/60">({a.code})</span>
                  </div>
                  <div className="text-[10px] text-muted">
                    {a.school && `${a.school}`}
                    {a.province && `, ${a.province}`}
                    {a.era && `, ${a.era}`}
                    {a.period && ` (${a.period})`}
                  </div>
                  {(a.tokuju_count > 0 || a.juyo_count > 0 || a.teacher_text) && (
                    <div className="text-[10px] text-muted">
                      {formatArtisanStats(a) && (
                        <span className="mr-1.5">{formatArtisanStats(a)}</span>
                      )}
                      {a.teacher_text && <span>teacher: {a.teacher_text}</span>}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No results */}
      {hasSearched && !isSearching && catalogResults.length === 0 && artisanResults.length === 0 && (
        <p className="mt-2 text-[11px] text-muted/60">{t('collection.noResults')}</p>
      )}

      {/* Skip link */}
      {!hasSearched && (
        <p className="mt-2 text-[10px] text-muted/50">
          {t('collection.orSkipTo')} <button onClick={() => setHasSearched(true)} className="text-gold hover:underline">{t('collection.enterManually')}</button>
        </p>
      )}
    </div>
  );
}
