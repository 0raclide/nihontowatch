'use client';

import Link from 'next/link';
import { useConsent } from '@/contexts/ConsentContext';

export function Footer() {
  const { openPreferences } = useConsent();

  return (
    <footer className="border-t border-border/50 bg-surface/30 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <div className="text-[12px] text-muted">
            &copy; {new Date().getFullYear()} Nihontowatch. All rights reserved.
          </div>

          {/* Legal Links */}
          <nav className="flex items-center gap-4 lg:gap-6">
            <Link
              href="/terms"
              className="text-[12px] text-muted hover:text-ink transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-[12px] text-muted hover:text-ink transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/cookies"
              className="text-[12px] text-muted hover:text-ink transition-colors"
            >
              Cookies
            </Link>
            <button
              onClick={openPreferences}
              className="text-[12px] text-muted hover:text-ink transition-colors"
            >
              Cookie Preferences
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}
