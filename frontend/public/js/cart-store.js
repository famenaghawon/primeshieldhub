// ============================================================================
// cart-store.js - Unified Cart Store with Backend Sync v2.6
// ============================================================================
// Single source of truth for cart management with:
// - Guest ID support
// - Backend sync with retry
// - Optimistic updates
// - Stock validation
// - Fingerprint & CSRF protection
// - Event bus integration
// FIXED: Proper STORAGE_KEYS handling with fallbacks
// FIXED: Removed duplicate /api/ prefix from _doSync and _pushToBackend endpoints
// FIXED: Delayed initial sync with proper auth state detection
// FIXED: Auth state change now checks token availability before syncing
// FIXED: Complete corruption cleanup - deletes bad items from both localStorage AND server
// FIXED: checkStaffStatus integration for staff detection
// FIXED: Better error handling for API calls
// ============================================================================

import { CONFIG } from './config.js';
import { api } from './api-client.js';
import { auth } from './auth.js';
import { bus, Events } from './events.js';
import { getDeviceFingerprint } from './sophisticated/fraud-engine/fingerprint.js';

// ============================================================
// FIXED: Safely handle STORAGE_KEYS with fallbacks
// ============================================================
const STORAGE_KEYS = CONFIG?.STORAGE_KEYS || {};

// Define all keys with fallbacks
const TOKEN_KEY = STORAGE_KEYS.TOKEN || 'psh_auth_token';
const USER_KEY = STORAGE_KEYS.USER || 'psh_user';
const CART_KEY = STORAGE_KEYS.CART || 'psh_cart';
const SAVED_ITEMS_KEY = STORAGE_KEYS.SAVED_ITEMS || 'psh_saved_items';
const DISCOUNT_KEY = STORAGE_KEYS.DISCOUNT || 'psh_cart_discount';
const SHIPPING_KEY = STORAGE_KEYS.SHIPPING || 'psh_cart_shipping';
const GUEST_ID_KEY = STORAGE_KEYS.GUEST_ID || 'psh_guest_id';
const CART_CLEANED_KEY = 'psh_cart_corruption_cleaned'; // Flag to track if we've cleaned corruption

const SYNC_RETRY_ATTEMPTS = 3;
const SYNC_RETRY_DELAY = 1000;
const INITIAL_SYNC_DELAY = 3000;
const MAX_INITIAL_RETRIES = 5;

// ============================================================
// checkStaffStatus - Helper function
// ============================================================
function checkStaffStatus() {
    try {
        // Check localStorage for staff tokens
        const staffToken = localStorage.getItem('psh_staff_token');
        if (staffToken) return true;
        
        // Check for staff user in localStorage
        const userStr = localStorage.getItem('psh_user') || 
                       localStorage.getItem('psh_staff_user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user.role === 'staff' || user.role === 'admin') {
                    return true;
                }
                if (user.isStaff === true || user.is_staff === true) {
                    return true;
                }
            } catch (e) {
                // JSON parse failed
            }
        }
        
        // Check if user is in auth
        if (auth && typeof auth.getUser === 'function') {
            const user = auth.getUser();
            if (user && (user.role === 'staff' || user.role === 'admin' || user.isStaff)) {
                return true;
            }
        }
        
        // Check sessionStorage for staff flag
        if (sessionStorage.getItem('psh_staff_mode') === 'true') {
            return true;
        }
        
        return false;
    } catch (e) {
        console.warn('[checkStaffStatus] Error:', e);
        return false;
    }
}

// ============================================================
// Item validation utility function
// ============================================================
function isValidCartItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (!item.id || typeof item.id !== 'string' || item.id.trim() === '') return false;
    if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') return false;
    if (item.name === 'Product' || item.name === 'Product NO' || item.name === 'Unknown') return false;
    if (typeof item.price !== 'number' || item.price <= 0 || isNaN(item.price)) return false;
    if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0 || isNaN(item.quantity)) return false;
    if (item.quantity > 9999) return false; // Sanity check
    return true;
}

// ============================================================
// Retry utility
// ============================================================
async function withRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    }
    throw lastError;
}

// ===== CART STORE CLASS =====
class CartStore {
    constructor() {
        this.items = [];
        this.savedItems = [];
        this.discount = null;
        this.shipping = null;
        this.listeners = [];
        this.isSyncing = false;
        this.guestId = null;
        this._pendingSync = null;
        this._lastSync = null;
        this._syncTimeout = null;
        this._initialized = false;
        this._initialSyncDone = false;
        this._authReady = false;
        this._corruptionCleaned = false;
        this._isStaff = false;
        
        this._init();
    }

    // ===== INITIALIZATION =====
    _init() {
        // Check if we've already cleaned corruption
        try {
            this._corruptionCleaned = localStorage.getItem(CART_CLEANED_KEY) === 'true';
        } catch (e) {
            this._corruptionCleaned = false;
        }
        
        // Check staff status
        this._isStaff = checkStaffStatus();
        
        // Load from storage
        this.loadFromStorage();
        
        // Set up guest ID
        this._ensureGuestId();
        
        // Set up auth listener
        this._setupAuthListener();
        
        // Listen for storage events (cross-tab sync)
        window.addEventListener('storage', (e) => {
            if (e.key === CART_KEY || e.key === SAVED_ITEMS_KEY) {
                this.loadFromStorage();
                this.notifyListeners();
            }
        });
        
        // Auto-sync on visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this._authReady) {
                this.syncWithBackend();
            }
        });

        this._initialized = true;
        
        // Listen for auth module's ready event
        if (window.addEventListener) {
            window.addEventListener('auth:ready', () => {
                console.log('[CartStore] Auth ready event received, attempting sync');
                this._authReady = true;
                this._isStaff = checkStaffStatus();
                if (!this._initialSyncDone) {
                    this._initialSyncDone = true;
                    this.syncWithBackend({ silent: true });
                }
            }, { once: true });
            
            window.addEventListener('psh:ready', () => {
                console.log('[CartStore] PSH ready event received');
                if (!this._authReady) {
                    this._checkAuthAndSync();
                }
            }, { once: true });
        }
        
        // Schedule initial sync with delay as fallback
        setTimeout(() => {
            if (!this._initialSyncDone) {
                this._attemptInitialSync();
            }
        }, INITIAL_SYNC_DELAY);
    }

    _isAuthReady() {
        const user = auth.getUser ? auth.getUser() : null;
        const token = api.getToken ? api.getToken() : null;
        const ready = !!(user && token);
        if (ready) {
            this._authReady = true;
        }
        return ready;
    }

    async _attemptInitialSync(retryCount = 0) {
        if (this._initialSyncDone) return;
        
        if (this._isAuthReady()) {
            console.log('[CartStore] Auth ready, performing initial sync');
            this._initialSyncDone = true;
            this._isStaff = checkStaffStatus();
            await this.syncWithBackend({ silent: true });
        } else if (retryCount < MAX_INITIAL_RETRIES) {
            const delay = INITIAL_SYNC_DELAY * (retryCount + 1);
            const user = auth.getUser ? auth.getUser() : null;
            const token = api.getToken ? api.getToken() : null;
            console.log(`[CartStore] Auth not ready (user: ${!!user}, token: ${!!token}), retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_INITIAL_RETRIES})`);
            setTimeout(() => this._attemptInitialSync(retryCount + 1), delay);
        } else {
            console.log('[CartStore] Auth not available after retries, will sync on auth state change');
        }
    }

    async _checkAuthAndSync() {
        if (this._isAuthReady() && !this._initialSyncDone) {
            this._initialSyncDone = true;
            this._isStaff = checkStaffStatus();
            await this.syncWithBackend({ silent: true });
        }
    }

    _ensureGuestId() {
        try {
            this.guestId = localStorage.getItem(GUEST_ID_KEY);
            if (!this.guestId) {
                this.guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                localStorage.setItem(GUEST_ID_KEY, this.guestId);
            }
        } catch (e) {
            this.guestId = 'guest_' + Date.now();
        }
        return this.guestId;
    }

    _setupAuthListener() {
        if (auth && typeof auth.onAuthStateChanged === 'function') {
            auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log('[CartStore] Auth state changed: user logged in');
                    this._isStaff = checkStaffStatus();
                    
                    setTimeout(() => {
                        if (this._isAuthReady()) {
                            console.log('[CartStore] Auth fully ready, syncing');
                            this._authReady = true;
                            if (!this._initialSyncDone) {
                                this._initialSyncDone = true;
                            }
                            this.syncWithBackend();
                        } else {
                            console.log('[CartStore] User exists but token not ready yet, will retry');
                            setTimeout(() => this._checkAuthAndSync(), 1000);
                        }
                    }, 500);
                } else {
                    console.log('[CartStore] Auth state changed: user logged out');
                    this._authReady = false;
                    this._initialSyncDone = false;
                    this._corruptionCleaned = false;
                    this._isStaff = false;
                    this.loadFromStorage();
                    this._ensureGuestId();
                    this.notifyListeners();
                }
            });
        } else {
            // Fallback: check auth status periodically
            console.log('[CartStore] Auth listener not available, using periodic check');
            setInterval(() => {
                if (this._isAuthReady() && !this._initialSyncDone) {
                    this._initialSyncDone = true;
                    this._isStaff = checkStaffStatus();
                    this.syncWithBackend({ silent: true });
                }
            }, 5000);
        }
    }

    // ===== STORAGE =====
    loadFromStorage() {
        try {
            const cartData = localStorage.getItem(CART_KEY);
            this.items = cartData ? JSON.parse(cartData) : [];

            const savedData = localStorage.getItem(SAVED_ITEMS_KEY);
            this.savedItems = savedData ? JSON.parse(savedData) : [];

            const discountData = localStorage.getItem(DISCOUNT_KEY);
            this.discount = discountData ? JSON.parse(discountData) : null;

            const shippingData = localStorage.getItem(SHIPPING_KEY);
            this.shipping = shippingData ? JSON.parse(shippingData) : null;

            // Clean corrupted items from localStorage
            const beforeCount = this.items.length;
            this.items = this.items.filter(item => isValidCartItem(item));
            
            if (this.items.length < beforeCount) {
                console.log(`[CartStore] 🧹 Removed ${beforeCount - this.items.length} corrupted item(s) from local storage`);
                this._corruptionCleaned = true;
                // Save cleaned version immediately
                localStorage.setItem(CART_KEY, JSON.stringify(this.items));
                // Mark as cleaned
                localStorage.setItem(CART_CLEANED_KEY, 'true');
            }

            // Validate saved items
            this.savedItems = this.savedItems.filter(item => 
                item && item.id && typeof item.id === 'string' && 
                item.name && typeof item.name === 'string' &&
                item.name !== 'Product' && item.name !== 'Product NO' &&
                item.name !== 'Unknown'
            );

            this.notifyListeners();
        } catch (e) {
            console.warn('[CartStore] Load error:', e);
            this.items = [];
            this.savedItems = [];
            this.discount = null;
            this.shipping = null;
        }
    }

    saveToStorage() {
        try {
            // Always clean before saving
            this.items = this.items.filter(item => isValidCartItem(item));
            
            localStorage.setItem(CART_KEY, JSON.stringify(this.items));
            localStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(this.savedItems));
            
            if (this.discount) {
                localStorage.setItem(DISCOUNT_KEY, JSON.stringify(this.discount));
            } else {
                localStorage.removeItem(DISCOUNT_KEY);
            }
            
            if (this.shipping) {
                localStorage.setItem(SHIPPING_KEY, JSON.stringify(this.shipping));
            } else {
                localStorage.removeItem(SHIPPING_KEY);
            }
            
            this.notifyListeners();
            
            if (bus?.emit) {
                bus.emit(Events.CART_UPDATED, this.getSummary());
            }
        } catch (e) {
            console.warn('[CartStore] Save error:', e);
        }
    }

    // ===== GUEST ID =====
    getGuestId() {
        return this._ensureGuestId();
    }

    // ===== BACKEND SYNC =====
    async syncWithBackend(options = {}) {
        const { force = false, silent = false } = options;
        
        if (!this._isAuthReady()) {
            if (!silent) {
                console.log('[CartStore] Auth not ready, skipping sync');
            }
            return this.items;
        }

        if (this.isSyncing && !force) {
            return this._pendingSync;
        }

        this.isSyncing = true;
        this._pendingSync = this._doSync(silent);
        
        try {
            return await this._pendingSync;
        } finally {
            this.isSyncing = false;
            this._pendingSync = null;
            this._lastSync = Date.now();
        }
    }

    async _doSync(silent = false) {
        let lastError = null;
        let data = null;

        const token = await this._getValidToken();
        if (!token) {
            if (!silent) {
                console.log('[CartStore] No token found, skipping sync');
            }
            return this.items;
        }

        try {
            data = await withRetry(async () => {
                return await api.get('/cart', { 
                    params: { guestId: this.guestId },
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'x-device-fingerprint': await getDeviceFingerprint()
                    },
                    requireAuth: true,
                    redirectOnAuth: false
                });
            }, SYNC_RETRY_ATTEMPTS, SYNC_RETRY_DELAY);
            
            if (data && data.items && data.items.length > 0) {
                // ============================================================
                // Check for corrupted items from server
                // ============================================================
                const validItems = [];
                const corruptedItems = [];
                
                for (const item of data.items) {
                    if (isValidCartItem(item)) {
                        validItems.push(item);
                    } else {
                        corruptedItems.push(item);
                    }
                }
                
                // If we found corrupted items on server, DELETE them
                if (corruptedItems.length > 0 && !this._corruptionCleaned) {
                    console.log(`[CartStore] 🧹 Found ${corruptedItems.length} corrupted item(s) on server - deleting permanently...`);
                    
                    // Delete each corrupted item from server
                    for (const badItem of corruptedItems) {
                        try {
                            await api.delete(`/cart/remove/${badItem.id}`, {
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'x-device-fingerprint': await getDeviceFingerprint()
                                },
                                requireAuth: true,
                                redirectOnAuth: false
                            });
                            console.log(`[CartStore] ✅ Deleted corrupted item from server: ${badItem.id}`);
                        } catch (deleteError) {
                            console.log(`[CartStore] DELETE endpoint failed for ${badItem.id}, will use overwrite method`);
                        }
                    }
                    
                    // ============================================================
                    // OVERWRITE: Push clean items to server to replace corrupted ones
                    // ============================================================
                    await this._overwriteServerCart(token, validItems);
                    
                    this._corruptionCleaned = true;
                    localStorage.setItem(CART_CLEANED_KEY, 'true');
                    console.log('[CartStore] ✅ Server cart cleaned - corrupted items permanently deleted');
                }
                
                // Merge clean server items with local
                const merged = this._mergeCarts(this.items, validItems);
                this.items = merged;
                
                if (data.savedItems) {
                    this.savedItems = data.savedItems;
                }
                if (data.discount) {
                    this.discount = data.discount;
                }
                if (data.shipping) {
                    this.shipping = data.shipping;
                }
                
                this.saveToStorage();
                if (!silent) {
                    console.log(`🔄 [CartStore] Synced from server: ${this.items.length} items`);
                }
                return this.items;
                
            } else if (data && data.items !== undefined) {
                // Server cart is empty - push local items
                await this._pushToBackend(token);
                if (!silent) {
                    console.log(`📤 [CartStore] Pushed ${this.items.length} items to server`);
                }
                return this.items;
            }
            
            return this.items;
            
        } catch (error) {
            lastError = error;
            if (error.message === 'Authentication required' || 
                error.message === 'Session expired' ||
                error.message.includes('401')) {
                if (!silent) {
                    console.log('[CartStore] Auth error, skipping sync');
                }
                return this.items;
            }
            
            console.warn('[CartStore] Sync failed:', error.message);
            
            // Try fallback push
            try {
                const tokenFallback = await this._getValidToken();
                if (tokenFallback && this.items.length > 0) {
                    await this._pushToBackend(tokenFallback);
                }
                return this.items;
            } catch (e) {
                console.warn('[CartStore] Push fallback also failed:', e.message);
            }
        }

        return this.items;
    }

    async _getValidToken() {
        // Try multiple sources
        const sources = [
            () => localStorage.getItem(TOKEN_KEY),
            () => localStorage.getItem('psh_auth_token'),
            () => sessionStorage.getItem(TOKEN_KEY),
            () => sessionStorage.getItem('psh_auth_token'),
            () => api.getToken ? api.getToken() : null,
            () => window.auth && window.auth.getToken ? window.auth.getToken() : null
        ];
        
        for (const source of sources) {
            try {
                const token = source();
                if (token && typeof token === 'string' && token.length > 10) {
                    return token;
                }
            } catch (e) {
                // Continue to next source
            }
        }
        
        return null;
    }

    // ============================================================
    // OVERWRITE: Push clean items to server
    // ============================================================
    async _overwriteServerCart(token, cleanItems) {
        try {
            // Try to clear the server cart first
            try {
                await api.delete('/cart', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'x-device-fingerprint': await getDeviceFingerprint()
                    },
                    requireAuth: true,
                    redirectOnAuth: false
                });
            } catch (e) {
                // DELETE /cart might not exist, continue with overwrite
            }
            
            // Push only clean items
            const payload = {
                localItems: cleanItems.filter(item => isValidCartItem(item)),
                savedItems: this.savedItems || [],
                discount: this.discount || null,
                shipping: this.shipping || null,
                guestId: this.guestId
            };
            
            await api.post('/cart/sync', payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-device-fingerprint': await getDeviceFingerprint()
                },
                requireAuth: true,
                redirectOnAuth: false
            });
            
            console.log('[CartStore] ✅ Server cart overwritten with clean data');
        } catch (error) {
            console.warn('[CartStore] Overwrite failed:', error.message);
            throw error;
        }
    }

    _mergeCarts(localItems, serverItems) {
        const merged = [...localItems];
        const localIds = new Set(localItems.map(item => item.id));

        for (const serverItem of serverItems) {
            if (!serverItem || !serverItem.id || !isValidCartItem(serverItem)) continue;
            
            const existingIndex = merged.findIndex(item => item.id === serverItem.id);
            if (existingIndex >= 0) {
                const localItem = merged[existingIndex];
                merged[existingIndex] = {
                    ...localItem,
                    price: parseFloat(serverItem.price) || localItem.price || 0,
                    wholesalePrice: serverItem.wholesale_price ? parseFloat(serverItem.wholesale_price) : localItem.wholesalePrice,
                    stock: serverItem.stock || localItem.stock || 0,
                    image: serverItem.image_url || serverItem.image || localItem.image || '/company_logo.png',
                    name: serverItem.name || localItem.name || 'Product',
                    quantity: Math.max(1, serverItem.quantity || localItem.quantity || 1)
                };
            } else {
                merged.push({
                    id: serverItem.id,
                    name: serverItem.name || 'Product',
                    price: parseFloat(serverItem.price) || 0,
                    wholesalePrice: serverItem.wholesale_price ? parseFloat(serverItem.wholesale_price) : null,
                    originalPrice: serverItem.original_price ? parseFloat(serverItem.original_price) : null,
                    image: serverItem.image_url || serverItem.image || '/company_logo.png',
                    description: serverItem.description || '',
                    category: serverItem.category || 'general',
                    quantity: Math.max(1, serverItem.quantity || 1),
                    stock: serverItem.stock || 0,
                    features: serverItem.features || []
                });
            }
        }

        // Final filter to ensure no bad items
        return merged.filter(item => isValidCartItem(item));
    }

    async _pushToBackend(token) {
        const user = auth.getUser ? auth.getUser() : null;
        if (!user || this.items.length === 0) return;

        try {
            const cleanItems = this.items.filter(item => isValidCartItem(item));
            
            await api.post('/cart/sync', {
                localItems: cleanItems,
                savedItems: this.savedItems || [],
                discount: this.discount || null,
                shipping: this.shipping || null,
                guestId: this.guestId
            }, {
                headers: {
                    'Authorization': `Bearer ${token || await this._getValidToken()}`,
                    'x-device-fingerprint': await getDeviceFingerprint()
                },
                requireAuth: true,
                redirectOnAuth: false
            });
        } catch (error) {
            console.warn('[CartStore] Push failed:', error.message);
            throw error;
        }
    }

    // ===== CRUD OPERATIONS =====

    addItem(product, quantity = 1, options = {}) {
        const { optimistic = true, validateStock = true } = options;

        if (!product || !product.id || !product.name || !product.price || product.price <= 0) {
            console.warn('[CartStore] Invalid product:', product);
            return this.items;
        }

        if (validateStock && product.stock !== undefined && product.stock < quantity) {
            throw new Error(`Only ${product.stock} units available`);
        }

        const existing = this.items.find(item => item.id === product.id);
        
        if (existing) {
            const newQty = existing.quantity + quantity;
            if (validateStock && existing.stock && newQty > existing.stock) {
                throw new Error(`Only ${existing.stock} units available`);
            }
            existing.quantity = newQty;
        } else {
            const item = {
                id: product.id,
                name: product.name || 'Product',
                price: typeof product.price === 'string' ? parseFloat(product.price) : product.price || 0,
                wholesalePrice: product.wholesalePrice ? parseFloat(product.wholesalePrice) : null,
                originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : null,
                image: product.image || product.images?.[0] || '/company_logo.png',
                description: product.description || '',
                category: product.category || 'general',
                quantity: Math.max(1, quantity),
                stock: product.stock || 0,
                features: product.features || [],
                addedAt: Date.now()
            };
            
            if (!isValidCartItem(item)) {
                console.warn('[CartStore] Invalid cart item created:', item);
                return this.items;
            }
            
            this.items.push(item);
        }

        this.saveToStorage();

        if (optimistic) {
            this._scheduleSync();
        } else {
            this.syncWithBackend({ silent: true });
        }

        if (bus?.emit) {
            bus.emit(Events.CART_ITEM_ADDED, { product, quantity, item: this.items.find(i => i.id === product.id) });
        }

        return this.items;
    }

    removeItem(id, options = {}) {
        const { optimistic = true } = options;
        
        const item = this.items.find(i => i.id === id);
        if (!item) return;

        this.items = this.items.filter(item => item.id !== id);
        this.saveToStorage();

        if (optimistic) {
            this._scheduleSync();
        } else {
            this.syncWithBackend({ silent: true });
        }

        if (bus?.emit) {
            bus.emit(Events.CART_ITEM_REMOVED, { id, item });
        }
    }

    updateQuantity(id, delta, options = {}) {
        const { optimistic = true, validateStock = true } = options;
        
        const item = this.items.find(item => item.id === id);
        if (!item) return;

        const newQty = item.quantity + delta;
        
        if (newQty < 1) {
            this.removeItem(id, options);
            return;
        }
        
        if (validateStock && item.stock && newQty > item.stock) {
            throw new Error(`Only ${item.stock} units available`);
        }

        item.quantity = newQty;
        this.saveToStorage();

        if (optimistic) {
            this._scheduleSync();
        } else {
            this.syncWithBackend({ silent: true });
        }

        if (bus?.emit) {
            bus.emit(Events.CART_ITEM_UPDATED, { id, quantity: newQty });
        }
    }

    setQuantity(id, quantity, options = {}) {
        const currentItem = this.items.find(i => i.id === id);
        if (!currentItem) return;
        
        const delta = quantity - currentItem.quantity;
        this.updateQuantity(id, delta, options);
    }

    saveForLater(id) {
        const item = this.items.find(item => item.id === id);
        if (!item) return;

        if (this.savedItems.some(si => si.id === id)) {
            return;
        }

        this.savedItems.push({
            id: item.id,
            name: item.name,
            price: item.price,
            wholesalePrice: item.wholesalePrice,
            image: item.image,
            description: item.description,
            category: item.category,
            savedAt: Date.now()
        });

        this.items = this.items.filter(item => item.id !== id);
        this.saveToStorage();
        this.syncWithBackend({ silent: true });

        if (bus?.emit) {
            bus.emit(Events.CART_SAVED_FOR_LATER, { id });
        }
    }

    moveToCart(id) {
        const item = this.savedItems.find(item => item.id === id);
        if (!item) return;

        this.items.push({
            id: item.id,
            name: item.name,
            price: item.price,
            wholesalePrice: item.wholesalePrice || item.price,
            originalPrice: item.originalPrice || null,
            image: item.image || '/company_logo.png',
            description: item.description || '',
            category: item.category || 'general',
            quantity: 1,
            stock: 0,
            features: item.features || [],
            addedAt: Date.now()
        });

        this.savedItems = this.savedItems.filter(item => item.id !== id);
        this.saveToStorage();
        this.syncWithBackend({ silent: true });

        if (bus?.emit) {
            bus.emit(Events.CART_MOVED_TO_CART, { id });
        }
    }

    clear() {
        this.items = [];
        this.savedItems = [];
        this.discount = null;
        this.shipping = null;
        this._corruptionCleaned = false;
        localStorage.removeItem(CART_CLEANED_KEY);
        this.saveToStorage();
        this.syncWithBackend({ silent: true });

        if (bus?.emit) {
            bus.emit(Events.CART_CLEARED);
        }
    }

    // ===== CALCULATIONS =====

    getTotal() {
        return this.items.reduce((sum, item) => {
            const price = this._getEffectivePrice(item);
            return sum + (price * item.quantity);
        }, 0);
    }

    getCount() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    getSubtotal() {
        return this.getTotal();
    }

    getShipping() {
        if (!this.shipping) return 0;
        return this.shipping.price || 0;
    }

    getDiscount() {
        if (!this.discount) return 0;
        const subtotal = this.getTotal();

        if (this.discount.type === 'percentage') {
            return (subtotal * this.discount.value) / 100;
        } else if (this.discount.type === 'fixed') {
            return Math.min(this.discount.value, subtotal);
        }
        return 0;
    }

    getGrandTotal() {
        const subtotal = this.getTotal();
        const shipping = this.getShipping();
        const discount = this.getDiscount();

        let total = subtotal + shipping - discount;
        if (this.discount && this.discount.type === 'shipping') {
            total = subtotal - discount;
        }

        return Math.max(0, total);
    }

    _getEffectivePrice(item) {
        const user = auth.getUser ? auth.getUser() : null;
        const role = user?.role || 'customer';
        
        if (role === 'admin' || role === 'staff' || user?.isWholesale || this._isStaff) {
            return item.wholesalePrice || item.price;
        }
        return item.price;
    }

    // ===== DISCOUNT MANAGEMENT =====

    applyDiscount(code) {
        const discount = CONFIG.DISCOUNT_CODES?.[code.toUpperCase()];
        if (!discount) {
            throw new Error('Invalid discount code');
        }

        const subtotal = this.getTotal();
        if (subtotal < (discount.minAmount || 0)) {
            const minAmount = discount.minAmount || 0;
            throw new Error(`Minimum order of ₦${minAmount.toLocaleString()} required`);
        }

        this.discount = { 
            code: code.toUpperCase(), 
            ...discount,
            appliedAt: Date.now()
        };
        
        this.saveToStorage();

        if (bus?.emit) {
            bus.emit(Events.CART_DISCOUNT_APPLIED, { code, discount: this.discount });
        }

        return this.discount;
    }

    removeDiscount() {
        this.discount = null;
        this.saveToStorage();

        if (bus?.emit) {
            bus.emit(Events.CART_DISCOUNT_REMOVED);
        }
    }

    // ===== SHIPPING MANAGEMENT =====

    setShipping(state, shippingId) {
        const rates = CONFIG.SHIPPING_RATES?.[state];
        if (!rates) {
            throw new Error('Invalid state');
        }

        const option = rates.find(r => r.id === shippingId);
        if (!option) {
            throw new Error('Invalid shipping option');
        }

        this.shipping = { 
            id: shippingId, 
            price: option.price, 
            state,
            name: option.name,
            time: option.time
        };
        
        this.saveToStorage();

        if (bus?.emit) {
            bus.emit(Events.CART_SHIPPING_UPDATED, { state, shipping: this.shipping });
        }

        return this.shipping;
    }

    getShippingOptions(state) {
        return CONFIG.SHIPPING_RATES?.[state] || CONFIG.SHIPPING_RATES?.['Others'] || [];
    }

    // ===== SYNC SCHEDULING =====

    _scheduleSync() {
        if (this._syncTimeout) {
            clearTimeout(this._syncTimeout);
        }
        this._syncTimeout = setTimeout(() => {
            this.syncWithBackend({ silent: true });
            this._syncTimeout = null;
        }, 1000);
    }

    // ===== SUBSCRIPTION =====

    subscribe(callback) {
        this.listeners.push(callback);
        setTimeout(() => {
            try {
                callback(this);
            } catch (e) {
                console.warn('[CartStore] Listener error:', e);
            }
        }, 0);
        
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this);
            } catch (e) {
                console.warn('[CartStore] Listener error:', e);
            }
        });
    }

    // ===== SUMMARY =====

    getSummary() {
        return {
            items: this.items,
            savedItems: this.savedItems,
            count: this.getCount(),
            subtotal: this.getSubtotal(),
            shipping: this.getShipping(),
            discount: this.discount,
            discountAmount: this.getDiscount(),
            total: this.getGrandTotal(),
            isSyncing: this.isSyncing,
            lastSync: this._lastSync,
            guestId: this.guestId,
            isStaff: this._isStaff
        };
    }

    // ===== UTILITY =====

    toJSON() {
        return {
            items: this.items,
            savedItems: this.savedItems,
            discount: this.discount,
            shipping: this.shipping,
            total: this.getGrandTotal(),
            count: this.getCount(),
            guestId: this.guestId
        };
    }

    isEmpty() {
        return this.items.length === 0;
    }

    // ============================================================
    // FORCE CLEAN: Remove all corruption from both local and server
    // ============================================================
    async forceCleanCorruption() {
        console.log('[CartStore] 🧹 Force cleaning all cart corruption...');
        
        // Clean localStorage
        this._corruptionCleaned = false;
        localStorage.removeItem(CART_CLEANED_KEY);
        this.loadFromStorage();
        
        // Clean server
        if (this._isAuthReady()) {
            const token = await this._getValidToken();
            if (token) {
                const cleanItems = this.items.filter(item => isValidCartItem(item));
                await this._overwriteServerCart(token, cleanItems);
            }
        }
        
        this._corruptionCleaned = true;
        localStorage.setItem(CART_CLEANED_KEY, 'true');
        console.log('[CartStore] ✅ Corruption cleanup complete');
        return this.items;
    }

    clearCache() {
        localStorage.removeItem(CART_KEY);
        localStorage.removeItem(SAVED_ITEMS_KEY);
        localStorage.removeItem(DISCOUNT_KEY);
        localStorage.removeItem(SHIPPING_KEY);
        localStorage.removeItem(CART_CLEANED_KEY);
        this.items = [];
        this.savedItems = [];
        this.discount = null;
        this.shipping = null;
        this._corruptionCleaned = false;
        this.notifyListeners();
    }

    // ===== DESTROY =====
    destroy() {
        if (this._syncTimeout) {
            clearTimeout(this._syncTimeout);
        }
        this.listeners = [];
    }
}

// ===== SINGLETON INSTANCE =====
export const cartStore = new CartStore();

// ===== EXPORTS =====
export default cartStore;

// ===== GLOBAL EXPOSURE =====
if (typeof window !== 'undefined') {
    window.__cartStore = cartStore;
    
    // ============================================================
    // Expose force clean function globally
    // ============================================================
    window.forceCleanCart = async () => {
        console.log('🧹 Manually triggering cart corruption cleanup...');
        return await cartStore.forceCleanCorruption();
    };
    
    console.log('🛒 CartStore v2.6 initialized');
    console.log('💡 Run forceCleanCart() to manually clean corrupted items from both local storage and server');
}
