// ============================================================================
// public../js/sophisticated/predictive-prefetch.js - Smart Prefetch Engine v2.0
// ============================================================================
// Predictively prefetches pages based on user behavior and AI predictions.
// ============================================================================

import { CONFIG } from '../config.js';
import { auth } from '../auth.js';
import { bus, Events } from '../events.js';
import { getDeviceFingerprint } from './fraud-engine/fingerprint.js';
import { askBrain } from '../ai-brain-client.js';

// ===== CONSTANTS =====
const PREFETCH_CACHE_KEY = 'psh_prefetch_cache';
const PREFETCH_HISTORY_KEY = 'psh_prefetch_history';
const MAX_HISTORY = 20;
const CACHE_TTL = 300000; // 5 minutes

// ===== STATE =====
let prefetchedUrls = new Set();
let activePrefetches = new Map();
let hoverTimer = null;
let observer = null;
let isEnabled = true;
let history = [];
let currentUrl = window.location.href;

// ===== HELPERS =====
function getEffectiveConnectionType() {
    if ('connection' in navigator) {
        return navigator.connection.effectiveType;
    }
    return 'unknown';
}

function isSlowNetwork() {
    const type = getEffectiveConnectionType();
    return ['slow-2g', '2g', '3g'].includes(type);
}

function isSaveDataEnabled() {
    return navigator.connection && navigator.connection.saveData === true;
}

function isSameOrigin(url) {
    try {
        const linkUrl = new URL(url, window.location.href);
        return linkUrl.origin === window.location.origin;
    } catch {
        return false;
    }
}

function getLinkUrl(link) {
    return link.getAttribute('href');
}

function prefetchLink(url) {
    if (!url || prefetchedUrls.has(url)) return;
    
    try {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        link.as = 'document';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
        
        prefetchedUrls.add(url);
        
        if (CONFIG.debug) {
            console.log('[Prefetch] Prefetched:', url);
        }
        
        // Clean up after 5 seconds
        setTimeout(() => {
            if (link.parentNode) {
                link.parentNode.removeChild(link);
            }
        }, 5000);
    } catch (e) {
        console.warn('[Prefetch] Failed:', e.message);
    }
}

function preconnect(url) {
    try {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = url;
        document.head.appendChild(link);
    } catch (e) {
        // Ignore
    }
}

// ===== HISTORY =====
function loadHistory() {
    try {
        const stored = localStorage.getItem(PREFETCH_HISTORY_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                history = parsed.slice(-MAX_HISTORY);
            }
        }
    } catch (e) {
        // Ignore
    }
}

function saveHistory() {
    try {
        localStorage.setItem(PREFETCH_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch (e) {
        // Ignore
    }
}

function recordNavigation(from, to) {
    if (from && to && from !== to) {
        history.push({ from, to, timestamp: Date.now() });
        if (history.length > MAX_HISTORY) {
            history = history.slice(-MAX_HISTORY);
        }
        saveHistory();
    }
}

// ===== AI PREDICTION =====
async function getPrediction(link) {
    const url = getLinkUrl(link);
    if (!url || !isSameOrigin(url)) return null;
    
    try {
        const prediction = await askBrain({
            type: 'navigation',
            target: url,
            path: currentUrl,
            features: {
                linkText: link.textContent?.trim() || '',
                linkPosition: Array.from(document.links).indexOf(link),
                linkCount: document.links.length
            }
        });
        
        if (prediction && prediction.nextPage) {
            return prediction.nextPage;
        }
    } catch (e) {
        if (CONFIG.debug) {
            console.warn('[Prefetch] AI prediction failed:', e.message);
        }
    }
    
    return null;
}

// ===== PREFETCH CANDIDATE =====
async function prefetchCandidate(link) {
    if (!isEnabled) return;
    
    const url = getLinkUrl(link);
    if (!url || !isSameOrigin(url)) return;
    if (prefetchedUrls.has(url)) return;
    
    // Get prediction
    const predicted = await getPrediction(link);
    
    // If AI predicts this link or we have a match
    if (predicted === url) {
        prefetchLink(url);
    } else {
        // Fallback: prefetch on hover after delay
        if (hoverTimer) {
            clearTimeout(hoverTimer);
        }
        hoverTimer = setTimeout(() => {
            prefetchLink(url);
            hoverTimer = null;
        }, 200);
    }
}

// ===== INTERSECTION OBSERVER =====
function setupIntersectionObserver() {
    observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                const link = entry.target;
                const url = getLinkUrl(link);
                if (url && isSameOrigin(url) && !prefetchedUrls.has(url)) {
                    prefetchLink(url);
                }
            }
        }
    }, {
        rootMargin: '200px',
        threshold: 0.01
    });
    
    // Observe all links
    document.querySelectorAll('a[href]').forEach(link => {
        observer.observe(link);
    });
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Click tracking
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        const url = getLinkUrl(link);
        if (url && isSameOrigin(url)) {
            recordNavigation(currentUrl, url);
        }
    });
    
    // Hover prefetch
    document.addEventListener('mouseover', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        prefetchCandidate(link);
    });
    
    // Clear hover timer on mouseout
    document.addEventListener('mouseout', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
    });
    
    // Visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Clear active prefetches
            activePrefetches.forEach((timer) => clearTimeout(timer));
            activePrefetches.clear();
        }
    });
}

// ===== CHECK CONDITIONS =====
async function shouldDisable() {
    if (isSaveDataEnabled()) return true;
    if (isSlowNetwork()) return true;
    
    // Check battery
    try {
        if ('getBattery' in navigator) {
            const battery = await navigator.getBattery();
            if (battery.level <= 0.15 && !battery.charging) return true;
        }
    } catch (e) {
        // Ignore
    }
    
    return false;
}

// ===== PUBLIC API =====

/**
 * Initialize the prefetch engine
 */
export async function initPredictivePrefetch(options = {}) {
    // Check conditions
    const disabled = await shouldDisable();
    if (disabled) {
        console.log('[Prefetch] Disabled due to user preferences or network conditions');
        isEnabled = false;
        return;
    }
    
    isEnabled = true;
    currentUrl = window.location.href;
    
    // Load history
    loadHistory();
    
    // Set up listeners
    setupEventListeners();
    setupIntersectionObserver();
    
    // Record initial page
    recordNavigation(null, currentUrl);
    
    // Prefetch links in viewport
    setTimeout(() => {
        const links = document.querySelectorAll('a[href]');
        for (const link of links) {
            const rect = link.getBoundingClientRect();
            if (rect.top < window.innerHeight + 200) {
                const url = getLinkUrl(link);
                if (url && isSameOrigin(url) && !prefetchedUrls.has(url)) {
                    prefetchLink(url);
                }
            }
        }
    }, 100);
    
    if (CONFIG.debug) {
        console.log('[Prefetch] Engine initialized');
    }
    
    // Emit event
    if (bus?.emit) {
        bus.emit(Events.PREFETCH_READY);
    }
}

/**
 * Prefetch a specific URL
 */
export function prefetch(url) {
    if (!isEnabled) return;
    if (!url || !isSameOrigin(url)) return;
    prefetchLink(url);
}

/**
 * Clear prefetch cache
 */
export function clearPrefetchCache() {
    prefetchedUrls.clear();
    activePrefetches.forEach((timer) => clearTimeout(timer));
    activePrefetches.clear();
    document.querySelectorAll('link[rel="prefetch"]').forEach(el => el.remove());
    console.log('[Prefetch] Cache cleared');
}

/**
 * Get prefetch stats
 */
export function getPrefetchStats() {
    return {
        enabled: isEnabled,
        prefetchedCount: prefetchedUrls.size,
        activePrefetches: activePrefetches.size,
        historySize: history.length
    };
}

/**
 * Destroy the prefetch engine
 */
export function destroyPredictivePrefetch() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    
    if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
    }
    
    activePrefetches.forEach((timer) => clearTimeout(timer));
    activePrefetches.clear();
    
    // Remove prefetch links
    document.querySelectorAll('link[rel="prefetch"]').forEach(el => el.remove());
    document.querySelectorAll('link[rel="preconnect"]').forEach(el => el.remove());
    document.querySelectorAll('link[rel="dns-prefetch"]').forEach(el => el.remove());
    
    prefetchedUrls.clear();
    isEnabled = false;
    
    if (CONFIG.debug) {
        console.log('[Prefetch] Destroyed');
    }
}

// ===== AUTO-INIT =====
let autoInit = true;

export function disableAutoInit() {
    autoInit = false;
}

if (typeof document !== 'undefined' && autoInit) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initPredictivePrefetch, 1000);
        });
    } else {
        setTimeout(initPredictivePrefetch, 1000);
    }
}

// ===== EXPORT =====
export default {
    initPredictivePrefetch,
    prefetch,
    clearPrefetchCache,
    getPrefetchStats,
    destroyPredictivePrefetch,
    disableAutoInit
};
