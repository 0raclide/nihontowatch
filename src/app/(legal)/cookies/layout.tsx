import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy | NihontoWatch',
  description: 'Cookie Policy for NihontoWatch - what cookies we use, how to manage them, and your consent choices.',
  alternates: {
    canonical: '/cookies',
  },
  openGraph: {
    title: 'Cookie Policy | NihontoWatch',
    description: 'Cookie Policy for NihontoWatch - what cookies we use, how to manage them, and your consent choices.',
  },
};

export default function CookiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
