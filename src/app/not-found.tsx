import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-4 py-3 lg:px-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <Link href="/" className="font-serif text-lg text-ink">
            Nihonto<span className="text-gold font-medium">Watch</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-[13px] text-muted">
            <Link href="/dealers" className="hover:text-ink transition-colors">Dealers</Link>
            <Link href="/artists" className="hover:text-ink transition-colors">Artists</Link>
            <Link href="/glossary" className="hover:text-ink transition-colors">Glossary</Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-6xl font-serif text-gold/40 mb-4">404</p>
          <h1 className="font-serif text-2xl text-ink mb-2">Page Not Found</h1>
          <p className="text-[14px] text-muted mb-8">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="px-5 py-2.5 bg-gold text-white text-[13px] font-medium rounded-lg hover:bg-gold/90 transition-colors"
            >
              Browse Collection
            </Link>
            <Link
              href="/dealers"
              className="px-5 py-2.5 border border-border text-[13px] text-ink font-medium rounded-lg hover:border-gold/30 transition-colors"
            >
              View Dealers
            </Link>
          </div>

          {/* Internal links for crawlers */}
          <div className="mt-12 pt-8 border-t border-border/30">
            <p className="text-[11px] text-muted/60 uppercase tracking-wider mb-4">Explore</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px]">
              <Link href="/swords/katana" className="text-muted hover:text-ink transition-colors">Katana</Link>
              <Link href="/swords/wakizashi" className="text-muted hover:text-ink transition-colors">Wakizashi</Link>
              <Link href="/swords/tanto" className="text-muted hover:text-ink transition-colors">Tanto</Link>
              <Link href="/fittings/tsuba" className="text-muted hover:text-ink transition-colors">Tsuba</Link>
              <Link href="/certified/juyo" className="text-muted hover:text-ink transition-colors">Juyo</Link>
              <Link href="/artists" className="text-muted hover:text-ink transition-colors">Artists</Link>
              <Link href="/glossary" className="text-muted hover:text-ink transition-colors">Glossary</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
