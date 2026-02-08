'use client';

import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
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

interface ArtistPageClientProps {
  data: ArtisanPageResponse;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

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

const FUJISHIRO_RANK: Record<string, number> = {
  'Saijō-saku': 5, 'Sai-jo saku': 5,
  'Jōjō-saku': 4, 'Jojo-saku': 4,
  'Jō-saku': 3, 'Jo-saku': 3,
  'Chūjō-saku': 2, 'Chujo-saku': 2,
  'Chū-saku': 1, 'Chu-saku': 1,
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
    items.push({ label: 'Certified Works', value: certifications.total_items.toLocaleString() });
  }
  if (certifications.kokuho_count > 0) {
    items.push({ label: 'Kokuhō', value: certifications.kokuho_count.toString() });
  }
  if (certifications.tokuju_count > 0) {
    items.push({ label: 'Tokubetsu Jūyō', value: certifications.tokuju_count.toString() });
  }
  if (entity.fujishiro) {
    const rank = FUJISHIRO_RANK[entity.fujishiro] || 0;
    if (rank > 0) {
      items.push({ label: 'Fujishiro', value: '★'.repeat(rank) });
    }
  }
  if (certifications.juyo_count > 0 && certifications.kokuho_count === 0) {
    items.push({ label: 'Jūyō', value: certifications.juyo_count.toString() });
  }
  if (availableCount !== null && availableCount > 0) {
    items.push({ label: 'Available Now', value: availableCount.toString(), highlight: true });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6">
      {items.map((item, i) => (
        <div key={i} className="flex items-baseline gap-2">
          <span className={`text-lg font-serif font-light tabular-nums ${item.highlight ? 'text-emerald-400' : 'text-gold'}`}>
            {item.value}
          </span>
          <span className={`text-xs uppercase tracking-wider ${item.highlight ? 'text-emerald-400/60' : 'text-muted/60'}`}>
            {item.label}
          </span>
        </div>
      ))}
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
              <h3 className="text-xs uppercase tracking-[0.2em] text-gold/70 mb-3">
                {section.title}
              </h3>
            )}
            <div className="text-sm text-ink/80 leading-[1.8] font-light space-y-3">
              {section.body.split('\n\n').map((paragraph, j) => {
                // Handle bullet points
                if (paragraph.includes('\n•') || paragraph.startsWith('•')) {
                  const bullets = paragraph.split('\n').filter(l => l.startsWith('•'));
                  return (
                    <ul key={j} className="space-y-1 pl-1">
                      {bullets.map((bullet, k) => (
                        <li key={k} className="flex gap-2 text-sm text-ink/70">
                          <span className="text-gold/50 flex-shrink-0">·</span>
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
          className="mt-4 text-xs text-gold hover:text-gold-light transition-colors tracking-wide uppercase"
        >
          {expanded ? 'Show less' : `Read full profile (${sections.length} sections)`}
        </button>
      )}
    </div>
  );
}

/** Thin decorative separator between major sections */
function SectionDivider() {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1 h-px bg-border/30" />
      <div className="w-1 h-1 rounded-full bg-gold/30" />
      <div className="flex-1 h-px bg-border/30" />
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export function ArtistPageClient({ data }: ArtistPageClientProps) {
  const { entity, certifications, rankings, profile, stats, lineage, related } = data;
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/artisan/${encodeURIComponent(entity.code)}/listings`)
      .then(res => res.json())
      .then(d => { if (!cancelled) setListings(d.listings || []); })
      .catch(() => { if (!cancelled) setListings([]); });
    return () => { cancelled = true; };
  }, [entity.code]);

  const listingsExist = listings !== null && listings.length > 0;

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
    if (profile?.profile_md) s.push({ id: 'biography', label: 'Biography' });
    if (certifications.total_items > 0) s.push({ id: 'certifications', label: 'Certifications' });
    if (hasDistributions) s.push({ id: 'distributions', label: 'Analysis' });
    if (listingsExist) s.push({ id: 'listings', label: 'Available' });
    if (lineage.teacher || lineage.students.length > 0) s.push({ id: 'lineage', label: 'Lineage' });
    if (related.length > 0) s.push({ id: 'related', label: 'School' });
    return s;
  }, [profile, certifications.total_items, hasDistributions, listingsExist, lineage, related]);

  const fujishiroLabel = entity.fujishiro ? FUJISHIRO_LABELS[entity.fujishiro] : null;
  const isTopGrade = rankings.elite_grade === 'S' || rankings.elite_grade === 'A';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <SectionJumpNav sections={sections} />

      <div className="py-10 space-y-10">

        {/* ═══════════════════════════════════════════════════════════════════
            OVERVIEW — Hero header with vitals
        ═══════════════════════════════════════════════════════════════════ */}
        <section id="overview">
          {/* Breadcrumb + Share */}
          <div className="flex items-center justify-between mb-8">
            <nav className="text-[11px] text-muted/50 tracking-wide">
              <Link href="/browse" className="hover:text-muted transition-colors">Browse</Link>
              <span className="mx-2">/</span>
              <span>Artists</span>
              <span className="mx-2">/</span>
              <span className="text-muted">{entity.name_romaji || entity.code}</span>
            </nav>
            <button
              onClick={handleShare}
              className="text-[11px] text-muted/50 hover:text-muted transition-colors flex items-center gap-1"
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

          {/* Name block */}
          <div className="mb-2">
            <div className="flex items-start gap-6">
              <div className="flex-1 min-w-0">
                <h1 className="text-4xl sm:text-5xl font-serif font-light text-ink leading-[1.1] tracking-tight">
                  {entity.name_romaji || entity.code}
                </h1>
                {entity.name_kanji && (
                  <p className="text-3xl sm:text-4xl text-muted/25 font-serif font-light mt-1 tracking-wide">
                    {entity.name_kanji}
                  </p>
                )}
              </div>

              {/* Grade badge — only for notable artisans */}
              {isTopGrade && certifications.total_items > 0 && (
                <div className="flex-shrink-0 text-right pt-1">
                  <div className="text-4xl sm:text-5xl font-serif font-light text-gold/80 leading-none">
                    {rankings.elite_grade}
                  </div>
                  <div className="text-[10px] text-muted/50 uppercase tracking-widest mt-1">
                    Grade
                  </div>
                </div>
              )}
            </div>

            {/* Hook quote */}
            {profile?.hook && (
              <p className="mt-5 text-sm text-muted/70 leading-relaxed italic max-w-xl">
                {profile.hook}
              </p>
            )}
          </div>

          {/* Quick stats bar */}
          <StatsBar data={data} availableCount={listings ? listings.length : null} />

          {/* Thin rule */}
          <div className="mt-8 mb-6 h-px bg-border/40" />

          {/* Vitals — structured like a museum label */}
          <div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-1.5 text-sm max-w-md">
            {entity.province && (
              <>
                <span className="text-muted/60">Province</span>
                <span className="text-ink">{entity.province}</span>
              </>
            )}
            {entity.era && (
              <>
                <span className="text-muted/60">Era</span>
                <span className="text-ink">{entity.era}</span>
              </>
            )}
            {entity.period && entity.period !== entity.era && (
              <>
                <span className="text-muted/60">Period</span>
                <span className="text-ink">{entity.period}</span>
              </>
            )}
            {entity.school && (
              <>
                <span className="text-muted/60">School</span>
                <span className="text-ink">{entity.school}</span>
              </>
            )}
            {entity.generation && (
              <>
                <span className="text-muted/60">Generation</span>
                <span className="text-ink">{entity.generation}</span>
              </>
            )}
            {entity.teacher && (
              <>
                <span className="text-muted/60">Teacher</span>
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
                <span className="text-muted/60">Fujishiro</span>
                <span className="text-ink">
                  {entity.fujishiro}
                  {fujishiroLabel && <span className="text-muted/50 ml-1.5">({fujishiroLabel})</span>}
                </span>
              </>
            )}
            {entity.toko_taikan != null && (
              <>
                <span className="text-muted/60">Tōkō Taikan</span>
                <span className="text-ink">
                  {entity.toko_taikan.toLocaleString()}
                  {rankings.toko_taikan_percentile != null && (
                    <span className="text-muted/50 ml-1.5">(top {Math.max(100 - rankings.toko_taikan_percentile, 1)}%)</span>
                  )}
                </span>
              </>
            )}
            <>
              <span className="text-muted/60">Type</span>
              <span className="text-ink">{entity.entity_type === 'smith' ? 'Swordsmith' : 'Tosogu Maker'}</span>
            </>
            <>
              <span className="text-muted/60">Code</span>
              <span className="text-ink font-mono text-xs">{entity.code}</span>
            </>
          </div>

          {/* Tosogu specialties */}
          {entity.specialties && entity.specialties.length > 0 && (
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-8 text-sm max-w-md">
              <span className="text-muted/60">Specialties</span>
              <span className="text-ink">{entity.specialties.join(', ')}</span>
            </div>
          )}

          {/* Browse CTA — show contextual link based on listings state */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href={`/browse?artisan=${encodeURIComponent(entity.code)}`}
              className="inline-flex items-center gap-1.5 text-xs text-gold/80 hover:text-gold transition-colors tracking-wide"
            >
              Browse all listings by {entity.name_romaji || entity.code}
              <span aria-hidden>&rarr;</span>
            </Link>
            {listings !== null && listings.length === 0 && (
              <Link
                href={`/saved-searches?artisan=${encodeURIComponent(entity.code)}`}
                className="inline-flex items-center gap-1.5 text-xs text-muted/50 hover:text-muted transition-colors tracking-wide"
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
            BIOGRAPHY — Rich scholarly profile
        ═══════════════════════════════════════════════════════════════════ */}
        {profile?.profile_md && (
          <>
            <SectionDivider />
            <section id="biography">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted/60 mb-5">Biography</h2>
              <Biography markdown={profile.profile_md} hook={profile.hook} />
              {profile.setsumei_count > 0 && (
                <p className="mt-4 text-[11px] text-muted/40 italic">
                  Profile informed by {profile.setsumei_count} translated setsumei
                </p>
              )}
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CERTIFICATIONS — Pyramid + Elite Standing
        ═══════════════════════════════════════════════════════════════════ */}
        {certifications.total_items > 0 && (
          <>
            <SectionDivider />
            <section id="certifications">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted/60 mb-6">Certifications</h2>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-8">
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
                  <div className="mt-3 pt-3 border-t border-border/30 flex items-baseline justify-between text-sm">
                    <span className="text-muted/60">Total certified</span>
                    <span className="text-ink font-light tabular-nums">{certifications.total_items}</span>
                  </div>
                </div>

                {/* Elite standing */}
                <div className="flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs text-muted/50 mb-3">Elite Standing</h3>
                    <EliteFactorDisplay
                      eliteFactor={certifications.elite_factor}
                      percentile={rankings.elite_percentile}
                      grade={rankings.elite_grade}
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
            DISTRIBUTIONS — Forms + Signatures
        ═══════════════════════════════════════════════════════════════════ */}
        {hasDistributions && (
          <>
            <SectionDivider />
            <section id="distributions">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted/60 mb-2">Analysis</h2>
              <p className="text-xs text-muted/40 mb-6 italic">
                Statistical breakdown across {certifications.total_items} certified works
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {/* Form distribution */}
                {hasFormStats && (
                  <div>
                    <h3 className="text-xs text-muted/50 mb-3 uppercase tracking-wider">Blade Forms</h3>
                    <FormDistributionBar distribution={stats.form_distribution} />
                  </div>
                )}

                {/* Mei distribution */}
                {hasMeiStats && (
                  <div>
                    <h3 className="text-xs text-muted/50 mb-3 uppercase tracking-wider">Signatures</h3>
                    <MeiDistributionBar distribution={stats.mei_distribution} />
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CURRENTLY AVAILABLE — Live listings
        ═══════════════════════════════════════════════════════════════════ */}
        {listingsExist && (
          <>
            <SectionDivider />
            <section id="listings">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted/60 mb-5">Currently Available</h2>
              <ArtisanListings code={entity.code} artisanName={entity.name_romaji} initialListings={listings} />
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LINEAGE — Teacher & Students
        ═══════════════════════════════════════════════════════════════════ */}
        {(lineage.teacher || lineage.students.length > 0) && (
          <>
            <SectionDivider />
            <section id="lineage">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted/60 mb-5">Lineage</h2>
              <div className="relative pl-6">
                {/* Vertical connection line */}
                <div className="absolute left-2 top-0 bottom-0 w-px bg-border/30" />

                {/* Teacher */}
                {lineage.teacher && (
                  <div className="relative pb-4">
                    <div className="absolute left-[-16px] top-1.5 w-2 h-2 rounded-full bg-border/50 ring-2 ring-surface" />
                    <span className="text-[10px] text-muted/50 uppercase tracking-wider block mb-0.5">Teacher</span>
                    <Link
                      href={`/artists/${lineage.teacher.slug}`}
                      className="text-sm text-ink hover:text-gold transition-colors"
                    >
                      {lineage.teacher.name_romaji || lineage.teacher.code}
                    </Link>
                  </div>
                )}

                {/* Current artisan marker */}
                <div className="relative pb-4">
                  <div className="absolute left-[-16px] top-1.5 w-2 h-2 rounded-full bg-gold ring-2 ring-surface" />
                  <span className="text-sm font-medium text-ink">
                    {entity.name_romaji || entity.code}
                  </span>
                </div>

                {/* Students */}
                {lineage.students.length > 0 && (
                  <div className="relative">
                    <div className="absolute left-[-16px] top-1.5 w-2 h-2 rounded-full bg-border/50 ring-2 ring-surface" />
                    <span className="text-[10px] text-muted/50 uppercase tracking-wider block mb-1.5">
                      {lineage.students.length === 1 ? 'Student' : `Students (${lineage.students.length})`}
                    </span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {lineage.students.map((student, i) => (
                        <span key={student.code}>
                          <Link
                            href={`/artists/${student.slug}`}
                            className="text-sm text-ink hover:text-gold transition-colors"
                          >
                            {student.name_romaji || student.code}
                          </Link>
                          {i < lineage.students.length - 1 && (
                            <span className="text-muted/30 ml-2">·</span>
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
            <SectionDivider />
            <section id="related">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted/60 mb-5">
                {entity.school ? `${entity.school} School` : 'Related Artisans'}
              </h2>
              <RelatedArtisans artisans={related} schoolName={entity.school} />
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            FOOTER — Subtle coming soon note
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="pt-6 border-t border-border/20">
          <p className="text-[11px] text-muted/30 text-center leading-relaxed">
            Setsumei translations and provenance records are being prepared for this profile.
          </p>
        </div>

      </div>
    </div>
  );
}
