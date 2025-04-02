/**
 * Product matching and deal detection utility
 * Direct port of Python product_checker.py functionality
 * Version 1.1 - Updated to exactly match original code
 */

/**
 * Normalize title by removing non-alphanumeric characters and converting to lowercase
 * @param {string} title - Product title to normalize
 * @returns {string} Normalized title
 */
function normalizeTitle(title) {
    // Convert to lowercase and remove non-alphanumeric characters
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  
  /**
   * Parse price string to extract numeric value
   * @param {string} price - Price string (e.g., "$150" or "150 EUR")
   * @returns {number|null} Numeric price value or null if parsing fails
   */
  function parsePrice(price) {
    const match = /\d+/.exec(price);
    return match ? parseInt(match[0], 10) : null;
  }
  
  /**
   * Get close matches using Levenshtein distance (similar to Python's difflib)
   * @param {string} word - Word to find close matches for
   * @param {Array<string>} possibilities - List of possible matches
   * @param {number} n - Maximum number of close matches to return
   * @param {number} cutoff - Minimum similarity (0.0 - 1.0)
   * @returns {Array<string>} List of close matches
   */
  function getCloseMatches(word, possibilities, n = 3, cutoff = 0.6) {
    // Simplified Levenshtein distance calculation
    function levenshteinDistance(a, b) {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
  
      const matrix = [];
  
      // Initialize matrix
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
  
      // Fill matrix
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          const cost = a[j - 1] === b[i - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,       // deletion
            matrix[i][j - 1] + 1,       // insertion
            matrix[i - 1][j - 1] + cost // substitution
          );
        }
      }
  
      return matrix[b.length][a.length];
    }
  
    // Calculate similarity ratio (similar to Python's SequenceMatcher ratio)
    function similarityRatio(a, b) {
      const distance = levenshteinDistance(a, b);
      const maxLength = Math.max(a.length, b.length);
      return maxLength === 0 ? 1.0 : (maxLength - distance) / maxLength;
    }
  
    // Calculate similarity for each possibility
    const similarities = possibilities.map(possibility => ({
      possibility,
      similarity: similarityRatio(word, possibility)
    }));
  
    // Filter by cutoff and sort by similarity (descending)
    return similarities
      .filter(item => item.similarity >= cutoff)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, n)
      .map(item => item.possibility);
  }
  
  /**
   * Match title to list of products using exact and fuzzy matching
   * Exact port of the Python match_title_to_products function
   * @param {string} title - Listing title
   * @param {Array<Object>} products - List of product objects
   * @returns {Array<Object>} Matching products
   */
  function matchTitleToProducts(title, products) {
    // Normalize the title
    const normalizedTitle = normalizeTitle(title);
  
    // Normalize all product names in the product list
    const normalizedProducts = products.map(product => ({
      originalName: product.name,
      normalizedName: normalizeTitle(product.name)
    }));
  
    // Find exact matches in the title
    const matches = normalizedProducts.filter(product => 
      normalizedTitle.includes(product.normalizedName)
    );
  
    // Prioritize the longest match (most specific product)
    if (matches.length > 0) {
      matches.sort((a, b) => b.normalizedName.length - a.normalizedName.length);
      return [matches[0]]; // Return the best match (longest name)
    }
  
    // Fallback to fuzzy matching if no exact matches found
    const fuzzyMatches = [];
    const allNormalizedNames = normalizedProducts.map(p => p.normalizedName);
    
    for (const product of normalizedProducts) {
      const closeMatch = getCloseMatches(normalizedTitle, allNormalizedNames, 1, 0.7);
      if (closeMatch.length > 0 && product.normalizedName === closeMatch[0]) {
        fuzzyMatches.push(product);
      }
    }
  
    if (fuzzyMatches.length > 0) {
      fuzzyMatches.sort((a, b) => b.normalizedName.length - a.normalizedName.length);
      return [fuzzyMatches[0]]; // Return the best fuzzy match (longest name)
    }
  
    return []; // No matches found
  }
  
  /**
   * Check if a product is a good deal or near a good deal
   * Exact port of the Python product_checker function without database dependencies
   * @param {string} title - Listing title
   * @param {string|number} price - Listing price
   * @param {Array<Object>} products - List of product objects
   * @returns {Object} Result object with product info and deal status
   */
  function checkProduct(title, price, products) {
    if (!products || products.length === 0) {
      return {
        productName: null,
        isGoodDeal: false,
        nearGoodDeal: false,
        preferred: false
      };
    }
  
    // Attempt to match the listing title to one of the products
    const matches = matchTitleToProducts(title, products);
    if (matches.length === 0) {
      return {
        productName: null,
        isGoodDeal: false,
        nearGoodDeal: false,
        preferred: false
      };
    }
  
    // Take the best match
    const match = matches[0];
  
    // Fetch the actual product from 'products'
    const product = products.find(p => 
      normalizeTitle(p.name) === match.normalizedName
    );
  
    if (!product) {
      return {
        productName: null,
        isGoodDeal: false,
        nearGoodDeal: false,
        preferred: false
      };
    }
  
    // Parse the price if it's a string
    let numericPrice = price;
    if (typeof price === 'string') {
      numericPrice = parsePrice(price);
    }
  
    // Check if the price is below the user's max
    const isGoodDeal = (numericPrice !== null) && (numericPrice < product.maxPrice);
  
    // Check near-good deal (within max_price + 100)
    const nearGoodDeal = (
      (numericPrice !== null) &&
      (product.maxPrice <= numericPrice) &&
      (numericPrice <= (product.maxPrice + 100))
    );
  
    // Return the "preferred" status along with the other results
    return {
      productName: product.name,
      isGoodDeal: isGoodDeal,
      nearGoodDeal: nearGoodDeal,
      preferred: product.preferred || false
    };
  }
  
  // Export functions for use in other files
  export {
    normalizeTitle,
    parsePrice,
    getCloseMatches,
    matchTitleToProducts,
    checkProduct
  };