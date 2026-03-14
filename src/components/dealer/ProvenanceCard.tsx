'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import type { ProvenanceEntry } from '@/types';
import { resizeImage } from '@/lib/images/resizeImage';
import { AutocompleteInput } from './AutocompleteInput';
import { useLocale } from '@/i18n/LocaleContext';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface ProvenanceCardProps {
  entry: ProvenanceEntry;
  index: number;
  itemId?: string; // Present in edit mode, absent in add mode
  /** Whether this specific entry has been saved to the database (exists in JSONB). New entries added during edit should queue uploads locally. */
  isSaved?: boolean;
  onChange: (updated: ProvenanceEntry) => void;
  onRemove: () => void;
  onPendingFilesChange?: (provenanceId: string, file: File | null) => void;
  /** Override the image upload/delete API endpoint. Default: '/api/dealer/provenance-images' */
  apiEndpoint?: string;
}

export function ProvenanceCard({ entry, index, itemId, isSaved = false, onChange, onRemove, onPendingFilesChange, apiEndpoint = '/api/dealer/provenance-images' }: ProvenanceCardProps) {
  const { t } = useLocale();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingPortrait, setPendingPortrait] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only use immediate upload when the listing is being edited AND this entry exists in the DB
  const isEditMode = !!itemId && isSaved;

  const handleOwnerChange = useCallback((name: string, name_ja: string | null) => {
    onChange({ ...entry, owner_name: name, owner_name_ja: name_ja });
  }, [entry, onChange]);

  const handlePortraitFile = useCallback(async (files: FileList) => {
    const file = files[0];
    if (!file) return;

    setUploadError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError(t('collection.unsupportedFormat', { name: file.name }));
      return;
    }
    const resized = await resizeImage(file);
    const resizedFile = new File([resized], file.name, { type: 'image/jpeg' });
    if (resizedFile.size > MAX_FILE_SIZE) {
      setUploadError(t('collection.fileTooLarge', { name: file.name }));
      return;
    }

    if (!isEditMode) {
      // Add mode: queue file locally with blob URL preview
      setPendingPortrait(resizedFile);
      onPendingFilesChange?.(entry.id, resizedFile);
      const previewUrl = URL.createObjectURL(resizedFile);
      onChange({ ...entry, portrait_image: previewUrl });
      return;
    }

    // Edit mode: upload immediately
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', resizedFile, resizedFile.name);
      formData.append('itemId', itemId!);
      formData.append('provenanceId', entry.id);
      formData.append('role', 'portrait');

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        onChange({ ...entry, portrait_image: data.publicUrl });
      } else {
        const data = await res.json().catch(() => ({}));
        setUploadError(data.error || 'Upload failed');
      }
    } catch {
      setUploadError('Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [entry, itemId, isEditMode, onChange, onPendingFilesChange, t, apiEndpoint]);

  const handleRemovePortrait = useCallback(async () => {
    const portraitUrl = entry.portrait_image;
    if (!portraitUrl) return;

    if (!isEditMode || portraitUrl.startsWith('blob:')) {
      // Add mode or blob preview: just remove from state
      if (pendingPortrait) {
        setPendingPortrait(null);
        onPendingFilesChange?.(entry.id, null);
      }
      onChange({ ...entry, portrait_image: null });
      return;
    }

    // Edit mode: delete from server
    try {
      const res = await fetch(apiEndpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: portraitUrl, itemId, provenanceId: entry.id, role: 'portrait' }),
      });
      if (res.ok) {
        onChange({ ...entry, portrait_image: null });
      }
    } catch {
      // Best effort
    }
  }, [entry, itemId, isEditMode, pendingPortrait, onChange, onPendingFilesChange, apiEndpoint]);

  return (
    <div className="bg-surface border border-border/50 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-medium text-muted">
          {t('dealer.provenance')} #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-[11px] text-red-500 hover:text-red-600 transition-colors"
        >
          {t('dealer.removeProvenance')}
        </button>
      </div>

      {/* Owner name with portrait + autocomplete */}
      <div className="mb-3">
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          {t('dealer.provenanceOwner')}
        </label>
        <div className="flex items-start gap-3">
          {/* Portrait circle */}
          <div className="flex-shrink-0">
            {entry.portrait_image ? (
              <div className="relative w-11 h-11 rounded-full overflow-hidden ring-[1.5px] ring-gold/40 group">
                <Image
                  src={entry.portrait_image}
                  alt={entry.owner_name || t('dealer.provenancePortrait')}
                  fill
                  className="object-cover"
                  sizes="44px"
                />
                <button
                  type="button"
                  onClick={handleRemovePortrait}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => {
                    if (e.target.files) handlePortraitFile(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-11 h-11 rounded-full border border-dashed border-border/50 flex items-center justify-center text-muted hover:border-gold/30 hover:text-gold transition-colors disabled:opacity-50"
                  title={t('dealer.provenanceAddPortrait')}
                >
                  {isUploading ? (
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Name input */}
          <div className="flex-1 min-w-0">
            <AutocompleteInput
              value={entry.owner_name}
              onChange={handleOwnerChange}
              fetchUrl="/api/dealer/suggestions?type=provenance"
              placeholder={t('dealer.provenanceOwnerPlaceholder')}
            />
            {entry.owner_name_ja && (
              <div className="mt-1 text-[11px] text-muted">{entry.owner_name_ja}</div>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          {t('dealer.provenanceNotes')}
        </label>
        <textarea
          value={entry.notes || ''}
          onChange={e => onChange({ ...entry, notes: e.target.value || null })}
          rows={2}
          className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder={t('dealer.provenanceNotesPlaceholder')}
        />
      </div>

      {uploadError && (
        <p className="mt-1 text-[11px] text-red-500">{uploadError}</p>
      )}
    </div>
  );
}
