'use client';

import { useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';

interface ExportButtonProps {
  onExport: () => Promise<void>;
}

/**
 * Desktop-only export button for vault/dealer table views.
 * Matches the gold-bordered toolbar aesthetic.
 */
export function ExportButton({ onExport }: ExportButtonProps) {
  const { t } = useLocale();
  const [isExporting, setIsExporting] = useState(false);

  const handleClick = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await onExport();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isExporting}
      className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 text-[11px] uppercase tracking-[0.1em] text-gold border border-gold/30 rounded hover:bg-gold/10 transition-colors disabled:opacity-50 disabled:cursor-wait"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
      </svg>
      {isExporting ? t('vault.export.exporting') : t('vault.export.button')}
    </button>
  );
}
