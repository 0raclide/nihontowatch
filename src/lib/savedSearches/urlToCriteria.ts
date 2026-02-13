import type { SavedSearchCriteria } from '@/types';

/**
 * Convert browse page URL params to SavedSearchCriteria
 */
export function urlParamsToSearchCriteria(
  params: URLSearchParams
): SavedSearchCriteria {
  const criteria: SavedSearchCriteria = {};

  // Tab (availability filter)
  const tab = params.get('tab');
  if (tab === 'available' || tab === 'sold') {
    criteria.tab = tab;
  } else {
    criteria.tab = 'available'; // Default
  }

  // Category
  const category = params.get('cat');
  if (category === 'nihonto' || category === 'tosogu' || category === 'armor') {
    criteria.category = category;
  }

  // Item types (comma-separated)
  const types = params.get('type');
  if (types) {
    criteria.itemTypes = types.split(',').filter(Boolean);
  }

  // Certifications (comma-separated)
  const certs = params.get('cert');
  if (certs) {
    criteria.certifications = certs.split(',').filter(Boolean);
  }

  // Dealers (comma-separated IDs)
  const dealers = params.get('dealer');
  if (dealers) {
    criteria.dealers = dealers
      .split(',')
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
  }

  // Schools (comma-separated)
  const schools = params.get('school');
  if (schools) {
    criteria.schools = schools.split(',').filter(Boolean);
  }

  // Ask only (price on request)
  if (params.get('ask') === 'true') {
    criteria.askOnly = true;
  }

  // Price range (explicit URL params)
  const priceMin = params.get('priceMin');
  if (priceMin) {
    criteria.minPrice = Number(priceMin);
  }
  const priceMax = params.get('priceMax');
  if (priceMax) {
    criteria.maxPrice = Number(priceMax);
  }

  // Search query
  const query = params.get('q');
  if (query) {
    criteria.query = query;

    // Extract numeric price filters from query
    const pricePatterns = [
      /price\s*[<>]=?\s*(\d+)/gi,
      /(?:jpy|yen)\s*[<>]=?\s*(\d+)/gi,
    ];

    for (const pattern of pricePatterns) {
      const match = query.match(pattern);
      if (match) {
        // Parse min/max from numeric filters
        const minMatch = query.match(/price\s*>=?\s*(\d+)/i);
        const maxMatch = query.match(/price\s*<=?\s*(\d+)/i);

        if (minMatch) {
          criteria.minPrice = parseInt(minMatch[1], 10);
        }
        if (maxMatch) {
          criteria.maxPrice = parseInt(maxMatch[1], 10);
        }
      }
    }
  }

  // Sort
  const sort = params.get('sort');
  if (sort) {
    criteria.sort = sort;
  }

  return criteria;
}

/**
 * Convert SavedSearchCriteria back to URL params for "Run Search" functionality
 */
export function criteriaToUrlParams(criteria: SavedSearchCriteria): string {
  const params = new URLSearchParams();

  // Tab
  if (criteria.tab && criteria.tab !== 'available') {
    params.set('tab', criteria.tab);
  }

  // Category (nihonto is default, only serialize non-default)
  if (criteria.category && criteria.category !== 'nihonto') {
    params.set('cat', criteria.category);
  }

  // Item types
  if (criteria.itemTypes?.length) {
    params.set('type', criteria.itemTypes.join(','));
  }

  // Certifications
  if (criteria.certifications?.length) {
    params.set('cert', criteria.certifications.join(','));
  }

  // Dealers
  if (criteria.dealers?.length) {
    params.set('dealer', criteria.dealers.join(','));
  }

  // Schools
  if (criteria.schools?.length) {
    params.set('school', criteria.schools.join(','));
  }

  // Ask only
  if (criteria.askOnly) {
    params.set('ask', 'true');
  }

  // Price range
  if (criteria.minPrice !== undefined) {
    params.set('priceMin', String(criteria.minPrice));
  }
  if (criteria.maxPrice !== undefined) {
    params.set('priceMax', String(criteria.maxPrice));
  }

  // Query
  if (criteria.query) {
    params.set('q', criteria.query);
  }

  // Sort
  if (criteria.sort && criteria.sort !== 'recent') {
    params.set('sort', criteria.sort);
  }

  return params.toString();
}

/**
 * Build the full browse URL from criteria
 */
export function criteriaToUrl(criteria: SavedSearchCriteria): string {
  const params = criteriaToUrlParams(criteria);
  return params ? `/?${params}` : '/';
}

/**
 * Generate a human-readable summary of the search criteria
 */
export function criteriaToHumanReadable(
  criteria: SavedSearchCriteria,
  dealerNames?: Map<number, string>
): string {
  const parts: string[] = [];

  // Category
  if (criteria.category) {
    const categoryLabels: Record<string, string> = {
      nihonto: 'Nihonto (blades)',
      tosogu: 'Tosogu (fittings)',
      armor: 'Armor & Military',
    };
    parts.push(categoryLabels[criteria.category] || criteria.category);
  }

  // Item types
  if (criteria.itemTypes?.length) {
    const types = criteria.itemTypes
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
      .join(', ');
    parts.push(types);
  }

  // Certifications
  if (criteria.certifications?.length) {
    parts.push(criteria.certifications.join(', '));
  }

  // Dealers
  if (criteria.dealers?.length) {
    if (dealerNames) {
      const names = criteria.dealers
        .map((id) => dealerNames.get(id) || `Dealer #${id}`)
        .join(', ');
      parts.push(`from ${names}`);
    } else {
      parts.push(`${criteria.dealers.length} dealer(s)`);
    }
  }

  // Schools
  if (criteria.schools?.length) {
    parts.push(`${criteria.schools.join(', ')} school`);
  }

  // Price range
  if (criteria.minPrice !== undefined || criteria.maxPrice !== undefined) {
    if (criteria.minPrice && criteria.maxPrice) {
      parts.push(
        `¥${criteria.minPrice.toLocaleString()} - ¥${criteria.maxPrice.toLocaleString()}`
      );
    } else if (criteria.minPrice) {
      parts.push(`¥${criteria.minPrice.toLocaleString()}+`);
    } else if (criteria.maxPrice) {
      parts.push(`under ¥${criteria.maxPrice.toLocaleString()}`);
    }
  }

  // Ask only
  if (criteria.askOnly) {
    parts.push('Price on request');
  }

  // Query
  if (criteria.query) {
    // Remove numeric filters from display
    const cleanQuery = criteria.query
      .replace(/(?:price|jpy|yen|nagasa|cm|length)\s*[<>]=?\s*\d+/gi, '')
      .trim();
    if (cleanQuery) {
      parts.push(`"${cleanQuery}"`);
    }
  }

  // Tab
  if (criteria.tab === 'sold') {
    parts.push('(sold items)');
  }

  if (parts.length === 0) {
    return 'All items';
  }

  return parts.join(' · ');
}

/**
 * Generate a short name for the saved search based on criteria
 */
export function generateSearchName(criteria: SavedSearchCriteria): string {
  // Priority: item types > certifications > dealers > query
  if (criteria.itemTypes?.length) {
    const types = criteria.itemTypes.slice(0, 2);
    const name = types
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
      .join(', ');
    return criteria.itemTypes.length > 2
      ? `${name} +${criteria.itemTypes.length - 2} more`
      : name;
  }

  if (criteria.certifications?.length) {
    return criteria.certifications.slice(0, 2).join(', ');
  }

  if (criteria.query) {
    const cleanQuery = criteria.query
      .replace(/(?:price|jpy|yen|nagasa|cm|length)\s*[<>]=?\s*\d+/gi, '')
      .trim();
    if (cleanQuery) {
      return cleanQuery.length > 30
        ? cleanQuery.substring(0, 27) + '...'
        : cleanQuery;
    }
  }

  if (criteria.category) {
    const names: Record<string, string> = { nihonto: 'All Nihonto', tosogu: 'All Tosogu', armor: 'All Armor' };
    return names[criteria.category] || 'Custom search';
  }

  return 'Custom search';
}

/**
 * Check if two criteria objects are equivalent
 */
export function areCriteriaEqual(
  a: SavedSearchCriteria,
  b: SavedSearchCriteria
): boolean {
  // Compare arrays by sorting and joining
  const arraysEqual = (arr1?: unknown[], arr2?: unknown[]) => {
    if (!arr1 && !arr2) return true;
    if (!arr1 || !arr2) return false;
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort().join(',');
    const sorted2 = [...arr2].sort().join(',');
    return sorted1 === sorted2;
  };

  return (
    a.tab === b.tab &&
    a.category === b.category &&
    arraysEqual(a.itemTypes, b.itemTypes) &&
    arraysEqual(a.certifications, b.certifications) &&
    arraysEqual(a.dealers, b.dealers) &&
    arraysEqual(a.schools, b.schools) &&
    a.askOnly === b.askOnly &&
    a.query === b.query &&
    a.sort === b.sort &&
    a.minPrice === b.minPrice &&
    a.maxPrice === b.maxPrice
  );
}
