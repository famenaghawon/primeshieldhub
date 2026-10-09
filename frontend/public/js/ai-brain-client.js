// ============================================================================
// public../js/ai-brain-client.js — PrimeShieldHub AI Brain Client v11.4.5
// Lightweight client for the AI Brain API endpoint
// Integrates with Worker's /api/brain endpoint for predictive navigation,
// exit intent detection, product recommendations, and upsell triggers
// 
// ALSO INCLUDES:
// - Conversion tracking
// - Urgency signals
// - Checkout conversion firing
// - Session management
// - Product price inquiries (fixed)
// ============================================================================

import { CONFIG } from './config.js';
import { auth } from './auth.js';
import { bus, Events } from './events.js';
import { getDeviceFingerprint } from './sophisticated/fraud-engine/fingerprint.js';

// ==================== CONFIGURATION ====================
// API_BASE already includes '/api' - e.g., https://api.primeshieldhub.com/api
var API_BASE = CONFIG.apiBase || '';

// Remove trailing slash if present
if (API_BASE.endsWith('/')) {
    API_BASE = API_BASE.slice(0, -1);
}

// ================================================================
// FIXED: Endpoints should NOT include /api since API_BASE already has it
// ================================================================
var ENDPOINT = '/brain';           // Was: '/api/brain'
var AI_CHAT_ENDPOINT = '/ai-chat'; // Was: '/api/ai-chat'
var TRACK_CONVERSION_ENDPOINT = '/track-conversion'; // Was: '/track-conversion' (already correct)

var TIMEOUT = CONFIG.debug ? 10000 : 5000;
var RETRY_ATTEMPTS = 2;
var CACHE_TTL = 60000; // 1 minute cache for predictions
var DEBUG = CONFIG.debug || false;

// ==================== CACHE ====================
var predictionCache = new Map();
var pendingRequests = new Map();
var productCache = new Map();

// ==================== SESSION ID ====================
function getSessionId() {
    var sessionId = sessionStorage.getItem('psh_ai_session');
    if (!sessionId) {
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem('psh_ai_session', sessionId);
    }
    return sessionId;
}

// ==================== CORE AI BRAIN FUNCTION ====================

/**
 * Sends a request to the AI Brain API endpoint
 * 
 * @param {Object} data - Request payload
 * @param {string} data.type - Event type: 'product_click', 'navigation', 'exit_intent', 'page_load', 'search', 'idle', 'chat', 'product_inquiry'
 * @param {string} [data.productId] - Product ID for product clicks
 * @param {string} [data.target] - Target URL for navigation
 * @param {string} [data.path] - Current page path
 * @param {Object} [data.features] - Behavioral features from fraud engine
 * @param {string} [data.query] - Search query
 * @param {string} [data.message] - Chat message for AI chat
 * @param {string} [data.systemPrompt] - System prompt for AI chat
 * @param {Object} [data.context] - Additional context
 * @param {string} [data.prompt] - Custom prompt for AI
 * @param {number} [data.conversionScore] - Conversion probability score
 * @param {Array} [data.events] - Batch events for analytics
 * @param {Object} [data.metric] - Performance metric data
 * @param {Array} [data.metrics] - Batch performance metrics
 * @param {number} [data.expiry] - Token expiry
 * @param {boolean} [data.requireAuth] - Require authentication
 * @param {Array} [data.messages] - Chat message history
 * @param {string} [data.fingerprint] - Device fingerprint
 * @returns {Promise<Object>} AI prediction with nextPage, confidence, and optional action
 */
export async function askBrain(data) {
    var type = data.type || 'page_load';
    var productId = data.productId;
    var target = data.target;
    var path = data.path;
    var features = data.features || {};
    var query = data.query || null;
    var message = data.message || null;
    var systemPrompt = data.systemPrompt || null;
    var context = data.context || {};
    var prompt = data.prompt || null;
    var conversionScore = data.conversionScore || null;
    var events = data.events || null;
    var metric = data.metric || null;
    var metrics = data.metrics || null;
    var expiry = data.expiry || null;
    var requireAuth = data.requireAuth || false;
    var messages = data.messages || null;
    var providedFingerprint = data.fingerprint || null;
    
    // Generate cache key
    var cacheKey = type + '_' + (productId || '') + '_' + (target || '') + '_' + (path || window.location.pathname) + '_' + (query || '') + '_' + (message ? message.slice(0, 20) : '');
    
    // Check cache for non-urgent requests
    if (type === 'page_load' || type === 'navigation' || type === 'product_inquiry') {
        var cached = predictionCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            if (DEBUG) console.log('[AI Brain] Cache hit:', cacheKey);
            return cached.data;
        }
    }
    
    // Deduplicate in-flight requests
    if (pendingRequests.has(cacheKey)) {
        if (DEBUG) console.log('[AI Brain] Deduplicating request:', cacheKey);
        return pendingRequests.get(cacheKey);
    }
    
    // Get device fingerprint
    var fingerprint = providedFingerprint;
    if (!fingerprint) {
        try {
            fingerprint = await getDeviceFingerprint();
        } catch (e) {
            fingerprint = 'fallback_' + Date.now();
            console.warn('[AI Brain] Fingerprint fallback:', e.message);
        }
    }
    
    // Get auth token if required
    var token = null;
    if (requireAuth) {
        try {
            token = auth.getToken();
        } catch (e) {
            // Ignore - token may not be available
        }
    }
    
    // Get user for context
    var user = null;
    try {
        user = auth.getUser();
    } catch (e) {
        // Ignore
    }
    
    // Get behavior features
    var behaviorFeatures = window.__psh_behaviorFeatures || {};
    var finalFeatures = {
        scrollDepth: Math.round((window.scrollY / (Math.max(document.body.scrollHeight, window.innerHeight) - window.innerHeight)) * 100) || 0,
        timeOnPage: Math.round((Date.now() - (window._psh_pageLoadTime || Date.now())) / 1000),
        mouseMovements: window._psh_mouseMoves || 0,
        clicks: window._psh_clicks || 0,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        touchPoints: navigator.maxTouchPoints || 0,
        isMobile: window.innerWidth <= 768,
        isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
        isDesktop: window.innerWidth > 1024,
        timestamp: Date.now(),
        url: window.location.href,
        referrer: document.referrer || null,
        screenWidth: screen.width,
        screenHeight: screen.height,
        language: navigator.language,
        platform: navigator.platform,
        connectionType: navigator.connection ? navigator.connection.effectiveType : 'unknown',
        deviceMemory: navigator.deviceMemory || 'unknown',
        hardwareConcurrency: navigator.hardwareConcurrency || 0
    };
    
    // Merge with provided features
    for (var key in behaviorFeatures) {
        if (behaviorFeatures.hasOwnProperty(key)) {
            finalFeatures[key] = behaviorFeatures[key];
        }
    }
    for (var key2 in features) {
        if (features.hasOwnProperty(key2)) {
            finalFeatures[key2] = features[key2];
        }
    }
    
    // Build request payload
    var payload = {
        type: type,
        productId: productId || null,
        target: target || null,
        path: path || window.location.pathname,
        query: query || null,
        message: message || null,
        systemPrompt: systemPrompt || null,
        context: {
            user: user ? {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name
            } : null,
            isAuthenticated: !!user,
            sessionId: getSessionId(),
            timestamp: Date.now()
        },
        prompt: prompt || null,
        conversionScore: conversionScore || null,
        events: events || null,
        metric: metric || null,
        metrics: metrics || null,
        expiry: expiry || null,
        features: finalFeatures,
        fingerprint: fingerprint,
        sessionId: getSessionId(),
        messages: messages || null
    };
    
    // Merge context
    for (var key3 in context) {
        if (context.hasOwnProperty(key3)) {
            payload.context[key3] = context[key3];
        }
    }
    
    // Build headers
    var headers = {
        'Content-Type': 'application/json',
        'x-device-fingerprint': fingerprint
    };
    
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    
    // Get CSRF token from meta tag
    var csrfToken = document.querySelector('meta[name="csrf-token"]');
    if (csrfToken) {
        headers['x-csrf-token'] = csrfToken.content;
    }
    
    // ================================================================
    // FIXED: Determine which endpoint to use based on type
    // API_BASE already includes /api, so endpoints are /brain, /ai-chat
    // ================================================================
    var endpoint = ENDPOINT; // '/brain'
    var useChatEndpoint = false;
    
    // Use chat endpoint for chat-related requests
    if (type === 'chat' || type === 'product_inquiry' || message || messages) {
        useChatEndpoint = true;
        endpoint = AI_CHAT_ENDPOINT; // '/ai-chat'
    }
    
    // ================================================================
    // FIXED: Build URL - API_BASE already has /api
    // ================================================================
    var url = API_BASE + endpoint;
    // Example: https://api.primeshieldhub.com/api/brain
    // Example: https://api.primeshieldhub.com/api/ai-chat
    
    // Create the promise with retry logic
    var requestPromise = (async function() {
        var lastError = null;
        
        for (var attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
            try {
                var controller = new AbortController();
                var timeoutId = setTimeout(function() { controller.abort(); }, TIMEOUT);
                
                // ================================================================
                // FIXED: Use 'omit' credentials to avoid CORS issues
                // ================================================================
                var response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    credentials: 'omit',
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    // If using chat endpoint and it fails, try brain endpoint as fallback
                    if (useChatEndpoint && attempt === 0) {
                        if (DEBUG) console.log('[AI Brain] Chat endpoint failed, trying brain endpoint...');
                        // Try brain endpoint as fallback for chat
                        var fallbackUrl = API_BASE + ENDPOINT;
                        var fallbackResponse = await fetch(fallbackUrl, {
                            method: 'POST',
                            headers: headers,
                            credentials: 'omit',
                            body: JSON.stringify({
                                type: 'chat',
                                message: message,
                                features: finalFeatures,
                                fingerprint: fingerprint,
                                sessionId: getSessionId()
                            }),
                            signal: controller.signal
                        });
                        if (fallbackResponse.ok) {
                            var result = await fallbackResponse.json();
                            return normalizeResponse(result, type);
                        }
                    }
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }
                
                var result = await response.json();
                
                if (DEBUG) {
                    console.log('[AI Brain] Response:', result);
                }
                
                // Normalize the response
                var prediction = normalizeResponse(result, type);
                
                // Cache non-urgent predictions
                if (type === 'page_load' || type === 'navigation' || type === 'product_inquiry') {
                    predictionCache.set(cacheKey, {
                        data: prediction,
                        timestamp: Date.now()
                    });
                    
                    // Clean old cache entries
                    if (predictionCache.size > 100) {
                        var oldestKey = predictionCache.keys().next().value;
                        predictionCache.delete(oldestKey);
                    }
                }
                
                // Cache product data
                if (type === 'product_inquiry' && result.products && result.products.length > 0) {
                    for (var i = 0; i < result.products.length; i++) {
                        var p = result.products[i];
                        if (p.id) {
                            productCache.set(p.id, p);
                        }
                    }
                }
                
                // Emit success event
                if (bus && bus.emit) {
                    bus.emit(Events.AI_PREDICTION, {
                        type: type,
                        prediction: prediction,
                        cacheKey: cacheKey
                    });
                }
                
                return prediction;
                
            } catch (error) {
                lastError = error;
                
                if (DEBUG) {
                    console.warn('[AI Brain] Attempt ' + (attempt + 1) + ' failed:', error.message);
                }
                
                // Don't retry on 4xx errors
                if (error.message && error.message.includes('HTTP 4')) {
                    break;
                }
                
                // Don't retry if response is HTML (likely a 404 page)
                if (error.message && error.message.includes('<!DOCTYPE')) {
                    break;
                }
                
                // Wait before retry (exponential backoff)
                if (attempt < RETRY_ATTEMPTS) {
                    await new Promise(function(resolve) {
                        setTimeout(resolve, 300 * Math.pow(2, attempt));
                    });
                }
            }
        }
        
        // All attempts failed - emit error event
        if (bus && bus.emit) {
            bus.emit(Events.ERROR_OCCURRED, {
                source: 'ai-brain',
                type: type,
                error: lastError ? lastError.message : 'Unknown error'
            });
        }
        
        // Return fallback
        var fallback = getFallbackPrediction(data);
        return fallback;
    })();
    
    // Store for deduplication
    pendingRequests.set(cacheKey, requestPromise);
    
    // Clean up after completion
    requestPromise.finally(function() {
        pendingRequests.delete(cacheKey);
    });
    
    return requestPromise;
}

// ==================== RESPONSE NORMALIZER ====================

function normalizeResponse(result, type) {
    // Handle both brain and chat response formats
    var normalized = {
        nextPage: result.nextPage || '/',
        confidence: result.confidence || 0.5,
        action: result.action || null,
        message: result.message || null,
        reply: result.reply || result.message || null,
        suggestions: result.suggestions || [],
        products: result.products || [],
        hasProduct: result.hasProduct || false,
        product: result.product || null,
        details: result.details || null,
        correction: result.correction || null,
        timestamp: Date.now(),
        url: result.url || null,
        error: result.error || null,
        accepted: result.accepted !== false,
        model: result.model || 'unknown',
        analytics: result.analytics || {}
    };
    
    // Handle product inquiry response
    if (type === 'product_inquiry' && result.product) {
        normalized.product = result.product;
        normalized.hasProduct = true;
        normalized.products = [result.product];
        normalized.reply = result.message || result.details || result.reply;
    }
    
    // Ensure we have a message/reply
    if (!normalized.reply && result.message) {
        normalized.reply = result.message;
    }
    
    return normalized;
}

// ==================== FALLBACK PREDICTIONS ====================

function getFallbackPrediction(data) {
    var type = data.type;
    var productId = data.productId;
    var target = data.target;
    var path = data.path;
    var query = data.query;
    var message = data.message;
    
    switch (type) {
        case 'product_click':
            if (productId) {
                return {
                    nextPage: '/product-detail.html?id=' + productId,
                    confidence: 0.9,
                    action: null,
                    message: null,
                    reply: null,
                    suggestions: [],
                    products: [],
                    hasProduct: false,
                    timestamp: Date.now()
                };
            }
            return getDefaultFallback();
            
        case 'navigation':
            if (target && target.startsWith('/')) {
                return {
                    nextPage: target,
                    confidence: 0.7,
                    action: null,
                    message: null,
                    reply: null,
                    suggestions: [],
                    products: [],
                    hasProduct: false,
                    timestamp: Date.now()
                };
            }
            return getDefaultFallback();
            
        case 'exit_intent':
            return {
                nextPage: '/',
                confidence: 0.6,
                action: 'show_discount_popup',
                message: 'Wait! Special offer for you! 🎉',
                reply: 'Wait! Special offer for you! 🎉',
                suggestions: ['Check deals', 'Contact support'],
                products: [],
                hasProduct: false,
                timestamp: Date.now()
            };
            
        case 'page_load':
            if (path === '/' || path === '/index.html') {
                return {
                    nextPage: '#products',
                    confidence: 0.8,
                    action: null,
                    message: null,
                    reply: null,
                    suggestions: ['smartphones', 'audio', 'laptops', 'wearables'],
                    products: [],
                    hasProduct: false,
                    timestamp: Date.now()
                };
            }
            return {
                nextPage: path || '/',
                confidence: 0.9,
                action: null,
                message: null,
                reply: null,
                suggestions: [],
                products: [],
                hasProduct: false,
                timestamp: Date.now()
            };
            
        case 'search':
            return {
                nextPage: '/search.html?q=' + encodeURIComponent(query || ''),
                confidence: 0.7,
                action: null,
                message: null,
                reply: null,
                suggestions: [],
                products: [],
                hasProduct: false,
                timestamp: Date.now()
            };
            
        case 'idle':
            return {
                nextPage: '/',
                confidence: 0.3,
                action: 'show_engagement_popup',
                message: 'Still looking? Let us help you find the perfect gadget! 💡',
                reply: 'Still looking? Let us help you find the perfect gadget! 💡',
                suggestions: ['Products', 'Deals', 'Contact'],
                products: [],
                hasProduct: false,
                timestamp: Date.now()
            };
            
        case 'cart_abandon':
            return {
                nextPage: '/checkout',
                confidence: 0.8,
                action: 'show_cart_reminder',
                message: 'Your cart is waiting! Complete your order now. 🛒',
                reply: 'Your cart is waiting! Complete your order now. 🛒',
                suggestions: ['Proceed to checkout', 'Continue shopping'],
                products: [],
                hasProduct: false,
                timestamp: Date.now()
            };
            
        case 'chat':
        case 'product_inquiry':
            // FIXED: Better fallback for product inquiries
            if (type === 'product_inquiry' && message) {
                return {
                    nextPage: '/',
                    confidence: 0.5,
                    action: null,
                    message: 'I\'m having trouble checking for "' + message + '" right now. Please contact our support team on WhatsApp at +234 810 353 5978 for immediate assistance. 💬',
                    reply: 'I\'m having trouble checking for "' + message + '" right now. Please contact our support team on WhatsApp at +234 810 353 5978 for immediate assistance. 💬',
                    suggestions: ['Chat on WhatsApp', 'Browse products', 'Contact support'],
                    products: [],
                    hasProduct: false,
                    timestamp: Date.now()
                };
            }
            return {
                nextPage: '/',
                confidence: 0.5,
                action: null,
                message: 'I\'m having trouble responding right now. You can chat with us on WhatsApp for faster help at +234 810 353 5978. 💬',
                reply: 'I\'m having trouble responding right now. You can chat with us on WhatsApp for faster help at +234 810 353 5978. 💬',
                suggestions: ['Payment methods', 'Delivery time', 'Reseller program'],
                products: [],
                hasProduct: false,
                timestamp: Date.now()
            };
            
        default:
            return getDefaultFallback();
    }
}

function getDefaultFallback() {
    return {
        nextPage: '/',
        confidence: 0.5,
        action: null,
        message: null,
        reply: null,
        suggestions: [],
        products: [],
        hasProduct: false,
        timestamp: Date.now()
    };
}

// ==================== CONVERSION TRACKING ====================

/**
 * Track a conversion event
 * @param {Object} data - Conversion data
 * @param {string} data.productId - Product ID
 * @param {string} data.productName - Product name
 * @param {number} data.price - Product price
 * @param {number} data.quantity - Quantity
 * @param {Object} data.behavior - Behavior features
 * @param {boolean} data.checkoutStarted - Checkout started flag
 * @param {string} data.type - Conversion type
 */
export async function trackConversion(data) {
    try {
        var fingerprint = await getDeviceFingerprint();
        var token = null;
        try {
            token = auth.getToken();
        } catch (e) { /* Ignore */ }
        var user = null;
        try {
            user = auth.getUser();
        } catch (e) { /* Ignore */ }
        
        var payload = {
            userId: user ? user.id : null,
            userRole: user ? user.role : 'guest',
            fingerprint: fingerprint,
            sessionId: getSessionId(),
            timestamp: Date.now(),
            url: window.location.href,
            referrer: document.referrer || null
        };
        
        // Copy data properties
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                payload[key] = data[key];
            }
        }
        
        var headers = {
            'Content-Type': 'application/json',
            'x-device-fingerprint': fingerprint
        };
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        
        // ================================================================
        // FIXED: API_BASE already has /api, so track-conversion is correct
        // ================================================================
        var trackUrl = API_BASE + TRACK_CONVERSION_ENDPOINT;
        
        var response = await fetch(trackUrl, {
            method: 'POST',
            headers: headers,
            credentials: 'omit',
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            console.warn('[AI Brain] Conversion tracking failed:', response.status);
        }
        
        if (DEBUG) {
            console.log('[AI Brain] Conversion tracked:', data);
        }
    } catch (e) {
        console.warn('[AI Brain] Tracking error:', e);
    }
}

// ==================== URGENCY SIGNAL ====================

/**
 * Get urgency signal for a product
 * @param {Object} product - Product object
 * @param {number} product.stock - Available stock
 * @param {number} product.sales - Sales count
 * @param {boolean} product.isBestseller - Is bestseller
 * @param {boolean} product.isNew - Is new arrival
 * @param {number} product.discount - Discount percentage
 * @returns {string} Urgency message
 */
export function getUrgencySignal(product) {
    if (!product) return 'Smart choice ✅';
    
    if (product.stock !== undefined) {
        if (product.stock === 0) return 'Out of stock ❌';
        if (product.stock < 3) return 'Only ' + product.stock + ' left! 🔥';
        if (product.stock < 10) return 'Only ' + product.stock + ' remaining ⚡';
    }
    
    if (product.sales !== undefined && product.sales > 50) {
        return 'Trending now 🔥';
    }
    
    if (product.isBestseller) {
        return '⭐ Bestseller';
    }
    
    if (product.isNew) {
        return '✨ New arrival';
    }
    
    if (product.discount && product.discount > 20) {
        return '💰 ' + product.discount + '% off!';
    }
    
    return 'Smart choice ✅';
}

/**
 * Render urgency signal on a DOM element
 * @param {Object} product - Product object
 * @param {string} targetElementSelector - CSS selector for target element
 */
export function renderUrgencySignal(product, targetElementSelector) {
    var element = document.querySelector(targetElementSelector);
    if (element) {
        element.textContent = getUrgencySignal(product);
    } else if (DEBUG) {
        console.warn('[AI Brain] Element not found: ' + targetElementSelector);
    }
}

// ==================== CHECKOUT CONVERSION ====================

/**
 * Fire a checkout conversion event
 * @param {Object} product - Product object
 * @param {Object} pricing - Pricing object
 * @param {number} pricing.finalPrice - Final price
 * @param {number} [pricing.originalPrice] - Original price
 * @param {number} [pricing.discountApplied] - Discount percentage
 */
export function fireCheckoutConversion(product, pricing) {
    if (!product) {
        console.warn('[AI Brain] No product provided for checkout conversion');
        return;
    }
    
    trackConversion({
        productId: product.id,
        productName: product.name,
        price: pricing ? pricing.finalPrice : product.price,
        originalPrice: pricing ? pricing.originalPrice : product.originalPrice,
        discount: pricing ? pricing.discountApplied : (product.discount || 0),
        quantity: 1,
        behavior: window.__psh_behaviorFeatures || {},
        checkoutStarted: true,
        type: 'checkout_conversion',
        timestamp: Date.now()
    });
    
    if (DEBUG) {
        console.log('[AI Brain] Checkout conversion fired for:', product.name);
    }
}

// ==================== PRODUCT INQUIRY ====================

/**
 * Ask about a product (price, availability, details)
 * @param {string} query - The product inquiry (e.g., "iPhone 15 price")
 * @param {Object} options - Additional options
 * @param {Array} options.messages - Chat history
 * @param {string} options.systemPrompt - System prompt
 * @param {Object} options.context - Additional context
 * @returns {Promise<Object>} Product inquiry response
 */
export async function askAboutProduct(query, options) {
    options = options || {};
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return {
            reply: 'Please tell me what product you\'re looking for.',
            hasProduct: false,
            products: [],
            suggestions: ['iPhone', 'Samsung', 'MacBook', 'AirPods']
        };
    }
    
    return askBrain({
        type: 'product_inquiry',
        message: query.trim(),
        messages: options.messages || [],
        systemPrompt: options.systemPrompt || null,
        context: options.context || {},
        fingerprint: options.fingerprint || null
    });
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Clears the prediction cache
 */
export function clearBrainCache() {
    predictionCache.clear();
    productCache.clear();
    if (DEBUG) console.log('[AI Brain] Cache cleared');
}

/**
 * Gets cache statistics
 */
export function getBrainCacheStats() {
    var entries = [];
    var iterator = predictionCache.entries();
    var entry = iterator.next();
    while (!entry.done) {
        var key = entry.value[0];
        var value = entry.value[1];
        entries.push({
            key: key,
            age: Date.now() - value.timestamp,
            prediction: value.data
        });
        entry = iterator.next();
    }
    
    return {
        size: predictionCache.size,
        productCacheSize: productCache.size,
        pendingRequests: pendingRequests.size,
        entries: entries
    };
}

/**
 * Get cached product data
 * @param {string} productId - Product ID
 * @returns {Object|null} Cached product data
 */
export function getCachedProduct(productId) {
    return productCache.get(productId) || null;
}

/**
 * Pre-warms the cache for common predictions
 */
export async function prewarmBrainCache() {
    var commonPredictions = [
        { type: 'page_load', path: '/' },
        { type: 'page_load', path: '/products.html' },
        { type: 'page_load', path: '/wholesale.html' },
        { type: 'page_load', path: '/categories.html' }
    ];
    
    for (var i = 0; i < commonPredictions.length; i++) {
        try {
            await askBrain(commonPredictions[i]);
        } catch (e) {
            // Silently fail - prewarming is optional
        }
    }
    
    if (DEBUG) console.log('[AI Brain] Cache prewarmed');
}

/**
 * Get the current behavior features
 * @returns {Object} Behavior features
 */
export function getBehaviorFeatures() {
    return window.__psh_behaviorFeatures || {};
}

// ==================== BEHAVIOR TRACKING HELPERS ====================

/**
 * Tracks user behavior for the AI brain
 */
export function trackBehavior() {
    try {
        var features = {
            scrollDepth: Math.round((window.scrollY / (Math.max(document.body.scrollHeight, window.innerHeight) - window.innerHeight)) * 100) || 0,
            timeOnPage: Math.round((Date.now() - (window._psh_pageLoadTime || Date.now())) / 1000),
            mouseMovements: window._psh_mouseMoves || 0,
            clicks: window._psh_clicks || 0,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio || 1,
            touchPoints: navigator.maxTouchPoints || 0,
            isMobile: window.innerWidth <= 768,
            isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
            isDesktop: window.innerWidth > 1024
        };
        
        // Store for other modules to use
        window.__psh_behaviorFeatures = features;
        
        return features;
    } catch (e) {
        return {};
    }
}

/**
 * Track product view for AI recommendations
 */
export function trackProductView(productId) {
    if (!productId) return;
    
    askBrain({
        type: 'product_click',
        productId: productId,
        features: trackBehavior()
    }).catch(function() {});
}

/**
 * Track search query for AI suggestions
 */
export function trackSearch(query) {
    if (!query) return;
    
    askBrain({
        type: 'search',
        query: query,
        features: trackBehavior()
    }).catch(function() {});
}

/**
 * Track cart abandonment
 */
export function trackCartAbandon() {
    askBrain({
        type: 'cart_abandon',
        features: trackBehavior()
    }).catch(function() {});
}

/**
 * Track exit intent
 */
export function trackExitIntent() {
    askBrain({
        type: 'exit_intent',
        features: trackBehavior()
    }).catch(function() {});
}

// ==================== INITIALIZATION ====================

// Track page load time
window._psh_pageLoadTime = Date.now();
window._psh_mouseMoves = 0;
window._psh_clicks = 0;

// Track mouse movements (throttled)
var mouseMoveCounter = 0;
document.addEventListener('mousemove', function() {
    mouseMoveCounter++;
    if (mouseMoveCounter % 10 === 0) {
        window._psh_mouseMoves = (window._psh_mouseMoves || 0) + 10;
    }
}, { passive: true });

// Track clicks
document.addEventListener('click', function() {
    window._psh_clicks = (window._psh_clicks || 0) + 1;
}, { passive: true });

// Track exit intent
var exitIntentShown = false;
document.addEventListener('mouseleave', function(e) {
    if (e.clientY < 10 && !exitIntentShown) {
        exitIntentShown = true;
        trackExitIntent();
        setTimeout(function() {
            exitIntentShown = false;
        }, 300000);
    }
}, { passive: true });

// Track idle detection
var idleTimer = null;
var isIdle = false;

function resetIdleTimer() {
    isIdle = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function() {
        if (!isIdle) {
            isIdle = true;
            askBrain({
                type: 'idle',
                features: trackBehavior()
            }).catch(function() {});
        }
    }, 60000); // 60 seconds idle
}

document.addEventListener('mousemove', resetIdleTimer, { passive: true });
document.addEventListener('keydown', resetIdleTimer, { passive: true });
document.addEventListener('scroll', resetIdleTimer, { passive: true });
document.addEventListener('click', resetIdleTimer, { passive: true });

// Track page visibility
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        resetIdleTimer();
    }
});

// Prewarm cache on load
if (document.readyState === 'complete') {
    prewarmBrainCache();
} else {
    window.addEventListener('load', prewarmBrainCache);
}

// Expose behavior features getter globally
window.getBehaviorFeatures = trackBehavior;

// Expose product inquiry function globally
window.askAboutProduct = askAboutProduct;

// Log initialization
if (DEBUG) {
    console.log('[AI Brain] Client initialized v11.4.5');
    console.log('[AI Brain] API endpoints:', {
        brain: API_BASE + ENDPOINT,
        chat: API_BASE + AI_CHAT_ENDPOINT
    });
}
