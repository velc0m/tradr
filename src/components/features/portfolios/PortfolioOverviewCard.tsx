import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {BlurredAmount} from '@/components/ui/BlurredAmount';
import {IPortfolio} from '@/types';

interface PortfolioOverviewCardProps {
    portfolio: IPortfolio;
    formatAmount: (amount: number) => string;
}

export function PortfolioOverviewCard({portfolio, formatAmount}: PortfolioOverviewCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Portfolio Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <div className="text-sm text-muted-foreground">
                        Cash Deposit (USD)
                    </div>
                    <div className="text-3xl font-bold">
                        <BlurredAmount amount={portfolio.totalDeposit}/>
                    </div>
                </div>
                {portfolio.initialCoins && portfolio.initialCoins.length > 0 && (
                    <div className="pt-2 border-t">
                        <div className="text-sm text-muted-foreground mb-2">
                            Initial Coins
                        </div>
                        <div className="space-y-1">
                            {portfolio.initialCoins.map((coin, idx) => (
                                <div key={idx} className="text-sm font-medium text-blue-400">
                                    {formatAmount(coin.amount)} {coin.symbol}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="pt-2 border-t">
                    <div className="text-sm text-muted-foreground mb-2">
                        Created
                    </div>
                    <div className="text-sm">
                        {new Date(portfolio.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
