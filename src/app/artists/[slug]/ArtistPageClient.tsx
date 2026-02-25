'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { Listing } from '@/types';
import { PrestigePyramid } from '@/components/artisan/PrestigePyramid';
import { EliteFactorDisplay } from '@/components/artisan/EliteFactorDisplay';
import { ProvenancePyramid, ProvenanceFactorDisplay } from '@/components/artisan/ProvenancePyramid';
import { computeProvenanceAnalysis } from '@/lib/artisan/provenanceMock';
import { FormDistributionBar } from '@/components/artisan/FormDistributionBar';
import { MeiDistributionBar } from '@/components/artisan/MeiDistributionBar';
import { SectionJumpNav } from '@/components/artisan/SectionJumpNav';
import { ArtisanListings } from '@/components/artisan/ArtisanListings';
import { RelatedArtisans } from '@/components/artisan/RelatedArtisans';
import type { ArtisanPageResponse } from '@/types/artisan';
import { getArtisanDisplayParts, getArtisanAlias, norm } from '@/lib/artisan/displayName';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { CatalogueShowcase } from '@/components/artisan/CatalogueShowcase';
import { HighlightedMarkdown } from '@/components/glossary/HighlightedMarkdown';
import { SaveSearchModal } from '@/components/browse/SaveSearchModal';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useLocale } from '@/i18n/LocaleContext';

interface ArtistPageClientProps {
  data: ArtisanPageResponse;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

function getCollectionLabels(t: (key: string, params?: Record<string, string | number>) => string): Record<string, string> {
  return {
    'Tokuju': t('cert.Tokuju'),
    'Juyo': t('cert.Juyo'),
    'Kokuho': t('cert.Kokuho'),
    'JuBun': t('cert.Juyo Bunkazai'),
    'Jubi': t('cert.Juyo Bijutsuhin'),
  };
}

function getFujishiroLabels(t: (key: string, params?: Record<string, string | number>) => string): Record<string, string> {
  return {
    'Saijō-saku':  t('fujishiro.saijoFull'),
    'Sai-jo saku': t('fujishiro.saijoFull'),
    'Jōjō-saku':  t('fujishiro.jojoFull'),
    'Jojo-saku':   t('fujishiro.jojoFull'),
    'Jō-saku':    t('fujishiro.joFull'),
    'Jo-saku':     t('fujishiro.joFull'),
    'Chūjō-saku': t('fujishiro.chujoFull'),
    'Chujo-saku':  t('fujishiro.chujoFull'),
    'Chū-saku':   t('fujishiro.chuFull'),
    'Chu-saku':    t('fujishiro.chuFull'),
  };
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────

/** Quick stats bar shown below the name */
function StatsBar({ data, availableCount }: { data: ArtisanPageResponse; availableCount: number | null }) {
  const { t } = useLocale();
  const { certifications, entity } = data;
  const items: Array<{ label: string; value: string; highlight?: boolean }> = [];

  if (certifications.kokuho_count > 0) {
    items.push({ label: t('pyramid.kokuho'), value: certifications.kokuho_count.toString() });
  }
  if (certifications.jubun_count > 0) {
    items.push({ label: t('pyramid.jubun'), value: certifications.jubun_count.toString() });
  }
  if (certifications.jubi_count > 0) {
    items.push({ label: t('pyramid.jubi'), value: certifications.jubi_count.toString() });
  }
  if (certifications.gyobutsu_count > 0) {
    items.push({ label: t('pyramid.gyobutsu'), value: certifications.gyobutsu_count.toString() });
  }
  if (certifications.tokuju_count > 0) {
    items.push({ label: t('pyramid.tokuju'), value: certifications.tokuju_count.toString() });
  }
  if (certifications.juyo_count > 0) {
    items.push({ label: t('pyramid.juyo'), value: certifications.juyo_count.toString() });
  }
  if (availableCount !== null && availableCount > 0) {
    items.push({ label: t('artists.onTheMarket'), value: availableCount.toString(), highlight: true });
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-8 pt-6 border-t border-border/20">
      <div className="flex flex-wrap gap-x-6 sm:gap-x-10 gap-y-4">
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

/** Biography section — renders markdown with glossary-linked technical terms */
function Biography({ markdown }: { markdown: string }) {
  return (
    <article className="prose-biography">
      <HighlightedMarkdown content={markdown} variant="biography" />
    </article>
  );
}

/** Section header — thin rule + small-caps title, like a catalog chapter heading */
function SectionHeader({ title, subtitle, id, className = '' }: { title: string; subtitle?: string; id?: string; className?: string }) {
  return (
    <div id={id} className={`scroll-mt-24 ${className}`}>
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
  const { t } = useLocale();
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
        aria-label={t('artist.close')}
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
  const { entity, certifications, rankings, profile, stats, lineage, related, denraiGrouped: rawDenraiGrouped, heroImage, provenance: dbProvenance } = data;
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const { requireFeature } = useSubscription();
  const COLLECTION_LABELS = useMemo(() => getCollectionLabels(t), [t]);
  const FUJISHIRO_LABELS = useMemo(() => getFujishiroLabels(t), [t]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const noisePattern = /^(own(er|ed)\s+(at|by)\s|at\s+time\s+of\s|current\s+owner|listed\s+in\s|formerly\s+(owned|held)\s+by\s|needs\s+research|meibutsu|known\s+as\s|identified\s+with\s|said\s+to\s|reportedly\s|tradition:|thereafter\s|transmitted\s+to\s|later\s+held\s+by\s|presented\s+to\s|bestowed\s+by\s|koshigatani?\s)/i;
  const denraiGrouped = useMemo(() => {
    if (!rawDenraiGrouped) return [];
    return rawDenraiGrouped
      .map(g => {
        const filtered = g.children.filter(c => !noisePattern.test(c.owner));
        if (filtered.length === 0) return null;
        return {
          ...g,
          children: filtered,
          totalCount: filtered.reduce((sum, c) => sum + c.count, 0),
          isGroup: filtered.length > 1,
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [rawDenraiGrouped]);
  const provenanceAnalysis = useMemo(
    () => computeProvenanceAnalysis(denraiGrouped),
    [denraiGrouped]
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
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

  // Scroll to hash anchor on mount (e.g. #listings from artist directory "on the market" link)
  // The anchor element is always in the DOM (skeleton shown while loading), so we can scroll immediately.
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (hasScrolledRef.current) return;
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    hasScrolledRef.current = true;
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

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
    s.push({ id: 'overview', label: t('artist.overview') });
    if (data.catalogueEntries?.length) s.push({ id: 'catalogue', label: t('artist.catalogue') });
    if (certifications.total_items > 0) s.push({ id: 'certifications', label: t('artist.designations') });
    if (denraiGrouped.length > 0) s.push({ id: 'provenance', label: t('artist.provenance') });
    if (hasFormStats) s.push({ id: 'blade-forms', label: entity.entity_type === 'smith' ? t('artist.bladeForms') : t('artist.workTypes') });
    if (hasMeiStats) s.push({ id: 'signatures', label: t('artist.signatures') });
    if (listingsExist) s.push({ id: 'listings', label: t('artist.currentlyAvailable') });
    if (soldListingsExist) s.push({ id: 'sold', label: t('artist.previouslySold') });
    if (lineage.teacher || lineage.students.length > 0) s.push({ id: 'lineage', label: t('artist.lineage') });
    if (related.length > 0) s.push({ id: 'related', label: t('artist.school') });
    return s;
  }, [entity.entity_type, certifications.total_items, data.catalogueEntries, hasFormStats, hasMeiStats, listingsExist, soldListingsExist, lineage, related, denraiGrouped, t]);

  const fujishiroLabel = entity.fujishiro ? (FUJISHIRO_LABELS[entity.fujishiro] || null) : null;

  return (
    <div className="max-w-[780px] mx-auto px-4 sm:px-8">
        <SectionJumpNav sections={sections} />

        <div className="pt-12 pb-20 space-y-16">

        {/* ═══════════════════════════════════════════════════════════════════
            OVERVIEW — Hero header with vitals
        ═══════════════════════════════════════════════════════════════════ */}
        <section id="overview" className="scroll-mt-24">
          {/* Breadcrumb + Share */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <Breadcrumbs
              items={[
                { name: t('artist.home'), url: '/' },
                { name: t('artist.breadcrumbArtists'), url: '/artists' },
                { name: entity.name_romaji || entity.code },
              ]}
              className="mb-0"
            />
            <button
              onClick={handleShare}
              className="text-[11px] text-ink/40 hover:text-ink/60 transition-colors flex items-center gap-1.5"
              title={t('artist.shareProfile')}
            >
              {copied ? (
                <span className="text-gold">{t('artist.copied')}</span>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0-12.814a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0 12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                  </svg>
                  <span>{t('artist.share')}</span>
                </>
              )}
            </button>
          </div>

          {/* Hero — Image + Identity as one cohesive unit */}
          <div>
            {/* Title block — full width on mobile, inside metadata column on desktop */}
            <div className="sm:hidden mb-4">
              <div className="w-8 h-[2px] bg-gold/50 mb-3" />
              <h1 className="text-2xl font-serif font-light text-ink leading-[1.1] tracking-tight">
                {(() => { const dp = getArtisanDisplayParts(entity.name_romaji, entity.school); const alias = getArtisanAlias(entity.code); const schoolSuffix = entity.code.startsWith('NS-') ? (locale === 'ja' ? '派' : ' School') : ''; if (alias && dp.name && norm(alias).includes(norm(dp.name))) return alias + schoolSuffix; return <>{dp.prefix && <>{dp.prefix} </>}{dp.name || entity.code}{schoolSuffix}{alias && <span className="text-ink/40"> ({alias})</span>}</>; })()}
              </h1>
              {entity.name_kanji && (
                <p className="text-base text-ink/35 font-serif font-light mt-1 tracking-[0.08em]">
                  {entity.name_kanji}
                </p>
              )}
            </div>

            <div className={`flex ${heroImage ? 'flex-row items-start gap-3 sm:gap-8' : 'flex-col'}`}>
              {/* Catalog image — natural aspect ratio, sharp edges, museum plate */}
              {heroImage && (
                <figure className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="block w-[140px] sm:w-[220px] border border-border/20 shadow-sm cursor-zoom-in
                      hover:shadow-md hover:border-border/30 transition-all duration-200 bg-black/5"
                    aria-label={t('artist.viewFullSize')}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroImage.imageUrl}
                      alt={`${heroImage.imageType === 'oshigata' ? t('artist.oshigata') : t('artist.image')} — ${entity.name_romaji || entity.code}, ${COLLECTION_LABELS[heroImage.collection] || heroImage.collection}`}
                      className="w-full h-auto object-contain max-h-[260px] sm:max-h-[340px]"
                      loading="eager"
                    />
                  </button>
                  <figcaption className="mt-1.5 w-[140px] sm:w-[220px] text-center">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-gold/50 font-medium">
                      {COLLECTION_LABELS[heroImage.collection] || heroImage.collection}
                    </div>
                    <div className="text-[10px] text-ink/25 tabular-nums">
                      {t('artist.vol')} {heroImage.volume}, {t('artist.no')} {heroImage.itemNumber}
                      {heroImage.formType && <> &middot; {heroImage.formType}</>}
                    </div>
                  </figcaption>
                </figure>
              )}

              {/* Identity + Vitals */}
              <div className="flex-1 min-w-0">
                {/* Title — desktop only (mobile title is above) */}
                <div className="hidden sm:block">
                  <div className="w-10 h-[2px] bg-gold/50 mb-4" />
                  <h1 className="text-[2.5rem] font-serif font-light text-ink leading-[1.1] tracking-tight">
                    {(() => { const dp = getArtisanDisplayParts(entity.name_romaji, entity.school); const alias = getArtisanAlias(entity.code); const schoolSuffix = entity.code.startsWith('NS-') ? (locale === 'ja' ? '派' : ' School') : ''; if (alias && dp.name && norm(alias).includes(norm(dp.name))) return alias + schoolSuffix; return <>{dp.prefix && <>{dp.prefix} </>}{dp.name || entity.code}{schoolSuffix}{alias && <span className="text-ink/40"> ({alias})</span>}</>; })()}
                  </h1>
                  {entity.name_kanji && (
                    <p className="text-lg text-ink/35 font-serif font-light mt-1.5 tracking-[0.08em]">
                      {entity.name_kanji}
                    </p>
                  )}
                </div>

                {/* Context line — museum wall label */}
                {certifications.total_items > 0 && (
                  <p className="sm:mt-2.5 text-[12px] text-gold tracking-wide italic">
                    {t('artist.rankedWorks', { count: certifications.total_items })}
                  </p>
                )}

                {/* Metadata grid */}
                <div className="mt-2 sm:mt-5 grid grid-cols-[auto_1fr] gap-x-3 sm:gap-x-6 gap-y-1 sm:gap-y-1.5 text-[12px] sm:text-[13px] leading-snug">
                  {entity.province && (
                    <>
                      <span className="text-ink/50">{t('artist.province')}</span>
                      <span className="text-ink">{entity.province}</span>
                    </>
                  )}
                  {entity.era && (
                    <>
                      <span className="text-ink/50">{t('artist.era')}</span>
                      <span className="text-ink">{entity.era}</span>
                    </>
                  )}
                  {entity.period && entity.period !== entity.era && (
                    <>
                      <span className="text-ink/50">{t('artist.period')}</span>
                      <span className="text-ink">{entity.period}</span>
                    </>
                  )}
                  {entity.school && (
                    <>
                      <span className="text-ink/50">{t('artist.school')}</span>
                      {data.schoolAncestry && data.schoolAncestry.length > 1 ? (
                        <span className="text-ink">
                          {data.schoolAncestry.map((s, i) => (
                            <span key={s.code}>
                              {i > 0 && <span className="text-ink/30 mx-1">{'>'}</span>}
                              <Link href={`/artists/${s.code}`} className="hover:text-gold transition-colors">
                                {locale === 'ja' && s.name_kanji ? s.name_kanji : s.name_romaji}
                              </Link>
                            </span>
                          ))}
                        </span>
                      ) : entity.school_code ? (
                        <Link href={`/artists/${entity.school_code}`} className="text-ink hover:text-gold transition-colors">
                          {entity.school}
                        </Link>
                      ) : (
                        <span className="text-ink">{entity.school}</span>
                      )}
                    </>
                  )}
                  {entity.school_tradition && (
                    <>
                      <span className="text-ink/50">{t('artist.tradition')}</span>
                      <span className="text-ink">{entity.school_tradition}</span>
                    </>
                  )}
                  {entity.generation && (
                    <>
                      <span className="text-ink/50">{t('artist.generation')}</span>
                      <span className="text-ink">{entity.generation}</span>
                    </>
                  )}
                  {entity.teacher && (
                    <>
                      <span className="text-ink/50">{t('artist.teacher')}</span>
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
                      <span className="text-ink/50">{t('artist.fujishiro')}</span>
                      <span className="text-ink">
                        {entity.fujishiro}
                        {fujishiroLabel && <span className="hidden sm:inline text-ink/25 ml-1">({fujishiroLabel})</span>}
                      </span>
                    </>
                  )}
                  {entity.toko_taikan != null && (
                    <>
                      <span className="text-ink/50">{t('artist.tokoTaikan')}</span>
                      <span className="text-ink tabular-nums">
                        {entity.toko_taikan.toLocaleString()}
                        {rankings.toko_taikan_percentile != null && (
                          <span className="text-ink/25 ml-1">({t('artist.topPercent', { pct: Math.max(100 - rankings.toko_taikan_percentile, 1) })})</span>
                        )}
                      </span>
                    </>
                  )}
                  {entity.specialties && entity.specialties.length > 0 && (
                    <>
                      <span className="text-ink/50">{t('artist.specialties')}</span>
                      <span className="text-ink">{entity.specialties.join(', ')}</span>
                    </>
                  )}
                  <span className="text-ink/50">{t('artist.type')}</span>
                  <span className="text-ink">{entity.entity_type === 'smith' ? t('artist.swordsmith') : t('artist.tosoguMaker')}</span>
                  <span className="text-ink/50">{t('artist.code')}</span>
                  <span className="text-ink font-mono text-xs tracking-wide">{entity.code}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hook — epigraph */}
          {profile?.hook && (
            <blockquote className="mt-10 pl-5 border-l-[3px] border-gold/30 text-[16px] text-ink/55 leading-[1.8] italic font-normal font-serif max-w-[55ch]">
              {profile.hook}
            </blockquote>
          )}

          {/* Quick stats bar */}
          <StatsBar data={data} availableCount={listings ? listings.length : null} />

          {/* Browse CTA */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            {listings !== null && listings.length > 0 && (
              <Link
                href={`/?artisan=${encodeURIComponent(entity.code)}&tab=all`}
                className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold-light transition-colors tracking-wide"
              >
                {t('artist.browseListings')}
                <span aria-hidden>&rarr;</span>
              </Link>
            )}
            {listings !== null && (
              <button
                onClick={() => {
                  if (!user) { setShowLoginModal(true); return; }
                  if (!requireFeature('saved_searches')) return;
                  setShowSaveModal(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-ink/40 hover:text-ink/60 transition-colors tracking-wide"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                {t('artist.setAlert')}
              </button>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            BIOGRAPHY — AI-generated profile from setsumei analysis
        ═══════════════════════════════════════════════════════════════════ */}
        {profile?.profile_md && (
          <section>
            <SectionHeader id="overview" title={t('artist.overview')} className="mb-7" />
            <Biography markdown={locale === 'ja' && profile.profile_md_ja ? profile.profile_md_ja : profile.profile_md} />
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PUBLISHED WORKS — Catalogue showcase (lead with the showpiece)
        ═══════════════════════════════════════════════════════════════════ */}
        {data.catalogueEntries && data.catalogueEntries.length > 0 && (
          <section>
            <SectionHeader id="catalogue" title={t('artist.publishedWorks')} className="mb-7" />
            <CatalogueShowcase
              entry={data.catalogueEntries[0]}
              totalEntries={data.catalogueEntries.length}
              artisanName={entity.name_romaji}
            />
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CERTIFICATIONS — Pyramid + Elite Standing
        ═══════════════════════════════════════════════════════════════════ */}
        {certifications.total_items > 0 && (
          <>
            <section>
              <SectionHeader id="certifications" title={t('artist.designations')} className="mb-7" />

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-6 sm:gap-10">
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
                </div>

                {/* Elite standing */}
                <div className="flex flex-col justify-between">
                  <div>
                    <h3 className="text-[12px] uppercase tracking-[0.12em] text-ink/50 font-medium mb-3">{t('artist.eliteStanding')}</h3>
                    <EliteFactorDisplay
                      eliteFactor={certifications.elite_factor}
                      percentile={rankings.elite_percentile}
                      totalItems={certifications.total_items}
                      eliteCount={certifications.elite_count}
                      entityType={entity.entity_type}
                    />
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PROVENANCE — Historical collections (Provenance Pyramid + Factor)
        ═══════════════════════════════════════════════════════════════════ */}
        {provenanceAnalysis && (
          <>
            <section>
              <SectionHeader
                id="provenance"
                title={t('artist.provenance')}
                subtitle={`${provenanceAnalysis.count !== 1 ? t('artist.documentedProvenances', { count: provenanceAnalysis.count }) : t('artist.documentedProvenance', { count: provenanceAnalysis.count })} ${t('artist.acrossCertifiedWorks')} ${entity.name_romaji || entity.code}`}
                className="mb-7"
              />

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-6 sm:gap-10">
                {/* Provenance Pyramid — tier distribution */}
                <div>
                  <ProvenancePyramid analysis={provenanceAnalysis} />
                </div>

                {/* Provenance Standing — the score */}
                <div className="flex flex-col justify-between">
                  <div>
                    <h3 className="text-[12px] uppercase tracking-[0.12em] text-ink/50 font-medium mb-3">{t('artist.provenanceStanding')}</h3>
                    <ProvenanceFactorDisplay
                      analysis={provenanceAnalysis}
                      entityType={entity.entity_type}
                      percentile={rankings.provenance_percentile}
                      dbFactor={dbProvenance?.factor}
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
                title={entity.entity_type === 'smith' ? t('artist.bladeForms') : t('artist.workTypes')}
                subtitle={t('artist.distributionAcross', { count: certifications.total_items })}
                className="mb-6"
              />
              <FormDistributionBar
                distribution={stats.form_distribution}
                measurementsByForm={stats.measurements_by_form}
              />
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
                title={t('artist.signatures')}
                subtitle={t('artist.signatureTypesAcross', { count: certifications.total_items })}
                className="mb-6"
              />
              <MeiDistributionBar distribution={stats.mei_distribution} />
            </section>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CURRENTLY AVAILABLE — Live listings
        ═══════════════════════════════════════════════════════════════════ */}
        {(listings === null || listingsExist) && (
          <section>
            <SectionHeader id="listings" title={t('artist.currentlyAvailable')} className="mb-6" />
            {listings === null ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-4">
                    <div className="w-20 h-20 bg-border/20 rounded" />
                    <div className="flex-1 space-y-2 py-2">
                      <div className="h-3 bg-border/20 rounded w-3/4" />
                      <div className="h-3 bg-border/20 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ArtisanListings code={entity.code} artisanName={entity.name_romaji} initialListings={listings} status="available" />
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            PREVIOUSLY SOLD — Sold/unavailable listings
        ═══════════════════════════════════════════════════════════════════ */}
        {soldListingsExist && (
          <>
            <section>
              <SectionHeader id="sold" title={t('artist.previouslySold')} className="mb-6" />
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
              <SectionHeader id="lineage" title={t('artist.lineage')} className="mb-6" />
              <div className="relative pl-7">
                {/* Vertical connection line */}
                <div className="absolute left-[9px] top-0 bottom-0 w-px bg-border/25" />

                {/* Teacher */}
                {lineage.teacher && (
                  <div className="relative pb-5">
                    <div className="absolute left-[-19px] top-1.5 w-[7px] h-[7px] rounded-full bg-border/40 ring-[2.5px] ring-surface" />
                    <span className="text-[10px] text-ink/35 uppercase tracking-widest block mb-1">{t('artist.teacher')}</span>
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
                      {lineage.students.length === 1 ? t('artist.student') : t('artist.students', { count: lineage.students.length })}
                    </span>
                    <div className="space-y-0">
                      {lineage.students.map((student, i) => (
                        <Link
                          key={student.code}
                          href={`/artists/${student.slug}`}
                          className={`flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-3 py-2 group hover:bg-hover/30 -mx-2 px-2 rounded transition-colors ${
                            i < lineage.students.length - 1 ? 'border-b border-border/15' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="text-sm text-ink group-hover:text-gold transition-colors">
                              {student.name_romaji || student.code}
                            </span>
                            {student.name_kanji && (
                              <span className="text-sm text-ink/35 ml-2">
                                {student.name_kanji}
                              </span>
                            )}
                          </div>
                          <div className="flex-shrink-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-xs tabular-nums">
                            {student.kokuho_count > 0 && (
                              <span className="text-ink font-semibold">{student.kokuho_count} {t('pyramid.kokuho')}</span>
                            )}
                            {student.jubun_count > 0 && (
                              <span className="text-ink font-semibold">{student.jubun_count} {t('pyramid.jubun')}</span>
                            )}
                            {student.jubi_count > 0 && (
                              <span className="text-ink font-medium">{student.jubi_count} {t('pyramid.jubi')}</span>
                            )}
                            {student.gyobutsu_count > 0 && (
                              <span className="text-ink font-medium">{student.gyobutsu_count} {t('pyramid.gyobutsu')}</span>
                            )}
                            {student.tokuju_count > 0 && (
                              <span className="text-ink/50">{student.tokuju_count} {t('pyramid.tokuju')}</span>
                            )}
                            {student.juyo_count > 0 && (
                              <span className="text-ink/50">{student.juyo_count} {t('pyramid.juyo')}</span>
                            )}
                            {(student.available_count ?? 0) > 0 && (
                              <span className="text-emerald-500 dark:text-emerald-400">{student.available_count} {t('artist.forSale')}</span>
                            )}
                          </div>
                        </Link>
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
                title={entity.school ? t('artist.schoolOf', { name: entity.school }) : t('artist.relatedArtisans')}
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
          alt={`${heroImage.imageType === 'oshigata' ? t('artist.oshigata') : t('artist.image')} — ${entity.name_romaji || entity.code}`}
          caption={`${COLLECTION_LABELS[heroImage.collection] || heroImage.collection} — ${t('artist.vol')} ${heroImage.volume}, ${t('artist.no')} ${heroImage.itemNumber}${heroImage.formType ? ` · ${heroImage.formType}` : ''}`}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* Save Search Modal — only mounted when open to avoid stale criteria refs */}
      {showSaveModal && (
        <SaveSearchModal
          isOpen
          onClose={() => setShowSaveModal(false)}
          criteria={{ query: entity.code, tab: 'available' }}
        />
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
}
