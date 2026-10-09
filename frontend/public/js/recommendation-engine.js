// ============================================================================
// recommendation-engine.js — Smart Product Recommendations
// Now integrated with website-knowledge.js for reliable data
// Falls back gracefully when ML/AI is unavailable
// ============================================================================

import { websiteKnowledge } from './website-knowledge.js';

// Try to import ML recommendation engine (may fail gracefully)
let getRecommendationsML = null;
let rankProductsML = null;
try {
  const recModule = await import('./sophisticated/fraud-engine/recommendation.js');
  getRecommendationsML = recModule.getRecommendationsML;
  rankProductsML = recModule.rankProductsML;
} catch (e) {
  console.warn('ML recommendation engine not available, using smart fallback');
}

// ==================== USER PROFILE ====================
function getUserProfile() {
  return {
    // From quantum state (if available)
    viewed: window.quantum?.state?.recentlyViewed || [],
    cart: window.quantum?.state?.cart || [],
    // From cart manager (if available)
    cartItems: window.cart?.getItems?.() || [],
    // From localStorage
    recentlyViewedRaw: JSON.parse(localStorage.getItem('recentlyViewed') || '[]'),
    // User preferences
    preferredCategory: localStorage.getItem('preferredCategory') || null
  };
}

// ==================== SMART FALLBACK ====================
function fallbackRecommendations(currentProduct, allProducts, userProfile) {
  // Get all available products from knowledge base if none provided
  if (!allProducts || allProducts.length === 0) {
    allProducts = websiteKnowledge.products.list.filter(p => p.inStock);
  }

  // Extract categories from user behavior
  const viewedCategories = [
    ...(userProfile.viewed || []).map(p => p.category).filter(Boolean),
    ...(userProfile.recentlyViewedRaw || []).map(p => p.category).filter(Boolean)
  ];
  const cartCategories = [
    ...(userProfile.cart || []).map(p => p.category).filter(Boolean),
    ...(userProfile.cartItems || []).map(p => p.category).filter(Boolean)
  ];
  const relevantCategories = [...new Set([...viewedCategories, ...cartCategories])];

  // Filter: same category as current product, or relevant to user
  let filtered = allProducts.filter(p => {
    // Skip the current product
    if (currentProduct && p.id === currentProduct.id) return false;
    // Skip out-of-stock
    if (p.inStock === false) return false;
    // Match by category
    if (currentProduct && p.category === currentProduct.category) return true;
    if (relevantCategories.includes(p.category)) return true;
    return false;
  });

  // If too few results, broaden to all in-stock
  if (filtered.length < 4) {
    filtered = allProducts.filter(p => {
      if (currentProduct && p.id === currentProduct.id) return false;
      return p.inStock !== false;
    });
  }

  // Score and sort: prioritize high-value items that complement the current product
  return filtered
    .map(p => {
      let score = 0;
      // Higher price = higher commission potential (for reseller recommendations)
      const priceValue = typeof p.price === 'string' 
        ? parseInt(p.price.replace(/[^0-9]/g, '')) 
        : p.price;
      score += Math.log10(priceValue || 100000) * 2;
      // Same brand bonus
      if (currentProduct && p.brand === currentProduct.brand) score += 5;
      // Same category bonus
      if (currentProduct && p.category === currentProduct.category) score += 3;
      // Complementary categories
      if (currentProduct?.category === 'Smartphones' && p.category === 'Accessories') score += 4;
      if (currentProduct?.category === 'Smartphones' && p.category === 'Audio Devices') score += 4;
      if (currentProduct?.category === 'Laptops' && p.category === 'Accessories') score += 4;
      // Add some randomness to vary recommendations
      score += Math.random() * 2;
      return { ...p, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, 4)
    .map(({ _score, ...p }) => p); // Remove internal score
}

// ==================== MAIN RECOMMENDATION FUNCTION ====================
/**
 * Get product recommendations based on current product and user profile
 * @param {Object} currentProduct - The product being viewed
 * @param {Array} allProducts - Full product list (falls back to knowledge base)
 * @returns {Promise<Array>} - Top 4 recommended products
 */
export async function getRecommendations(currentProduct, allProducts = null) {
  const userProfile = getUserProfile();

  try {
    if (getRecommendationsML) {
      const mlResults = await getRecommendationsML(currentProduct, allProducts, userProfile);
      if (mlResults && mlResults.length > 0) return mlResults;
    }
  } catch (err) {
    console.warn('ML recommendations failed, using fallback:', err.message);
  }

  return fallbackRecommendations(currentProduct, allProducts, userProfile);
}

// ==================== PRODUCT RANKING ====================
/**
 * Rank products by relevance/popularity
 * @param {Array} products - Products to rank
 * @returns {Promise<Array>} - Ranked products
 */
export async function rankProducts(products) {
  try {
    if (rankProductsML) {
      const ranked = await rankProductsML(products);
      if (ranked && ranked.length > 0) return ranked;
    }
  } catch (err) {
    console.warn('ML ranking failed, using fallback:', err.message);
  }

  // Smart fallback ranking
  return [...products].sort((a, b) => {
    const priceA = typeof a.price === 'string' ? parseInt(a.price.replace(/[^0-9]/g, '')) : (a.price || 0);
    const priceB = typeof b.price === 'string' ? parseInt(b.price.replace(/[^0-9]/g, '')) : (b.price || 0);
    
    // In-stock first
    if (a.inStock && !b.inStock) return -1;
    if (!a.inStock && b.inStock) return 1;
    
    // Higher price = featured first (premium items)
    return priceB - priceA;
  });
}

// ==================== QUICK RECOMMENDATIONS ====================
/**
 * Get quick recommendations without needing a current product
 * (for homepage or cart page)
 */
export function getQuickRecommendations(count = 4) {
  const allProducts = websiteKnowledge.products.list.filter(p => p.inStock);
  
  // Shuffle and pick premium items
  const shuffled = [...allProducts].sort(() => Math.random() - 0.5);
  
  // Prioritize premium brands
  const premiumBrands = ['Apple', 'Samsung', 'Sony', 'Bose'];
  const premium = shuffled.filter(p => premiumBrands.includes(p.brand));
  const regular = shuffled.filter(p => !premiumBrands.includes(p.brand));
  
  return [...premium, ...regular].slice(0, count);
}

// ==================== EXPOSE TO CONSOLE ====================
window.recommendationEngine = {
  getRecommendations,
  rankProducts,
  getQuickRecommendations
};
