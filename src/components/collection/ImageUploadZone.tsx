'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { resizeImage } from '@/lib/images/resizeImage';

interface ImageUploadZoneProps {
  images: string[];
  /** itemId is required for server uploads (edit mode). Omit in add mode — files queue locally. */
  itemId?: string;
  onChange: (images: string[]) => void;
  /** In add mode, queue pending files so the parent can upload them after item creation */
  onPendingFilesChange?: (files: File[]) => void;
  /** Override the upload/delete API endpoint. Default: '/api/collection/images' */
  apiEndpoint?: string;
  /** Explicit hero (cover) image index. When set, that image shows the cover badge instead of index 0. */
  heroImageIndex?: number | null;
  /** Called when the user clicks the star on an image to mark it as the cover. */
  onHeroImageChange?: (index: number | null) => void;
  /** Called when user clicks the move button on a thumbnail. Receives (imageIndex, destination). */
  onMoveImage?: (index: number, destination: string) => void;
  /** Whether the move-to-koshirae button should be shown (nihonto + not standalone koshirae). */
  canMoveToKoshirae?: boolean;
  /** When true, hides the move button because the koshirae images array is at capacity. */
  koshiraeImagesFull?: boolean;
}

const DEFAULT_API_ENDPOINT = '/api/collection/images';

export function ImageUploadZone({ images, itemId, onChange, onPendingFilesChange, apiEndpoint = DEFAULT_API_ENDPOINT, heroImageIndex, onHeroImageChange, onMoveImage, canMoveToKoshirae, koshiraeImagesFull }: ImageUploadZoneProps) {
  const { t } = useLocale();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Clear selection when images array changes length (image removed/moved)
  useEffect(() => { setSelectedIndex(null); }, [images.length]);

  const isAddMode = !itemId;

  const handleFiles = useCallback(async (files: FileList) => {
    const totalCount = images.length + pendingFiles.length + files.length;
    if (totalCount > 20) {
      setUploadError(t('collection.maxImages'));
      return;
    }

    setUploadError(null);
    const validFiles: { resized: Blob; name: string }[] = [];

    for (const file of Array.from(files)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setUploadError(t('collection.unsupportedFormat', { name: file.name }));
        continue;
      }
      const resized = await resizeImage(file);
      if (resized.size > 5 * 1024 * 1024) {
        setUploadError(t('collection.fileTooLarge', { name: file.name }));
        continue;
      }
      validFiles.push({ resized, name: file.name });
    }

    if (validFiles.length === 0) return;

    if (isAddMode) {
      // Add mode: queue files locally with object URL previews
      const resizedFiles: File[] = [];
      const previewUrls: string[] = [];
      for (const { resized, name } of validFiles) {
        const resizedFile = new File([resized], name, { type: 'image/jpeg' });
        resizedFiles.push(resizedFile);
        previewUrls.push(URL.createObjectURL(resized));
      }
      const newPending = [...pendingFiles, ...resizedFiles];
      setPendingFiles(newPending);
      onPendingFilesChange?.(newPending);
      onChange([...images, ...previewUrls]);
    } else {
      // Edit mode: upload immediately to server
      setIsUploading(true);
      const newImages = [...images];

      for (const { resized, name } of validFiles) {
        const formData = new FormData();
        formData.append('file', resized, name);
        formData.append('itemId', itemId);

        try {
          const res = await fetch(apiEndpoint, {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            setUploadError(err.error || t('collection.uploadFailed'));
            continue;
          }

          const data = await res.json();
          newImages.push(data.publicUrl);
        } catch {
          setUploadError(t('collection.uploadFailedRetry'));
        }
      }

      onChange(newImages);
      setIsUploading(false);
    }
  }, [images, pendingFiles, itemId, isAddMode, onChange, onPendingFilesChange, t, apiEndpoint]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleRemove = useCallback(async (index: number) => {
    const path = images[index];
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);

    // Reset hero if removed image was the hero, or adjust index if needed
    if (onHeroImageChange && heroImageIndex != null) {
      if (index === heroImageIndex) {
        onHeroImageChange(null);
      } else if (index < heroImageIndex) {
        onHeroImageChange(heroImageIndex - 1);
      }
    }

    if (isAddMode) {
      // Only remove from pendingFiles if this is a local blob (not a prefill URL)
      if (path.startsWith('blob:')) {
        // Find which pending file index this blob corresponds to
        // Blob URLs are in the same order as pendingFiles — count blob: entries before this index
        let blobIndex = 0;
        for (let j = 0; j < index; j++) {
          if (images[j].startsWith('blob:')) blobIndex++;
        }
        const newPending = pendingFiles.filter((_, i) => i !== blobIndex);
        setPendingFiles(newPending);
        onPendingFilesChange?.(newPending);
        URL.revokeObjectURL(path);
      }
    } else if (itemId) {
      // Edit mode: delete from storage
      try {
        await fetch(apiEndpoint, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: path, itemId }),
        });
      } catch {
        // Best effort — image removed from list regardless
      }
    }
  }, [images, pendingFiles, itemId, isAddMode, onChange, onPendingFilesChange, apiEndpoint, heroImageIndex, onHeroImageChange]);

  return (
    <div>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border/50 hover:border-gold/40 rounded-lg p-4 text-center cursor-pointer transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={e => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
        {isUploading ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <span className="text-[12px] text-muted">{t('collection.uploading')}</span>
          </div>
        ) : (
          <div className="py-2">
            <svg className="w-6 h-6 mx-auto text-muted/40 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[12px] text-muted">{t('collection.dropImages')}</span>
            <span className="block text-[10px] text-muted/50 mt-0.5">
              {t('collection.imageFormats')}
              {isAddMode && ` ${t('collection.uploadOnSave')}`}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {uploadError && (
        <p className="text-[11px] text-red-600 mt-1">{uploadError}</p>
      )}

      {/* Thumbnail strip */}
      {images.length > 0 && (
        <>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {images.map((url, i) => {
              const isHero = onHeroImageChange
                ? (heroImageIndex != null ? i === heroImageIndex : i === 0)
                : i === 0;
              const isSelected = i === selectedIndex;
              return (
                <div
                  key={i}
                  className={`relative w-16 h-16 rounded overflow-hidden shrink-0 group cursor-pointer ${isHero ? 'ring-2 ring-gold' : ''} ${isSelected ? `ring-2 ring-accent ${isHero ? 'ring-offset-1' : ''}` : ''}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedIndex(isSelected ? null : i); }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(i); }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-[10px] hidden md:flex"
                    aria-label={t('collection.removeImage')}
                  >
                    &times;
                  </button>
                  {/* Hero selection star — shown on hover for non-hero images */}
                  {onHeroImageChange && !isHero && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onHeroImageChange(i); }}
                      className="absolute top-0.5 left-0.5 w-5 h-5 flex items-center justify-center bg-black/40 text-white/70 hover:text-gold rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-[10px] hidden md:flex"
                      aria-label={t('collection.setAsCover')}
                      title={t('collection.setAsCover')}
                    >
                      &#9734;
                    </button>
                  )}
                  {/* Move to koshirae button */}
                  {onMoveImage && canMoveToKoshirae && !koshiraeImagesFull && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveImage(i, 'koshirae'); }}
                      className="absolute bottom-0.5 left-0.5 w-5 h-5 flex items-center justify-center bg-blue-600/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
                      aria-label={t('dealer.moveToKoshirae')}
                      title={t('dealer.moveToKoshirae')}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>
                  )}
                  {isHero && (
                    <div className="absolute bottom-0 inset-x-0 bg-gold/80 text-white text-[8px] text-center py-0.5">
                      {t('collection.cover')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile action bar — visible only when a thumbnail is selected */}
          {selectedIndex !== null && selectedIndex < images.length && (() => {
            const isHero = onHeroImageChange
              ? (heroImageIndex != null ? selectedIndex === heroImageIndex : selectedIndex === 0)
              : selectedIndex === 0;
            return (
              <div className="flex md:hidden gap-2 mt-2">
                {onHeroImageChange && !isHero && (
                  <button
                    type="button"
                    onClick={() => { onHeroImageChange(selectedIndex); setSelectedIndex(null); }}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gold/10 text-gold border border-gold/20 text-[12px] min-h-[44px]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    {t('collection.setAsCover')}
                  </button>
                )}
                {onMoveImage && canMoveToKoshirae && !koshiraeImagesFull && (
                  <button
                    type="button"
                    onClick={() => { onMoveImage(selectedIndex, 'koshirae'); }}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20 text-[12px] min-h-[44px]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    {t('dealer.moveToKoshiraeShort')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { handleRemove(selectedIndex); }}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-[12px] min-h-[44px]"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('collection.delete')}
                </button>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

/**
 * Upload queued files for an item that was just created.
 * Call this from the form after POST returns the new item ID.
 */
export async function uploadPendingFiles(
  files: File[],
  itemId: string,
  apiEndpoint: string = DEFAULT_API_ENDPOINT
): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('itemId', itemId);
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        paths.push(data.publicUrl);
      }
    } catch {
      // Best effort
    }
  }
  return paths;
}
