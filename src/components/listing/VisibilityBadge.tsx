'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { useQuickView } from '@/contexts/QuickViewContext';
import type { CollectionItemRow, CollectionVisibility } from '@/types/collectionItem';

// =============================================================================
// VISIBILITY CONFIG
// =============================================================================

const VISIBILITY_CONFIG: Record<CollectionVisibility, {
  labelKey: string;
  hintKey: string;
  badgeClass: string;
  icon: 'lock' | 'users' | 'storefront';
}> = {
  private: {
    labelKey: 'collection.visibility.private',
    hintKey: 'collection.visibility.privateHint',
    badgeClass: 'bg-border/30 text-muted',
    icon: 'lock',
  },
  collectors: {
    labelKey: 'collection.visibility.collectors',
    hintKey: 'collection.visibility.collectorsHint',
    badgeClass: 'bg-juyo/10 text-juyo',
    icon: 'users',
  },
  dealers: {
    labelKey: 'collection.visibility.dealers',
    hintKey: 'collection.visibility.dealersHint',
    badgeClass: 'bg-jubi/10 text-jubi',
    icon: 'storefront',
  },
};

const VISIBILITY_ORDER: CollectionVisibility[] = ['private', 'collectors', 'dealers'];

// =============================================================================
// ICONS
// =============================================================================

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function StorefrontIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18l-2 8H5L3 3zm0 0l-1 4m18-4l1 4M5 11v10h14V11M9 21v-6h6v6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

const ICON_MAP = { lock: LockIcon, users: UsersIcon, storefront: StorefrontIcon };

// =============================================================================
// COMPONENT
// =============================================================================

interface VisibilityBadgeProps {
  collectionItem?: CollectionItemRow | null;
}

export function VisibilityBadge({ collectionItem }: VisibilityBadgeProps) {
  const { t } = useLocale();
  const { onCollectionSaved } = useQuickView();
  const [visibility, setVisibility] = useState<CollectionVisibility>(collectionItem?.visibility ?? 'private');
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync when collectionItem changes (e.g. navigating between items)
  useEffect(() => {
    if (collectionItem?.visibility) {
      setVisibility(collectionItem.visibility);
    }
  }, [collectionItem?.visibility]);

  // Close on click-outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = useCallback(async (newVisibility: CollectionVisibility) => {
    if (!collectionItem || newVisibility === visibility) {
      setIsOpen(false);
      return;
    }
    const prev = visibility;
    setVisibility(newVisibility);
    setIsSaving(true);
    setIsOpen(false);
    try {
      const res = await fetch(`/api/collection/items/${collectionItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });
      if (!res.ok) {
        setVisibility(prev);
      } else {
        // Notify vault grid directly so cards reflect the new visibility immediately
        window.dispatchEvent(new CustomEvent('collection-item-updated', {
          detail: { item_uuid: collectionItem.item_uuid, visibility: newVisibility },
        }));
        // Also trigger full refetch for facets/counts
        onCollectionSaved?.();
      }
    } catch {
      setVisibility(prev);
    } finally {
      setIsSaving(false);
    }
  }, [collectionItem, visibility, onCollectionSaved]);

  if (!collectionItem) return null;

  const config = VISIBILITY_CONFIG[visibility];
  const BadgeIcon = ICON_MAP[config.icon];

  return (
    <div ref={wrapperRef} className="relative" data-testid="visibility-badge-wrapper">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSaving}
        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded cursor-pointer transition-opacity ${config.badgeClass} ${isSaving ? 'opacity-60' : ''}`}
        data-testid="visibility-badge"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <BadgeIcon className="w-3 h-3" />
        {t(config.labelKey)}
        <svg className={`w-2.5 h-2.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-64 bg-surface-elevated border border-border rounded-lg shadow-lg z-50 animate-fadeIn"
          data-testid="visibility-popover"
          role="listbox"
          aria-label={t('collection.visibility.label')}
        >
          {VISIBILITY_ORDER.map((value) => {
            const opt = VISIBILITY_CONFIG[value];
            const Icon = ICON_MAP[opt.icon];
            const isActive = value === visibility;
            return (
              <button
                key={value}
                onClick={() => handleSelect(value)}
                className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  isActive ? 'bg-linen/50' : 'hover:bg-linen/30'
                }`}
                role="option"
                aria-selected={isActive}
              >
                <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-ink">{t(opt.labelKey)}</div>
                  <div className="text-[11px] text-muted leading-snug">{t(opt.hintKey)}</div>
                </div>
                {isActive && <CheckIcon className="w-4 h-4 mt-0.5 shrink-0 text-gold" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
