// ============================================================================
// config.js - Central Configuration for PrimeShieldHub v3.5 (PRODUCTION)
// ============================================================================
// Single source of truth for all application configuration.
// ✅ SECURE: No secrets exposed - all sensitive data in Cloudflare Workers
// ✅ ES Module format for modern browsers
// ============================================================================

// ===== ENVIRONMENT DETECTION =====
const IS_HTTPS = window.location.protocol === 'https:';
const IS_PROD = true;

// ===== API CONFIGURATION - PRODUCTION ONLY =====
const API_BASE = "https://api.primeshieldhub.com/api";

// ===== AUTH CONFIGURATION =====
const AUTH_CONFIG = {
    tokenKey: 'psh_auth_token',
    userKey: 'psh_user',
    adminUserKey: 'psh_admin_user',
    refreshTokenKey: 'psh_refresh_token',
    sessionKey: 'psh_session',
    tokenExpiryKey: 'psh_token_expiry',
    
    getToken: function() {
        return localStorage.getItem(this.tokenKey) || 
               sessionStorage.getItem(this.tokenKey) ||
               null;
    },
    
    setToken: function(token) {
        if (token) {
            localStorage.setItem(this.tokenKey, token);
            sessionStorage.setItem(this.tokenKey, token);
        } else {
            localStorage.removeItem(this.tokenKey);
            sessionStorage.removeItem(this.tokenKey);
        }
    },
    
    getUser: function() {
        const userStr = localStorage.getItem(this.userKey) || 
                       sessionStorage.getItem(this.userKey);
        try {
            return userStr ? JSON.parse(userStr) : null;
        } catch(e) {
            return null;
        }
    },
    
    setUser: function(user) {
        if (user) {
            const userStr = typeof user === 'string' ? user : JSON.stringify(user);
            localStorage.setItem(this.userKey, userStr);
            sessionStorage.setItem(this.userKey, userStr);
        } else {
            localStorage.removeItem(this.userKey);
            sessionStorage.removeItem(this.userKey);
        }
    },
    
    clear: function() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        localStorage.removeItem(this.adminUserKey);
        localStorage.removeItem(this.refreshTokenKey);
        localStorage.removeItem(this.sessionKey);
        localStorage.removeItem(this.tokenExpiryKey);
        sessionStorage.removeItem(this.tokenKey);
        sessionStorage.removeItem(this.userKey);
        console.log('✅ All auth data cleared');
    },
    
    isAuthenticated: function() {
        return !!this.getToken() && !!this.getUser();
    }
};

const API_CONFIG = {
    baseUrl: API_BASE,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    maxUploadSize: 10 * 1024 * 1024,
};

// ===== FEATURE FLAGS =====
const FEATURES = {
    payments: true,
    fraudDetection: true,
    chargingSystem: true,
    staffTracking: true,
    wholesale: true,
    aiAssistant: true,
    loyalty: true,
    analytics: true,
    reports: true,
    wishlist: true,
    cart: true,
    categories: true,
    twoFactorAuth: true,
    voiceSearch: false,
    augmentedReality: false,
    blockchainVerification: true,
    predictivePrefetch: true,
    socialProof: true,
    exitIntent: true,
    liveChat: true,
    adminDashboard: true,
    staffManagement: true,
    inventoryManagement: true,
    orderManagement: true,
    reportGeneration: true,
};

// ===== PAGINATION =====
const PAGINATION = {
    defaultPageSize: 12,
    maxPageSize: 48,
    productPageSize: 12,
    orderPageSize: 20,
    userPageSize: 25,
    adminPageSize: 50,
};

// ===== CURRENCY =====
const CURRENCY = {
    default: 'NGN',
    symbol: '₦',
    locale: 'en-NG',
    decimalPlaces: 0,
    exchangeRate: 1,
    supported: ['NGN', 'USD', 'EUR', 'GBP'],
};

// ===== CACHE =====
const CACHE = {
    ttl: {
        products: 300000,
        categories: 600000,
        user: 300000,
        cart: 60000,
        orders: 300000,
        config: 3600000,
        exchangeRates: 300000,
    },
    maxItems: {
        products: 100,
        categories: 50,
        recentlyViewed: 20,
    },
};

// ===== ROUTES =====
const PAGES = {
    home: "/",
    product: "/product-detail.html",
    products: "/products",
    categories: "/categories",
    cart: "/cart",
    checkout: "/checkout",
    payment: "/payment",
    account: "/account",
    profile: "/profile",
    orders: "/orders",
    trackOrder: "/track-order",
    admin: "/admin",
    adminLogin: "/admin/login",
    staff: "/staff",
    staffLogin: "/staff/login",
    reseller: "/reseller.html",
    resellerLogin: "/reseller/login",
    wholesale: "/wholesale.html",
    wholesaleLogin: "/wholesale/login",
    blog: "/blog",
    faq: "/faq",
    contact: "/contact",
    about: "/about",
    privacy: "/privacy",
    terms: "/terms",
    login: "/login",
    register: "/register",
    logout: "/logout",
    notFound: "/404",
};

// ============================================================
// STORAGE KEYS
// ============================================================
const STORAGE_KEYS = {
    TOKEN: 'psh_auth_token',
    SESSION_ID: 'psh_auth_token',
    USER: 'psh_user',
    ADMIN_USER: 'psh_admin_user',
    TOKEN_EXPIRY: 'psh_token_expiry',
    REFRESH_TOKEN: 'psh_refresh_token',
    SESSION: 'psh_session',
    CART: 'psh_cart',
    WISHLIST: 'psh_wishlist',
    SAVED_ITEMS: 'psh_saved_items',
    ORDERS: 'psh_local_orders',
    RECENTLY_VIEWED: 'psh_recently_viewed',
    COMPARE: 'psh_compare',
    DISCOUNT: 'psh_cart_discount',
    SHIPPING: 'psh_cart_shipping',
    PROFILE: 'psh_user_profile',
    PREFERENCES: 'psh_user_preferences',
    ADDRESSES: 'psh_user_addresses',
    GUEST_ID: 'psh_guest_id',
    DEVICE_FP: 'psh_device_fp',
    DEVICE_FP_HASH: 'psh_device_fp_hash',
    DEVICE_FP_FULL: 'psh_device_fp_full',
    DEVICE_FP_TIME: 'psh_device_fp_time',
    THEME: 'psh_theme',
    LANGUAGE: 'psh_language',
    CURRENCY: 'psh_currency',
    PRODUCTS_CACHE: 'psh_products_cache',
    CATEGORIES_CACHE: 'psh_categories_cache',
};

// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
    appName: 'PrimeShieldHub',
    version: '3.5',
    debug: false,
    isDev: false,
    isProd: true,
    isLocal: false,
    isHttps: IS_HTTPS,
    apiBase: API_CONFIG.baseUrl,
    apiTimeout: API_CONFIG.timeout,
    apiRetryAttempts: API_CONFIG.retryAttempts,
    apiRetryDelay: API_CONFIG.retryDelay,
    maxUploadSize: API_CONFIG.maxUploadSize,
    auth: AUTH_CONFIG,
    features: FEATURES,
    pagination: PAGINATION,
    currency: CURRENCY,
    cache: CACHE,
    pages: PAGES,
    storageKeys: STORAGE_KEYS,
    PAYSTACK_PUBLIC_KEY: document.querySelector('meta[name="paystack-public-key"]')?.content 
        || 'pk_live_4a622e5159e14bb0537ba7066320f44d6b6984de',
    PAYSTACK_CURRENCY: 'NGN',
    TURNSTILE_SITE_KEY: document.querySelector('meta[name="turnstile-site-key"]')?.content 
        || '0x4AAAAAAC_YEMkjRgNCHKH3',
    SUPPORT_PHONE: '2348103535978',
    SUPPORT_EMAIL: 'contact@primeshieldhub.com',
    SUPPORT_HOURS: '24/7',
    social: {
        whatsapp: `https://wa.me/2348103535978`,
        instagram: 'https://instagram.com/primeshieldhub',
        twitter: 'https://twitter.com/primeshieldhub',
        facebook: 'https://facebook.com/primeshieldhub',
        youtube: 'https://youtube.com/@primeshieldhub',
        linkedin: 'https://linkedin.com/company/primeshieldhub',
    },
    DISCOUNT_CODES: {
        'WHOLESALE10': { type: 'percentage', value: 10, minAmount: 100000, description: '10% off for wholesale customers' },
        'RESELLER15': { type: 'percentage', value: 15, minAmount: 500000, description: '15% off for registered resellers' },
        'NEWCUSTOMER': { type: 'percentage', value: 5, minAmount: 0, description: '5% off for new customers' },
        'FREESHIP': { type: 'shipping', value: 0, minAmount: 0, description: 'Free standard shipping' },
        'SAVE20': { type: 'percentage', value: 20, minAmount: 200000, description: '20% off orders over ₦200,000' },
        'WELCOME10': { type: 'percentage', value: 10, minAmount: 0, description: '10% off your first order' },
    },
    SHIPPING_RATES: {
        'Lagos': [
            { id: 'standard', name: 'Standard Delivery', time: '1-2 business days', price: 2000 },
            { id: 'express', name: 'Express Delivery', time: 'Same day', price: 5000 },
            { id: 'pickup', name: 'Store Pickup', time: 'Ready in 2 hours', price: 0 }
        ],
        'Abuja': [
            { id: 'standard', name: 'Standard Delivery', time: '2-3 business days', price: 3000 },
            { id: 'express', name: 'Express Delivery', time: 'Next day', price: 8000 }
        ],
        'Rivers': [
            { id: 'standard', name: 'Standard Delivery', time: '3-4 business days', price: 3500 },
            { id: 'express', name: 'Express Delivery', time: '2 business days', price: 10000 }
        ],
        'Oyo': [
            { id: 'standard', name: 'Standard Delivery', time: '2-3 business days', price: 2500 },
            { id: 'express', name: 'Express Delivery', time: 'Next day', price: 7000 }
        ],
        'Kano': [
            { id: 'standard', name: 'Standard Delivery', time: '4-5 business days', price: 4500 },
            { id: 'express', name: 'Express Delivery', time: '3 business days', price: 12000 }
        ],
        'Delta': [
            { id: 'standard', name: 'Standard Delivery', time: '3-4 business days', price: 3000 },
            { id: 'express', name: 'Express Delivery', time: '2 business days', price: 9000 }
        ],
        'Others': [
            { id: 'standard', name: 'Standard Delivery', time: '5-7 business days', price: 5000 },
            { id: 'express', name: 'Express Delivery', time: '3-4 business days', price: 15000 }
        ]
    },
    FREE_SHIPPING_THRESHOLD: 150000,
};

const auth = AUTH_CONFIG;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getPageUrl(page, params = {}) {
    const base = CONFIG.pages[page] || `/${page}`;
    const query = new URLSearchParams(params).toString();
    return query ? `${base}?${query}` : base;
}

export function goTo(page, params = {}) {
    window.location.href = getPageUrl(page, params);
}

export function goToProduct(productId) {
    goTo("product", { id: productId });
}

export function goToTrackOrder(orderId) {
    goTo("trackOrder", { orderId });
}

export function isProduction() {
    return true;
}

export function getEnvironment() {
    return 'production';
}

export function isFeatureEnabled(feature) {
    return CONFIG.features[feature] === true;
}

export function getApiUrl(path = '') {
    const base = CONFIG.apiBase;
    return path ? `${base}${path.startsWith('/') ? path : `/${path}`}` : base;
}

export function formatCurrency(amount, currency = CURRENCY.default) {
    const symbol = currency === 'NGN' ? '₦' : '$';
    const formatted = Math.round(amount).toLocaleString(CURRENCY.locale);
    return `${symbol}${formatted}`;
}

export function getPageTitle(title) {
    return title ? `${title} | ${CONFIG.appName}` : CONFIG.appName;
}

export function hasFreeShipping(cartTotal) {
    return cartTotal >= CONFIG.FREE_SHIPPING_THRESHOLD;
}

export function getShippingOptions(state) {
    return CONFIG.SHIPPING_RATES[state] || CONFIG.SHIPPING_RATES['Others'] || [];
}

export function validateDiscountCode(code) {
    const discount = CONFIG.DISCOUNT_CODES[code.toUpperCase()];
    if (!discount) return null;
    return { ...discount, code: code.toUpperCase() };
}

// ============================================================
// TOKEN HELPERS
// ============================================================

export function getStoredToken() {
    return localStorage.getItem(STORAGE_KEYS.TOKEN) || 
           sessionStorage.getItem(STORAGE_KEYS.TOKEN) ||
           null;
}

export function debugToken() {
    const token = getStoredToken();
    console.log('🔍 Current token:', token);
    if (token) {
        console.log('📝 Token length:', token.length);
        console.log('📝 Has dots?', token.includes('.') ? 'YES (likely JWT)' : 'NO (session ID)');
        console.log('📝 Starts with eyJ?', token.startsWith('eyJ') ? 'YES (JWT)' : 'NO (session ID)');
    } else {
        console.log('❌ No token found');
    }
    return token;
}

export function clearAuthTokens() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.USER);
    console.log('✅ All auth tokens cleared');
}

// ============================================================
// STORAGE KEYS HELPER
// ============================================================

export function getStorageKeys(key = null) {
    if (key) {
        return STORAGE_KEYS[key] || null;
    }
    return { ...STORAGE_KEYS };
}

// ============================================================
// ✅ SINGLE EXPORT - NO DUPLICATES
// ============================================================
export { 
    CONFIG, 
    STORAGE_KEYS, 
    auth
};

// ============================================================
// DEFAULT EXPORT
// ============================================================
export default {
    CONFIG,
    STORAGE_KEYS,
    auth: AUTH_CONFIG,
    getStorageKeys,
    getPageUrl,
    goTo,
    goToProduct,
    goToTrackOrder,
    isProduction,
    getEnvironment,
    isFeatureEnabled,
    getApiUrl,
    formatCurrency,
    getPageTitle,
    hasFreeShipping,
    getShippingOptions,
    validateDiscountCode,
    getStoredToken,
    debugToken,
    clearAuthTokens,
};

console.log(`🔐 Secure config v${CONFIG.version} loaded (production mode)`);
console.log('✅ No secrets exposed - all sensitive data in Cloudflare Workers');
console.log('🌐 API Base:', API_BASE);
console.log('📦 Storage keys loaded:', Object.keys(STORAGE_KEYS).length);
