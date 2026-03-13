import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ShowcasePageClient } from './ShowcasePageClient';

export const metadata: Metadata = {
  title: 'Yuhinkai Gallery — NihontoWatch',
  description: 'Important objects by members of our community. Browse nihonto and tosogu shared by Yuhinkai Society members.',
};

export default async function ShowcasePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/browse');
  }

  return <ShowcasePageClient />;
}
