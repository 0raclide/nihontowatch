'use client';

import Link from 'next/link';
import { Drawer } from '@/components/ui/Drawer';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useMobileUI } from '@/contexts/MobileUIContext';

export function MobileNavDrawer() {
  const { navDrawerOpen, closeNavDrawer } = useMobileUI();

  return (
    <Drawer isOpen={navDrawerOpen} onClose={closeNavDrawer} title="Menu">
      <nav className="p-4 space-y-1">
        <Link
          href="/browse"
          onClick={closeNavDrawer}
          className="flex items-center px-4 py-3 text-[13px] uppercase tracking-[0.15em] text-charcoal dark:text-gray-300 hover:bg-linen dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          Browse Collection
        </Link>

        <div className="h-px bg-border/50 dark:bg-gray-800 my-4" />

        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[13px] text-muted dark:text-gray-500">Theme</span>
          <ThemeToggle />
        </div>
      </nav>
    </Drawer>
  );
}
