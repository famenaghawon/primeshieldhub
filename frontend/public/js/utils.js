// ============================================================================
// utils.js - PrimeShieldHub Utilities v2.0
// ============================================================================
// Common utility functions used across the application.
// ============================================================================

import { CONFIG } from './config.js';

// ===== FORMATTING =====

/**
 * Format a number as currency
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (NGN, USD, EUR, GBP)
 * @param {object} options - Intl.NumberFormat options
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'NGN', options = {}) {
    const num = Number(amount);
    if (isNaN(num)) return '₦0';
    
    const defaultOptions = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        ...options
    };
    
    // Special handling for NGN
    if (currency === 'NGN') {
        return `₦${num.toLocaleString('en-NG', { 
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
            ...options 
        })}`;
    }
    
    try {
        return new Intl.NumberFormat('en-US', defaultOptions).format(num);
    } catch (e) {
        // Fallback
        const symbol = currency === 'NGN' ? '₦' : 
                      currency === 'USD' ? '$' :
                      currency === 'EUR' ? '€' :
                      currency === 'GBP' ? '£' : currency;
        return `${symbol}${num.toLocaleString('en-US')}`;
    }
}

/**
 * Format a date
 * @param {string|number|Date} date - Date to format
 * @param {string} format - Format type: 'short', 'medium', 'long', 'full', 'relative'
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'medium') {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date';
    
    const formats = {
        short: { month: 'short', day: 'numeric', year: 'numeric' },
        medium: { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' },
        long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
        full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' },
        relative: null // Handled by timeAgo
    };
    
    if (format === 'relative') {
        return timeAgo(d);
    }
    
    return d.toLocaleDateString('en-NG', formats[format] || formats.medium);
}

/**
 * Get time ago string (e.g., "2 hours ago")
 * @param {string|number|Date} date - Date to compare
 * @returns {string} Time ago string
 */
export function timeAgo(date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date';
    
    const now = Date.now();
    const diff = now - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (months < 12) return `${months}mo ago`;
    return `${years}y ago`;
}

/**
 * Format a number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(num) {
    return Number(num).toLocaleString('en-NG');
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} Truncated text
 */
export function truncateText(text, length = 100, suffix = '...') {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + suffix;
}

/**
 * Capitalize first letter of each word
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalizeWords(str) {
    if (!str) return '';
    return str.split(' ')
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Slugify a string (for URLs)
 * @param {string} str - String to slugify
 * @returns {string} Slugified string
 */
export function slugify(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// ===== DEBOUNCE & THROTTLE =====

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Call immediately on first invocation
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const context = this;
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 300) {
    let inThrottle = false;
    let lastFunc;
    let lastRan;
    
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            lastRan = Date.now();
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if (Date.now() - lastRan >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

// ===== DOM HELPERS =====

/**
 * Safely get an element by selector
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element to search within
 * @returns {Element|null} Found element or null
 */
export function $(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Safely get all elements by selector
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element to search within
 * @returns {NodeList} Found elements
 */
export function $$(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

/**
 * Create an element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {object} attributes - Element attributes
 * @param {Array|string} children - Child elements or text
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, attributes = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'dataset') {
            Object.entries(value).forEach(([k, v]) => {
                el.dataset[k] = v;
            });
        } else if (key === 'style' && typeof value === 'object') {
            Object.entries(value).forEach(([k, v]) => {
                el.style[k] = v;
            });
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            el.setAttribute(key, value);
        }
    });
    
    if (typeof children === 'string') {
        el.textContent = children;
    } else if (Array.isArray(children)) {
        children.forEach(child => {
            if (typeof child === 'string') {
                el.appendChild(document.createTextNode(child));
            } else if (child instanceof HTMLElement) {
                el.appendChild(child);
            }
        });
    }
    
    return el;
}

/**
 * Toggle a class on an element with animation
 * @param {Element} el - Element to toggle
 * @param {string} className - Class to toggle
 * @param {boolean} force - Force state
 */
export function toggleClass(el, className, force) {
    if (!el) return;
    if (force !== undefined) {
        el.classList.toggle(className, force);
    } else {
        el.classList.toggle(className);
    }
}

// ===== STORAGE HELPERS =====

/**
 * Safely get item from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Stored value or default
 */
export function getStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        if (item === null) return defaultValue;
        return JSON.parse(item);
    } catch (e) {
        return defaultValue;
    }
}

/**
 * Safely set item in localStorage
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} Success
 */
export function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Safely remove item from localStorage
 * @param {string} key - Storage key
 * @returns {boolean} Success
 */
export function removeStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Get item from sessionStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value
 * @returns {*} Stored value or default
 */
export function getSessionStorage(key, defaultValue = null) {
    try {
        const item = sessionStorage.getItem(key);
        if (item === null) return defaultValue;
        return JSON.parse(item);
    } catch (e) {
        return defaultValue;
    }
}

/**
 * Set item in sessionStorage
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} Success
 */
export function setSessionStorage(key, value) {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        return false;
    }
}

// ===== URL HELPERS =====

/**
 * Get URL parameter by name
 * @param {string} name - Parameter name
 * @param {string} url - URL string (defaults to current URL)
 * @returns {string|null} Parameter value or null
 */
export function getQueryParam(name, url = window.location.search) {
    const params = new URLSearchParams(url);
    return params.get(name);
}

/**
 * Get all URL parameters as an object
 * @param {string} url - URL string (defaults to current URL)
 * @returns {object} Parameters object
 */
export function getQueryParams(url = window.location.search) {
    const params = new URLSearchParams(url);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}

/**
 * Build a URL with query parameters
 * @param {string} base - Base URL
 * @param {object} params - Parameters object
 * @returns {string} Full URL
 */
export function buildUrl(base, params = {}) {
    const url = new URL(base, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });
    return url.toString();
}

// ===== VALIDATION =====

/**
 * Check if email is valid
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid
 */
export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Check if phone number is valid (Nigeria format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Is valid
 */
export function isValidPhone(phone) {
    // Nigerian phone numbers: 080xxxxxxxx, 090xxxxxxxx, 070xxxxxxxx, +23480xxxxxxxx
    return /^(\+?234|0)[789][01]\d{8}$/.test(phone.replace(/\s/g, ''));
}

/**
 * Check if URL is valid
 * @param {string} url - URL to validate
 * @returns {boolean} Is valid
 */
export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Check if string is empty or whitespace
 * @param {string} str - String to check
 * @returns {boolean} Is empty
 */
export function isEmpty(str) {
    return !str || str.trim().length === 0;
}

// ===== SECURITY =====

/**
 * Escape HTML to prevent XSS
 * @param {string} s - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(s) {
    if (!s) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return String(s).replace(/[&<>"']/g, match => map[match]);
}

/**
 * Generate a secure ID
 * @param {string} prefix - Optional prefix
 * @returns {string} Secure ID
 */
export function generateSecureId(prefix = 'PSH') {
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = array[0].toString(36).toUpperCase() + array[1].toString(36).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate a short ID (for display)
 * @param {number} length - Length of ID
 * @returns {string} Short ID
 */
export function generateShortId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length];
    }
    return result;
}

// ===== LOGGING =====

/**
 * Log an error with context
 * @param {Error|string} error - Error object or message
 * @param {string} context - Context of the error
 */
export function logError(error, context = '') {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    console.error(`[PrimeShieldHub] ${context ? context + ':' : ''}`, message);
    if (stack) console.error(stack);
    
    // Send to server if in production
    if (CONFIG?.isProd) {
        try {
            navigator.sendBeacon('/api/log', JSON.stringify({
                level: 'error',
                message,
                context,
                stack,
                url: window.location.href,
                timestamp: Date.now()
            }));
        } catch (e) {
            // Silent fail
        }
    }
}

/**
 * Log info with context
 * @param {string} message - Log message
 * @param {string} context - Context
 * @param {*} data - Additional data
 */
export function logInfo(message, context = '', data = null) {
    console.log(`[PrimeShieldHub] ${context ? context + ':' : ''}`, message, data || '');
}

/**
 * Log warning with context
 * @param {string} message - Warning message
 * @param {string} context - Context
 * @param {*} data - Additional data
 */
export function logWarning(message, context = '', data = null) {
    console.warn(`[PrimeShieldHub] ${context ? context + ':' : ''}`, message, data || '');
}

// ===== OBJECT HELPERS =====

/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Map) {
        const map = new Map();
        obj.forEach((value, key) => map.set(key, deepClone(value)));
        return map;
    }
    if (obj instanceof Set) {
        const set = new Set();
        obj.forEach(value => set.add(deepClone(value)));
        return set;
    }
    const cloned = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * Check if object is empty
 * @param {object} obj - Object to check
 * @returns {boolean} Is empty
 */
export function isEmptyObject(obj) {
    return obj && typeof obj === 'object' && Object.keys(obj).length === 0;
}

/**
 * Pick specific keys from an object
 * @param {object} obj - Source object
 * @param {Array} keys - Keys to pick
 * @returns {object} New object with picked keys
 */
export function pick(obj, keys) {
    const result = {};
    keys.forEach(key => {
        if (obj && obj.hasOwnProperty(key)) {
            result[key] = obj[key];
        }
    });
    return result;
}

/**
 * Omit specific keys from an object
 * @param {object} obj - Source object
 * @param {Array} keys - Keys to omit
 * @returns {object} New object without omitted keys
 */
export function omit(obj, keys) {
    const result = { ...obj };
    keys.forEach(key => {
        delete result[key];
    });
    return result;
}

// ===== BROWSER HELPERS =====

/**
 * Check if device is mobile
 * @returns {boolean} Is mobile
 */
export function isMobile() {
    return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Check if device is tablet
 * @returns {boolean} Is tablet
 */
export function isTablet() {
    return window.innerWidth > 768 && window.innerWidth <= 1024;
}

/**
 * Check if device is desktop
 * @returns {boolean} Is desktop
 */
export function isDesktop() {
    return window.innerWidth > 1024;
}

/**
 * Get device type
 * @returns {string} 'mobile', 'tablet', or 'desktop'
 */
export function getDeviceType() {
    if (isMobile()) return 'mobile';
    if (isTablet()) return 'tablet';
    return 'desktop';
}

/**
 * Check if browser supports a feature
 * @param {string} feature - Feature to check
 * @returns {boolean} Is supported
 */
export function isFeatureSupported(feature) {
    const features = {
        webp: () => {
            const canvas = document.createElement('canvas');
            return canvas.toDataURL('image/webp').startsWith('data:image/webp');
        },
        webgl: () => {
            try {
                const canvas = document.createElement('canvas');
                return !!canvas.getContext('webgl') || !!canvas.getContext('experimental-webgl');
            } catch (e) {
                return false;
            }
        },
        serviceWorker: () => 'serviceWorker' in navigator,
        pushNotification: () => 'Notification' in window && 'PushManager' in window,
        geolocation: () => 'geolocation' in navigator,
        localStorage: () => {
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                return true;
            } catch (e) {
                return false;
            }
        }
    };
    
    return features[feature] ? features[feature]() : false;
}

// ===== EXPORTS =====
export default {
    formatCurrency,
    formatDate,
    timeAgo,
    formatNumber,
    truncateText,
    capitalizeWords,
    slugify,
    debounce,
    throttle,
    $,
    $$,
    createElement,
    toggleClass,
    getStorage,
    setStorage,
    removeStorage,
    getSessionStorage,
    setSessionStorage,
    getQueryParam,
    getQueryParams,
    buildUrl,
    isValidEmail,
    isValidPhone,
    isValidUrl,
    isEmpty,
    escapeHtml,
    generateSecureId,
    generateShortId,
    logError,
    logInfo,
    logWarning,
    deepClone,
    isEmptyObject,
    pick,
    omit,
    isMobile,
    isTablet,
    isDesktop,
    getDeviceType,
    isFeatureSupported
};
