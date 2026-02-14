import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Saved Searches & Watchlist | NihontoWatch',
  description: 'Manage your saved searches and watchlist on NihontoWatch.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function SavedLayout({ children }: { children: ReactNode }) {
  return children;
}
