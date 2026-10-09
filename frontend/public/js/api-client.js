// ============================================================================
// frontend/public/js/api-client.js - Unified API Client v2.4
// ============================================================================
// Single source of truth for all API calls in PrimeShieldHub
// Features: Auto-fingerprint, CSRF protection, FormData support, retry logic
// FIXED: Login now handles sessionId (NOT JWT token)
// FIXED: Proper token handling with fallbacks
// FIXED: Added STORAGE_KEYS fallback for missing TOKEN key
// UPDATED: Added store_type filtering for Gadgets and BuildMart
// FIXED: Removed duplicate /api/ prefix from all endpoints (baseURL already has /api)
// FIXED: Added sendAnalytics method for analytics/events endpoint
// FIXED: Added syncCart method for cart-store.js integration
// FIXED: CRITICAL - 401 on non-auth endpoints no longer logs out the user
// ============================================================================

import { CONFIG } from './config.js';

// ===== CONSTANTS =====
const API_BASE = CONFIG.apiBase || 'https://api.primeshieldhub.com/api';

// ============================================================
// FIXED: Safely handle STORAGE_KEYS with fallbacks
// ============================================================
const STORAGE_KEYS = CONFIG.STORAGE_KEYS || {};

// Define token keys with multiple fallbacks
const TOKEN_KEY = STORAGE_KEYS.TOKEN || 'psh_auth_token';
const USER_KEY = STORAGE_KEYS.USER || 'psh_user';
const GUEST_ID_KEY = STORAGE_KEYS.GUEST_ID || 'psh_guest_id';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// ===== API CLIENT =====
class APIClient {
    constructor() {
        this.baseURL = API_BASE;
        this.token = null;
        this._pendingRequests = new Map();
        this._csrfToken = null;
        
        // Load token from storage
        this._loadToken();
    }

    // ===== TOKEN MANAGEMENT =====
    _loadToken() {
        try {
            // Try auth module first
            if (window.auth && window.auth.getToken) {
                this.token = window.auth.getToken();
                if (this.token) return;
            }
        } catch(e) {}
        
        // Fallback to localStorage
        this.token = localStorage.getItem(TOKEN_KEY) || 
                     localStorage.getItem('psh_auth_token') || 
                     sessionStorage.getItem(TOKEN_KEY) ||
                     sessionStorage.getItem('psh_auth_token') ||
                     null;
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
            sessionStorage.setItem(TOKEN_KEY, token);
        } else {
            localStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(TOKEN_KEY);
        }
    }

    getToken() {
        // Return in-memory token if available
        if (this.token) return this.token;
        
        // Check localStorage
        const token = localStorage.getItem(TOKEN_KEY) || 
                      localStorage.getItem('psh_auth_token') ||
                      sessionStorage.getItem(TOKEN_KEY) ||
                      sessionStorage.getItem('psh_auth_token') ||
                      null;
        
        if (token) {
            this.token = token;
            return token;
        }
        
        return null;
    }

    // ===== CSRF TOKEN =====
    async _getCSRFToken() {
        if (this._csrfToken) return this._csrfToken;
        
        try {
            const response = await fetch(`${this.baseURL}/auth/csrf`, {
                credentials: 'include',
                headers: {
                    'x-device-fingerprint': await this._getFingerprint()
                }
            });
            
            if (response.ok) {
                this._csrfToken = await response.text();
                // Store in meta tag if available
                const meta = document.querySelector('meta[name="csrf-token"]');
                if (meta) meta.setAttribute('content', this._csrfToken);
                return this._csrfToken;
            }
        } catch(e) {
            console.warn('[APIClient] CSRF fetch failed:', e);
        }
        return null;
    }

    // ===== FINGERPRINT =====
    async _getFingerprint() {
        try {
            // Try to import fingerprint module
            try {
                const module = await import('../js/sophisticated/fraud-engine/fingerprint.js');
                if (module && typeof module.getDeviceFingerprint === 'function') {
                    return await module.getDeviceFingerprint();
                }
            } catch(e) {
                // Module not available
            }
            
            // Fallback fingerprint
            const components = [
                navigator.userAgent,
                navigator.language,
                navigator.platform,
                screen.width,
                screen.height,
                screen.colorDepth,
                navigator.hardwareConcurrency || 4,
                new Date().getTimezoneOffset()
            ].join('|||');
            const hashBuffer = await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(components)
            );
            return Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .substring(0, 32);
        } catch(err) {
            return 'fallback-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        }
    }

    // ===== MAIN REQUEST =====
    async request(endpoint, options = {}) {
        const {
            method = 'GET',
            body,
            headers = {},
            requireAuth = true,
            retries = MAX_RETRIES,
            skipCSRF = false,
            timeout = 30000,
            redirectOnAuth = true,
            redirectUrl = '/login'
        } = options;

        const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
        
        // Build request key for deduplication
        const requestKey = `${method}:${url}:${JSON.stringify(body || {})}`;
        
        // Check for pending duplicate request
        if (this._pendingRequests.has(requestKey)) {
            return this._pendingRequests.get(requestKey);
        }

        // Execute request with retry logic
        const executeRequest = async (attempt = 0) => {
            try {
                // Get fingerprint (for all requests)
                const fingerprint = await this._getFingerprint();
                
                // Get token if required
                let token = null;
                if (requireAuth) {
                    token = this.getToken();
                    if (!token) {
                        throw new Error('Authentication required');
                    }
                }

                // Get CSRF token for non-GET requests
                let csrfToken = null;
                if (!skipCSRF && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
                    csrfToken = await this._getCSRFToken();
                }

                // Build headers
                const finalHeaders = new Headers({
                    'Accept': 'application/json',
                    'x-device-fingerprint': fingerprint,
                    ...headers
                });

                // Add auth token (this is the session ID, stored as Bearer token)
                if (token) {
                    finalHeaders.set('Authorization', `Bearer ${token}`);
                }

                // Add CSRF token
                if (csrfToken) {
                    finalHeaders.set('X-CSRF-Token', csrfToken);
                }

                // Only set Content-Type if not FormData
                if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
                    finalHeaders.set('Content-Type', 'application/json');
                }

                // Build request options
                const fetchOptions = {
                    method,
                    headers: finalHeaders,
                    credentials: 'include'
                };

                // Add timeout if supported
                if (AbortSignal.timeout) {
                    fetchOptions.signal = AbortSignal.timeout(timeout);
                }

                // Handle body
                if (body) {
                    if (body instanceof FormData || body instanceof URLSearchParams) {
                        fetchOptions.body = body;
                    } else {
                        fetchOptions.body = JSON.stringify(body);
                    }
                }

                // Execute fetch
                const response = await fetch(url, fetchOptions);

                // ============================================================
                // FIXED: Handle 401 Unauthorized - CRITICAL FIX
                // Only clear auth state for auth-critical endpoints.
                // Cart, products, etc. returning 401 should NOT log the user out!
                // The session may still be valid for other operations.
                // ============================================================
                if (response.status === 401) {
                    const isAuthCritical = 
                        endpoint.includes('/auth/login') || 
                        endpoint.includes('/auth/admin-login') ||
                        endpoint === '/auth/me' ||
                        endpoint === '/auth/check' ||
                        endpoint === '/auth/refresh' ||
                        endpoint === '/auth/logout';
                    
                    if (isAuthCritical) {
                        // Clear token and user - session is truly expired
                        console.warn(`[APIClient] 401 on auth endpoint: ${endpoint} - clearing session`);
                        this.setToken(null);
                        try {
                            if (window.auth && window.auth.setUser) {
                                window.auth.setUser(null);
                            }
                            if (window.auth && window.auth.clearToken) {
                                window.auth.clearToken();
                            }
                        } catch(e) {}
                        
                        // Check if we should redirect
                        if (redirectOnAuth !== false) {
                            const currentPath = window.location.pathname;
                            if (!currentPath.includes('/login') && 
                                !currentPath.includes('/admin-login') &&
                                !currentPath.includes('/staff-login') &&
                                !currentPath.includes('/register')) {
                                // Store the current URL to redirect back after login
                                sessionStorage.setItem('redirect_after_login', window.location.href);
                                window.location.href = redirectUrl;
                            }
                        }
                        
                        throw new Error('Session expired');
                    } else {
                        // Non-auth endpoint 401 - DON'T clear user!
                        // The cart or product endpoint might have its own auth issues
                        // but the session itself is still valid
                        console.warn(`[APIClient] 401 on non-auth endpoint: ${endpoint} - keeping session intact`);
                        throw new Error('Authentication required');
                    }
                }

                // Parse response
                const contentType = response.headers.get('content-type') || '';
                let data;
                if (contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    const text = await response.text();
                    try {
                        data = JSON.parse(text);
                    } catch(e) {
                        data = text;
                    }
                }

                // Handle error responses
                if (!response.ok) {
                    const errorMsg = data?.error || data?.message || `Request failed: ${response.status}`;
                    throw new Error(errorMsg);
                }

                return data;

            } catch (error) {
                // Retry logic for network errors
                if (attempt < retries && 
                    (error.name === 'TypeError' || error.name === 'AbortError' || 
                     error.message.includes('network') || error.message.includes('fetch') ||
                     error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT'))) {
                    console.warn(`[APIClient] Retry ${attempt + 1}/${retries} for ${endpoint}`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
                    return executeRequest(attempt + 1);
                }
                throw error;
            }
        };

        // Store pending request
        const promise = executeRequest();
        this._pendingRequests.set(requestKey, promise);
        
        try {
            return await promise;
        } finally {
            this._pendingRequests.delete(requestKey);
        }
    }

    // ===== CONVENIENCE METHODS =====
    get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    post(endpoint, data, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body: data });
    }

    put(endpoint, data, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body: data });
    }

    patch(endpoint, data, options = {}) {
        return this.request(endpoint, { ...options, method: 'PATCH', body: data });
    }

    delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    // ===== UPLOAD =====
    upload(endpoint, formData, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: formData,
            headers: {
                // Don't set Content-Type for FormData
                ...(options.headers || {})
            }
        });
    }

    // ================================================================
    // PRODUCTS API - GADGETS (Main Site)
    // ================================================================
    
    /**
     * Get products - Gadgets site (main site)
     * Automatically filters to show only gadgets products
     * 
     * @param {Object} options - Filter options
     * @param {string} options.category - Category filter
     * @param {string} options.search - Search query
     * @param {string} options.brand - Brand filter
     * @param {number} options.minPrice - Minimum price
     * @param {number} options.maxPrice - Maximum price
     * @param {string} options.stock - Stock filter: 'all', 'in', 'out', 'low'
     * @param {boolean} options.featured - Show only featured products
     * @param {number} options.limit - Results per page (default: 50)
     * @param {number} options.offset - Pagination offset (default: 0)
     * @param {string} options.store - Store type: 'gadgets', 'buildmart', 'both' (default: 'gadgets')
     * @returns {Promise<Object>} Products response
     */
    async getProducts(options = {}) {
        const {
            category = '',
            search = '',
            brand = '',
            minPrice = 0,
            maxPrice = 999999999,
            stock = 'all',
            featured = false,
            limit = 50,
            offset = 0,
            store = 'gadgets' // Default to gadgets for main site
        } = options;

        const params = new URLSearchParams();
        params.append('store', store);
        if (category) params.append('category', category);
        if (search) params.append('search', search);
        if (brand) params.append('brand', brand);
        if (minPrice > 0) params.append('minPrice', minPrice);
        if (maxPrice < 999999999) params.append('maxPrice', maxPrice);
        if (stock !== 'all') params.append('stock', stock);
        if (featured) params.append('featured', 'true');
        params.append('limit', limit);
        params.append('offset', offset);

        return this.get(`/products?${params.toString()}`, { requireAuth: false });
    }

    // ================================================================
    // PRODUCTS API - BUILD MART
    // ================================================================
    
    /**
     * Get BuildMart products - BuildMart site
     * Filters to show only building materials
     * 
     * @param {Object} options - Filter options
     * @param {string} options.category - Category filter
     * @param {string} options.search - Search query
     * @param {string} options.brand - Brand filter
     * @param {number} options.minPrice - Minimum price
     * @param {number} options.maxPrice - Maximum price
     * @param {string} options.stock - Stock filter: 'all', 'in', 'out', 'low'
     * @param {boolean} options.featured - Show only featured products
     * @param {number} options.limit - Results per page (default: 20)
     * @param {number} options.offset - Pagination offset (default: 0)
     * @returns {Promise<Object>} Products response
     */
    async getBuildMartProducts(options = {}) {
        const {
            category = '',
            search = '',
            brand = '',
            minPrice = 0,
            maxPrice = 999999999,
            stock = 'all',
            featured = false,
            limit = 20,
            offset = 0
        } = options;

        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (search) params.append('search', search);
        if (brand) params.append('brand', brand);
        if (minPrice > 0) params.append('minPrice', minPrice);
        if (maxPrice < 999999999) params.append('maxPrice', maxPrice);
        if (stock !== 'all') params.append('stock', stock);
        if (featured) params.append('featured', 'true');
        params.append('limit', limit);
        params.append('offset', offset);

        return this.get(`/buildmart/products?${params.toString()}`, { requireAuth: false });
    }

    // ================================================================
    // PRODUCTS API - SINGLE PRODUCT
    // ================================================================
    
    /**
     * Get single product by ID (Gadgets)
     * 
     * @param {string|number} id - Product ID
     * @param {string} store - Store type: 'gadgets', 'buildmart'
     * @returns {Promise<Object>} Product data
     */
    async getProduct(id, store = 'gadgets') {
        return this.get(`/products/${id}?store=${store}`, { requireAuth: false });
    }

    /**
     * Get single BuildMart product by ID
     * 
     * @param {string|number} id - Product ID
     * @returns {Promise<Object>} Product data
     */
    async getBuildMartProduct(id) {
        return this.get(`/buildmart/products/${id}`, { requireAuth: false });
    }

    // ================================================================
    // PRODUCTS API - CATEGORIES
    // ================================================================
    
    /**
     * Get all categories for a store
     * 
     * @param {string} store - Store type: 'gadgets', 'buildmart'
     * @returns {Promise<Object>} Categories
     */
    async getCategories(store = 'gadgets') {
        return this.get(`/categories?store=${store}`, { requireAuth: false });
    }

    /**
     * Get BuildMart categories
     * 
     * @returns {Promise<Object>} BuildMart categories
     */
    async getBuildMartCategories() {
        return this.get('/buildmart/categories', { requireAuth: false });
    }

    // ================================================================
    // AUTH HELPERS - FIXED: Uses sessionId, NOT JWT token
    // ================================================================
    
    /**
     * Login user
     * 
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} Login response with session ID
     */
    async login(email, password) {
        const data = await this.post('/auth/login', { email, password }, { 
            requireAuth: false,
            skipCSRF: true 
        });
        
        console.log('🔍 Login response in api-client:', data);
        
        // FIX: The backend returns sessionId, NOT token!
        // The session ID is a short string like "SWKCJJvCHjYExS21cAaaq"
        // NOT a JWT token (long string with dots)
        const sessionId = data.sessionId || data.session || data.token || data.data?.token || null;
        
        if (sessionId) {
            console.log('🔑 Storing session ID in api-client:', sessionId);
            console.log('📝 Session ID type:', typeof sessionId);
            console.log('📝 Is JWT?', sessionId.includes('.') ? 'YES (JWT)' : 'NO (Session ID)');
            this.setToken(sessionId);
        } else {
            console.warn('⚠️ No session ID found in login response. Response keys:', Object.keys(data));
            // Fallback: if there's a token, use it but warn
            if (data.token) {
                console.warn('⚠️ Falling back to token (JWT) - this may not work with session-based auth!');
                this.setToken(data.token);
            }
        }
        
        return data;
    }

    // ===== ADMIN LOGIN (specific for admin panel) =====
    async adminLogin(email, password) {
        const data = await this.post('/auth/admin-login', { email, password }, { 
            requireAuth: false,
            skipCSRF: true 
        });
        
        console.log('🔍 Admin login response in api-client:', data);
        
        // FIX: The backend returns sessionId, NOT token!
        const sessionId = data.sessionId || data.session || data.token || data.data?.token || null;
        
        if (sessionId) {
            console.log('🔑 Storing admin session ID in api-client:', sessionId);
            console.log('📝 Is JWT?', sessionId.includes('.') ? 'YES (JWT)' : 'NO (Session ID)');
            this.setToken(sessionId);
        } else {
            console.warn('⚠️ No session ID found in admin login response. Response keys:', Object.keys(data));
            if (data.token) {
                console.warn('⚠️ Falling back to token (JWT) - this may not work!');
                this.setToken(data.token);
            }
        }
        
        return data;
    }

    // ===== ADMIN REGISTER =====
    async adminRegister(name, email, phone, password, adminCode) {
        const data = await this.post('/auth/admin-register', { 
            name, email, phone, password, adminCode 
        }, { 
            requireAuth: false,
            skipCSRF: true 
        });
        
        console.log('🔍 Admin register response in api-client:', data);
        
        // FIX: The backend returns sessionId, NOT token!
        const sessionId = data.sessionId || data.session || data.token || data.data?.token || null;
        
        if (sessionId) {
            console.log('🔑 Storing admin session ID from registration:', sessionId);
            this.setToken(sessionId);
        }
        
        return data;
    }

    // ===== REGULAR REGISTER =====
    async register(userData) {
        const data = await this.post('/auth/register', userData, { 
            requireAuth: false,
            skipCSRF: true 
        });
        
        console.log('🔍 Register response in api-client:', data);
        
        // FIX: The backend returns sessionId, NOT token!
        const sessionId = data.sessionId || data.session || data.token || data.data?.token || null;
        
        if (sessionId) {
            console.log('🔑 Storing session ID from registration:', sessionId);
            this.setToken(sessionId);
        }
        
        return data;
    }

    async logout() {
        try {
            await this.post('/auth/logout', {}, { requireAuth: true });
        } catch(e) {
            // Ignore errors on logout
        }
        
        this.setToken(null);
        try {
            if (window.auth && window.auth.setUser) {
                window.auth.setUser(null);
            }
            if (window.auth && window.auth.clearToken) {
                window.auth.clearToken();
            }
        } catch(e) {}
    }

    // ================================================================
    // CART API - FIXED: Removed duplicate /api/ prefix
    // baseURL already includes /api, so endpoints should NOT have /api/
    // e.g., baseURL = 'https://api.primeshieldhub.com/api'
    //       endpoint = '/cart'  →  full URL = 'https://api.primeshieldhub.com/api/cart' ✓
    // ================================================================
    
    /**
     * Get user's cart
     * 
     * @returns {Promise<Object>} Cart data
     */
    async getCart() {
        return this.get('/cart');
    }

    /**
     * Add item to cart
     * 
     * @param {string|number} productId - Product ID
     * @param {number} quantity - Quantity
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Updated cart
     */
    async addToCart(productId, quantity = 1, options = {}) {
        return this.post('/cart/add', { productId, quantity, ...options });
    }

    /**
     * Update cart item
     * 
     * @param {string|number} productId - Product ID
     * @param {number} quantity - New quantity
     * @returns {Promise<Object>} Updated cart
     */
    async updateCartItem(productId, quantity) {
        return this.put(`/cart/update/${productId}`, { quantity });
    }

    /**
     * Remove item from cart
     * 
     * @param {string|number} productId - Product ID
     * @returns {Promise<Object>} Updated cart
     */
    async removeFromCart(productId) {
        return this.delete(`/cart/remove/${productId}`);
    }

    /**
     * Clear cart
     * 
     * @returns {Promise<Object>} Empty cart response
     */
    async clearCart() {
        return this.delete('/cart/clear');
    }

    /**
     * Apply discount to cart
     * 
     * @param {string} code - Discount code
     * @returns {Promise<Object>} Updated cart with discount
     */
    async applyDiscount(code) {
        return this.post('/cart/discount', { code });
    }

    /**
     * Sync cart with server
     * 
     * @param {Object} data - Cart data to sync
     * @returns {Promise<Object>} Sync response
     */
    async syncCart(data) {
        return this.post('/cart/sync', data);
    }

    // ================================================================
    // CHECKOUT API
    // ================================================================
    
    /**
     * Create checkout session
     * 
     * @param {Object} data - Checkout data
     * @returns {Promise<Object>} Checkout session
     */
    async createCheckout(data) {
        return this.post('/checkout', data);
    }

    /**
     * Verify payment
     * 
     * @param {string} reference - Payment reference
     * @returns {Promise<Object>} Payment verification
     */
    async verifyPayment(reference) {
        return this.get(`/payment/verify?reference=${reference}`, { requireAuth: false });
    }

    // ================================================================
    // ORDERS API
    // ================================================================
    
    /**
     * Get user's orders
     * 
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} Orders list
     */
    async getOrders(options = {}) {
        const { limit = 20, offset = 0 } = options;
        return this.get(`/orders?limit=${limit}&offset=${offset}`);
    }

    /**
     * Get single order
     * 
     * @param {string|number} orderId - Order ID
     * @returns {Promise<Object>} Order details
     */
    async getOrder(orderId) {
        return this.get(`/orders/${orderId}`);
    }

    /**
     * Track order by tracking ID
     * 
     * @param {string} trackingId - Tracking ID
     * @returns {Promise<Object>} Order tracking details
     */
    async trackOrder(trackingId) {
        return this.get(`/orders/track/${trackingId}`, { requireAuth: false });
    }

    // ================================================================
    // USER API
    // ================================================================
    
    /**
     * Get current user profile
     * 
     * @returns {Promise<Object>} User profile
     */
    async getProfile() {
        return this.get('/auth/me');
    }

    /**
     * Update user profile
     * 
     * @param {Object} data - Profile data
     * @returns {Promise<Object>} Updated profile
     */
    async updateProfile(data) {
        return this.put('/user/profile', data);
    }

    /**
     * Get user addresses
     * 
     * @returns {Promise<Object>} Addresses
     */
    async getAddresses() {
        return this.get('/user/addresses');
    }

    /**
     * Add user address
     * 
     * @param {Object} data - Address data
     * @returns {Promise<Object>} Added address
     */
    async addAddress(data) {
        return this.post('/user/addresses', data);
    }

    // ================================================================
    // WISHLIST API
    // ================================================================
    
    /**
     * Get user's wishlist
     * 
     * @returns {Promise<Object>} Wishlist data
     */
    async getWishlist() {
        return this.get('/wishlist');
    }

    /**
     * Add item to wishlist
     * 
     * @param {string|number} productId - Product ID
     * @returns {Promise<Object>} Updated wishlist
     */
    async addToWishlist(productId) {
        return this.post('/wishlist/add', { productId });
    }

    /**
     * Remove item from wishlist
     * 
     * @param {string|number} productId - Product ID
     * @returns {Promise<Object>} Updated wishlist
     */
    async removeFromWishlist(productId) {
        return this.delete(`/wishlist/remove/${productId}`);
    }

    // ================================================================
    // ANALYTICS API - FIXED: Added sendAnalytics method
    // ================================================================
    
    /**
     * Send analytics events
     * Uses direct fetch to avoid credentials: 'include' which causes CORS errors
     * with wildcard Access-Control-Allow-Origin
     * 
     * @param {Array} events - Array of events
     * @param {Object} options - Options
     * @param {string} options.sessionId - Analytics session ID
     * @param {string} options.userId - User ID
     * @returns {Promise<Object>} Response
     */
    async sendAnalytics(events, options = {}) {
        const { sessionId, userId } = options;
        const url = `${this.baseURL}/analytics/events`;
        const fingerprint = await this._getFingerprint();
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-fingerprint': fingerprint || 'unknown'
                },
                // FIXED: No credentials - analytics auth is via sessionId in body
                // This prevents CORS error with wildcard Access-Control-Allow-Origin
                body: JSON.stringify({ events, sessionId, userId })
            });
            
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
            }
            
            return await response.json().catch(() => ({}));
        } catch (error) {
            // Analytics failures should never break the app
            console.warn('[APIClient] Analytics send failed:', error.message);
            return { accepted: false, error: error.message };
        }
    }

    // ================================================================
    // UTILITY
    // ================================================================
    
    clearCache() {
        this._csrfToken = null;
        this._pendingRequests.clear();
    }

    isAuthenticated() {
        return !!this.getToken();
    }

    // ===== DEBUG: Check what token is stored =====
    debugToken() {
        const token = this.getToken();
        console.log('🔍 Current token:', token);
        if (token) {
            console.log('📝 Token length:', token.length);
            console.log('📝 Has dots?', token.includes('.') ? 'YES (likely JWT)' : 'NO (likely session ID)');
            console.log('📝 Starts with eyJ?', token.startsWith('eyJ') ? 'YES (JWT)' : 'NO (session ID)');
        } else {
            console.log('❌ No token found');
        }
        return token;
    }
}

// ===== SINGLETON INSTANCE =====
export const api = new APIClient();

// ===== GLOBAL EXPOSURE =====
if (typeof window !== 'undefined') {
    window.API = api;
    window.APIClient = api;
    
    // For legacy code
    window.apiRequest = api.request.bind(api);
    
    // Add debug helper
    window.debugToken = api.debugToken.bind(api);
    
    console.log('✅ API Client v2.4 loaded - 401 protection active');
    console.log('💡 Run window.debugToken() to check current token');
    console.log('💡 Run API.debugToken() to check current token');
    
    // Expose product functions globally
    window.getProducts = api.getProducts.bind(api);
    window.getBuildMartProducts = api.getBuildMartProducts.bind(api);
    window.getProduct = api.getProduct.bind(api);
    window.getBuildMartProduct = api.getBuildMartProduct.bind(api);
}

// ===== DEFAULT EXPORT =====
export default api;
