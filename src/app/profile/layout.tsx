import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Profile | Nihontowatch',
  description: 'Manage your Nihontowatch profile and settings.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
