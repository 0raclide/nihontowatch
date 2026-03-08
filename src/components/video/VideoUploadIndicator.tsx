'use client';

import { useState, useEffect, useRef } from 'react';
import { useVideoUpload, type UploadEntry } from '@/contexts/VideoUploadContext';
import { useLocale } from '@/i18n/LocaleContext';

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Floating progress indicator for global video uploads.
 * Renders at bottom-right of viewport. Returns null when no uploads exist.
 */
export function VideoUploadIndicator() {
  const { uploads, pauseUpload, resumeUpload, cancelUpload, dismissUpload } = useVideoUpload();
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const prevCountRef = useRef(uploads.length);
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-expand when new upload starts
  useEffect(() => {
    if (uploads.length > prevCountRef.current && uploads.length > 0) {
      setExpanded(true);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    }
    prevCountRef.current = uploads.length;
  }, [uploads.length]);

  // Auto-collapse 3s after all uploads finish
  const activeCount = uploads.filter(u => u.status === 'uploading' || u.status === 'preparing').length;
  useEffect(() => {
    if (activeCount === 0 && uploads.length > 0) {
      collapseTimerRef.current = setTimeout(() => setExpanded(false), 3000);
      return () => {
        if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      };
    }
  }, [activeCount, uploads.length]);

  if (uploads.length === 0) return null;

  // Aggregate progress for pill ring
  const avgProgress = uploads.length > 0
    ? Math.round(uploads.reduce((sum, u) => sum + u.progress, 0) / uploads.length)
    : 0;

  const uploadingCount = uploads.filter(u => u.status === 'uploading' || u.status === 'preparing').length;
  const pillLabel = uploadingCount > 0
    ? `${uploadingCount} ${t('dealer.video.uploading')}`
    : t('dealer.video.uploadComplete');

  // SVG progress ring params
  const ringSize = 24;
  const strokeWidth = 3;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (avgProgress / 100) * circumference;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-sm:bottom-3 max-sm:right-3">
      {/* Expanded panel */}
      {expanded && (
        <div className="mb-2 w-80 max-h-[300px] overflow-y-auto bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg shadow-xl">
          <div className="sticky top-0 bg-[var(--bg-primary)] border-b border-[var(--border)] px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-primary)]">
              {t('dealer.video.uploads')}
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {uploads.map(entry => (
              <UploadEntryRow
                key={entry.id}
                entry={entry}
                onPause={pauseUpload}
                onResume={resumeUpload}
                onCancel={cancelUpload}
                onDismiss={dismissUpload}
              />
            ))}
          </div>
        </div>
      )}

      {/* Collapsed pill */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-full shadow-lg hover:shadow-xl transition-shadow"
      >
        {/* Video icon */}
        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>

        {/* Progress ring */}
        <svg width={ringSize} height={ringSize} className="-rotate-90">
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke={activeCount > 0 ? 'var(--accent)' : '#22c55e'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>

        <span className="text-xs text-[var(--text-primary)] whitespace-nowrap">{pillLabel}</span>

        {/* Chevron */}
        <svg className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}

// ============================================================================
// Entry row (inside expanded panel)
// ============================================================================

function UploadEntryRow({
  entry,
  onPause,
  onResume,
  onCancel,
  onDismiss,
}: {
  entry: UploadEntry;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { t } = useLocale();

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[var(--text-primary)] truncate max-w-[180px]" title={entry.fileName}>
          {entry.fileName}
        </span>
        <span className="text-[10px] text-[var(--text-muted)] ml-2 shrink-0">
          {entry.status === 'preparing' && '...'}
          {entry.status === 'uploading' && (entry.isPaused ? t('dealer.video.uploadPaused') : `${entry.progress}%`)}
          {entry.status === 'processing' && t('dealer.video.processing')}
          {entry.status === 'complete' && t('dealer.video.uploadComplete')}
          {entry.status === 'error' && t('dealer.video.uploadFailed')}
        </span>
      </div>

      {/* Progress bar */}
      {(entry.status === 'uploading' || entry.status === 'preparing' || entry.status === 'processing') && (
        <div className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden mb-1.5">
          <div
            className={`h-full transition-all duration-300 ${
              entry.status === 'processing' ? 'bg-yellow-500 animate-pulse' : 'bg-[var(--accent)]'
            }`}
            style={{ width: `${entry.progress}%` }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {entry.status === 'uploading' && (
          <>
            <button
              onClick={() => entry.isPaused ? onResume(entry.id) : onPause(entry.id)}
              className="text-[10px] text-[var(--accent)] hover:underline"
            >
              {entry.isPaused ? t('dealer.video.resume') : t('dealer.video.pause')}
            </button>
            <button
              onClick={() => onCancel(entry.id)}
              className="text-[10px] text-[var(--text-muted)] hover:text-red-500"
            >
              {t('common.cancel')}
            </button>
          </>
        )}
        {entry.status === 'error' && (
          <button
            onClick={() => onDismiss(entry.id)}
            className="text-[10px] text-[var(--text-muted)] hover:text-red-500"
          >
            {t('common.dismiss')}
          </button>
        )}
        {entry.status === 'complete' && (
          <span className="text-[10px] text-green-500 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}
