'use client';

import { useCallback } from 'react';
import type { ProvenanceEntry } from '@/types';
import { ProvenanceCard } from './ProvenanceCard';
import { useLocale } from '@/i18n/LocaleContext';

interface ProvenanceSectionProps {
  entries: ProvenanceEntry[];
  itemId?: string; // Present in edit mode
  onChange: (entries: ProvenanceEntry[]) => void;
  onPendingFilesChange?: (provenanceId: string, files: File[]) => void;
}

export function ProvenanceSection({ entries, itemId, onChange, onPendingFilesChange }: ProvenanceSectionProps) {
  const { t } = useLocale();

  const handleAdd = useCallback(() => {
    onChange([
      ...entries,
      {
        id: crypto.randomUUID(),
        owner_name: '',
        owner_name_ja: null,
        notes: null,
        images: [],
      },
    ]);
  }, [entries, onChange]);

  const handleEntryChange = useCallback((index: number, updated: ProvenanceEntry) => {
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
        {t('dealer.provenance')}
      </label>

      {entries.length > 0 && (
        <div className="space-y-3 mb-3">
          {entries.map((entry, i) => (
            <ProvenanceCard
              key={entry.id}
              entry={entry}
              index={i}
              itemId={itemId}
              onChange={(updated) => handleEntryChange(i, updated)}
              onRemove={() => handleEntryRemove(i)}
              onPendingFilesChange={onPendingFilesChange}
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
        {t('dealer.addProvenance')}
      </button>
    </section>
  );
}
