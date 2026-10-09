// ============================================================================
// public../js/sophisticated/fraud-engine/recommendation.js - Recommendation Engine v2.0
// ============================================================================
// AI-powered recommendation engine with hybrid scoring and caching.
// ============================================================================

import { CONFIG } from '../../config.js';
import { bus, Events } from '../../events.js';
import { auth } from '../../auth.js';
import { getDeviceFingerprint } from './fingerprint.js';

// ===== CONSTANTS =====
const CACHE_MAX_SIZE = 100;
const CACHE_TTL = 300000; // 5 minutes
const DEFAULT_LIMIT = 4;

// ===== CACHE =====
const scoreCache = new Map();
const cacheTimestamps = new Map();

function getCachedScore(key) {
    if (!scoreCache.has(key)) return null;
    
    const timestamp = cacheTimestamps.get(key);
    if (!timestamp) return null;
    
    if (Date.now() - timestamp > CACHE_TTL) {
        // Expired
        scoreCache.delete(key);
        cacheTimestamps.delete(key);
        return null;
    }
    
    return scoreCache.get(key);
}

function setCachedScore(key, value) {
    scoreCache.set(key, value);
    cacheTimestamps.set(key, Date.now());
    
    // Maintain cache size
    if (scoreCache.size > CACHE_MAX_SIZE) {
        const firstKey = scoreCache.keys().next().value;
        scoreCache.delete(firstKey);
        cacheTimestamps.delete(firstKey);
    }
}

function clearCache() {
    scoreCache.clear();
    cacheTimestamps.clear();
    if (CONFIG.debug) {
        console.log('[Recommendation] Cache cleared');
    }
}

// ===== FETCH ML SCORE =====
async function fetchPersonalizedScore(product, retries = 2) {
    try {
        const fingerprint = await getDeviceFingerprint();
        const token = auth.getToken ? auth.getToken() : null;
        const user = auth.getUser ? auth.getUser() : null;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${CONFIG.apiBase}/predict-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-device-fingerprint': fingerprint,
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            credentials: 'include',
            body: JSON.stringify({
                product,
                userId: user?.id || null,
                sessionId: sessionStorage.getItem('psh_session_id') || null,
                timestamp: Date.now()
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return typeof data.score === 'number' ? data.score : null;
        
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchPersonalizedScore(product, retries - 1);
        }
        
        if (CONFIG.debug) {
            console.warn('[Recommendation] ML scoring failed:', error.message);
        }
        
        return null;
    }
}

// ===== HYBRID SCORING =====
function hybridScore(product, mlScore) {
    // Calculate fallback score from available data
    const salesScore = (product.sales || 0) * 0.1;
    const ratingScore = (product.rating || 0) * 2;
    const viewsScore = (product.views || 0) * 0.05;
    const stockScore = product.stock && product.stock > 0 ? 5 : 0;
    const discountScore = product.discount ? product.discount * 0.5 : 0;
    const newScore = product.isNew ? 3 : 0;
    const bestsellerScore = product.isBestseller ? 4 : 0;

    const fallback = salesScore + ratingScore + viewsScore + stockScore + 
                     discountScore + newScore + bestsellerScore;

    if (mlScore === null || mlScore === undefined) {
        return Math.min(fallback, 100);
    }

    // Weighted hybrid: 70% ML, 30% fallback
    return Math.min((mlScore * 0.7) + (fallback * 0.3), 100);
}

// ===== SCORE PRODUCT =====
export async function scoreProduct(product) {
    if (!product || !product.id) {
        console.warn('[Recommendation] Invalid product for scoring');
        return 0;
    }

    const key = product.id;
    
    // Check cache
    const cached = getCachedScore(key);
    if (cached !== null) {
        return cached;
    }

    // Fetch ML score
    const mlScore = await fetchPersonalizedScore(product);
    const finalScore = hybridScore(product, mlScore);
    
    // Cache the result
    setCachedScore(key, finalScore);
    
    if (CONFIG.debug) {
        console.log('[Recommendation] Scored', product.name, ':', finalScore.toFixed(2));
    }
    
    return finalScore;
}

// ===== SCORE MULTIPLE PRODUCTS =====
export async function scoreProducts(products) {
    if (!products || !Array.isArray(products) || products.length === 0) {
        return [];
    }
    
    const scored = await Promise.all(
        products.map(async (p) => ({
            ...p,
            score: await scoreProduct(p)
        }))
    );
    
    return scored.sort((a, b) => (b.score || 0) - (a.score || 0));
}

// ===== GET RECOMMENDATIONS =====
export async function getRecommendationsML(currentProduct, allProducts, options = {}) {
    const {
        limit = DEFAULT_LIMIT,
        categoryMatch = true,
        excludeIds = [],
        minScore = 0,
        inStockOnly = true
    } = options;

    if (!currentProduct || !currentProduct.id) {
        console.warn('[Recommendation] Invalid current product');
        return [];
    }

    if (!allProducts || !Array.isArray(allProducts) || allProducts.length === 0) {
        console.warn('[Recommendation] No products provided');
        return [];
    }

    // Filter candidates
    let candidates = allProducts.filter(p => {
        // Exclude current product
        if (p.id === currentProduct.id) return false;
        
        // Exclude by ID
        if (excludeIds.includes(p.id)) return false;
        
        // Category match (optional)
        if (categoryMatch && p.category !== currentProduct.category) return false;
        
        // Stock check
        if (inStockOnly && p.stock !== undefined && p.stock <= 0) return false;
        
        return true;
    });

    if (candidates.length === 0) {
        if (CONFIG.debug) {
            console.log('[Recommendation] No candidates found');
        }
        return [];
    }

    // Score candidates
    const scored = await Promise.all(
        candidates.map(async (p) => ({
            ...p,
            score: await scoreProduct(p)
        }))
    );

    // Filter by min score and sort
    const filtered = scored
        .filter(p => p.score >= minScore)
        .sort((a, b) => (b.score || 0) - (a.score || 0));

    // Return top N
    const results = filtered.slice(0, limit);
    
    if (CONFIG.debug) {
        console.log('[Recommendation] Found', results.length, 'recommendations for', currentProduct.name);
    }
    
    // Emit event
    if (bus?.emit) {
        bus.emit(Events.RECOMMENDATIONS_READY, {
            productId: currentProduct.id,
            count: results.length,
            recommendations: results.map(r => r.id)
        });
    }
    
    return results;
}

// ===== RANK PRODUCTS =====
export async function rankProductsML(products, options = {}) {
    const {
        sortBy = 'score',
        ascending = false,
        limit = null
    } = options;

    if (!products || !Array.isArray(products) || products.length === 0) {
        return [];
    }

    // Score all products
    const scored = await scoreProducts(products);

    // Sort
    const sorted = scored.sort((a, b) => {
        if (sortBy === 'score') {
            return (a.score || 0) - (b.score || 0);
        }
        if (sortBy === 'price') {
            return (a.price || 0) - (b.price || 0);
        }
        if (sortBy === 'rating') {
            return (a.rating || 0) - (b.rating || 0);
        }
        if (sortBy === 'sales') {
            return (a.sales || 0) - (b.sales || 0);
        }
        return 0;
    });

    if (ascending) {
        sorted.reverse();
    }

    return limit ? sorted.slice(0, limit) : sorted;
}

// ===== GET SIMILAR PRODUCTS =====
export async function getSimilarProducts(product, allProducts, options = {}) {
    const {
        limit = 4,
        minCategoryMatch = 0.5,
        minScore = 0
    } = options;

    if (!product || !product.id) {
        return [];
    }

    // Calculate similarity scores
    const scored = await Promise.all(
        allProducts.map(async (p) => {
            if (p.id === product.id) return null;
            
            let similarity = 0;
            let factors = 0;
            
            // Category match
            if (p.category === product.category) {
                similarity += 0.4;
                factors += 1;
            }
            
            // Price similarity (within 30%)
            if (p.price && product.price) {
                const ratio = p.price / product.price;
                if (ratio >= 0.7 && ratio <= 1.3) {
                    similarity += 0.2;
                }
                factors += 1;
            }
            
            // Brand match
            if (p.brand && product.brand && p.brand === product.brand) {
                similarity += 0.3;
                factors += 1;
            }
            
            // Tag overlap
            if (p.tags && product.tags) {
                const overlap = p.tags.filter(t => product.tags.includes(t));
                if (overlap.length > 0) {
                    similarity += 0.1 * Math.min(overlap.length, 3);
                }
                factors += 1;
            }
            
            // Normalize similarity
            const normalized = factors > 0 ? similarity / factors : 0;
            
            // Get ML score
            const score = await scoreProduct(p);
            
            return {
                ...p,
                score,
                similarity: normalized
            };
        })
    );

    // Filter nulls and sort by similarity * score
    const valid = scored
        .filter(p => p !== null && p.similarity >= minCategoryMatch && p.score >= minScore)
        .sort((a, b) => (b.similarity || 0) * (b.score || 0) - (a.similarity || 0) * (a.score || 0));

    return valid.slice(0, limit);
}

// ===== CACHE MANAGEMENT =====
export function clearRecommendationCache() {
    clearCache();
}

export function getCacheStats() {
    return {
        size: scoreCache.size,
        maxSize: CACHE_MAX_SIZE,
        ttl: CACHE_TTL,
        keys: Array.from(scoreCache.keys())
    };
}

// ===== EXPORTS =====
export default {
    scoreProduct,
    scoreProducts,
    getRecommendationsML,
    rankProductsML,
    getSimilarProducts,
    clearRecommendationCache,
    getCacheStats
};
