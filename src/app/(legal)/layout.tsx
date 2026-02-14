import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
};

const legalLinks = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/cookies', label: 'Cookie Policy' },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
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

      {/* Sub-navigation for legal pages */}
      <div className="bg-cream border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-6 overflow-x-auto">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted hover:text-ink transition-colors whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 lg:py-12 w-full">
        <article className="legal-content">
          {children}
        </article>
      </main>

      <Footer />
    </div>
  );
}
