'use client';

import { useRef, useLayoutEffect, useState, useCallback, useEffect, type KeyboardEvent } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LedgerTab<T extends string> {
  value: T;
  label: string;
  /** CSS color for the status dot (e.g. 'var(--success)'). Omit to hide dot. */
  dotColor?: string;
}

export interface LedgerTabsProps<T extends string> {
  tabs: LedgerTab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  /** Counts keyed by tab value. `null` = still loading, `undefined` = no counts. */
  tabCounts?: Record<string, number> | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LedgerTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  tabCounts,
}: LedgerTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());

  // Underline position state
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);

  // Measure the active tab and position the underline
  const measure = useCallback(() => {
    const container = containerRef.current;
    const activeEl = tabRefs.current.get(activeTab);
    if (!container || !activeEl) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = activeEl.getBoundingClientRect();

    setUnderline({
      left: tabRect.left - containerRect.left,
      width: tabRect.width,
    });
  }, [activeTab]);

  // Measure on mount + when activeTab changes
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // Re-measure on window resize
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // Arrow-key navigation (roving tabindex)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      const currentIdx = tabs.findIndex((t) => t.value === activeTab);
      let nextIdx = currentIdx;

      switch (e.key) {
        case 'ArrowRight':
          nextIdx = (currentIdx + 1) % tabs.length;
          break;
        case 'ArrowLeft':
          nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          nextIdx = 0;
          break;
        case 'End':
          nextIdx = tabs.length - 1;
          break;
        default:
          return; // Don't prevent default for unhandled keys
      }

      e.preventDefault();
      const nextTab = tabs[nextIdx];
      onTabChange(nextTab.value);
      tabRefs.current.get(nextTab.value)?.focus();
    },
    [tabs, activeTab, onTabChange]
  );

  return (
    <div className="relative" ref={containerRef} role="tablist">
      {/* Tab buttons */}
      <div className="flex gap-4 lg:gap-8">
        {tabs.map((tab) => {
          const isActive = tab.value === activeTab;
          const count = tabCounts ? tabCounts[tab.value] : undefined;

          return (
            <button
              key={tab.value}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.value, el);
              }}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.value)}
              onKeyDown={handleKeyDown}
              className={`
                flex-1 lg:flex-none pb-3 pt-1 text-center lg:text-left
                transition-colors duration-200 outline-none
                focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-sm
                ${isActive ? 'text-ink' : 'text-muted hover:text-charcoal'}
              `}
            >
              {/* Label row with optional dot */}
              <div className="flex items-center justify-center lg:justify-start gap-1.5">
                {tab.dotColor && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: tab.dotColor }}
                    aria-hidden="true"
                  />
                )}
                <span className="text-[10px] lg:text-[11px] uppercase tracking-[0.12em] font-medium">
                  {tab.label}
                </span>
              </div>

              {/* Count (hero number) */}
              <div
                className={`
                  text-[16px] lg:text-[20px] font-semibold tabular-nums mt-0.5
                  transition-colors duration-200
                  ${isActive ? 'text-ink' : 'text-muted/50'}
                `}
              >
                {tabCounts === null ? '\u00A0' : (count ?? '\u00A0')}
              </div>
            </button>
          );
        })}
      </div>

      {/* Baseline rule */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-border/30" aria-hidden="true" />

      {/* Sliding underline */}
      <div
        className="absolute bottom-0 h-[2px] bg-gold transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          left: underline?.left ?? 0,
          width: underline?.width ?? 0,
          opacity: underline ? 1 : 0,
        }}
        aria-hidden="true"
      />
    </div>
  );
}
