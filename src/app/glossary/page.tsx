import { Metadata } from 'next';
import { GlossaryPageClient } from './GlossaryPageClient';
import { getMetadata, getTermCount } from '@/lib/glossary';
import { Header } from '@/components/layout/Header';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Footer } from '@/components/layout/Footer';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';

export const metadata: Metadata = {
  title: 'Japanese Sword & Fittings Glossary | NihontoWatch',
  description: `Comprehensive glossary of ${getTermCount().toLocaleString()}+ Japanese sword (nihonto) and fittings (tosogu) terms. Learn about hamon, kitae, sugata, tsuba, and other technical terminology used in appraisals and documentation.`,
  keywords: [
    'Japanese sword glossary',
    'nihonto terminology',
    'tosogu glossary',
    'sword fittings terms',
    'hamon',
    'kitae',
    'sugata',
    'tsuba',
    'NBTHK',
    'sword appraisal terms',
  ],
  openGraph: {
    title: 'Japanese Sword & Fittings Glossary | NihontoWatch',
    description: `Explore ${getTermCount().toLocaleString()}+ technical terms used in Japanese sword and fittings documentation and appraisals.`,
    type: 'website',
    url: 'https://nihontowatch.com/glossary',
  },
};

export default function GlossaryPage() {
  const meta = getMetadata();

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      {/* Page Header */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-[1200px] mx-auto px-4 py-8 lg:px-6 lg:py-12">
          <Breadcrumbs items={[{ name: 'Home', url: '/' }, { name: 'Glossary' }]} className="mb-4" />
          <h1 className="font-serif text-3xl lg:text-4xl text-ink mb-2">
            Japanese Sword & Fittings Glossary
          </h1>
          <p className="text-muted text-sm lg:text-base max-w-2xl">
            {meta.total_terms.toLocaleString()} technical terms used in Japanese sword
            (nihonto) and fittings (tosogu) documentation, appraisals, and collecting.
            Click any term to see its definition and Japanese characters.
          </p>
          <p className="text-muted/60 text-xs mt-2">
            Version {meta.version} &middot; Updated {meta.updated}
          </p>
        </div>
      </div>

      {/* Client-side interactive content */}
      <GlossaryPageClient />

      <Footer />
      <BottomTabBar />
    </div>
  );
}
