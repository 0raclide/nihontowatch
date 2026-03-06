'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import type { KoshiraeData } from '@/types';
import { CertPills } from './CertPills';
import { KoshiraeMakerSection } from './KoshiraeMakerSection';
import { useLocale } from '@/i18n/LocaleContext';

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function createEmptyKoshirae(): KoshiraeData {
  return {
    cert_type: null,
    cert_in_blade_paper: false,
    description: null,
    images: [],
    artisan_id: null,
    artisan_name: null,
    artisan_kanji: null,
    components: [],
  };
}

interface KoshiraeSectionProps {
  koshirae: KoshiraeData | null;
  itemId?: string; // Present in edit mode
  onChange: (koshirae: KoshiraeData | null) => void;
  onPendingFilesChange?: (files: File[]) => void;
}

export function KoshiraeSection({ koshirae, itemId, onChange, onPendingFilesChange }: KoshiraeSectionProps) {
  const { t } = useLocale();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!itemId;

  const handleAdd = useCallback(() => {
    onChange(createEmptyKoshirae());
  }, [onChange]);

  const handleRemove = useCallback(() => {
    onChange(null);
  }, [onChange]);

  const handleCertChange = useCallback((certType: string | null) => {
    if (!koshirae) return;
    onChange({ ...koshirae, cert_type: certType === 'none' ? null : certType });
  }, [koshirae, onChange]);

  const handleCertInBladeChange = useCallback((checked: boolean) => {
    if (!koshirae) return;
    onChange({ ...koshirae, cert_in_blade_paper: checked });
  }, [koshirae, onChange]);

  const handleArtisanChange = useCallback((id: string | null, name: string | null, kanji: string | null) => {
    if (!koshirae) return;
    onChange({ ...koshirae, artisan_id: id, artisan_name: name, artisan_kanji: kanji });
  }, [koshirae, onChange]);

  const handleComponentsChange = useCallback((components: KoshiraeData['components']) => {
    if (!koshirae) return;
    onChange({ ...koshirae, components });
  }, [koshirae, onChange]);

  const handleDescriptionChange = useCallback((value: string) => {
    if (!koshirae) return;
    onChange({ ...koshirae, description: value || null });
  }, [koshirae, onChange]);

  const handleFiles = useCallback(async (files: FileList) => {
    if (!koshirae) return;

    const currentCount = (koshirae.images || []).length + pendingFiles.length;
    if (currentCount + files.length > MAX_IMAGES) {
      setUploadError(t('dealer.koshiraeMaxImages'));
      return;
    }

    setUploadError(null);
    const validFiles: File[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`File too large: ${file.name}`);
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError(`Unsupported format: ${file.name}`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    if (!isEditMode) {
      // Add mode: queue files locally with blob URL previews
      const newPending = [...pendingFiles, ...validFiles];
      setPendingFiles(newPending);
      onPendingFilesChange?.(newPending);

      const previewUrls = validFiles.map(f => URL.createObjectURL(f));
      onChange({
        ...koshirae,
        images: [...(koshirae.images || []), ...previewUrls],
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

        const res = await fetch('/api/dealer/koshirae-images', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          onChange({
            ...koshirae,
            images: [...(koshirae.images || []), data.publicUrl],
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
  }, [koshirae, itemId, isEditMode, pendingFiles, onChange, onPendingFilesChange, t]);

  const handleRemoveImage = useCallback(async (imageUrl: string) => {
    if (!koshirae) return;

    if (!isEditMode || imageUrl.startsWith('blob:')) {
      // Add mode or blob preview: just remove from state
      const idx = pendingFiles.findIndex((_, i) => {
        const blobUrls = (koshirae.images || []).filter(u => u.startsWith('blob:'));
        return blobUrls.indexOf(imageUrl) === i;
      });
      if (idx !== -1) {
        const newPending = pendingFiles.filter((_, i) => i !== idx);
        setPendingFiles(newPending);
        onPendingFilesChange?.(newPending);
      }
      onChange({
        ...koshirae,
        images: (koshirae.images || []).filter(u => u !== imageUrl),
      });
      return;
    }

    // Edit mode: delete from server
    try {
      const res = await fetch('/api/dealer/koshirae-images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, itemId }),
      });
      if (res.ok) {
        onChange({
          ...koshirae,
          images: (koshirae.images || []).filter(u => u !== imageUrl),
        });
      }
    } catch {
      // Best effort
    }
  }, [koshirae, itemId, isEditMode, pendingFiles, onChange, onPendingFilesChange]);

  // Not added yet — show add button
  if (!koshirae) {
    return (
      <section>
        <label className="block text-[11px] uppercase tracking-wider text-muted mb-2">
          {t('dealer.koshirae')}
        </label>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('dealer.addKoshirae')}
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] uppercase tracking-wider text-muted">
          {t('dealer.koshirae')}
        </label>
        <button
          type="button"
          onClick={handleRemove}
          className="text-[11px] text-red-500 hover:text-red-600 transition-colors"
        >
          {t('dealer.removeKoshirae')}
        </button>
      </div>

      <div className="bg-surface border border-border/50 rounded-lg p-3 space-y-4">
        {/* Certification */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1.5">
            {t('dealer.koshiraeCert')}
          </label>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={koshirae.cert_in_blade_paper}
              onChange={e => handleCertInBladeChange(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-[12px] text-muted">{t('dealer.certInBladePaper')}</span>
          </label>
          <CertPills value={koshirae.cert_type} onChange={handleCertChange} />
        </div>

        {/* Maker */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1.5">
            {t('dealer.koshiraeMaker')}
          </label>
          <KoshiraeMakerSection
            artisanId={koshirae.artisan_id}
            artisanName={koshirae.artisan_name}
            artisanKanji={koshirae.artisan_kanji}
            components={koshirae.components}
            onArtisanChange={handleArtisanChange}
            onComponentsChange={handleComponentsChange}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
            {t('dealer.koshiraeDescription')}
          </label>
          <textarea
            value={koshirae.description || ''}
            onChange={e => handleDescriptionChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-surface border border-border/50 rounded-lg text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Photos */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
            {t('dealer.koshiraePhotos')}
          </label>

          {/* Existing images */}
          {(koshirae.images || []).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {(koshirae.images || []).map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                  <Image
                    src={url}
                    alt={`Koshirae photo ${i + 1}`}
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
          {(koshirae.images || []).length + pendingFiles.length < MAX_IMAGES && (
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
