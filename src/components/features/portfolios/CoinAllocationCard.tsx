import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {BlurredAmount} from '@/components/ui/BlurredAmount';
import {IPortfolio, ITrade} from '@/types';

interface CoinAllocationCardProps {
    portfolio: IPortfolio;
    openTrades: ITrade[];
    formatAmount: (amount: number) => string;
}

export function CoinAllocationCard({portfolio, openTrades, formatAmount}: CoinAllocationCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Coin Allocation</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {portfolio.coins.map((coin, index) => {
                        // Allocation based on cash deposit only
                        const allocation = (portfolio.totalDeposit * coin.percentage) / 100;

                        // Initial coins for THIS specific coin (in amount, not value)
                        const initialCoinForSymbol = portfolio.initialCoins?.find(ic => ic.symbol === coin.symbol);
                        const initialCoinAmount = initialCoinForSymbol?.amount || 0;

                        // Calculate used amount from open/filled trades
                        const coinOpenTrades = openTrades.filter(t => t.coinSymbol === coin.symbol);
                        const usedInTrades = coinOpenTrades.reduce((sum, trade) => sum + trade.sumPlusFee, 0);

                        const usedPercent = allocation > 0 ? (usedInTrades / allocation) * 100 : 0;
                        const availablePercent = 100 - usedPercent;
                        const availableAmount = allocation - usedInTrades;

                        return (
                            <div
                                key={index}
                                className="p-3 rounded-lg bg-muted/50 space-y-2"
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="font-semibold">{coin.symbol}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {coin.percentage}% allocation
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-medium">
                                            <BlurredAmount amount={allocation}/>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {coin.decimalPlaces} decimal places
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {initialCoinAmount > 0 && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-blue-400">Initial coins:</span>
                                            <span className="text-blue-400">
                                                {formatAmount(initialCoinAmount)} {coin.symbol}
                                            </span>
                                        </div>
                                    )}
                                    {usedInTrades > 0 && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">In open trades:</span>
                                            <span className="text-muted-foreground">
                                                <BlurredAmount amount={usedInTrades}/>
                                            </span>
                                        </div>
                                    )}
                                    <div
                                        className="flex items-center justify-between text-xs font-medium pt-1 border-t border-muted">
                                        <span className={availablePercent < 0 ? 'text-red-500' : 'text-green-500'}>
                                            Available: {availablePercent.toFixed(1)}%
                                        </span>
                                        <span className={availablePercent < 0 ? 'text-red-500' : 'text-green-500'}>
                                            <BlurredAmount amount={availableAmount} showSign={true}/>
                                        </span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                        <div
                                            className={`h-full transition-all ${
                                                usedPercent > 100 ? 'bg-red-500' :
                                                    usedPercent > 80 ? 'bg-yellow-500' :
                                                        'bg-green-500'
                                            }`}
                                            style={{width: `${Math.min(usedPercent, 100)}%`}}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
