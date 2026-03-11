import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import fs from 'fs';
import path from 'path';
import { Footer } from '@/components/layout/Footer';
import { MarketModelContent } from './MarketModelContent';
import { MarketModelFigures } from './MarketModelFigures';

const methodologyContent = fs.readFileSync(
  path.join(process.cwd(), 'src/app/market-model/methodology.md'),
  'utf-8'
);

export const metadata: Metadata = {
  title: 'Market Price Model — Diagnostics | NihontoWatch',
  description:
    'Diagnostic plots and analysis for the NihontoWatch market price model. Certification ladders, artisan premiums, quantile price bands, and model accuracy across 9,178 observations.',
  alternates: {
    canonical: 'https://nihontowatch.com/market-model',
  },
  openGraph: {
    title: 'Market Price Model — Diagnostics | NihontoWatch',
    description:
      'Price estimation model diagnostics: certification ladders, artisan rating effects, quantile regression bands, and cross-validated accuracy.',
  },
};

const TOC = [
  { href: '#the-core-insight-ladder-theory', label: 'Ladder Theory' },
  { href: '#how-the-model-works', label: 'Model' },
  { href: '#data-sources', label: 'Data' },
  { href: '#model-accuracy', label: 'Accuracy' },
  { href: '#dealer-origin-effect', label: 'Dealer Effect' },
  { href: '#nagasa-blade-length-effect', label: 'Nagasa Effect' },
  { href: '#heteroscedasticity-why-confidence-intervals-must-widen', label: 'Variance' },
  { href: '#key-limitations', label: 'Limitations' },
  { href: '#figures', label: 'Figures' },
];

export default function MarketModelPage() {
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
            href="/browse"
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            Browse Listings →
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
            Market Price Model
          </h1>
          <p className="font-serif text-lg lg:text-xl text-charcoal italic max-w-xl mx-auto">
            Diagnostic Plots &amp; Analysis — 9,178 Observations
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
        <MarketModelContent content={methodologyContent} />

        {/* Interactive figures */}
        <section id="figures" className="prose-methodology mt-16 pt-8 border-t border-border-subtle">
          <h2>Figures</h2>
          <MarketModelFigures />
        </section>
      </main>

      <Footer />
    </div>
  );
}
