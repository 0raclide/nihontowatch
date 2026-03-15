import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { PublicShowcaseClient } from './PublicShowcaseClient';

const SYSTEM_STATE_KEY = 'showcase_share_token';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

interface Props {
  params: Promise<{ token: string }>;
}

async function validateToken(token: string): Promise<boolean> {
  const serviceClient = createServiceClient();
  const { data } = await serviceClient
    .from('system_state')
    .select('value')
    .eq('key', SYSTEM_STATE_KEY)
    .single() as { data: { value: string } | null };

  return !!data && data.value === token;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const isValid = await validateToken(token);

  if (!isValid) {
    return {
      title: 'Link Expired — NihontoWatch',
      description: 'This showcase share link has expired or been revoked.',
      robots: { index: false, follow: false },
    };
  }

  return {
    title: 'Yuhinkai — NihontoWatch',
    description: 'Important objects by members of our community. Browse nihonto and tosogu shared by Yuhinkai Society members.',
    robots: { index: false, follow: false },
    openGraph: {
      title: 'Yuhinkai — NihontoWatch',
      description: 'A curated exhibition of distinguished works from private collections.',
      url: `${BASE_URL}/showcase/public/${token}`,
      siteName: 'NihontoWatch',
      type: 'website',
      images: [
        {
          url: `${BASE_URL}/api/og?page=showcase`,
          width: 1200,
          height: 630,
          alt: 'Yuhinkai — A curated exhibition of distinguished works from private collections',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Yuhinkai — NihontoWatch',
      description: 'A curated exhibition of distinguished works from private collections.',
      images: [`${BASE_URL}/api/og?page=showcase`],
    },
  };
}

export default async function PublicShowcasePage({ params }: Props) {
  const { token } = await params;
  const isValid = await validateToken(token);

  if (!isValid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-muted/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
            </svg>
          </div>
          <h1 className="text-xl font-serif text-ink mb-3">Link Expired</h1>
          <p className="text-sm text-muted mb-8">
            This showcase share link has expired or been revoked by the administrator.
          </p>
          <a
            href="/browse"
            className="inline-flex items-center px-6 py-2.5 text-sm font-medium text-white bg-charcoal hover:bg-charcoal/90 rounded transition-colors"
          >
            Browse NihontoWatch
          </a>
        </div>
      </div>
    );
  }

  return <PublicShowcaseClient token={token} />;
}
