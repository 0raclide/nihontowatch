'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import type { DisplayItem } from '@/types/displayItem';
import { getItemTypeLabel, getCertTierClass, formatPrice } from '@/lib/collection/labels';
import type { CertTier } from '@/lib/collection/labels';
import { InlineCurrencyCell } from '@/components/collection/InlineEditCell';
import type { CompletenessResult } from '@/lib/dealer/completeness';

// =============================================================================
// Types
// =============================================================================

export interface DealerInventoryRowProps {
  item: DisplayItem;
  attribution: string | null;
  certInfo: { label: string; shortLabel: string; tier: string } | null;
  thumbUrl: string | null;
  completeness: CompletenessResult;
  daysListed: number | null;
  featuredScore: number | null;
  imageCount: number;
  locale: 'en' | 'ja';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string;
  onCardClick: (item: DisplayItem) => void;
  onStatusChange: (listingId: number, newStatus: string) => void;
  onPriceUpdate: (listingId: number, amount: number | null, currency: string) => void;
  onListForSale: (item: DisplayItem) => void;
}

// =============================================================================
// Status Pill Styles
// =============================================================================

const STATUS_STYLES: Record<string, { className: string }> = {
  AVAILABLE: { className: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  HOLD: { className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  SOLD: { className: 'bg-neutral-500/15 text-neutral-500' },
  INVENTORY: { className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
};

function getStatusLabel(status: string): string {
  switch (status) {
    case 'AVAILABLE': return 'Available';
    case 'HOLD': return 'Hold';
    case 'SOLD': return 'Sold';
    case 'INVENTORY': return 'Inventory';
    default: return status;
  }
}

// =============================================================================
// Age Color
// =============================================================================

function getAgeColor(days: number | null): string {
  if (days == null) return 'text-muted/40';
  if (days < 30) return 'text-green-600 dark:text-green-400';
  if (days <= 90) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500';
}

// =============================================================================
// Completeness Bar
// =============================================================================

function CompletenessBar({ score, missing }: { score: number; missing: string[] }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const pct = Math.round(score);
  const barColor =
    pct >= 80 ? 'bg-green-500' :
    pct >= 50 ? 'bg-amber-500' :
    'bg-red-400';

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden min-w-[40px]">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] tabular-nums text-muted/50 w-[28px] text-right">{pct}%</span>
      </div>
      {showTooltip && missing.length > 0 && (
        <div className="absolute z-20 bottom-full left-0 mb-1 px-2 py-1.5 bg-charcoal text-white text-[10px] rounded shadow-lg whitespace-nowrap">
          <div className="font-medium mb-0.5">Missing:</div>
          {missing.map((m) => (
            <div key={m} className="text-white/70">• {m}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Status Action Menu
// =============================================================================

function StatusActionMenu({
  status,
  onAction,
  onListForSale,
}: {
  status: string;
  onAction: (newStatus: string) => void;
  onListForSale: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  // Close menu on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const effectiveStatus = status === 'PRESUMED_SOLD' ? 'SOLD' : status;
  const style = STATUS_STYLES[effectiveStatus] || STATUS_STYLES.INVENTORY;

  const actions: { label: string; action: () => void }[] = [];
  switch (effectiveStatus) {
    case 'AVAILABLE':
      actions.push({ label: 'Mark Sold', action: () => { onAction('SOLD'); setIsOpen(false); } });
      actions.push({ label: 'Put on Hold', action: () => { onAction('HOLD'); setIsOpen(false); } });
      break;
    case 'HOLD':
      actions.push({ label: 'Relist', action: () => { onAction('AVAILABLE'); setIsOpen(false); } });
      actions.push({ label: 'Mark Sold', action: () => { onAction('SOLD'); setIsOpen(false); } });
      break;
    case 'SOLD':
      actions.push({ label: 'Relist', action: () => { onListForSale(); setIsOpen(false); } });
      break;
    case 'INVENTORY':
      actions.push({ label: 'List for Sale', action: () => { onListForSale(); setIsOpen(false); } });
      break;
    default:
      break;
  }

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    setIsOpen(prev => !prev);
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`text-[9px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded cursor-pointer hover:ring-1 hover:ring-gold/40 transition-all ${style.className}`}
      >
        {getStatusLabel(effectiveStatus)}
      </button>
      {isOpen && actions.length > 0 && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 bg-surface border border-border/50 rounded-lg shadow-lg py-1 min-w-[120px]"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {actions.map(({ label, action }) => (
            <button
              key={label}
              onClick={(e) => { e.stopPropagation(); action(); }}
              className="block w-full text-left px-3 py-1.5 text-[11px] text-ink hover:bg-surface-elevated transition-colors"
            >
              {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// =============================================================================
// Main Row Component
// =============================================================================

export function DealerInventoryRow({
  item,
  attribution,
  certInfo,
  thumbUrl,
  completeness,
  daysListed,
  featuredScore,
  imageCount,
  locale,
  t,
  onCardClick,
  onStatusChange,
  onPriceUpdate,
  onListForSale,
}: DealerInventoryRowProps) {
  const isSold = item.is_sold || item.status === 'SOLD' || item.status === 'PRESUMED_SOLD';

  const handleStatusAction = useCallback((newStatus: string) => {
    onStatusChange(Number(item.id), newStatus);
  }, [item.id, onStatusChange]);

  const handlePriceSave = useCallback((amount: number | null, currency: string) => {
    onPriceUpdate(Number(item.id), amount, currency);
  }, [item.id, onPriceUpdate]);

  return (
    <tr className={`border-b border-border/10 hover:bg-surface-elevated/30 transition-colors ${isSold ? 'opacity-60' : ''}`}>
      {/* Thumbnail */}
      <td className="py-1.5 px-2">
        <button
          onClick={() => onCardClick(item)}
          className="block w-[40px] h-[40px] rounded overflow-hidden bg-surface-elevated flex-shrink-0 hover:ring-1 hover:ring-gold/30 transition-all"
        >
          {thumbUrl ? (
            <Image
              src={thumbUrl}
              alt=""
              width={40}
              height={40}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </button>
      </td>

      {/* Status pill with action menu */}
      <td className="py-1.5 px-2">
        <StatusActionMenu
          status={item.status}
          onAction={handleStatusAction}
          onListForSale={() => onListForSale(item)}
        />
      </td>

      {/* Title (click → QuickView) */}
      <td className="py-1.5 px-2 max-w-[200px]">
        <button
          onClick={() => onCardClick(item)}
          className="text-left text-[12px] text-ink hover:text-gold transition-colors line-clamp-2 leading-tight"
        >
          {item.title || t('vault.table.untitled')}
        </button>
      </td>

      {/* Type pill */}
      <td className="py-1.5 px-2">
        <span className="text-[10px] text-muted/70 bg-surface-elevated px-1.5 py-0.5 rounded whitespace-nowrap">
          {getItemTypeLabel(item.item_type)}
        </span>
      </td>

      {/* Certification badge */}
      <td className="py-1.5 px-2">
        {certInfo ? (
          <span className={`text-[10px] font-medium ${getCertTierClass(certInfo.tier as CertTier)}`}>
            {certInfo.shortLabel}
          </span>
        ) : (
          <span className="text-[10px] text-muted/30">&mdash;</span>
        )}
      </td>

      {/* Attribution */}
      <td className="py-1.5 px-2 max-w-[150px]">
        <span className="text-[11px] text-muted/70 truncate block">
          {attribution || <span className="text-muted/30">&mdash;</span>}
        </span>
      </td>

      {/* Price (editable) */}
      <td className="py-1.5 px-1">
        <InlineCurrencyCell
          amount={item.price_value}
          currency={item.price_currency}
          defaultCurrency="JPY"
          onSave={handlePriceSave}
        />
      </td>

      {/* Days Listed */}
      <td className="py-1.5 px-2 text-center">
        {daysListed != null ? (
          <span className={`text-[11px] tabular-nums ${getAgeColor(daysListed)}`}>
            {daysListed}d
          </span>
        ) : (
          <span className="text-[10px] text-muted/30">&mdash;</span>
        )}
      </td>

      {/* Images count */}
      <td className="py-1.5 px-2 text-center">
        <span className={`text-[11px] tabular-nums ${imageCount === 0 ? 'text-red-400' : 'text-muted/60'}`}>
          {imageCount}
        </span>
      </td>

      {/* Videos count */}
      <td className="py-1.5 px-2 text-center">
        <span className={`text-[11px] tabular-nums ${(item.video_count || 0) > 0 ? 'text-muted/60' : 'text-muted/30'}`}>
          {item.video_count || 0}
        </span>
      </td>

      {/* Completeness */}
      <td className="py-1.5 px-2">
        <CompletenessBar score={completeness.score} missing={completeness.missing} />
      </td>

      {/* Featured Score */}
      <td className="py-1.5 px-2 text-right">
        <span className={`text-[11px] tabular-nums ${featuredScore && featuredScore > 0 ? 'text-muted/60' : 'text-muted/20'}`}>
          {featuredScore != null ? Math.round(featuredScore) : '—'}
        </span>
      </td>
    </tr>
  );
}
