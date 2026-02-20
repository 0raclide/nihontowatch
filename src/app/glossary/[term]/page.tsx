import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { findTerm, getTermsByCategory, CATEGORY_LABELS } from '@/lib/glossary';
import type { GlossaryEntry, GlossaryCategory } from '@/lib/glossary';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { generateBreadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonLd';
import { FEATURED_TERMS } from '@/lib/glossary/featuredTerms';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

export function generateStaticParams() {
  return FEATURED_TERMS.map((term) => ({ term }));
}

function termSlug(romaji: string): string {
  return romaji.toLowerCase().replace(/\s+/g, '-');
}

export async function generateMetadata(
  { params }: { params: Promise<{ term: string }> }
): Promise<Metadata> {
  const { term: slug } = await params;
  const entry = findTerm(slug);
  if (!entry) return {};

  const title = `${entry.term} (${entry.kanji || ''}) — Japanese Sword Term | NihontoWatch`;
  const description = `${entry.term}${entry.kanji ? ` (${entry.kanji})` : ''}: ${entry.definition}`;

  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/glossary/${termSlug(entry.romaji)}` },
    openGraph: {
      title: `${entry.term} — Nihonto Glossary`,
      description,
      type: 'article',
      url: `${baseUrl}/glossary/${termSlug(entry.romaji)}`,
      siteName: 'NihontoWatch',
    },
    twitter: {
      card: 'summary',
      title: `${entry.term} — Nihonto Glossary`,
      description,
    },
  };
}

export default async function GlossaryTermPage(
  { params }: { params: Promise<{ term: string }> }
) {
  const { term: slug } = await params;
  const entry = findTerm(slug);
  if (!entry) notFound();

  // Related terms from the same category
  const related = getTermsByCategory(entry.category)
    .filter((t) => t.romaji !== entry.romaji)
    .slice(0, 12);

  const categoryLabel = CATEGORY_LABELS[entry.category] || entry.category;

  const breadcrumbItems = [
    { name: 'Home', url: `${baseUrl}/` },
    { name: 'Glossary', url: `${baseUrl}/glossary` },
    { name: entry.term },
  ];

  // Build a search query that might find relevant listings
  const searchQuery = entry.romaji;

  return (
    <>
      <script {...jsonLdScriptProps(generateBreadcrumbJsonLd(breadcrumbItems))} />
      <script
        {...jsonLdScriptProps({
          '@context': 'https://schema.org',
          '@type': 'DefinedTerm',
          name: entry.term,
          description: entry.definition,
          inDefinedTermSet: {
            '@type': 'DefinedTermSet',
            name: 'Japanese Sword Terminology Glossary',
            url: `${baseUrl}/glossary`,
          },
        })}
      />

      <div className="min-h-screen bg-linen dark:bg-ink">
        <Header />

        <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-8">
          <Breadcrumbs items={[
            { name: 'Home', url: '/' },
            { name: 'Glossary', url: '/glossary' },
            { name: entry.term },
          ]} />

          {/* Term Header */}
          <div className="mb-8">
            <span className="text-[11px] uppercase tracking-wider text-gold font-medium">
              {categoryLabel}
            </span>
            <h1 className="font-serif text-3xl md:text-4xl text-ink dark:text-cream mt-1 mb-2">
              {entry.term}
            </h1>
            {entry.kanji && (
              <p className="text-2xl text-ink/50 dark:text-cream/50 font-jp">
                {entry.kanji}
              </p>
            )}
          </div>

          {/* Definition */}
          <div className="bg-paper dark:bg-charcoal border border-border dark:border-border-dark rounded-lg p-6 mb-8">
            <h2 className="text-[13px] uppercase tracking-wider text-muted dark:text-muted-dark font-medium mb-3">
              Definition
            </h2>
            <p className="text-[15px] text-ink dark:text-cream leading-relaxed">
              {entry.definition}
            </p>
          </div>

          {/* Browse CTA */}
          <div className="bg-surface/50 dark:bg-charcoal/50 border border-border dark:border-border-dark rounded-lg p-5 mb-8 text-center">
            <p className="text-sm text-muted dark:text-muted-dark mb-3">
              Find items related to <span className="font-medium text-ink dark:text-cream">{entry.term}</span>
            </p>
            <Link
              href={`/?q=${encodeURIComponent(searchQuery)}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
            >
              Search listings
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Link>
          </div>

          {/* Related Terms */}
          {related.length > 0 && (
            <div>
              <h2 className="text-[13px] uppercase tracking-wider text-muted dark:text-muted-dark font-medium mb-4">
                Related {categoryLabel} Terms
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {related.map((t) => {
                  const tSlug = termSlug(t.romaji);
                  const isFeatured = FEATURED_TERMS.includes(tSlug);
                  return (
                    <div
                      key={t.romaji}
                      className="bg-paper dark:bg-charcoal border border-border dark:border-border-dark rounded-lg p-4"
                    >
                      <div className="flex items-baseline gap-2 mb-1">
                        {isFeatured ? (
                          <Link
                            href={`/glossary/${tSlug}`}
                            className="text-[14px] font-medium text-ink dark:text-cream hover:text-gold transition-colors"
                          >
                            {t.term}
                          </Link>
                        ) : (
                          <span className="text-[14px] font-medium text-ink dark:text-cream">
                            {t.term}
                          </span>
                        )}
                        {t.kanji && (
                          <span className="text-[12px] text-ink/40 dark:text-cream/40">{t.kanji}</span>
                        )}
                      </div>
                      <p className="text-[12px] text-muted dark:text-muted-dark line-clamp-2">
                        {t.definition}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        <Footer />
        <BottomTabBar />
      </div>
    </>
  );
}
