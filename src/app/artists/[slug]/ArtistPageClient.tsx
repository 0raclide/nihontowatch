'use client';

import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { Listing } from '@/types';
import { PrestigePyramid } from '@/components/artisan/PrestigePyramid';
import { EliteFactorDisplay } from '@/components/artisan/EliteFactorDisplay';
import { FormDistributionBar } from '@/components/artisan/FormDistributionBar';
import { MeiDistributionBar } from '@/components/artisan/MeiDistributionBar';
import { SectionJumpNav } from '@/components/artisan/SectionJumpNav';
import { ArtisanListings } from '@/components/artisan/ArtisanListings';
import { RelatedArtisans } from '@/components/artisan/RelatedArtisans';
import type { ArtisanPageResponse } from '@/app/api/artisan/[code]/route';
import { getArtisanDisplayParts } from '@/lib/artisan/displayName';

interface ArtistPageClientProps {
  data: ArtisanPageResponse;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const COLLECTION_LABELS: Record<string, string> = {
  'Tokuju': 'Tokubetsu Jūyō',
  'Juyo': 'Jūyō',
  'Kokuho': 'Kokuhō',
  'JuBun': 'Jūyō Bunkazai',
  'Jubi': 'Jūyō Bijutsuhin',
};

const FUJISHIRO_LABELS: Record<string, string> = {
  'Saijō-saku':  'Supreme Work',
  'Sai-jo saku': 'Supreme Work',
  'Jōjō-saku':  'Superior Work',
  'Jojo-saku':   'Superior Work',
  'Jō-saku':    'Fine Work',
  'Jo-saku':     'Fine Work',
  'Chūjō-saku': 'Above Average',
  'Chujo-saku':  'Above Average',
  'Chū-saku':   'Average Work',
  'Chu-saku':    'Average Work',
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Render inline markdown formatting: **bold**, *italic*, [links](url)
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  // Combined pattern: **bold**, *italic*, [text](url)
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // **bold**
      parts.push(<strong key={key++} className="font-medium text-ink">{match[1]}</strong>);
    } else if (match[2]) {
      // *italic*
      parts.push(<em key={key++}>{match[2]}</em>);
    } else if (match[3] && match[4]) {
      // [text](url)
      parts.push(
        <a key={key++} href={match[4]} className="text-gold hover:text-gold-light underline underline-offset-2" target="_blank" rel="noopener noreferrer">
          {match[3]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────

/** Quick stats bar shown below the name */
function StatsBar({ data, availableCount }: { data: ArtisanPageResponse; availableCount: number | null }) {
  const { certifications, entity } = data;
  const items: Array<{ label: string; value: string; highlight?: boolean }> = [];

  if (certifications.total_items > 0) {
    items.push({ label: 'Ranked Works', value: certifications.total_items.toLocaleString() });
  }
  if (certifications.kokuho_count > 0) {
    items.push({ label: 'Kokuhō', value: certifications.kokuho_count.toString() });
  }
  if (certifications.jubun_count > 0) {
    items.push({ label: 'Jūyō Bunkazai', value: certifications.jubun_count.toString() });
  }
  if (certifications.jubi_count > 0) {
    items.push({ label: 'Jūyō Bijutsuhin', value: certifications.jubi_count.toString() });
  }
  if (certifications.gyobutsu_count > 0) {
    items.push({ label: 'Gyobutsu', value: certifications.gyobutsu_count.toString() });
  }
  if (certifications.tokuju_count > 0) {
    items.push({ label: 'Tokubetsu Jūyō', value: certifications.tokuju_count.toString() });
  }
  if (certifications.juyo_count > 0) {
    items.push({ label: 'Jūyō', value: certifications.juyo_count.toString() });
  }
  if (availableCount !== null && availableCount > 0) {
    items.push({ label: 'Available Now', value: availableCount.toString(), highlight: true });
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-8 pt-6 border-t border-border/20">
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col">
            <span className={`text-2xl font-serif font-light tabular-nums leading-none ${item.highlight ? 'text-emerald-400' : 'text-gold'}`}>
              {item.value}
            </span>
            <span className={`text-[10px] uppercase tracking-[0.15em] mt-1.5 ${item.highlight ? 'text-emerald-400/60' : 'text-ink/40'}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Expandable biography section */
function Biography({ markdown, hook }: { markdown: string; hook: string | null }) {
  const [expanded, setExpanded] = useState(false);

  // Parse markdown sections, removing hook duplication
  const sections = useMemo(() => {
    const parts = markdown.split(/^## /m).filter(Boolean);
    return parts.map((part, i) => {
      const lines = part.split('\n');
      const title = lines[0].trim();
      let body = lines.slice(1).join('\n').trim();

      // For the first section, remove the leading paragraph if it matches the hook
      if (i === 0 && hook) {
        const hookNorm = hook.replace(/[^\w\s]/g, '').toLowerCase().slice(0, 60);
        const bodyNorm = body.replace(/[^\w\s]/g, '').toLowerCase().slice(0, 60);
        if (bodyNorm.startsWith(hookNorm.slice(0, 40))) {
          // Remove the first paragraph (up to double newline)
          const firstBreak = body.indexOf('\n\n');
          if (firstBreak > 0) {
            body = body.slice(firstBreak + 2).trim();
          }
        }
      }

      return { title, body };
    });
  }, [markdown, hook]);

  // Show first section always, rest on expand
  const visibleSections = expanded ? sections : sections.slice(0, 1);
  const hasMore = sections.length > 1;

  return (
    <div>
      <div className="space-y-6">
        {visibleSections.map((section, i) => (
          <div key={i}>
            {/* Don't show the first section title if it matches generic pattern */}
            {(i > 0 || !section.title.match(/^THE SMITH|THE MAKER|OVERVIEW/i)) && (
              <h3 className="text-xs font-serif font-light tracking-wide text-gold/70 mb-3">
                {section.title}
              </h3>
            )}
            <div className="text-[13.5px] text-ink/80 leading-[1.9] font-light space-y-4">
              {section.body.split('\n\n').map((paragraph, j) => {
                // Handle bullet points
                if (paragraph.includes('\n•') || paragraph.startsWith('•')) {
                  const bullets = paragraph.split('\n').filter(l => l.startsWith('•'));
                  return (
                    <ul key={j} className="space-y-1.5 pl-1">
                      {bullets.map((bullet, k) => (
                        <li key={k} className="flex gap-2.5 text-[13.5px] text-ink/70">
                          <span className="text-gold/50 flex-shrink-0 leading-[1.9]">·</span>
                          <span>{renderInlineMarkdown(bullet.replace(/^•\s*/, ''))}</span>
                        </li>
                      ))}
                    </ul>
                  );
                }
                if (paragraph.trim()) {
                  return <p key={j}>{renderInlineMarkdown(paragraph.trim())}</p>;
                }
                return null;
              })}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-6 text-[11px] text-gold hover:text-gold-light transition-colors tracking-[0.15em] uppercase"
        >
          {expanded ? 'Show less' : `Read full profile (${sections.length} sections)`}
        </button>
      )}
    </div>
  );
}

/** Section header — thin rule + small-caps title, like a catalog chapter heading */
function SectionHeader({ title, subtitle, id, className = '' }: { title: string; subtitle?: string; id?: string; className?: string }) {
  return (
    <div id={id} className={className}>
      <div className="h-px bg-border/30 mb-5" />
      <h2 className="text-[13px] uppercase tracking-[0.18em] text-ink/60 font-medium">
        {title}
      </h2>
      {subtitle && (
        <p className="text-[12.5px] text-ink/35 mt-1 italic font-light">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/** Fullscreen image lightbox with click/Escape to close */
function ImageLightbox({ src, alt, caption, onClose }: { src: string; alt: string; caption: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 animate-fadeIn cursor-zoom-out"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full
          bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[85vh] max-w-[90vw] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Caption */}
      <p className="mt-3 text-[11px] text-white/40 tracking-wider uppercase text-center">
        {caption}
      </p>
    </div>,
    document.body
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export function ArtistPageClient({ data }: ArtistPageClientProps) {
  const { entity, certifications, rankings, profile, stats, lineage, related, denrai: rawDenrai, heroImage } = data;
  const denrai = useMemo(
    () => rawDenrai.filter(d => !/^(own(er|ed)\s+(at|by)\s|at\s+time\s+of\s|current\s+owner|listed\s+in\s|formerly\s+(owned|held)\s+by\s|needs\s+research|meibutsu|known\s+as\s|identified\s+with\s|said\s+to\s|reportedly\s|tradition:|thereafter\s|transmitted\s+to\s|later\s+held\s+by\s|presented\s+to\s|bestowed\s+by\s|koshigatani?\s)/i.test(d.owner)),
    [rawDenrai]
  );
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [soldListings, setSoldListings] = useState<Listing[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/artisan/${encodeURIComponent(entity.code)}/listings`)
      .then(res => res.json())
      .then(d => { if (!cancelled) setListings(d.listings || []); })
      .catch(() => { if (!cancelled) setListings([]); });
    fetch(`/api/artisan/${encodeURIComponent(entity.code)}/listings?status=sold`)
      .then(res => res.json())
      .then(d => { if (!cancelled) setSoldListings(d.listings || []); })
      .catch(() => { if (!cancelled) setSoldListings([]); });
    return () => { cancelled = true; };
  }, [entity.code]);

  const listingsExist = listings !== null && listings.length > 0;
  const soldListingsExist = soldListings !== null && soldListings.length > 0;

  const handleShare = useCallback(() => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: entity.name_romaji || entity.code, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  }, [entity.name_romaji, entity.code]);

  const hasFormStats = stats && Object.keys(stats.form_distribution)
    .filter(k => k !== 'total')
    .some(k => (stats.form_distribution[k] || 0) > 0);

  const hasMeiStats = stats && Object.keys(stats.mei_distribution)
    .filter(k => k !== 'total')
    .some(k => (stats.mei_distribution[k] || 0) > 0);

  const hasDistributions = hasFormStats || hasMeiStats;

  const sections = useMemo(() => {
    const s: Array<{ id: string; label: string }> = [];
    s.push({ id: 'overview', label: 'Overview' });
    if (certifications.total_items > 0) s.push({ id: 'certifications', label: 'Certifications' });
    if (hasFormStats) s.push({ id: 'blade-forms', label: entity.entity_type === 'smith' ? 'Blade Forms' : 'Work Types' });
    if (hasMeiStats) s.push({ id: 'signatures', label: 'Signatures' });
    if (denrai.length > 0) s.push({ id: 'provenance', label: 'Provenance' });
    if (listingsExist) s.push({ id: 'listings', label: 'Available' });
    if (soldListingsExist) s.push({ id: 'sold', label: 'Previously Sold' });
    if (lineage.teacher || lineage.students.length > 0) s.push({ id: 'lineage', label: 'Lineage' });
    if (related.length > 0) s.push({ id: 'related', label: 'School' });
    return s;
  }, [entity.entity_type, certifications.total_items, hasFormStats, hasMeiStats, listingsExist, soldListingsExist, lineage, related, denrai]);

  const fujishiroLabel = entity.fujishiro ? FUJISHIRO_LABELS[entity.fujishiro] : null;

  return (
    <div className="max-w-[780px] mx-auto px-5 sm:px-8">
      <SectionJumpNav sections={sections} />

      <div className="pt-12 pb-20 space-y-16">

        {/* ═══════════════════════════════════════════════════════════════════
            OVERVIEW — Hero header with vitals
        ═══════════════════════════════════════════════════════════════════ */}
        <section id="overview">
          {/* Breadcrumb + Share */}
          <div className="flex items-center justify-between mb-8">
            <nav className="text-[11px] text-ink/40 tracking-widest uppercase">
              <Link href="/" className="hover:text-ink/60 transition-colors">Browse</Link>
              <span className="mx-2 text-ink/20">/</span>
              <Link href="/artists" className="hover:text-ink/60 transition-colors">Artists</Link>
              <span className="mx-2 text-ink/20">/</span>
              <span className="text-ink/50">{entity.name_romaji || entity.code}</span>
            </nav>
            <button
              onClick={handleShare}
              className="text-[11px] text-ink/40 hover:text-ink/60 transition-colors flex items-center gap-1.5"
              title="Share this profile"
            >
              {copied ? (
                <span className="text-gold">Copied</span>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0-12.814a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0 12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                  </svg>
                  <span>Share</span>
                </>
              )}
            </button>
          </div>

          {/* Hero — Image + Identity as one cohesive unit */}
          <div className={`flex flex-col ${heroImage ? 'sm:flex-row sm:items-start sm:gap-8' : ''}`}>
            {/* Catalog image — natural aspect ratio, sharp edges, museum plate */}
            {heroImage && (
              <figure className="shrink-0 mb-5 sm:mb-0">
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="block w-[200px] sm:w-[220px] border border-border/20 shadow-sm cursor-zoom-in
                    hover:shadow-md hover:border-border/30 transition-all duration-200 bg-black/5"
                  aria-label="View full-size image"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroImage.imageUrl}
                    alt={`${heroImage.imageType === 'oshigata' ? 'Oshigata' : 'Image'} — ${entity.name_romaji || entity.code}, ${COLLECTION_LABELS[heroImage.collection] || heroImage.collection}`}
                    className="w-full h-auto object-contain max-h-[300px] sm:max-h-[340px]"
                    loading="eager"
                  />
                </button>
                <figcaption className="mt-1.5 w-[200px] sm:w-[220px] text-center">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-gold/50 font-medium">
                    {COLLECTION_LABELS[heroImage.collection] || heroImage.collection}
                  </div>
                  <div className="text-[10px] text-ink/25 tabular-nums">
                    Vol. {heroImage.volume}, No. {heroImage.itemNumber}
                    {heroImage.formType && <> &middot; {heroImage.formType}</>}
                  </div>
                </figcaption>
              </figure>
            )}

            {/* Identity + Vitals */}
            <div className="flex-1 min-w-0">
              <div className="w-10 h-[2px] bg-gold/50 mb-4" />

              <h1 className="text-3xl sm:text-[2.5rem] font-serif font-light text-ink leading-[1.1] tracking-tight">
                {(() => { const dp = getArtisanDisplayParts(entity.name_romaji, entity.school); return <>{dp.prefix && <>{dp.prefix} </>}{dp.name || entity.code}</>; })()}
              </h1>
              {entity.name_kanji && (
                <p className="text-lg text-ink/35 font-serif font-light mt-1.5 tracking-[0.08em]">
                  {entity.name_kanji}
                </p>
              )}

              {/* Metadata grid */}
              <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13px] leading-snug">
                {entity.province && (
                  <>
                    <span className="text-ink/50">Province</span>
                    <span className="text-ink">{entity.province}</span>
                  </>
                )}
                {entity.era && (
                  <>
                    <span className="text-ink/50">Era</span>
                    <span className="text-ink">{entity.era}</span>
                  </>
                )}
                {entity.period && entity.period !== entity.era && (
                  <>
                    <span className="text-ink/50">Period</span>
                    <span className="text-ink">{entity.period}</span>
                  </>
                )}
                {entity.school && (
                  <>
                    <span className="text-ink/50">School</span>
                    <span className="text-ink">{entity.school}</span>
                  </>
                )}
                {entity.generation && (
                  <>
                    <span className="text-ink/50">Generation</span>
                    <span className="text-ink">{entity.generation}</span>
                  </>
                )}
                {entity.teacher && (
                  <>
                    <span className="text-ink/50">Teacher</span>
                    {lineage.teacher ? (
                      <Link href={`/artists/${lineage.teacher.slug}`} className="text-ink hover:text-gold transition-colors">
                        {lineage.teacher.name_romaji || entity.teacher}
                      </Link>
                    ) : (
                      <span className="text-ink">{entity.teacher}</span>
                    )}
                  </>
                )}
                {entity.fujishiro && (
                  <>
                    <span className="text-ink/50">Fujishiro</span>
                    <span className="text-ink">
                      {entity.fujishiro}
                      {fujishiroLabel && <span className="text-ink/25 ml-1">({fujishiroLabel})</span>}
                    </span>
                  </>
                )}
                {entity.toko_taikan != null && (
                  <>
                    <span className="text-ink/50">Toko Taikan</span>
                    <span className="text-ink tabular-nums">
                      {entity.toko_taikan.toLocaleString()}
                      {rankings.toko_taikan_percentile != null && (
                        <span className="text-ink/25 ml-1">(top {Math.max(100 - rankings.toko_taikan_percentile, 1)}%)</span>
                      )}
                    </span>
                  </>
                )}
                {entity.specialties && entity.specialties.length > 0 && (
                  <>
                    <span className="text-ink/50">Specialties</span>
                    <span className="text-ink">{entity.specialties.join(', ')}</span>
                  </>
                )}
                <span className="text-ink/50">Type</span>
                <span className="text-ink">{entity.entity_type === 'smith' ? 'Swordsmith' : 'Tosogu Maker'}</span>
                <span className="text-ink/50">Code</span>
                <span className="text-ink font-mono text-xs tracking-wide">{entity.code}</span>
              </div>
            </div>
          </div>

          {/* Hook — epigraph */}
          {profile?.hook && (
            <p className="mt-8 pl-5 border-l-[3px] border-gold/40 text-[14px] text-ink/55 leading-[1.8] italic font-light max-w-xl">
              {profile.hook}
            </p>
          )}

          {/* Quick stats bar */}
          <StatsBar data={data} availableCount={listings ? listings.length : null} />

          {/* Browse CTA */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href={`/?artisan=${encodeURIComponent(entity.code)}&tab=all`}
              className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold-light transition-colors tracking-wide"
            >
              Browse all listings
              <span aria-hidden>&rarr;</span>
            </Link>
            {listings !== null && listings.length === 0 && (
              <Link
                href={`/saved-searches?artisan=${encodeURIComponent(entity.code)}`}
                className="inline-flex items-center gap-1.5 text-xs text-ink/40 hover:text-ink/60 transition-colors tracking-wide"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                Set alert for new listings
              </Link>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            CERTIFICATIONS — Pyramid + Elite Standing
        ═══════════════════════════════════════════════════════════════════ */}
        {certifications.total_items > 0 && (
          <>
            <section>
              <SectionHeader id="certifications" title="Certifications" className="mb-7" />

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-10">
                {/* Hierarchy */}
                <div>
                  <PrestigePyramid
                    kokuho={certifications.kokuho_count}
                    jubun={certifications.jubun_count}
                    jubi={certifications.jubi_count}
                    gyobutsu={certifications.gyobutsu_count}
                    tokuju={certifications.tokuju_count}
                    juyo={certifications.juyo_count}
                  />
                  <div className="mt-4 pt-4 border-t border-border/20 flex items-baseline justify-between text-sm">
                    <span className="text-ink/45">Ranked works</span>
                    <span className="text-ink font-light tabular-nums">{certifications.total_items}</span>
                  </div>
                </div>

                {/* Elite standing */}
                <div className="flex flex-col justify-between">
                  <div>
                    <h3 className="text-[12px] uppercase tracking-[0.12em] text-ink/50 font-medium mb-3">Elite Standing</h3>
                    <EliteFactorDisplay
                      eliteFactor={certifications.elite_factor}
                      percentile={rankings.elite_percentile}
                      totalItems={certifications.total_items}
                      eliteCount={certifications.elite_count}
                    />
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            BLADE FORMS — Form distribution across certified works
        ═══════════════════════════════════════════════════════════════════ */}
        {hasFormStats && (
          <>
            <section>
              <SectionHeader
                id="blade-forms"
                title={entity.entity_type === 'smith' ? 'Blade Forms' : 'Work Types'}
                subtitle={`Distribution across ${certifications.total_items} ranked works`}
                className="mb-6"
              />
              <FormDistributionBar distribution={stats.form_distribution} />
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SIGNATURES — Mei type distribution across certified works
        ═══════════════════════════════════════════════════════════════════ */}
        {hasMeiStats && (
          <>
            <section>
              <SectionHeader
                id="signatures"
                title="Signatures"
                subtitle={`Signature types across ${certifications.total_items} ranked works`}
                className="mb-6"
              />
              <MeiDistributionBar distribution={stats.mei_distribution} />
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PROVENANCE — Historical collections
        ═══════════════════════════════════════════════════════════════════ */}
        {denrai.length > 0 && (
          <>
            <section>
              <SectionHeader
                id="provenance"
                title="Provenance"
                subtitle={`Certified works by ${entity.name_romaji || entity.code} have been held in the following collections`}
                className="mb-6"
              />

              <div className="space-y-0">
                {denrai.map((d, i) => (
                  <div
                    key={d.owner}
                    className={`flex items-baseline justify-between py-3 ${
                      i < denrai.length - 1 ? 'border-b border-border/15' : ''
                    }`}
                  >
                    <span className="text-sm text-ink font-light">{d.owner}</span>
                    {d.count > 1 && (
                      <span className="text-xs text-ink/35 tabular-nums ml-4">
                        {d.count} {d.count === 1 ? 'work' : 'works'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CURRENTLY AVAILABLE — Live listings
        ═══════════════════════════════════════════════════════════════════ */}
        {listingsExist && (
          <>
            <section>
              <SectionHeader id="listings" title="Currently Available" className="mb-6" />
              <ArtisanListings code={entity.code} artisanName={entity.name_romaji} initialListings={listings} status="available" />
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PREVIOUSLY SOLD — Sold/unavailable listings
        ═══════════════════════════════════════════════════════════════════ */}
        {soldListingsExist && (
          <>
            <section>
              <SectionHeader id="sold" title="Previously Sold" className="mb-6" />
              <ArtisanListings code={entity.code} artisanName={entity.name_romaji} initialListings={soldListings} status="sold" />
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LINEAGE — Teacher & Students
        ═══════════════════════════════════════════════════════════════════ */}
        {(lineage.teacher || lineage.students.length > 0) && (
          <>
            <section>
              <SectionHeader id="lineage" title="Lineage" className="mb-6" />
              <div className="relative pl-7">
                {/* Vertical connection line */}
                <div className="absolute left-[9px] top-0 bottom-0 w-px bg-border/25" />

                {/* Teacher */}
                {lineage.teacher && (
                  <div className="relative pb-5">
                    <div className="absolute left-[-19px] top-1.5 w-[7px] h-[7px] rounded-full bg-border/40 ring-[2.5px] ring-surface" />
                    <span className="text-[10px] text-ink/35 uppercase tracking-widest block mb-1">Teacher</span>
                    <Link
                      href={`/artists/${lineage.teacher.slug}`}
                      className="text-sm text-ink hover:text-gold transition-colors"
                    >
                      {lineage.teacher.name_romaji || lineage.teacher.code}
                    </Link>
                  </div>
                )}

                {/* Current artisan marker */}
                <div className="relative pb-5">
                  <div className="absolute left-[-19px] top-1.5 w-[7px] h-[7px] rounded-full bg-gold/80 ring-[2.5px] ring-surface" />
                  <span className="text-sm font-medium text-ink">
                    {entity.name_romaji || entity.code}
                  </span>
                </div>

                {/* Students */}
                {lineage.students.length > 0 && (
                  <div className="relative">
                    <div className="absolute left-[-19px] top-1.5 w-[7px] h-[7px] rounded-full bg-border/40 ring-[2.5px] ring-surface" />
                    <span className="text-[10px] text-ink/35 uppercase tracking-widest block mb-2">
                      {lineage.students.length === 1 ? 'Student' : `Students (${lineage.students.length})`}
                    </span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                      {lineage.students.map((student, i) => (
                        <span key={student.code}>
                          <Link
                            href={`/artists/${student.slug}`}
                            className="text-sm text-ink hover:text-gold transition-colors"
                          >
                            {student.name_romaji || student.code}
                          </Link>
                          {i < lineage.students.length - 1 && (
                            <span className="text-ink/20 ml-2">·</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            RELATED ARTISANS — Same school peers
        ═══════════════════════════════════════════════════════════════════ */}
        {related.length > 0 && (
          <>
            <section>
              <SectionHeader
                id="related"
                title={entity.school ? `${entity.school} School` : 'Related Artisans'}
                className="mb-6"
              />
              <RelatedArtisans artisans={related} schoolName={entity.school} />
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            FOOTER — Endpiece
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="pt-8 pb-2">
          <div className="flex justify-center">
            <div className="w-6 h-px bg-border/20" />
          </div>
        </div>

      </div>

      {/* Image Lightbox */}
      {heroImage && lightboxOpen && (
        <ImageLightbox
          src={heroImage.imageUrl}
          alt={`${heroImage.imageType === 'oshigata' ? 'Oshigata' : 'Image'} — ${entity.name_romaji || entity.code}`}
          caption={`${COLLECTION_LABELS[heroImage.collection] || heroImage.collection} — Vol. ${heroImage.volume}, No. ${heroImage.itemNumber}${heroImage.formType ? ` · ${heroImage.formType}` : ''}`}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
