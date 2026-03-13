'use client';

import { useLocale } from '@/i18n/LocaleContext';
import type { Listing } from '@/types';
import type { ShowcaseExtension } from '@/types/displayItem';

interface ShowcaseMobileHeaderActionsProps {
  listing: Listing;
  showcase?: ShowcaseExtension | null;
}

export function ShowcaseMobileHeaderActions({ showcase }: ShowcaseMobileHeaderActionsProps) {
  const { t } = useLocale();
  if (!showcase) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-border/30 text-[10px] text-muted">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
      <span className="truncate max-w-[100px]">{t('showcase.ownerCollection')}</span>
    </div>
  );
}
