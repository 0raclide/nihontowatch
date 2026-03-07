'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import type { HakogakiEntry } from '@/types';
import { useLocale } from '@/i18n/LocaleContext';

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface HakogakiCardProps {
  entry: HakogakiEntry;
  index: number;
  itemId?: string; // Present in edit mode, absent in add mode
  onChange: (updated: HakogakiEntry) => void;
  onRemove: () => void;
  onPendingFilesChange?: (hakogakiId: string, files: File[]) => void;
}

export function HakogakiCard({ entry, index, itemId, onChange, onRemove, onPendingFilesChange }: HakogakiCardProps) {
  const { t } = useLocale();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!itemId;

  const handleFiles = useCallback(async (files: FileList) => {
    const currentCount = (entry.images || []).length + pendingFiles.length;
    if (currentCount + files.length > MAX_IMAGES) {
      setUploadError(t('dealer.hakogakiMaxImages'));
      return;
    }

    setUploadError(null);
    const validFiles: File[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(t('collection.fileTooLarge', { name: file.name }));
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError(t('collection.unsupportedFormat', { name: file.name }));
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    if (!isEditMode) {
      // Add mode: queue files locally with blob URL previews
      const newPending = [...pendingFiles, ...validFiles];
      setPendingFiles(newPending);
      onPendingFilesChange?.(entry.id, newPending);

      const previewUrls = validFiles.map(f => URL.createObjectURL(f));
      onChange({
        ...entry,
        images: [...(entry.images || []), ...previewUrls],
      });
      return;
    }

    // Edit mode: upload immediately
    setIsUploading(true);
    try {
      for (const file of validFiles) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('itemId', itemId!);
        formData.append('hakogakiId', entry.id);

        const res = await fetch('/api/dealer/hakogaki-images', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          onChange({
            ...entry,
            images: [...(entry.images || []), data.publicUrl],
          });
        } else {
          const data = await res.json().catch(() => ({}));
          setUploadError(data.error || 'Upload failed');
        }
      }
    } catch {
      setUploadError('Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [entry, itemId, isEditMode, pendingFiles, onChange, onPendingFilesChange, t]);

  const handleRemoveImage = useCallback(async (imageUrl: string) => {
    if (!isEditMode || imageUrl.startsWith('blob:')) {
      // Add mode or blob preview: just remove from state
      const idx = pendingFiles.findIndex((_, i) => {
        const blobUrls = (entry.images || []).filter(u => u.startsWith('blob:'));
        return blobUrls.indexOf(imageUrl) === i;
      });
      if (idx !== -1) {
        const newPending = pendingFiles.filter((_, i) => i !== idx);
        setPendingFiles(newPending);
        onPendingFilesChange?.(entry.id, newPending);
      }
      onChange({
        ...entry,
        images: (entry.images || []).filter(u => u !== imageUrl),
      });
      return;
    }

    // Edit mode: delete from server
    try {
      const res = await fetch('/api/dealer/hakogaki-images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, itemId, hakogakiId: entry.id }),
      });
      if (res.ok) {
        onChange({
          ...entry,
          images: (entry.images || []).filter(u => u !== imageUrl),
        });
      }
    } catch {
      // Best effort
    }
  }, [entry, itemId, isEditMode, pendingFiles, onChange, onPendingFilesChange]);

  return (
    <div className="bg-surface border border-border/50 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-medium text-muted">
          {t('dealer.hakogaki')} #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-[11px] text-red-500 hover:text-red-600 transition-colors"
        >
          {t('dealer.removeHakogaki')}
        </button>
      </div>

      {/* Author — plain text input (no dropdown) */}
      <div className="mb-3">
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          {t('dealer.hakogakiAuthor')}
        </label>
        <input
          type="text"
          value={entry.author || ''}
          onChange={e => onChange({ ...entry, author: e.target.value || null })}
          placeholder={t('dealer.hakogakiAuthorPlaceholder')}
          className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Inscription content */}
      <div className="mb-3">
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          {t('dealer.hakogakiContent')}
        </label>
        <textarea
          value={entry.content || ''}
          onChange={e => onChange({ ...entry, content: e.target.value || null })}
          rows={4}
          className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder={t('dealer.hakogakiContentPlaceholder')}
        />
      </div>

      {/* Photos */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          {t('dealer.hakogakiPhotos')}
        </label>

        {/* Existing images */}
        {(entry.images || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {(entry.images || []).map((url, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                <Image
                  src={url}
                  alt={`Hakogaki ${index + 1} photo ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(url)}
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

        {/* Upload button */}
        {(entry.images || []).length + pendingFiles.length < MAX_IMAGES && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={e => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-dashed border-border/50 rounded-lg text-[12px] text-muted hover:border-gold/30 hover:text-gold transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              {t('dealer.addPhoto')}
            </button>
          </>
        )}

        {uploadError && (
          <p className="mt-1 text-[11px] text-red-500">{uploadError}</p>
        )}
      </div>
    </div>
  );
}
