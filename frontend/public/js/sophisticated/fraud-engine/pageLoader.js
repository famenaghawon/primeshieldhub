// ============================================================================
// public../js/sophisticated/fraud-engine/pageLoader.js - SPA Page Loader v2.0
// ============================================================================
// Handles SPA navigation with cache, view transitions, and script re-execution.
// ============================================================================

import { CONFIG } from '../../config.js';
import { bus, Events } from '../../events.js';
import { auth } from '../../auth.js';

// ===== CONSTANTS =====
const MAX_CACHE = 20;
const TRANSITION_DURATION = 300;

// ===== CACHE =====
const pageCache = new Map();

function maintainCache() {
    if (pageCache.size > MAX_CACHE) {
        const firstKey = pageCache.keys().next().value;
        pageCache.delete(firstKey);
        if (CONFIG.debug) {
            console.log('[PageLoader] Cache trimmed:', pageCache.size);
        }
    }
}

// ===== SCRIPT EXECUTION =====
function executeScripts(container) {
    const scripts = container.querySelectorAll('script');

    scripts.forEach(oldScript => {
        // Skip if script has already been processed
        if (oldScript.dataset.executed === 'true') return;

        const newScript = document.createElement('script');

        // Copy attributes
        [...oldScript.attributes].forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
        });

        // Handle module scripts
        if (oldScript.type === 'module') {
            // Module scripts need special handling
            const content = oldScript.textContent;
            if (content) {
                // For module scripts, we need to create a blob URL
                try {
                    const blob = new Blob([content], { type: 'application/javascript' });
                    const blobUrl = URL.createObjectURL(blob);
                    newScript.type = 'module';
                    newScript.src = blobUrl;
                } catch (e) {
                    // Fallback: execute inline
                    newScript.textContent = content;
                }
            }
        } else {
            // Regular script
            if (oldScript.textContent) {
                newScript.textContent = oldScript.textContent;
            }
        }

        // Mark as executed
        newScript.dataset.executed = 'true';
        oldScript.replaceWith(newScript);
    });
}

// ===== LOADER UI =====
let loaderTimeout = null;

function showLoader() {
    const app = document.getElementById('app');
    if (app) {
        app.style.opacity = '0.6';
        app.style.transition = 'opacity 0.2s ease';
    }
}

function hideLoader() {
    const app = document.getElementById('app');
    if (app) {
        app.style.opacity = '1';
        setTimeout(() => {
            app.style.transition = '';
        }, 300);
    }
}

// ===== RE-INITIALIZE SYSTEMS =====
function reInitializeSystems() {
    try {
        // Re-initialize shared systems
        if (window.initShared) {
            window.initShared();
        }

        // Reset behavior metrics for new page
        if (window.resetBehaviorMetrics) {
            window.resetBehaviorMetrics();
        }

        // Re-initialize UI enhancers
        if (window.UIEnhancer) {
            const enhancer = window.UIEnhancer.getInstance?.();
            if (enhancer?.refresh) {
                enhancer.refresh();
            }
        }

        // Emit page loaded event
        if (bus?.emit) {
            bus.emit(Events.PAGE_LOADED, {
                url: window.location.href,
                timestamp: Date.now()
            });
        }

        // Dispatch DOM event for backward compatibility
        document.dispatchEvent(new CustomEvent('page:loaded', {
            detail: { url: window.location.href }
        }));

        if (CONFIG.debug) {
            console.log('[PageLoader] Systems re-initialized');
        }
    } catch (err) {
        console.warn('[PageLoader] Re-init failed:', err);
    }
}

// ===== MAIN LOAD FUNCTION =====
export async function loadPage(url, options = {}) {
    const {
        useCache = true,
        transition = true,
        preserveScroll = false,
        retryCount = 2
    } = options;

    const app = document.getElementById('app');
    if (!app) {
        console.error('[PageLoader] #app container not found');
        window.location.href = url;
        return;
    }

    // Prevent loading the same page
    if (window.location.pathname === url && !options.force) {
        if (CONFIG.debug) {
            console.log('[PageLoader] Already on page:', url);
        }
        return;
    }

    // Check auth before navigation
    const user = auth.getUser();
    const isProtected = url.includes('/admin') || url.includes('/staff') || url.includes('/account');
    if (isProtected && !user) {
        window.location.href = '/login?redirect=' + encodeURIComponent(url);
        return;
    }

    showLoader();

    let loaded = false;
    let attempts = 0;

    while (!loaded && attempts <= retryCount) {
        try {
            let html;

            // Check cache
            if (useCache && pageCache.has(url)) {
                html = pageCache.get(url);
                if (CONFIG.debug) {
                    console.log('[PageLoader] Cache hit:', url);
                }
            } else {
                const response = await fetch(url, {
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'text/html',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                html = await response.text();

                if (useCache) {
                    pageCache.set(url, html);
                    maintainCache();
                }
            }

            // Parse the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newContent = doc.getElementById('app');

            if (!newContent) {
                console.warn('[PageLoader] No #app container found in', url);
                window.location.href = url;
                return;
            }

            // Update title
            document.title = doc.title || document.title;

            // Get scroll position before transition
            const scrollY = window.scrollY;

            // Perform transition
            if (transition && document.startViewTransition) {
                await document.startViewTransition(() => {
                    app.innerHTML = newContent.innerHTML;
                }).finished;
            } else {
                // Fallback for older browsers
                app.innerHTML = newContent.innerHTML;
                // Simple fade animation
                app.style.opacity = '0';
                await new Promise(resolve => setTimeout(resolve, 50));
                app.style.opacity = '1';
            }

            // Execute scripts
            executeScripts(app);

            // Restore scroll position or scroll to top
            if (preserveScroll) {
                window.scrollTo({ top: scrollY });
            } else {
                window.scrollTo({ top: 0 });
            }

            // Re-initialize systems
            reInitializeSystems();

            // Update URL without reload
            if (window.history && window.history.pushState) {
                window.history.pushState({}, '', url);
            }

            loaded = true;

            if (CONFIG.debug) {
                console.log('[PageLoader] Loaded:', url);
            }

        } catch (error) {
            attempts++;
            console.warn(`[PageLoader] Attempt ${attempts} failed:`, error);

            if (attempts <= retryCount) {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 500 * attempts));
            } else {
                console.error('[PageLoader] All attempts failed:', error);
                window.location.href = url;
                return;
            }
        }
    }

    hideLoader();
}

// ===== PRELOAD =====
export function preloadPage(url) {
    if (pageCache.has(url)) return;

    fetch(url, {
        credentials: 'same-origin',
        headers: { 'Accept': 'text/html' }
    })
        .then(response => {
            if (response.ok) {
                return response.text();
            }
            throw new Error('Preload failed');
        })
        .then(html => {
            pageCache.set(url, html);
            maintainCache();
            if (CONFIG.debug) {
                console.log('[PageLoader] Preloaded:', url);
            }
        })
        .catch(error => {
            if (CONFIG.debug) {
                console.warn('[PageLoader] Preload failed:', url, error);
            }
        });
}

// ===== CLEAR CACHE =====
export function clearPageCache() {
    pageCache.clear();
    if (CONFIG.debug) {
        console.log('[PageLoader] Cache cleared');
    }
}

// ===== GET CACHE STATS =====
export function getPageCacheStats() {
    return {
        size: pageCache.size,
        maxSize: MAX_CACHE,
        urls: Array.from(pageCache.keys())
    };
}

// ===== INTERCEPT LINKS =====
export function setupLinkInterception() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Skip external links
        if (href.startsWith('http://') || href.startsWith('https://')) {
            try {
                const url = new URL(href);
                if (url.origin !== window.location.origin) return;
            } catch {
                return;
            }
        }

        // Skip special links
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
            return;
        }

        // Skip if target is _blank or modifier key is pressed
        if (link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) {
            return;
        }

        // Only intercept same-origin internal links
        if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
            e.preventDefault();
            loadPage(href);
        }
    });

    if (CONFIG.debug) {
        console.log('[PageLoader] Link interception set up');
    }
}

// ===== DESTROY =====
export function destroyPageLoader() {
    pageCache.clear();
    if (CONFIG.debug) {
        console.log('[PageLoader] Destroyed');
    }
}

// ===== AUTO-INIT =====
if (typeof document !== 'undefined') {
    // Handle popstate (browser back/forward)
    window.addEventListener('popstate', (e) => {
        const url = window.location.pathname + window.location.search;
        loadPage(url, { preserveScroll: true });
    });

    // Set up link interception
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupLinkInterception);
    } else {
        setupLinkInterception();
    }
}

// ===== EXPORTS =====
export default {
    loadPage,
    preloadPage,
    clearPageCache,
    getPageCacheStats,
    setupLinkInterception,
    destroyPageLoader
};
