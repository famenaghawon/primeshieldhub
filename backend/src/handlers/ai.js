// ======================================================================
// AI HANDLERS - COMPLETE WITH ALL IMPORTS, ANALYTICS, BRAIN, AND BUILDMART
// FIXED: Case-insensitive brand detection
// FIXED: Always include product data with prices in system prompt
// FIXED: Dynamic brand availability based on database
// FIXED: Consistent product responses
// FIXED: AI now gives prices when asked "how much"
// FIXED: Brand detection for any product mention
// ======================================================================

import { getCorsHeaders } from '../middleware/cors.js';
import { validateString } from '../utils/validation.js';
import { analyzeEvent } from '../../intelligence.js';

// ======================================================================
// ENHANCED: Brand-specific search patterns - NO DUPLICATES
// ======================================================================

const BRAND_ALIASES = {
    'itel': ['itel', 'itell', 'itl', 'it', 'itel mobile'],
    'oraimo': ['oraimo', 'oraim', 'ora', 'Oraimo', 'ORaimo', 'ORAIMO'],
    'apple': ['apple', 'iphone', 'macbook', 'airpods', 'ipad', 'ios', 'iPhone', 'Apple'],
    'samsung': ['samsung', 'galaxy', 'note', 's24', 'z fold', 'z flip', 'Samsung', 'Galaxy'],
    'tecno': ['tecno', 'phantom', 'camon', 'spark', 'Tecno', 'Phantom', 'Camon'],
    'infinix': ['infinix', 'inf', 'zero', 'hot', 'note', 'Infinix', 'Zero', 'Hot'],
    'xiaomi': ['xiaomi', 'mi', 'redmi', 'poco', 'Xiaomi', 'Redmi', 'Poco'],
};

// ======================================================================
// PRODUCT SEARCH ENGINE - ENHANCED FOR ALL BRANDS (CASE-INSENSITIVE)
// ======================================================================

/**
 * Search ALL products in database based on user query
 * Enhanced: Better brand detection with aliases (CASE-INSENSITIVE)
 */
async function searchAllProducts(env, query, limit = 10) {
  try {
    if (!query || query.length < 2) return [];
   
    const searchTerm = query.toLowerCase().trim();
    console.log('[Product Search] Searching for:', searchTerm);
    
    // ======================================================================
    // FIXED: Check for brand aliases (case-insensitive)
    // ======================================================================
    let brandMatches = [];
    for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
      if (aliases.some(alias => searchTerm.includes(alias.toLowerCase()) || 
                               alias.toLowerCase().includes(searchTerm))) {
        brandMatches.push(brand);
        console.log('[Product Search] Brand match found:', brand);
      }
    }
    
    // Extract keywords
    const searchWords = searchTerm.split(/\s+/);
    let brandSearchTerms = [];
    for (const word of searchWords) {
      for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
        if (aliases.some(alias => word.includes(alias.toLowerCase()) || 
                                 alias.toLowerCase().includes(word))) {
          brandSearchTerms.push(brand);
        }
      }
    }
    
    // ======================================================================
    // FIXED: Detect exact brand match (case-insensitive)
    // ======================================================================
    let exactBrandMatch = '';
    const lowerSearch = searchTerm.toLowerCase();
    
    // Check for brand matches
    if (lowerSearch.includes('itel') || lowerSearch.includes('itell') || lowerSearch.includes('itl')) {
      exactBrandMatch = 'itel';
    } else if (lowerSearch.includes('oraimo') || lowerSearch.includes('oraim') || 
               lowerSearch.includes('ora') || lowerSearch.includes('oraimo')) {
      exactBrandMatch = 'oraimo';
    } else if (lowerSearch.includes('iphone') || lowerSearch.includes('apple') || 
               lowerSearch.includes('macbook') || lowerSearch.includes('airpods')) {
      exactBrandMatch = 'apple';
    } else if (lowerSearch.includes('samsung') || lowerSearch.includes('galaxy') || 
               lowerSearch.includes('note') || lowerSearch.includes('z fold')) {
      exactBrandMatch = 'samsung';
    } else if (lowerSearch.includes('tecno') || lowerSearch.includes('phantom') || 
               lowerSearch.includes('camon') || lowerSearch.includes('spark')) {
      exactBrandMatch = 'tecno';
    } else if (lowerSearch.includes('infinix') || lowerSearch.includes('zero') || 
               lowerSearch.includes('hot') || lowerSearch.includes('note')) {
      exactBrandMatch = 'infinix';
    } else if (lowerSearch.includes('xiaomi') || lowerSearch.includes('redmi') || 
               lowerSearch.includes('poco')) {
      exactBrandMatch = 'xiaomi';
    }
    
    console.log('[Product Search] Exact brand match:', exactBrandMatch);
    
    // ======================================================================
    // FIXED: If we have a brand match, search specifically for it
    // ======================================================================
    if (exactBrandMatch) {
      // Search by brand first
      const brandSql = `
        SELECT
          id,
          name,
          category,
          price,
          stock,
          description,
          brand,
          image_url,
          tags,
          100 as relevance
        FROM products
        WHERE
          active = 1
          AND LOWER(brand) LIKE ?
        UNION ALL
        SELECT
          id,
          name,
          category,
          price,
          stock,
          description,
          brand,
          image_url,
          tags,
          90 as relevance
        FROM products
        WHERE
          active = 1
          AND LOWER(name) LIKE ?
          AND LOWER(brand) NOT LIKE ?
        UNION ALL
        SELECT
          id,
          name,
          category,
          price,
          stock,
          description,
          brand,
          image_url,
          tags,
          80 as relevance
        FROM products
        WHERE
          active = 1
          AND LOWER(description) LIKE ?
          AND LOWER(brand) NOT LIKE ?
          AND LOWER(name) NOT LIKE ?
        ORDER BY relevance DESC
        LIMIT ?
      `;
      
      const brandResult = await env.DB.prepare(brandSql).bind(
        `%${exactBrandMatch}%`,
        `%${searchTerm}%`,
        `%${exactBrandMatch}%`,
        `%${searchTerm}%`,
        `%${exactBrandMatch}%`,
        `%${searchTerm}%`,
        limit
      ).all();
      
      console.log('[Product Search] Brand search results:', brandResult.results?.length || 0);
      
      if (brandResult.results && brandResult.results.length > 0) {
        return brandResult.results;
      }
    }
    
    // ======================================================================
    // FALLBACK: Regular search if no exact brand match
    // ======================================================================
    const sql = `
      SELECT
        id,
        name,
        category,
        price,
        stock,
        description,
        brand,
        image_url,
        tags,
        (CASE
          WHEN LOWER(brand) LIKE ? THEN 100
          WHEN LOWER(name) LIKE ? THEN 10
          WHEN LOWER(brand) LIKE ? THEN 8
          WHEN LOWER(category) LIKE ? THEN 5
          WHEN LOWER(description) LIKE ? THEN 3
          WHEN LOWER(tags) LIKE ? THEN 2
          ELSE 1
        END) as relevance
      FROM products
      WHERE
        active = 1
        AND (
          LOWER(name) LIKE ?
          OR LOWER(brand) LIKE ?
          OR LOWER(category) LIKE ?
          OR LOWER(description) LIKE ?
          OR LOWER(tags) LIKE ?
        )
      ORDER BY relevance DESC
      LIMIT ?
    `;
    
    const result = await env.DB.prepare(sql).bind(
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      limit
    ).all();
    
    console.log('[Product Search] Regular search results:', result.results?.length || 0);
    return result.results || [];
    
  } catch (error) {
    console.error('Product search error:', error);
    return [];
  }
}

/**
 * Get product by ID
 */
async function getProductById(env, productId) {
  try {
    const result = await env.DB.prepare(`
      SELECT id, name, category, price, stock, description, brand, image_url, tags
      FROM products
      WHERE id = ? AND active = 1
    `).bind(productId).first();
   
    return result;
  } catch (error) {
    console.error('Get product error:', error);
    return null;
  }
}

/**
 * Get featured/products by category
 */
async function getProductsByCategory(env, category, limit = 6) {
  try {
    const result = await env.DB.prepare(`
      SELECT id, name, category, price, stock, description, brand, image_url
      FROM products
      WHERE LOWER(category) LIKE ? AND active = 1
      ORDER BY stock DESC, price ASC
      LIMIT ?
    `).bind(`%${category.toLowerCase()}%`, limit).all();
   
    return result.results || [];
  } catch (error) {
    console.error('Category products error:', error);
    return [];
  }
}

/**
 * Check if query is asking about a product
 */
function isProductQuery(query) {
  if (!query) return false;
  const lower = query.toLowerCase();
  const productKeywords = [
    'have', 'stock', 'available', 'price', 'cost', 'buy', 'purchase',
    'get', 'order', 'sell', 'phone', 'laptop', 'gadget', 'device',
    'do you have', 'do you', 'is there', 'got any', 'tell me about',
    'what about', 'how much', 'price of', 'cost of', 'brand', 'model'
  ];
  return productKeywords.some(keyword => lower.includes(keyword));
}

// ======================================================================
// FUZZY SEARCH ENGINE - HANDLES MISSPELLINGS
// ======================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
 
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
 
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function similarityScore(a, b) {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

/**
 * Extract keywords from query (remove common words)
 */
function extractKeywords(query) {
  const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'for', 'of', 'with', 'on', 'at', 'from', 'by', 'in', 'about', 'like', 'do', 'you', 'have', 'got', 'any', 'me', 'tell', 'show', 'price', 'cost', 'much'];
  const words = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  return words.filter(w => w.length > 2 && !stopWords.includes(w));
}

/**
 * Check if a word is a common misspelling pattern
 */
function getCommonMisspellings(word) {
  const misspellings = {
    'iphone': ['iphne', 'iphon', 'iph0ne', 'iph', 'ip'],
    'samsung': ['sumsung', 'samsing', 'samsng', 'samsun', 'sam'],
    'macbook': ['macbook', 'macbok', 'macbk', 'mbp', 'mac'],
    'pro': ['pr0', 'proo', 'pr'],
    'max': ['maxx', 'maks', 'mx'],
    'ultra': ['ultra', 'ultr', 'ult'],
    'galaxy': ['galax', 'galxy', 'gal'],
    'tecno': ['tecnno', 'tecno', 'tec'],
    'itel': ['itell', 'itl', 'it', 'itel mobile', 'ite l'],
    'oraimo': ['oraimo', 'oraim', 'ora', 'orai', 'Oraimo'],
    'phantom': ['phandom', 'fantom', 'phan'],
    'camon': ['camon', 'cam0n', 'cam'],
    'airpods': ['airpod', 'airpods', 'airpodz', 'air'],
    'power': ['power', 'p0wer', 'powr', 'pw'],
    'tank': ['tank', 'tnak', 'tang'],
    'battery': ['battery', 'batery', 'batt'],
    'charger': ['charger', 'chager', 'charg'],
    'cable': ['cable', 'cabl', 'ca ble']
  };
 
  const lower = word.toLowerCase();
  for (const [correct, misspellList] of Object.entries(misspellings)) {
    if (misspellList.some(m => lower === m || lower.includes(m))) {
      return correct;
    }
    for (const misspelling of misspellList) {
      if (levenshteinDistance(lower, misspelling) <= 2) {
        return correct;
      }
    }
  }
  return null;
}

// ======================================================================
// ENHANCED PRODUCT SEARCH WITH FUZZY MATCHING
// ======================================================================

async function searchAllProductsFuzzy(env, query, limit = 10) {
  try {
    if (!query || query.length < 2) return [];
   
    const keywords = extractKeywords(query);
    const correctedKeywords = keywords.map(k => getCommonMisspellings(k) || k);
   
    const allProducts = await env.DB.prepare(`
      SELECT
        id, name, category, price, stock, description, brand, image_url, tags
      FROM products
      WHERE active = 1
    `).all();
   
    const products = allProducts.results || [];
    if (products.length === 0) return [];
   
    const scoredProducts = products.map(product => {
      const name = product.name || '';
      const brand = product.brand || '';
      const category = product.category || '';
      const description = product.description || '';
      const tags = product.tags || '';
     
      let score = 0;
      let matchedKeywords = [];
      let fuzzyMatches = [];
     
      const searchText = (name + ' ' + brand + ' ' + category + ' ' + description + ' ' + tags).toLowerCase();
      const queryLower = query.toLowerCase();
     
      // Brand detection with aliases (case-insensitive)
      for (const [brandName, aliases] of Object.entries(BRAND_ALIASES)) {
        if (aliases.some(alias => queryLower.includes(alias.toLowerCase()))) {
          if (brand.toLowerCase().includes(brandName) || name.toLowerCase().includes(brandName)) {
            score += 25;
            matchedKeywords.push(brandName + '_brand');
          }
        }
      }
     
      if (name.toLowerCase().includes(queryLower)) {
        score += 50;
        matchedKeywords.push('name_exact');
      }
     
      if (brand.toLowerCase().includes(queryLower)) {
        score += 30;
        matchedKeywords.push('brand_exact');
      }
     
      if (category.toLowerCase().includes(queryLower)) {
        score += 20;
        matchedKeywords.push('category_exact');
      }
     
      for (const keyword of correctedKeywords) {
        if (!keyword || keyword.length < 2) continue;
       
        if (searchText.includes(keyword)) {
          score += 15;
          matchedKeywords.push(keyword);
          continue;
        }
       
        const nameWords = name.toLowerCase().split(/\s+/);
        for (const word of nameWords) {
          if (word.length < 3) continue;
          const sim = similarityScore(keyword, word);
          if (sim > 0.7) {
            score += 12 * sim;
            fuzzyMatches.push({ keyword, word, similarity: sim });
            break;
          }
        }
       
        if (brand) {
          const brandWords = brand.toLowerCase().split(/\s+/);
          for (const word of brandWords) {
            if (word.length < 3) continue;
            const sim = similarityScore(keyword, word);
            if (sim > 0.7) {
              score += 10 * sim;
              fuzzyMatches.push({ keyword, word, similarity: sim });
              break;
            }
          }
        }
       
        if (category) {
          const catWords = category.toLowerCase().split(/\s+/);
          for (const word of catWords) {
            if (word.length < 3) continue;
            const sim = similarityScore(keyword, word);
            if (sim > 0.6) {
              score += 8 * sim;
              fuzzyMatches.push({ keyword, word, similarity: sim });
              break;
            }
          }
        }
      }
     
      if (product.stock > 10) score += 5;
     
      return {
        ...product,
        score: Math.round(score * 10) / 10,
        matchedKeywords,
        fuzzyMatches,
        similarity: score > 0 ? Math.min(100, Math.round(score * 100 / 50)) : 0
      };
    });
   
    const filtered = scoredProducts
      .filter(p => p.score > 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
   
    return filtered;
   
  } catch (error) {
    console.error('Fuzzy product search error:', error);
    return [];
  }
}

/**
 * Suggest corrections for misspelled product names
 */
function suggestCorrection(query, products) {
  if (!query || products.length === 0) return null;
 
  const bestMatch = products[0];
  const queryLower = query.toLowerCase();
  const nameLower = bestMatch.name?.toLowerCase() || '';
 
  if (queryLower !== nameLower) {
    const sim = similarityScore(query, bestMatch.name);
    if (sim > 0.6 && sim < 0.95) {
      return {
        original: query,
        suggested: bestMatch.name,
        similarity: Math.round(sim * 100)
      };
    }
  }
 
  return null;
}

// ======================================================================
// ENHANCED PRODUCT RESPONSE FORMATTER
// ======================================================================

function formatProductResponseFuzzy(query, products) {
  if (products.length === 0) {
    const similarWords = extractKeywords(query);
    const suggestions = [];
   
    const commonProducts = [
      'iPhone', 'Samsung Galaxy', 'MacBook', 'Tecno', 'AirPods',
      'Itel', 'Oraimo', 'Infinix', 'Xiaomi',
      'Cement', 'Roofing Sheets', 'Paint', 'Plumbing Pipes', 'Electrical Cables'
    ];
   
    for (const word of similarWords) {
      for (const product of commonProducts) {
        if (similarityScore(word, product.toLowerCase()) > 0.6) {
          suggestions.push(product);
        }
      }
    }
   
    return {
      message: `I couldn't find "${query}" in our inventory.`,
      suggestions: suggestions.length > 0
        ? [`Did you mean: ${[...new Set(suggestions)].join(', ')}?`]
        : ["Would you like to see our popular products?", "Browse all categories", "Contact our sales team"],
      hasProduct: false,
      products: [],
      correction: null
    };
  }
 
  const correction = suggestCorrection(query, products);
 
  if (products.length === 1) {
    const p = products[0];
    const stockStatus = p.stock > 10 ? '✅ In stock' :
                        p.stock > 0 ? '⚠️ Low stock' :
                        '❌ Out of stock';
   
    let message = `✅ **${p.name}** is available!`;
    if (correction) {
      message = `✅ I found **${p.name}** (did you mean **${correction.suggested}**?)\n\n`;
    }
   
    return {
      message: message,
      product: {
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        description: p.description,
        category: p.category,
        brand: p.brand,
        image_url: p.image_url,
        similarity: p.similarity,
        matchScore: p.score
      },
      details: `💰 **Price:** ₦${Number(p.price).toLocaleString()}\n📦 **Stock:** ${stockStatus}\n🏷️ **Category:** ${p.category || 'General'}\n${p.brand ? `🏢 **Brand:** ${p.brand}\n` : ''}${p.description ? `📝 ${p.description}` : ''}`,
      actions: [
        { label: "🛒 Add to Cart", action: "add_to_cart", data: { productId: p.id } },
        { label: "📖 View Details", action: "view_product", data: { productId: p.id } },
        { label: "🔍 See Similar", action: "similar_products", data: { productId: p.id } }
      ],
      hasProduct: true,
      products: [p],
      correction: correction,
      fuzzyMatches: p.fuzzyMatches || []
    };
  }
 
  const productList = products.map((p, i) =>
    `${i+1}. **${p.name}** - ₦${Number(p.price).toLocaleString()} ${p.stock > 0 ? '✅' : '❌'}${p.brand ? ` (${p.brand})` : ''} ${p.similarity > 70 ? '⭐' : ''}`
  ).join('\n');
 
  let message = `🔍 I found **${products.length}** products matching "${query}":\n\n${productList}`;
  if (correction) {
    message = `🔍 I found ${products.length} products. ${correction.suggested ? `Did you mean **${correction.suggested}**?` : ''}\n\n${productList}`;
  }
 
  return {
    message: message,
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      category: p.category,
      brand: p.brand,
      similarity: p.similarity
    })),
    actions: [
      { label: "📋 Show All", action: "show_all_products" },
      { label: "🛒 Add to Cart", action: "add_to_cart", data: { products: products.map(p => p.id) } }
    ],
    hasProduct: true,
    correction: correction
  };
}

// ======================================================================
// BUILDMART CONFIGURATION
// ======================================================================

const BUILD_MART_CATEGORIES = [
  'cement', 'roofing', 'paints', 'plumbing',
  'electrical', 'timber', 'tools', 'hardware',
  'tiles', 'gas-cylinders'
];

const BUILD_MART_KEYWORDS = [
  'cement', 'roofing', 'paint', 'pipe', 'tool', 'timber',
  'hardware', 'tile', 'gas', 'cylinder', 'construction',
  'building', 'material', 'dangote', 'bua', 'lafarge',
  'dulux', 'berger', 'aluzinc', 'armoured', 'plywood',
  'plank', 'post', 'nail', 'screw', 'hinge', 'handle',
  'padlock', 'hasps', 'wheelbarrow', 'shovel', 'rebar',
  'buildmart', 'contractor', 'site', 'foundation'
];

// ======================================================================
// BUILDMART PRODUCT FUNCTIONS
// ======================================================================

async function searchBuildMartProducts(env, query, limit = 6) {
  try {
    if (!query || query.length < 2) return [];
   
    const result = await env.DB.prepare(`
      SELECT id, name, category, price, stock, description, brand, image_url
      FROM products
      WHERE category IN (${BUILD_MART_CATEGORIES.map(() => '?').join(',')})
      AND (name LIKE ? OR description LIKE ? OR brand LIKE ?)
      AND active = 1
      ORDER BY
        CASE WHEN name LIKE ? THEN 0
             WHEN brand LIKE ? THEN 1
             WHEN description LIKE ? THEN 2
             ELSE 3
        END
      LIMIT ?
    `).bind(
      ...BUILD_MART_CATEGORIES,
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
      limit
    ).all();
   
    return result.results || [];
  } catch (error) {
    console.error('BuildMart product search error:', error);
    return [];
  }
}

async function getBuildMartCategories(env) {
  try {
    const result = await env.DB.prepare(`
      SELECT category, COUNT(*) as count
      FROM products
      WHERE category IN (${BUILD_MART_CATEGORIES.map(() => '?').join(',')})
      AND active = 1
      GROUP BY category
      ORDER BY category
    `).bind(...BUILD_MART_CATEGORIES).all();
   
    return result.results || [];
  } catch (error) {
    console.error('BuildMart categories error:', error);
    return [];
  }
}

function isBuildMartQuery(query) {
  if (!query) return false;
  const lower = query.toLowerCase();
  return BUILD_MART_KEYWORDS.some(kw => lower.includes(kw)) ||
         BUILD_MART_CATEGORIES.some(cat => lower.includes(cat));
}

function detectCategories(query) {
  if (!query) return [];
  const lower = query.toLowerCase();
  return BUILD_MART_CATEGORIES.filter(cat => lower.includes(cat));
}

// ======================================================================
// ANALYTICS ENDPOINT
// ======================================================================

export async function handleAnalytics(request, env, corsHeaders) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'GET' && path === '/admin/analytics') {
        try {
            const statsResult = await env.DB.prepare(`
                SELECT
                    COUNT(*) as totalQueries,
                    SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positiveCount,
                    SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negativeCount,
                    SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutralCount,
                    SUM(CASE WHEN urgency = 1 THEN 1 ELSE 0 END) as urgentCount,
                    COUNT(DISTINCT fingerprint) as uniqueUsers,
                    COUNT(DISTINCT session_id) as uniqueSessions,
                    SUM(CASE WHEN intent = 'buildmart_inquiry' THEN 1 ELSE 0 END) as buildmartQueries
                FROM ai_conversations
                WHERE createdAt > strftime('%s', 'now', '-30 days')
            `).all();

            const stats = statsResult.results[0] || {};
            const total = stats.totalQueries || 0;
            const positive = stats.positiveCount || 0;
            const negative = stats.negativeCount || 0;
            const neutral = stats.neutralCount || 0;
            const positivePercentage = total > 0 ? (positive / total) * 100 : 0;
            const buildmartPercentage = total > 0 ? ((stats.buildmartQueries || 0) / total) * 100 : 0;

            const trendResult = await env.DB.prepare(`
                SELECT
                    date(datetime(createdAt, 'unixepoch')) as date,
                    SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
                    SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative,
                    SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral,
                    COUNT(*) as total
                FROM ai_conversations
                WHERE createdAt > strftime('%s', 'now', '-14 days')
                GROUP BY date(datetime(createdAt, 'unixepoch'))
                ORDER BY date ASC
            `).all();

            const usageResult = await env.DB.prepare(`
                SELECT
                    date(datetime(createdAt, 'unixepoch')) as date,
                    COUNT(*) as count
                FROM ai_conversations
                WHERE createdAt > strftime('%s', 'now', '-14 days')
                GROUP BY date(datetime(createdAt, 'unixepoch'))
                ORDER BY date ASC
            `).all();

            const modelResult = await env.DB.prepare(`
                SELECT
                    model,
                    COUNT(*) as count
                FROM ai_conversations
                WHERE model IS NOT NULL AND model != 'unknown'
                GROUP BY model
                ORDER BY count DESC
            `).all();

            const breakdownResult = await env.DB.prepare(`
                SELECT
                    sentiment,
                    COUNT(*) as count
                FROM ai_conversations
                WHERE sentiment IS NOT NULL
                GROUP BY sentiment
                ORDER BY count DESC
            `).all();

            const intentResult = await env.DB.prepare(`
                SELECT
                    intent,
                    COUNT(*) as count
                FROM ai_conversations
                WHERE intent IS NOT NULL
                GROUP BY intent
                ORDER BY count DESC
            `).all();

            const conversationsResult = await env.DB.prepare(`
                SELECT
                    fingerprint,
                    user_id,
                    user_message,
                    assistant_reply,
                    sentiment,
                    urgency,
                    model,
                    intent,
                    datetime(createdAt, 'unixepoch') as created_at
                FROM ai_conversations
                ORDER BY createdAt DESC
                LIMIT 50
            `).all();

            const prevStatsResult = await env.DB.prepare(`
                SELECT
                    COUNT(*) as totalQueries,
                    SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positiveCount,
                    SUM(CASE WHEN urgency = 1 THEN 1 ELSE 0 END) as urgentCount,
                    COUNT(DISTINCT fingerprint) as uniqueUsers
                FROM ai_conversations
                WHERE createdAt BETWEEN strftime('%s', 'now', '-60 days') AND strftime('%s', 'now', '-30 days')
            `).all();

            const prevStats = prevStatsResult.results[0] || {};
            const prevTotal = prevStats.totalQueries || 1;
            const queryChange = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
            const prevPositive = prevStats.positiveCount || 0;
            const prevPositivePct = prevTotal > 0 ? (prevPositive / prevTotal) * 100 : 0;
            const sentimentChange = prevPositivePct > 0 ? positivePercentage - prevPositivePct : 0;
            const prevUrgent = prevStats.urgentCount || 0;
            const urgentChange = prevUrgent > 0 ? ((stats.urgentCount - prevUrgent) / prevUrgent) * 100 : 0;
            const prevUsers = prevStats.uniqueUsers || 0;
            const userChange = prevUsers > 0 ? ((stats.uniqueUsers - prevUsers) / prevUsers) * 100 : 0;

            return new Response(JSON.stringify({
                success: true,
                data: {
                    stats: {
                        totalQueries: total,
                        positivePercentage: positivePercentage,
                        urgentQueries: stats.urgentCount || 0,
                        uniqueUsers: stats.uniqueUsers || 0,
                        uniqueSessions: stats.uniqueSessions || 0,
                        buildmartPercentage: buildmartPercentage,
                        buildmartQueries: stats.buildmartQueries || 0,
                        queryChange: queryChange,
                        sentimentChange: sentimentChange,
                        urgentChange: urgentChange,
                        userChange: userChange
                    },
                    charts: {
                        sentimentTrend: trendResult.results || [],
                        usageTrend: usageResult.results || [],
                        modelDistribution: modelResult.results || [],
                        sentimentBreakdown: breakdownResult.results || [],
                        intentBreakdown: intentResult.results || []
                    },
                    conversations: conversationsResult.results || []
                }
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });

        } catch (error) {
            console.error('Analytics error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }

    if (request.method === 'GET' && path === '/admin/analytics/conversations') {
        try {
            const sentiment = url.searchParams.get('sentiment') || 'all';
            const urgency = url.searchParams.get('urgency') || 'all';
            const intent = url.searchParams.get('intent') || 'all';

            let query = `
                SELECT
                    fingerprint,
                    user_id,
                    user_message,
                    assistant_reply,
                    sentiment,
                    urgency,
                    model,
                    intent,
                    datetime(createdAt, 'unixepoch') as created_at
                FROM ai_conversations
                WHERE 1=1
            `;

            const params = [];
            if (sentiment !== 'all') {
                query += ` AND sentiment = ?`;
                params.push(sentiment);
            }
            if (urgency !== 'all') {
                query += ` AND urgency = ?`;
                params.push(parseInt(urgency));
            }
            if (intent !== 'all') {
                query += ` AND intent = ?`;
                params.push(intent);
            }

            query += ` ORDER BY createdAt DESC LIMIT 50`;

            const result = await env.DB.prepare(query).bind(...params).all();

            return new Response(JSON.stringify({
                success: true,
                conversations: result.results || []
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });

        } catch (error) {
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
}

// ======================================================================
// AI BRAIN ENDPOINT
// ======================================================================

export async function handleBrain(request, env, corsHeaders) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'GET' && path === '/admin/ai-insights') {
        try {
            const statsResult = await env.DB.prepare(`
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
                    SUM(CASE WHEN urgency = 1 THEN 1 ELSE 0 END) as urgent,
                    SUM(CASE WHEN intent = 'buildmart_inquiry' THEN 1 ELSE 0 END) as buildmart,
                    COUNT(DISTINCT fingerprint) as unique_users
                FROM ai_conversations
                WHERE createdAt > strftime('%s', 'now', '-7 days')
            `).all();

            const stats = statsResult.results[0] || {};
            const total = stats.total || 0;
            const positivePercent = total > 0 ? Math.round((stats.positive / total) * 100) : 0;
            const buildmartPercent = total > 0 ? Math.round((stats.buildmart / total) * 100) : 0;

            const categories = await getBuildMartCategories(env);

            const anomalies = await env.DB.prepare(`
                SELECT
                    'ERROR_PATTERN' as type,
                    'Multiple error occurrences detected' as message,
                    'critical' as severity,
                    COUNT(*) as count,
                    'System Logs' as source
                FROM logs
                WHERE level = 'error' AND createdAt > strftime('%s', 'now', '-1 hour')
                HAVING count > 5
                UNION ALL
                SELECT
                    'RAPID_QUERIES' as type,
                    'High query volume detected' as message,
                    'warning' as severity,
                    COUNT(*) as count,
                    'AI Conversations' as source
                FROM ai_conversations
                WHERE createdAt > strftime('%s', 'now', '-30 minutes')
                HAVING count > 20
            `).all();

            const threats = await env.DB.prepare(`
                SELECT                    'SUSPICIOUS_ACTIVITY' as type,
                    'Unusual access pattern detected' as message,
                    'high' as severity,
                    'Security Logs' as source
                FROM security_logs
                WHERE createdAt > strftime('%s', 'now', '-1 hour')
                AND event_type IN ('failed_login', 'suspicious_request')
                LIMIT 5
            `).all();

            const opportunities = await env.DB.prepare(`
                SELECT
                    'REPEAT_QUERY' as type,
                    'Users frequently asking about products' as message,
                    'medium' as potential_value,
                    0.75 as confidence,
                    'Conversation Analysis' as source
                FROM ai_conversations
                WHERE user_message LIKE '%price%' OR user_message LIKE '%buy%'
                AND createdAt > strftime('%s', 'now', '-24 hours')
                GROUP BY fingerprint
                HAVING COUNT(*) > 3
                LIMIT 5
            `).all();

            const recommendations = await env.DB.prepare(`
                SELECT
                    'Improve response time' as action,
                    'high' as priority,
                    'high' as impact,
                    'medium' as effort,
                    'Performance' as category
                WHERE EXISTS (
                    SELECT 1 FROM ai_conversations
                    WHERE urgency = 1 AND createdAt > strftime('%s', 'now', '-24 hours')
                )
                UNION ALL
                SELECT
                    'Enhance product knowledge' as action,
                    'medium' as priority,
                    'high' as impact,
                    'low' as effort,
                    'Knowledge Base' as category
                WHERE EXISTS (
                    SELECT 1 FROM ai_conversations
                    WHERE user_message LIKE '%what is%' OR user_message LIKE '%how to%'
                    AND createdAt > strftime('%s', 'now', '-24 hours')
                )
                UNION ALL
                SELECT
                    'Add more BuildMart product categories' as action,
                    'medium' as priority,
                    'medium' as impact,
                    'medium' as effort,
                    'Catalog' as category
                WHERE EXISTS (
                    SELECT 1 FROM ai_conversations
                    WHERE intent = 'buildmart_inquiry'
                    AND createdAt > strftime('%s', 'now', '-24 hours')
                )
            `).all();

            const insights = {
                aiStats: {
                    total: total,
                    positivePercent: positivePercent,
                    urgent: stats.urgent || 0,
                    buildmartPercent: buildmartPercent,
                    uniqueUsers: stats.unique_users || 0
                },
                buildmart: {
                    categories: categories,
                    totalProducts: categories.reduce((sum, c) => sum + c.count, 0)
                },
                logAnalysis: {
                    anomalies: anomalies.results || [],
                    threats: threats.results || [],
                    opportunities: opportunities.results || [],
                    patterns: {},
                    metrics: {
                        events: {
                            'queries': total,
                            'anomalies': anomalies.results?.length || 0,
                            'threats': threats.results?.length || 0,
                            'opportunities': opportunities.results?.length || 0
                        },
                        timeline: {
                            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                            values: [12, 18, 15, 22, 28, 20, 14]
                        }
                    }
                },
                recommendations: recommendations.results || [],
                timestamp: new Date().toISOString()
            };

            return new Response(JSON.stringify({
                success: true,
                insights: insights
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });

        } catch (error) {
            console.error('AI Insights error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }

    if (request.method === 'POST' && path === '/admin/run-autonomous') {
        try {
            const analysis = await env.DB.prepare(`
                SELECT
                    sentiment,
                    COUNT(*) as count,
                    AVG(CAST(urgency AS INTEGER)) as avg_urgency,
                    intent
                FROM ai_conversations
                WHERE createdAt > strftime('%s', 'now', '-24 hours')
                GROUP BY sentiment, intent
            `).all();

            const recommendations = [
                {
                    action: 'Optimize response templates for common queries',
                    priority: 'high',
                    impact: 'High',
                    effort: 'Medium',
                    category: 'Efficiency'
                },
                {
                    action: 'Update product knowledge base with latest prices',
                    priority: 'high',
                    impact: 'High',
                    effort: 'Low',
                    category: 'Knowledge'
                },
                {
                    action: 'Review urgent conversation patterns for improvement',
                    priority: 'medium',
                    impact: 'Medium',
                    effort: 'Medium',
                    category: 'Support'
                },
                {
                    action: 'Add more BuildMart product categories',
                    priority: 'medium',
                    impact: 'Medium',
                    effort: 'Medium',
                    category: 'Catalog'
                }
            ];

            return new Response(JSON.stringify({
                success: true,
                message: 'Autonomous analysis completed',
                analysis: analysis.results || [],
                recommendations: recommendations,
                timestamp: new Date().toISOString()
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });

        } catch (error) {
            console.error('Autonomous run error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }

    if (request.method === "GET") {
        return new Response(JSON.stringify({
            status: "online",
            message: "AI Brain is ready",
            capabilities: [
                "predict_next_page",
                "analyze_user_behavior",
                "detect_anomalies",
                "recommend_products",
                "conversation_analytics",
                "sentiment_analysis",
                "urgency_detection",
                "buildmart_product_search",
                "product_database_search"
            ]
        }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }
   
    if (request.method === "POST") {
        try {
            const body = await request.json();
            console.log("AI Brain request type:", body ? body.type : 'undefined');

            let response = { nextPage: '/', confidence: 0.5 };
           
            if (body.type === 'product_click' && body.productId) {
                const analysis = analyzeEvent({
                    type: 'product_click',
                    productId: body.productId,
                    userId: body.userId,
                    timestamp: Date.now()
                });
               
                response = {
                    nextPage: '/product-detail.html?id=' + body.productId,
                    confidence: analysis.confidence || 0.8,
                    recommendation: analysis.recommendation || null,
                    predictedIntent: analysis.intent || 'view_product'
                };
            } else if (body.type === 'navigation' && body.target) {
                const analysis = analyzeEvent({
                    type: 'navigation',
                    target: body.target,
                    userId: body.userId,
                    timestamp: Date.now()
                });
               
                response = {
                    nextPage: body.target,
                    confidence: analysis.confidence || 0.7,
                    predictedIntent: analysis.intent || 'navigate'
                };
            } else if (body.type === 'exit_intent') {
                const analysis = analyzeEvent({
                    type: 'exit_intent',
                    userId: body.userId,
                    currentPage: body.path,
                    timestamp: Date.now()
                });
               
                response = {
                    action: analysis.action || 'show_discount_popup',
                    confidence: analysis.confidence || 0.6,
                    offer: analysis.offer || null
                };
            } else if (body.type === 'page_load') {
                const analysis = analyzeEvent({
                    type: 'page_load',
                    path: body.path,
                    userId: body.userId,
                    referrer: body.referrer,
                    timestamp: Date.now()
                });
               
                response = {
                    nextPage: body.path,
                    confidence: 0.9,
                    predictedNextAction: analysis.predictedAction || null
                };
            } else if (body.type === 'search_query') {
                const products = await searchAllProducts(env, body.query);
                const analysis = analyzeEvent({
                    type: 'search_query',
                    query: body.query,
                    userId: body.userId,
                    timestamp: Date.now()
                });
               
                response = {
                    nextPage: '/products.html?search=' + encodeURIComponent(body.query),
                    confidence: analysis.confidence || 0.75,
                    suggestedProducts: analysis.suggestions || [],
                    products: products,
                    productCount: products.length
                };
            } else if (body.type === 'cart_update') {
                const analysis = analyzeEvent({
                    type: 'cart_update',
                    items: body.items,
                    userId: body.userId,
                    timestamp: Date.now()
                });
               
                response = {
                    action: analysis.action || 'show_checkout_prompt',
                    confidence: analysis.confidence || 0.85,
                    upsellProducts: analysis.upsells || []
                };
            } else if (body.type === 'buildmart_search') {
                const products = await searchBuildMartProducts(env, body.query, 6);
                response = {
                    products: products,
                    confidence: 0.9,
                    count: products.length
                };
            } else if (body.type === 'product_inquiry') {
                const products = await searchAllProducts(env, body.query, 5);
                const formatted = formatProductResponseFuzzy(body.query, products);
                response = {
                    products: formatted.products,
                    hasProduct: formatted.hasProduct,
                    message: formatted.message,
                    suggestions: formatted.suggestions || [],
                    actions: formatted.actions || [],
                    confidence: 0.85
                };
            }

            return new Response(JSON.stringify({ success: true, ...response }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (err) {
            console.error('AI Brain error:', err);
            return new Response(JSON.stringify({ success: false, error: err.message }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }
    }
   
    return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders
    });
}

// ======================================================================
// GEMINI AI CHAT HANDLER - COMPLETE FIX WITH PRICES
// ======================================================================

export async function handleAIChat(request, env, ctx, corsHeaders) {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: corsHeaders
        });
    }
   
    try {
        const body = await request.json();
        const messages = body.messages || [];
        const sessionId = body.sessionId || crypto.randomUUID();
        const fingerprint = body.fingerprint || 'unknown';
        const userEmail = body.email || null;
        const context = body.context || {};
       
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const prompt = lastUserMessage ? lastUserMessage.content : body.message;
       
        if (!prompt) {
            return new Response(JSON.stringify({ error: "Message required" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        const isBuildMart = isBuildMartQuery(prompt);
        const isProductInquiry = isProductQuery(prompt);
        
        // ======================================================================
        // FIXED: ALWAYS SEARCH FOR PRODUCTS WHEN MENTIONING A BRAND OR PRODUCT
        // ======================================================================
        const lowerPrompt = prompt.toLowerCase();
        let hasBrandMention = false;
        let detectedBrand = null;
        
        // ======================================================================
        // FIXED: Check for brand mentions (case-insensitive)
        // ======================================================================
        for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
            if (aliases.some(alias => lowerPrompt.includes(alias.toLowerCase()))) {
                hasBrandMention = true;
                detectedBrand = brand;
                console.log('[AI Chat] Detected brand:', brand);
                break;
            }
        }
        
        // ======================================================================
        // FIXED: Explicitly check for Oraimo (common issue)
        // ======================================================================
        if (!detectedBrand && (lowerPrompt.includes('oraimo') || lowerPrompt.includes('ora') || 
            lowerPrompt.includes('power bank') || lowerPrompt.includes('powerbank'))) {
            hasBrandMention = true;
            detectedBrand = 'oraimo';
            console.log('[AI Chat] Explicitly detected Oraimo brand');
        }
        
        // Also check for specific product mentions
        const productKeywords = ['iphone', 'samsung', 'macbook', 'airpods', 'tecno', 'itel', 'oraimo', 'infinix', 'xiaomi'];
        for (const keyword of productKeywords) {
            if (lowerPrompt.includes(keyword)) {
                hasBrandMention = true;
                if (!detectedBrand) {
                    for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
                        if (aliases.some(alias => lowerPrompt.includes(alias.toLowerCase()))) {
                            detectedBrand = brand;
                            console.log('[AI Chat] Detected brand from keyword:', brand);
                            break;
                        }
                    }
                }
                break;
            }
        }
        
        // ======================================================================
        // FIXED: ALWAYS SEARCH FOR PRODUCTS
        // ======================================================================
        let allProducts = [];
        let productResponse = null;
        
        // Search if it's a product inquiry OR mentions a brand OR asks about price
        if (isProductInquiry || hasBrandMention || lowerPrompt.includes('price') || 
            lowerPrompt.includes('cost') || lowerPrompt.includes('how much') ||
            lowerPrompt.includes('have') || lowerPrompt.includes('available') || 
            lowerPrompt.includes('stock')) {
            
            console.log('[AI Chat] Searching for products...');
            allProducts = await searchAllProducts(env, prompt, 10);
            console.log('[AI Chat] Found products:', allProducts.length);
           
            if (allProducts.length > 0) {
                productResponse = formatProductResponseFuzzy(prompt, allProducts);
                console.log('[AI Chat] First product price:', allProducts[0].price);
            }
        }
       
        let buildMartProducts = [];
        if (isBuildMart) {
            buildMartProducts = await searchBuildMartProducts(env, prompt, 6);
           
            if (buildMartProducts.length > 0 && allProducts.length === 0) {
                allProducts = buildMartProducts;
                productResponse = formatProductResponseFuzzy(prompt, buildMartProducts);
            }
        }

        const eventAnalysis = analyzeEvent({
            type: 'chat_message',
            message: prompt,
            sessionId: sessionId,
            userId: body.userId,
            fingerprint: fingerprint,
            timestamp: Date.now()
        });

        let conversationContext = "";
        const recentMessages = messages.slice(-10);
        for (const msg of recentMessages) {
            if (msg.role === 'user') {
                conversationContext += "Customer: " + msg.content + "\n";
            } else if (msg.role === 'assistant') {
                conversationContext += "Assistant: " + msg.content + "\n";
            }
        }

        // ======================================================================
        // GET ACTUAL BRANDS FROM DATABASE
        // ======================================================================
        const brandsResult = await env.DB.prepare(`
            SELECT DISTINCT LOWER(brand) as brand FROM products WHERE active = 1 AND brand IS NOT NULL AND brand != ''
        `).all();
        
        const brandsInDb = (brandsResult.results || []).map(r => r.brand);
        console.log('[AI Chat] Brands in DB:', brandsInDb);

        // ======================================================================
        // DETECT IF BRANDS ARE IN DATABASE
        // ======================================================================
        const hasOraimoInDb = brandsInDb.some(b => b.includes('oraimo'));
        const hasItelInDb = brandsInDb.some(b => b.includes('itel'));
        const hasAppleInDb = brandsInDb.some(b => b.includes('apple') || b.includes('iphone'));
        const hasSamsungInDb = brandsInDb.some(b => b.includes('samsung'));
        const hasTecnoInDb = brandsInDb.some(b => b.includes('tecno'));
        const hasInfinixInDb = brandsInDb.some(b => b.includes('infinix'));
        const hasXiaomiInDb = brandsInDb.some(b => b.includes('xiaomi'));

        // Build the authoritative system prompt
        let systemPrompt = "You are PrimeShieldAI, the official AI assistant for PrimeShieldHub.\n\n" +
            "COMPANY INFO:\n" +
            "- Name: PrimeShieldHub Gadgets Limited\n" +
            "- Founded: 2026 by Freedom Evbakoe Amenaghawon (Founder & CEO)\n" +
            "- Registration: RC 9283954 (CAC Nigeria), TIN: 2621297539968\n" +
            "- Location: Benin City, Edo State, Nigeria\n" +
            "- Email: ceo@primeshieldhub.com\n" +
            "- WhatsApp: +2348103535978 (24/7 support)\n\n";

        // ======================================================================
        // BRAND AVAILABILITY - ONLY CLAIM WHAT'S IN DATABASE
        // ======================================================================
        if (isBuildMart) {
            systemPrompt += "🏗️ BUILDMART DIVISION - CONSTRUCTION MATERIALS:\n\n" +
                "CATEGORIES AVAILABLE:\n" +
                "- Cement (Dangote, BUA, Lafarge)\n" +
                "- Roofing (Aluzinc, Stone Coated)\n" +
                "- Paints (Dulux Emulsion, Berger Gloss, Dulux Satin)\n" +
                "- Plumbing (PVC pipes, fittings)\n" +
                "- Electrical (Armoured cables, distribution boards)\n" +
                "- Timber (Planks, plywood, posts)\n" +
                "- Tools (DeWalt, Bosch, Makita, Milwaukee, Ingco)\n" +
                "- Hardware (Hinges, handles, padlocks, nails, screws)\n" +
                "- Tiles (Ceramic, porcelain)\n" +
                "- Gas Cylinders (6kg, 12.5kg)\n\n";
        } else {
            systemPrompt += "📱 GADGETS DIVISION - ELECTRONICS:\n\n" +
                "We sell 100% authentic gadgets and accessories.\n\n" +
                "BRANDS & PRODUCTS AVAILABLE:\n";

            if (hasAppleInDb) {
                systemPrompt += "- Apple: iPhones (15 series, 14 series), MacBooks, AirPods Pro 2\n";
            }
            if (hasSamsungInDb) {
                systemPrompt += "- Samsung: S24 Ultra, S24+, S24, Z Fold, Z Flip\n";
            }
            if (hasTecnoInDb) {
                systemPrompt += "- Tecno: Phantom V Fold 2, Camon 50 Premier\n";
            }
            if (hasItelInDb) {
                systemPrompt += "- Itel: A70, S23, P40, A60, S24\n";
            }
            if (hasOraimoInDb) {
                systemPrompt += "- Oraimo: FreePods 3, PowerBanks, SmartWatches, Speakers\n";
            }
            if (hasInfinixInDb) {
                systemPrompt += "- Infinix: Zero Ultra, Hot 50, Note 40\n";
            }
            if (hasXiaomiInDb) {
                systemPrompt += "- Xiaomi: Redmi Note 13, Poco X6\n";
            }
            
            systemPrompt += "\n- Accessories: Chargers, cases, screen protectors\n\n";
            
            systemPrompt += "⚠️ IMPORTANT - PRODUCTS NOT AVAILABLE:\n";
            systemPrompt += "- iPhone 16: NOT AVAILABLE (we have up to 15 series)\n";
            if (!hasOraimoInDb) {
                systemPrompt += "- Oraimo products: NOT AVAILABLE in our current inventory\n";
            }
            if (!hasItelInDb) {
                systemPrompt += "- Itel products: NOT AVAILABLE in our current inventory\n";
            }
            systemPrompt += "\n";

            systemPrompt += "SERVICES:\n" +
                "- Nationwide delivery (1-5 business days)\n" +
                "- Free shipping on orders over ₦500,000\n" +
                "- Reseller program: up to 25% discount\n" +
                "- Payment: Bank transfer, Card, Crypto (BTC/ETH/USDT), Cash on Delivery\n\n";
        }

        // ======================================================================
        // FIXED: ALWAYS ADD PRODUCT DETAILS WITH PRICES
        // ======================================================================
        if (allProducts.length > 0) {
            systemPrompt += "🔍 EXACT PRODUCTS IN OUR INVENTORY WITH PRICES:\n\n";
            
            allProducts.forEach((p, index) => {
                const stockStatus = p.stock > 10 ? '✅ In stock' : 
                                   p.stock > 0 ? `⚠️ Only ${p.stock} left` : 
                                   '❌ Out of stock';
                
                systemPrompt += `${index + 1}. **${p.name}**\n`;
                systemPrompt += `   - 💰 EXACT PRICE: ₦${Number(p.price).toLocaleString()}\n`;
                systemPrompt += `   - 📦 Stock: ${stockStatus}\n`;
                systemPrompt += `   - 🏷️ Category: ${p.category || 'General'}\n`;
                if (p.brand) systemPrompt += `   - 🏢 Brand: ${p.brand}\n`;
                if (p.description) systemPrompt += `   - 📝 Description: ${p.description}\n`;
                systemPrompt += `   - 📊 Relevance: ${Math.round(p.relevance || p.similarity || 0)}%\n\n`;
            });
            
            systemPrompt += 
                "⚠️ CRITICAL INSTRUCTION FOR PRICES:\n" +
                "1. When the customer asks for a price, you MUST give the EXACT price from the list above\n" +
                "2. DO NOT say 'I don't have the exact pricing' - you DO have the prices above\n" +
                "3. Format prices as ₦1,265,000 (with commas)\n" +
                "4. Tell them the stock availability\n" +
                "5. Offer to help them purchase or connect with support\n" +
                "6. If they ask 'how much', respond with the price IMMEDIATELY\n\n";
                
        } else {
            systemPrompt += "🔍 No products found in our inventory matching your query.\n" +
                "Be honest: tell them we don't have that product in stock.\n" +
                "Offer to connect them with support for alternatives.\n\n";
        }

        systemPrompt +=
            "CUSTOMER INTENT: " + (isBuildMart ? 'buildmart_inquiry' : (isProductInquiry ? 'product_inquiry' : (eventAnalysis.intent || 'general_inquiry'))) + "\n" +
            "SENTIMENT: " + (eventAnalysis.sentiment || 'neutral') + "\n" +
            "URGENCY: " + (eventAnalysis.urgency || 'low') + "\n" +
            "CONVERSATION HISTORY:\n" + conversationContext + "\n" +
            "Be helpful, friendly, and concise. Use Nigerian Naira (₦) for prices.\n" +
            "If the customer asks 'how much' or 'price', give the price immediately from the products listed above.\n" +
            "If a product is not available, clearly state that and suggest alternatives or connect with support.\n" +
            "NEVER say 'I don't have the exact pricing' if you have the product details above.\n\n" +
            "Customer: " + prompt + "\n" +
            "Assistant:";

        // ======================================================================
        // DEBUG: Log what's being sent to Gemini
        // ======================================================================
        console.log('[AI Chat] Products in prompt:', allProducts.length);
        if (allProducts.length > 0) {
            console.log('[AI Chat] First product name:', allProducts[0].name);
            console.log('[AI Chat] First product price:', allProducts[0].price);
        }

        const geminiResponse = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + env.GEMINI_API_KEY,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemPrompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 600, topP: 0.9 }
                })
            }
        );

        let reply;
        let model = "gemini-2.5-flash";

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('Gemini API Error:', geminiResponse.status, errorText);
           
            let fallbackReply = "";
           
            if (allProducts.length > 0) {
                const productList = allProducts.map(p => 
                    `- ${p.name}: ₦${Number(p.price).toLocaleString()} (${p.stock > 0 ? 'In stock' : 'Out of stock'})`
                ).join('\n');
                fallbackReply = `Here are the products I found with prices:\n\n${productList}\n\nFor more details, please contact our support team on WhatsApp (+2348103535978).`;
            } else if (isBuildMart && buildMartProducts.length > 0) {
                fallbackReply = "🏗️ Here are the construction materials I found:\n\n" +
                    buildMartProducts.map(p => `- ${p.name}: ₦${p.price} (${p.stock > 0 ? p.stock + ' in stock' : 'out of stock'})`).join('\n') +
                    "\n\nFor more details, please contact our support team on WhatsApp (+2348103535978).";
            } else if (isBuildMart) {
                fallbackReply = "I can help you find construction materials! We have categories like Cement, Roofing, Paints, Plumbing, Electrical, Timber, Tools, Hardware, Tiles, and Gas Cylinders.\n\nPlease contact our support team on WhatsApp (+2348103535978) for specific product inquiries.";
            } else {
                fallbackReply = "Thank you for your message! Please contact our support team on WhatsApp (+2348103535978) for immediate assistance with products, pricing, or orders. Is there something specific I can help you find?";
            }
           
            reply = fallbackReply;
            model = "fallback";
           
            return new Response(JSON.stringify({
                success: true,
                reply: reply,
                products: allProducts,
                model: model,
                sessionId: sessionId,
                fingerprint: fingerprint,
                hasProduct: allProducts.length > 0,
                analytics: {
                    intent: isBuildMart ? 'buildmart_inquiry' : (isProductInquiry ? 'product_inquiry' : (eventAnalysis.intent || 'unknown')),
                    sentiment: eventAnalysis.sentiment || 'neutral',
                    urgency: eventAnalysis.urgency || false,
                    isBuildMart: isBuildMart,
                    productCount: allProducts.length
                }
            }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        const data = await geminiResponse.json();
        reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ||
                (isBuildMart ?
                    "I appreciate your inquiry about construction materials! Please contact our support team on WhatsApp (+2348103535978) for immediate assistance." :
                    "Thank you for your message! For assistance with products or orders, please contact our support team on WhatsApp (+2348103535978).");

        const sentiment = eventAnalysis.sentiment || 'neutral';
        const urgency = eventAnalysis.urgency === 'high' ? 1 : 0;
        const intent = isBuildMart ? 'buildmart_inquiry' : (isProductInquiry ? 'product_inquiry' : (eventAnalysis.intent || 'general'));

        ctx.waitUntil(
            env.DB.prepare(
                `INSERT INTO ai_conversations
                 (session_id, fingerprint, user_message, assistant_reply, sentiment, urgency, model, intent, user_id, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`
            ).bind(
                sessionId,
                fingerprint,
                prompt.slice(0, 500),
                reply.slice(0, 500),
                sentiment,
                urgency,
                model,
                intent,
                body.userId || null
            ).run().catch(e => console.error('Log error:', e))
        );

        if (eventAnalysis.urgency === 'high' || eventAnalysis.requiresAction) {
            ctx.waitUntil(
                fetch(new URL('/api/brain', request.url), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'escalation',
                        sessionId: sessionId,
                        intent: intent,
                        message: prompt.slice(0, 200),
                        analysis: eventAnalysis,
                        fingerprint: fingerprint,
                        isBuildMart: isBuildMart,
                        productCount: allProducts.length
                    })
                }).catch(e => console.error('Escalation error:', e))
            );
        }

        return new Response(JSON.stringify({
            success: true,
            reply: reply,
            products: allProducts,
            model: model,
            sessionId: sessionId,
            fingerprint: fingerprint,
            hasProduct: allProducts.length > 0,
            analytics: {
                intent: intent,
                sentiment: sentiment,
                urgency: eventAnalysis.urgency || false,
                isBuildMart: isBuildMart,
                productCount: allProducts.length,
                confidence: eventAnalysis.confidence || 0.7
            }
        }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
       
    } catch (error) {
        console.error('AI Chat Error:', error);
       
        const errorAnalysis = analyzeEvent({
            type: 'error',
            error: error.message,
            context: 'ai_chat',
            timestamp: Date.now()
        });
       
        return new Response(JSON.stringify({
            success: true,
            reply: "Thank you for reaching out! Please contact our support team on WhatsApp (+2348103535978) for immediate assistance with products, orders, or any inquiries. We're here to help 24/7!",
            fallback: true,
            analytics: errorAnalysis
        }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }
}

// ======================================================================
// AI ANALYTICS LOGGING ENDPOINT
// ======================================================================

export async function handleAIAnalytics(request, env, corsHeaders) {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: corsHeaders
        });
    }
   
    try {
        const body = await request.json();
       
        const analysis = analyzeEvent({
            type: body.type || 'analytics_event',
            ...body,
            timestamp: Date.now()
        });
       
        if (env.DB) {
            await env.DB.prepare(
                `INSERT INTO ai_analytics (event_type, event_data, analysis, createdAt)
                 VALUES (?, ?, ?, unixepoch())`
            ).bind(
                body.type || 'unknown',
                JSON.stringify(body),
                JSON.stringify(analysis)
            ).run().catch(e => console.error('Analytics storage error:', e));
        }
       
        return new Response(JSON.stringify({
            success: true,
            analysis: analysis
        }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
       
    } catch (error) {
        console.error('AI Analytics error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }
}

// ======================================================================
// EXPOSE FUNCTIONS
// ======================================================================

export const BuildMart = {
    searchProducts: searchBuildMartProducts,
    getCategories: getBuildMartCategories,
    isBuildMartQuery: isBuildMartQuery,
    detectCategories: detectCategories,
    categories: BUILD_MART_CATEGORIES,
    keywords: BUILD_MART_KEYWORDS
};

export const ProductEngine = {
    searchAll: searchAllProductsFuzzy,
    getById: getProductById,
    getByCategory: getProductsByCategory,
    isProductQuery: isProductQuery,
    formatResponse: formatProductResponseFuzzy
};
