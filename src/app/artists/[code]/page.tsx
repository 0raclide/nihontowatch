import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getArtistProfile, getSmithEntity } from '@/lib/supabase/yuhinkai';
import { HighlightedMarkdown } from '@/components/glossary/HighlightedMarkdown';

interface ArtistPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { code } = await params;
  const smith = await getSmithEntity(code);

  const name = smith?.name_romaji || code;
  const title = `${name} - Artist Profile | NihontoWatch`;
  const description = smith
    ? `Comprehensive profile of ${name}, ${smith.province || 'Japanese'} swordsmith. ${smith.juyo_count} Juyo, ${smith.tokuju_count} Tokubetsu Juyo certified works.`
    : `Artist profile for ${code}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
    },
  };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { code } = await params;

  const [profile, smith] = await Promise.all([
    getArtistProfile(code),
    getSmithEntity(code),
  ]);

  if (!profile) {
    notFound();
  }

  const name = smith?.name_romaji || code;
  const kanji = smith?.name_kanji;

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-border bg-surface-elevated">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link
            href="/browse"
            className="text-sm text-muted hover:text-gold mb-4 inline-block"
          >
            &larr; Back to Browse
          </Link>

          <div className="flex items-baseline gap-4">
            <h1 className="text-3xl font-serif text-ink">
              {name}
            </h1>
            {kanji && (
              <span className="text-2xl text-muted font-serif">
                {kanji}
              </span>
            )}
          </div>

          {smith && (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {smith.province && (
                <span>{smith.province} Province</span>
              )}
              {smith.era && (
                <span>{smith.era}</span>
              )}
              {smith.school && (
                <span>{smith.school} School</span>
              )}
              {smith.fujishiro && (
                <span className="text-gold">{smith.fujishiro}</span>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          {/* Main Profile Content */}
          <article className="prose-translation text-[15px] leading-relaxed text-ink/90">
            <HighlightedMarkdown content={profile.profile_md} variant="translation" />
          </article>

          {/* Sidebar Stats */}
          {smith && (
            <aside className="lg:sticky lg:top-4 h-fit">
              <div className="bg-surface-elevated border border-border rounded-lg p-5">
                <h3 className="text-sm font-medium text-ink mb-4 pb-2 border-b border-border">
                  Certification Statistics
                </h3>

                <div className="space-y-3 text-sm">
                  {smith.kokuho_count > 0 && (
                    <StatRow label="Kokuho" value={smith.kokuho_count} highlight />
                  )}
                  {smith.jubun_count > 0 && (
                    <StatRow label="Juyo Bunkazai" value={smith.jubun_count} highlight />
                  )}
                  {smith.jubi_count > 0 && (
                    <StatRow label="Juyo Bijutsuhin" value={smith.jubi_count} />
                  )}
                  {smith.tokuju_count > 0 && (
                    <StatRow label="Tokubetsu Juyo" value={smith.tokuju_count} highlight />
                  )}
                  {smith.juyo_count > 0 && (
                    <StatRow label="Juyo Token" value={smith.juyo_count} />
                  )}

                  <div className="pt-3 mt-3 border-t border-border">
                    <StatRow label="Total Certified" value={smith.total_items} />
                    <StatRow
                      label="Elite Ratio"
                      value={`${(smith.elite_factor * 100).toFixed(1)}%`}
                    />
                  </div>

                  {smith.hawley && (
                    <div className="pt-3 mt-3 border-t border-border">
                      <StatRow label="Hawley" value={smith.hawley} />
                      {smith.toko_taikan && (
                        <StatRow label="Toko Taikan" value={smith.toko_taikan.toLocaleString()} />
                      )}
                    </div>
                  )}
                </div>

                {/* Link to browse items by this smith */}
                <Link
                  href={`/browse?smith=${encodeURIComponent(name)}`}
                  className="mt-5 block w-full text-center py-2 px-4 bg-gold text-ink-inverse rounded text-sm font-medium hover:bg-gold-light transition-colors"
                >
                  View Available Works
                </Link>
              </div>

              {/* Profile Metadata */}
              <div className="mt-4 text-xs text-muted">
                <p>Profile depth: {profile.profile_depth}</p>
                <p>Based on {profile.setsumei_count} setsumei</p>
                <p>Generated: {new Date(profile.generated_at).toLocaleDateString()}</p>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight = false
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className={highlight ? 'text-gold font-medium' : 'text-ink'}>
        {value}
      </span>
    </div>
  );
}
