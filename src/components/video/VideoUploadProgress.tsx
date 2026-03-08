'use client';

import { useState, useRef, useCallback } from 'react';
import { useLocale } from '@/i18n/LocaleContext';

interface VideoUploadProgressProps {
  onUploadStart: (file: File) => Promise<{
    videoId: string;
    providerId?: string;
    uploadUrl: string;
    libraryId?: string;
    authSignature?: string;
    authExpire?: number;
  }>;
  onUploadComplete: (videoId: string) => void;
  onUploadError: (error: string) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
}

type UploadState = 'idle' | 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';

export function VideoUploadProgress({
  onUploadStart,
  onUploadComplete,
  onUploadError,
  accept = 'video/mp4,video/webm,video/quicktime',
  maxSize = 5 * 1024 * 1024 * 1024, // 5GB
  disabled = false,
}: VideoUploadProgressProps) {
  const { t } = useLocale();
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<any>(null);

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
      setError(`File too large. Maximum size is ${formatFileSize(maxSize)}`);
      setState('error');
      return;
    }

    const validTypes = accept.split(',').map(t => t.trim());
    if (!validTypes.some(type => file.type.match(type.replace('*', '.*')))) {
      setError('Invalid file type. Please upload a video file.');
      setState('error');
      return;
    }

    setFileName(file.name);
    setState('preparing');
    setProgress(0);
    setError(null);

    try {
      const uploadInfo = await onUploadStart(file);

      // Dynamic import tus-js-client to avoid bundle bloat
      const tus = await import('tus-js-client');

      const tusHeaders: Record<string, string> = {};
      if (uploadInfo.authSignature && uploadInfo.authExpire) {
        tusHeaders['AuthorizationSignature'] = uploadInfo.authSignature;
        tusHeaders['AuthorizationExpire'] = String(uploadInfo.authExpire);
        tusHeaders['VideoId'] = uploadInfo.providerId || uploadInfo.videoId;
        tusHeaders['LibraryId'] = uploadInfo.libraryId || '';
      }

      const upload = new tus.Upload(file, {
        endpoint: uploadInfo.uploadUrl,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        chunkSize: 10 * 1024 * 1024,
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        headers: tusHeaders,
        onError: (err) => {
          console.error('Upload error:', err);
          setError(err.message || 'Upload failed');
          setState('error');
          onUploadError(err.message || 'Upload failed');
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          setProgress(percentage);
        },
        onSuccess: () => {
          setState('processing');
          setProgress(100);
          onUploadComplete(uploadInfo.videoId);
        },
      });

      uploadRef.current = upload;
      setState('uploading');

      const previousUploads = await upload.findPreviousUploads();
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      upload.start();
    } catch (err) {
      console.error('Failed to start upload:', err);
      setError(err instanceof Error ? err.message : 'Failed to start upload');
      setState('error');
      onUploadError(err instanceof Error ? err.message : 'Failed to start upload');
    }
  }, [onUploadStart, onUploadComplete, onUploadError, accept, maxSize]);

  const handlePauseResume = useCallback(() => {
    if (!uploadRef.current) return;
    if (isPaused) {
      uploadRef.current.start();
      setIsPaused(false);
    } else {
      uploadRef.current.abort();
      setIsPaused(true);
    }
  }, [isPaused]);

  const handleCancel = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    setState('idle');
    setProgress(0);
    setFileName(null);
    setError(null);
    setIsPaused(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleRetry = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
    setState('idle');
    setError(null);
  }, []);

  if (state === 'idle') {
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

  if (state === 'error') {
    return (
      <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-4">
        <p className="text-sm text-red-500 mb-2">{error}</p>
        <button onClick={handleRetry} className="text-xs text-[var(--accent)] hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[var(--text-primary)] truncate max-w-[200px]">{fileName}</span>
        <span className="text-xs text-[var(--text-muted)]">
          {state === 'preparing' && 'Preparing...'}
          {state === 'uploading' && `${progress}%`}
          {state === 'processing' && t('dealer.video.processing')}
          {state === 'complete' && 'Complete'}
        </span>
      </div>

      <div className="w-full h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-300 ${
            state === 'processing' ? 'bg-yellow-500 animate-pulse' :
            state === 'complete' ? 'bg-green-500' :
            'bg-[var(--accent)]'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {state === 'uploading' && (
        <div className="flex gap-2">
          <button onClick={handlePauseResume} className="text-xs text-[var(--accent)] hover:underline">
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={handleCancel} className="text-xs text-[var(--text-muted)] hover:text-red-500">
            Cancel
          </button>
        </div>
      )}

      {state === 'processing' && (
        <p className="text-xs text-[var(--text-muted)]">
          Video is being processed. This may take a few minutes.
        </p>
      )}
    </div>
  );
}
