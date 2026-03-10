import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ShowcasePageClient } from './ShowcasePageClient';

export const metadata: Metadata = {
  title: 'Community Showcase — NihontoWatch',
  description: 'Browse nihonto and tosogu shared by collectors worldwide.',
};

export default async function ShowcasePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/browse');
  }

  return <ShowcasePageClient />;
}
