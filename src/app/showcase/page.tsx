import type { Metadata } from 'next';
import { ShowcasePageClient } from './ShowcasePageClient';

export const metadata: Metadata = {
  title: 'Community Showcase — NihontoWatch',
  description: 'Browse nihonto and tosogu shared by collectors worldwide.',
};

export default function ShowcasePage() {
  return <ShowcasePageClient />;
}
