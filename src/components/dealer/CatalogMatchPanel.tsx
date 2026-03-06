'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { CERT_TO_COLLECTION, FORM_TO_ITEM_TYPE, MEI_STATUS_MAP } from '@/lib/collection/catalogMapping';
import type { CatalogMatchItem, CatalogMatchResponse } from '@/types/catalog';

export interface CatalogPrefillFields {
  itemType?: string;
  nagasaCm?: string;
  soriCm?: string;
  motohabaCm?: string;
  sakihabaCm?: string;
  meiType?: string;
  era?: string;
  certSession?: number;
  catalogObjectUuid?: string;
  catalogImages?: string[];
}

interface CatalogMatchPanelProps {
  certType: string;
  artisanId: string;
  artisanName: string | null;
  onPrefill: (fields: CatalogPrefillFields) => void;
}

/** Image with fallback — tries candidate URLs in order, hides on total failure. */
function OshigataImage({ urls, alt, className }: { urls: string[]; alt: string; className?: string }) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  // Reset when urls change (new item)
  useEffect(() => { setUrlIndex(0); setFailed(false); }, [urls]);

  if (failed || urls.length === 0) {
    // Render empty parchment placeholder
    return <div className={className} />;
  }

  return (
    <img
      src={urls[urlIndex]}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (urlIndex + 1 < urls.length) {
          setUrlIndex(urlIndex + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

export function CatalogMatchPanel({ certType, artisanId, artisanName, onPrefill }: CatalogMatchPanelProps) {
  const { t } = useLocale();
  // allItems = full unfiltered result from API; items = filtered view
  const [allItems, setAllItems] = useState<CatalogMatchItem[]>([]);
  const [volumes, setVolumes] = useState<Array<{ volume: number; count: number }>>([]);
  const [total, setTotal] = useState(0);
  const [selectedVolume, setSelectedVolume] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<CatalogMatchItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const collection = CERT_TO_COLLECTION[certType];

  // Client-side filtered items
  const items = useMemo(() => {
    if (selectedVolume === null) return allItems;
    return allItems.filter(item => item.volume === selectedVolume);
  }, [allItems, selectedVolume]);

  // Auto-fetch when certType/artisanId change
  useEffect(() => {
    if (!collection) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSelectedItem(null);
    setSelectedVolume(null);
    setIsLoading(true);

    fetch(`/api/dealer/catalog-match?${new URLSearchParams({ artisan_code: artisanId, collection })}`, {
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json() as Promise<CatalogMatchResponse>;
      })
      .then(data => {
        if (controller.signal.aborted) return;
        setAllItems(data.items || []);
        setVolumes(data.volumes || []);
        setTotal(data.total || 0);
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (controller.signal.aborted) return;
        setAllItems([]);
        setVolumes([]);
        setTotal(0);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [artisanId, collection]);

  const handleCardSelect = useCallback((item: CatalogMatchItem) => {
    setSelectedItem(item);

    const fields: CatalogPrefillFields = {
      certSession: item.volume,
      catalogObjectUuid: item.object_uuid,
    };

    // Map form type → item type
    if (item.form_type) {
      const normalized = item.form_type.toLowerCase().trim();
      fields.itemType = FORM_TO_ITEM_TYPE[normalized] || normalized;
    }

    // Measurements (already in cm from API)
    if (item.nagasa_cm != null) fields.nagasaCm = String(item.nagasa_cm);
    if (item.sori_cm != null) fields.soriCm = String(item.sori_cm);
    if (item.motohaba_cm != null) fields.motohabaCm = String(item.motohaba_cm);
    if (item.sakihaba_cm != null) fields.sakihabaCm = String(item.sakihaba_cm);

    // Mei status → form mei type
    if (item.mei_status) {
      const mapped = MEI_STATUS_MAP[item.mei_status.toLowerCase().trim()];
      if (mapped) fields.meiType = mapped;
    }

    // Period → era
    if (item.period) fields.era = item.period;

    // Catalog images (oshigata + setsumei) to prepend to photo gallery
    if (item.image_urls?.length) fields.catalogImages = item.image_urls;

    onPrefill(fields);
  }, [onPrefill]);

  if (!collection) return null;

  // Selected state — compact confirmation strip
  if (selectedItem) {
    return (
      <section>
        <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
          {t('dealer.catalogMatch')}
        </label>
        <div className="flex items-center gap-3 px-3 py-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 rounded-lg">
          <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden" style={{ backgroundColor: '#f5f0e8' }}>
            <OshigataImage
              urls={selectedItem.image_urls}
              alt=""
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-green-800 dark:text-green-300">
              Vol. {selectedItem.volume} #{selectedItem.item_number}
            </div>
            <div className="text-[11px] text-green-600 dark:text-green-400">
              {t('dealer.catalogMatchSelected')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedItem(null)}
            className="text-[11px] text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 font-medium transition-colors"
          >
            {t('dealer.catalogMatchChange')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
        {t('dealer.catalogMatch')}
        {!isLoading && total > 0 && (
          <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-gold/10 text-gold text-[10px] font-semibold rounded-full">
            {total}
          </span>
        )}
      </label>

      {/* Volume pills — client-side filtering, no re-fetch */}
      {volumes.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide">
          <button
            type="button"
            onClick={() => setSelectedVolume(null)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              selectedVolume === null
                ? 'bg-gold/10 text-gold border border-gold/30'
                : 'bg-surface text-muted border border-border/50 hover:border-gold/30'
            }`}
          >
            {t('dealer.catalogSessionAll')}
          </button>
          {volumes.map(({ volume: vol, count }) => (
            <button
              key={vol}
              type="button"
              onClick={() => setSelectedVolume(vol)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                selectedVolume === vol
                  ? 'bg-gold/10 text-gold border border-gold/30'
                  : 'bg-surface text-muted border border-border/50 hover:border-gold/30'
              }`}
            >
              {t('dealer.catalogSession', { volume: String(vol) })} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-muted">
          <span className="w-3.5 h-3.5 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
          {t('dealer.catalogMatchLoading')}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="px-3 py-4 text-[12px] text-muted text-center">
          {t('dealer.catalogMatchEmpty', { collection: certType, artisan: artisanName || artisanId })}
        </div>
      )}

      {/* Card grid — horizontal scroll */}
      {!isLoading && items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {items.map((item) => (
            <button
              key={item.object_uuid}
              type="button"
              onClick={() => handleCardSelect(item)}
              className="flex-shrink-0 w-[120px] rounded-lg border border-border/50 hover:border-gold/40 transition-all overflow-hidden text-left group"
            >
              <div className="aspect-[2/3] w-full overflow-hidden" style={{ backgroundColor: '#f5f0e8' }}>
                <OshigataImage
                  urls={item.image_urls}
                  alt={`Vol. ${item.volume} #${item.item_number}`}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="px-2 py-1.5">
                <div className="text-[10px] font-medium text-primary truncate">
                  Vol. {item.volume} #{item.item_number}
                </div>
                <div className="text-[10px] text-muted truncate">
                  {item.form_type || '—'}{item.nagasa_cm != null ? ` ${item.nagasa_cm}cm` : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
