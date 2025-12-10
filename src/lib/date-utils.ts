/**
 * Date utilities for time-based filtering
 */

export interface DateRange {
    start: Date;
    end: Date;
}

/**
 * Get date range for a specific year
 * @param year - The year to get the range for
 * @returns DateRange object with start and end dates
 */
export function getDateRangeForYear(year: number): DateRange {
    return {
        start: new Date(year, 0, 1, 0, 0, 0, 0),
        end: new Date(year, 11, 31, 23, 59, 59, 999),
    };
}

/**
 * Get date range for a specific month
 * @param year - The year
 * @param month - The month (1-12)
 * @returns DateRange object with start and end dates
 */
export function getDateRangeForMonth(year: number, month: number): DateRange {
    // Month is 1-12, but Date constructor expects 0-11
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);

    // Get last day of month by going to next month's day 0
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    return {
        start: startDate,
        end: endDate,
    };
}

/**
 * Get the current year
 * @returns Current year as number
 */
export function getCurrentYear(): number {
    return new Date().getFullYear();
}

/**
 * Get array of years from start year to current year
 * @param startYear - The starting year (default: 2020)
 * @returns Array of years in descending order
 */
export function getYearsList(startYear: number = 2020): number[] {
    const currentYear = getCurrentYear();
    const years: number[] = [];

    for (let year = currentYear; year >= startYear; year--) {
        years.push(year);
    }

    return years;
}

/**
 * Get array of month names
 * @returns Array of month names
 */
export function getMonthsList(): { value: number; label: string }[] {
    return [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' },
    ];
}
