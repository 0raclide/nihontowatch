import { Header } from '@/components/layout/Header';

export default function DealerLayout({
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
