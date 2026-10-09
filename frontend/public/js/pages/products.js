// ============================================================================
// public../js/pages/products.js - Products Page Module v2.0
// ============================================================================
// Displays product catalog with filtering, sorting, and pagination.
// ============================================================================

import { CONFIG } from './config.js';
import { auth } from './auth.js';
import { productStore } from './product-store.js';
import { cartStore } from './cart-store.js';
import { bus, Events } from './events.js';
import { getDeviceFingerprint } from './sophisticated/fraud-engine/fingerprint.js';

// ===== STATE =====
let productsInitialized = false;
let currentFilter = 'all';
let currentSort = 'default';
let currentPage = 1;
let searchQuery = '';

// ===== HELPERS =====
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m] || m));
}

function showNotification(message, type = 'info') {
    if (window.PrimeShieldHub?.showNotification) {
        window.PrimeShieldHub.showNotification(message, type);
        return;
    }
    console.log(`[${type}] ${message}`);
}

// ===== RENDER =====
export function renderProducts() {
    return `
        <section class="quantum-products-section" id="products" style="padding:4rem 2rem;min-height:80vh;">
            <div class="quantum-container" style="max-width:1400px;margin:0 auto;">
                <div class="section-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:2rem;">
                    <div>
                        <h2 class="section-title" style="font-size:2rem;font-weight:700;background:linear-gradient(135deg,#ffd966,#00f7ff);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:0.5rem;">
                            <i class="fas fa-boxes"></i> Premium Gadgets Collection
                        </h2>
                        <p class="section-subtitle" style="color:#9ca3cf;font-size:1rem;">Curated high‑quality smartphones, audio, and accessories.</p>
                    </div>
                    <div class="section-controls" style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center;">
                        <div style="position:relative;">
                            <i class="fas fa-search" style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#6b7a9f;"></i>
                            <input type="text" id="searchInput" placeholder="Search products..." 
                                   style="background:rgba(8,12,25,0.75);border:1px solid rgba(0,247,255,0.2);border-radius:2rem;padding:0.6rem 1rem 0.6rem 2.8rem;color:#f0f3ff;font-family:'Inter',sans-serif;font-size:0.9rem;width:200px;transition:all 0.3s;"
                                   onfocus="this.style.borderColor='#00f7ff';this.style.width='280px';" 
                                   onblur="this.style.borderColor='rgba(0,247,255,0.2)';this.style.width='200px';">
                        </div>
                        <select id="sortSelect" class="sort-select" style="background:rgba(8,12,25,0.75);border:1px solid rgba(0,247,255,0.2);border-radius:2rem;padding:0.6rem 1.2rem;color:#f0f3ff;font-family:'Inter',sans-serif;font-size:0.9rem;cursor:pointer;transition:all 0.3s;">
                            <option value="default">Default</option>
                            <option value="price-asc">Price: Low to High</option>
                            <option value="price-desc">Price: High to Low</option>
                            <option value="rating">Rating</option>
                            <option value="newest">Newest</option>
                            <option value="name">Name A–Z</option>
                            <option value="popularity">Popularity</option>
                        </select>
                    </div>
                </div>

                <div class="products-filter" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:2rem;padding:0.5rem;background:rgba(8,12,25,0.5);border-radius:1rem;border:1px solid rgba(0,247,255,0.05);">
                    <button class="filter-btn active" data-filter="all" style="padding:0.5rem 1.2rem;border-radius:2rem;border:none;background:linear-gradient(135deg,#00f7ff,#b200ff);color:#000;font-weight:600;font-size:0.85rem;cursor:pointer;transition:all 0.3s;">All</button>
                    <button class="filter-btn" data-filter="smartphones" style="padding:0.5rem 1.2rem;border-radius:2rem;border:1px solid rgba(255,255,255,0.05);background:transparent;color:#9ca3cf;font-weight:500;font-size:0.85rem;cursor:pointer;transition:all 0.3s;">📱 Smartphones</button>
                    <button class="filter-btn" data-filter="audio" style="padding:0.5rem 1.2rem;border-radius:2rem;border:1px solid rgba(255,255,255,0.05);background:transparent;color:#9ca3cf;font-weight:500;font-size:0.85rem;cursor:pointer;transition:all 0.3s;">🎧 Audio</button>
                    <button class="filter-btn" data-filter="laptops" style="padding:0.5rem 1.2rem;border-radius:2rem;border:1px solid rgba(255,255,255,0.05);background:transparent;color:#9ca3cf;font-weight:500;font-size:0.85rem;cursor:pointer;transition:all 0.3s;">💻 Laptops</button>
                    <button class="filter-btn" data-filter="tablets" style="padding:0.5rem 1.2rem;border-radius:2rem;border:1px solid rgba(255,255,255,0.05);background:transparent;color:#9ca3cf;font-weight:500;font-size:0.85rem;cursor:pointer;transition:all 0.3s;">📋 Tablets</button>
                    <button class="filter-btn" data-filter="wearables" style="padding:0.5rem 1.2rem;border-radius:2rem;border:1px solid rgba(255,255,255,0.05);background:transparent;color:#9ca3cf;font-weight:500;font-size:0.85rem;cursor:pointer;transition:all 0.3s;">⌚ Wearables</button>
                    <button class="filter-btn" data-filter="power" style="padding:0.5rem 1.2rem;border-radius:2rem;border:1px solid rgba(255,255,255,0.05);background:transparent;color:#9ca3cf;font-weight:500;font-size:0.85rem;cursor:pointer;transition:all 0.3s;">🔋 Power Banks</button>
                    <button class="filter-btn" data-filter="accessories" style="padding:0.5rem 1.2rem;border-radius:2rem;border:1px solid rgba(255,255,255,0.05);background:transparent;color:#9ca3cf;font-weight:500;font-size:0.85rem;cursor:pointer;transition:all 0.3s;">🔌 Accessories</button>
                    <button class="filter-btn" data-filter="new" style="padding:0.5rem 1.2rem;border-radius:2rem;border:1px solid rgba(255,255,255,0.05);background:transparent;color:#9ca3cf;font-weight:500;font-size:0.85rem;cursor:pointer;transition:all 0.3s;">✨ New</button>
                    <button class="filter-btn" data-filter="bestsellers" style="padding:0.5rem 1.2rem;border-radius:2rem;border:1px solid rgba(255,255,255,0.05);background:transparent;color:#9ca3cf;font-weight:500;font-size:0.85rem;cursor:pointer;transition:all 0.3s;">⭐ Bestsellers</button>
                </div>

                <div id="products-container" class="products-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1.5rem;min-height:400px;">
                    <div style="text-align:center;padding:3rem;color:#6b7a9f;grid-column:1/-1;">
                        <span style="display:inline-block;width:30px;height:30px;border:3px solid rgba(0,247,255,0.2);border-top-color:#00f7ff;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:0.75rem;"></span>
                        Loading products...
                    </div>
                </div>

                <div id="pagination" class="pagination" style="display:flex;justify-content:center;gap:0.5rem;margin-top:2rem;flex-wrap:wrap;"></div>
                
                <div id="products-stats" style="text-align:center;color:#6b7a9f;font-size:0.85rem;margin-top:1rem;"></div>
            </div>
        </section>
    `;
}

// ===== MOUNT =====
export async function mountProducts() {
    if (productsInitialized) {
        console.log('[Products] Already initialized');
        return;
    }
    
    const container = document.getElementById('app');
    if (!container) {
        console.error('[Products] #app container not found');
        return;
    }
    
    // Render
    container.innerHTML = renderProducts();
    
    try {
        // Load products if not loaded
        if (!productStore.loaded) {
            await productStore.loadProducts();
        }
        
        // Set up event listeners
        setupEventListeners();
        
        // Render products
        renderProductGrid();
        
        productsInitialized = true;
        
        // Emit event
        if (bus?.emit) {
            bus.emit(Events.PAGE_LOADED, { 
                page: 'products', 
                timestamp: Date.now(),
                productCount: productStore.products?.length || 0
            });
        }
        
        console.log('[Products] Initialized with', productStore.products?.length || 0, 'products');
        
    } catch (error) {
        console.error('[Products] Mount error:', error);
        showNotification('Failed to load products. Please refresh.', 'error');
        const containerEl = document.getElementById('products-container');
        if (containerEl) {
            containerEl.innerHTML = `
                <div style="text-align:center;padding:3rem;color:#ff3366;grid-column:1/-1;">
                    <i class="fas fa-exclamation-circle" style="font-size:3rem;display:block;margin-bottom:1rem;"></i>
                    <p>Failed to load products</p>
                    <button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1.5rem;background:linear-gradient(135deg,#00f7ff,#b200ff);border:none;border-radius:2rem;color:#000;font-weight:600;cursor:pointer;">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = '#9ca3cf';
                b.style.border = '1px solid rgba(255,255,255,0.05)';
            });
            btn.classList.add('active');
            btn.style.background = 'linear-gradient(135deg,#00f7ff,#b200ff)';
            btn.style.color = '#000';
            btn.style.border = 'none';
            
            currentFilter = btn.dataset.filter;
            currentPage = 1;
            renderProductGrid();
        });
    });
    
    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            currentSort = sortSelect.value;
            currentPage = 1;
            renderProductGrid();
        });
    }
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchQuery = searchInput.value.trim();
                currentPage = 1;
                renderProductGrid();
            }, 300);
        });
    }
}

// ===== RENDER PRODUCT GRID =====
function renderProductGrid() {
    const container = document.getElementById('products-container');
    if (!container) return;
    
    // Get filtered products
    let products = productStore.products || [];
    
    // Apply filter
    if (currentFilter !== 'all') {
        products = products.filter(p => {
            const category = (p.category || '').toLowerCase();
            const categoryName = (p.categoryName || '').toLowerCase();
            const name = (p.name || '').toLowerCase();
            const filter = currentFilter.toLowerCase();
            
            if (filter === 'smartphones') return category.includes('phone') || name.includes('iphone') || name.includes('samsung') || name.includes('pixel') || name.includes('xiaomi');
            if (filter === 'audio') return category.includes('audio') || category.includes('headphone') || name.includes('airpod') || name.includes('sony') || name.includes('jbl');
            if (filter === 'laptops') return category.includes('laptop') || category.includes('macbook') || category.includes('dell') || category.includes('hp');
            if (filter === 'tablets') return category.includes('tablet') || category.includes('ipad') || category.includes('tab');
            if (filter === 'wearables') return category.includes('watch') || category.includes('wearable') || name.includes('apple watch') || name.includes('galaxy watch');
            if (filter === 'power') return category.includes('power') || category.includes('battery') || name.includes('power bank') || name.includes('anker');
            if (filter === 'accessories') return category.includes('accessory') || category.includes('case') || category.includes('charger') || category.includes('cable') || category.includes('adapter');
            if (filter === 'new') return p.isNew === true;
            if (filter === 'bestsellers') return p.isBestseller === true;
            return true;
        });
    }
    
    // Apply search
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        products = products.filter(p => 
            p.name.toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q) ||
            (p.tags || []).some(t => t.toLowerCase().includes(q))
        );
    }
    
    // Apply sort
    switch (currentSort) {
        case 'price-asc':
            products.sort((a, b) => (a.price || 0) - (b.price || 0));
            break;
        case 'price-desc':
            products.sort((a, b) => (b.price || 0) - (a.price || 0));
            break;
        case 'rating':
            products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            break;
        case 'newest':
            products.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            break;
        case 'name':
            products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            break;
        case 'popularity':
            products.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
            break;
        default:
            // Default: bestsellers first, then rating
            products.sort((a, b) => {
                if (a.isBestseller && !b.isBestseller) return -1;
                if (!a.isBestseller && b.isBestseller) return 1;
                return (b.rating || 0) - (a.rating || 0);
            });
            break;
    }
    
    // Pagination
    const pageSize = 12;
    const totalPages = Math.ceil(products.length / pageSize);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageItems = products.slice(start, start + pageSize);
    
    // Render products
    if (pageItems.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:3rem;color:#6b7a9f;grid-column:1/-1;">
                <i class="fas fa-search" style="font-size:3rem;display:block;margin-bottom:1rem;color:#ffd966;"></i>
                <p style="font-size:1.1rem;">No products found</p>
                <p style="font-size:0.9rem;">Try adjusting your filters or search terms</p>
                <button onclick="window.PrimeShieldHub?.getProducts()?.setFilter('all');window.PrimeShieldHub?.getProducts()?.setSearch('');" 
                        style="margin-top:1rem;padding:0.5rem 1.5rem;background:linear-gradient(135deg,#00f7ff,#b200ff);border:none;border-radius:2rem;color:#000;font-weight:600;cursor:pointer;">
                    Reset Filters
                </button>
            </div>
        `;
        renderPagination(totalPages);
        updateStats(products.length);
        return;
    }
    
    const html = pageItems.map(product => `
        <div class="product-card" style="background:rgba(8,12,25,0.75);border:1px solid rgba(0,247,255,0.15);border-radius:1.5rem;padding:1.5rem;transition:all 0.3s ease;cursor:pointer;display:flex;flex-direction:column;"
             onclick="window.location.href='/product-detail.html?id=${product.id}'"
             onmouseenter="this.style.transform='translateY(-4px)';this.style.borderColor='#00f7ff';this.style.boxShadow='0 8px 30px rgba(0,247,255,0.15)';"
             onmouseleave="this.style.transform='translateY(0)';this.style.borderColor='rgba(0,247,255,0.15)';this.style.boxShadow='none';">
            <div style="position:relative;overflow:hidden;border-radius:1rem;margin-bottom:1rem;background:rgba(0,0,0,0.3);aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;">
                <img src="${product.image || '/company_logo.png'}" alt="${escapeHtml(product.name)}" 
                     style="width:100%;height:100%;object-fit:contain;padding:1rem;transition:transform 0.3s;"
                     loading="lazy"
                     onerror="this.src='/company_logo.png'"
                     onmouseenter="this.style.transform='scale(1.05)'"
                     onmouseleave="this.style.transform='scale(1)'">
                ${product.discount > 0 ? `<span style="position:absolute;top:0.5rem;right:0.5rem;background:#ff3366;color:white;padding:0.2rem 0.6rem;border-radius:1rem;font-size:0.7rem;font-weight:600;">-${product.discount}%</span>` : ''}
                ${product.isNew ? `<span style="position:absolute;top:0.5rem;left:0.5rem;background:#00f7ff;color:#000;padding:0.2rem 0.6rem;border-radius:1rem;font-size:0.7rem;font-weight:600;">NEW</span>` : ''}
                ${product.isBestseller ? `<span style="position:absolute;bottom:0.5rem;left:0.5rem;background:#ffd966;color:#000;padding:0.2rem 0.6rem;border-radius:1rem;font-size:0.7rem;font-weight:600;">⭐ BESTSELLER</span>` : ''}
                ${product.stock < 5 && product.stock > 0 ? `<span style="position:absolute;bottom:0.5rem;right:0.5rem;background:#ffaa33;color:#000;padding:0.2rem 0.6rem;border-radius:1rem;font-size:0.6rem;font-weight:600;">LOW STOCK</span>` : ''}
                ${product.stock === 0 ? `<span style="position:absolute;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:#ff3366;">OUT OF STOCK</span>` : ''}
            </div>
            <h3 style="font-size:1rem;font-weight:600;color:#f0f3ff;margin-bottom:0.5rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.8rem;">${escapeHtml(product.name)}</h3>
            <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;flex-wrap:wrap;">
                ${product.rating > 0 ? `<span style="color:#ffd966;font-size:0.85rem;">★ ${product.rating.toFixed(1)}</span>` : ''}
                ${product.reviewCount > 0 ? `<span style="color:#6b7a9f;font-size:0.8rem;">(${product.reviewCount})</span>` : ''}
                <span style="color:#6b7a9f;font-size:0.8rem;margin-left:auto;">${product.category || 'General'}</span>
            </div>
            <p style="color:#6b7a9f;font-size:0.85rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:0.75rem;flex:1;min-height:2.6rem;">${escapeHtml(product.shortDescription || product.description || '')}</p>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.05);">
                <div>
                    <span style="font-size:1.2rem;font-weight:700;color:#ffd966;">${formatCurrency(product.price)}</span>
                    ${product.originalPrice ? `<span style="font-size:0.8rem;color:#6b7a9f;text-decoration:line-through;margin-left:0.5rem;">${formatCurrency(product.originalPrice)}</span>` : ''}
                </div>
                <button onclick="event.stopPropagation();window.PrimeShieldHub?.getCart()?.addItem({id:'${product.id}',name:'${escapeHtml(product.name)}',price:${product.price},image:'${product.image}',stock:${product.stock}},1)" 
                        style="background:linear-gradient(135deg,#00f7ff,#b200ff);border:none;border-radius:2rem;padding:0.4rem 1rem;color:#000;font-weight:600;font-size:0.8rem;cursor:pointer;transition:all 0.3s;display:flex;align-items:center;gap:0.4rem;"
                        onmouseenter="this.style.transform='scale(1.05)';this.style.boxShadow='0 0 20px rgba(0,247,255,0.3)';"
                        onmouseleave="this.style.transform='scale(1)';this.style.boxShadow='none';">
                    <i class="fas fa-cart-plus"></i> Add
                </button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
    
    // Render pagination
    renderPagination(totalPages);
    updateStats(products.length);
}

// ===== PAGINATION =====
function renderPagination(totalPages) {
    const container = document.getElementById('pagination');
    if (!container) return;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
    }
    
    // Previous
    if (currentPage > 1) {
        html += `<button onclick="window.PrimeShieldHub?.getProducts()?.goToPage(${currentPage - 1})" 
                        style="padding:0.5rem 0.8rem;border-radius:0.5rem;border:1px solid rgba(0,247,255,0.2);background:transparent;color:#9ca3cf;cursor:pointer;transition:all 0.3s;">
                    <i class="fas fa-chevron-left"></i>
                </button>`;
    }
    
    // Pages
    for (let i = start; i <= end; i++) {
        const isActive = i === currentPage;
        html += `<button onclick="window.PrimeShieldHub?.getProducts()?.goToPage(${i})" 
                        style="padding:0.5rem 0.9rem;border-radius:0.5rem;border:${isActive ? 'none' : '1px solid rgba(0,247,255,0.2)'};background:${isActive ? 'linear-gradient(135deg,#00f7ff,#b200ff)' : 'transparent'};color:${isActive ? '#000' : '#9ca3cf'};font-weight:${isActive ? '600' : '400'};cursor:pointer;transition:all 0.3s;">
                    ${i}
                </button>`;
    }
    
    // Next
    if (currentPage < totalPages) {
        html += `<button onclick="window.PrimeShieldHub?.getProducts()?.goToPage(${currentPage + 1})" 
                        style="padding:0.5rem 0.8rem;border-radius:0.5rem;border:1px solid rgba(0,247,255,0.2);background:transparent;color:#9ca3cf;cursor:pointer;transition:all 0.3s;">
                    <i class="fas fa-chevron-right"></i>
                </button>`;
    }
    
    container.innerHTML = html;
}

// ===== STATS =====
function updateStats(total) {
    const container = document.getElementById('products-stats');
    if (!container) return;
    
    const start = (currentPage - 1) * 12 + 1;
    const end = Math.min(start + 11, total);
    
    if (total === 0) {
        container.textContent = 'No products found';
    } else {
        container.textContent = `Showing ${start}–${end} of ${total} products`;
    }
}

// ===== PUBLIC API =====
export function goToPage(page) {
    currentPage = Math.max(1, page);
    renderProductGrid();
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function setFilter(filter) {
    currentFilter = filter;
    currentPage = 1;
    // Update UI
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = '#9ca3cf';
        b.style.border = '1px solid rgba(255,255,255,0.05)';
        if (b.dataset.filter === filter) {
            b.classList.add('active');
            b.style.background = 'linear-gradient(135deg,#00f7ff,#b200ff)';
            b.style.color = '#000';
            b.style.border = 'none';
        }
    });
    renderProductGrid();
}

export function setSearch(query) {
    searchQuery = query;
    currentPage = 1;
    const input = document.getElementById('searchInput');
    if (input) input.value = query;
    renderProductGrid();
}

// ===== CLEANUP =====
export function cleanupProducts() {
    productsInitialized = false;
    console.log('[Products] Cleaned up');
}

// ===== EXPORT =====
export default {
    render: renderProducts,
    mounted: mountProducts,
    cleanup: cleanupProducts,
    goToPage,
    setFilter,
    setSearch
};

// ===== AUTO-INIT =====
if (typeof document !== 'undefined' && document.readyState === 'complete') {
    mountProducts();
}
