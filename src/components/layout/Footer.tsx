'use client';

import Link from 'next/link';
import { useConsent } from '@/contexts/ConsentContext';
import { useLocale } from '@/i18n/LocaleContext';

const linkClass = 'text-[12px] text-muted hover:text-gold transition-colors';
const headingClass = 'text-[11px] uppercase tracking-wider text-ink font-medium mb-3';

export function Footer() {
  const { openPreferences } = useConsent();
  const { t, locale } = useLocale();

  return (
    <footer className="border-t border-border bg-surface/30 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-10 lg:px-6">
        {/* Link Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          {/* Swords */}
          <div>
            <h3 className={headingClass}>{t('footer.swords')}</h3>
            <ul className="space-y-2">
              <li><Link href="/swords/katana" className={linkClass}>{t('itemType.katana')}</Link></li>
              <li><Link href="/swords/wakizashi" className={linkClass}>{t('itemType.wakizashi')}</Link></li>
              <li><Link href="/swords/tanto" className={linkClass}>{t('itemType.tanto')}</Link></li>
              <li><Link href="/swords/tachi" className={linkClass}>{t('itemType.tachi')}</Link></li>
              <li><Link href="/swords/naginata" className={linkClass}>{t('itemType.naginata')}</Link></li>
              <li><Link href="/swords/yari" className={linkClass}>{t('itemType.yari')}</Link></li>
            </ul>
          </div>

          {/* Fittings */}
          <div>
            <h3 className={headingClass}>{t('footer.fittings')}</h3>
            <ul className="space-y-2">
              <li><Link href="/fittings/tsuba" className={linkClass}>{t('itemType.tsuba')}</Link></li>
              <li><Link href="/fittings/fuchi-kashira" className={linkClass}>{t('itemType.fuchi-kashira')}</Link></li>
              <li><Link href="/fittings/kozuka" className={linkClass}>{t('itemType.kozuka')}</Link></li>
              <li><Link href="/fittings/menuki" className={linkClass}>{t('itemType.menuki')}</Link></li>
            </ul>
          </div>

          {/* Certification */}
          <div>
            <h3 className={headingClass}>{t('footer.byCertification')}</h3>
            <ul className="space-y-2">
              <li><Link href="/certified/tokubetsu-juyo" className={linkClass}>{t('cert.Tokubetsu Juyo')}</Link></li>
              <li><Link href="/certified/juyo" className={linkClass}>{t('cert.Juyo')}</Link></li>
              <li><Link href="/certified/tokubetsu-hozon" className={linkClass}>{t('cert.Tokubetsu Hozon')}</Link></li>
              <li><Link href="/certified/hozon" className={linkClass}>{t('cert.Hozon')}</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className={headingClass}>{t('footer.resources')}</h3>
            <ul className="space-y-2">
              <li><Link href="/dealers" className={linkClass}>{t('footer.dealerDirectory')}</Link></li>
              <li><Link href="/artists" className={linkClass}>{t('footer.artistDirectory')}</Link></li>
              {locale !== 'ja' && (
                <li><Link href="/glossary" className={linkClass}>{t('footer.glossary')}</Link></li>
              )}
              <li><Link href="/" className={linkClass}>{t('footer.browseAll')}</Link></li>
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
            <Link href="/terms" className={linkClass}>{t('legal.terms')}</Link>
            <Link href="/privacy" className={linkClass}>{t('legal.privacy')}</Link>
            <Link href="/cookies" className={linkClass}>{t('legal.cookies')}</Link>
            <button onClick={openPreferences} className={linkClass}>
              {t('legal.cookiePreferences')}
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}
