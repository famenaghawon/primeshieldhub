// ============================================================================
// public../js/sophisticated/fraud-engine/behavior.js - User Behavior Tracking Engine
// ============================================================================
// Tracks user behavior for fraud detection, analytics, and personalization
// ============================================================================

import { CONFIG } from '../config.js';
import { getDeviceFingerprint } from '../sophisticated/fraud-engine/fingerprint.js';
import { bus, Events } from '../events.js';
import { auth } from '../auth.js';

// ===== CONSTANTS =====
const BEHAVIOR_KEY = 'psh_behavior_data';
const SEND_INTERVAL = 30000; // Send every 30 seconds
const MAX_EVENTS = 50;

// ===== STATE =====
let behaviorData = {
    mouseMovements: 0,
    mouseClicks: 0,
    keyPresses: 0,
    scrollDepth: 0,
    maxScrollDepth: 0,
    timeOnPage: 0,
    startTime: Date.now(),
    lastActivity: Date.now(),
    pageViews: 1,
    sessions: 1,
    deviceType: getDeviceType(),
    screenSize: `${screen.width}x${screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    referrer: document.referrer || null,
    path: window.location.pathname,
    events: []
};

let eventBuffer = [];
let sendTimer = null;
let isTracking = false;
let fingerprint = null;
let userId = null;

// ===== DEVICE DETECTION =====
function getDeviceType() {
    const ua = navigator.userAgent;
    if (/Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
    if (/Tablet|iPad/i.test(ua)) return 'tablet';
    return 'desktop';
}

// ===== BEHAVIOR TRACKING =====

/**
 * Initialize behavior tracking
 */
export async function initBehaviorTracking() {
    if (isTracking) return;
    isTracking = true;

    // Get fingerprint
    try {
        fingerprint = await getDeviceFingerprint();
    } catch (e) {
        fingerprint = 'unknown';
    }

    // Get user
    try {
        const user = auth.getUser();
        userId = user?.id || null;
    } catch (e) {
        userId = null;
    }

    // Load saved behavior data
    loadBehaviorData();

    // Set up event listeners
    setupEventListeners();

    // Start periodic sending
    sendTimer = setInterval(() => {
        sendBehaviorData();
    }, SEND_INTERVAL);

    // Send on page unload
    window.addEventListener('beforeunload', () => {
        sendBehaviorData(true);
    });

    // Track page visibility
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Page hidden - send data
            sendBehaviorData(true);
        } else {
            // Page visible - resume tracking
            behaviorData.lastActivity = Date.now();
        }
    });

    if (CONFIG.debug) {
        console.log('[Behavior] Tracking initialized');
    }

    return true;
}

/**
 * Load saved behavior data from storage
 */
function loadBehaviorData() {
    try {
        const saved = localStorage.getItem(BEHAVIOR_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Only restore non-sensitive data
            behaviorData.sessions = (parsed.sessions || 0) + 1;
            behaviorData.pageViews = (parsed.pageViews || 0) + 1;
        }
    } catch (e) {
        // Ignore
    }
}

/**
 * Save behavior data to storage
 */
function saveBehaviorData() {
    try {
        const data = {
            sessions: behaviorData.sessions,
            pageViews: behaviorData.pageViews,
            lastActive: Date.now()
        };
        localStorage.setItem(BEHAVIOR_KEY, JSON.stringify(data));
    } catch (e) {
        // Ignore
    }
}

// ===== EVENT LISTENERS =====

function setupEventListeners() {
    // Mouse movements (throttled)
    let mouseCount = 0;
    let mouseTimer = null;
    
    document.addEventListener('mousemove', () => {
        mouseCount++;
        if (mouseCount % 10 === 0) {
            behaviorData.mouseMovements += 10;
            behaviorData.lastActivity = Date.now();
            addEvent('mousemove', { count: 10 });
        }
    }, { passive: true });

    // Mouse clicks
    document.addEventListener('click', (e) => {
        behaviorData.mouseClicks++;
        behaviorData.lastActivity = Date.now();
        
        // Track click target
        const target = e.target;
        const tag = target.tagName?.toLowerCase() || 'unknown';
        const id = target.id || null;
        const className = target.className || null;
        const href = target.closest('a')?.getAttribute('href') || null;
        
        addEvent('click', { 
            tag, 
            id, 
            className, 
            href,
            x: e.clientX,
            y: e.clientY
        });
    }, { passive: true });

    // Key presses
    document.addEventListener('keydown', (e) => {
        behaviorData.keyPresses++;
        behaviorData.lastActivity = Date.now();
        
        // Don't track sensitive keys
        const sensitiveKeys = ['Tab', 'Enter', 'Escape', 'Backspace', 'Delete'];
        if (!sensitiveKeys.includes(e.key) && e.key.length === 1) {
            addEvent('keypress', { key: e.key });
        }
    }, { passive: true });

    // Scroll tracking (throttled)
    let scrollTimer = null;
    let lastScrollDepth = 0;
    
    window.addEventListener('scroll', () => {
        if (scrollTimer) return;
        scrollTimer = setTimeout(() => {
            scrollTimer = null;
            
            const depth = Math.round(
                (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100
            );
            
            if (depth > lastScrollDepth) {
                behaviorData.scrollDepth = depth;
                behaviorData.maxScrollDepth = Math.max(behaviorData.maxScrollDepth, depth);
                behaviorData.lastActivity = Date.now();
                addEvent('scroll', { depth });
                lastScrollDepth = depth;
            }
        }, 200);
    }, { passive: true });

    // Time tracking (every second)
    setInterval(() => {
        behaviorData.timeOnPage++;
        behaviorData.lastActivity = Date.now();
    }, 1000);

    // Resize tracking
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        if (resizeTimer) return;
        resizeTimer = setTimeout(() => {
            resizeTimer = null;
            behaviorData.viewportSize = `${window.innerWidth}x${window.innerHeight}`;
            addEvent('resize', { 
                width: window.innerWidth, 
                height: window.innerHeight 
            });
        }, 500);
    }, { passive: true });

    // Network status
    window.addEventListener('online', () => {
        addEvent('online');
    });
    window.addEventListener('offline', () => {
        addEvent('offline');
    });

    // Focus/Blur
    window.addEventListener('focus', () => {
        behaviorData.lastActivity = Date.now();
        addEvent('focus');
    });
    window.addEventListener('blur', () => {
        addEvent('blur');
    });
}

// ===== EVENT BUFFER =====

function addEvent(type, data = {}) {
    const event = {
        type,
        data,
        timestamp: Date.now(),
        path: window.location.pathname
    };
    
    eventBuffer.push(event);
    
    // Limit buffer size
    if (eventBuffer.length > MAX_EVENTS) {
        eventBuffer = eventBuffer.slice(-MAX_EVENTS);
    }
}

// ===== SEND BEHAVIOR DATA =====

export async function sendBehaviorData(immediate = false) {
    if (eventBuffer.length === 0 && !immediate) return;
    
    const data = {
        ...behaviorData,
        fingerprint,
        userId,
        events: immediate ? eventBuffer : [],
        sessionId: getSessionId(),
        timestamp: Date.now()
    };
    
    // If immediate, send all events
    if (immediate) {
        data.events = eventBuffer;
        eventBuffer = [];
    } else if (eventBuffer.length > 0) {
        // Send a batch of events
        data.events = eventBuffer.splice(0, Math.min(10, eventBuffer.length));
    }
    
    // Build URL
    const url = `${CONFIG.apiBase}/behavior`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-device-fingerprint': fingerprint || 'unknown'
            },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        if (!response.ok && CONFIG.debug) {
            console.warn('[Behavior] Send failed:', response.status);
        }
    } catch (error) {
        if (CONFIG.debug) {
            console.warn('[Behavior] Send error:', error);
        }
        // Put events back in buffer
        if (data.events.length > 0) {
            eventBuffer = [...data.events, ...eventBuffer];
        }
    }
}

// ===== SESSION ID =====

function getSessionId() {
    let sessionId = sessionStorage.getItem('psh_behavior_session');
    if (!sessionId) {
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem('psh_behavior_session', sessionId);
    }
    return sessionId;
}

// ===== GET BEHAVIOR DATA =====

export function getBehaviorData() {
    return {
        ...behaviorData,
        fingerprint,
        userId,
        eventCount: eventBuffer.length,
        sessionId: getSessionId()
    };
}

export function getBehaviorFeatures() {
    return {
        mouseMovements: behaviorData.mouseMovements,
        mouseClicks: behaviorData.mouseClicks,
        keyPresses: behaviorData.keyPresses,
        scrollDepth: behaviorData.scrollDepth,
        maxScrollDepth: behaviorData.maxScrollDepth,
        timeOnPage: behaviorData.timeOnPage,
        deviceType: behaviorData.deviceType,
        screenSize: behaviorData.screenSize,
        viewportSize: behaviorData.viewportSize
    };
}

// ===== CLEANUP =====

export function stopBehaviorTracking() {
    if (sendTimer) {
        clearInterval(sendTimer);
        sendTimer = null;
    }
    isTracking = false;
    
    // Send final data
    sendBehaviorData(true);
    
    if (CONFIG.debug) {
        console.log('[Behavior] Tracking stopped');
    }
}

// ===== AUTO-INIT =====
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBehaviorTracking);
    } else {
        initBehaviorTracking();
    }
}

// ===== EXPORTS =====
export default {
    initBehaviorTracking,
    sendBehaviorData,
    getBehaviorData,
    getBehaviorFeatures,
    stopBehaviorTracking,
    behaviorData,
    eventBuffer
};
