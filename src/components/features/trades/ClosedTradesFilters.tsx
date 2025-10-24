import {Button} from '@/components/ui/button';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {TradeType} from '@/types';
import {ArrowDown, ArrowUp, Filter, X} from 'lucide-react';

export interface ClosedTradesFilterState {
    coin: string;
    type: string;
    sortBy: 'closeDate' | 'filledDate' | 'none';
    sortOrder: 'asc' | 'desc';
}

interface ClosedTradesFiltersProps {
    filter: ClosedTradesFilterState;
    onFilterChange: (filter: ClosedTradesFilterState) => void;
    uniqueCoins: string[];
    filteredCount: number;
    totalCount: number;
}

export function ClosedTradesFilters({
                                        filter,
                                        onFilterChange,
                                        uniqueCoins,
                                        filteredCount,
                                        totalCount
                                    }: ClosedTradesFiltersProps) {
    const handleClearFilters = () => {
        onFilterChange({
            coin: 'all',
            type: 'all',
            sortBy: 'closeDate',
            sortOrder: 'desc',
        });
    };

    const toggleSortOrder = () => {
        onFilterChange({
            ...filter,
            sortOrder: filter.sortOrder === 'asc' ? 'desc' : 'asc',
        });
    };

    const hasActiveFilters =
        filter.coin !== 'all' ||
        filter.type !== 'all' ||
        filter.sortBy !== 'closeDate';

    return (
        <div className="flex flex-wrap gap-3 mb-4 items-center">
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground"/>
                <span className="text-sm text-muted-foreground">Filters:</span>
            </div>

            {/* Coin Filter */}
            <Select
                value={filter.coin}
                onValueChange={(value) =>
                    onFilterChange({...filter, coin: value})
                }
            >
                <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Coin"/>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Coins</SelectItem>
                    {uniqueCoins.map((coin) => (
                        <SelectItem key={coin} value={coin}>
                            {coin}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select
                value={filter.type}
                onValueChange={(value) =>
                    onFilterChange({...filter, type: value})
                }
            >
                <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Type"/>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value={TradeType.LONG}>LONG</SelectItem>
                    <SelectItem value={TradeType.SHORT}>SHORT</SelectItem>
                </SelectContent>
            </Select>

            {/* Sort By */}
            <Select
                value={filter.sortBy}
                onValueChange={(value: 'closeDate' | 'filledDate' | 'none') =>
                    onFilterChange({...filter, sortBy: value})
                }
            >
                <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Sort by"/>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">No Sort</SelectItem>
                    <SelectItem value="closeDate">Close Date</SelectItem>
                    <SelectItem value="filledDate">Filled Date</SelectItem>
                </SelectContent>
            </Select>

            {/* Sort Order */}
            {filter.sortBy !== 'none' && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSortOrder}
                >
                    {filter.sortOrder === 'asc' ? (
                        <ArrowUp className="h-4 w-4"/>
                    ) : (
                        <ArrowDown className="h-4 w-4"/>
                    )}
                </Button>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                >
                    <X className="h-4 w-4 mr-1"/>
                    Clear
                </Button>
            )}

            <div className="ml-auto text-sm text-muted-foreground">
                Showing {filteredCount} of {totalCount} trades
            </div>
        </div>
    );
}
