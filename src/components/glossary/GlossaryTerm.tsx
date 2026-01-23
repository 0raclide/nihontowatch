'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { GlossaryEntry } from '@/lib/glossary/types';
import { CATEGORY_LABELS } from '@/lib/glossary/types';

interface GlossaryTermProps {
  entry: GlossaryEntry;
  children: React.ReactNode;
}

export function GlossaryTerm({ entry, children }: GlossaryTermProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const termRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Position tooltip relative to viewport
  useEffect(() => {
    if (isOpen && termRef.current) {
      const rect = termRef.current.getBoundingClientRect();
      const tooltipWidth = 288; // w-72 = 18rem = 288px
      const tooltipHeight = 150; // approximate height
      const padding = 12;

      // Calculate horizontal position
      let left = rect.left;
      if (left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding;
      }
      if (left < padding) {
        left = padding;
      }

      // Calculate vertical position
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top: number;
      if (spaceBelow >= tooltipHeight + padding || spaceBelow >= spaceAbove) {
        // Show below
        top = rect.bottom + 8;
      } else {
        // Show above
        top = rect.top - tooltipHeight - 8;
      }

      setTooltipStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${tooltipWidth}px`,
        zIndex: 10001,
      });
    }
  }, [isOpen]);

  // Close on click outside and scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        termRef.current &&
        !termRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => setIsOpen(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  // Create tooltip portal
  const tooltip =
    isOpen && mounted
      ? createPortal(
          <div
            ref={tooltipRef}
            style={tooltipStyle}
            className="p-3 rounded-lg bg-surface-elevated border border-border shadow-xl animate-fadeIn"
            role="tooltip"
            aria-live="polite"
          >
            {/* Header with term and kanji */}
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-sm font-medium text-ink">{entry.term}</span>
              {entry.kanji && (
                <span className="text-sm text-gold font-jp">{entry.kanji}</span>
              )}
            </div>

            {/* Definition */}
            <p className="text-xs text-ink/80 leading-relaxed">
              {entry.definition}
            </p>

            {/* Category badge */}
            {entry.category && (
              <div className="mt-2 pt-2 border-t border-border">
                <span className="text-[9px] uppercase tracking-wider text-muted">
                  {CATEGORY_LABELS[entry.category] || entry.category.replace(/_/g, ' ')}
                </span>
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={termRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-gold font-medium hover:text-gold-light cursor-pointer transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {children}
      </button>
      {tooltip}
    </>
  );
}

export default GlossaryTerm;
