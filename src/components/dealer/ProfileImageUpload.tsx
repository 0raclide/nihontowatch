'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useLocale } from '@/i18n/LocaleContext';

interface ProfileImageUploadProps {
  type: 'logo' | 'banner' | 'shop';
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
  maxSizeMb: number;
  aspectHint: string;
}

export function ProfileImageUpload({
  type,
  currentUrl,
  onUploaded,
  onRemoved,
  maxSizeMb,
  aspectHint,
}: ProfileImageUploadProps) {
  const { t } = useLocale();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const helpKey = type === 'logo' ? 'dealer.logoHelp' : type === 'banner' ? 'dealer.bannerHelp' : 'dealer.shopPhotoHelp';
  const labelKey = type === 'logo' ? 'dealer.uploadLogo' : type === 'banner' ? 'dealer.uploadBanner' : 'dealer.uploadShopPhoto';

  const handleFile = async (file: File) => {
    setError(null);

    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File too large (max ${maxSizeMb}MB)`);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Use JPEG, PNG, or WebP');
      return;
    }

    setIsUploading(true);
    try {
      const resized = await resizeImage(file, type === 'logo' ? 512 : 2048, 0.85);
      const formData = new FormData();
      formData.append('file', resized, file.name);
      formData.append('type', type);

      const res = await fetch('/api/dealer/profile/images', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Upload failed');
        return;
      }

      const data = await res.json();
      onUploaded(data.publicUrl);
    } catch {
      setError('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setIsUploading(true);
    try {
      const res = await fetch('/api/dealer/profile/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        onRemoved();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to remove');
      }
    } catch {
      setError('Failed to remove');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const shapeClass = type === 'logo'
    ? 'w-[120px] h-[120px] rounded-full'
    : type === 'banner'
      ? 'w-full aspect-[16/9] rounded-lg'
      : 'w-full aspect-[4/3] rounded-lg';

  return (
    <div>
      {currentUrl ? (
        <div className={`relative ${shapeClass} overflow-hidden bg-hover group`}>
          <Image
            src={currentUrl}
            alt={type}
            fill
            className="object-cover"
            unoptimized
          />
          {!isUploading && (
            <button
              onClick={handleRemove}
              className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-xs"
              aria-label="Remove"
            >
              &times;
            </button>
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`${shapeClass} border-2 border-dashed border-border/50 hover:border-gold/50 flex flex-col items-center justify-center cursor-pointer transition-colors bg-hover/30`}
        >
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-6 h-6 text-muted mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[11px] text-muted">{t(labelKey)}</span>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      <p className="text-[10px] text-muted mt-1">{t(helpKey)}</p>
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

async function resizeImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) {
        resolve(file);
        return;
      }
      if (width > height) {
        height = Math.round((height / width) * maxDim);
        width = maxDim;
      } else {
        width = Math.round((width / height) * maxDim);
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob || file),
        'image/jpeg',
        quality
      );
    };
    img.src = objectUrl;
  });
}
