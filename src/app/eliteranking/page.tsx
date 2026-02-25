import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import fs from 'fs';
import path from 'path';
import { Footer } from '@/components/layout/Footer';
import { EliteRankingContent } from './EliteRankingContent';
import { MethodologyFigures } from './MethodologyFigures';

const methodologyContent = fs.readFileSync(
  path.join(process.cwd(), 'src/app/eliteranking/methodology.md'),
  'utf-8'
);

export const metadata: Metadata = {
  title: 'Artist Ranking Methodology (Working Paper) | NihontoWatch',
  description:
    'Working paper: how Yuhinkai ranks artisan stature using two Bayesian metrics — the elite factor (NBTHK designation quality) and the provenance factor (historical collector prestige). Beta-binomial model, shrinkage estimator, lower credible bounds, and full rankings.',
  alternates: {
    canonical: 'https://nihontowatch.com/eliteranking',
  },
  openGraph: {
    title: 'Artist Ranking Methodology (Working Paper) | NihontoWatch',
    description:
      'Working paper: two Bayesian metrics for measuring artisan stature in the NBTHK designation record and historical provenance.',
  },
};

const TOC = [
  { href: '#the-dataset', label: 'The Dataset' },
  { href: '#part-i-the-elite-factor', label: 'I. Elite Factor' },
  { href: '#part-ii-the-provenance-factor', label: 'II. Provenance' },
  { href: '#part-iii-current-rankings', label: 'III. Rankings' },
  { href: '#part-iv-how-the-two-metrics-relate', label: 'IV. Relationship' },
  { href: '#part-v-statistical-notes', label: 'V. Statistics' },
  { href: '#figures', label: 'Figures' },
  { href: '#appendix-implementation-reference', label: 'Appendix' },
];

export default function EliteRankingPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Minimal header */}
      <header className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo-mon.png"
              alt="NihontoWatch"
              width={28}
              height={28}
              className="opacity-80"
            />
            <span className="font-serif text-xl text-ink">NihontoWatch</span>
          </Link>
          <Link
            href="/artists"
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            Artist Directory →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-cream border-b border-border-subtle">
        <div className="max-w-3xl mx-auto px-4 py-12 lg:py-20 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted mb-4">
            Working Paper
          </p>
          <h1 className="font-serif text-3xl lg:text-5xl font-semibold text-ink leading-tight mb-3">
            Artist Ranking Methodology
          </h1>
          <p className="font-serif text-lg lg:text-xl text-charcoal italic max-w-xl mx-auto">
            Two Bayesian Metrics for Measuring Artisan Stature
          </p>
          <div className="mt-8 mx-auto w-12 border-t border-accent" />
        </div>
      </div>

      {/* Table of contents */}
      <nav className="border-b border-border-subtle bg-surface/50">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px]">
            {TOC.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-muted hover:text-accent transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* Article body */}
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 lg:py-14 w-full">
        <EliteRankingContent content={methodologyContent} />

        {/* Interactive figures */}
        <section id="figures" className="prose-methodology mt-16 pt-8 border-t border-border-subtle">
          <h2>Figures</h2>
          <MethodologyFigures />
        </section>
      </main>

      <Footer />
    </div>
  );
}
