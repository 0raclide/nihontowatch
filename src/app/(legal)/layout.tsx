import type { Metadata } from 'next';
import Link from 'next/link';

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
    <div className="min-h-screen bg-cream dark:bg-ink">
      {/* Header */}
      <header className="border-b border-border/50 bg-cream dark:bg-surface sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="font-serif text-xl text-ink hover:text-accent transition-colors"
          >
            Nihontowatch
          </Link>
          <nav className="flex items-center gap-4">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted hover:text-ink transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 lg:py-12">
        <article className="prose prose-stone dark:prose-invert max-w-none prose-headings:font-serif prose-a:text-accent prose-a:no-underline hover:prose-a:underline">
          {children}
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-surface/50">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center">
          <p className="text-sm text-muted">
            &copy; {new Date().getFullYear()} Nihontowatch. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
