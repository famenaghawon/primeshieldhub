// ============================================================================
// public/buildmart/js/main.js — PrimeShieldHub BuildMart Site v11.5.0
// ============================================================================
// BuildMart site - Building materials and construction supplies
// Features: Store-specific product loading, contractor tools, project management
// ============================================================================

// ==================== IMPORTS ================
import { CONFIG } from '../../js/config.js';
import { auth } from '../../js/auth.js';
import { api } from '../../js/api-client.js';
import { bus, Events } from '../../js/events.js';
import { cartStore } from '../../js/cart-store.js';
import productStore from '../../js/product-store.js';
import { getDeviceFingerprint } from '../../js/sophisticated/fraud-engine/fingerprint.js';

// ==================== FEATURE IMPORTS ================
import { getAICloser } from '../../js/sophisticated/ai-closer.js';
import { initPredictivePrefetch } from '../../js/sophisticated/predictive-prefetch.js';
import { initAnalytics } from '../../js/analytics.js';
import { initWebVitals } from '../../js/web-vitals.js';
import { initBehaviorTracking } from '../../js/behavior/behavior.js';
import { initConversionEngine } from '../../js/sophisticated/conversion-engine.js';
import { initUpsellEngine } from '../../js/sophisticated/upsell-engine.js';

// ==================== BUILD MART CONSTANTS ================
const BUILDMART_CATEGORIES = [
    { id: 'cement', name: 'Cement & Concrete', icon: '🏗️', color: '#8B7D6B' },
    { id: 'roofing', name: 'Roofing Materials', icon: '🏠', color: '#C0392B' },
    { id: 'paints', name: 'Paints & Coatings', icon: '🎨', color: '#2980B9' },
    { id: 'plumbing', name: 'Plumbing', icon: '🔧', color: '#27AE60' },
    { id: 'electrical', name: 'Electrical', icon: '⚡', color: '#F39C12' },
    { id: 'timber', name: 'Timber & Wood', icon: '🪵', color: '#8D6E63' },
    { id: 'tools', name: 'Tools & Equipment', icon: '🔨', color: '#7F8C8D' },
    { id: 'hardware', name: 'Hardware', icon: '⚙️', color: '#5D6D7E' },
    { id: 'tiles', name: 'Tiles & Flooring', icon: '🧱', color: '#6C3483' },
    { id: 'gas-cylinders', name: 'Gas Cylinders', icon: '🔥', color: '#E74C3C' },
    { id: 'steel', name: 'Steel & Iron', icon: '🔩', color: '#717D7E' },
    { id: 'insulation', name: 'Insulation', icon: '🧊', color: '#85C1E9' },
    { id: 'windows', name: 'Windows & Doors', icon: '🪟', color: '#5D6D7E' },
    { id: 'sanitary', name: 'Sanitary Ware', icon: '🚿', color: '#1ABC9C' },
    { id: 'aggregates', name: 'Aggregates & Sand', icon: '🪨', color: '#A6ACAF' }
];

// BuildMart specific product IDs (fallback)
const BUILDMART_FALLBACK_PRODUCTS = [
    { id: 'bm1', name: 'Dangote Cement 50kg', price: 9500, category: 'cement', rating: 4.8, image: '/buildmart/assets/dangote-cement.webp', unit: 'bag', stock: 500 },
    { id: 'bm2', name: 'Dangote Cement 42.5R', price: 9800, category: 'cement', rating: 4.7, image: '/buildmart/assets/dangote-cement-425.webp', unit: 'bag', stock: 450 },
    { id: 'bm3', name: 'Lafarge Cement 50kg', price: 9200, category: 'cement', rating: 4.6, image: '/buildmart/assets/lafarge-cement.webp', unit: 'bag', stock: 380 },
    { id: 'bm4', name: 'Berger Paint 20L', price: 45000, category: 'paints', rating: 4.5, image: '/buildmart/assets/berger-paint.webp', unit: 'bucket', stock: 120 },
    { id: 'bm5', name: 'Dulux Paint 20L', price: 48000, category: 'paints', rating: 4.7, image: '/buildmart/assets/dulux-paint.webp', unit: 'bucket', stock: 100 },
    { id: 'bm6', name: 'Copper Pipe 15mm', price: 8500, category: 'plumbing', rating: 4.4, image: '/buildmart/assets/copper-pipe.webp', unit: 'length', stock: 300 },
    { id: 'bm7', name: 'PVC Pipe 50mm', price: 3200, category: 'plumbing', rating: 4.3, image: '/buildmart/assets/pvc-pipe.webp', unit: 'length', stock: 500 },
    { id: 'bm8', name: 'Roofing Sheet 3m', price: 28000, category: 'roofing', rating: 4.6, image: '/buildmart/assets/roofing-sheet.webp', unit: 'piece', stock: 200 },
    { id: 'bm9', name: 'Roofing Nails 50mm', price: 4500, category: 'roofing', rating: 4.2, image: '/buildmart/assets/roofing-nails.webp', unit: 'kg', stock: 600 },
    { id: 'bm10', name: 'Galvanized Pipe 25mm', price: 6500, category: 'plumbing', rating: 4.5, image: '/buildmart/assets/galvanized-pipe.webp', unit: 'length', stock: 400 },
    { id: 'bm11', name: 'Electrical Cable 2.5mm', price: 3500, category: 'electrical', rating: 4.4, image: '/buildmart/assets/electrical-cable.webp', unit: 'meter', stock: 800 },
    { id: 'bm12', name: 'Circuit Breaker 20A', price: 2800, category: 'electrical', rating: 4.3, image: '/buildmart/assets/circuit-breaker.webp', unit: 'piece', stock: 250 },
    { id: 'bm13', name: 'Hardwood Timber 4x2', price: 12000, category: 'timber', rating: 4.6, image: '/buildmart/assets/hardwood-timber.webp', unit: 'length', stock: 180 },
    { id: 'bm14', name: 'Plywood 4x8', price: 18000, category: 'timber', rating: 4.5, image: '/buildmart/assets/plywood.webp', unit: 'sheet', stock: 150 },
    { id: 'bm15', name: 'Ceramic Tiles 60x60', price: 8500, category: 'tiles', rating: 4.4, image: '/buildmart/assets/ceramic-tiles.webp', unit: 'box', stock: 300 },
    { id: 'bm16', name: 'Porcelain Tiles 60x60', price: 12000, category: 'tiles', rating: 4.7, image: '/buildmart/assets/porcelain-tiles.webp', unit: 'box', stock: 200 }
];

// ==================== APP STATE ================
const AppState = {
    initialized: false,
    user: null,
    isAdmin: false,
    isStaff: false,
    isReseller: false,
    fingerprint: null,
    pageLoadTime: performance.now(),
    sessionStart: Date.now(),
    products: [],
    categories: BUILDMART_CATEGORIES,
    storeType: 'buildmart', // Always buildmart for this site
    currentFilter: 'all',
    currentSort: 'default',
    currentPage: 1,
    totalProducts: 0,
    isLoading: false,
    // BuildMart specific state
    contractorMode: false,
    currentProject: null,
    quoteItems: [],
    viewMode: 'grid', // 'grid' | 'list'
    filters: {
        minPrice: 0,
        maxPrice: 999999999,
        stock: 'all',
        brand: ''
    }
};

// ==================== UI HELPERS ================
function updateAuthUI() {
    const user = auth?.getUser ? auth.getUser() : null;
    AppState.user = user;
    AppState.isAdmin = user?.role === 'admin';
    AppState.isStaff = user?.role === 'staff' || AppState.isAdmin;
    AppState.isReseller = user?.role === 'reseller' || user?.isReseller || false;
    
    // Update UI elements
    const emailEl = document.getElementById('user-email');
    const authBtn = document.getElementById('authStatusBtn');
    const adminTrigger = document.getElementById('adminPanelTrigger');
    const loginLink = document.getElementById('loginLink');
    const logoutLink = document.getElementById('logoutLink');
    const resellerBadge = document.getElementById('resellerBadge');
    const userAvatar = document.getElementById('userAvatar');
    const contractorBtn = document.getElementById('contractorModeBtn');
    
    if (user) {
        if (emailEl) {
            emailEl.textContent = user.email || user.name || 'User';
            emailEl.style.display = 'inline';
        }
        if (authBtn) {
            authBtn.style.display = 'inline-flex';
            authBtn.title = `Signed in as ${user.email || user.name}`;
        }
        if (adminTrigger) {
            adminTrigger.style.display = AppState.isAdmin ? 'inline' : 'none';
        }
        if (loginLink) loginLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'inline';
        if (resellerBadge) {
            resellerBadge.style.display = AppState.isReseller ? 'inline' : 'none';
        }
        if (userAvatar) {
            const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
            userAvatar.textContent = initial;
            if (user.avatar) {
                userAvatar.innerHTML = `<img src="${user.avatar}" alt="${user.name || 'User'}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            }
        }
        if (contractorBtn) {
            contractorBtn.style.display = 'inline-flex';
        }
    } else {
        if (emailEl) emailEl.style.display = 'none';
        if (authBtn) authBtn.style.display = 'none';
        if (adminTrigger) adminTrigger.style.display = 'none';
        if (loginLink) loginLink.style.display = 'inline';
        if (logoutLink) logoutLink.style.display = 'none';
        if (resellerBadge) resellerBadge.style.display = 'none';
        if (userAvatar) {
            userAvatar.textContent = '👤';
        }
        if (contractorBtn) {
            contractorBtn.style.display = 'none';
        }
    }
}

function updateCartUI() {
    const count = cartStore?.getCount ? cartStore.getCount() : 0;
    document.querySelectorAll('.cart-count, #cartCount, [data-cart-count]').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? 'inline-flex' : 'none';
    });
    
    const total = cartStore?.getGrandTotal ? cartStore.getGrandTotal() : 0;
    document.querySelectorAll('.cart-total, #cartTotal, [data-cart-total]').forEach(el => {
        el.textContent = formatCurrency(total);
    });
    
    const subtotal = cartStore?.getSubtotal ? cartStore.getSubtotal() : 0;
    document.querySelectorAll('.cart-subtotal, #cartSubtotal, [data-cart-subtotal]').forEach(el => {
        el.textContent = formatCurrency(subtotal);
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// ==================== NOTIFICATION SYSTEM ================
let notificationContainer = null;

function createNotificationContainer() {
    if (notificationContainer) return notificationContainer;
    
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notificationContainer';
    notificationContainer.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        z-index: 100000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 400px;
        width: calc(100% - 40px);
        pointer-events: none;
    `;
    document.body.appendChild(notificationContainer);
    return notificationContainer;
}

function showNotification(message, type = 'info', duration = 5000) {
    const container = createNotificationContainer();
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    const colors = {
        success: '#33ffaa',
        error: '#ff3366',
        warning: '#ffaa33',
        info: '#00f7ff'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        background: rgba(10,10,20,0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.1);
        border-left: 4px solid ${colors[type] || colors.info};
        border-radius: 12px;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.4s cubic-bezier(0.16,1,0.3,1);
        pointer-events: all;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        transition: all 0.3s ease;
    `;
    
    notification.innerHTML = `
        <span style="font-size:20px;">${icons[type] || icons.info}</span>
        <span style="flex:1;color:#f0f0f0;font-size:0.9rem;line-height:1.5;">${message}</span>
        <button style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#888;cursor:pointer;padding:4px 8px;font-size:12px;">
            ✕
        </button>
    `;
    
    const dismiss = () => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => notification.remove(), 300);
    };
    
    notification.querySelector('button').addEventListener('click', dismiss);
    
    if (duration > 0) {
        setTimeout(dismiss, duration);
    }
    
    container.appendChild(notification);
    
    // Limit to 5 notifications
    while (container.children.length > 5) {
        container.firstChild.remove();
    }
    
    return notification;
}

// ==================== LOADING INDICATOR ================
function showLoading(show) {
    AppState.isLoading = show;
    const container = document.getElementById('products-container');
    if (!container) return;
    
    if (show) {
        container.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:60px;">
                <div class="loader" style="
                    width:48px;
                    height:48px;
                    border:4px solid rgba(214,178,94,0.1);
                    border-top:4px solid #d6b25e;
                    border-radius:50%;
                    animation: spin 1s linear infinite;
                    margin:0 auto 20px;
                "></div>
                <p style="color:#7a7870;">Loading building materials...</p>
            </div>
        `;
    }
}

// ==================== PRODUCTS ================
/**
 * Load BuildMart products from API
 * Uses api.getBuildMartProducts() for store-specific products
 */
async function loadProductsFromAPI(options = {}) {
    const {
        category = AppState.currentFilter || 'all',
        search = '',
        sort = AppState.currentSort || 'default',
        page = AppState.currentPage || 1,
        limit = 12,
        minPrice = AppState.filters.minPrice || 0,
        maxPrice = AppState.filters.maxPrice || 999999999,
        stock = AppState.filters.stock || 'all',
        brand = AppState.filters.brand || ''
    } = options;

    try {
        showLoading(true);
        
        // Calculate offset from page
        const offset = (page - 1) * limit;
        
        // Build filter options for BuildMart API
        const filterOptions = {
            category: category !== 'all' ? category : '',
            search: search,
            minPrice: minPrice,
            maxPrice: maxPrice,
            stock: stock,
            brand: brand,
            limit: limit,
            offset: offset
        };
        
        console.log('🏗️ Loading BuildMart products with options:', filterOptions);
        
        // Use the BuildMart API client
        const response = await api.getBuildMartProducts(filterOptions);
        
        console.log('🏗️ BuildMart API Response:', response);
        
        let products = response.products || [];
        const total = response.total || 0;
        
        // Client-side sorting
        if (sort === 'price-asc') {
            products.sort((a, b) => (a.price || 0) - (b.price || 0));
        } else if (sort === 'price-desc') {
            products.sort((a, b) => (b.price || 0) - (a.price || 0));
        } else if (sort === 'rating') {
            products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else if (sort === 'name-asc') {
            products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } else if (sort === 'stock-asc') {
            products.sort((a, b) => (a.stock || 0) - (b.stock || 0));
        } else if (sort === 'stock-desc') {
            products.sort((a, b) => (b.stock || 0) - (a.stock || 0));
        }
        
        // Update state
        AppState.products = products;
        AppState.totalProducts = total;
        AppState.currentFilter = category;
        AppState.currentSort = sort;
        AppState.currentPage = page;
        
        console.log(`🏗️ Loaded ${products.length} building materials (total: ${total})`);
        
        return { products, total };
        
    } catch (error) {
        console.error('❌ Failed to load BuildMart products:', error);
        showNotification('Failed to load building materials. Please refresh.', 'error', 5000);
        
        // Fallback to local products
        const fallback = getFallbackProducts(category, search);
        AppState.products = fallback;
        AppState.totalProducts = fallback.length;
        
        return { products: fallback, total: fallback.length };
        
    } finally {
        showLoading(false);
    }
}

/**
 * Get fallback BuildMart products
 */
function getFallbackProducts(category, search) {
    let products = [...BUILDMART_FALLBACK_PRODUCTS];
    
    // Filter by category
    if (category && category !== 'all') {
        products = products.filter(p => p.category === category);
    }
    
    // Filter by search
    if (search && search.trim()) {
        const query = search.toLowerCase().trim();
        products = products.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.category.toLowerCase().includes(query)
        );
    }
    
    return products;
}

/**
 * Render BuildMart products to the DOM
 */
function renderProducts(filter = 'all', sort = 'default', page = 1) {
    const container = document.getElementById('products-container');
    if (!container) {
        console.warn('Products container not found');
        return;
    }

    // Use loaded products or fallback
    let products = AppState.products && AppState.products.length > 0
        ? AppState.products
        : getFallbackProducts(filter, '');

    // Filter (if not already filtered by API)
    if (filter !== 'all' && filter !== AppState.currentFilter) {
        products = products.filter(p => p.category === filter);
    }

    // Sort
    switch(sort) {
        case 'price-asc': products.sort((a,b) => (a.price || 0) - (b.price || 0)); break;
        case 'price-desc': products.sort((a,b) => (b.price || 0) - (a.price || 0)); break;
        case 'rating': products.sort((a,b) => (b.rating || 0) - (a.rating || 0)); break;
        case 'name-asc': products.sort((a,b) => (a.name || '').localeCompare(b.name || '')); break;
        case 'stock-asc': products.sort((a,b) => (a.stock || 0) - (b.stock || 0)); break;
        case 'stock-desc': products.sort((a,b) => (b.stock || 0) - (a.stock || 0)); break;
        default: break;
    }

    // Pagination
    const perPage = 12;
    const totalPages = Math.max(1, Math.ceil(products.length / perPage));
    const start = (page - 1) * perPage;
    const paginated = products.slice(start, start + perPage);

    if (paginated.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:60px;color:#7a7870;">
                <i class="fas fa-hard-hat" style="font-size:48px;color:#d6b25e;display:block;margin-bottom:16px;"></i>
                <h3 style="color:#f0efe8;">No building materials found</h3>
                <p>Try adjusting your filter or check back later.</p>
                <button onclick="window.PrimeShieldHub?.clearFilters?.()" style="
                    margin-top:16px;
                    padding:10px 24px;
                    background:#d6b25e;
                    border:none;
                    border-radius:8px;
                    color:#0a0a14;
                    font-weight:600;
                    cursor:pointer;
                ">Clear Filters</button>
            </div>
        `;
        return;
    }

    // Render based on view mode
    const isListView = AppState.viewMode === 'list';
    
    container.innerHTML = paginated.map(function(p) {
        const stockStatus = p.stock > 50 ? 'In Stock' :
                           p.stock > 10 ? 'Limited Stock' :
                           p.stock > 0 ? 'Low Stock' : 'Out of Stock';
        const stockColor = p.stock > 50 ? '#33ffaa' :
                          p.stock > 10 ? '#ffaa33' :
                          p.stock > 0 ? '#ff6633' : '#ff3366';
        
        // Calculate rating safely (FIX: pre-calculate to avoid parser confusion)
        const ratingValue = typeof p.rating === 'number' ? p.rating : 4;
        const fullStars = Math.floor(Math.min(Math.max(ratingValue, 0), 5));
        const emptyStars = Math.max(0, 5 - fullStars);
        const starString = '★'.repeat(fullStars) + '☆'.repeat(emptyStars);
        const ratingDisplay = ratingValue.toFixed(1);
        
        if (isListView) {
            return `
                <div class="product-card product-list-item" data-product-id="${p.id}" style="
                    display:grid;
                    grid-template-columns:120px 1fr auto;
                    gap:16px;
                    padding:16px;
                    align-items:center;
                ">
                    <img src="${p.image || '/buildmart/assets/placeholder.webp'}" alt="${p.name}"
                         style="width:120px;height:120px;object-fit:cover;border-radius:8px;"
                         onerror="this.src='/company_logo.png'" loading="lazy">
                    <div>
                        <div class="product-title" style="font-weight:600;">${p.name}</div>
                        <div style="color:#7a7870;font-size:0.85rem;display:flex;gap:12px;flex-wrap:wrap;">
                            <span>${p.category}</span>
                            <span>Unit: ${p.unit || 'piece'}</span>
                            <span style="color:${stockColor};">${stockStatus} (${p.stock || 0})</span>
                        </div>
                        <div class="product-rating">${starString} (${ratingDisplay})</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="product-price" style="font-size:1.2rem;font-weight:700;">₦${(p.price || 0).toLocaleString()}</div>
                        <button class="product-btn" onclick="window.PrimeShieldHub?.addToCart?.('${p.id}')" style="
                            padding:8px 16px;
                            background:#d6b25e;
                            border:none;
                            border-radius:6px;
                            color:#0a0a14;
                            font-weight:600;
                            cursor:pointer;
                            transition:all 0.3s ease;
                        ">
                            <i class="fas fa-cart-plus"></i> Add
                        </button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="product-card" data-product-id="${p.id}">
                    <img src="${p.image || '/buildmart/assets/placeholder.webp'}" alt="${p.name}" class="product-image"
                         onerror="this.src='/company_logo.png'" loading="lazy">
                    <div style="position:absolute;top:10px;right:10px;background:${stockColor};color:#fff;padding:2px 10px;border-radius:12px;font-size:0.7rem;font-weight:600;">
                        ${p.stock || 0}
                    </div>
                    <div class="product-title">${p.name}</div>
                    <div style="color:#7a7870;font-size:0.8rem;">${p.unit || 'piece'} • ${p.category}</div>
                    <div class="product-price">₦${(p.price || 0).toLocaleString()}</div>
                    <div class="product-rating">${starString} (${ratingDisplay})</div>
                    <button class="product-btn" onclick="window.PrimeShieldHub?.addToCart?.('${p.id}')">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                </div>
            `;
        }
    }).join('');

    // Pagination controls
    const paginationEl = document.getElementById('pagination');
    if (paginationEl) {
        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }
        let html = '';
        // Previous button
        if (page > 1) {
            html += `<button class="page-btn" data-page="${page - 1}" data-filter="${filter}" data-sort="${sort}">‹</button>`;
        }
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}" data-filter="${filter}" data-sort="${sort}">${i}</button>`;
        }
        if (page < totalPages) {
            html += `<button class="page-btn" data-page="${page + 1}" data-filter="${filter}" data-sort="${sort}">›</button>`;
        }
        paginationEl.innerHTML = html;
        paginationEl.querySelectorAll('.page-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const pageNum = parseInt(this.dataset.page);
                const filterVal = this.dataset.filter || 'all';
                const sortVal = this.dataset.sort || 'default';
                AppState.currentPage = pageNum;
                loadProductsFromAPI({
                    category: filterVal,
                    sort: sortVal,
                    page: pageNum
                }).then(function() {
                    renderProducts(filterVal, sortVal, pageNum);
                });
            });
        });
    }
    
    // Update product count
    const countEl = document.getElementById('productCount');
    if (countEl) {
        const total = AppState.totalProducts || products.length;
        const showing = Math.min(paginated.length, perPage);
        countEl.textContent = 'Showing ' + ((page - 1) * perPage + 1) + '-' + Math.min(page * perPage, total) + ' of ' + total + ' materials';
    }
}

// ==================== ADD TO CART ================
function addToCart(productId) {
    const products = AppState.products && AppState.products.length > 0 
        ? AppState.products 
        : BUILDMART_FALLBACK_PRODUCTS;
    const product = products.find(p => p.id === productId);
    if (!product) {
        showNotification('Product not found', 'error', 3000);
        return;
    }

    if (product.stock <= 0) {
        showNotification('Product is out of stock', 'error', 3000);
        return;
    }

    let cart = JSON.parse(localStorage.getItem('psh_cart') || '[]');
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        if (existing.quantity >= product.stock) {
            showNotification('Not enough stock available', 'warning', 3000);
            return;
        }
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        cart.push({ 
            id: product.id, 
            name: product.name, 
            price: product.price, 
            image: product.image, 
            quantity: 1,
            unit: product.unit || 'piece',
            maxStock: product.stock
        });
    }
    localStorage.setItem('psh_cart', JSON.stringify(cart));

    showNotification(`${product.name} added to cart!`, 'success', 3000);
    
    // Update cart UI
    if (cartStore && typeof cartStore.notifySubscribers === 'function') {
        cartStore.notifySubscribers();
    } else {
        const count = cart.reduce((s, i) => s + (i.quantity || 1), 0);
        document.querySelectorAll('.cart-count, #cartCount, [data-cart-count]').forEach(el => {
            el.textContent = count;
            el.style.display = count > 0 ? 'inline-flex' : 'none';
        });
    }
}

// ==================== CLEAR FILTERS ================
function clearFilters() {
    AppState.filters = {
        minPrice: 0,
        maxPrice: 999999999,
        stock: 'all',
        brand: ''
    };
    
    AppState.currentFilter = 'all';
    AppState.currentPage = 1;

    // Reset UI
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
    document.getElementById('priceMin').value = '';
    document.getElementById('priceMax').value = '';
    document.getElementById('stockFilter').value = 'all';
    document.getElementById('searchInput').value = '';

    loadProductsFromAPI({
        category: 'all',
        sort: AppState.currentSort || 'default',
        page: 1
    }).then(() => {
        renderProducts('all', AppState.currentSort, 1);
        showNotification('Filters cleared', 'info', 2000);
    });

    AppState.currentFilter = 'all';
    AppState.currentPage = 1;

    // Reset UI
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
    document.getElementById('priceMin').value = '';
    document.getElementById('priceMax').value = '';
    document.getElementById('stockFilter').value = 'all';
    document.getElementById('searchInput').value = '';

    loadProductsFromAPI({
        category: 'all',
        sort: AppState.currentSort || 'default',  // ← Fixed capitalization
        page: 1
    }).then(() => {  // ← Fixed arrow function
        renderProducts('all', AppState.currentSort, 1);
        showNotification('Filters cleared', 'info', 2000);
    });
}

// ==================== SETUP FILTERS ================
function setupCategoryFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filter = this.dataset.filter || 'all';
            const sort = document.getElementById('sortSelect')?.value || 'default';
            AppState.currentFilter = filter;
            AppState.currentPage = 1;
            
            await loadProductsFromAPI({
                category: filter,
                sort: sort,
                page: 1
            });
            
            renderProducts(filter, sort, 1);
        });
    });
}

function setupSortSelect() {
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', async function() {
            const filter = document.querySelector('.filter-btn.active')?.dataset?.filter || 'all';
            const sort = this.value;
            AppState.currentSort = sort;
            AppState.currentPage = 1;
            
            await loadProductsFromAPI({
                category: filter,
                sort: sort,
                page: 1
            });
            
            renderProducts(filter, sort, 1);
        });
    }
}

function setupPriceFilter() {
    const applyBtn = document.getElementById('applyPriceFilter');
    if (applyBtn) {
        applyBtn.addEventListener('click', async function() {
            const min = parseFloat(document.getElementById('priceMin')?.value) || 0;
            const max = parseFloat(document.getElementById('priceMax')?.value) || 999999999;
            AppState.filters.minPrice = min;
            AppState.filters.maxPrice = max;
            AppState.currentPage = 1;
            
            await loadProductsFromAPI({
                category: AppState.currentFilter || 'all',
                sort: AppState.currentSort || 'default',
                page: 1,
                minPrice: min,
                maxPrice: max
            });
            
            renderProducts(AppState.currentFilter, AppState.currentSort, 1);
            showNotification(`Price filter applied: ₦${min.toLocaleString()} - ₦${max.toLocaleString()}`, 'info', 3000);
        });
    }
}

function setupStockFilter() {
    const stockFilter = document.getElementById('stockFilter');
    if (stockFilter) {
        stockFilter.addEventListener('change', async function() {
            const stock = this.value;
            AppState.filters.stock = stock;
            AppState.currentPage = 1;
            
            await loadProductsFromAPI({
                category: AppState.currentFilter || 'all',
                sort: AppState.currentSort || 'default',
                page: 1,
                stock: stock
            });
            
            renderProducts(AppState.currentFilter, AppState.currentSort, 1);
        });
    }
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    const performSearch = async () => {
        if (!searchInput) return;
        const query = searchInput.value.trim();
        AppState.currentPage = 1;
        
        if (!query) {
            await loadProductsFromAPI({
                category: AppState.currentFilter || 'all',
                sort: AppState.currentSort || 'default',
                page: 1
            });
            renderProducts(AppState.currentFilter, AppState.currentSort, 1);
            return;
        }
        
        await loadProductsFromAPI({
            search: query,
            category: 'all',
            sort: AppState.currentSort || 'default',
            page: 1
        });
        renderProducts('all', AppState.currentSort, 1);
    };
    
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
        // Debounced search on input
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(performSearch, 500);
        });
    }
}

function setupViewToggle() {
    const gridBtn = document.getElementById('viewGridBtn');
    const listBtn = document.getElementById('viewListBtn');
    
    if (gridBtn) {
        gridBtn.addEventListener('click', () => {
            AppState.viewMode = 'grid';
            gridBtn.classList.add('active');
            if (listBtn) listBtn.classList.remove('active');
            renderProducts(AppState.currentFilter, AppState.currentSort, AppState.currentPage);
        });
    }
    
    if (listBtn) {
        listBtn.addEventListener('click', () => {
            AppState.viewMode = 'list';
            listBtn.classList.add('active');
            if (gridBtn) gridBtn.classList.remove('active');
            renderProducts(AppState.currentFilter, AppState.currentSort, AppState.currentPage);
        });
    }
}

// ==================== CONTRACTOR MODE ================
function setupContractorMode() {
    const contractorBtn = document.getElementById('contractorModeBtn');
    const contractorPanel = document.getElementById('contractorPanel');
    
    if (contractorBtn && contractorPanel) {
        contractorBtn.addEventListener('click', () => {
            AppState.contractorMode = !AppState.contractorMode;
            contractorPanel.style.display = AppState.contractorMode ? 'block' : 'none';
            contractorBtn.classList.toggle('active');
            contractorBtn.textContent = AppState.contractorMode ? '🔧 Contractor Mode ON' : '🔨 Contractor Mode';
            
            if (AppState.contractorMode) {
                showNotification('Contractor Mode activated', 'success', 3000);
            } else {
                showNotification('Contractor Mode deactivated', 'info', 3000);
            }
        });
    }
}

// ==================== CATEGORY NAVIGATION ================
function renderCategoryNav() {
    const nav = document.getElementById('categoryNav');
    if (!nav) return;
    
    nav.innerHTML = `
        <button class="filter-btn active" data-filter="all">All Materials</button>
        ${AppState.categories.map(cat => `
            <button class="filter-btn" data-filter="${cat.id}" style="
                display:flex;
                align-items:center;
                gap:6px;
            ">
                <span>${cat.icon}</span>
                ${cat.name}
            </button>
        `).join('')}
    `;
}

// ==================== INITIALIZATION ================
async function initApp() {
    if (AppState.initialized) return;
    
    console.log('🏗️ PrimeShieldHub BuildMart v11.5.0 Initializing...');
    console.log(`📍 API: ${CONFIG?.apiBase || 'https://api.primeshieldhub.com/api'}`);
    
    try {
        // 1. Get fingerprint
        try {
            AppState.fingerprint = await getDeviceFingerprint();
            console.log(`🔑 Fingerprint: ${AppState.fingerprint?.substring(0, 12) || 'fallback'}...`);
        } catch (e) {
            AppState.fingerprint = 'fallback-' + Date.now();
            console.warn('Fingerprint fallback:', e.message);
        }
        
        // 2. Initialize features (non-blocking)
        const featurePromises = [
    typeof initPredictivePrefetch === 'function' ? initPredictivePrefetch().catch(e => console.warn('Prefetch init:', e)) : Promise.resolve(),
    typeof initUpsellEngine === 'function' ? initUpsellEngine().catch(e => console.warn('Upsell init:', e)) : Promise.resolve(),
    typeof initAnalytics === 'function' ? initAnalytics().catch(e => console.warn('Analytics init:', e)) : Promise.resolve(),
    typeof initWebVitals === 'function' ? initWebVitals().catch(e => console.warn('WebVitals init:', e)) : Promise.resolve(),
    typeof initBehaviorTracking === 'function' ? initBehaviorTracking().catch(e => console.warn('Behavior init:', e)) : Promise.resolve(),
    typeof initConversionEngine === 'function' ? initConversionEngine().catch(e => console.warn('Conversion init:', e)) : Promise.resolve()
];
        
        Promise.allSettled(featurePromises).then(results => {
            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                console.warn(`⚠️ ${failed.length} features failed to initialize`);
            }
        });
        
        // 3. Set up UI
        updateAuthUI();
        updateCartUI();
        setupGlobalListeners();
        setupMobileEnhancements();
        renderCategoryNav();
        
        // 4. Check authentication
        if (auth && typeof auth.getUser === 'function') {
            const user = auth.getUser();
            if (!user && typeof auth.fetchCurrentUser === 'function') {
                await auth.fetchCurrentUser().catch(() => {});
            }
            AppState.user = auth.getUser();
        }
        
        // 5. Set up filters and controls
        setupCategoryFilters();
        setupSortSelect();
        setupPriceFilter();
        setupStockFilter();
        setupSearch();
        setupViewToggle();
        setupContractorMode();
        
        // 6. Load products
        const hasProductsContainer = document.getElementById('products-container');
        if (hasProductsContainer) {
            try {
                const filter = document.querySelector('.filter-btn.active')?.dataset?.filter || 'all';
                const sort = document.getElementById('sortSelect')?.value || 'default';
                AppState.currentFilter = filter;
                AppState.currentSort = sort;
                
                await loadProductsFromAPI({
                    category: filter,
                    sort: sort,
                    page: 1
                });
                
                renderProducts(filter, sort, 1);
                
            } catch (e) {
                console.warn('Product loading failed:', e);
                renderProducts('all', 'default', 1);
            }
        }
        
        // 7. Emit ready event
        AppState.initialized = true;
        document.dispatchEvent(new CustomEvent('app:ready'));
        if (bus?.emit) bus.emit(Events.PAGE_LOADED, {
            page: window.location.pathname,
            loadTime: performance.now() - AppState.pageLoadTime,
            store: 'buildmart'
        });
        
        console.log('✅ PrimeShieldHub BuildMart Ready');
        console.log(`👤 User: ${AppState.user?.email || 'Guest'} | Role: ${AppState.user?.role || 'none'}`);
        console.log(`🏗️ Materials: ${AppState.products?.length || 0} | Cart: ${cartStore?.getCount?.() || 0}`);
        
    } catch (error) {
        console.error('❌ BuildMart init failed:', error);
        showNotification('Failed to initialize. Please refresh.', 'error', 0);
    }
}

// ==================== GLOBAL LISTENERS ================
function setupGlobalListeners() {
    // Auth button
    document.getElementById('authStatusBtn')?.addEventListener('click', async () => {
        const user = auth?.getUser ? auth.getUser() : null;
        if (user) {
            if (confirm(`Logged in as ${user.email || user.name}\n\nClick OK to logout.`)) {
                if (auth && typeof auth.logout === 'function') {
                    await auth.logout();
                }
                showNotification('Logged out successfully', 'success');
                window.location.href = '/buildmart/login';
            }
        } else {
            window.location.href = '/buildmart/login';
        }
    });
    
    // Scroll to top
    window.addEventListener('scroll', () => {
        const btn = document.getElementById('scrollTopBtn');
        if (btn) {
            btn.style.display = window.scrollY > 400 ? 'flex' : 'none';
        }
    }, { passive: true });
    
    document.getElementById('scrollTopBtn')?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');
    
    if (mobileMenuBtn && mobileNav) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isOpen = mobileNav.style.display === 'flex';
            mobileNav.style.display = isOpen ? 'none' : 'flex';
            mobileMenuBtn.setAttribute('aria-expanded', !isOpen);
        });
    }
    
    // Close mobile nav on outside click
    document.addEventListener('click', (e) => {
        if (mobileNav && mobileNav.style.display === 'flex') {
            if (!mobileNav.contains(e.target) && !mobileMenuBtn?.contains(e.target)) {
                mobileNav.style.display = 'none';
                if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'false');
            }
        }
    });
}

// ==================== MOBILE ENHANCEMENTS ================
function setupMobileEnhancements() {
    const isMobile = window.innerWidth <= 768;
    const isSmall = window.innerWidth <= 480;
    
    document.querySelectorAll('.filter-btn, .sort-select, .page-btn, .product-btn, .nav-link').forEach(el => {
        el.style.minHeight = isMobile ? '44px' : '';
        el.style.fontSize = isMobile ? '0.9rem' : '';
    });
    
    // Adjust product cards for mobile
    if (isSmall) {
        document.querySelectorAll('.product-card').forEach(card => {
            card.style.padding = '12px';
        });
    }
}

// ==================== ERROR HANDLING ================
window.addEventListener('error', (e) => {
    console.error('[BuildMart Error]', e.message);
    if (bus?.emit) bus.emit(Events.ERROR_OCCURRED, { 
        message: e.message, 
        source: e.filename, 
        line: e.lineno,
        column: e.colno 
    });
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('[BuildMart Promise Error]', e.reason);
    if (bus?.emit) bus.emit(Events.ERROR_OCCURRED, { 
        message: e.reason?.message || 'Unhandled rejection',
        stack: e.reason?.stack
    });
});

// ==================== ONLINE/OFFLINE ================
window.addEventListener('online', () => {
    document.getElementById('offlineBanner')?.classList.remove('show');
    showNotification('Back online!', 'success', 3000);
    if (bus?.emit) bus.emit(Events.ONLINE);
    
    if (!AppState.products || AppState.products.length === 0) {
        loadProductsFromAPI({
            category: AppState.currentFilter || 'all',
            sort: AppState.currentSort || 'default',
            page: AppState.currentPage || 1
        }).then(() => {
            renderProducts(AppState.currentFilter, AppState.currentSort, AppState.currentPage);
        }).catch(() => {});
    }
});

window.addEventListener('offline', () => {
    document.getElementById('offlineBanner')?.classList.add('show');
    showNotification('You are offline', 'warning', 0);
    if (bus?.emit) bus.emit(Events.OFFLINE);
});

// ==================== SERVICE WORKER ================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(r => {
                console.log('✅ BuildMart SW registered:', r.scope);
                if (r.update) r.update();
            })
            .catch(e => console.warn('BuildMart SW registration failed:', e));
    });
}

// ==================== SPLASH SCREEN ================
function initSplashScreen() {
    const splash = document.getElementById('quantumSplashScreen');
    if (!splash) return;
    
    splash.style.display = 'flex';
    splash.classList.remove('fade-out');
    
    const hideSplash = () => {
        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
        }, 1800);
    };
    
    if (document.readyState === 'complete') {
        hideSplash();
    } else {
        window.addEventListener('load', hideSplash);
        setTimeout(hideSplash, 5000);
    }
}

// ==================== PUBLIC API ================
window.PrimeShieldHub = {
    getState: () => AppState,
    getConfig: () => CONFIG,
    getAuth: () => auth,
    getAPI: () => api,
    getCart: () => cartStore,
    getProducts: () => {
        try {
            return productStore || AppState.products;
        } catch {
            return AppState.products;
        }
    },
    loadProducts: loadProductsFromAPI,
    renderProducts: renderProducts,
    addToCart: addToCart,
    clearFilters: clearFilters,
    showNotification: showNotification,
    formatCurrency: formatCurrency,
    getStoreType: () => AppState.storeType,
    toggleContractorMode: () => {
        AppState.contractorMode = !AppState.contractorMode;
        return AppState.contractorMode;
    },
    version: '11.5.0'
};

// ==================== START ================
initSplashScreen();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    setTimeout(initApp, 50);
}

// ==================== EXPORTS ================
export {
    initApp,
    AppState,
    updateAuthUI,
    updateCartUI,
    setupGlobalListeners,
    setupMobileEnhancements,
    initSplashScreen,
    formatCurrency,
    renderProducts,
    loadProductsFromAPI,
    addToCart,
    showNotification,
    clearFilters,
    BUILDMART_CATEGORIES,
    BUILDMART_FALLBACK_PRODUCTS
};








