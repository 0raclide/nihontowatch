'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ProvenanceEntry, KiwameEntry } from '@/types';

const KIWAME_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  origami: { label: 'Origami', color: 'text-[var(--sc-accent-gold)]' },
  kinzogan: { label: 'Kinzōgan', color: 'text-[var(--sc-text-secondary)]' },
  saya_mei: { label: 'Saya-mei', color: 'text-[var(--sc-text-secondary)]' },
  other: { label: 'Appraisal', color: 'text-[var(--sc-text-secondary)]' },
};

interface ShowcaseTimelineProps {
  provenance: ProvenanceEntry[];
  kiwame?: KiwameEntry[];
  onImageClick: (url: string) => void;
}

/**
 * Provenance timeline + kiwame appraisals.
 * Desktop: horizontal timeline. Mobile: vertical.
 */
export function ShowcaseTimeline({ provenance, kiwame, onImageClick }: ShowcaseTimelineProps) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-0">
      {/* Provenance — Desktop horizontal */}
      <div className="hidden md:block">
        <div className="relative">
          {/* Horizontal line */}
          <div className="absolute top-4 left-0 right-0 h-[2px] bg-[var(--sc-divider)]" />

          <div className="flex justify-between">
            {provenance.map((entry, i) => {
              const hasImages = entry.images && entry.images.length > 0;
              return (
                <div key={entry.id} className="relative flex flex-col items-center" style={{ flex: 1 }}>
                  {/* Dot */}
                  <div className={`w-3 h-3 rounded-full z-10 mb-4 ${
                    hasImages ? 'bg-[var(--sc-accent-gold)]' : 'bg-[var(--sc-divider)]'
                  }`} />

                  {/* Content */}
                  <div className="text-center px-2 max-w-[180px]">
                    <p className="text-[14px] font-medium text-[var(--sc-text-primary)] mb-1">
                      {entry.owner_name}
                    </p>
                    {entry.owner_name_ja && (
                      <p className="text-[12px] text-[var(--sc-text-secondary)] mb-1">
                        {entry.owner_name_ja}
                      </p>
                    )}
                    {entry.notes && (
                      <p className="text-[12px] text-[var(--sc-text-secondary)]/70 leading-relaxed">
                        {entry.notes}
                      </p>
                    )}

                    {/* Thumbnails */}
                    {hasImages && (
                      <div className="flex gap-1 mt-2 justify-center">
                        {entry.images.slice(0, 3).map((img, j) => (
                          <button
                            key={j}
                            onClick={() => onImageClick(img)}
                            className="relative w-10 h-10 rounded overflow-hidden ring-1 ring-[var(--sc-border)] hover:ring-[var(--sc-accent-gold)] transition-all"
                          >
                            <Image src={img} alt={`${entry.owner_name} document`} fill className="object-cover" sizes="40px" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Arrow connector (not on last) */}
                  {i < provenance.length - 1 && (
                    <div className="absolute top-[14px] right-0 w-2 h-2 border-t-2 border-r-2 border-[var(--sc-divider)] transform rotate-45 translate-x-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Provenance — Mobile vertical */}
      <div className="md:hidden">
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[5px] top-0 bottom-0 w-[2px] bg-[var(--sc-divider)]" />

          <div className="space-y-6">
            {provenance.map((entry) => {
              const hasImages = entry.images && entry.images.length > 0;
              return (
                <div key={entry.id} className="relative">
                  {/* Dot */}
                  <div className={`absolute -left-6 top-1 w-3 h-3 rounded-full ${
                    hasImages ? 'bg-[var(--sc-accent-gold)]' : 'bg-[var(--sc-divider)]'
                  }`} />

                  <div>
                    <p className="text-[14px] font-medium text-[var(--sc-text-primary)]">
                      {entry.owner_name}
                    </p>
                    {entry.owner_name_ja && (
                      <p className="text-[12px] text-[var(--sc-text-secondary)]">
                        {entry.owner_name_ja}
                      </p>
                    )}
                    {entry.notes && (
                      <p className="text-[12px] text-[var(--sc-text-secondary)]/70 mt-1 leading-relaxed">
                        {entry.notes}
                      </p>
                    )}

                    {/* Thumbnails */}
                    {hasImages && (
                      <div className="flex gap-1.5 mt-2">
                        {entry.images.slice(0, 3).map((img, j) => (
                          <button
                            key={j}
                            onClick={() => onImageClick(img)}
                            className="relative w-12 h-12 rounded overflow-hidden ring-1 ring-[var(--sc-border)] hover:ring-[var(--sc-accent-gold)] transition-all"
                          >
                            <Image src={img} alt={`${entry.owner_name} document`} fill className="object-cover" sizes="48px" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Kiwame appraisals */}
      {kiwame && kiwame.length > 0 && (
        <div className="mt-12 md:mt-16">
          <div className="w-8 h-[1px] bg-[var(--sc-divider)] mx-auto mb-6" />
          <h3 className="text-[11px] uppercase tracking-[0.15em] text-[var(--sc-text-secondary)] text-center mb-6">
            Expert Appraisals
          </h3>
          <div className="space-y-4 max-w-xl mx-auto">
            {kiwame.map(entry => {
              const typeInfo = KIWAME_TYPE_LABELS[entry.kiwame_type] || KIWAME_TYPE_LABELS.other;
              return (
                <div key={entry.id} className="flex items-start gap-4 p-4 rounded-lg bg-[var(--sc-bg-card)] border border-[var(--sc-border)]">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[14px] font-medium text-[var(--sc-text-primary)]">
                        {entry.judge_name}
                      </span>
                      {entry.judge_name_ja && (
                        <span className="text-[12px] text-[var(--sc-text-secondary)]">
                          {entry.judge_name_ja}
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] uppercase tracking-wider ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    {entry.notes && (
                      <p className="text-[13px] text-[var(--sc-text-secondary)] mt-2 leading-relaxed">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
