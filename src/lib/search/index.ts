/**
 * Search library - text normalization and types for search functionality
 */

// Text normalization utilities
export {
  removeMacrons,
  toTraditionalKanji,
  hasKanjiVariants,
  normalizeSearchText,
  prepareSearchQuery,
  getSearchVariants,
  expandSearchAliases,
} from './textNormalization';

// Numeric filter parsing
export {
  parseNumericFilters,
  isNumericFilter,
  getSupportedFieldAliases,
  getFieldForAlias,
} from './numericFilters';

export type {
  NumericOperator,
  NumericFilter,
  ParsedNumericFilters,
} from './numericFilters';

// Type definitions
export type {
  // Suggestion types
  SearchSuggestion,
  SearchSuggestionsResponse,
  // Hook types
  UseSearchOptions,
  UseSearchReturn,
  // Full search types
  SearchParams,
  SearchResult,
  SearchResultsResponse,
  // History types
  RecentSearch,
} from './types';
