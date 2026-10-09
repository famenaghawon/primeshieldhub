// ============================================================================
// web-vitals.js — Performance Intelligence Engine v2.0
// ============================================================================
// Tracks Core Web Vitals (CLS, FID, LCP, TTFB, INP) and sends to AI brain
// ============================================================================

import { CONFIG } from './config.js';
import { askBrain } from './ai-brain-client.js';
import { bus, Events } from './events.js';

// ===== CONSTANTS =====
const VITALS_CDN = 'https://unpkg.com/web-vitals@4/dist/web-vitals.iife.js';
const BATCH_INTERVAL = 3000; // Send metrics in batch every 3 seconds
const MAX_BATCH_SIZE = 10;

// ===== STATE =====
let vitalsLoaded = false;
let vitalsInstance = null;
let metricBuffer = [];
let batchTimer = null;
let vitalsInitialized = false;

// ===== LOAD WEB VITALS =====
async function loadWebVitals() {
    // Check if already loaded
    if (window.webVitals) {
        vitalsInstance = window.webVitals;
        vitalsLoaded = true;
        return vitalsInstance;
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src*="web-vitals"]');
    if (existingScript) {
        return new Promise((resolve) => {
            existingScript.addEventListener('load', () => {
                vitalsInstance = window.webVitals;
                vitalsLoaded = true;
                resolve(vitalsInstance);
            });
            // If already loaded
            if (window.webVitals) {
                vitalsInstance = window.webVitals;
                vitalsLoaded = true;
                resolve(vitalsInstance);
            }
        });
    }

    // Load from CDN
    return new Promise((resolve, reject) => {
        try {
            const script = document.createElement('script');
            script.src = VITALS_CDN;
            script.async = true;
            script.defer = true;
            
            const timeout = setTimeout(() => {
                reject(new Error('Web Vitals CDN load timeout'));
            }, 10000);
            
            script.onload = () => {
                clearTimeout(timeout);
                vitalsInstance = window.webVitals;
                vitalsLoaded = true;
                resolve(vitalsInstance);
            };
            
            script.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Web Vitals CDN load failed'));
            };
            
            document.head.appendChild(script);
        } catch (error) {
            reject(error);
        }
    });
}

// ===== METRIC HANDLING =====
function processMetric(name, metric) {
    // Format metric
    const data = {
        name,
        value: Math.round(metric.value * 100) / 100,
        rating: metric.rating || getRating(name, metric.value),
        delta: metric.delta ? Math.round(metric.delta * 100) / 100 : null,
        id: metric.id || null,
        navigationType: metric.navigationType || null,
        url: window.location.pathname,
        timestamp: Date.now()
    };
    
    // Add to buffer
    metricBuffer.push(data);
    
    // Log in debug mode
    if (CONFIG.debug) {
        console.log(`[WebVitals] ${name}:`, data);
    }
    
    // Emit event
    if (bus?.emit) {
        bus.emit(Events.WEB_VITAL, data);
    }
    
    // Flush if buffer is full
    if (metricBuffer.length >= MAX_BATCH_SIZE) {
        flushMetrics();
    }
}

function getRating(name, value) {
    // Core Web Vitals thresholds
    const thresholds = {
        CLS: { good: 0.1, poor: 0.25 },
        FID: { good: 100, poor: 300 },
        LCP: { good: 2500, poor: 4000 },
        TTFB: { good: 200, poor: 600 },
        INP: { good: 200, poor: 500 }
    };
    
    const threshold = thresholds[name];
    if (!threshold) return 'needs-improvement';
    
    if (value <= threshold.good) return 'good';
    if (value > threshold.poor) return 'poor';
    return 'needs-improvement';
}

// ===== BATCH SENDING =====
async function flushMetrics() {
    if (metricBuffer.length === 0) return;
    
    const metrics = [...metricBuffer];
    metricBuffer = [];
    
    try {
        await askBrain({
            type: 'performance',
            metrics: metrics,
            url: window.location.pathname,
            timestamp: Date.now()
        });
        
        if (CONFIG.debug) {
            console.log(`[WebVitals] Sent ${metrics.length} metrics`);
        }
    } catch (error) {
        console.warn('[WebVitals] Failed to send metrics:', error);
        
        // Put metrics back in buffer for retry
        metricBuffer = [...metrics, ...metricBuffer];
        
        // Retry after delay
        setTimeout(() => {
            if (metricBuffer.length > 0) {
                flushMetrics();
            }
        }, 5000);
    }
}

// ===== METRIC VISUALIZATION =====
function showMetricBadge(name, value, rating) {
    // Only show in development
    if (!CONFIG.debug) return;
    
    const colors = {
        good: '#33ffaa',
        'needs-improvement': '#ffaa33',
        poor: '#ff3366'
    };
    
    // Remove existing badge for this metric
    const existing = document.getElementById(`vital-${name}`);
    if (existing) existing.remove();
    
    const badge = document.createElement('div');
    badge.id = `vital-${name}`;
    badge.style.cssText = `
        position: fixed;
        bottom: ${20 + (Array.from(document.querySelectorAll('[id^="vital-"]')).length * 35)}px;
        right: 20px;
        background: rgba(10,10,20,0.9);
        backdrop-filter: blur(10px);
        border-left: 3px solid ${colors[rating] || '#888'};
        border-radius: 8px;
        padding: 6px 12px;
        font-family: monospace;
        font-size: 11px;
        color: #f0f0f0;
        z-index: 99999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        pointer-events: none;
        animation: fadeIn 0.3s ease;
    `;
    
    const icon = rating === 'good' ? '✅' : rating === 'poor' ? '❌' : '⚠️';
    badge.textContent = `${icon} ${name}: ${value}${typeof value === 'number' && name !== 'CLS' ? 'ms' : ''}`;
    
    document.body.appendChild(badge);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
        badge.style.opacity = '0';
        badge.style.transition = 'opacity 0.5s';
        setTimeout(() => badge.remove(), 500);
    }, 30000);
}

// ===== INITIALIZATION =====
export async function initWebVitals() {
    if (vitalsInitialized) return;
    vitalsInitialized = true;
    
    try {
        const webVitals = await loadWebVitals();
        
        if (!webVitals) {
            console.warn('[WebVitals] Failed to load, skipping');
            return;
        }
        
        // Core Web Vitals
        webVitals.onCLS((metric) => {
            processMetric('CLS', metric);
            if (CONFIG.debug) showMetricBadge('CLS', metric.value, getRating('CLS', metric.value));
        });
        
        webVitals.onFID((metric) => {
            processMetric('FID', metric);
            if (CONFIG.debug) showMetricBadge('FID', metric.value, getRating('FID', metric.value));
        });
        
        webVitals.onLCP((metric) => {
            processMetric('LCP', metric);
            if (CONFIG.debug) showMetricBadge('LCP', metric.value, getRating('LCP', metric.value));
        });
        
        webVitals.onTTFB((metric) => {
            processMetric('TTFB', metric);
            if (CONFIG.debug) showMetricBadge('TTFB', metric.value, getRating('TTFB', metric.value));
        });
        
        // INP (Interaction to Next Paint) - newer metric
        if (webVitals.onINP) {
            webVitals.onINP((metric) => {
                processMetric('INP', metric);
                if (CONFIG.debug) showMetricBadge('INP', metric.value, getRating('INP', metric.value));
            });
        }
        
        // FCP (First Contentful Paint) - optional
        if (webVitals.onFCP) {
            webVitals.onFCP((metric) => {
                processMetric('FCP', metric);
                if (CONFIG.debug) showMetricBadge('FCP', metric.value, getRating('FCP', metric.value));
            });
        }
        
        // Start batch timer
        if (batchTimer) {
            clearInterval(batchTimer);
        }
        batchTimer = setInterval(() => {
            if (metricBuffer.length > 0) {
                flushMetrics();
            }
        }, BATCH_INTERVAL);
        
        // Flush on page unload
        window.addEventListener('beforeunload', () => {
            if (metricBuffer.length > 0) {
                // Send with sendBeacon for reliable delivery
                try {
                    const data = JSON.stringify({
                        type: 'performance',
                        metrics: metricBuffer,
                        url: window.location.pathname,
                        timestamp: Date.now(),
                        isUnload: true
                    });
                    
                    navigator.sendBeacon('/api/analytics/performance', data);
                } catch (e) {
                    // Fallback to flush
                    flushMetrics();
                }
            }
        });
        
        if (CONFIG.debug) {
            console.log('[WebVitals] Initialized successfully');
            console.log('[WebVitals] Tracking: CLS, FID, LCP, TTFB, INP');
        }
        
        return true;
        
    } catch (error) {
        console.warn('[WebVitals] Initialization failed:', error);
        return false;
    }
}

// ===== GET PERFORMANCE SUMMARY =====
export function getPerformanceSummary() {
    const metrics = {};
    
    // Get from performance API
    try {
        const entries = performance.getEntriesByType('navigation');
        if (entries.length > 0) {
            const nav = entries[0];
            metrics.domContentLoaded = nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart;
            metrics.loadComplete = nav.loadEventEnd - nav.loadEventStart;
            metrics.domInteractive = nav.domInteractive;
            metrics.domComplete = nav.domComplete;
            metrics.redirectCount = nav.redirectCount;
            metrics.transferSize = nav.transferSize;
            metrics.decodedBodySize = nav.decodedBodySize;
        }
        
        // Resource timing
        const resources = performance.getEntriesByType('resource');
        metrics.resourceCount = resources.length;
        metrics.totalResourceSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
        
        // Paint timing
        const paints = performance.getEntriesByType('paint');
        paints.forEach(p => {
            metrics[p.name] = p.startTime;
        });
        
        // Memory (if available)
        if (performance.memory) {
            metrics.memoryUsed = performance.memory.usedJSHeapSize;
            metrics.memoryTotal = performance.memory.totalJSHeapSize;
            metrics.memoryLimit = performance.memory.jsHeapSizeLimit;
        }
    } catch (e) {
        // Ignore
    }
    
    return metrics;
}

// ===== REPORT CRITICAL VITALS =====
export function reportCriticalVitals() {
    // Get current vital scores from buffer
    const vitals = {};
    metricBuffer.forEach(m => {
        if (!vitals[m.name] || m.value < vitals[m.name]) {
            vitals[m.name] = m.value;
        }
    });
    
    // Check for poor scores
    const poor = Object.entries(vitals).filter(([name, value]) => {
        const rating = getRating(name, value);
        return rating === 'poor';
    });
    
    if (poor.length > 0) {
        console.warn('[WebVitals] Poor performance detected:', poor);
        return { poor, vitals };
    }
    
    return { poor: [], vitals };
}

// ===== AUTO-INIT =====
let autoInit = true;

export function disableAutoInit() {
    autoInit = false;
}

if (typeof document !== 'undefined' && autoInit) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Delay to let page load
            setTimeout(initWebVitals, 1000);
        });
    } else {
        setTimeout(initWebVitals, 1000);
    }
}

// ===== EXPORTS =====
export default {
    initWebVitals,
    getPerformanceSummary,
    reportCriticalVitals,
    disableAutoInit,
    flushMetrics,
    getRating,
    metricBuffer
};
