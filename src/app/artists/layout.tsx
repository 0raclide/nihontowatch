import { Header } from '@/components/layout/Header';

export default function ArtistsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      {children}
    </div>
  );
}
