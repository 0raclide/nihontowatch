import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CollectionPageClient } from './CollectionPageClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My Collection | NihontoWatch',
  description: 'Manage your personal nihonto collection. Catalog swords, fittings, and armor with Yuhinkai data integration.',
};

export default async function CollectionPage() {
  if (process.env.NEXT_PUBLIC_COLLECTION_ENABLED !== 'true') {
    redirect('/browse');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/browse?login=collection');
  }

  return <CollectionPageClient />;
}
