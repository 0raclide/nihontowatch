'use client';

import { useLocale } from '@/i18n/LocaleContext';

interface VaultViewToggleProps {
  view: 'grid' | 'table';
  onViewChange: (view: 'grid' | 'table') => void;
}

/**
 * Desktop-only toggle between grid (card) and table (spreadsheet) views.
 * Hidden on mobile — table view is desktop-only.
 */
export function VaultViewToggle({ view, onViewChange }: VaultViewToggleProps) {
  const { t } = useLocale();

  return (
    <div className="hidden lg:flex items-center gap-0.5 bg-surface-elevated rounded p-0.5 border border-border/30">
      <button
        onClick={() => onViewChange('grid')}
        className={`p-1.5 rounded transition-colors ${
          view === 'grid' ? 'text-gold bg-surface' : 'text-muted/50 hover:text-muted'
        }`}
        aria-label={t('vault.table.gridView')}
        title={t('vault.table.gridView')}
      >
        {/* Grid icon (2x2 squares) */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="5" height="5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="2" width="5" height="5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
          <rect x="2" y="9" width="5" height="5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="9" width="5" height="5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <button
        onClick={() => onViewChange('table')}
        className={`p-1.5 rounded transition-colors ${
          view === 'table' ? 'text-gold bg-surface' : 'text-muted/50 hover:text-muted'
        }`}
        aria-label={t('vault.table.tableView')}
        title={t('vault.table.tableView')}
      >
        {/* Table icon (rows) */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
