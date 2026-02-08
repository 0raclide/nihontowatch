'use client';

import Link from 'next/link';

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
  juyo_count: number;
  tokuju_count: number;
  elite_factor: number;
}

interface RelatedArtisansProps {
  artisans: RelatedArtisan[];
  schoolName: string | null;
}

export function RelatedArtisans({ artisans, schoolName }: RelatedArtisansProps) {
  if (artisans.length === 0) return null;

  return (
    <div>
      {schoolName && (
        <p className="text-xs text-muted mb-4 italic">
          Other artisans of the {schoolName} school
        </p>
      )}

      <div className="space-y-0">
        {artisans.map((artisan, i) => (
          <Link
            key={artisan.code}
            href={`/artists/${artisan.slug}`}
            className={`flex items-baseline justify-between py-2.5 group hover:bg-hover/30 -mx-2 px-2 rounded transition-colors ${
              i < artisans.length - 1 ? 'border-b border-border/20' : ''
            }`}
          >
            <div className="min-w-0">
              <span className="text-sm text-ink group-hover:text-gold transition-colors">
                {artisan.name_romaji || artisan.code}
              </span>
              {artisan.name_kanji && (
                <span className="text-sm text-muted/40 ml-2">
                  {artisan.name_kanji}
                </span>
              )}
            </div>
            <div className="flex-shrink-0 flex items-baseline gap-4 text-xs text-muted tabular-nums">
              {artisan.tokuju_count > 0 && (
                <span>{artisan.tokuju_count} tokujū</span>
              )}
              {artisan.juyo_count > 0 && (
                <span>{artisan.juyo_count} jūyō</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
