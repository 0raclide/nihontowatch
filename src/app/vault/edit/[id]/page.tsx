import { CollectionEditClient } from './CollectionEditClient';

export const dynamic = 'force-dynamic';

export default async function CollectionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CollectionEditClient id={id} />;
}
