'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import type { KantoHibishoData } from '@/types';
import { resizeImage } from '@/lib/images/resizeImage';
import { useLocale } from '@/i18n/LocaleContext';

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface KantoHibishoSectionProps {
  data: KantoHibishoData | null;
  itemId?: string; // Present in edit mode
  /** Whether this data has been saved to the database. New entries should queue uploads locally. */
  isSaved?: boolean;
  onChange: (data: KantoHibishoData | null) => void;
  onPendingFilesChange?: (files: File[]) => void;
  /** Override the image upload/delete API endpoint. Default: '/api/dealer/kanto-hibisho-images' */
  apiEndpoint?: string;
}

export function KantoHibishoSection({ data, itemId, isSaved = false, onChange, onPendingFilesChange, apiEndpoint = '/api/dealer/kanto-hibisho-images' }: KantoHibishoSectionProps) {
  const { t } = useLocale();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only use immediate upload when the listing is being edited AND this data exists in the DB
  const isEditMode = !!itemId && isSaved;

  const handleAdd = useCallback(() => {
    onChange({
      volume: '',
      entry_number: '',
      text: null,
      images: [],
    });
  }, [onChange]);

  const handleRemove = useCallback(() => {
    onChange(null);
    setPendingFiles([]);
    onPendingFilesChange?.([]);
  }, [onChange, onPendingFilesChange]);

  const handleFiles = useCallback(async (files: FileList) => {
    if (!data) return;

    const currentCount = (data.images || []).length + pendingFiles.length;
    if (currentCount + files.length > MAX_IMAGES) {
      setUploadError(t('dealer.kantoHibishoMaxImages'));
      return;
    }

    setUploadError(null);
    const validFiles: File[] = [];

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError(t('collection.unsupportedFormat', { name: file.name }));
        continue;
      }
      const resized = await resizeImage(file);
      const resizedFile = new File([resized], file.name, { type: 'image/jpeg' });
      if (resizedFile.size > MAX_FILE_SIZE) {
        setUploadError(t('collection.fileTooLarge', { name: file.name }));
        continue;
      }
      validFiles.push(resizedFile);
    }

    if (validFiles.length === 0) return;

    if (!isEditMode) {
      // Add mode: queue files locally with blob URL previews
      const newPending = [...pendingFiles, ...validFiles];
      setPendingFiles(newPending);
      onPendingFilesChange?.(newPending);

      const previewUrls = validFiles.map(f => URL.createObjectURL(f));
      onChange({
        ...data,
        images: [...(data.images || []), ...previewUrls],
      });
      return;
    }

    // Edit mode: upload immediately
    setIsUploading(true);
    const newImageUrls: string[] = [];
    try {
      for (const file of validFiles) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('itemId', itemId!);

        const res = await fetch(apiEndpoint, {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const result = await res.json();
          newImageUrls.push(result.publicUrl);
        } else {
          const result = await res.json().catch(() => ({}));
          setUploadError(result.error || 'Upload failed');
        }
      }
    } catch {
      setUploadError('Upload failed');
    } finally {
      if (newImageUrls.length > 0) {
        onChange({
          ...data,
          images: [...(data.images || []), ...newImageUrls],
        });
      }
      setIsUploading(false);
    }
  }, [data, itemId, isEditMode, pendingFiles, onChange, onPendingFilesChange, t]);

  const handleRemoveImage = useCallback(async (imageUrl: string) => {
    if (!data) return;

    if (!isEditMode || imageUrl.startsWith('blob:')) {
      // Add mode or blob preview: just remove from state
      const idx = pendingFiles.findIndex((_, i) => {
        const blobUrls = (data.images || []).filter(u => u.startsWith('blob:'));
        return blobUrls.indexOf(imageUrl) === i;
      });
      if (idx !== -1) {
        const newPending = pendingFiles.filter((_, i) => i !== idx);
        setPendingFiles(newPending);
        onPendingFilesChange?.(newPending);
      }
      onChange({
        ...data,
        images: (data.images || []).filter(u => u !== imageUrl),
      });
      return;
    }

    // Edit mode: delete from server
    try {
      const res = await fetch(apiEndpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, itemId }),
      });
      if (res.ok) {
        onChange({
          ...data,
          images: (data.images || []).filter(u => u !== imageUrl),
        });
      }
    } catch {
      // Best effort
    }
  }, [data, itemId, isEditMode, pendingFiles, onChange, onPendingFilesChange]);

  // Not yet added — show the reveal button
  if (!data) {
    return (
      <section>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('dealer.addKantoHibisho')}
        </button>
      </section>
    );
  }

  return (
    <section>
      <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
        {t('dealer.kantoHibisho')}
      </label>

      <div className="bg-surface border border-border/50 rounded-lg p-3">
        {/* Header with remove */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-medium text-muted">
            {t('dealer.kantoHibisho')}
          </span>
          <button
            type="button"
            onClick={handleRemove}
            className="text-[11px] text-red-500 hover:text-red-600 transition-colors"
          >
            {t('dealer.removeKantoHibisho')}
          </button>
        </div>

        {/* Volume + Entry Number (side by side) */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
              {t('dealer.kantoHibishoVolume')}
            </label>
            <input
              type="text"
              value={data.volume || ''}
              onChange={e => onChange({ ...data, volume: e.target.value })}
              placeholder="2"
              className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
              {t('dealer.kantoHibishoEntryNumber')}
            </label>
            <input
              type="text"
              value={data.entry_number || ''}
              onChange={e => onChange({ ...data, entry_number: e.target.value })}
              placeholder="1110"
              className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Content textarea */}
        <div className="mb-3">
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
            {t('dealer.kantoHibishoText')}
          </label>
          <textarea
            value={data.text || ''}
            onChange={e => onChange({ ...data, text: e.target.value || null })}
            rows={6}
            className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder={t('dealer.kantoHibishoTextPlaceholder')}
          />
        </div>

        {/* Photos */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
            {t('dealer.kantoHibishoPhotos')}
          </label>

          {/* Existing images */}
          {(data.images || []).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {(data.images || []).map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                  <Image
                    src={url}
                    alt={`Kanto Hibisho photo ${i + 1}`}
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
          {(data.images || []).length + pendingFiles.length < MAX_IMAGES && (
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
    </section>
  );
}
