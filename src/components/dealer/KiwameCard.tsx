'use client';

import { useCallback } from 'react';
import type { KiwameEntry, KiwameType } from '@/types';
import { AutocompleteInput } from './AutocompleteInput';
import { useLocale } from '@/i18n/LocaleContext';

const KIWAME_TYPES: { value: KiwameType; labelKey: string }[] = [
  { value: 'origami', labelKey: 'dealer.kiwameTypeOrigami' },
  { value: 'kinzogan', labelKey: 'dealer.kiwameTypeKinzogan' },
  { value: 'saya_mei', labelKey: 'dealer.kiwameTypeSayaMei' },
  { value: 'other', labelKey: 'dealer.kiwameTypeOther' },
];

interface KiwameCardProps {
  entry: KiwameEntry;
  index: number;
  onChange: (updated: KiwameEntry) => void;
  onRemove: () => void;
}

export function KiwameCard({ entry, index, onChange, onRemove }: KiwameCardProps) {
  const { t } = useLocale();

  const handleJudgeChange = useCallback((name: string, name_ja: string | null) => {
    onChange({ ...entry, judge_name: name, judge_name_ja: name_ja });
  }, [entry, onChange]);

  return (
    <div className="bg-surface border border-border/50 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-medium text-muted">
          {t('dealer.kiwame')} #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-[11px] text-red-500 hover:text-red-600 transition-colors"
        >
          {t('dealer.removeKiwame')}
        </button>
      </div>

      {/* Judge name with autocomplete */}
      <div className="mb-3">
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          {t('dealer.kiwameJudge')}
        </label>
        <AutocompleteInput
          value={entry.judge_name}
          onChange={handleJudgeChange}
          fetchUrl="/api/dealer/suggestions?type=kiwame"
          placeholder={t('dealer.kiwameJudgePlaceholder')}
        />
        {entry.judge_name_ja && (
          <div className="mt-1 text-[11px] text-muted">{entry.judge_name_ja}</div>
        )}
      </div>

      {/* Kiwame type */}
      <div className="mb-3">
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          {t('dealer.kiwameType')}
        </label>
        <div className="flex flex-wrap gap-2">
          {KIWAME_TYPES.map(({ value, labelKey }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...entry, kiwame_type: value })}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                entry.kiwame_type === value
                  ? 'bg-gold/10 text-gold border border-gold/30'
                  : 'bg-surface text-muted border border-border/50 hover:border-gold/30'
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          {t('dealer.kiwameNotes')}
        </label>
        <textarea
          value={entry.notes || ''}
          onChange={e => onChange({ ...entry, notes: e.target.value || null })}
          rows={2}
          className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder={t('dealer.kiwameNotesPlaceholder')}
        />
      </div>
    </div>
  );
}
