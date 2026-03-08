'use client';

import Image from 'next/image';
import type { ProvenanceEntry, KiwameEntry } from '@/types';

const KIWAME_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  origami: { label: 'Origami', color: 'text-gold' },
  kinzogan: { label: 'Kinz\u014Dgan', color: 'text-charcoal' },
  saya_mei: { label: 'Saya-mei', color: 'text-charcoal' },
  other: { label: 'Appraisal', color: 'text-charcoal' },
};

interface ShowcaseTimelineProps {
  provenance: ProvenanceEntry[];
  kiwame?: KiwameEntry[];
  onImageClick: (url: string) => void;
}

/**
 * Provenance timeline + kiwame appraisals.
 * Desktop: horizontal timeline with refined dots matching artist page lineage.
 * Mobile: vertical timeline.
 */
export function ShowcaseTimeline({ provenance, kiwame, onImageClick }: ShowcaseTimelineProps) {
  return (
    <div className="max-w-5xl mx-auto px-6 md:px-0">
      {/* Provenance — Desktop horizontal */}
      {provenance.length > 0 && (
        <>
          <div className="hidden md:block">
            <div className="relative">
              {/* Horizontal line */}
              <div className="absolute top-[5px] left-0 right-0 h-px bg-border-subtle" />

              <div className="flex justify-between">
                {provenance.map((entry) => {
                  const hasImages = entry.images && entry.images.length > 0;
                  return (
                    <div key={entry.id} className="relative flex flex-col items-center" style={{ flex: 1 }}>
                      {/* Dot */}
                      <div className={`w-[9px] h-[9px] rounded-full z-10 mb-4 ring-[2.5px] ring-background ${
                        hasImages ? 'bg-gold/50' : 'bg-border-subtle'
                      }`} />

                      {/* Content */}
                      <div className="text-center px-2 max-w-[200px]">
                        <p className="text-[13px] font-medium text-ink mb-0.5 leading-snug">
                          {entry.owner_name}
                        </p>
                        {entry.owner_name_ja && (
                          <p className="text-[12px] text-muted mb-0.5">
                            {entry.owner_name_ja}
                          </p>
                        )}
                        {entry.notes && (
                          <p className="text-[11px] text-muted leading-relaxed mt-1">
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
                                className="relative w-10 h-10 rounded overflow-hidden ring-1 ring-border hover:ring-gold/50 transition-all cursor-zoom-in"
                              >
                                <Image src={img} alt={`${entry.owner_name} document`} fill className="object-cover" sizes="40px" />
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

          {/* Provenance — Mobile vertical */}
          <div className="md:hidden">
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-[4px] top-0 bottom-0 w-px bg-border-subtle" />

              <div className="space-y-6">
                {provenance.map((entry) => {
                  const hasImages = entry.images && entry.images.length > 0;
                  return (
                    <div key={entry.id} className="relative">
                      {/* Dot */}
                      <div className={`absolute -left-6 top-1.5 w-[9px] h-[9px] rounded-full ring-[2.5px] ring-background ${
                        hasImages ? 'bg-gold/50' : 'bg-border-subtle'
                      }`} />

                      <div>
                        <p className="text-[13px] font-medium text-ink leading-snug">
                          {entry.owner_name}
                        </p>
                        {entry.owner_name_ja && (
                          <p className="text-[12px] text-muted">
                            {entry.owner_name_ja}
                          </p>
                        )}
                        {entry.notes && (
                          <p className="text-[11px] text-muted mt-1 leading-relaxed">
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
                                className="relative w-12 h-12 rounded overflow-hidden ring-1 ring-border hover:ring-gold/50 transition-all cursor-zoom-in"
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
        </>
      )}

      {/* Kiwame appraisals */}
      {kiwame && kiwame.length > 0 && (
        <div className={provenance.length > 0 ? 'mt-14 md:mt-16' : ''}>
          {provenance.length > 0 && (
            <div className="h-px bg-border/30 mb-5" />
          )}
          <h3 className="text-[13px] uppercase tracking-[0.18em] font-medium text-charcoal mb-6">
            Expert Appraisals
          </h3>
          <div className="space-y-3 max-w-xl">
            {kiwame.map(entry => {
              const typeInfo = KIWAME_TYPE_LABELS[entry.kiwame_type] || KIWAME_TYPE_LABELS.other;
              return (
                <div key={entry.id} className="py-3 border-b border-border-subtle">
                  <div className="flex items-baseline gap-3 mb-0.5">
                    <span className="text-[13px] font-medium text-ink">
                      {entry.judge_name}
                    </span>
                    {entry.judge_name_ja && (
                      <span className="text-[12px] text-muted">
                        {entry.judge_name_ja}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] uppercase tracking-[0.15em] ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                  {entry.notes && (
                    <p className="text-[12px] text-charcoal mt-1.5 leading-relaxed">
                      {entry.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
