// ============================================================================
// public../js/product-store.js - Unified Product Store v2.1
// ============================================================================
// Handles product data with caching, categories, search, and real-time updates
// ============================================================================

import { CONFIG } from './config.js';
import { api } from './api-client.js';
import { bus, Events } from './events.js';

// ===== CONSTANTS =====
const CACHE_TTL = 300000; // 5 minutes
const CACHE_KEY = 'psh_products_cache';
const CACHE_TIME_KEY = 'psh_products_cache_time';
const DEFAULT_PAGE_SIZE = 12;

// ===== PRODUCT STORE CLASS =====
class ProductStore {
    constructor() {
        this.products = [];
        this.categories = [];
        this.categoryTree = [];
        this.loaded = false;
        this.loading = false;
        this.listeners = [];
        this._lastLoad = 0;
        this._cacheHit = false;
        this._currentPage = 1;
        this._pageSize = DEFAULT_PAGE_SIZE;
        this._filteredProducts = [];
        this._currentFilter = 'all';
        this._currentSort = 'default';
        this._searchQuery = '';
        
        // Load from cache on init
        this._loadFromCache();
    }

    // ===== CACHE MANAGEMENT =====
    _loadFromCache() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            const cacheTime = localStorage.getItem(CACHE_TIME_KEY);
            
            if (cached && cacheTime) {
                const age = Date.now() - parseInt(cacheTime);
                if (age < CACHE_TTL) {
                    const data = JSON.parse(cached);
                    this.products = data.products || [];
                    this.categories = data.categories || [];
                    this.categoryTree = data.categoryTree || [];
                    this.loaded = true;
                    this._cacheHit = true;
                    this._applyFiltersAndSort();
                    console.log(`[ProductStore] Loaded ${this.products.length} products from cache`);
                    return true;
                }
            }
        } catch (e) {
            console.warn('[ProductStore] Cache read failed:', e);
        }
        return false;
    }

    _saveToCache() {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                products: this.products,
                categories: this.categories,
                categoryTree: this.categoryTree
            }));
            localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        } catch (e) {
            console.warn('[ProductStore] Cache write failed:', e);
        }
    }

    clearCache() {
        try {
            localStorage.removeItem(CACHE_KEY);
            localStorage.removeItem(CACHE_TIME_KEY);
            this._cacheHit = false;
        } catch (e) {
            // Ignore
        }
    }

    // ===== LOAD PRODUCTS =====
    async loadProducts(force = false) {
        // Don't reload if already loaded and not forced
        if (this.loaded && !force && this._cacheHit) {
            return this.products;
        }

        // Prevent concurrent loads
        if (this.loading) {
            return new Promise((resolve) => {
                const unsubscribe = this.subscribe(() => {
                    unsubscribe();
                    resolve(this.products);
                });
            });
        }

        this.loading = true;

        try {
            // Try cache first if not forced
            if (!force && this._loadFromCache()) {
                this.loading = false;
                this.notifyListeners();
                return this.products;
            }

            // Fetch from API
            const data = await api.get('/products');
            
            // Map and validate products
            this.products = data.map(p => this._mapProduct(p)).filter(Boolean);
            
            // Load categories
            await this.loadCategories();
            
            // Build category tree
            this._buildCategoryTree();
            
            // Apply filters and sort
            this._applyFiltersAndSort();
            
            this.loaded = true;
            this._lastLoad = Date.now();
            this._cacheHit = false;
            
            // Save to cache
            this._saveToCache();
            
            this.notifyListeners();
            
            // Emit event
            bus?.emit(Events.PRODUCTS_LOADED, { 
                count: this.products.length, 
                categories: this.categories.length 
            });
            
            console.log(`[ProductStore] Loaded ${this.products.length} products from API`);
            return this.products;
            
        } catch (error) {
            console.error('[ProductStore] Failed to load products:', error);
            
            // If we have cached data, use it even if expired
            if (this.products.length > 0) {
                console.warn('[ProductStore] Using expired cache as fallback');
                return this.products;
            }
            
            // Try emergency fallback
            this._loadFallbackProducts();
            
            bus?.emit(Events.ERROR_OCCURRED, { 
                message: 'Failed to load products',
                error: error.message 
            });
            
            return this.products;
        } finally {
            this.loading = false;
        }
    }

    // ===== PRODUCT MAPPING =====
    _mapProduct(p) {
        if (!p || !p.id) return null;
        
        const price = parseFloat(p.price) || parseFloat(p.original_price) || 0;
        const wholesalePrice = parseFloat(p.wholesale_price) || parseFloat(p.wholesalePrice) || null;
        const originalPrice = parseFloat(p.original_price) || parseFloat(p.originalPrice) || null;
        
        return {
            id: p.id,
            name: p.name || 'Unnamed Product',
            slug: p.slug || p.name?.toLowerCase().replace(/\s+/g, '-') || p.id,
            price: price,
            wholesalePrice: wholesalePrice,
            originalPrice: originalPrice,
            discount: originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0,
            stock: Math.max(0, parseInt(p.stock) || 0),
            category: p.category || 'general',
            categoryId: p.category_id || p.categoryId,
            categoryName: p.category_name || p.category || 'General',
            description: p.description || '',
            shortDescription: p.short_description || p.shortDescription || '',
            image: p.image_url || p.image || '/company_logo.png',
            images: p.images || [p.image_url || p.image || '/company_logo.png'],
            features: p.features || [],
            specifications: p.specifications || {},
            rating: parseFloat(p.rating) || 0,
            reviewCount: parseInt(p.review_count) || 0,
            isNew: p.is_new || p.isNew || false,
            isBestseller: p.is_bestseller || p.isBestseller || false,
            isActive: p.active !== 0,
            sku: p.sku || p.id,
            weight: p.weight || null,
            dimensions: p.dimensions || null,
            tags: p.tags || [],
            createdAt: p.created_at || p.createdAt || Date.now(),
            updatedAt: p.updated_at || p.updatedAt || Date.now(),
            imageLoaded: false,
            _raw: p
        };
    }

    // ===== FALLBACK PRODUCTS =====
    _loadFallbackProducts() {
        this.products = [
            {
                id: 'fallback-1',
                name: 'Premium Smartphone',
                price: 1450000,
                wholesalePrice: 1200000,
                stock: 25,
                category: 'smartphones',
                description: 'Latest premium smartphone with amazing features.',
                image: '/company_logo.png',
                rating: 4.9,
                reviewCount: 150,
                isNew: true,
                isBestseller: true,
                isActive: true,
                slug: 'premium-smartphone',
                categoryName: 'Smartphones',
                images: ['/company_logo.png'],
                features: ['5G', 'AMOLED Display', '108MP Camera'],
                tags: ['phone', '5g', 'premium'],
                createdAt: Date.now(),
                updatedAt: Date.now()
            },
            {
                id: 'fallback-2',
                name: 'Wireless Headphones',
                price: 350000,
                wholesalePrice: 280000,
                stock: 50,
                category: 'audio',
                description: 'Premium wireless headphones with noise cancellation.',
                image: '/company_logo.png',
                rating: 4.7,
                reviewCount: 89,
                isNew: false,
                isBestseller: true,
                isActive: true,
                slug: 'wireless-headphones',
                categoryName: 'Audio',
                images: ['/company_logo.png'],
                features: ['Noise Cancellation', 'Bluetooth 5.3', '40hr Battery'],
                tags: ['headphones', 'wireless', 'audio'],
                createdAt: Date.now(),
                updatedAt: Date.now()
            },
            {
                id: 'fallback-3',
                name: 'Smart Watch',
                price: 750000,
                wholesalePrice: 600000,
                stock: 15,
                category: 'wearables',
                description: 'Feature-packed smart watch with health tracking.',
                image: '/company_logo.png',
                rating: 4.5,
                reviewCount: 45,
                isNew: true,
                isBestseller: false,
                isActive: true,
                slug: 'smart-watch',
                categoryName: 'Wearables',
                images: ['/company_logo.png'],
                features: ['Heart Rate Monitor', 'GPS', 'Water Resistant'],
                tags: ['watch', 'health', 'tracker'],
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
        ];
        this.loaded = true;
        this._applyFiltersAndSort();
        console.warn('[ProductStore] Using fallback products');
    }

    // ===== CATEGORIES =====
    async loadCategories() {
        try {
            const data = await api.get('/categories');
            
            if (Array.isArray(data)) {
                this.categories = data.map(c => ({
                    id: c.id,
                    name: c.name || c.category_name || '',
                    slug: c.slug || c.name?.toLowerCase().replace(/\s+/g, '-') || '',
                    description: c.description || '',
                    parentId: c.parent_id || c.parentId || null,
                    image: c.image_url || c.image || '',
                    count: c.product_count || c.count || 0,
                    active: c.active !== 0,
                    icon: c.icon || null
                }));
            } else if (data.categories) {
                this.categories = data.categories.map(c => ({
                    id: c.id,
                    name: c.name || c.category_name || '',
                    slug: c.slug || c.name?.toLowerCase().replace(/\s+/g, '-') || '',
                    description: c.description || '',
                    parentId: c.parent_id || c.parentId || null,
                    image: c.image_url || c.image || '',
                    count: c.product_count || c.count || 0,
                    active: c.active !== 0,
                    icon: c.icon || null
                }));
            } else {
                this.categories = [];
            }
            
            this._buildCategoryTree();
            return this.categories;
            
        } catch (error) {
            console.warn('[ProductStore] Failed to load categories:', error);
            return this.categories || [];
        }
    }

    _buildCategoryTree() {
        const map = {};
        const roots = [];
        
        this.categories.forEach(c => {
            map[c.id] = { ...c, children: [] };
        });
        
        this.categories.forEach(c => {
            if (c.parentId && map[c.parentId]) {
                map[c.parentId].children.push(map[c.id]);
            } else {
                roots.push(map[c.id]);
            }
        });
        
        this.categoryTree = roots;
    }

    // ===== FILTERS & SORT =====
    setFilter(filter) {
        this._currentFilter = filter;
        this._currentPage = 1;
        this._applyFiltersAndSort();
        this.notifyListeners();
    }

    setSort(sort) {
        this._currentSort = sort;
        this._applyFiltersAndSort();
        this.notifyListeners();
    }

    setSearch(query) {
        this._searchQuery = query;
        this._currentPage = 1;
        this._applyFiltersAndSort();
        this.notifyListeners();
    }

    setPage(page) {
        this._currentPage = Math.max(1, page);
        this.notifyListeners();
    }

    setPageSize(size) {
        this._pageSize = Math.max(1, size);
        this._currentPage = 1;
        this._applyFiltersAndSort();
        this.notifyListeners();
    }

    _applyFiltersAndSort() {
        let filtered = this.products.filter(p => p.isActive);
        
        // Filter by category
        if (this._currentFilter !== 'all') {
            filtered = filtered.filter(p => 
                p.category === this._currentFilter ||
                p.categoryId === this._currentFilter ||
                p.category?.toLowerCase() === this._currentFilter.toLowerCase() ||
                p.categoryName?.toLowerCase() === this._currentFilter.toLowerCase()
            );
        }
        
        // Filter by search
        if (this._searchQuery) {
            const q = this._searchQuery.toLowerCase().trim();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q) ||
                p.categoryName?.toLowerCase().includes(q) ||
                p.tags?.some(t => t.toLowerCase().includes(q)) ||
                p.sku?.toLowerCase().includes(q)
            );
        }
        
        // Sort
        switch (this._currentSort) {
            case 'price-asc':
                filtered.sort((a, b) => a.price - b.price);
                break;
            case 'price-desc':
                filtered.sort((a, b) => b.price - a.price);
                break;
            case 'rating':
                filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            case 'newest':
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'popularity':
                filtered.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
                break;
            case 'name':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'relevance':
            default:
                if (this._searchQuery) {
                    const q = this._searchQuery.toLowerCase().trim();
                    filtered.sort((a, b) => {
                        const aScore = a.name.toLowerCase().includes(q) ? 2 : 
                                     a.description.toLowerCase().includes(q) ? 1 : 0;
                        const bScore = b.name.toLowerCase().includes(q) ? 2 : 
                                     b.description.toLowerCase().includes(q) ? 1 : 0;
                        return bScore - aScore;
                    });
                }
                break;
        }
        
        this._filteredProducts = filtered;
    }

    // ===== QUERIES =====
    getById(id) {
        return this.products.find(p => p.id === id);
    }

    getBySlug(slug) {
        return this.products.find(p => p.slug === slug);
    }

    getByCategory(category) {
        if (!category) return this.products;
        return this.products.filter(p => 
            p.category === category || 
            p.categoryId === category ||
            p.category?.toLowerCase() === category.toLowerCase()
        );
    }

    getByCategoryId(categoryId) {
        return this.products.filter(p => p.categoryId === categoryId);
    }

    getByCategorySlug(slug) {
        const category = this.categories.find(c => c.slug === slug);
        if (!category) return [];
        return this.getByCategoryId(category.id);
    }

    // ===== PAGINATION =====
    getFilteredProducts() {
        return this._filteredProducts;
    }

    getCurrentPage() {
        const total = this.getTotalPages();
        return Math.min(this._currentPage, total || 1);
    }

    getTotalPages() {
        return Math.ceil(this._filteredProducts.length / this._pageSize) || 1;
    }

    getPageItems() {
        const start = (this.getCurrentPage() - 1) * this._pageSize;
        const end = start + this._pageSize;
        return this._filteredProducts.slice(start, end);
    }

    getTotalCount() {
        return this._filteredProducts.length;
    }

    hasPreviousPage() {
        return this.getCurrentPage() > 1;
    }

    hasNextPage() {
        return this.getCurrentPage() < this.getTotalPages();
    }

    // ===== GETTERS =====
    getFeatured(limit = 8) {
        return this.products
            .filter(p => p.isActive)
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, limit);
    }

    getBestsellers(limit = 8) {
        return this.products
            .filter(p => p.isActive && p.isBestseller)
            .slice(0, limit);
    }

    getNewArrivals(limit = 8) {
        return this.products
            .filter(p => p.isActive && p.isNew)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit);
    }

    getOnSale(limit = 8) {
        return this.products
            .filter(p => p.isActive && p.discount > 0)
            .sort((a, b) => b.discount - a.discount)
            .slice(0, limit);
    }

    getInStock() {
        return this.products.filter(p => p.isActive && p.stock > 0);
    }

    getOutOfStock() {
        return this.products.filter(p => p.isActive && p.stock === 0);
    }

    getPriceRange() {
        const active = this.products.filter(p => p.isActive && p.price > 0);
        if (active.length === 0) return { min: 0, max: 0 };
        return {
            min: Math.min(...active.map(p => p.price)),
            max: Math.max(...active.map(p => p.price))
        };
    }

    // ===== SEARCH =====
    search(query, options = {}) {
        const { 
            category = null, 
            minPrice = null, 
            maxPrice = null, 
            inStock = false,
            sortBy = 'relevance',
            limit = null
        } = options;
        
        const q = (query || '').toLowerCase().trim();
        let results = this.products.filter(p => p.isActive);
        
        if (q) {
            results = results.filter(p => 
                p.name.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q) ||
                p.shortDescription?.toLowerCase().includes(q) ||
                p.categoryName?.toLowerCase().includes(q) ||
                p.tags?.some(t => t.toLowerCase().includes(q))
            );
        }
        
        if (category) {
            results = results.filter(p => 
                p.category === category || 
                p.categoryId === category ||
                p.category?.toLowerCase() === category.toLowerCase()
            );
        }
        
        if (minPrice !== null) {
            results = results.filter(p => p.price >= minPrice);
        }
        if (maxPrice !== null) {
            results = results.filter(p => p.price <= maxPrice);
        }
        
        if (inStock) {
            results = results.filter(p => p.stock > 0);
        }
        
        switch (sortBy) {
            case 'price-asc': results.sort((a, b) => a.price - b.price); break;
            case 'price-desc': results.sort((a, b) => b.price - a.price); break;
            case 'rating': results.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
            case 'newest': results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
            case 'popularity': results.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0)); break;
            case 'name': results.sort((a, b) => a.name.localeCompare(b.name)); break;
            default: break;
        }
        
        if (limit && limit > 0) {
            results = results.slice(0, limit);
        }
        
        return results;
    }

    // ===== STATISTICS =====
    getStats() {
        const active = this.products.filter(p => p.isActive);
        const inStock = active.filter(p => p.stock > 0);
        
        return {
            total: this.products.length,
            active: active.length,
            inStock: inStock.length,
            outOfStock: active.length - inStock.length,
            categories: this.categories.length,
            minPrice: Math.min(...active.map(p => p.price).filter(p => p > 0)),
            maxPrice: Math.max(...active.map(p => p.price)),
            averagePrice: active.reduce((s, p) => s + p.price, 0) / active.length || 0,
            totalStock: active.reduce((s, p) => s + p.stock, 0),
            averageRating: active.reduce((s, p) => s + (p.rating || 0), 0) / active.length || 0,
            filteredCount: this._filteredProducts.length,
            totalPages: this.getTotalPages(),
            currentPage: this.getCurrentPage()
        };
    }

    // ===== STOCK VALIDATION =====
    hasStock(productId, quantity = 1) {
        const product = this.getById(productId);
        if (!product) return false;
        if (!product.isActive) return false;
        return product.stock >= quantity;
    }

    getAvailableStock(productId) {
        const product = this.getById(productId);
        return product ? product.stock : 0;
    }

    // ===== PRICE HELPERS =====
    getPrice(productId, role = 'customer') {
        const product = this.getById(productId);
        if (!product) return null;
        
        switch (role) {
            case 'wholesale':
                return product.wholesalePrice || product.price;
            case 'reseller':
                return product.resellerPrice || product.wholesalePrice || product.price;
            case 'staff':
                return product.staffPrice || product.price * 0.9;
            default:
                return product.price;
        }
    }

    getDiscount(productId) {
        const product = this.getById(productId);
        return product ? product.discount : 0;
    }

    // ===== RELATED PRODUCTS =====
    getRelated(productId, limit = 4) {
        const product = this.getById(productId);
        if (!product) return [];
        
        return this.products
            .filter(p => 
                p.id !== productId && 
                p.isActive &&
                (p.category === product.category || 
                 p.tags?.some(t => product.tags?.includes(t)))
            )
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, limit);
    }

    // ===== RENDER (for main.js compatibility) =====
    renderProducts(containerId = 'products-container') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const items = this.getPageItems();
        const total = this.getTotalCount();
        
        if (items.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:60px 20px;">
                    <p style="color:#888;font-size:1.1rem;">No products found</p>
                    <button onclick="window.location.reload()" style="margin-top:12px;padding:8px 24px;background:#d6b25e;border:none;border-radius:8px;color:#000;font-weight:600;cursor:pointer;">
                        Refresh
                    </button>
                </div>
            `;
            return;
        }
        
        // Render products using your preferred template
        // This is a simple example - override with your actual rendering
        container.innerHTML = items.map(p => `
            <div class="product-card" data-product-id="${p.id}" onclick="window.location.href='/product-detail.html?id=${p.id}'">
                <img src="${p.image}" alt="${p.name}" loading="lazy" style="width:100%;height:200px;object-fit:contain;border-radius:12px;">
                <h3>${p.name}</h3>
                <p class="price">${this._formatCurrency(p.price)}</p>
                ${p.discount > 0 ? `<span class="discount">-${p.discount}%</span>` : ''}
                <button class="add-to-cart" onclick="event.stopPropagation();window.PrimeShieldHub?.getCart()?.addItem({id:'${p.id}',name:'${p.name}',price:${p.price}},1)">
                    Add to Cart
                </button>
            </div>
        `).join('');
        
        // Render pagination
        this.renderPagination('pagination');
    }

    renderPagination(containerId = 'pagination') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const total = this.getTotalPages();
        if (total <= 1) {
            container.innerHTML = '';
            return;
        }
        
        const current = this.getCurrentPage();
        let html = '';
        
        if (this.hasPreviousPage()) {
            html += `<button onclick="window.PrimeShieldHub?.getProducts()?.setPage(${current - 1});window.PrimeShieldHub?.getProducts()?.renderProducts();">‹</button>`;
        }
        
        const maxVisible = 5;
        let start = Math.max(1, current - 2);
        let end = Math.min(total, start + maxVisible - 1);
        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }
        
        if (start > 1) {
            html += `<button onclick="window.PrimeShieldHub?.getProducts()?.setPage(1);window.PrimeShieldHub?.getProducts()?.renderProducts();">1</button>`;
            if (start > 2) html += `<span>…</span>`;
        }
        
        for (let i = start; i <= end; i++) {
            html += `<button class="${i === current ? 'active' : ''}" onclick="window.PrimeShieldHub?.getProducts()?.setPage(${i});window.PrimeShieldHub?.getProducts()?.renderProducts();">${i}</button>`;
        }
        
        if (end < total) {
            if (end < total - 1) html += `<span>…</span>`;
            html += `<button onclick="window.PrimeShieldHub?.getProducts()?.setPage(${total});window.PrimeShieldHub?.getProducts()?.renderProducts();">${total}</button>`;
        }
        
        if (this.hasNextPage()) {
            html += `<button onclick="window.PrimeShieldHub?.getProducts()?.setPage(${current + 1});window.PrimeShieldHub?.getProducts()?.renderProducts();">›</button>`;
        }
        
        container.innerHTML = html;
    }

    _formatCurrency(amount) {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    // ===== SUBSCRIPTION =====
    subscribe(callback) {
        this.listeners.push(callback);
        setTimeout(() => callback(this), 0);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notifyListeners() {
        this.listeners.forEach(callback => {
            try { callback(this); } catch (e) { console.warn('[ProductStore] Listener error:', e); }
        });
    }

    // ===== REFRESH =====
    async refresh() {
        this.clearCache();
        return this.loadProducts(true);
    }
}

// ===== SINGLETON INSTANCE =====
export const productStore = new ProductStore();

// ===== GLOBAL EXPOSURE =====
if (typeof window !== 'undefined') {
    window.productStore = productStore;
}

// ===== EXPORT DEFAULT =====
export default productStore;
