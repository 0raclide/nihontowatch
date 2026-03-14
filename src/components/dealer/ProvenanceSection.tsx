'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import type { ProvenanceEntry } from '@/types';
import { ProvenanceCard } from './ProvenanceCard';
import { resizeImage } from '@/lib/images/resizeImage';
import { useLocale } from '@/i18n/LocaleContext';

const MAX_DOCUMENTS = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface ProvenanceSectionProps {
  entries: ProvenanceEntry[];
  documents: string[];
  itemId?: string; // Present in edit mode
  /** IDs of entries that already exist in the database (for image upload mode detection) */
  savedEntryIds?: Set<string>;
  onChange: (entries: ProvenanceEntry[]) => void;
  onDocumentsChange: (documents: string[]) => void;
  onPendingFilesChange?: (provenanceId: string, file: File | null) => void;
  onPendingDocumentsChange?: (files: File[]) => void;
  /** Override the image upload/delete API endpoint for child cards. */
  apiEndpoint?: string;
}

export function ProvenanceSection({
  entries, documents, itemId, savedEntryIds,
  onChange, onDocumentsChange,
  onPendingFilesChange, onPendingDocumentsChange,
  apiEndpoint,
}: ProvenanceSectionProps) {
  const { t } = useLocale();
  const [pendingDocFiles, setPendingDocFiles] = useState<File[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!itemId;

  const handleAdd = useCallback(() => {
    onChange([
      ...entries,
      {
        id: crypto.randomUUID(),
        owner_name: '',
        owner_name_ja: null,
        notes: null,
        portrait_image: null,
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

  const handleDocumentFiles = useCallback(async (files: FileList) => {
    const currentCount = documents.length + pendingDocFiles.length;
    if (currentCount + files.length > MAX_DOCUMENTS) {
      setDocUploadError(t('dealer.provenanceMaxDocuments'));
      return;
    }

    setDocUploadError(null);
    const validFiles: File[] = [];

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setDocUploadError(t('collection.unsupportedFormat', { name: file.name }));
        continue;
      }
      const resized = await resizeImage(file);
      const resizedFile = new File([resized], file.name, { type: 'image/jpeg' });
      if (resizedFile.size > MAX_FILE_SIZE) {
        setDocUploadError(t('collection.fileTooLarge', { name: file.name }));
        continue;
      }
      validFiles.push(resizedFile);
    }

    if (validFiles.length === 0) return;

    if (!isEditMode) {
      // Add mode: queue files locally with blob URL previews
      const newPending = [...pendingDocFiles, ...validFiles];
      setPendingDocFiles(newPending);
      onPendingDocumentsChange?.(newPending);
      const previewUrls = validFiles.map(f => URL.createObjectURL(f));
      onDocumentsChange([...documents, ...previewUrls]);
      return;
    }

    // Edit mode: upload immediately
    setIsUploadingDoc(true);
    const newUrls: string[] = [];
    try {
      for (const file of validFiles) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('itemId', itemId!);
        formData.append('role', 'document');

        const res = await fetch(apiEndpoint || '/api/dealer/provenance-images', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          newUrls.push(data.publicUrl);
        } else {
          const data = await res.json().catch(() => ({}));
          setDocUploadError(data.error || 'Upload failed');
        }
      }
    } catch {
      setDocUploadError('Upload failed');
    } finally {
      if (newUrls.length > 0) {
        onDocumentsChange([...documents, ...newUrls]);
      }
      setIsUploadingDoc(false);
    }
  }, [documents, pendingDocFiles, itemId, isEditMode, onDocumentsChange, onPendingDocumentsChange, t, apiEndpoint]);

  const handleRemoveDocument = useCallback(async (docUrl: string) => {
    if (!isEditMode || docUrl.startsWith('blob:')) {
      // Add mode or blob preview: just remove from state
      const blobIndex = documents.filter(u => u.startsWith('blob:')).indexOf(docUrl);
      if (blobIndex !== -1) {
        const newPending = pendingDocFiles.filter((_, i) => i !== blobIndex);
        setPendingDocFiles(newPending);
        onPendingDocumentsChange?.(newPending);
      }
      onDocumentsChange(documents.filter(u => u !== docUrl));
      return;
    }

    // Edit mode: delete from server
    try {
      const res = await fetch(apiEndpoint || '/api/dealer/provenance-images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: docUrl, itemId, role: 'document' }),
      });
      if (res.ok) {
        onDocumentsChange(documents.filter(u => u !== docUrl));
      }
    } catch {
      // Best effort
    }
  }, [documents, itemId, isEditMode, pendingDocFiles, onDocumentsChange, onPendingDocumentsChange, apiEndpoint]);

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
              isSaved={savedEntryIds?.has(entry.id) ?? false}
              onChange={(updated) => handleEntryChange(i, updated)}
              onRemove={() => handleEntryRemove(i)}
              onPendingFilesChange={onPendingFilesChange}
              apiEndpoint={apiEndpoint}
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

      {/* Supporting Documents */}
      {(entries.length > 0 || documents.length > 0) && (
        <div className="mt-4 pt-3 border-t border-border/30">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-2">
            {t('dealer.provenanceSupportingDocs')}
          </label>

          {documents.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {documents.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                  <Image
                    src={url}
                    alt={`${t('dealer.provenanceSupportingDocs')} ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveDocument(url)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {documents.length + pendingDocFiles.length < MAX_DOCUMENTS && (
            <>
              <input
                ref={docFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={e => {
                  if (e.target.files) handleDocumentFiles(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => docFileInputRef.current?.click()}
                disabled={isUploadingDoc}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-dashed border-border/50 rounded-lg text-[12px] text-muted hover:border-gold/30 hover:text-gold transition-colors disabled:opacity-50"
              >
                {isUploadingDoc ? (
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
                {t('dealer.provenanceAddDocument')}
              </button>
            </>
          )}

          {docUploadError && (
            <p className="mt-1 text-[11px] text-red-500">{docUploadError}</p>
          )}
        </div>
      )}
    </section>
  );
}
