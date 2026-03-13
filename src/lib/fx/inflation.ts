/**
 * Static CPI data and inflation calculation utilities.
 *
 * All functions are pure — no API calls, no async, no side effects.
 * CPI data is annual average, 2020 = 100.0 base, sourced from IMF/OECD/national statistics.
 * Updated once per year when new annual data is published.
 */

// =============================================================================
// CPI Data — Annual Average, 2020 = 100.0
// =============================================================================

/**
 * Annual average CPI indices by currency, 2020 = 100.0.
 *
 * Sources:
 * - USD: BLS CPI-U (rebased from 1982-84=100)
 * - JPY: Statistics Bureau of Japan (native 2020=100)
 * - EUR: Eurostat HICP (chain-linked from annual rates)
 * - GBP: UK ONS CPI (rebased from 2015=100)
 * - AUD: ABS CPI (rebased from 2025=100)
 * - CAD: Statistics Canada (rebased from 2002=100)
 * - CHF: Swiss FSO (rebased from 2015=100)
 *
 * 2026 values are IMF WEO January 2026 projections.
 */
export const CPI_DATA: Record<string, Record<number, number>> = {
  USD: {
    2000: 66.5, 2001: 68.4, 2002: 69.5, 2003: 71.1, 2004: 73.0,
    2005: 75.5, 2006: 77.9, 2007: 80.1, 2008: 83.2, 2009: 82.9,
    2010: 84.3, 2011: 86.9, 2012: 88.7, 2013: 90.0, 2014: 91.5,
    2015: 91.6, 2016: 92.7, 2017: 94.7, 2018: 97.0, 2019: 98.8,
    2020: 100.0, 2021: 104.7, 2022: 113.1, 2023: 117.7, 2024: 121.2,
    2025: 124.4, 2026: 127.4,
  },
  JPY: {
    2000: 97.3, 2001: 96.6, 2002: 95.8, 2003: 95.5, 2004: 95.5,
    2005: 95.2, 2006: 95.5, 2007: 95.5, 2008: 96.8, 2009: 95.5,
    2010: 94.8, 2011: 94.6, 2012: 94.5, 2013: 94.8, 2014: 97.5,
    2015: 98.2, 2016: 98.1, 2017: 98.6, 2018: 99.6, 2019: 100.0,
    2020: 100.0, 2021: 99.8, 2022: 102.3, 2023: 105.6, 2024: 108.5,
    2025: 111.9, 2026: 114.3,
  },
  EUR: {
    2000: 72.4, 2001: 74.1, 2002: 75.7, 2003: 77.3, 2004: 79.0,
    2005: 80.7, 2006: 82.5, 2007: 84.2, 2008: 87.0, 2009: 87.2,
    2010: 88.6, 2011: 91.0, 2012: 93.3, 2013: 94.6, 2014: 95.0,
    2015: 95.2, 2016: 95.4, 2017: 96.9, 2018: 98.6, 2019: 99.8,
    2020: 100.0, 2021: 102.6, 2022: 111.2, 2023: 117.2, 2024: 120.0,
    2025: 122.5, 2026: 125.0,
  },
  GBP: {
    2000: 66.8, 2001: 67.7, 2002: 68.5, 2003: 69.5, 2004: 70.4,
    2005: 71.8, 2006: 73.5, 2007: 75.2, 2008: 77.9, 2009: 79.6,
    2010: 82.2, 2011: 85.9, 2012: 88.3, 2013: 90.6, 2014: 91.9,
    2015: 92.0, 2016: 92.6, 2017: 95.1, 2018: 97.4, 2019: 99.2,
    2020: 100.0, 2021: 102.6, 2022: 111.9, 2023: 120.1, 2024: 123.1,
    2025: 127.2, 2026: 129.8,
  },
  AUD: {
    2000: 61.6, 2001: 64.3, 2002: 66.2, 2003: 68.0, 2004: 69.6,
    2005: 71.5, 2006: 74.0, 2007: 75.7, 2008: 79.0, 2009: 80.4,
    2010: 82.8, 2011: 85.5, 2012: 87.0, 2013: 89.2, 2014: 91.4,
    2015: 92.7, 2016: 93.9, 2017: 95.8, 2018: 97.6, 2019: 99.2,
    2020: 100.0, 2021: 102.9, 2022: 109.7, 2023: 115.8, 2024: 119.4,
    2025: 122.8, 2026: 125.9,
  },
  CAD: {
    2000: 69.6, 2001: 71.4, 2002: 73.0, 2003: 75.0, 2004: 76.4,
    2005: 78.1, 2006: 79.6, 2007: 81.4, 2008: 83.3, 2009: 83.5,
    2010: 85.0, 2011: 87.5, 2012: 88.8, 2013: 89.6, 2014: 91.4,
    2015: 92.4, 2016: 93.7, 2017: 95.2, 2018: 97.4, 2019: 99.3,
    2020: 100.0, 2021: 103.4, 2022: 110.4, 2023: 114.7, 2024: 117.4,
    2025: 119.9, 2026: 122.3,
  },
  CHF: {
    2000: 92.8, 2001: 93.8, 2002: 94.4, 2003: 95.0, 2004: 95.8,
    2005: 96.8, 2006: 97.8, 2007: 98.6, 2008: 101.0, 2009: 100.5,
    2010: 101.2, 2011: 101.4, 2012: 100.7, 2013: 100.5, 2014: 100.5,
    2015: 99.3, 2016: 98.9, 2017: 99.4, 2018: 100.4, 2019: 100.7,
    2020: 100.0, 2021: 100.6, 2022: 103.5, 2023: 105.6, 2024: 106.7,
    2025: 106.9, 2026: 107.5,
  },
};

// =============================================================================
// Private helpers
// =============================================================================

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the interpolated CPI index for a currency at a specific date.
 *
 * Annual values are anchored at mid-year (July 1). Dates between mid-years
 * are linearly interpolated. Returns null for unknown currencies or dates
 * outside the data range.
 */
export function getCpiIndex(currency: string, date: Date | string): number | null {
  const cur = currency.toUpperCase();
  const data = CPI_DATA[cur];
  if (!data) return null;

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const years = Object.keys(data).map(Number).sort((a, b) => a - b);
  const minYear = years[0];
  const maxYear = years[years.length - 1];

  // Exact mid-year anchor: July 1 = day 182/183
  const midYearDay = isLeapYear(year) ? 183 : 182;
  const dayOfYear = getDayOfYear(d);
  const daysInYear = isLeapYear(year) ? 366 : 365;

  // Fractional year position: 0.0 = Jan 1, 0.5 ≈ July 1, 1.0 = Dec 31
  const yearFraction = (dayOfYear - 1) / (daysInYear - 1);

  if (yearFraction >= midYearDay / daysInYear) {
    // Date is at or after mid-year → interpolate between this year and next year
    const nextYear = year + 1;
    if (year < minYear || nextYear > maxYear) {
      // If at the boundary, return the year's value if available
      if (data[year] != null && year >= minYear && year <= maxYear) return data[year];
      return null;
    }
    const progress = (yearFraction - midYearDay / daysInYear) / (1 - midYearDay / daysInYear);
    return data[year] + (data[nextYear] - data[year]) * progress;
  } else {
    // Date is before mid-year → interpolate between previous year and this year
    const prevYear = year - 1;
    if (prevYear < minYear || year > maxYear) {
      // If at the boundary, return the year's value if available
      if (data[year] != null && year >= minYear && year <= maxYear) return data[year];
      return null;
    }
    const prevMidYearFrac = 0; // Previous year's mid-year maps to 0 in this segment
    const progress = yearFraction / (midYearDay / daysInYear);
    return data[prevYear] + (data[year] - data[prevYear]) * progress;
  }
}

/**
 * Get cumulative inflation ratio between two dates for a currency.
 *
 * Returns CPI(toDate) / CPI(fromDate).
 * - > 1.0 means inflation (prices rose)
 * - < 1.0 means deflation (prices fell)
 * - ≈ 1.0 means stable prices
 *
 * Returns null if CPI data unavailable for either date.
 *
 * @param currency - Currency code (e.g. "USD", "JPY")
 * @param fromDate - Purchase date
 * @param toDate - Comparison date (defaults to today)
 */
export function getCumulativeInflation(
  currency: string,
  fromDate: Date | string,
  toDate?: Date | string,
): number | null {
  const to = toDate ?? new Date();
  const cpiFrom = getCpiIndex(currency, fromDate);
  const cpiTo = getCpiIndex(currency, to);
  if (cpiFrom == null || cpiTo == null || cpiFrom === 0) return null;
  return cpiTo / cpiFrom;
}

/**
 * Adjust an amount for inflation — what it would be worth in today's money.
 *
 * Example: $40,000 spent in 2018 → getInflationAdjustedAmount(40000, 'USD', '2018-12-01')
 * returns ~$51,200 (28% cumulative inflation from 2018 to today).
 *
 * Returns null if CPI data unavailable.
 */
export function getInflationAdjustedAmount(
  amount: number,
  currency: string,
  fromDate: Date | string,
  toDate?: Date | string,
): number | null {
  const ratio = getCumulativeInflation(currency, fromDate, toDate);
  if (ratio == null) return null;
  return amount * ratio;
}
