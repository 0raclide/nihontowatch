'use client';

import { useState, useCallback } from 'react';
import type { KoshiraeComponentEntry } from '@/types';
import { KoshiraeComponentCard } from './KoshiraeComponentCard';
import { ArtisanSearchPanel } from '@/components/admin/ArtisanSearchPanel';
import type { ArtisanSearchResult } from '@/app/api/artisan/search/route';
import { useLocale } from '@/i18n/LocaleContext';

type MakerMode = 'single' | 'multi';

function inferMode(components: KoshiraeComponentEntry[]): MakerMode {
  return components.length > 0 ? 'multi' : 'single';
}

function createEmptyComponent(): KoshiraeComponentEntry {
  return {
    id: crypto.randomUUID(),
    component_type: 'tsuba',
    artisan_id: null,
    artisan_name: null,
    artisan_kanji: null,
    description: null,
    signed: false,
    mei_text: null,
  };
}

interface KoshiraeMakerSectionProps {
  artisanId: string | null;
  artisanName: string | null;
  artisanKanji: string | null;
  components: KoshiraeComponentEntry[];
  onArtisanChange: (id: string | null, name: string | null, kanji: string | null) => void;
  onComponentsChange: (components: KoshiraeComponentEntry[]) => void;
}

export function KoshiraeMakerSection({
  artisanId,
  artisanName,
  artisanKanji,
  components,
  onArtisanChange,
  onComponentsChange,
}: KoshiraeMakerSectionProps) {
  const { t } = useLocale();
  const [makerMode, setMakerMode] = useState<MakerMode>(() => inferMode(components));

  const handleModeSwitch = useCallback((newMode: MakerMode) => {
    if (newMode === makerMode) return;
    if (newMode === 'multi') {
      // Single -> Multi: clear top-level artisan
      onArtisanChange(null, null, null);
    } else {
      // Multi -> Single: confirm if components exist
      if (components.length > 0 && !window.confirm(t('dealer.confirmClearComponents'))) {
        return;
      }
      onComponentsChange([]);
    }
    setMakerMode(newMode);
  }, [makerMode, components, onArtisanChange, onComponentsChange, t]);

  const handleSingleArtisanSelect = useCallback((result: ArtisanSearchResult) => {
    onArtisanChange(
      result.code,
      result.name_romaji || result.display_name || null,
      result.name_kanji || null,
    );
  }, [onArtisanChange]);

  const handleSingleArtisanClear = useCallback(() => {
    onArtisanChange(null, null, null);
  }, [onArtisanChange]);

  const handleAddComponent = useCallback(() => {
    onComponentsChange([...components, createEmptyComponent()]);
  }, [components, onComponentsChange]);

  const handleComponentChange = useCallback((index: number, updated: KoshiraeComponentEntry) => {
    const next = [...components];
    next[index] = updated;
    onComponentsChange(next);
  }, [components, onComponentsChange]);

  const handleComponentRemove = useCallback((index: number) => {
    onComponentsChange(components.filter((_, i) => i !== index));
  }, [components, onComponentsChange]);

  return (
    <div>
      {/* Mode toggle pills */}
      <div className="flex gap-1 mb-3">
        <button
          type="button"
          onClick={() => handleModeSwitch('single')}
          className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
            makerMode === 'single'
              ? 'bg-gold/20 text-gold border border-gold/30'
              : 'bg-surface border border-border/50 text-muted hover:border-gold/20'
          }`}
        >
          {t('dealer.singleMaker')}
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('multi')}
          className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
            makerMode === 'multi'
              ? 'bg-gold/20 text-gold border border-gold/30'
              : 'bg-surface border border-border/50 text-muted hover:border-gold/20'
          }`}
        >
          {t('dealer.multipleMakers')}
        </button>
      </div>

      {/* Single maker mode */}
      {makerMode === 'single' && (
        <div>
          {artisanId ? (
            <div className="px-3 py-2 bg-surface rounded-lg border border-border/50">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="text-[13px] font-medium">{artisanName || artisanId}</div>
                  {artisanKanji && artisanKanji !== artisanName && (
                    <div className="text-[12px] text-muted">{artisanKanji}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSingleArtisanClear}
                  className="text-[11px] text-muted hover:text-red-500 transition-colors"
                >
                  {t('dealer.changeArtisan')}
                </button>
              </div>
            </div>
          ) : (
            <ArtisanSearchPanel
              domain="tosogu"
              onSelect={handleSingleArtisanSelect}
              onSetUnknown={handleSingleArtisanClear}
              onCancel={handleSingleArtisanClear}
            />
          )}
        </div>
      )}

      {/* Multi maker mode */}
      {makerMode === 'multi' && (
        <div>
          {components.length > 0 && (
            <div className="space-y-3 mb-3">
              {components.map((comp, i) => (
                <KoshiraeComponentCard
                  key={comp.id}
                  entry={comp}
                  index={i}
                  onChange={(updated) => handleComponentChange(i, updated)}
                  onRemove={() => handleComponentRemove(i)}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleAddComponent}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('dealer.addComponent')}
          </button>
        </div>
      )}
    </div>
  );
}
