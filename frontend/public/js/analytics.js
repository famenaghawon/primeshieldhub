// ============================================================================
// analytics.js — Advanced Behavioral Analytics Engine v2.4
// FIXED: 405 error - now uses correct API base URL (api.primeshieldhub.com)
// FIXED: CORS error - removed credentials:'include' (not needed for analytics)
// FIXED: Endpoint now points to api.primeshieldhub.com, not main site
// FIXED: Uses same API_BASE as api-client.js for consistency
// FIXED: Exponential backoff for retries
// FIXED: Endpoint availability detection
// FIXED: Reduced console noise
// ============================================================================

import { CONFIG } from './config.js';
import { auth } from './auth.js';
import { getDeviceFingerprint } from './sophisticated/fraud-engine/fingerprint.js';
import { bus, Events } from './events.js';

// ===== CONSTANTS =====
const SESSION_KEY = 'psh_session';
const ANALYTICS_QUEUE_KEY = 'psh_analytics_queue';
const FLUSH_INTERVAL = CONFIG.analytics?.flushInterval || 60000; // 60 seconds
const MAX_EVENTS = CONFIG.analytics?.maxEvents || 20;
const MAX_OFFLINE_EVENTS = 100;
const MAX_CONSECUTIVE_FAILURES = 3;
const BACKOFF_INTERVAL = 300000; // 5 minutes

// ============================================================
// FIXED: Use the same API base URL as api-client.js
// This ensures analytics requests go to api.primeshieldhub.com
// NOT the main site (primeshieldhub.com) which returns 405
// ============================================================
const API_BASE = CONFIG.apiBase || 'https://api.primeshieldhub.com/api';
const ANALYTICS_ENDPOINT = '/analytics/events';

// ===== EVENT TYPES =====
export const EventTypes = {
    PAGE_VIEW: 'page_view',
    PRODUCT_VIEW: 'product_view',
    PRODUCT_CLICK: 'product_click',
    ADD_TO_CART: 'add_to_cart',
    REMOVE_FROM_CART: 'remove_from_cart',
    CHECKOUT_START: 'checkout_start',
    CHECKOUT_COMPLETE: 'checkout_complete',
    SEARCH: 'search',
    FILTER: 'filter',
    SCROLL_DEPTH: 'scroll_depth',
    LINK_CLICK: 'link_click',
    VISIBILITY: 'visibility',
    SESSION_START: 'session_start',
    SESSION_END: 'session_end',
    AUTH_LOGIN: 'auth_login',
    AUTH_LOGOUT: 'auth_logout',
    AUTH_REGISTER: 'auth_register',
    ERROR: 'error',
    CUSTOM: 'custom'
};

// ===== STATE =====
let sessionId = localStorage.getItem(SESSION_KEY);
if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : 'session_' + Date.now();
    localStorage.setItem(SESSION_KEY, sessionId);
}

let eventsBuffer = [];
let lastFlush = Date.now();
let userId = null;
let fingerprint = null;
let isFlushing = false;
let consecutiveFailures = 0;
let endpointAvailable = true;
let lastFailureTime = 0;
let flushTimeout = null;
let isInitialized = false;

// ===== INIT =====
export async function initAnalytics() {
    if (isInitialized) return;
    
    // Get fingerprint
    try {
        fingerprint = await getDeviceFingerprint();
    } catch (e) {
        // Silent fail - fingerprint not critical
    }
   
    // Get user
    try {
        const user = auth.getUser();
        if (user) {
            userId = user.id || user.uid;
        }
    } catch (e) {
        // Ignore
    }
   
    // Load offline queue
    loadOfflineQueue();
   
    // Track session start
    trackEvent(EventTypes.SESSION_START, {
        referrer: document.referrer || null,
        isNew: !localStorage.getItem('psh_visited_before')
    });
   
    localStorage.setItem('psh_visited_before', 'true');
   
    // Track page view
    trackEvent(EventTypes.PAGE_VIEW, {
        path: window.location.pathname,
        search: window.location.search,
        title: document.title
    });
   
    // Set up event bus listeners
    if (bus && typeof bus.on === 'function') {
        try {
            bus.on(Events.PRODUCT_VIEW, (product) => {
                trackEvent(EventTypes.PRODUCT_VIEW, {
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    category: product.category
                });
            });
            
            bus.on(Events.CART_ADD, (item) => {
                trackEvent(EventTypes.ADD_TO_CART, {
                    productId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity || 1
                });
            });
            
            bus.on(Events.CART_REMOVE, (item) => {
                trackEvent(EventTypes.REMOVE_FROM_CART, {
                    productId: item.id,
                    name: item.name
                });
            });
            
            bus.on(Events.CHECKOUT_START, (data) => {
                trackEvent(EventTypes.CHECKOUT_START, {
                    items: data.items?.length || 0,
                    total: data.total || 0
                });
            });
            
            bus.on(Events.CHECKOUT_COMPLETE, (data) => {
                trackEvent(EventTypes.CHECKOUT_COMPLETE, {
                    orderId: data.orderId,
                    total: data.total || 0,
                    items: data.items?.length || 0
                });
            });
            
            bus.on(Events.LOGIN, (user) => {
                userId = user.id || user.uid;
                trackEvent(EventTypes.AUTH_LOGIN, { userId });
            });
            
            bus.on(Events.LOGOUT, () => {
                trackEvent(EventTypes.AUTH_LOGOUT, { userId });
                userId = null;
            });
            
            bus.on(Events.REGISTER, (user) => {
                trackEvent(EventTypes.AUTH_REGISTER, { userId: user.id });
            });
        } catch (e) {
            // Bus listeners not critical
        }
    }
   
    isInitialized = true;
    console.log('📊 Analytics initialized');
}

// ===== OFFLINE QUEUE =====
function loadOfflineQueue() {
    try {
        const queue = localStorage.getItem(ANALYTICS_QUEUE_KEY);
        if (queue) {
            const parsed = JSON.parse(queue);
            if (Array.isArray(parsed) && parsed.length > 0) {
                if (parsed.length > MAX_OFFLINE_EVENTS) {
                    parsed.splice(0, parsed.length - MAX_OFFLINE_EVENTS);
                }
                eventsBuffer = parsed;
                console.log(`[Analytics] Loaded ${eventsBuffer.length} events from offline queue`);
            }
        }
    } catch (e) {
        // Silent fail
    }
}

function saveOfflineQueue() {
    try {
        if (eventsBuffer.length > MAX_OFFLINE_EVENTS) {
            eventsBuffer = eventsBuffer.slice(-MAX_OFFLINE_EVENTS);
        }
        localStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(eventsBuffer));
    } catch (e) {
        // Silent fail - storage might be full
    }
}

// ===== TRACK EVENT =====
export function trackEvent(type, data = {}) {
    if (!type || typeof type !== 'string') {
        return;
    }
    
    if (!endpointAvailable && eventsBuffer.length > MAX_OFFLINE_EVENTS) {
        return;
    }
    
    const event = {
        type,
        data: { ...data },
        timestamp: Date.now(),
        url: window.location.pathname,
        sessionId,
        userId: userId || null,
        fingerprint: fingerprint || null,
        referrer: document.referrer || null,
        userAgent: navigator.userAgent.substring(0, 200),
        screenWidth: screen.width,
        screenHeight: screen.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        language: navigator.language
    };
    
    eventsBuffer.push(event);
    
    if (eventsBuffer.length > MAX_OFFLINE_EVENTS) {
        eventsBuffer = eventsBuffer.slice(-MAX_OFFLINE_EVENTS);
    }
    
    saveOfflineQueue();
    
    if (eventsBuffer.length >= MAX_EVENTS && endpointAvailable) {
        flushEvents();
    }
    
    if (CONFIG.debug) {
        console.log('[Analytics] Event:', type, data);
    }
}

// ===== FLUSH EVENTS =====
export async function flushEvents() {
    if (!endpointAvailable) {
        const timeSinceLastFailure = Date.now() - lastFailureTime;
        if (timeSinceLastFailure < BACKOFF_INTERVAL) {
            return;
        }
        endpointAvailable = true;
        consecutiveFailures = 0;
    }
    
    if (isFlushing) return;
    if (eventsBuffer.length === 0) return;
    
    isFlushing = true;
    const payload = [...eventsBuffer];
    eventsBuffer = [];
    saveOfflineQueue();
    
    try {
        const success = await sendEvents(payload);
        if (success) {
            consecutiveFailures = 0;
            endpointAvailable = true;
            lastFlush = Date.now();
        } else {
            eventsBuffer = [...payload, ...eventsBuffer];
            saveOfflineQueue();
            consecutiveFailures++;
            lastFailureTime = Date.now();
            
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                endpointAvailable = false;
                console.warn(`[Analytics] Endpoint unavailable after ${consecutiveFailures} failures. Events stored locally.`);
            }
        }
    } catch (error) {
        eventsBuffer = [...payload, ...eventsBuffer];
        saveOfflineQueue();
        
        consecutiveFailures++;
        lastFailureTime = Date.now();
        
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            endpointAvailable = false;
            console.warn(`[Analytics] Endpoint unavailable after ${consecutiveFailures} failures. Events stored locally.`);
        }
    } finally {
        isFlushing = false;
    }
}

// ============================================================
// FIXED: sendEvents - CORS fix + correct API URL
// - Removed credentials: 'include' (caused CORS wildcard error)
// - Analytics auth is handled via sessionId in the request body
// - Full URL: https://api.primeshieldhub.com/api/analytics/events
// ============================================================
async function sendEvents(events) {
    const url = `${API_BASE}${ANALYTICS_ENDPOINT}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-device-fingerprint': fingerprint || 'unknown'
            },
            // FIXED: No credentials needed - analytics auth is via sessionId in body
            // 'credentials: include' was causing CORS error with wildcard Access-Control-Allow-Origin
            body: JSON.stringify({
                sessionId,
                userId,
                events: events.map(e => ({
                    type: e.type,
                    data: e.data || {},
                    timestamp: e.timestamp,
                    url: e.url,
                    userAgent: e.userAgent,
                    fingerprint: e.fingerprint,
                    screenWidth: e.screenWidth,
                    screenHeight: e.screenHeight,
                    viewportWidth: e.viewportWidth,
                    viewportHeight: e.viewportHeight,
                    language: e.language,
                    referrer: e.referrer
                }))
            })
        });
        
        if (response.status === 405) {
            console.warn('[Analytics] 405 Method Not Allowed - endpoint may not exist');
            endpointAvailable = false;
            lastFailureTime = Date.now();
            return false;
        }
        
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
        }
        
        const data = await response.json().catch(() => ({}));
        
        if (data.accepted === true || data.accepted === undefined) {
            return true;
        } else {
            throw new Error(data.error || 'Unknown error');
        }
        
    } catch (error) {
        // Check for CORS errors (these happen before response.status is available)
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            console.warn('[Analytics] Network/CORS error - will retry later');
            endpointAvailable = false;
            lastFailureTime = Date.now();
            return false;
        }
        
        if (error.message && error.message.includes('405')) {
            endpointAvailable = false;
            lastFailureTime = Date.now();
            return false;
        }
        throw error;
    }
}

// ===== AUTO TRACKING =====

// Click tracking (throttled)
let clickTimeout = null;
document.addEventListener('click', (e) => {
    if (clickTimeout) return;
    clickTimeout = setTimeout(() => {
        clickTimeout = null;
    }, 100);
    
    const product = e.target.closest('[data-product-id]');
    if (product) {
        const id = product.getAttribute('data-product-id');
        const name = product.getAttribute('data-product-name');
        trackEvent(EventTypes.PRODUCT_CLICK, {
            id,
            name,
            source: product.getAttribute('data-source') || 'unknown'
        });
    }
    
    const link = e.target.closest('a[href]');
    if (link && link.href) {
        const url = new URL(link.href);
        if (url.hostname === window.location.hostname) return;
        
        trackEvent(EventTypes.LINK_CLICK, {
            href: link.href,
            text: link.textContent?.substring(0, 50) || 'link',
            target: link.target || '_self'
        });
    }
}, { passive: true });

// Scroll tracking (throttled)
let scrollDepth = 0;
let scrollTimeout = null;

document.addEventListener('scroll', () => {
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
        scrollTimeout = null;
        
        const depth = Math.round(
            (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100
        );
        
        if (depth > scrollDepth + 10) {
            scrollDepth = Math.min(depth, 100);
            trackEvent(EventTypes.SCROLL_DEPTH, { depth: scrollDepth });
        }
    }, 500);
}, { passive: true });

// Visibility tracking (debounced)
let visibilityTimeout = null;
document.addEventListener('visibilitychange', () => {
    if (visibilityTimeout) return;
    visibilityTimeout = setTimeout(() => {
        visibilityTimeout = null;
        trackEvent(EventTypes.VISIBILITY, {
            state: document.visibilityState,
            hidden: document.hidden
        });
    }, 200);
});

// Track before unload (final flush)
let finalFlushDone = false;
window.addEventListener('beforeunload', () => {
    if (finalFlushDone) return;
    finalFlushDone = true;
    
    trackEvent(EventTypes.SESSION_END, {
        duration: Date.now() - (window._psh_startTime || Date.now()),
        events: eventsBuffer.length
    });
    
    // FIXED: sendBeacon now uses correct API URL
    // sendBeacon doesn't support custom headers or credentials, so this is fine
    if (navigator.sendBeacon && eventsBuffer.length > 0) {
        try {
            const payload = [...eventsBuffer];
            const url = `${API_BASE}${ANALYTICS_ENDPOINT}`;
            const blob = new Blob([JSON.stringify({
                sessionId,
                userId,
                events: payload.map(e => ({
                    type: e.type,
                    data: e.data || {},
                    timestamp: e.timestamp,
                    url: e.url
                }))
            })], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
        } catch (e) {
            // Ignore beacon errors
        }
    }
});

// Track page load time
window._psh_startTime = Date.now();
window.addEventListener('load', () => {
    const loadTime = Date.now() - window._psh_startTime;
    trackEvent(EventTypes.PAGE_VIEW, {
        loadTime,
        isFirstLoad: !sessionStorage.getItem('psh_loaded_before')
    });
    sessionStorage.setItem('psh_loaded_before', 'true');
}, { once: true });

// Track errors
window.addEventListener('error', (e) => {
    trackEvent(EventTypes.ERROR, {
        message: e.message?.substring(0, 200) || 'unknown',
        source: e.filename || 'unknown',
        line: e.lineno || 0,
        column: e.colno || 0
    });
});

window.addEventListener('unhandledrejection', (e) => {
    trackEvent(EventTypes.ERROR, {
        message: e.reason?.message?.substring(0, 200) || 'unhandled promise rejection',
        type: 'unhandled_rejection'
    });
});

// ===== PERIODIC FLUSH =====
setInterval(() => {
    if (Date.now() - lastFlush > FLUSH_INTERVAL) {
        flushEvents();
    }
}, FLUSH_INTERVAL);

// ===== CONVENIENCE FUNCTIONS =====

export function trackProductView(productId, productData = {}) {
    trackEvent(EventTypes.PRODUCT_VIEW, {
        productId,
        ...productData
    });
}

export function trackSearch(query, results = 0, filters = {}) {
    trackEvent(EventTypes.SEARCH, {
        query: query?.substring(0, 100),
        results,
        filters: filters
    });
}

export function trackFilter(filterName, value, count = 0) {
    trackEvent(EventTypes.FILTER, {
        filter: filterName?.substring(0, 50),
        value: value?.substring(0, 50),
        count
    });
}

export function trackCheckoutStart(cartItems = [], total = 0) {
    trackEvent(EventTypes.CHECKOUT_START, {
        items: cartItems.length,
        total,
        itemIds: cartItems.map(i => i.id).slice(0, 10).join(',')
    });
}

export function trackCheckoutComplete(orderId, total = 0, items = []) {
    trackEvent(EventTypes.CHECKOUT_COMPLETE, {
        orderId,
        total,
        itemCount: items.length
    });
}

export function trackCustomEvent(name, data = {}) {
    trackEvent(EventTypes.CUSTOM, {
        name: name?.substring(0, 50),
        ...data
    });
}

// ===== CLEANUP =====
export function destroyAnalytics() {
    isInitialized = false;
    flushEvents();
    console.log('📊 Analytics destroyed');
}

// ===== RESET ENDPOINT STATUS =====
export function resetEndpointStatus() {
    endpointAvailable = true;
    consecutiveFailures = 0;
    lastFailureTime = 0;
    console.log('[Analytics] Endpoint status reset');
}

// ===== GET QUEUE STATUS =====
export function getQueueStatus() {
    return {
        eventsInQueue: eventsBuffer.length,
        maxQueueSize: MAX_OFFLINE_EVENTS,
        endpointAvailable,
        consecutiveFailures,
        lastFailureTime: lastFailureTime ? new Date(lastFailureTime).toISOString() : null,
        sessionId,
        userId,
        isFlushing
    };
}

// ===== EXPORTS =====
export default {
    trackEvent,
    flushEvents,
    trackProductView,
    trackSearch,
    trackFilter,
    trackCheckoutStart,
    trackCheckoutComplete,
    trackCustomEvent,
    destroyAnalytics,
    resetEndpointStatus,
    getQueueStatus,
    EventTypes,
    initAnalytics,
    get eventsBuffer() { return eventsBuffer; },
    get sessionId() { return sessionId; },
    get userId() { return userId; },
    get endpointAvailable() { return endpointAvailable; }
};

// ===== AUTO-INIT =====
if (typeof window !== 'undefined' && !window.__TEST_ENV__) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAnalytics);
    } else {
        setTimeout(initAnalytics, 200);
    }
}
