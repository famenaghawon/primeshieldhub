// ============================================================================
// public../js/pages/home.js - Home Page Module v2.0
// ============================================================================
// PrimeShieldHub home page with product showcase, AI insights, and testimonials.
// ============================================================================

import { CONFIG } from './config.js';
import { auth } from './auth.js';
import { productStore } from './product-store.js';
import { cartStore } from './cart-store.js';
import { api } from './api-client.js';
import { bus, Events } from './events.js';
import { getDeviceFingerprint } from './sophisticated/fraud-engine/fingerprint.js';
import { navigate } from './router.js';

// ===== STATE =====
let homeInitialized = false;
let insightsCache = null;
let scrollHandler = null;

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

function showNotification(message, type = 'info', duration = 5000) {
    // Use main's notification system if available
    if (window.PrimeShieldHub?.showNotification) {
        window.PrimeShieldHub.showNotification(message, type, duration);
        return;
    }
    
    // Fallback notification
    const container = document.getElementById('notificationContainer') || createNotificationContainer();
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
        color: #f0f0f0;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        max-width: 400px;
    `;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    notification.innerHTML = `
        <span style="font-size:20px;">${icons[type] || icons.info}</span>
        <span style="flex:1;">${message}</span>
        <button style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#888;cursor:pointer;padding:4px 8px;font-size:12px;">✕</button>
    `;
    
    const dismiss = () => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => notification.remove(), 300);
    };
    
    notification.querySelector('button').addEventListener('click', dismiss);
    if (duration > 0) setTimeout(dismiss, duration);
    
    container.appendChild(notification);
    while (container.children.length > 5) container.firstChild.remove();
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notificationContainer';
    container.style.cssText = `
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
    document.body.appendChild(container);
    return container;
}

// ===== SEO =====
function updateSEO() {
    // Title
    document.title = 'PrimeShieldHub – Premium Gadgets & Technology Store | Nigeria';
    
    // Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
    }
    metaDesc.content = 'PrimeShieldHub is Nigeria\'s leading gadget store offering authentic smartphones, laptops, audio devices, and accessories with nationwide delivery.';
    
    // Keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
        metaKeywords = document.createElement('meta');
        metaKeywords.name = 'keywords';
        document.head.appendChild(metaKeywords);
    }
    metaKeywords.content = 'gadgets, smartphones, laptops, audio devices, Nigeria, tech, PrimeShieldHub, authentic gadgets, nationwide delivery';
    
    // Open Graph
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
    }
    ogTitle.content = 'PrimeShieldHub – Premium Gadgets & Technology Store';
    
    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
        ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        document.head.appendChild(ogDesc);
    }
    ogDesc.content = 'Shop authentic smartphones, laptops, and accessories with nationwide delivery. Best prices in Nigeria.';
    
    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
    }
    ogUrl.content = 'https://primeshieldhub.com';
    
    // Structured Data
    updateStructuredData();
}

function updateStructuredData() {
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "PrimeShieldHub",
        "url": "https://primeshieldhub.com",
        "logo": "https://primeshieldhub.com/company_logo.png",
        "description": "Nigeria's premier gadget store offering authentic smartphones, laptops, audio devices, and accessories.",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": "Lagos",
            "addressCountry": "NG"
        },
        "contactPoint": {
            "@type": "ContactPoint",
            "telephone": "+234-810-353-5978",
            "contactType": "sales",
            "availableLanguage": ["English"]
        },
        "sameAs": [
            "https://instagram.com/primeshieldhub",
            "https://twitter.com/primeshieldhub",
            "https://facebook.com/primeshieldhub"
        ]
    };
    
    let script = document.querySelector('script[type="application/ld+json"]');
    if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(structuredData);
}

// ===== DATA LOADING =====
async function loadFeaturedProducts() {
    try {
        // Load products if not loaded
        if (!productStore.loaded) {
            await productStore.loadProducts();
        }
        
        // Get featured products
        const featured = productStore.getFeatured(8);
        return featured;
    } catch (error) {
        console.error('[Home] Failed to load products:', error);
        return [];
    }
}

async function loadAIInsights() {
    // Check cache
    if (insightsCache && Date.now() - insightsCache.timestamp < 600000) {
        return insightsCache.data;
    }
    
    try {
        const response = await api.get('/brain', {
            params: { type: 'insights' },
            requireAuth: false
        });
        
        const insights = response.insights || [
            { title: '🔒 Security Tip', content: 'Enable two-factor authentication on all your accounts for maximum security.' },
            { title: '🚀 Performance Update', content: 'Our AI engine is now 40% faster, delivering real-time threat detection.' },
            { title: '📱 New Arrivals', content: 'Check out the latest iPhone 15 Pro Max and Samsung Galaxy S24 Ultra.' },
            { title: '💰 Exclusive Offer', content: 'Resellers get up to 25% off on bulk orders. Join our program today!' }
        ];
        
        insightsCache = {
            data: insights,
            timestamp: Date.now()
        };
        
        return insights;
    } catch (error) {
        console.warn('[Home] AI insights failed:', error);
        return [
            { title: '🔒 Security Tip', content: 'Enable two-factor authentication on all your accounts.' },
            { title: '🚀 Performance Update', content: 'Our AI engine is now 40% faster.' },
            { title: '📱 New Arrivals', content: 'Check out the latest iPhone 15 Pro Max.' },
            { title: '💰 Exclusive Offer', content: 'Resellers get up to 25% off on bulk orders.' }
        ];
    }
}

async function loadTestimonials() {
    try {
        const response = await api.get('/testimonials', {
            requireAuth: false
        });
        return response.testimonials || getDefaultTestimonials();
    } catch (error) {
        console.warn('[Home] Testimonials failed:', error);
        return getDefaultTestimonials();
    }
}

function getDefaultTestimonials() {
    return [
        { quote: 'PrimeShieldHub is my go-to for authentic gadgets. The delivery is fast and the products are 100% genuine.', author: 'John O., Lagos', rating: 5 },
        { quote: 'Best prices in Nigeria! I\'ve bought 3 phones from them and never had any issues.', author: 'Amara N., Abuja', rating: 5 },
        { quote: 'The customer service is amazing. They helped me choose the perfect laptop for my needs.', author: 'David U., Port Harcourt', rating: 4 },
        { quote: 'I love the warranty coverage. My phone had an issue and they replaced it within days.', author: 'Blessing A., Ibadan', rating: 5 }
    ];
}

// ===== RENDER =====
export function renderHome() {
    return `
        <div class="home-page">
            <!-- Hero Section -->
            <section class="hero" style="position:relative;min-height:80vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#010105 0%,#0a0a2e 50%,#010105 100%);overflow:hidden;padding:2rem;">
                <div class="hero-bg" style="position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(ellipse at 30% 50%,rgba(0,247,255,0.08) 0%,transparent 60%),radial-gradient(ellipse at 70% 50%,rgba(178,0,255,0.08) 0%,transparent 60%);pointer-events:none;"></div>
                <div class="hero-content" style="position:relative;z-index:2;text-align:center;max-width:800px;padding:2rem;">
                    <div style="display:inline-block;background:linear-gradient(135deg,#00f7ff,#b200ff);padding:0.3rem 1rem;border-radius:2rem;font-size:0.75rem;font-weight:600;color:#000;margin-bottom:1.5rem;text-transform:uppercase;letter-spacing:1px;">
                        <i class="fas fa-bolt"></i> Nigeria's #1 Gadget Store
                    </div>
                    <h1 class="hero-title" style="font-size:3.5rem;font-weight:900;background:linear-gradient(135deg,#ffffff 0%,#00f7ff 40%,#b200ff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:1rem;line-height:1.1;">
                        Premium Gadgets<br>for Every Need
                    </h1>
                    <p class="hero-subtitle" style="font-size:1.2rem;color:#9ca3cf;max-width:600px;margin:0 auto 2rem;line-height:1.6;">
                        Discover authentic smartphones, laptops, audio devices, and accessories with nationwide delivery and 100% authenticity guarantee.
                    </p>
                    <div class="hero-cta" style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
                        <a href="/products" class="btn btn-primary" style="padding:0.8rem 2rem;background:linear-gradient(135deg,#00f7ff,#b200ff);border:none;border-radius:2rem;color:#000;font-weight:600;text-decoration:none;transition:all 0.3s;display:inline-flex;align-items:center;gap:0.5rem;cursor:pointer;" data-router-link>
                            <i class="fas fa-shopping-bag"></i> Shop Now
                        </a>
                        <a href="#products" class="btn btn-secondary" style="padding:0.8rem 2rem;background:rgba(255,255,255,0.05);border:1px solid rgba(0,247,255,0.3);border-radius:2rem;color:#f0f3ff;font-weight:600;text-decoration:none;transition:all 0.3s;display:inline-flex;align-items:center;gap:0.5rem;cursor:pointer;">
                            <i class="fas fa-arrow-down"></i> Explore
                        </a>
                    </div>
                </div>
            </section>

            <!-- AI Insights -->
            <section class="ai-insights" style="padding:4rem 2rem;background:rgba(0,0,0,0.3);">
                <div class="container" style="max-width:1200px;margin:0 auto;">
                    <h2 class="section-title" style="font-size:2rem;font-weight:700;background:linear-gradient(135deg,#00f7ff,#ffd966);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:2rem;text-align:center;">
                        <i class="fas fa-brain"></i> AI-Powered Insights
                    </h2>
                    <div id="ai-insights-container" class="insights-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.5rem;">
                        <div style="text-align:center;padding:2rem;color:#6b7a9f;">
                            <span style="display:inline-block;width:24px;height:24px;border:2px solid rgba(0,247,255,0.2);border-top-color:#00f7ff;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:0.5rem;"></span>
                            Loading insights...
                        </div>
                    </div>
                </div>
            </section>

            <!-- Featured Products -->
            <section class="featured-products" id="products" style="padding:4rem 2rem;">
                <div class="container" style="max-width:1200px;margin:0 auto;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin-bottom:2rem;">
                        <h2 class="section-title" style="font-size:2rem;font-weight:700;background:linear-gradient(135deg,#ffd966,#00f7ff);-webkit-background-clip:text;background-clip:text;color:transparent;">
                            <i class="fas fa-star"></i> Featured Products
                        </h2>
                        <a href="/products" class="view-all" style="color:#00f7ff;text-decoration:none;font-weight:500;display:flex;align-items:center;gap:0.5rem;transition:all 0.3s;">
                            View All <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                    <div id="products-container" class="products-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.5rem;">
                        <div style="text-align:center;padding:2rem;color:#6b7a9f;grid-column:1/-1;">
                            <span style="display:inline-block;width:24px;height:24px;border:2px solid rgba(0,247,255,0.2);border-top-color:#00f7ff;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:0.5rem;"></span>
                            Loading products...
                        </div>
                    </div>
                </div>
            </section>

            <!-- Testimonials -->
            <section class="testimonials" style="padding:4rem 2rem;background:rgba(0,0,0,0.2);">
                <div class="container" style="max-width:1200px;margin:0 auto;">
                    <h2 class="section-title" style="font-size:2rem;font-weight:700;color:#f0f3ff;margin-bottom:2rem;text-align:center;">
                        <i class="fas fa-quote-left" style="color:#ffd966;"></i> What Our Customers Say
                    </h2>
                    <div id="testimonials-container" class="testimonials-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;">
                        <div style="text-align:center;padding:2rem;color:#6b7a9f;grid-column:1/-1;">
                            Loading testimonials...
                        </div>
                    </div>
                </div>
            </section>

            <!-- Trust Badges -->
            <section class="trust-badges" style="padding:2rem;background:linear-gradient(135deg,#010105,#0a0a1a);border-top:1px solid rgba(0,247,255,0.1);border-bottom:1px solid rgba(0,247,255,0.1);">
                <div class="container" style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-around;flex-wrap:wrap;gap:1.5rem;padding:1rem 0;">
                    <div style="display:flex;align-items:center;gap:0.75rem;color:#9ca3cf;">
                        <i class="fas fa-shield-alt" style="color:#00f7ff;font-size:1.5rem;"></i>
                        <span>100% Authentic</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.75rem;color:#9ca3cf;">
                        <i class="fas fa-truck" style="color:#00f7ff;font-size:1.5rem;"></i>
                        <span>Nationwide Delivery</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.75rem;color:#9ca3cf;">
                        <i class="fas fa-credit-card" style="color:#00f7ff;font-size:1.5rem;"></i>
                        <span>Secure Payments</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.75rem;color:#9ca3cf;">
                        <i class="fas fa-headset" style="color:#00f7ff;font-size:1.5rem;"></i>
                        <span>24/7 Support</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.75rem;color:#9ca3cf;">
                        <i class="fas fa-star" style="color:#ffd966;font-size:1.5rem;"></i>
                        <span>4.9/5 Rating</span>
                    </div>
                </div>
            </section>
        </div>
    `;
}

// ===== MOUNT =====
export async function mountHome() {
    if (homeInitialized) {
        console.log('[Home] Already initialized');
        return;
    }
    
    const container = document.getElementById('app');
    if (!container) {
        console.error('[Home] #app container not found');
        return;
    }
    
    // Render
    container.innerHTML = renderHome();
    
    // Update SEO
    updateSEO();
    
    try {
        // Load products
        const products = await loadFeaturedProducts();
        renderProducts(products);
        
        // Load AI insights
        const insights = await loadAIInsights();
        renderAIInsights(insights);
        
        // Load testimonials
        const testimonials = await loadTestimonials();
        renderTestimonials(testimonials);
        
        // Initialize hero animation
        initHeroAnimation();
        
        // Emit event
        homeInitialized = true;
        if (bus?.emit) {
            bus.emit(Events.PAGE_LOADED, { 
                page: 'home', 
                timestamp: Date.now(),
                productsCount: products.length
            });
        }
        
        console.log('[Home] Initialized with', products.length, 'products');
        
    } catch (error) {
        console.error('[Home] Mount error:', error);
        showNotification('Failed to load some content. Please refresh.', 'error');
    }
}

// ===== RENDER HELPERS =====
function renderProducts(products) {
    const container = document.getElementById('products-container');
    if (!container) return;
    
    if (!products || products.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:3rem;color:#6b7a9f;grid-column:1/-1;">
                <i class="fas fa-box-open" style="font-size:3rem;display:block;margin-bottom:1rem;color:#ffd966;"></i>
                <p>No products available at the moment.</p>
                <p style="font-size:0.9rem;">Check back soon for new arrivals!</p>
            </div>
        `;
        return;
    }
    
    const html = products.map(product => `
        <div class="product-card" style="background:rgba(8,12,25,0.75);border:1px solid rgba(0,247,255,0.15);border-radius:1.5rem;padding:1.5rem;transition:all 0.3s ease;cursor:pointer;display:flex;flex-direction:column;" 
             onclick="window.location.href='/product-detail.html?id=${product.id}'">
            <div style="position:relative;overflow:hidden;border-radius:1rem;margin-bottom:1rem;background:rgba(0,0,0,0.3);aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;">
                <img src="${product.image || '/company_logo.png'}" alt="${escapeHtml(product.name)}" 
                     style="width:100%;height:100%;object-fit:contain;padding:1rem;transition:transform 0.3s;"
                     loading="lazy"
                     onerror="this.src='/company_logo.png'">
                ${product.discount > 0 ? `<span style="position:absolute;top:0.5rem;right:0.5rem;background:#ff3366;color:white;padding:0.2rem 0.6rem;border-radius:1rem;font-size:0.7rem;font-weight:600;">-${product.discount}%</span>` : ''}
                ${product.isNew ? `<span style="position:absolute;top:0.5rem;left:0.5rem;background:#00f7ff;color:#000;padding:0.2rem 0.6rem;border-radius:1rem;font-size:0.7rem;font-weight:600;">NEW</span>` : ''}
            </div>
            <h3 style="font-size:1rem;font-weight:600;color:#f0f3ff;margin-bottom:0.5rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.8rem;">${escapeHtml(product.name)}</h3>
            <p style="color:#6b7a9f;font-size:0.85rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:0.75rem;flex:1;">${escapeHtml(product.shortDescription || product.description || '')}</p>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.05);">
                <span style="font-size:1.2rem;font-weight:700;color:#ffd966;">${formatCurrency(product.price)}</span>
                <button onclick="event.stopPropagation();window.PrimeShieldHub?.getCart()?.addItem({id:'${product.id}',name:'${escapeHtml(product.name)}',price:${product.price}},1)" 
                        style="background:linear-gradient(135deg,#00f7ff,#b200ff);border:none;border-radius:2rem;padding:0.4rem 1rem;color:#000;font-weight:600;font-size:0.8rem;cursor:pointer;transition:all 0.3s;">
                    <i class="fas fa-cart-plus"></i> Add
                </button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function renderAIInsights(insights) {
    const container = document.getElementById('ai-insights-container');
    if (!container) return;
    
    if (!insights || insights.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:2rem;color:#6b7a9f;grid-column:1/-1;">
                <p>No insights available.</p>
            </div>
        `;
        return;
    }
    
    const html = insights.map(insight => `
        <div class="insight-card" style="background:rgba(8,12,25,0.75);border:1px solid rgba(255,217,102,0.15);border-radius:1.5rem;padding:1.5rem;transition:all 0.3s ease;">
            <h3 style="font-size:1rem;font-weight:600;color:#ffd966;margin-bottom:0.5rem;">${insight.title}</h3>
            <p style="color:#9ca3cf;font-size:0.9rem;line-height:1.5;">${insight.content}</p>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function renderTestimonials(testimonials) {
    const container = document.getElementById('testimonials-container');
    if (!container) return;
    
    if (!testimonials || testimonials.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:2rem;color:#6b7a9f;grid-column:1/-1;">
                <p>No testimonials available.</p>
            </div>
        `;
        return;
    }
    
    const html = testimonials.map(t => {
        const stars = '★'.repeat(t.rating || 5) + '☆'.repeat(5 - (t.rating || 5));
        return `
            <div class="testimonial-card" style="background:rgba(8,12,25,0.75);border:1px solid rgba(0,247,255,0.15);border-radius:1.5rem;padding:1.5rem;transition:all 0.3s ease;">
                <div style="color:#ffd966;font-size:1rem;margin-bottom:0.5rem;">${stars}</div>
                <p class="quote" style="color:#f0f3ff;font-size:0.95rem;line-height:1.6;margin-bottom:1rem;">"${escapeHtml(t.quote)}"</p>
                <p class="author" style="color:#9ca3cf;font-size:0.85rem;">— ${escapeHtml(t.author)}</p>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// ===== HERO ANIMATION =====
function initHeroAnimation() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    
    hero.classList.add('loaded');
    
    // Remove existing listener
    if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler);
    }
    
    scrollHandler = () => {
        const scrollY = window.scrollY;
        const bg = hero.querySelector('.hero-bg');
        if (bg) {
            bg.style.transform = `translateY(${scrollY * 0.3}px)`;
            bg.style.opacity = Math.max(0, 1 - scrollY / 800);
        }
    };
    
    window.addEventListener('scroll', scrollHandler, { passive: true });
}

// ===== CLEANUP =====
export function cleanupHome() {
    if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler);
        scrollHandler = null;
    }
    homeInitialized = false;
    console.log('[Home] Cleaned up');
}

// ===== EXPORT =====
export default {
    render: renderHome,
    mounted: mountHome,
    cleanup: cleanupHome
};

// ===== AUTO-INIT =====
if (typeof document !== 'undefined' && document.readyState === 'complete') {
    mountHome();
}
