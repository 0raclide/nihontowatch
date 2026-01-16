'use client';

import Link from 'next/link';
import { Drawer } from '@/components/ui/Drawer';
import { ThemeSelector } from '@/components/ui/ThemeToggle';
import { useMobileUI } from '@/contexts/MobileUIContext';

export function MobileNavDrawer() {
  const { navDrawerOpen, closeNavDrawer } = useMobileUI();

  return (
    <Drawer isOpen={navDrawerOpen} onClose={closeNavDrawer} title="Menu">
      <nav className="p-4 space-y-1">
        <Link
          href="/browse"
          onClick={closeNavDrawer}
          className="flex items-center px-4 py-3 text-[13px] uppercase tracking-[0.15em] text-text-secondary hover:bg-hover rounded-lg transition-colors"
        >
          Browse Collection
        </Link>

        <div className="h-px bg-border/50 my-4" />

        <div className="px-4 py-2">
          <span className="text-[11px] uppercase tracking-[0.15em] text-text-muted mb-2 block">Theme</span>
          <ThemeSelector />
        </div>
      </nav>
    </Drawer>
  );
}
