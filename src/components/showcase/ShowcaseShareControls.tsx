'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from '@/i18n/LocaleContext';

interface TokenState {
  token: string | null;
  url: string | null;
}

export function ShowcaseShareControls() {
  const { t } = useLocale();
  const [state, setState] = useState<TokenState>({ token: null, url: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  // Fetch current token on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/showcase-share');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setState({ token: data.token ?? null, url: data.url ?? null });
        }
      } catch {
        // silently fail — admin UI is best-effort
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsActing(true);
    try {
      const res = await fetch('/api/admin/showcase-share', { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      setState({ token: data.token, url: data.url });
    } catch {
      // silently fail
    } finally {
      setIsActing(false);
    }
  }, []);

  const handleRevoke = useCallback(async () => {
    setIsActing(true);
    try {
      const res = await fetch('/api/admin/showcase-share', { method: 'DELETE' });
      if (!res.ok) return;
      setState({ token: null, url: null });
      setShowRevokeConfirm(false);
    } catch {
      // silently fail
    } finally {
      setIsActing(false);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!state.url) return;
    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = state.url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [state.url]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-3">
        <div className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  // No token — show generate button
  if (!state.token) {
    return (
      <div className="flex items-center justify-center py-3">
        <button
          onClick={handleGenerate}
          disabled={isActing}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium tracking-wide text-gold border border-gold/30 rounded hover:bg-gold/5 transition-colors disabled:opacity-50"
        >
          {isActing ? (
            <div className="w-3.5 h-3.5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.702a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
            </svg>
          )}
          {t('showcase.shareGenerate')}
        </button>
      </div>
    );
  }

  // Has token — show URL + copy + revoke
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-3">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-alt rounded border border-border/50 max-w-xs sm:max-w-md">
        <svg className="w-3.5 h-3.5 text-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.702a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
        </svg>
        <span className="text-xs text-muted truncate font-mono">
          {state.url}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium tracking-wide text-gold border border-gold/30 rounded hover:bg-gold/5 transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('showcase.shareCopied')}
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              {t('showcase.shareCopy')}
            </>
          )}
        </button>

        {showRevokeConfirm ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRevoke}
              disabled={isActing}
              className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-600/40 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              {t('showcase.shareRevokeConfirm')}
            </button>
            <button
              onClick={() => setShowRevokeConfirm(false)}
              className="px-2 py-1.5 text-xs text-muted hover:text-ink transition-colors"
            >
              {t('showcase.shareRevokeCancel')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowRevokeConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted border border-border/50 rounded hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 dark:hover:border-red-600/40 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            {t('showcase.shareRevoke')}
          </button>
        )}
      </div>
    </div>
  );
}
