import { DealerEditListingClient } from './DealerEditListingClient';

export const dynamic = 'force-dynamic';

export default async function DealerEditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DealerEditListingClient id={id} />;
}
