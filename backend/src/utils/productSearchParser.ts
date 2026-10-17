/**
 * Product Search Intent Parser
 * 
 * Parses natural language search queries (e.g. "shoes under 5000", "laptops under $2000", "running shoes under ₹3000")
 * into structured search intents: clean keyword, target categories, price constraints, and explicit currencies.
 */

export interface ProductSearchIntent {
  rawQuery: string;
  cleanKeyword: string;
  category?: string;
  targetCategories: string[];
  maxPrice?: number;
  minPrice?: number;
  currency?: string; // Only set if explicitly specified in the query or body
  isCrypto: boolean;
}

const KNOWN_CRYPTO_TICKERS = new Set(['ETH', 'BTC', 'SOL', 'BNB', 'AVAX', 'MATIC', 'DOGE', 'USDC']);

// Mapping keywords to authoritative DummyJSON categories
const CATEGORY_MAP: Record<string, string[]> = {
  shoe: ['mens-shoes', 'womens-shoes'],
  shoes: ['mens-shoes', 'womens-shoes'],
  sneaker: ['mens-shoes', 'womens-shoes'],
  sneakers: ['mens-shoes', 'womens-shoes'],
  footwear: ['mens-shoes', 'womens-shoes'],
  slipper: ['womens-shoes', 'mens-shoes'],
  slippers: ['womens-shoes', 'mens-shoes'],
  heel: ['womens-shoes'],
  heels: ['womens-shoes'],
  laptop: ['laptops'],
  laptops: ['laptops'],
  notebook: ['laptops'],
  notebooks: ['laptops'],
  macbook: ['laptops'],
  phone: ['smartphones', 'mobile-accessories'],
  phones: ['smartphones', 'mobile-accessories'],
  smartphone: ['smartphones'],
  smartphones: ['smartphones'],
  iphone: ['smartphones'],
  watch: ['mens-watches', 'womens-watches'],
  watches: ['mens-watches', 'womens-watches'],
  fragrance: ['fragrances'],
  fragrances: ['fragrances'],
  perfume: ['fragrances'],
  furniture: ['furniture'],
  shirt: ['mens-shirts', 'tops'],
  shirts: ['mens-shirts', 'tops'],
  dress: ['womens-dresses'],
  dresses: ['womens-dresses'],
  tablet: ['tablets'],
  tablets: ['tablets'],
  sunglasses: ['sunglasses'],
  bag: ['womens-bags'],
  bags: ['womens-bags'],
};

/**
 * Parses user search query and explicit parameters into a validated ProductSearchIntent.
 */
export function parseProductSearchIntent(rawInput: string, explicitParams?: any): ProductSearchIntent {
  const queryStr = (rawInput || explicitParams?.query || '').toString().trim();
  const upper = queryStr.toUpperCase();

  // Check if ticker is a cryptocurrency
  if (KNOWN_CRYPTO_TICKERS.has(upper)) {
    return {
      rawQuery: queryStr,
      cleanKeyword: upper,
      targetCategories: [],
      isCrypto: true,
    };
  }

  // 1. Detect currency if explicitly specified in string
  let currency: string | undefined = explicitParams?.currency;
  if (!currency) {
    if (/[₹]|(\binr\b)/i.test(queryStr)) {
      currency = 'INR';
    } else if (/[$]|(\busd\b)/i.test(queryStr)) {
      currency = 'USD';
    } else if (/[€]|(\beur\b)/i.test(queryStr)) {
      currency = 'EUR';
    } else if (/[£]|(\bgbp\b)/i.test(queryStr)) {
      currency = 'GBP';
    }
  }

  // 2. Detect price constraints (under / below / less than / max / <= / <)
  let maxPrice: number | undefined = explicitParams?.maxPrice ?? explicitParams?.max_price;
  let minPrice: number | undefined = explicitParams?.minPrice ?? explicitParams?.min_price;

  if (maxPrice === undefined) {
    // Match "between X and Y"
    const betweenMatch = queryStr.match(/between\s+[$₹€£]?\s*(\d+(?:\.\d+)?)\s*(?:and|-|to)\s*[$₹€£]?\s*(\d+(?:\.\d+)?)/i);
    if (betweenMatch) {
      minPrice = parseFloat(betweenMatch[1]);
      maxPrice = parseFloat(betweenMatch[2]);
    } else {
      // Match "under X", "below X", "<= X", "< X", "less than X", "max X", "up to X"
      const maxMatch = queryStr.match(/(?:under|below|less\s+than|max|up\s+to|<=|<)\s*[$₹€£]?\s*(\d+(?:\.\d+)?)/i);
      if (maxMatch) {
        maxPrice = parseFloat(maxMatch[1]);
      }
    }
  }

  // 3. Clean keywords by stripping price clauses and extraneous words
  let cleaned = queryStr
    .replace(/between\s+[$₹€£]?\s*\d+(?:\.\d+)?\s*(?:and|-|to)\s*[$₹€£]?\s*\d+(?:\.\d+)?/gi, '')
    .replace(/(?:under|below|less\s+than|max|up\s+to|<=|<)\s*[$₹€£]?\s*\d+(?:\.\d+)?(?:\s*(?:inr|usd|eur|gbp|rupees|dollars))?/gi, '')
    .replace(/[$₹€£]/g, '')
    .replace(/\b(inr|usd|eur|gbp|rupees|dollars|budget|price|priced|cost|costing)\b/gi, '')
    .replace(/\b(find|search|compare|get|show|look\s+for|best|top|cheap)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    cleaned = explicitParams?.category || 'products';
  }

  // 4. Map to target categories
  const lowerWords = cleaned.toLowerCase().split(/\s+/);
  const targetCategoriesSet = new Set<string>();

  for (const w of lowerWords) {
    if (CATEGORY_MAP[w]) {
      for (const cat of CATEGORY_MAP[w]) {
        targetCategoriesSet.add(cat);
      }
    }
  }

  // If explicit category provided
  if (explicitParams?.category && CATEGORY_MAP[explicitParams.category.toLowerCase()]) {
    for (const cat of CATEGORY_MAP[explicitParams.category.toLowerCase()]) {
      targetCategoriesSet.add(cat);
    }
  }

  const targetCategories = Array.from(targetCategoriesSet);
  const primaryCategory = targetCategories[0];

  return {
    rawQuery: queryStr,
    cleanKeyword: cleaned,
    category: primaryCategory,
    targetCategories,
    maxPrice: maxPrice !== undefined && !isNaN(maxPrice) ? maxPrice : undefined,
    minPrice: minPrice !== undefined && !isNaN(minPrice) ? minPrice : undefined,
    currency,
    isCrypto: false,
  };
}
