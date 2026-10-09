// ============================================================================
// public../js/main.js — PrimeShieldHub Quantum Core v11.6.0
// FIXED: checkStaffStatus is not defined error
// FIXED: Duplicate export of 'AppState' removed
// FIXED: Safe handling of CONFIG.TOKEN
// FIXED: All original features preserved
// ADDED: Store filtering for Gadgets site (store = 'gadgets')
// ADDED: BuildMart product support
// FIXED: getAI is not defined error
// FIXED: Analytics 405 error handling
// FIXED: Service Worker registration error handling
// ADDED: checkStaffStatus function
// ADDED: better error recovery
// ADDED: Full pagination with Next/Previous buttons
// ADDED: Search with debounce and clear button
// ADDED: Per page selector (12, 24, 48, 96)
// ADDED: Results info display
// ADDED: Dynamic page number generation with ellipsis
// ============================================================================

// ==================== IMPORTS ====================
import { CONFIG } from './config.js';
import { auth } from './auth.js';
import { api } from './api-client.js';
import { bus, Events } from './events.js';
import { cartStore } from './cart-store.js';
import { productStore } from './product-store.js';
import { getDeviceFingerprint } from './sophisticated/fraud-engine/fingerprint.js';

// ==================== FEATURE IMPORTS ====================
import { initPredictivePrefetch } from './sophisticated/predictive-prefetch.js';
import { initAnalytics } from './analytics.js';
import { initWebVitals } from './web-vitals.js';
import { initBehaviorTracking } from './sophisticated/fraud-engine/behavior.js';
import { initConversionEngine } from './sophisticated/conversion-engine.js';
import { initUpsellEngine } from './sophisticated/upsell-engine.js';

// ==================== AI MODULE - SAFE LOADING ====================
// Try to load AI module if it exists, otherwise use a stub
let getAI = null;
let aiCloser = null;

try {
    // Try to import AI module dynamically
    const aiModule = await import('./sophisticated/ai-closer.js');
    if (aiModule && typeof aiModule.getAI === 'function') {
        getAI = aiModule.getAI;
    }
    if (aiModule && typeof aiModule.getAICloser === 'function') {
        aiCloser = aiModule.getAICloser;
    }
    console.log('🧠 AI module loaded successfully');
} catch (e) {
    console.log('🧠 AI module not available, using stub');
    // Create stub functions
    getAI = function() {
        return Promise.resolve({
            enabled: false,
            model: 'stub',
            version: '1.0.0'
        });
    };
    aiCloser = function() {
        return Promise.resolve({
            enabled: false,
            message: 'AI closer not available'
        });
    };
}

// Make getAI available globally for other modules
if (typeof window !== 'undefined') {
    window.getAI = getAI;
    window.aiCloser = aiCloser;
}

// ==================== FIX: checkStaffStatus ====================
/**
 * Check if the current user is a staff member
 * This function is used by the PWA install prompt and other features
 */
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
                // Also check if user has staff flag
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

// Make checkStaffStatus globally available
if (typeof window !== 'undefined') {
    window.checkStaffStatus = checkStaffStatus;
}

// ==================== APP STATE ====================
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
    categories: [],
    // Store type for current site
    storeType: 'gadgets', // 'gadgets' | 'buildmart' | 'both'
    currentFilter: 'all',
    currentSort: 'default',
    currentPage: 1,
    totalProducts: 0,
    isLoading: false
};

// ==================== PAGINATION STATE ====================
let currentPage = 1;
let currentPerPage = 24;
let currentFilter = 'all';
let currentSort = 'default';
let currentSearch = '';
let allProducts = [];
let totalProducts = 0;
let isSearching = false;

// ==================== UI HELPERS ====================
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

// ==================== NOTIFICATION SYSTEM ====================
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

// ==================== LOADING INDICATOR ====================
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
                <p style="color:#7a7870;">Loading products...</p>
            </div>
        `;
    }
}

// ==================== PRODUCTS ====================
const FALLBACK_PRODUCTS = [];

// ===== CATEGORY MAPS =====
const GADGETS_CATEGORIES = [
    'accessories', 'audio', 'smartphones', 'laptops', 'tablets', 
    'wearables', 'gaming', 'tv', 'appliances', 'speakers', 
    'headphones', 'chargers', 'cables', 'powerbanks'
];

const BUILDMART_CATEGORIES = [
    'cement', 'roofing', 'paints', 'plumbing', 'electrical', 
    'timber', 'tools', 'hardware', 'tiles', 'gas-cylinders', 
    'steel', 'insulation', 'windows', 'sanitary', 'aggregates'
];

/**
 * Get fallback products for a store
 */
function getFallbackProducts(store, category) {
    let products = FALLBACK_PRODUCTS;
    
    // Filter by store type
    if (store === 'gadgets') {
        products = products.filter(p => GADGETS_CATEGORIES.includes(p.category));
    } else if (store === 'buildmart') {
        products = products.filter(p => BUILDMART_CATEGORIES.includes(p.category));
    }
    
    // Filter by category
    if (category && category !== 'all') {
        products = products.filter(p => p.category === category);
    }
    
    return products;
}

// ==================== SEARCH FUNCTIONS ====================

// ===== PERFORM SEARCH =====
function performSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    
    currentSearch = input.value.trim();
    currentPage = 1;
    
    // Show clear button
    const clearBtn = document.getElementById('searchClear');
    if (clearBtn) {
        clearBtn.style.display = currentSearch.length > 0 ? 'block' : 'none';
    }
    
    // Reset filter to 'all' when searching
    if (currentSearch.length > 0) {
        isSearching = true;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
        currentFilter = 'all';
    } else {
        isSearching = false;
    }
    
    loadAndRenderProducts();
}

// ===== CLEAR SEARCH =====
function clearSearch() {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = '';
        currentSearch = '';
        isSearching = false;
        currentPage = 1;
        const clearBtn = document.getElementById('searchClear');
        if (clearBtn) clearBtn.style.display = 'none';
        // Reset to active filter
        const activeFilter = document.querySelector('.filter-btn.active')?.dataset?.filter || 'all';
        currentFilter = activeFilter;
        loadAndRenderProducts();
    }
}

// ===== LOAD AND RENDER PRODUCTS =====
async function loadAndRenderProducts() {
    try {
        showLoading(true);
        
        // Build API params
        const params = {
            store: AppState.storeType || 'gadgets',
            limit: currentPerPage,
            offset: (currentPage - 1) * currentPerPage,
            category: currentFilter !== 'all' ? currentFilter : '',
            search: currentSearch || ''
        };
        
        // Add sort
        if (currentSort === 'price-asc') {
            params.minPrice = 0;
            params.maxPrice = 999999999;
        } else if (currentSort === 'price-desc') {
            params.minPrice = 0;
            params.maxPrice = 999999999;
        }
        
        console.log('📦 Loading products:', params);
        
        // Try API first
        let products = [];
        let total = 0;
        
        try {
            const response = await api.getProducts(params);
            products = response.products || [];
            total = response.total || 0;
        } catch (apiError) {
            console.warn('API failed, using fallback:', apiError);
            // Use fallback products
            const fallback = getFallbackProducts(AppState.storeType || 'gadgets', currentFilter);
            products = fallback;
            total = fallback.length;
        }
        
        // Client-side sorting if needed
        if (currentSort === 'price-asc') {
            products.sort((a, b) => (a.price || 0) - (b.price || 0));
        } else if (currentSort === 'price-desc') {
            products.sort((a, b) => (b.price || 0) - (a.price || 0));
        } else if (currentSort === 'rating') {
            products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else if (currentSort === 'name-asc') {
            products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } else if (currentSort === 'name-desc') {
            products.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        } else if (currentSort === 'newest') {
            products.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }
        
        allProducts = products;
        totalProducts = total;
        AppState.products = products;
        AppState.totalProducts = total;
        
        renderProductsWithPagination(products, total);
        updatePaginationControls(total);
        updateResultsInfo(products.length, total);
        
        console.log(`✅ Loaded ${products.length} of ${total} products`);
        
    } catch (error) {
        console.error('❌ Failed to load products:', error);
        showNotification('Failed to load products. Please refresh.', 'error', 5000);
    } finally {
        showLoading(false);
    }
}

// ===== RENDER PRODUCTS WITH PAGINATION =====
function renderProductsWithPagination(products, total) {
    const container = document.getElementById('products-container');
    if (!container) return;
    
    if (!products || products.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:#7a7870;">
                <i class="fas fa-box-open" style="font-size:64px;color:#d6b25e;display:block;margin-bottom:20px;opacity:0.5;"></i>
                <h3 style="color:#f0efe8;font-size:1.4rem;margin-bottom:12px;">${currentSearch ? 'No products found' : 'No products available'}</h3>
                <p style="max-width:400px;margin:0 auto;line-height:1.8;">
                    ${currentSearch ? `No results found for "<strong>${currentSearch}</strong>". Try adjusting your search or filter.` : 'Check back later for new arrivals.'}
                </p>
                ${currentSearch ? `<button onclick="clearSearch()" style="margin-top:20px;padding:10px 24px;background:rgba(214,178,94,0.1);border:1px solid rgba(214,178,94,0.2);border-radius:50px;color:#d6b25e;cursor:pointer;font-weight:600;">Clear Search</button>` : ''}
            </div>
        `;
        return;
    }
    
    let html = '';
    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const rating = typeof p.rating === 'number' ? p.rating : 4;
        const fullStars = Math.floor(Math.min(Math.max(rating, 0), 5));
        const stars = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
        const priceFormatted = '₦' + (p.price || 0).toLocaleString();
        const imageUrl = p.image || p.image_url || '/assets/placeholder.webp';
        
        html += `
            <div class="product-card" data-product-id="${p.id}" style="position:relative;">
                ${p.badge ? `<div style="position:absolute;top:12px;left:12px;z-index:2;background:${p.badgeColor || '#d6b25e'};color:#000;padding:4px 12px;border-radius:50px;font-size:0.65rem;font-weight:700;">${p.badge}</div>` : ''}
                <a href="/product-detail?id=${p.id}" style="text-decoration:none;color:inherit;">
                    <img src="${imageUrl}" alt="${p.name}" class="product-image" onerror="this.src='/company_logo.png'" loading="lazy">
                    <div class="product-title">${p.name}</div>
                </a>
                <div class="product-price">${priceFormatted}</div>
                <div class="product-rating">${stars} (${rating.toFixed(1)})</div>
                <div style="display:flex;gap:8px;">
                    <button class="product-btn" onclick="event.stopPropagation();window.PrimeShieldHub?.addToCart?.('${p.id}')" style="flex:1;">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                    <a href="/product-detail?id=${p.id}" class="product-btn" style="flex:0;padding:8px 12px;background:rgba(214,178,94,0.1);color:#d6b25e;text-decoration:none;border-radius:8px;border:1px solid rgba(214,178,94,0.2);">
                        <i class="fas fa-eye"></i>
                    </a>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ===== UPDATE PAGINATION CONTROLS =====
function updatePaginationControls(total) {
    const totalPages = Math.max(1, Math.ceil(total / currentPerPage));
    const paginationEl = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (!paginationEl) return;
    
    // Update prev/next buttons
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.opacity = currentPage <= 1 ? '0.4' : '1';
        prevBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.4' : '1';
        nextBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
    
    // Generate page numbers
    let pagHtml = '';
    const maxVisible = 7;
    let startPage = Math.max(1, currentPage - 3);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    // First page
    if (startPage > 1) {
        pagHtml += `<button class="page-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            pagHtml += `<span class="page-dots" style="color:#7a7870;padding:0 4px;">…</span>`;
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const active = i === currentPage ? 'active' : '';
        pagHtml += `<button class="page-btn ${active}" data-page="${i}">${i}</button>`;
    }
    
    // Last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pagHtml += `<span class="page-dots" style="color:#7a7870;padding:0 4px;">…</span>`;
        }
        pagHtml += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    paginationEl.innerHTML = pagHtml;
    
    // Add click handlers to page buttons
    paginationEl.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = parseInt(this.dataset.page);
            if (page !== currentPage) {
                currentPage = page;
                loadAndRenderProducts();
                // Scroll to products
                document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// ===== UPDATE RESULTS INFO =====
function updateResultsInfo(shown, total) {
    const start = (currentPage - 1) * currentPerPage + 1;
    const end = Math.min(start + shown - 1, total);
    
    const showingStart = document.getElementById('showingStart');
    const showingEnd = document.getElementById('showingEnd');
    const totalResults = document.getElementById('totalResults');
    const totalProductCount = document.getElementById('totalProductCount');
    
    if (showingStart) showingStart.textContent = total > 0 ? start : 0;
    if (showingEnd) showingEnd.textContent = total > 0 ? end : 0;
    if (totalResults) totalResults.textContent = total.toLocaleString();
    if (totalProductCount) totalProductCount.textContent = total.toLocaleString();
}

// ==================== SETUP EVENT LISTENERS ====================
function setupPaginationEvents() {
    // Previous button
    document.getElementById('prevPageBtn')?.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            loadAndRenderProducts();
            document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
    
    // Next button
    document.getElementById('nextPageBtn')?.addEventListener('click', function() {
        const totalPages = Math.ceil(totalProducts / currentPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            loadAndRenderProducts();
            document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
    
    // Per page selector
    document.getElementById('perPageSelect')?.addEventListener('change', function() {
        currentPerPage = parseInt(this.value);
        currentPage = 1;
        loadAndRenderProducts();
    });
    
    // Sort selector
    document.getElementById('sortSelect')?.addEventListener('change', function() {
        currentSort = this.value;
        currentPage = 1;
        loadAndRenderProducts();
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter || 'all';
            currentPage = 1;
            currentSearch = '';
            isSearching = false;
            const input = document.getElementById('searchInput');
            if (input) input.value = '';
            const clearBtn = document.getElementById('searchClear');
            if (clearBtn) clearBtn.style.display = 'none';
            loadAndRenderProducts();
        });
    });
    
    // Search input - live search with debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                performSearch();
            }, 400);
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                clearTimeout(debounceTimer);
                performSearch();
            }
        });
    }
}

// ==================== STORE DETECTION ====================
function detectStoreType() {
    const path = window.location.pathname;
    
    // Check if we're on BuildMart site
    if (path.includes('/buildmart') || path.includes('/build-mart')) {
        AppState.storeType = 'buildmart';
        document.documentElement.setAttribute('data-store', 'buildmart');
        document.body.classList.add('buildmart-site');
        document.querySelector('meta[name="store-type"]')?.setAttribute('content', 'buildmart');
        console.log('🏗️ BuildMart site detected');
    } else {
        AppState.storeType = 'gadgets';
        document.documentElement.setAttribute('data-store', 'gadgets');
        document.body.classList.add('gadgets-site');
        document.querySelector('meta[name="store-type"]')?.setAttribute('content', 'gadgets');
        console.log('📱 Gadgets site detected');
    }
}

// ==================== INITIALIZATION ====================
async function initApp() {
    if (AppState.initialized) return;
    
    console.log('⚡ PrimeShieldHub Quantum Core v11.6.0 Initializing...');
    console.log(`📍 API: ${CONFIG?.apiBase || 'https://api.primeshieldhub.com/api'}`);
    
    try {
        // 0. Detect store type
        detectStoreType();
        
        // 1. Get fingerprint
        try {
            AppState.fingerprint = await getDeviceFingerprint();
            console.log(`🔑 Fingerprint: ${AppState.fingerprint?.substring(0, 12) || 'fallback'}...`);
        } catch (e) {
            AppState.fingerprint = 'fallback-' + Date.now();
            console.warn('Fingerprint fallback:', e.message);
        }
        
        // 2. Initialize features (non-blocking) - FIXED
        const featurePromises = [];
        
        // Safe function to init features
        const safeInit = (fn, name) => {
            if (typeof fn !== 'function') {
                console.log(`📦 ${name} not available, skipping`);
                return null;
            }
            try {
                const result = fn();
                if (result && typeof result.catch === 'function') {
                    return result.catch(e => {
                        console.warn(`⚠️ ${name} init failed:`, e);
                        return null;
                    });
                }
                console.log(`✅ ${name} initialized`);
                return null;
            } catch (e) {
                console.warn(`⚠️ ${name} init error:`, e);
                return null;
            }
        };
        
        // AI - only if available globally
        if (typeof getAI !== 'undefined' && typeof getAI === 'function') {
            const p = safeInit(getAI, 'AI');
            if (p) featurePromises.push(p);
        }
        
        // Other features
        const features = [
            { fn: initPredictivePrefetch, name: 'Prefetch' },
            { fn: initAnalytics, name: 'Analytics' },
            { fn: initWebVitals, name: 'WebVitals' },
            { fn: initBehaviorTracking, name: 'Behavior' },
            { fn: initConversionEngine, name: 'Conversion' },
            { fn: initUpsellEngine, name: 'Upsell' }
        ];
        
        for (const { fn, name } of features) {
            const p = safeInit(fn, name);
            if (p) featurePromises.push(p);
        }

        // Don't wait for features to finish
        if (featurePromises.length > 0) {
            Promise.allSettled(featurePromises).then(results => {
                const failed = results.filter(r => r.status === 'rejected');
                if (failed.length > 0) {
                    console.warn(`⚠️ ${failed.length} features failed to initialize`);
                }
            });
        }
        
        // 3. Set up UI
        updateAuthUI();
        updateCartUI();
        setupGlobalListeners();
        setupMobileEnhancements();
        
        // 4. Check authentication
        if (auth && typeof auth.getUser === 'function') {
            const user = auth.getUser();
            if (!user && typeof auth.fetchCurrentUser === 'function') {
                await auth.fetchCurrentUser().catch(() => {});
            }
            AppState.user = auth.getUser();
        }
        
        // 5. Load products (if on product page)
        const hasProductsContainer = document.getElementById('products-container');
        
        if (hasProductsContainer) {
            try {
                // Get initial filter/sort from DOM
                const activeFilterBtn = document.querySelector('.filter-btn.active');
                const filter = activeFilterBtn?.dataset?.filter || 'all';
                const sort = document.getElementById('sortSelect')?.value || 'default';
                const perPage = document.getElementById('perPageSelect')?.value || 24;
                
                // Set initial state
                currentFilter = filter;
                currentSort = sort;
                currentPerPage = parseInt(perPage);
                currentPage = 1;
                AppState.currentFilter = filter;
                AppState.currentSort = sort;
                
                // Setup pagination events
                setupPaginationEvents();
                
                // Load products
                await loadAndRenderProducts();
                
            } catch (e) {
                console.warn('Product loading failed:', e);
                // Render fallback products anyway
                renderProductsWithPagination(
                    getFallbackProducts(AppState.storeType || 'gadgets', 'all'),
                    FALLBACK_PRODUCTS.length
                );
                updateResultsInfo(FALLBACK_PRODUCTS.length, FALLBACK_PRODUCTS.length);
                updatePaginationControls(FALLBACK_PRODUCTS.length);
            }
        }
        
        // 6. Register Service Worker
        registerServiceWorker();
        
        // 7. Emit ready event
        AppState.initialized = true;
        document.dispatchEvent(new CustomEvent('app:ready'));
        if (bus?.emit) bus.emit(Events.PAGE_LOADED, {
            page: window.location.pathname,
            loadTime: performance.now() - AppState.pageLoadTime,
            store: AppState.storeType
        });
        
        console.log('✅ PrimeShieldHub Quantum Core Ready');
        console.log(`👤 User: ${AppState.user?.email || 'Guest'} | Role: ${AppState.user?.role || 'none'}`);
        console.log(`📦 Products: ${AppState.products?.length || 0} | Cart: ${cartStore?.getCount?.() || 0}`);
        console.log(`🏪 Store: ${AppState.storeType}`);
        console.log(`📄 Page: ${currentPage} | Per Page: ${currentPerPage} | Filter: ${currentFilter} | Sort: ${currentSort}`);
        
    } catch (error) {
        console.error('❌ Init failed:', error);
        showNotification('Failed to initialize. Please refresh.', 'error', 0);
    }
}

// ==================== SERVICE WORKER REGISTRATION ====================
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(registration => {
                    console.log('✅ SW registered successfully:', registration.scope);
                    
                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('🔄 New version available - reload to update');
                                showNotification('🔄 Update available! Refresh to get the latest version.', 'info', 8000);
                            }
                        });
                    });
                    
                    // Set up periodic update check
                    setInterval(() => {
                        registration.update().catch(() => {});
                    }, 3600000); // Check every hour
                    
                })
                .catch(error => {
                    console.warn('⚠️ SW registration failed:', error);
                    // Don't show error to user - PWA is progressive enhancement
                });
        });
    }
}

// ==================== GLOBAL LISTENERS ====================
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
                window.location.href = '/';
            }
        } else {
            window.location.href = '/login';
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
    
    // Hero buttons
    document.getElementById('heroShopNow')?.addEventListener('click', () => {
        const productsSection = document.getElementById('products');
        if (productsSection) {
            productsSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
    
    // Close mobile nav on outside click
    document.addEventListener('click', (e) => {
        if (mobileNav && mobileNav.style.display === 'flex') {
            if (!mobileNav.contains(e.target) && !mobileMenuBtn?.contains(e.target)) {
                mobileNav.style.display = 'none';
                if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'false');
            }
        }
    });
    
    // Handle staff portal detection for PWA install
    document.addEventListener('DOMContentLoaded', () => {
        if (checkStaffStatus()) {
            console.log('👤 Staff user detected');
            document.body.classList.add('staff-mode');
            // Show staff portal prompt if needed
            const staffPrompt = document.getElementById('staffPwaInstallPrompt');
            if (staffPrompt) {
                staffPrompt.style.display = 'block';
            }
        }
    });
}

// ==================== MOBILE ENHANCEMENTS ====================
function setupMobileEnhancements() {
    const isMobile = window.innerWidth <= 768;
    const isSmall = window.innerWidth <= 480;
    
    document.querySelectorAll('.filter-btn, .sort-select, .page-btn, .product-btn, .nav-link').forEach(el => {
        el.style.minHeight = isMobile ? '44px' : '';
        el.style.fontSize = isMobile ? '0.9rem' : '';
    });
    
    const splashBtns = document.querySelector('.splash-buttons');
    if (splashBtns && isSmall) {
        splashBtns.style.flexDirection = 'column';
        splashBtns.querySelectorAll('.splash-btn').forEach(btn => {
            btn.style.width = '100%';
            btn.style.margin = '0.3rem 0';
        });
    }
}

// ==================== ERROR HANDLING ====================
window.addEventListener('error', (e) => {
    console.error('[Global Error]', e.message);
    // Don't show error for service worker issues
    if (e.message && e.message.includes('ServiceWorker')) {
        console.warn('[SW] Service worker error handled silently');
        return;
    }
    if (bus?.emit) bus.emit(Events.ERROR_OCCURRED, { 
        message: e.message, 
        source: e.filename, 
        line: e.lineno,
        column: e.colno 
    });
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('[Promise Error]', e.reason);
    if (bus?.emit) bus.emit(Events.ERROR_OCCURRED, { 
        message: e.reason?.message || 'Unhandled rejection',
        stack: e.reason?.stack
    });
});

// ==================== ONLINE/OFFLINE ====================
window.addEventListener('online', () => {
    document.getElementById('offlineBanner')?.classList.remove('show');
    showNotification('Back online!', 'success', 3000);
    if (bus?.emit) bus.emit(Events.ONLINE);
    
    // Refresh products when back online
    if (!AppState.products || AppState.products.length === 0) {
        loadAndRenderProducts();
    }
});

window.addEventListener('offline', () => {
    document.getElementById('offlineBanner')?.classList.add('show');
    showNotification('You are offline', 'warning', 0);
    if (bus?.emit) bus.emit(Events.OFFLINE);
});

// ==================== SPLASH SCREEN ====================
function initSplashScreen() {
    const splash = document.getElementById('quantumSplashScreen');
    if (!splash) return;
    
    // Show splash
    splash.style.display = 'flex';
    splash.classList.remove('fade-out');
    
    // Hide splash after load
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
        // Fallback timeout
        setTimeout(hideSplash, 5000);
    }
}

// ==================== PUBLIC API ====================
window.PrimeShieldHub = {
    getState: () => AppState,
    getConfig: () => CONFIG,
    getAuth: () => auth,
    getAPI: () => api,
    getCart: () => cartStore,
    getProducts: () => productStore,
    loadProducts: loadAndRenderProducts,
    renderProducts: renderProductsWithPagination,
    addToCart: addToCart,
    showNotification: showNotification,
    formatCurrency: formatCurrency,
    getStoreType: () => AppState.storeType,
    checkStaffStatus: checkStaffStatus,
    performSearch: performSearch,
    clearSearch: clearSearch,
    version: '11.6.0'
};

// ==================== ADD TO CART ====================
function addToCart(productId) {
    const products = AppState.products && AppState.products.length > 0 
        ? AppState.products 
        : FALLBACK_PRODUCTS;
    const product = products.find(p => p.id === productId);
    if (!product) {
        showNotification('Product not found', 'error', 3000);
        return;
    }

    let cart = JSON.parse(localStorage.getItem('psh_cart') || '[]');
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 });
    }
    localStorage.setItem('psh_cart', JSON.stringify(cart));

    showNotification(`${product.name} added to cart!`, 'success', 3000);
    
    // Update cart UI via event
    if (cartStore && typeof cartStore.notifySubscribers === 'function') {
        cartStore.notifySubscribers();
    } else {
        // Manual update
        const count = cart.reduce((s, i) => s + (i.quantity || 1), 0);
        document.querySelectorAll('.cart-count, #cartCount, [data-cart-count]').forEach(el => {
            el.textContent = count;
            el.style.display = count > 0 ? 'inline-flex' : 'none';
        });
    }
}

// ==================== START ====================
initSplashScreen();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // Small delay to ensure DOM is ready
    setTimeout(initApp, 50);
}

// ==================== EXPORTS ====================
export {
    initApp,
    AppState,
    updateAuthUI,
    updateCartUI,
    setupGlobalListeners,
    setupMobileEnhancements,
    initSplashScreen,
    formatCurrency,
    renderProductsWithPagination,
    loadAndRenderProducts,
    addToCart,
    showNotification,
    detectStoreType,
    checkStaffStatus,
    performSearch,
    clearSearch,
    currentPage,
    currentPerPage,
    currentFilter,
    currentSort,
    currentSearch,
    allProducts,
    totalProducts,
    isSearching
};

