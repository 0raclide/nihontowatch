'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';

interface ImageUploadZoneProps {
  images: string[];
  /** itemId is required for server uploads (edit mode). Omit in add mode — files queue locally. */
  itemId?: string;
  onChange: (images: string[]) => void;
  /** In add mode, queue pending files so the parent can upload them after item creation */
  onPendingFilesChange?: (files: File[]) => void;
}

export function ImageUploadZone({ images, itemId, onChange, onPendingFilesChange }: ImageUploadZoneProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAddMode = !itemId;

  const handleFiles = useCallback(async (files: FileList) => {
    const totalCount = images.length + pendingFiles.length + files.length;
    if (totalCount > 20) {
      setUploadError('Maximum 20 images per item');
      return;
    }

    setUploadError(null);
    const validFiles: File[] = [];

    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        setUploadError(`${file.name} exceeds 5MB limit`);
        continue;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setUploadError(`${file.name} is not a supported format (JPEG/PNG/WebP)`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    if (isAddMode) {
      // Add mode: queue files locally with object URL previews
      const resizedFiles: File[] = [];
      const previewUrls: string[] = [];
      for (const file of validFiles) {
        const resized = await resizeImage(file, 2048, 0.85);
        const resizedFile = new File([resized], file.name, { type: 'image/jpeg' });
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

      for (const file of validFiles) {
        const resized = await resizeImage(file, 2048, 0.85);
        const formData = new FormData();
        formData.append('file', resized, file.name);
        formData.append('itemId', itemId);

        try {
          const res = await fetch('/api/collection/images', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            setUploadError(err.error || 'Upload failed');
            continue;
          }

          const data = await res.json();
          newImages.push(data.publicUrl);
        } catch {
          setUploadError('Upload failed. Please try again.');
        }
      }

      onChange(newImages);
      setIsUploading(false);
    }
  }, [images, pendingFiles, itemId, isAddMode, onChange, onPendingFilesChange]);

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
        await fetch('/api/collection/images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: path, itemId }),
        });
      } catch {
        // Best effort — image removed from list regardless
      }
    }
  }, [images, pendingFiles, itemId, isAddMode, onChange, onPendingFilesChange]);

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
            <span className="text-[12px] text-muted">Uploading...</span>
          </div>
        ) : (
          <div className="py-2">
            <svg className="w-6 h-6 mx-auto text-muted/40 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[12px] text-muted">Drop images or click to upload</span>
            <span className="block text-[10px] text-muted/50 mt-0.5">
              JPEG, PNG, WebP. Max 5MB, up to 20 images.
              {isAddMode && ' Images will be uploaded when you save.'}
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
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <div key={i} className="relative w-16 h-16 rounded overflow-hidden shrink-0 group">
              {/* Use img tag for blob URLs since Next.js Image doesn't support them */}
              {url.startsWith('blob:') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Image src={url} alt="" fill className="object-cover" />
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(i); }}
                className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                aria-label="Remove image"
              >
                &times;
              </button>
              {i === 0 && (
                <div className="absolute bottom-0 inset-x-0 bg-gold/80 text-white text-[8px] text-center py-0.5">
                  Cover
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Resize image to max dimension, return as Blob */
async function resizeImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl); // Fix: free memory
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
        blob => resolve(blob || file),
        'image/jpeg',
        quality
      );
    };
    img.src = objectUrl;
  });
}

/**
 * Upload queued files for an item that was just created.
 * Call this from the form after POST returns the new item ID.
 */
export async function uploadPendingFiles(
  files: File[],
  itemId: string
): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('itemId', itemId);
    try {
      const res = await fetch('/api/collection/images', {
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
