import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CollectionPageClient } from './CollectionPageClient';
import { canAccessFeature, type SubscriptionTier } from '@/types/subscription';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My Collection | NihontoWatch',
  description: 'Manage your personal nihonto collection. Catalog swords, fittings, and armor with Yuhinkai data integration.',
};

export default async function CollectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/browse?login=collection');
  }

  // Check subscription tier for collection access
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_status, role')
    .eq('id', user.id)
    .single() as { data: { subscription_tier: string; subscription_status: string; role: string } | null };

  const isAdmin = profile?.role === 'admin';
  const tier = (profile?.subscription_tier ?? 'free') as SubscriptionTier;
  const isActive = profile?.subscription_status === 'active';
  const effectiveTier = isActive ? tier : 'free';

  if (!isAdmin && !canAccessFeature(effectiveTier, 'collection_access')) {
    redirect('/browse');
  }

  return <CollectionPageClient />;
}
