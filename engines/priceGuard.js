// ================================================================
// engines/priceGuard.js
// PRIME IMPORT LOSS PROTECTION ENGINE
// Cloudflare Workers + D1 Version
// ================================================================

/**
 * Price Guard Engine - Protects against loss-making products
 * Uses D1 database for configuration and product evaluation
 */

// ================================================================
// CONFIGURATION
// ================================================================

const DEFAULT_CONFIG = {
  minRetailMargin: 15,      // Minimum retail margin % (15%)
  minWholesaleMargin: 8,    // Minimum wholesale margin % (8%)
  highProfitThreshold: 40,  // High-profit threshold % (40%)
  lossProtectionEnabled: true,
  autoBlockLoss: true
};

const CONFIG_CACHE_TTL = 300; // 5 minutes cache

// ================================================================
// D1 DATABASE HELPERS
// ================================================================

/**
 * Get protection config from D1 database
 * @param {D1Database} db - Cloudflare D1 database binding
 * @param {Object} env - Environment variables
 * @returns {Promise<Object>} Protection configuration
 */
async function getProtectionConfig(db, env) {
  try {
    // Try to get config from database
    const result = await db
      .prepare('SELECT * FROM settings WHERE key = ?')
      .bind('protection_config')
      .first();

    if (result && result.value) {
      try {
        const config = JSON.parse(result.value);
        return {
          ...DEFAULT_CONFIG,
          ...config,
          _fromCache: false,
          _timestamp: result.updated_at || Date.now()
        };
      } catch (parseError) {
        console.warn('Failed to parse protection config, using defaults:', parseError);
      }
    }
  } catch (dbError) {
    console.warn('Failed to fetch protection config from D1:', dbError);
  }

  // Fallback to defaults
  return {
    ...DEFAULT_CONFIG,
    _fromCache: false,
    _timestamp: Date.now()
  };
}

/**
 * Save protection config to D1 database
 * @param {D1Database} db - Cloudflare D1 database binding
 * @param {Object} config - Configuration to save
 * @returns {Promise<boolean>} Success status
 */
async function saveProtectionConfig(db, config) {
  try {
    const value = JSON.stringify(config);
    const now = new Date().toISOString();

    // UPSERT: Update if exists, insert if not
    const result = await db
      .prepare(`
        INSERT INTO settings (key, value, updated_at) 
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET 
          value = excluded.value,
          updated_at = excluded.updated_at
      `)
      .bind('protection_config', value, now)
      .run();

    return result.success;
  } catch (error) {
    console.error('Failed to save protection config:', error);
    return false;
  }
}

// ================================================================
// CACHE HELPERS
// ================================================================

let configCache = null;
let cacheTimestamp = 0;

/**
 * Get cached config or fetch from database
 * @param {D1Database} db - Cloudflare D1 database binding
 * @param {Object} env - Environment variables
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Promise<Object>} Protection configuration
 */
async function getCachedConfig(db, env, forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && configCache && (now - cacheTimestamp) < CONFIG_CACHE_TTL * 1000) {
    return configCache;
  }

  configCache = await getProtectionConfig(db, env);
  cacheTimestamp = now;
  return configCache;
}

// ================================================================
// PRODUCT EVALUATION ENGINE
// ================================================================

/**
 * Evaluates a product BEFORE upload/import
 * Prevents bad supplier pricing & low-profit items
 * 
 * @param {Object} product - Product data to evaluate
 * @param {number} product.landedCost - Cost of product including shipping, duties, etc.
 * @param {number} product.price - Retail price
 * @param {number} product.priceWholesale - Wholesale price (optional)
 * @param {string} product.category - Product category (optional)
 * @param {string} product.supplier - Supplier name (optional)
 * @param {D1Database} db - Cloudflare D1 database binding
 * @param {Object} env - Environment variables
 * @returns {Promise<Object>} Evaluation result
 */
async function evaluateProduct(product, db, env) {
  // Validate input
  if (!product || typeof product !== 'object') {
    return {
      status: 'error',
      error: 'Invalid product data',
      warnings: ['Product data is missing or invalid']
    };
  }

  const landed = parseFloat(product.landedCost);
  const retail = parseFloat(product.price);
  const wholesale = product.priceWholesale ? parseFloat(product.priceWholesale) : null;

  // Validate required fields
  if (isNaN(landed) || landed <= 0) {
    return {
      status: 'error',
      error: 'Invalid landed cost',
      warnings: ['Landed cost must be a positive number']
    };
  }

  if (isNaN(retail) || retail <= 0) {
    return {
      status: 'error',
      error: 'Invalid retail price',
      warnings: ['Retail price must be a positive number']
    };
  }

  try {
    // Get configuration
    const config = await getCachedConfig(db, env);

    // Calculate margins
    const retailProfit = retail - landed;
    const wholesaleProfit = wholesale !== null ? wholesale - landed : null;

    const retailMargin = landed > 0 ? (retailProfit / landed) * 100 : 0;
    const wholesaleMargin = (wholesale !== null && landed > 0) ? (wholesaleProfit / landed) * 100 : null;

    let status = 'approved';
    let warnings = [];
    let details = {};

    // ===== LOSS DETECTION =====
    if (config.lossProtectionEnabled) {
      // Check retail loss
      if (retail <= landed) {
        status = config.autoBlockLoss ? 'blocked' : 'warning';
        warnings.push(`Retail price (₦${retail.toLocaleString()}) is below landed cost (₦${landed.toLocaleString()})`);
        details.retailBelowCost = true;
      }

      // Check wholesale loss (if provided)
      if (wholesale !== null && wholesale <= landed) {
        status = config.autoBlockLoss ? 'blocked' : 'warning';
        warnings.push(`Wholesale price (₦${wholesale.toLocaleString()}) is below landed cost (₦${landed.toLocaleString()})`);
        details.wholesaleBelowCost = true;
      }
    }

    // ===== LOW PROFIT WARNINGS =====
    if (retailMargin < config.minRetailMargin && status !== 'blocked') {
      status = 'warning';
      warnings.push(`Retail margin (${Math.round(retailMargin)}%) is below minimum (${config.minRetailMargin}%)`);
      details.retailMarginLow = true;
    }

    if (wholesale !== null && wholesaleMargin !== null) {
      if (wholesaleMargin < config.minWholesaleMargin && status !== 'blocked') {
        status = 'warning';
        warnings.push(`Wholesale margin (${Math.round(wholesaleMargin)}%) is below minimum (${config.minWholesaleMargin}%)`);
        details.wholesaleMarginLow = true;
      }
    }

    // ===== HIGH PROFIT FLAG =====
    if (retailMargin > config.highProfitThreshold) {
      warnings.push(`⭐ High-profit product! Retail margin: ${Math.round(retailMargin)}%`);
      details.highProfit = true;
    }

    // ===== RECOMMENDED PRICING =====
    const recommendedRetail = landed * (1 + (config.minRetailMargin / 100));
    const recommendedWholesale = wholesale !== null ? landed * (1 + (config.minWholesaleMargin / 100)) : null;

    // ===== BUILD RESULT =====
    return {
      status,
      approved: status === 'approved',
      blocked: status === 'blocked',
      warning: status === 'warning',
      
      // Margin data
      retailMargin: Math.round(retailMargin),
      wholesaleMargin: wholesaleMargin !== null ? Math.round(wholesaleMargin) : null,
      
      // Profit data
      retailProfit: Math.round(retailProfit),
      wholesaleProfit: wholesaleProfit !== null ? Math.round(wholesaleProfit) : null,
      
      // Recommended prices
      recommendedRetail: Math.round(recommendedRetail),
      recommendedWholesale: recommendedWholesale !== null ? Math.round(recommendedWholesale) : null,
      
      // Additional details
      details,
      warnings,
      
      // Input data
      product: {
        landedCost: landed,
        retailPrice: retail,
        wholesalePrice: wholesale,
        category: product.category || null,
        supplier: product.supplier || null
      },
      
      // Config used
      config: {
        minRetailMargin: config.minRetailMargin,
        minWholesaleMargin: config.minWholesaleMargin,
        highProfitThreshold: config.highProfitThreshold,
        lossProtectionEnabled: config.lossProtectionEnabled,
        autoBlockLoss: config.autoBlockLoss
      },
      
      // Timestamp
      evaluatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error evaluating product:', error);
    return {
      status: 'error',
      error: error.message || 'Evaluation failed',
      warnings: ['Error during product evaluation']
    };
  }
}

// ================================================================
// BULK EVALUATION
// ================================================================

/**
 * Evaluates multiple products in bulk
 * @param {Array<Object>} products - Array of product objects
 * @param {D1Database} db - Cloudflare D1 database binding
 * @param {Object} env - Environment variables
 * @returns {Promise<Object>} Bulk evaluation results
 */
async function evaluateProductsBulk(products, db, env) {
  if (!products || !Array.isArray(products) || products.length === 0) {
    return {
      success: false,
      error: 'No products provided',
      results: []
    };
  }

  const results = [];
  let approved = 0;
  let blocked = 0;
  let warnings = 0;
  let errors = 0;

  for (const product of products) {
    try {
      const result = await evaluateProduct(product, db, env);
      results.push(result);
      
      if (result.status === 'approved') approved++;
      else if (result.status === 'blocked') blocked++;
      else if (result.status === 'warning') warnings++;
      else errors++;
    } catch (error) {
      results.push({
        status: 'error',
        error: error.message || 'Evaluation failed',
        product: product
      });
      errors++;
    }
  }

  return {
    success: true,
    summary: {
      total: products.length,
      approved,
      blocked,
      warnings,
      errors
    },
    results
  };
}

// ================================================================
// ANALYTICS FUNCTIONS
// ================================================================

/**
 * Get product margin analytics
 * @param {D1Database} db - Cloudflare D1 database binding
 * @param {Object} env - Environment variables
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} Analytics data
 */
async function getMarginAnalytics(db, env, filters = {}) {
  try {
    // Build query
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.supplier) {
      query += ' AND supplier = ?';
      params.push(filters.supplier);
    }

    if (filters.minPrice) {
      query += ' AND price >= ?';
      params.push(filters.minPrice);
    }

    if (filters.maxPrice) {
      query += ' AND price <= ?';
      params.push(filters.maxPrice);
    }

    // Get products
    const result = await db
      .prepare(query)
      .bind(...params)
      .all();

    const products = result.results || [];

    // Calculate analytics
    let totalRetailMargin = 0;
    let totalWholesaleMargin = 0;
    let count = 0;
    let lossProducts = 0;
    let lowMarginProducts = 0;

    for (const product of products) {
      const landed = product.landed_cost || 0;
      const retail = product.price || 0;
      const wholesale = product.price_wholesale || 0;

      if (landed > 0) {
        const retailMargin = ((retail - landed) / landed) * 100;
        totalRetailMargin += retailMargin;
        
        if (retail <= landed) lossProducts++;
        if (retailMargin < 15) lowMarginProducts++;
        count++;
      }

      if (landed > 0 && wholesale > 0) {
        const wholesaleMargin = ((wholesale - landed) / landed) * 100;
        totalWholesaleMargin += wholesaleMargin;
      }
    }

    return {
      success: true,
      totalProducts: count,
      averageRetailMargin: count > 0 ? Math.round(totalRetailMargin / count) : 0,
      averageWholesaleMargin: count > 0 ? Math.round(totalWholesaleMargin / count) : 0,
      lossProducts,
      lowMarginProducts,
      healthyMarginProducts: count - lossProducts - lowMarginProducts,
      products
    };

  } catch (error) {
    console.error('Failed to get margin analytics:', error);
    return {
      success: false,
      error: error.message || 'Failed to get analytics'
    };
  }
}

// ================================================================
// EXPORTS - Cloudflare Worker compatible
// ================================================================

module.exports = {
  // Core evaluation
  evaluateProduct,
  evaluateProductsBulk,
  
  // Config management
  getProtectionConfig,
  saveProtectionConfig,
  getCachedConfig,
  
  // Analytics
  getMarginAnalytics,
  
  // Constants
  DEFAULT_CONFIG,
  CONFIG_CACHE_TTL
};
