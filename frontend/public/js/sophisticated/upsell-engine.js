// ============================================================================
// public../js/sophisticated/upsell-engine.js - AI Upsell Engine v2.0
// ============================================================================
// Automatically recommends complementary products based on current product view.
// ============================================================================

import { CONFIG } from '../config.js';
import { api } from '../api-client.js';
import { auth } from '../auth.js';
import { bus, Events } from '../events.js';
import { getDeviceFingerprint } from '../sophisticated/fraud-engine/fingerprint.js';
import { productStore } from '../product-store.js';
import { cartStore } from '../cart-store.js';

// ===== CONSTANTS =====
const UPSHOLDS_KEY = 'psh_upsell_shown';
const MAX_SHOWN_PER_SESSION = 3;

// ===== STATE =====
let isVisible = false;
let shownCount = 0;
let currentTimeout = null;
let eventListeners = [];

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

// ===== CHECK IF UPSHOULD SHOULD SHOW =====
function shouldShowUpsell() {
    // Check session limit
    try {
        const shown = JSON.parse(sessionStorage.getItem(UPSHOLDS_KEY) || '[]');
        if (shown.length >= MAX_SHOWN_PER_SESSION) {
            return false;
        }
        // Check if shown recently (last 5 minutes)
        const now = Date.now();
        const recent = shown.filter(time => now - time < 300000);
        if (recent.length >= MAX_SHOWN_PER_SESSION) {
            return false;
        }
        return true;
    } catch {
        return true;
    }
}

function markUpsellShown() {
    try {
        const shown = JSON.parse(sessionStorage.getItem(UPSHOLDS_KEY) || '[]');
        shown.push(Date.now());
        sessionStorage.setItem(UPSHOLDS_KEY, JSON.stringify(shown));
    } catch {
        // Ignore
    }
}

// ===== LOAD UPSELD RECOMMENDATIONS =====
export async function loadUpsell(productId, options = {}) {
    const { 
        delay = 1500,
        maxItems = 4,
        autoShow = true,
        position = 'bottom-right'
    } = options;

    // Check if should show
    if (!shouldShowUpsell()) {
        return null;
    }

    if (!productId) {
        console.warn('[Upsell] No product ID provided');
        return null;
    }

    try {
        // Get product details
        const product = productStore.getById(productId);
        if (!product) {
            console.warn('[Upsell] Product not found:', productId);
            return null;
        }

        // Get recommendations
        let recommendations = [];

        // Try API first
        try {
            const data = await api.post('/recommend', {
                productId,
                limit: maxItems,
                excludeIds: [productId]
            }, { requireAuth: false });

            if (data.recommendations && data.recommendations.length > 0) {
                recommendations = data.recommendations;
            }
        } catch (e) {
            console.warn('[Upsell] API failed, using fallback:', e.message);
        }

        // Fallback: get related from product store
        if (recommendations.length === 0) {
            const related = productStore.getRelated(productId, maxItems);
            recommendations = related.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                image: p.image,
                description: p.shortDescription || p.description
            }));
        }

        // Filter out items already in cart
        const cartItems = cartStore.items || [];
        const cartIds = new Set(cartItems.map(i => i.id));
        recommendations = recommendations.filter(item => !cartIds.has(item.id));

        // Limit items
        recommendations = recommendations.slice(0, maxItems);

        if (recommendations.length === 0) {
            return null;
        }

        // Cache for later
        const data = {
            product,
            recommendations,
            timestamp: Date.now()
        };

        if (autoShow && shouldShowUpsell()) {
            // Show after delay
            if (currentTimeout) {
                clearTimeout(currentTimeout);
            }
            currentTimeout = setTimeout(() => {
                renderUpsell(data, { position });
            }, delay);
        }

        return data;

    } catch (error) {
        console.error('[Upsell] Failed to load:', error);
        return null;
    }
}

// ===== RENDER UPSELD =====
export function renderUpsell(data, options = {}) {
    const { position = 'bottom-right' } = options;

    if (isVisible) {
        return;
    }

    if (!data || !data.recommendations || data.recommendations.length === 0) {
        return;
    }

    // Mark as shown
    markUpsellShown();
    isVisible = true;

    const { product, recommendations } = data;

    // Position styles
    const positions = {
        'bottom-right': { bottom: '100px', right: '20px' },
        'bottom-left': { bottom: '100px', left: '20px' },
        'top-right': { top: '100px', right: '20px' },
        'top-left': { top: '100px', left: '20px' }
    };

    const pos = positions[position] || positions['bottom-right'];

    // Helper function to create position CSS
function getPositionCSS(position) {
    const parts = [];
    if (position.bottom) parts.push(`bottom: ${position.bottom};`);
    if (position.top) parts.push(`top: ${position.top};`);
    if (position.left) parts.push(`left: ${position.left};`);
    if (position.right) parts.push(`right: ${position.right};`);
    return parts.join(' ');
}

// Create container
const container = document.createElement('div');
container.className = 'upsell-container';
container.style.cssText = `
    position: fixed;
    ${getPositionCSS(pos)}
    background: rgba(10,10,25,0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(214,178,94,0.3);
    border-radius: 16px;
    padding: 20px;
    width: 320px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    z-index: 100000;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    font-family: 'Inter', sans-serif;
    animation: slideInUp 0.5s cubic-bezier(0.34,1.56,0.64,1);
    transition: all 0.3s ease;
`;

    // Build HTML
    let recommendationsHTML = recommendations.map(item => `
        <div class="upsell-item" style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);transition:all 0.2s;"
             onmouseenter="this.style.backgroundColor='rgba(214,178,94,0.05)';this.style.borderRadius='8px';this.style.padding='10px 12px';"
             onmouseleave="this.style.backgroundColor='transparent';this.style.borderRadius='0';this.style.padding='10px 0';">
            <img src="${item.image || '/company_logo.png'}" alt="${escapeHtml(item.name)}" 
                 style="width:50px;height:50px;object-fit:contain;border-radius:8px;background:rgba(0,0,0,0.2);flex-shrink:0;"
                 onerror="this.src='/company_logo.png'">
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.85rem;font-weight:600;color:#f0f3ff;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.name)}</div>
                <div style="font-size:0.75rem;color:#9ca3cf;margin-bottom:4px;">${escapeHtml(item.description || '').slice(0, 60)}${(item.description || '').length > 60 ? '...' : ''}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:1rem;font-weight:700;color:#ffd966;">${formatCurrency(item.price)}</span>
                    <button class="upsell-add-btn" data-id="${item.id}" 
                            style="background:linear-gradient(135deg,#00f7ff,#b200ff);border:none;border-radius:20px;padding:4px 12px;color:#000;font-weight:600;font-size:0.7rem;cursor:pointer;transition:all 0.3s;"
                            onmouseenter="this.style.transform='scale(1.05)'"
                            onmouseleave="this.style.transform='scale(1)'">
                        <i class="fas fa-cart-plus"></i> Add
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
                <h3 style="margin:0;font-size:1rem;font-weight:700;color:#ffd966;">
                    <i class="fas fa-bolt" style="color:#00f7ff;"></i> You May Also Like
                </h3>
                <p style="margin:4px 0 0;font-size:0.75rem;color:#6b7a9f;">Based on "${escapeHtml(product.name)}"</p>
            </div>
            <button class="upsell-close-btn" style="background:none;border:none;color:#6b7a9f;cursor:pointer;font-size:1.2rem;padding:0 4px;transition:all 0.2s;"
                    onmouseenter="this.style.color='#ff3366'"
                    onmouseleave="this.style.color='#6b7a9f'">
                ✕
            </button>
        </div>
        <div class="upsell-items" style="max-height:300px;overflow-y:auto;">
            ${recommendationsHTML}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05);">
            <button class="upsell-dismiss-btn" style="flex:1;padding:6px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#9ca3cf;font-size:0.75rem;cursor:pointer;transition:all 0.3s;"
                    onmouseenter="this.style.background='rgba(255,255,255,0.1)'"
                    onmouseleave="this.style.background='rgba(255,255,255,0.05)'">
                Don't show again
            </button>
            <button class="upsell-close-btn" style="flex:1;padding:6px 12px;background:linear-gradient(135deg,#00f7ff,#b200ff);border:none;border-radius:8px;color:#000;font-weight:600;font-size:0.75rem;cursor:pointer;transition:all 0.3s;"
                    onmouseenter="this.style.transform='scale(1.02)'"
                    onmouseleave="this.style.transform='scale(1)'">
                Close
            </button>
        </div>
    `;

    document.body.appendChild(container);

    // Event handlers
    const close = () => {
        container.style.opacity = '0';
        container.style.transform = 'translateY(20px) scale(0.95)';
        setTimeout(() => {
            container.remove();
            isVisible = false;
        }, 300);
    };

    // Close button
    container.querySelectorAll('.upsell-close-btn').forEach(btn => {
        btn.addEventListener('click', close);
    });

    // Dismiss (don't show again)
    container.querySelector('.upsell-dismiss-btn')?.addEventListener('click', () => {
        // Mark as shown multiple times to prevent future shows
        for (let i = 0; i < MAX_SHOWN_PER_SESSION; i++) {
            markUpsellShown();
        }
        close();
    });

    // Add to cart buttons
    container.querySelectorAll('.upsell-add-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const productId = btn.dataset.id;
            const product = productStore.getById(productId);
            
            if (product) {
                try {
                    cartStore.addItem(product, 1);
                    showToast(`${product.name} added to cart!`, 'success');
                    
                    // Update button
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i> Added';
                    btn.style.background = '#33ffaa';
                    btn.style.color = '#000';
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.background = 'linear-gradient(135deg,#00f7ff,#b200ff)';
                    }, 2000);
                } catch (error) {
                    showToast(error.message || 'Failed to add to cart', 'error');
                }
            }
        });
    });

    // Auto-dismiss after 15 seconds
    const autoDismiss = setTimeout(close, 15000);

    // Cleanup on close
    const origClose = close;
    const cleanupClose = () => {
        clearTimeout(autoDismiss);
        origClose();
    };

    // Override close with cleanup
    container.__close = cleanupClose;
    container.querySelectorAll('.upsell-close-btn').forEach(btn => {
        btn.removeEventListener('click', close);
        btn.addEventListener('click', cleanupClose);
    });
    container.querySelector('.upsell-dismiss-btn')?.removeEventListener('click', close);
    container.querySelector('.upsell-dismiss-btn')?.addEventListener('click', () => {
        for (let i = 0; i < MAX_SHOWN_PER_SESSION; i++) {
            markUpsellShown();
        }
        cleanupClose();
    });

    // Emit event
    if (bus?.emit) {
        bus.emit(Events.UPSELL_SHOWN, { productId: product.id, recommendations: recommendations.length });
    }
}

// ===== TOAST HELPER =====
function showToast(message, type = 'info') {
    if (window.PrimeShieldHub?.showNotification) {
        window.PrimeShieldHub.showNotification(message, type);
        return;
    }
    console.log(`[${type}] ${message}`);
}

// ===== TRIGGER ON PRODUCT VIEW =====
export function initUpsellEngine() {
    // Listen for product view events
    const handleProductView = (data) => {
        const productId = data?.productId || data?.id || window.currentProduct?.id;
        if (productId) {
            loadUpsell(productId);
        }
    };

    // Listen for product view from event bus
    if (bus?.on) {
        bus.on(Events.PRODUCT_VIEWED, handleProductView);
        eventListeners.push(() => bus.off(Events.PRODUCT_VIEWED, handleProductView));
    }

    // Also listen for DOM event
    document.addEventListener('product:viewed', handleProductView);
    eventListeners.push(() => document.removeEventListener('product:viewed', handleProductView));

    // Check if already on product page
    const checkProductPage = () => {
        const productId = window.currentProduct?.id;
        if (productId) {
            loadUpsell(productId);
        } else {
            // Try to get from URL
            const params = new URLSearchParams(window.location.search);
            const id = params.get('id');
            if (id) {
                loadUpsell(id);
            }
        }
    };

    // Run after page loads
    if (document.readyState === 'complete') {
        setTimeout(checkProductPage, 1500);
    } else {
        window.addEventListener('load', () => {
            setTimeout(checkProductPage, 1500);
        });
        eventListeners.push(() => window.removeEventListener('load', checkProductPage));
    }

    console.log('[Upsell] Engine initialized');
}

// ===== CLEANUP =====
export function cleanupUpsellEngine() {
    eventListeners.forEach(fn => {
        try { fn(); } catch (e) { /* ignore */ }
    });
    eventListeners = [];
    
    if (currentTimeout) {
        clearTimeout(currentTimeout);
        currentTimeout = null;
    }
    
    // Remove any visible upsell
    const containers = document.querySelectorAll('.upsell-container');
    containers.forEach(el => el.remove());
    isVisible = false;
    
    console.log('[Upsell] Engine cleaned up');
}

// ===== EXPORT =====
export default {
    loadUpsell,
    renderUpsell,
    initUpsellEngine,
    cleanupUpsellEngine,
    shouldShowUpsell,
    markUpsellShown
};

// ===== AUTO-INIT =====
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUpsellEngine);
    } else {
        setTimeout(initUpsellEngine, 500);
    }
}