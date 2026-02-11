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

// Full-Text Search query builder
export {
  buildFTSQuery,
  buildPhraseQuery,
  buildTermsQuery,
  escapeForTsquery,
  extractPhrases,
  isValidTsquery,
} from './ftsQueryBuilder';

export type {
  FTSQuery,
  FTSQueryOptions,
} from './ftsQueryBuilder';

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

// URL detection (short-circuits search pipeline for URL lookups)
export { detectUrlQuery } from './urlDetection';

// Semantic query parsing (certifications, item types)
export {
  parseSemanticQuery,
  isSemanticTerm,
  getCertificationKey,
  getItemTypeKey,
} from './semanticQueryParser';

export type {
  SemanticFilters,
  ParsedSemanticQuery,
} from './semanticQueryParser';

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
