import Link from 'next/link';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {BlurredAmount} from '@/components/ui/BlurredAmount';
import {BarChart3} from 'lucide-react';

interface QuickStatsCardProps {
    quickStats: {
        totalClosedTrades: number;
        totalProfitUSD: number;
        winRate: number;
    } | null;
    portfolioId: string;
}

export function QuickStatsCard({quickStats, portfolioId}: QuickStatsCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5"/>
                    Quick Stats
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {quickStats ? (
                    <>
                        <div>
                            <div className="text-sm text-muted-foreground mb-2">
                                Total Closed Trades
                            </div>
                            <div className="text-2xl font-bold">{quickStats.totalClosedTrades}</div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground mb-2">
                                Overall P/L
                            </div>
                            <div
                                className={`text-2xl font-bold ${quickStats.totalProfitUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                <BlurredAmount
                                    amount={quickStats.totalProfitUSD}
                                    showSign={true}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-muted-foreground mb-2">
                                Win Rate
                            </div>
                            <div className="text-2xl font-bold">{quickStats.winRate.toFixed(2)}%</div>
                        </div>
                    </>
                ) : (
                    <div className="text-sm text-muted-foreground">Loading stats...</div>
                )}
                <Link href={`/dashboard/portfolio/${portfolioId}/stats`}>
                    <Button className="w-full mt-2" variant="outline">
                        <BarChart3 className="h-4 w-4 mr-2"/>
                        View Detailed Statistics
                    </Button>
                </Link>
            </CardContent>
        </Card>
    );
}
