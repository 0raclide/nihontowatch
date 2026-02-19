'use client';

import Link from 'next/link';
import { useConsent } from '@/contexts/ConsentContext';

const linkClass = 'text-[12px] text-muted hover:text-gold transition-colors';
const headingClass = 'text-[11px] uppercase tracking-wider text-ink font-medium mb-3';

export function Footer() {
  const { openPreferences } = useConsent();

  return (
    <footer className="border-t border-border bg-surface/30 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-10 lg:px-6">
        {/* Link Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          {/* Swords */}
          <div>
            <h3 className={headingClass}>Swords</h3>
            <ul className="space-y-2">
              <li><Link href="/swords/katana" className={linkClass}>Katana</Link></li>
              <li><Link href="/swords/wakizashi" className={linkClass}>Wakizashi</Link></li>
              <li><Link href="/swords/tanto" className={linkClass}>Tanto</Link></li>
              <li><Link href="/swords/tachi" className={linkClass}>Tachi</Link></li>
              <li><Link href="/swords/naginata" className={linkClass}>Naginata</Link></li>
              <li><Link href="/swords/yari" className={linkClass}>Yari</Link></li>
            </ul>
          </div>

          {/* Fittings */}
          <div>
            <h3 className={headingClass}>Fittings</h3>
            <ul className="space-y-2">
              <li><Link href="/fittings/tsuba" className={linkClass}>Tsuba</Link></li>
              <li><Link href="/fittings/fuchi-kashira" className={linkClass}>Fuchi-Kashira</Link></li>
              <li><Link href="/fittings/kozuka" className={linkClass}>Kozuka</Link></li>
              <li><Link href="/fittings/menuki" className={linkClass}>Menuki</Link></li>
            </ul>
          </div>

          {/* Certification */}
          <div>
            <h3 className={headingClass}>By Certification</h3>
            <ul className="space-y-2">
              <li><Link href="/certified/tokubetsu-juyo" className={linkClass}>Tokubetsu Juyo</Link></li>
              <li><Link href="/certified/juyo" className={linkClass}>Juyo</Link></li>
              <li><Link href="/certified/tokubetsu-hozon" className={linkClass}>Tokubetsu Hozon</Link></li>
              <li><Link href="/certified/hozon" className={linkClass}>Hozon</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className={headingClass}>Resources</h3>
            <ul className="space-y-2">
              <li><Link href="/dealers" className={linkClass}>Dealer Directory</Link></li>
              <li><Link href="/artists" className={linkClass}>Artist Directory</Link></li>
              <li><Link href="/glossary" className={linkClass}>Glossary</Link></li>
              <li><Link href="/" className={linkClass}>Browse All</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border/50 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg text-ink">
              Nihonto<span className="text-gold">watch</span>
            </span>
            <span className="text-[11px] text-muted">
              &copy; {new Date().getFullYear()}
            </span>
          </div>

          <nav className="flex items-center gap-4 lg:gap-6">
            <Link href="/terms" className={linkClass}>Terms</Link>
            <Link href="/privacy" className={linkClass}>Privacy</Link>
            <Link href="/cookies" className={linkClass}>Cookies</Link>
            <button onClick={openPreferences} className={linkClass}>
              Cookie Preferences
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}
