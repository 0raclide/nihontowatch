'use client';

import { useCallback } from 'react';
import type { KoshiraeComponentEntry, KoshiraeComponentType } from '@/types';
import { ArtisanSearchPanel } from '@/components/admin/ArtisanSearchPanel';
import type { ArtisanSearchResult } from '@/app/api/artisan/search/route';
import { useLocale } from '@/i18n/LocaleContext';

const COMPONENT_TYPES: { value: KoshiraeComponentType; labelKey: string }[] = [
  { value: 'tsuba', labelKey: 'dealer.componentTsuba' },
  { value: 'menuki', labelKey: 'dealer.componentMenuki' },
  { value: 'fuchi_kashira', labelKey: 'dealer.componentFuchiKashira' },
  { value: 'kozuka', labelKey: 'dealer.componentKozuka' },
  { value: 'kogai', labelKey: 'dealer.componentKogai' },
  { value: 'other', labelKey: 'dealer.componentOther' },
];

interface KoshiraeComponentCardProps {
  entry: KoshiraeComponentEntry;
  index: number;
  onChange: (updated: KoshiraeComponentEntry) => void;
  onRemove: () => void;
}

export function KoshiraeComponentCard({ entry, index, onChange, onRemove }: KoshiraeComponentCardProps) {
  const { t } = useLocale();

  const handleArtisanSelect = useCallback((result: ArtisanSearchResult) => {
    onChange({
      ...entry,
      artisan_id: result.code,
      artisan_name: result.name_romaji || result.display_name || null,
      artisan_kanji: result.name_kanji || null,
    });
  }, [entry, onChange]);

  const handleArtisanClear = useCallback(() => {
    onChange({
      ...entry,
      artisan_id: null,
      artisan_name: null,
      artisan_kanji: null,
    });
  }, [entry, onChange]);

  return (
    <div className="bg-surface border border-border/50 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-medium text-muted">
          {t('dealer.componentType')} #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-[11px] text-red-500 hover:text-red-600 transition-colors"
        >
          {t('dealer.removeComponent')}
        </button>
      </div>

      {/* Component type dropdown */}
      <div className="mb-3">
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          {t('dealer.componentType')}
        </label>
        <select
          value={entry.component_type}
          onChange={e => onChange({ ...entry, component_type: e.target.value as KoshiraeComponentType })}
          className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {COMPONENT_TYPES.map(({ value, labelKey }) => (
            <option key={value} value={value}>{t(labelKey)}</option>
          ))}
        </select>
      </div>

      {/* Artisan attribution */}
      <div className="mb-3">
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          {t('dealer.koshiraeMaker')}
        </label>
        {entry.artisan_id ? (
          <div className="px-3 py-2 bg-surface rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="text-[13px] font-medium">{entry.artisan_name || entry.artisan_id}</div>
                {entry.artisan_kanji && entry.artisan_kanji !== entry.artisan_name && (
                  <div className="text-[12px] text-muted">{entry.artisan_kanji}</div>
                )}
              </div>
              <button
                type="button"
                onClick={handleArtisanClear}
                className="text-[11px] text-muted hover:text-red-500 transition-colors"
              >
                {t('dealer.changeArtisan')}
              </button>
            </div>
          </div>
        ) : (
          <ArtisanSearchPanel
            domain="tosogu"
            onSelect={handleArtisanSelect}
            onSetUnknown={handleArtisanClear}
            onCancel={handleArtisanClear}
          />
        )}
      </div>

      {/* Signed */}
      <div className="mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!entry.signed}
            onChange={e => onChange({
              ...entry,
              signed: e.target.checked,
              mei_text: e.target.checked ? entry.mei_text : null,
            })}
            className="rounded border-border"
          />
          <span className="text-[12px] text-muted">{t('dealer.componentSigned')}</span>
        </label>
        {entry.signed && (
          <input
            type="text"
            value={entry.mei_text || ''}
            onChange={e => onChange({ ...entry, mei_text: e.target.value || null })}
            placeholder={t('dealer.componentMeiText')}
            maxLength={200}
            className="mt-1.5 w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-accent"
          />
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          {t('dealer.koshiraeNotes')}
        </label>
        <textarea
          value={entry.description || ''}
          onChange={e => onChange({ ...entry, description: e.target.value || null })}
          rows={2}
          className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
    </div>
  );
}
