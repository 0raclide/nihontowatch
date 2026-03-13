'use client';

import type { CollectionItemRow } from '@/types/collectionItem';
import { EditableText } from '../EditableText';

interface CollectionNotesProps {
  collectionItem?: CollectionItemRow | null;
  editable?: boolean;
  onSave?: (newText: string | null) => Promise<void>;
}

export function CollectionNotes({ collectionItem, editable, onSave }: CollectionNotesProps) {
  if (!editable && !collectionItem?.personal_notes) return null;

  return (
    <div className="px-4 py-3 lg:px-5 border-b border-border">
      <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
        Personal Notes
      </div>
      {editable ? (
        <EditableText
          value={collectionItem?.personal_notes ?? null}
          onSave={(v) => onSave?.(v) ?? Promise.resolve()}
          className="text-[15px] leading-relaxed text-charcoal whitespace-pre-wrap"
          placeholder="Add personal notes..."
        />
      ) : (
        <p className="text-[15px] leading-relaxed text-charcoal whitespace-pre-wrap">{collectionItem!.personal_notes}</p>
      )}
    </div>
  );
}
