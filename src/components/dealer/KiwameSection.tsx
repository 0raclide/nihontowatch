'use client';

import { useCallback } from 'react';
import type { KiwameEntry } from '@/types';
import { KiwameCard } from './KiwameCard';
import { useLocale } from '@/i18n/LocaleContext';

interface KiwameSectionProps {
  entries: KiwameEntry[];
  onChange: (entries: KiwameEntry[]) => void;
  itemId?: string;
  /** IDs of entries that already exist in the database (for image upload mode detection) */
  savedEntryIds?: Set<string>;
  onPendingFilesChange?: (kiwameId: string, files: File[]) => void;
  apiEndpoint?: string;
  /** API base path for suggestions endpoint. Default: '/api/dealer' */
  apiBase?: string;
}

export function KiwameSection({ entries, onChange, itemId, savedEntryIds, onPendingFilesChange, apiEndpoint, apiBase }: KiwameSectionProps) {
  const { t } = useLocale();

  const handleAdd = useCallback(() => {
    onChange([
      ...entries,
      {
        id: crypto.randomUUID(),
        judge_name: '',
        judge_name_ja: null,
        kiwame_type: 'origami',
        notes: null,
        images: [],
      },
    ]);
  }, [entries, onChange]);

  const handleEntryChange = useCallback((index: number, updated: KiwameEntry) => {
    const next = [...entries];
    next[index] = updated;
    onChange(next);
  }, [entries, onChange]);

  const handleEntryRemove = useCallback((index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  }, [entries, onChange]);

  return (
    <section>
      <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
        {t('dealer.kiwame')}
      </label>

      {entries.length > 0 && (
        <div className="space-y-3 mb-3">
          {entries.map((entry, i) => (
            <KiwameCard
              key={entry.id}
              entry={entry}
              index={i}
              itemId={itemId}
              isSaved={savedEntryIds?.has(entry.id) ?? false}
              onChange={(updated) => handleEntryChange(i, updated)}
              onRemove={() => handleEntryRemove(i)}
              onPendingFilesChange={onPendingFilesChange}
              apiEndpoint={apiEndpoint}
              apiBase={apiBase}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t('dealer.addKiwame')}
      </button>
    </section>
  );
}
