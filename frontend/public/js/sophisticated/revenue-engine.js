// ============================================================================
// public../js/sophisticated/revenue-engine.js - Revenue Optimization Engine v2.0
// ============================================================================
// Unified system: recommendations + dynamic pricing + AI persuasion
// ============================================================================

import { CONFIG } from '../config.js';
import { auth } from '../auth.js';
import { api } from '../api-client.js';
import { bus, Events } from '../events.js';
import { productStore } from '../product-store.js';
import { cartStore } from '../cart-store.js';
import { getDeviceFingerprint } from '../sophisticated/fraud-engine/fingerprint.js';
import { askBrain } from '../ai-brain-client.js';

// ===== CONSTANTS =====
const CACHE_KEY = 'psh_revenue_cache';
const CACHE_TTL = 300000; // 5 minutes
const MIN_CONFIDENCE = 0.3;

// ===== STATE =====
let cache = null;
let cacheTime = 0;

// ===== USER CONTEXT =====
function getUserContext() {
    const user = auth.getUser();
    const behavior = window.__psh_behaviorFeatures || {};
    
    return {
        userId: user?.id || null,
        role: user?.role || 'customer',
        isAuthenticated: !!user,
        isReseller: user?.role === 'reseller' || user?.isReseller || false,
        isWholesale: user?.role === 'wholesale' || user?.isWholesale || false,
        clicks: behavior.clicks || 0,
        mouseMovements: behavior.mouseMovements || 0,
        scrollDepth: behavior.scrollDepth || 0,
        timeOnPage: behavior.timeOnPage || 0,
        deviceType: behavior.deviceType || 'desktop',
        cartCount: cartStore.getCount() || 0,
        cartTotal: cartStore.getGrandTotal() || 0
    };
}

// ===== RECOMMENDATIONS =====
async function getRecommendations(product, limit = 4) {
    try {
        // Try API first
        const response = await api.post('/recommend', {
            productId: product.id,
            limit: limit,
            excludeIds: [product.id],
            context: getUserContext()
        }, { requireAuth: false });

        if (response.recommendations && response.recommendations.length > 0) {
            return response.recommendations;
        }
    } catch (e) {
        console.warn('[Revenue] Recommendations API failed:', e.message);
    }

    // Fallback: use product store
    const related = productStore.getRelated(product.id, limit);
    return related.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        wholesalePrice: p.wholesalePrice,
        image: p.image,
        category: p.category,
        description: p.shortDescription || p.description,
        rating: p.rating,
        reviewCount: p.reviewCount,
        stock: p.stock,
        isNew: p.isNew,
        isBestseller: p.isBestseller,
        discount: p.discount,
        score: 0.5
    }));
}

// ===== DYNAMIC PRICING =====
function getDynamicPrice(product, userContext) {
    const basePrice = product.price || 0;
    const wholesalePrice = product.wholesalePrice || basePrice * 0.85;
    const resellerPrice = product.resellerPrice || basePrice * 0.9;
    
    let finalPrice = basePrice;
    let priceType = 'retail';
    let discountApplied = 0;

    // Role-based pricing
    if (userContext.isWholesale && wholesalePrice) {
        finalPrice = wholesalePrice;
        priceType = 'wholesale';
        discountApplied = Math.round((1 - wholesalePrice / basePrice) * 100);
    } else if (userContext.isReseller && resellerPrice) {
        finalPrice = resellerPrice;
        priceType = 'reseller';
        discountApplied = Math.round((1 - resellerPrice / basePrice) * 100);
    }

    // Loyalty discount (if user is authenticated)
    if (userContext.isAuthenticated && userContext.cartTotal > 100000) {
        const loyaltyDiscount = Math.min(5, Math.floor(userContext.cartTotal / 100000));
        finalPrice = finalPrice * (1 - loyaltyDiscount / 100);
        discountApplied += loyaltyDiscount;
    }

    // Urgency pricing (low stock)
    if (product.stock !== undefined && product.stock < 5 && product.stock > 0) {
        // No discount for low stock - creates urgency
        discountApplied = Math.max(0, discountApplied - 5);
    }

    return {
        originalPrice: basePrice,
        finalPrice: Math.round(finalPrice * 100) / 100,
        wholesalePrice: wholesalePrice,
        resellerPrice: resellerPrice,
        priceType,
        discountApplied: Math.min(discountApplied, 100),
        savings: Math.round((basePrice - finalPrice) * 100) / 100,
        savingsPercent: Math.round((1 - finalPrice / basePrice) * 100)
    };
}

// ===== AI PERSUASION MESSAGES =====
async function generateCloserMessage(product, pricing, userContext) {
    const messages = [
        {
            condition: () => product.isBestseller,
            message: `⭐ Bestseller! ${product.name} is flying off the shelf. Order now!`
        },
        {
            condition: () => product.stock < 3 && product.stock > 0,
            message: `🔥 Only ${product.stock} left in stock! Don't miss out.`
        },
        {
            condition: () => pricing.discountApplied > 20,
            message: `💰 Save ${pricing.discountApplied}%! Limited time offer.`
        },
        {
            condition: () => product.rating >= 4.5,
            message: `⭐ ${product.rating}★ rating from ${product.reviewCount}+ customers. Join them!`
        },
        {
            condition: () => userContext.cartCount === 0,
            message: `🛒 Add to cart and get free shipping on orders over ₦150,000`
        },
        {
            condition: () => userContext.isNewUser || !userContext.isAuthenticated,
            message: `🎉 New customer? Use code NEWCUSTOMER for 5% off!`
        },
        {
            condition: () => userContext.isReseller,
            message: `📦 Reseller price: ${formatCurrency(pricing.finalPrice)}. Start earning today!`
        }
    ];

    // Find first matching message
    for (const msg of messages) {
        if (msg.condition()) {
            return msg.message;
        }
    }

    // Try AI for personalized message
    try {
        const prompt = `
User context: ${JSON.stringify(userContext)}
Product: ${product.name}
Price: ${formatCurrency(pricing.finalPrice)}
Stock: ${product.stock || 'Unknown'}

Generate a short, persuasive, one-sentence message to encourage purchase.
Be urgent but not pushy. Use emojis.
`;

        const response = await askBrain({
            type: 'persuasion',
            prompt: prompt,
            context: {
                product: product.name,
                price: pricing.finalPrice,
                stock: product.stock
            }
        });

        if (response && response.message) {
            return response.message;
        }
    } catch (e) {
        console.warn('[Revenue] AI persuasion failed:', e.message);
    }

    // Default fallback
    return `⚡ ${product.name} — premium quality at ${formatCurrency(pricing.finalPrice)}. Buy now!`;
}

// ===== FORMAT CURRENCY =====
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

// ===== MAIN REVENUE PIPELINE =====
export async function runRevenueEngine(currentProduct, options = {}) {
    const {
        limit = 4,
        useCache = true,
        includeMessages = true,
        includePricing = true,
        forceRefresh = false
    } = options;

    if (!currentProduct || !currentProduct.id) {
        console.warn('[Revenue] Invalid product:', currentProduct);
        return { recommendations: [], product: null };
    }

    // Check cache
    const cacheKey = `${currentProduct.id}_${limit}`;
    if (useCache && !forceRefresh && cache && cache.key === cacheKey) {
        const age = Date.now() - cacheTime;
        if (age < CACHE_TTL) {
            console.log('[Revenue] Cache hit:', cacheKey);
            return cache.data;
        }
    }

    try {
        // Get user context
        const userContext = getUserContext();

        // Get recommendations
        const recommendations = await getRecommendations(currentProduct, limit);

        // Process each recommendation
        const processed = await Promise.all(
            recommendations.map(async (product) => {
                // Apply dynamic pricing
                let pricing = null;
                if (includePricing) {
                    pricing = getDynamicPrice(product, userContext);
                }

                // Generate persuasion message
                let message = null;
                if (includeMessages && pricing) {
                    message = await generateCloserMessage(product, pricing, userContext);
                }

                return {
                    ...product,
                    pricing: pricing ? {
                        originalPrice: pricing.originalPrice,
                        finalPrice: pricing.finalPrice,
                        discountApplied: pricing.discountApplied,
                        savings: pricing.savings,
                        savingsPercent: pricing.savingsPercent,
                        priceType: pricing.priceType
                    } : null,
                    message: message || `🔥 Limited offer on ${product.name}`,
                    confidence: product.score || 0.5,
                    inCart: cartStore.items.some(i => i.id === product.id)
                };
            })
        );

        // Filter out items already in cart (optional)
        const filtered = processed.filter(p => !p.inCart);

        // Sort by confidence/score
        filtered.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

        // Limit results
        const result = {
            product: currentProduct,
            recommendations: filtered.slice(0, limit),
            userContext: userContext,
            timestamp: Date.now()
        };

        // Cache
        if (useCache) {
            cache = { key: cacheKey, data: result };
            cacheTime = Date.now();
        }

        // Emit event
        if (bus?.emit) {
            bus.emit(Events.REVENUE_ENGINE_RUN, {
                productId: currentProduct.id,
                recommendations: result.recommendations.length,
                timestamp: Date.now()
            });
        }

        return result;

    } catch (error) {
        console.error('[Revenue] Pipeline error:', error);

        // Return fallback with basic data
        return {
            product: currentProduct,
            recommendations: [],
            userContext: getUserContext(),
            error: error.message,
            timestamp: Date.now()
        };
    }
}

// ===== GET RECOMMENDATION WITH PRICING =====
export async function getRecommendationWithPricing(productId, options = {}) {
    const product = productStore.getById(productId);
    if (!product) {
        console.warn('[Revenue] Product not found:', productId);
        return null;
    }

    const result = await runRevenueEngine(product, options);
    return result;
}

// ===== BULK PROCESSING =====
export async function runBulkRevenueEngine(products, options = {}) {
    const results = [];
    
    for (const product of products) {
        try {
            const result = await runRevenueEngine(product, options);
            results.push(result);
        } catch (e) {
            console.warn('[Revenue] Bulk processing error for', product.id, e.message);
            results.push({
                product: product,
                recommendations: [],
                error: e.message
            });
        }
    }
    
    return results;
}

// ===== CLEAR CACHE =====
export function clearRevenueCache() {
    cache = null;
    cacheTime = 0;
    console.log('[Revenue] Cache cleared');
}

// ===== GET CACHE STATS =====
export function getRevenueCacheStats() {
    return {
        cached: !!cache,
        cacheAge: cacheTime ? Date.now() - cacheTime : null,
        cacheKey: cache?.key || null,
        cacheSize: cache ? JSON.stringify(cache.data).length : 0
    };
}

// ===== EXPORT =====
export default {
    runRevenueEngine,
    getRecommendationWithPricing,
    runBulkRevenueEngine,
    clearRevenueCache,
    getRevenueCacheStats,
    getUserContext,
    getDynamicPrice
};
