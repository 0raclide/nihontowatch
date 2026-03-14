import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canAccessFeature, type SubscriptionTier } from '@/types/subscription';
import { ShowcasePageClient } from './ShowcasePageClient';

export const metadata: Metadata = {
  title: 'Yuhinkai — NihontoWatch',
  description: 'Important objects by members of our community. Browse nihonto and tosogu shared by Yuhinkai Society members.',
};

export default async function ShowcasePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/browse');
  }

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

  return <ShowcasePageClient />;
}
