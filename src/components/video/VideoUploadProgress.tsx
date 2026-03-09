'use client';

import { useState, useRef, useCallback } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { useVideoUpload } from '@/contexts/VideoUploadContext';

interface VideoUploadProgressProps {
  listingId: number | string;
  onUploadComplete?: (videoId: string) => void;
  onUploadError?: (error: string) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
}

export function VideoUploadProgress({
  listingId,
  onUploadComplete,
  onUploadError,
  accept = 'video/mp4,video/webm,video/quicktime',
  maxSize = 5 * 1024 * 1024 * 1024, // 5GB
  disabled = false,
}: VideoUploadProgressProps) {
  const { t } = useLocale();
  const { startUpload, getUploadsForListing, pauseUpload, resumeUpload, cancelUpload } = useVideoUpload();
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const listingUploads = getUploadsForListing(listingId);
  const activeUpload = listingUploads.find(
    u => u.status === 'uploading' || u.status === 'preparing' || u.status === 'processing'
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSize) {
      setLocalError(`File too large. Maximum size is ${formatFileSize(maxSize)}`);
      return;
    }

    const validTypes = accept.split(',').map(t => t.trim());
    if (!validTypes.some(type => file.type.match(type.replace('*', '.*')))) {
      setLocalError('Invalid file type. Please upload a video file.');
      return;
    }

    setLocalError(null);

    try {
      await startUpload(listingId, file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start upload';
      setLocalError(msg);
      onUploadError?.(msg);
    }

    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  }, [startUpload, listingId, accept, maxSize, onUploadError]);

  const handleRetry = useCallback(() => {
    setLocalError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  }, []);

  // Show inline error for validation issues
  if (localError) {
    return (
      <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-4">
        <p className="text-sm text-red-500 mb-2">{localError}</p>
        <button onClick={handleRetry} className="text-xs text-[var(--accent)] hover:underline">
          Try again
        </button>
      </div>
    );
  }

  // Show inline progress when actively uploading for this listing
  if (activeUpload) {
    return (
      <div className="border border-[var(--border)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--text-primary)] truncate max-w-[200px]">{activeUpload.fileName}</span>
          <span className="text-xs text-[var(--text-muted)]">
            {activeUpload.status === 'preparing' && 'Preparing...'}
            {activeUpload.status === 'uploading' && (activeUpload.isPaused ? t('dealer.video.uploadPaused') : `${activeUpload.progress}%`)}
            {activeUpload.status === 'processing' && t('dealer.video.processing')}
          </span>
        </div>

        <div className="w-full h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden mb-2">
          <div
            className={`h-full transition-all duration-300 ${
              activeUpload.status === 'processing' ? 'bg-yellow-500 animate-pulse' : 'bg-[var(--accent)]'
            }`}
            style={{ width: `${activeUpload.progress}%` }}
          />
        </div>

        {activeUpload.status === 'uploading' && (
          <div className="flex gap-2">
            <button
              onClick={() => activeUpload.isPaused ? resumeUpload(activeUpload.id) : pauseUpload(activeUpload.id)}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              {activeUpload.isPaused ? t('dealer.video.resume') : t('dealer.video.pause')}
            </button>
            <button
              onClick={() => cancelUpload(activeUpload.id)}
              className="text-xs text-[var(--text-muted)] hover:text-red-500"
            >
              Cancel
            </button>
          </div>
        )}

        {activeUpload.status === 'processing' && (
          <p className="text-xs text-[var(--text-muted)]">
            Video is being processed. This may take a few minutes.
          </p>
        )}
      </div>
    );
  }

  // Idle state — file selection drop zone
  return (
    <label
      className={`block border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)]/30 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={disabled}
        className="sr-only"
      />
      <svg className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <p className="text-sm text-[var(--text-muted)]">{t('dealer.video.upload')}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">MP4, WebM, MOV up to {formatFileSize(maxSize)}</p>
    </label>
  );
}
