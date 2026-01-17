/**
 * Numeric filter parsing for search queries
 *
 * Parses filter expressions like:
 * - "nagasa>70", "cm<65" (blade length)
 * - "price>=100000", "jpy<500000" (price in JPY)
 * - "USD>20000", "EUR<10000" (price with currency conversion)
 */

export type NumericOperator = 'gt' | 'gte' | 'lt' | 'lte';

export interface NumericFilter {
  field: string;
  op: NumericOperator;
  value: number;
}

export interface ParsedNumericFilters {
  filters: NumericFilter[];
  textWords: string[];
}

// Field aliases mapped to database column names
const FIELD_ALIASES: Record<string, string> = {
  nagasa: 'nagasa_cm',
  cm: 'nagasa_cm',
  length: 'nagasa_cm',
  price: 'price_value',
  yen: 'price_value',
  jpy: 'price_value',
};

// Currency aliases that convert to JPY
const CURRENCY_ALIASES: Record<string, number> = {
  usd: 150,    // USD to JPY approximate rate
  dollar: 150,
  dollars: 150,
  eur: 163,    // EUR to JPY approximate rate (150/0.92)
  euro: 163,
  euros: 163,
};

// Operator string to typed operator mapping
const OPERATOR_MAP: Record<string, NumericOperator> = {
  '>': 'gt',
  '>=': 'gte',
  '<': 'lt',
  '<=': 'lte',
};

// Pattern: field(operator)value, e.g., nagasa>70, cm>=72.5, price<500000
const NUMERIC_PATTERN = /^(nagasa|cm|length|price|yen|jpy)([><]=?)(\d+(?:\.\d+)?)$/;

// Currency pattern: USD>20000, EUR<10000, dollar>=15000
const CURRENCY_PATTERN = /^(usd|dollar|dollars|eur|euro|euros)([><]=?)(\d+(?:\.\d+)?)$/;

/**
 * Parses numeric filters from a search query string.
 *
 * @param queryStr - The raw search query string
 * @returns Object containing extracted filters and remaining text words
 *
 * @example
 * parseNumericFilters("bizen cm>70")
 * // Returns: { filters: [{ field: 'nagasa_cm', op: 'gt', value: 70 }], textWords: ['bizen'] }
 *
 * @example
 * parseNumericFilters("katana price<500000 nagasa>=72")
 * // Returns: {
 * //   filters: [
 * //     { field: 'price_value', op: 'lt', value: 500000 },
 * //     { field: 'nagasa_cm', op: 'gte', value: 72 }
 * //   ],
 * //   textWords: ['katana']
 * // }
 *
 * @example
 * parseNumericFilters("juyo usd>20000")
 * // Returns: { filters: [{ field: 'price_value', op: 'gt', value: 3000000 }], textWords: ['juyo'] }
 * // (20000 USD * 150 = 3,000,000 JPY)
 *
 * @example
 * parseNumericFilters("tsuba eur<500")
 * // Returns: { filters: [{ field: 'price_value', op: 'lt', value: 81500 }], textWords: ['tsuba'] }
 * // (500 EUR * 163 = 81,500 JPY)
 */
export function parseNumericFilters(queryStr: string): ParsedNumericFilters {
  const words = queryStr.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 2);
  const filters: NumericFilter[] = [];
  const textWords: string[] = [];

  for (const word of words) {
    // First try standard numeric pattern (nagasa, cm, price, etc.)
    const match = word.match(NUMERIC_PATTERN);
    if (match) {
      const [, fieldAlias, opStr, valueStr] = match;
      const value = parseFloat(valueStr);

      // Map alias to database field
      const field = FIELD_ALIASES[fieldAlias];
      if (!field) {
        textWords.push(word);
        continue;
      }

      // Map operator string to typed operator
      const op = OPERATOR_MAP[opStr];
      if (!op) {
        textWords.push(word);
        continue;
      }

      filters.push({ field, op, value });
      continue;
    }

    // Try currency pattern (USD>20000, EUR<10000)
    const currencyMatch = word.match(CURRENCY_PATTERN);
    if (currencyMatch) {
      const [, currencyAlias, opStr, valueStr] = currencyMatch;
      const rawValue = parseFloat(valueStr);

      // Get conversion rate to JPY
      const conversionRate = CURRENCY_ALIASES[currencyAlias];
      if (!conversionRate) {
        textWords.push(word);
        continue;
      }

      // Convert to JPY
      const jpyValue = Math.round(rawValue * conversionRate);

      // Map operator
      const op = OPERATOR_MAP[opStr];
      if (!op) {
        textWords.push(word);
        continue;
      }

      filters.push({ field: 'price_value', op, value: jpyValue });
      continue;
    }

    // Not a numeric filter - treat as text word
    textWords.push(word);
  }

  return { filters, textWords };
}

/**
 * Checks if a string looks like a numeric filter pattern
 * Useful for UI hints or validation
 */
export function isNumericFilter(word: string): boolean {
  const lower = word.toLowerCase();
  return NUMERIC_PATTERN.test(lower) || CURRENCY_PATTERN.test(lower);
}

/**
 * Gets all supported field aliases (including currency aliases)
 */
export function getSupportedFieldAliases(): string[] {
  return [...Object.keys(FIELD_ALIASES), ...Object.keys(CURRENCY_ALIASES)];
}

/**
 * Gets the supported currency aliases and their conversion rates to JPY
 */
export function getCurrencyConversionRates(): Record<string, number> {
  return { ...CURRENCY_ALIASES };
}

/**
 * Gets the database field for a given alias
 */
export function getFieldForAlias(alias: string): string | undefined {
  return FIELD_ALIASES[alias.toLowerCase()];
}
