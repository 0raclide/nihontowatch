import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

async function getStats() {
  const supabase = await createClient();

  const [availableRes, soldRes, dealersRes] = await Promise.all([
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .or('status.eq.available,is_available.eq.true'),
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .or('status.eq.sold,status.eq.presumed_sold,is_sold.eq.true'),
    supabase
      .from('dealers')
      .select('id', { count: 'exact', head: true }),
  ]);

  return {
    available: availableRes.count || 0,
    sold: soldRes.count || 0,
    dealers: dealersRes.count || 0,
  };
}

export default async function Home() {
  const stats = await getStats();

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900 transition-colors">
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl">
          {/* Logo */}
          <h1 className="font-serif text-6xl md:text-7xl tracking-tight text-ink dark:text-white mb-4">
            Nihonto<span className="text-gold">watch</span>
          </h1>

          {/* Tagline */}
          <p className="text-lg md:text-xl text-charcoal dark:text-gray-300 mb-2 font-light tracking-wide">
            The Premier Aggregator for Japanese Swords &amp; Fittings
          </p>

          {/* Subtitle */}
          <p className="text-muted dark:text-gray-400 mb-12 max-w-xl mx-auto">
            Discover katana, wakizashi, tsuba, and more from trusted dealers worldwide.
            Curated, searchable, and always up to date.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/browse"
              className="btn-elegant text-sm px-8 py-4"
            >
              Browse Collection
            </Link>
            <Link
              href="/browse?tab=sold"
              className="btn-outline text-sm px-8 py-4"
            >
              View Sold Archive
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 pt-8 border-t border-border/50 dark:border-gray-700/50">
            <div className="flex items-center justify-center gap-12 md:gap-16">
              <div className="text-center">
                <p className="font-serif text-3xl md:text-4xl text-ink dark:text-white">
                  {stats.available.toLocaleString()}
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted dark:text-gray-500 mt-1">
                  Available
                </p>
              </div>
              <div className="w-px h-12 bg-border dark:bg-gray-700" />
              <div className="text-center">
                <p className="font-serif text-3xl md:text-4xl text-ink dark:text-white">
                  {stats.sold.toLocaleString()}
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted dark:text-gray-500 mt-1">
                  Sold Archive
                </p>
              </div>
              <div className="w-px h-12 bg-border dark:bg-gray-700" />
              <div className="text-center">
                <p className="font-serif text-3xl md:text-4xl text-ink dark:text-white">
                  {stats.dealers}
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted dark:text-gray-500 mt-1">
                  Dealers
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white dark:bg-gray-800 border-y border-border dark:border-gray-700 py-20 transition-colors">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl text-ink dark:text-white mb-3">
              Why Nihontowatch?
            </h2>
            <p className="text-muted dark:text-gray-400 max-w-lg mx-auto">
              We aggregate listings from the world&apos;s most respected nihonto dealers,
              making it easy to find your next acquisition.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center border border-border dark:border-gray-600 rounded-sm">
                <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="font-serif text-lg text-ink dark:text-white mb-2">Advanced Search</h3>
              <p className="text-sm text-muted dark:text-gray-400">
                Filter by smith, school, certification, price, and more.
                Find exactly what you&apos;re looking for.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center border border-border dark:border-gray-600 rounded-sm">
                <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="font-serif text-lg text-ink dark:text-white mb-2">Price Alerts</h3>
              <p className="text-sm text-muted dark:text-gray-400">
                Set alerts for specific criteria and budget.
                Get notified when matching items appear.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center border border-border dark:border-gray-600 rounded-sm">
                <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-serif text-lg text-ink dark:text-white mb-2">Sold Archive</h3>
              <p className="text-sm text-muted dark:text-gray-400">
                Research historical prices and track market trends
                with our comprehensive sold listings archive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dealers Section */}
      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl text-ink dark:text-white mb-3">
              Trusted Dealers
            </h2>
            <p className="text-muted dark:text-gray-400 max-w-lg mx-auto">
              We partner with established dealers known for authenticity and expertise.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-charcoal dark:text-gray-300">
            <span className="px-4 py-2 border border-border dark:border-gray-700 bg-white dark:bg-gray-800">Aoi Art</span>
            <span className="px-4 py-2 border border-border dark:border-gray-700 bg-white dark:bg-gray-800">Tozando</span>
            <span className="px-4 py-2 border border-border dark:border-gray-700 bg-white dark:bg-gray-800">Nihonto Antiques</span>
            <span className="px-4 py-2 border border-border dark:border-gray-700 bg-white dark:bg-gray-800">Japanese Sword Index</span>
            <span className="px-4 py-2 border border-border dark:border-gray-700 bg-white dark:bg-gray-800">Shibui Swords</span>
            <span className="px-4 py-2 border border-border dark:border-gray-700 bg-white dark:bg-gray-800">And More...</span>
          </div>

          <div className="text-center mt-8">
            <Link
              href="/dealers"
              className="text-xs uppercase tracking-[0.15em] text-gold hover:text-gold-light transition-colors"
            >
              View All Dealers →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-ink text-white py-16">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <h2 className="font-serif text-3xl mb-4">
            Start Your Search
          </h2>
          <p className="text-white/70 mb-8">
            Browse our collection of Japanese swords and fittings from dealers worldwide.
          </p>
          <Link
            href="/browse"
            className="inline-flex items-center justify-center px-8 py-4 text-sm uppercase tracking-[0.15em] bg-gold text-ink hover:bg-gold-light transition-colors"
          >
            Browse Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-border dark:border-gray-700 py-12 transition-colors">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="font-serif text-xl text-ink dark:text-white">
                Nihonto<span className="text-gold">watch</span>
              </h2>
              <p className="text-xs text-muted dark:text-gray-500 mt-1">
                Japanese Swords &amp; Fittings from Dealers Worldwide
              </p>
            </div>

            <nav className="flex items-center gap-8">
              <Link href="/browse" className="text-xs uppercase tracking-[0.1em] text-charcoal dark:text-gray-300 hover:text-gold transition-colors">
                Browse
              </Link>
              <Link href="/dealers" className="text-xs uppercase tracking-[0.1em] text-charcoal dark:text-gray-300 hover:text-gold transition-colors">
                Dealers
              </Link>
              <Link href="/about" className="text-xs uppercase tracking-[0.1em] text-charcoal dark:text-gray-300 hover:text-gold transition-colors">
                About
              </Link>
              <Link href="/alerts" className="text-xs uppercase tracking-[0.1em] text-charcoal dark:text-gray-300 hover:text-gold transition-colors">
                Alerts
              </Link>
            </nav>

            <p className="text-xs text-muted dark:text-gray-500">
              © {new Date().getFullYear()} Nihontowatch
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
