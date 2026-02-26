'use client';

import dynamic from 'next/dynamic';
import type { Listing } from '@/types';
import { useQuickViewOptional } from '@/contexts/QuickViewContext';
import { AdminSetsumeiWidget } from '../AdminSetsumeiWidget';

const AdminScoreInspector = dynamic(
  () => import('../AdminScoreInspector').then(m => ({ default: m.AdminScoreInspector })),
  { ssr: false }
);

interface BrowseAdminToolsProps {
  listing: Listing;
}

export function BrowseAdminTools({ listing }: BrowseAdminToolsProps) {
  const quickView = useQuickViewOptional();

  return (
    <div className="px-4 py-3 lg:px-5">
      <AdminScoreInspector
        listing={listing}
        onScoreRecomputed={(newScore) => quickView?.refreshCurrentListing({ featured_score: newScore } as Partial<Listing>)}
      />
      <AdminSetsumeiWidget
        listing={listing}
        onConnectionChanged={(enrichment) => quickView?.refreshCurrentListing(
          enrichment !== undefined ? { yuhinkai_enrichment: enrichment } as unknown as Partial<Listing> : undefined
        )}
      />
    </div>
  );
}
