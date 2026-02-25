import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Footer } from '@/components/layout/Footer';
import { EliteRankingContent } from './EliteRankingContent';

export const metadata: Metadata = {
  title: 'Elite Factor Methodology — A Bayesian Approach to Artisan Ranking | NihontoWatch',
  description:
    'How NihontoWatch ranks artisan stature using Bayesian inference on the NBTHK designation record. Beta-binomial model, lower credible bounds, and worked examples.',
  alternates: {
    canonical: 'https://nihontowatch.com/eliteranking',
  },
  openGraph: {
    title: 'Elite Factor Methodology | NihontoWatch',
    description:
      'A Bayesian approach to ranking artisan stature in the NBTHK designation record.',
  },
};

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
            Methodology
          </p>
          <h1 className="font-serif text-3xl lg:text-5xl font-semibold text-ink leading-tight mb-3">
            The Elite Factor
          </h1>
          <p className="font-serif text-lg lg:text-xl text-charcoal italic">
            A Bayesian Approach to Ranking Artisan Stature
          </p>
          <div className="mt-8 mx-auto w-12 border-t border-accent" />
        </div>
      </div>

      {/* Article body */}
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 lg:py-14 w-full">
        <EliteRankingContent />
      </main>

      <Footer />
    </div>
  );
}
