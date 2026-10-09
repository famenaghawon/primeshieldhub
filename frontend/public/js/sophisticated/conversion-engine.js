// ============================================================================
// public../js/sophisticated/conversion-engine.js - Conversion Optimization Engine v2.0
// ============================================================================
// Boosts conversions using urgency triggers, social proof, and scarcity tactics.
// ============================================================================

import { CONFIG } from '../config.js';
import { auth } from '../auth.js';
import { bus, Events } from '../events.js';
import { productStore } from '../product-store.js';
import { cartStore } from '../cart-store.js';
import { getDeviceFingerprint } from '../sophisticated/fraud-engine/fingerprint.js';

// ===== CONSTANTS =====
const URGENCY_KEY = 'psh_urgency_shown';
const MAX_URGENCY_PER_SESSION = 3;
const URGENCY_COOLDOWN = 60000; // 1 minute between urgency triggers
const BANNER_DURATION = 5000; // 5 seconds

// ===== STATE =====
let isVisible = false;
let shownCount = 0;
let lastShown = 0;
let eventListeners = [];

// ===== URGENCY STRATEGIES =====
const STRATEGIES = {
    LOW_STOCK: {
        type: 'low_stock',
        icon: '🔥',
        templates: [
            'Only {stock} left in stock – buy now!',
            'Hurry! Only {stock} remaining!',
            'Last {stock} units available!',
            '{stock} items left – don\'t miss out!'
        ],
        minStock: 1,
        maxStock: 10,
        color: '#ff3366'
    },
    HIGH_DEMAND: {
        type: 'high_demand',
        icon: '📈',
        templates: [
            '{count} people are viewing this right now',
            'Popular! {count} others are watching',
            'High demand – {count} people interested',
            'Trending! {count} viewed in the last hour'
        ],
        minViews: 10,
        maxViews: 50,
        color: '#00f7ff'
    },
    LIMITED_TIME: {
        type: 'limited_time',
        icon: '⏰',
        templates: [
            'Sale ends in {time}!',
            'Hurry! Offer expires in {time}',
            '{time} left at this price!',
            'Last chance! {time} remaining'
        ],
        duration: 3600000, // 1 hour
        color: '#ffd966'
    },
    SOCIAL_PROOF: {
        type: 'social_proof',
        icon: '⭐',
        templates: [
            '{rating}★ from {count}+ reviews',
            'Loved by {count}+ customers',
            'Top-rated! {rating}★ average',
            'Customer favorite with {rating}★'
        ],
        minRating: 4.5,
        color: '#33ffaa'
    }
};

// ===== URGENCY MANAGER =====
class ConversionEngine {
    constructor() {
        this.isActive = false;
        this._timers = [];
        this._shownThisSession = 0;
        this._lastTriggerTime = 0;
    }

    // ===== INIT =====
    init() {
        if (this.isActive) return;
        this.isActive = true;

        // Load session data
        this._loadSessionData();

        // Listen for product views
        this._setupProductListeners();

        // Listen for cart events
        this._setupCartListeners();

        // Listen for scroll events (exit intent)
        this._setupExitIntent();

        if (CONFIG.debug) {
            console.log('[ConversionEngine] Initialized');
        }

        // Emit event
        if (bus?.emit) {
            bus.emit(Events.CONVERSION_ENGINE_READY);
        }
    }

    // ===== SESSION DATA =====
    _loadSessionData() {
        try {
            const data = JSON.parse(sessionStorage.getItem(URGENCY_KEY) || '{}');
            this._shownThisSession = data.shown || 0;
            this._lastTriggerTime = data.lastTrigger || 0;
        } catch {
            this._shownThisSession = 0;
            this._lastTriggerTime = 0;
        }
    }

    _saveSessionData() {
        try {
            sessionStorage.setItem(URGENCY_KEY, JSON.stringify({
                shown: this._shownThisSession,
                lastTrigger: this._lastTriggerTime
            }));
        } catch {
            // Ignore
        }
    }

    // ===== CAN SHOW URGENCY =====
    _canShowUrgency() {
        // Check session limit
        if (this._shownThisSession >= MAX_URGENCY_PER_SESSION) {
            return false;
        }

        // Check cooldown
        if (Date.now() - this._lastTriggerTime < URGENCY_COOLDOWN) {
            return false;
        }

        // Check if any banner is visible
        if (isVisible) {
            return false;
        }

        return true;
    }

    // ===== SHOW URGENCY =====
    showUrgency(product, strategy = null) {
        if (!product) return;
        if (!this._canShowUrgency()) return;

        // Select strategy
        const selectedStrategy = strategy || this._selectStrategy(product);
        if (!selectedStrategy) return;

        // Generate message
        const message = this._generateMessage(product, selectedStrategy);

        // Show banner
        this._showBanner(message, selectedStrategy);

        // Update state
        this._shownThisSession++;
        this._lastTriggerTime = Date.now();
        this._saveSessionData();
        isVisible = true;

        // Track event
        if (bus?.emit) {
            bus.emit(Events.URGENCY_SHOWN, {
                productId: product.id,
                strategy: selectedStrategy.type,
                message
            });
        }

        // Auto-hide after duration
        const timer = setTimeout(() => {
            this._hideBanner();
            isVisible = false;
        }, BANNER_DURATION);
        
        this._timers.push(timer);
    }

    // ===== STRATEGY SELECTION =====
    _selectStrategy(product) {
        const strategies = [];

        // Low stock (if stock is low)
        if (product.stock !== undefined && product.stock <= 10 && product.stock > 0) {
            strategies.push({
                ...STRATEGIES.LOW_STOCK,
                stock: product.stock,
                priority: 100
            });
        }

        // Out of stock - show waitlist
        if (product.stock === 0) {
            strategies.push({
                type: 'waitlist',
                icon: '📝',
                templates: ['Out of stock! Join waitlist for updates'],
                priority: 80,
                color: '#ffd966'
            });
        }

        // New arrival
        if (product.isNew) {
            strategies.push({
                type: 'new_arrival',
                icon: '✨',
                templates: ['New arrival! Be the first to own this'],
                priority: 70,
                color: '#00f7ff'
            });
        }

        // Bestseller
        if (product.isBestseller) {
            strategies.push({
                type: 'bestseller',
                icon: '🏆',
                templates: ['Bestseller! Join thousands of happy customers'],
                priority: 60,
                color: '#ffd966'
            });
        }

        // Social proof (if rating is high)
        if (product.rating && product.rating >= 4.5) {
            strategies.push({
                ...STRATEGIES.SOCIAL_PROOF,
                rating: product.rating,
                count: product.reviewCount || 0,
                priority: 50
            });
        }

        // Sort by priority
        strategies.sort((a, b) => b.priority - a.priority);

        // Return best strategy or random
        return strategies.length > 0 ? strategies[0] : null;
    }

    // ===== MESSAGE GENERATION =====
    _generateMessage(product, strategy) {
        let template;

        switch (strategy.type) {
            case 'low_stock':
                const stock = strategy.stock || product.stock || Math.floor(Math.random() * 5) + 2;
                const templates = strategy.templates || STRATEGIES.LOW_STOCK.templates;
                template = templates[Math.floor(Math.random() * templates.length)];
                return template.replace('{stock}', stock);

            case 'social_proof':
                const rating = strategy.rating || product.rating || 4.5;
                const count = strategy.count || product.reviewCount || Math.floor(Math.random() * 100) + 50;
                const socialTemplates = strategy.templates || STRATEGIES.SOCIAL_PROOF.templates;
                template = socialTemplates[Math.floor(Math.random() * socialTemplates.length)];
                return template.replace('{rating}', rating.toFixed(1)).replace('{count}', count);

            case 'high_demand':
                const views = Math.floor(Math.random() * 40) + 10;
                const demandTemplates = strategy.templates || STRATEGIES.HIGH_DEMAND.templates;
                template = demandTemplates[Math.floor(Math.random() * demandTemplates.length)];
                return template.replace('{count}', views);

            case 'limited_time':
                const time = Math.floor(Math.random() * 60) + 30;
                const timeTemplates = strategy.templates || STRATEGIES.LIMITED_TIME.templates;
                template = timeTemplates[Math.floor(Math.random() * timeTemplates.length)];
                return template.replace('{time}', `${time}m`);

            case 'new_arrival':
            case 'bestseller':
                return strategy.templates[0];

            case 'waitlist':
                return '📝 Out of stock! Join waitlist for updates';

            default:
                return `🔥 Limited stock available!`;
        }
    }

    // ===== BANNER RENDER =====
    _showBanner(message, strategy) {
        // Remove existing banner
        this._hideBanner();

        const banner = document.createElement('div');
        banner.className = 'conversion-banner';
        banner.id = 'conversionBanner';
        banner.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10,10,25,0.95);
            backdrop-filter: blur(20px);
            border: 1px solid ${strategy.color || '#d6b25e'};
            color: #fff;
            padding: 12px 24px;
            border-radius: 50px;
            z-index: 100000;
            font-weight: 600;
            font-family: 'Inter', sans-serif;
            font-size: 0.95rem;
            box-shadow: 0 10px 40px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideInUp 0.5s cubic-bezier(0.34,1.56,0.64,1);
            max-width: 90%;
            pointer-events: all;
            cursor: pointer;
            transition: all 0.3s ease;
        `;

        // Add click handler (go to product)
        banner.addEventListener('click', () => {
            this._hideBanner();
            const productId = strategy.productId || window.currentProduct?.id;
            if (productId) {
                window.location.href = `/product-detail.html?id=${productId}`;
            }
        });

        // Icon
        const icon = document.createElement('span');
        icon.textContent = strategy.icon || '🔥';
        icon.style.fontSize = '1.2rem';

        // Text
        const text = document.createElement('span');
        text.textContent = message;
        text.style.flex = '1';

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: rgba(255,255,255,0.5);
            cursor: pointer;
            font-size: 1rem;
            padding: 4px;
            transition: color 0.2s;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.color = '#ff3366';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.color = 'rgba(255,255,255,0.5)';
        });
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._hideBanner();
        });

        banner.appendChild(icon);
        banner.appendChild(text);
        banner.appendChild(closeBtn);

        // Add to DOM
        document.body.appendChild(banner);
        this._currentBanner = banner;

        // Track in analytics
        if (window.gtag) {
            window.gtag('event', 'view_urgency', {
                strategy: strategy.type,
                message: message
            });
        }
    }

    _hideBanner() {
        const banner = document.getElementById('conversionBanner');
        if (banner) {
            banner.style.animation = 'slideOutDown 0.3s ease';
            setTimeout(() => {
                banner.remove();
            }, 300);
        }
        this._currentBanner = null;
        isVisible = false;
    }

    // ===== EVENT LISTENERS =====
    _setupProductListeners() {
        // Listen for product view from event bus
        if (bus?.on) {
            const handler = (data) => {
                const productId = data?.productId || data?.id || window.currentProduct?.id;
                if (productId) {
                    const product = productStore.getById(productId);
                    if (product) {
                        // Small delay to let page load
                        setTimeout(() => {
                            this.showUrgency(product);
                        }, 1000);
                    }
                }
            };
            bus.on(Events.PRODUCT_VIEWED, handler);
            eventListeners.push(() => bus.off(Events.PRODUCT_VIEWED, handler));
        }

        // Listen for DOM event
        const domHandler = (e) => {
            const productId = e.detail?.productId || window.currentProduct?.id;
            if (productId) {
                const product = productStore.getById(productId);
                if (product) {
                    setTimeout(() => {
                        this.showUrgency(product);
                    }, 1000);
                }
            }
        };
        document.addEventListener('product:viewed', domHandler);
        eventListeners.push(() => document.removeEventListener('product:viewed', domHandler));
    }

    _setupCartListeners() {
        // Show urgency when item is added to cart (upsell opportunity)
        if (bus?.on) {
            const handler = (data) => {
                // Show urgency for related products
                const productId = data?.productId || data?.id;
                if (productId) {
                    const product = productStore.getById(productId);
                    if (product) {
                        // Show for a different product (upsell)
                        const related = productStore.getRelated(productId, 3);
                        if (related.length > 0) {
                            const randomRelated = related[Math.floor(Math.random() * related.length)];
                            setTimeout(() => {
                                this.showUrgency(randomRelated, { type: 'bestseller', templates: [`Add ${randomRelated.name} for just ${this._formatCurrency(randomRelated.price)}!`] });
                            }, 2000);
                        }
                    }
                }
            };
            bus.on(Events.CART_ITEM_ADDED, handler);
            eventListeners.push(() => bus.off(Events.CART_ITEM_ADDED, handler));
        }
    }

    _setupExitIntent() {
        // Show urgency when user tries to leave
        let exitShown = false;
        const handler = (e) => {
            if (e.clientY < 10 && !exitShown && this._canShowUrgency()) {
                exitShown = true;
                const product = window.currentProduct || productStore.products?.[0];
                if (product) {
                    this.showUrgency(product, {
                        type: 'exit_intent',
                        icon: '🚀',
                        templates: ['Wait! Special offer just for you!'],
                        color: '#ffd966'
                    });
                }
                setTimeout(() => { exitShown = false; }, 60000);
            }
        };
        document.addEventListener('mouseleave', handler);
        eventListeners.push(() => document.removeEventListener('mouseleave', handler));
    }

    // ===== HELPERS =====
    _formatCurrency(amount) {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    }

    // ===== DESTROY =====
    destroy() {
        // Clear timers
        for (const timer of this._timers) {
            clearTimeout(timer);
        }
        this._timers = [];

        // Remove event listeners
        for (const removeFn of eventListeners) {
            try { removeFn(); } catch (e) { /* ignore */ }
        }
        eventListeners = [];

        // Remove banner
        this._hideBanner();

        this.isActive = false;
        console.log('[ConversionEngine] Destroyed');
    }
}

// ===== SINGLETON =====
let instance = null;

export function getConversionEngine() {
    if (!instance) {
        instance = new ConversionEngine();
    }
    return instance;
}

// ===== EXPORTS =====
export const conversionEngine = getConversionEngine();

// ===== AUTO-INIT =====
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            conversionEngine.init();
        });
    } else {
        conversionEngine.init();
    }
}

// ===== EXPORT DEFAULT =====
export default conversionEngine;

// ===== INITIALIZATION WRAPPER =====
export function initConversionEngine(options = {}) {
    const engine = getConversionEngine();
    engine.init();
    return engine;
}
