'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { IPortfolio } from '@/types';

interface UserSettings {
  feeCalculationMode: 'per-portfolio' | 'combined';
  combinedPortfolios: string[];
}

interface FeeInfo {
  level: string;
  feePercent: number;
  currentVolume: number;
  nextLevel: {
    level: string;
    minVolume: number;
    remaining: number;
  } | null;
}

export default function SettingsPage() {
  const { status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    feeCalculationMode: 'per-portfolio',
    combinedPortfolios: [],
  });
  const [portfolios, setPortfolios] = useState<IPortfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('');
  const [feeInfo, setFeeInfo] = useState<FeeInfo | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status]);

  useEffect(() => {
    if (selectedPortfolio && settings.feeCalculationMode === 'per-portfolio') {
      fetchFeeInfo(selectedPortfolio);
    }
  }, [selectedPortfolio, settings.feeCalculationMode]);

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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch settings
      const settingsResponse = await fetch('/api/settings');
      const settingsData = await settingsResponse.json();
      if (settingsData.success) {
        setSettings(settingsData.data);
      }

      // Fetch portfolios
      const portfoliosResponse = await fetch('/api/portfolios');
      const portfoliosData = await portfoliosResponse.json();
      if (portfoliosData.success) {
        setPortfolios(portfoliosData.data);
        if (portfoliosData.data.length > 0) {
          setSelectedPortfolio(portfoliosData.data[0]._id);
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFeeInfo = async (portfolioId: string) => {
    try {
      const response = await fetch(`/api/portfolios/${portfolioId}/calculate-fee?type=entry`);
      const data = await response.json();
      if (data.success) {
        setFeeInfo(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch fee info:', error);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      toast({
        title: 'Success',
        description: 'Settings saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePortfolioToggle = (portfolioId: string) => {
    setSettings((prev) => {
      const isSelected = prev.combinedPortfolios.includes(portfolioId);
      return {
        ...prev,
        combinedPortfolios: isSelected
          ? prev.combinedPortfolios.filter((id) => id !== portfolioId)
          : [...prev.combinedPortfolios, portfolioId],
      };
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-muted-foreground">
            Loading settings...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground mt-1">Manage your trading fees and preferences</p>
            </div>
          </div>

          {/* Current Fee Level Display */}
          {selectedPortfolio && feeInfo && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  <CardTitle>Current Fee Level</CardTitle>
                </div>
                <CardDescription>
                  Based on 30-day trading volume for{' '}
                  {portfolios.find((p) => p._id === selectedPortfolio)?.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">30-Day Volume</div>
                    <div className="text-2xl font-bold">
                      ${feeInfo.currentVolume.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Current Fee Level</div>
                    <div className="text-2xl font-bold">{feeInfo.level}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Maker Fee: {feeInfo.feePercent.toFixed(3)}%
                    </div>
                  </div>
                </div>

                {feeInfo.nextLevel && (
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="text-sm font-medium mb-2">Next Level: {feeInfo.nextLevel.level}</div>
                    <div className="text-sm text-muted-foreground">
                      ${feeInfo.nextLevel.remaining.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      more to unlock
                    </div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (feeInfo.currentVolume / feeInfo.nextLevel.minVolume) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Portfolio Selection for Fee Display */}
          {portfolios.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>View Portfolio Fees</CardTitle>
                <CardDescription>
                  Select a portfolio to view its current fee level and volume
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {portfolios.map((portfolio) => (
                    <label
                      key={portfolio._id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPortfolio === portfolio._id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="selectedPortfolio"
                        value={portfolio._id}
                        checked={selectedPortfolio === portfolio._id}
                        onChange={(e) => setSelectedPortfolio(e.target.value)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{portfolio.name}</div>
                        <div className="text-sm text-muted-foreground">
                          ${portfolio.totalDeposit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fee Calculation Mode */}
          <Card>
            <CardHeader>
              <CardTitle>Fee Calculation Mode</CardTitle>
              <CardDescription>
                Choose how trading volume is calculated for fee levels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <input
                    type="radio"
                    name="feeMode"
                    value="per-portfolio"
                    checked={settings.feeCalculationMode === 'per-portfolio'}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        feeCalculationMode: e.target.value as 'per-portfolio' | 'combined',
                      }))
                    }
                    className="w-4 h-4 mt-1"
                  />
                  <div>
                    <div className="font-medium">Per Portfolio (Default)</div>
                    <div className="text-sm text-muted-foreground">
                      Each portfolio calculates fees based on its own 30-day volume
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <input
                    type="radio"
                    name="feeMode"
                    value="combined"
                    checked={settings.feeCalculationMode === 'combined'}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        feeCalculationMode: e.target.value as 'per-portfolio' | 'combined',
                      }))
                    }
                    className="w-4 h-4 mt-1"
                  />
                  <div>
                    <div className="font-medium">Combined Portfolios</div>
                    <div className="text-sm text-muted-foreground">
                      Combine volume from selected portfolios to calculate fees
                    </div>
                  </div>
                </label>
              </div>

              {settings.feeCalculationMode === 'combined' && portfolios.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-muted/50">
                  <Label className="text-base mb-3 block">Select Portfolios to Combine</Label>
                  <div className="space-y-2">
                    {portfolios.map((portfolio) => (
                      <label
                        key={portfolio._id}
                        className="flex items-center gap-3 p-2 cursor-pointer hover:bg-background/50 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={settings.combinedPortfolios.includes(portfolio._id)}
                          onChange={() => handlePortfolioToggle(portfolio._id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{portfolio.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveSettings} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
