'use client';

import Link from 'next/link';
import { useLocale } from '@/i18n/LocaleContext';

/**
 * RelatedArtisans — Quiet list of same-school peers.
 * Museum catalog style: no cards, just clean rows.
 */

interface RelatedArtisan {
  code: string;
  name_romaji: string | null;
  name_kanji: string | null;
  slug: string;
  school: string | null;
  kokuho_count: number;
  jubun_count: number;
  jubi_count: number;
  gyobutsu_count: number;
  juyo_count: number;
  tokuju_count: number;
  elite_factor: number;
  available_count?: number;
}

interface RelatedArtisansProps {
  artisans: RelatedArtisan[];
  schoolName: string | null;
}

export function RelatedArtisans({ artisans, schoolName }: RelatedArtisansProps) {
  const { t, locale } = useLocale();
  if (artisans.length === 0) return null;

  return (
    <div>
      {schoolName && (
        <p className="text-xs text-ink/45 mb-4 italic">
          {t('artist.otherArtisans', { school: schoolName })}
        </p>
      )}

      <div className="space-y-0">
        {artisans.map((artisan, i) => (
          <Link
            key={artisan.code}
            href={`/artists/${artisan.slug}`}
            className={`flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-3 py-2.5 group hover:bg-hover/30 -mx-2 px-2 rounded transition-colors ${
              i < artisans.length - 1 ? 'border-b border-border/20' : ''
            }`}
          >
            <div className="min-w-0">
              <span className="text-sm text-ink group-hover:text-gold transition-colors">
                {locale === 'ja' && artisan.name_kanji ? artisan.name_kanji : (artisan.name_romaji || artisan.code)}
              </span>
              {locale === 'ja' && artisan.name_kanji && artisan.name_romaji && (
                <span className="text-sm text-ink/35 ml-2">
                  {artisan.name_romaji}
                </span>
              )}
              {locale !== 'ja' && artisan.name_kanji && (
                <span className="text-sm text-ink/35 ml-2">
                  {artisan.name_kanji}
                </span>
              )}
            </div>
            <div className="flex-shrink-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-xs tabular-nums">
              {artisan.kokuho_count > 0 && (
                <span className="text-ink font-semibold">{artisan.kokuho_count} {t('pyramid.kokuho')}</span>
              )}
              {artisan.jubun_count > 0 && (
                <span className="text-ink font-semibold">{artisan.jubun_count} {t('pyramid.jubun')}</span>
              )}
              {artisan.jubi_count > 0 && (
                <span className="text-ink font-medium">{artisan.jubi_count} {t('pyramid.jubi')}</span>
              )}
              {artisan.gyobutsu_count > 0 && (
                <span className="text-ink font-medium">{artisan.gyobutsu_count} {t('pyramid.gyobutsu')}</span>
              )}
              {artisan.tokuju_count > 0 && (
                <span className="text-ink/50">{artisan.tokuju_count} {t('pyramid.tokuju')}</span>
              )}
              {artisan.juyo_count > 0 && (
                <span className="text-ink/50">{artisan.juyo_count} {t('pyramid.juyo')}</span>
              )}
              {(artisan.available_count ?? 0) > 0 && (
                <span className="text-emerald-500 dark:text-emerald-400">{artisan.available_count} {t('artist.forSale')}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
