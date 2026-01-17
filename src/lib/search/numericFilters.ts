/**
 * Numeric filter parsing for search queries
 *
 * Parses filter expressions like "nagasa>70", "cm<65", "price>=100000"
 * from search query strings and separates them from text search terms.
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

// Operator string to typed operator mapping
const OPERATOR_MAP: Record<string, NumericOperator> = {
  '>': 'gt',
  '>=': 'gte',
  '<': 'lt',
  '<=': 'lte',
};

// Pattern: field(operator)value, e.g., nagasa>70, cm>=72.5, price<500000
const NUMERIC_PATTERN = /^(nagasa|cm|length|price|yen|jpy)([><]=?)(\d+(?:\.\d+)?)$/;

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
 */
export function parseNumericFilters(queryStr: string): ParsedNumericFilters {
  const words = queryStr.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 2);
  const filters: NumericFilter[] = [];
  const textWords: string[] = [];

  for (const word of words) {
    const match = word.match(NUMERIC_PATTERN);
    if (match) {
      const [, fieldAlias, opStr, valueStr] = match;
      const value = parseFloat(valueStr);

      // Map alias to database field
      const field = FIELD_ALIASES[fieldAlias];
      if (!field) {
        // Unknown field alias - treat as text word
        textWords.push(word);
        continue;
      }

      // Map operator string to typed operator
      const op = OPERATOR_MAP[opStr];
      if (!op) {
        // Unknown operator - treat as text word
        textWords.push(word);
        continue;
      }

      filters.push({ field, op, value });
    } else {
      textWords.push(word);
    }
  }

  return { filters, textWords };
}

/**
 * Checks if a string looks like a numeric filter pattern
 * Useful for UI hints or validation
 */
export function isNumericFilter(word: string): boolean {
  return NUMERIC_PATTERN.test(word.toLowerCase());
}

/**
 * Gets all supported field aliases
 */
export function getSupportedFieldAliases(): string[] {
  return Object.keys(FIELD_ALIASES);
}

/**
 * Gets the database field for a given alias
 */
export function getFieldForAlias(alias: string): string | undefined {
  return FIELD_ALIASES[alias.toLowerCase()];
}
