'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PortfolioList } from '@/components/features/portfolios/PortfolioList';
import { Toaster } from '@/components/ui/toaster';

export default function DashboardPage() {
  const { data: session, status } = useSession();

  useEffect(() => {
    // Seed cryptocurrencies on first render
    const seedDatabase = async () => {
      try {
        await fetch('/api/seed', {
          method: 'POST',
        });
      } catch (error) {
        console.error('Failed to seed database:', error);
      }
    };

    if (status === 'authenticated') {
      seedDatabase();
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    redirect('/auth/signin');
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold">Tradr</h1>
            <nav className="hidden md:flex gap-4">
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Portfolios
              </Link>
              <Link href="/dashboard/cryptocurrencies" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cryptocurrencies
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session?.user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <PortfolioList />
      </main>

      <Toaster />
    </div>
  );
}
