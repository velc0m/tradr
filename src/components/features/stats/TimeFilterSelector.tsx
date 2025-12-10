'use client';

import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {Card} from '@/components/ui/card';
import {TimePeriodMode} from '@/types';
import {getYearsList, getMonthsList, getCurrentYear} from '@/lib/date-utils';
import {Calendar} from 'lucide-react';

interface TimeFilterSelectorProps {
    mode: TimePeriodMode;
    year: number | undefined;
    month: number | undefined;
    onFilterChange: (mode: TimePeriodMode, year?: number, month?: number) => void;
}

export function TimeFilterSelector({mode, year, month, onFilterChange}: TimeFilterSelectorProps) {
    const years = getYearsList(2020);
    const months = getMonthsList();

    return (
        <Card className="p-4">
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground"/>
                    <span className="text-sm font-medium">Period:</span>
                </div>

                {/* Mode selector */}
                <Select
                    value={mode}
                    onValueChange={(value) => {
                        const newMode = value as TimePeriodMode;
                        if (newMode === 'year') {
                            onFilterChange('year', year);
                        } else if (newMode === 'month') {
                            // When switching to month, load data for current month (or January if undefined)
                            onFilterChange('month', year, month || 1);
                        } else {
                            onFilterChange('all');
                        }
                    }}
                >
                    <SelectTrigger className="w-[140px]">
                        <SelectValue/>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="year">Year</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                </Select>

                {/* Year selector - shown for 'year' and 'month' modes */}
                {(mode === 'year' || mode === 'month') && (
                    <Select
                        value={year?.toString() || getCurrentYear().toString()}
                        onValueChange={(value) => {
                            const newYear = parseInt(value);
                            if (mode === 'year') {
                                onFilterChange('year', newYear);
                            } else {
                                onFilterChange('month', newYear, month);
                            }
                        }}
                    >
                        <SelectTrigger className="w-[120px]">
                            <SelectValue/>
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((y) => (
                                <SelectItem key={y} value={y.toString()}>
                                    {y}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Month selector - only shown for 'month' mode */}
                {mode === 'month' && (
                    <Select
                        value={month?.toString() || '1'}
                        onValueChange={(value) => {
                            const newMonth = parseInt(value);
                            onFilterChange('month', year, newMonth);
                        }}
                    >
                        <SelectTrigger className="w-[140px]">
                            <SelectValue/>
                        </SelectTrigger>
                        <SelectContent>
                            {months.map((m) => (
                                <SelectItem key={m.value} value={m.value.toString()}>
                                    {m.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
        </Card>
    );
}
