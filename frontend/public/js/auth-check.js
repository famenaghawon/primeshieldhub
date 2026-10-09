// ============================================================================
// public../js/auth-check.js - Unified Role-Aware Authentication Check v2.2
// ============================================================================
// Smart authentication checker that handles:
// - Role-based access control (admin, staff, customer)
// - Token validation with server
// - Device fingerprint verification
// - Proper redirects to correct login pages
// - Guest mode handling for public pages
// FIXED: Server response handling for session ID authentication
// FIXED: Added redirectOnFail variable
// FIXED: Added debug logging for token type detection
// ============================================================================

import { CONFIG } from './config.js';
import { auth } from './auth.js';
import { api } from './api-client.js';

// ===== CONSTANTS =====
const STORAGE_KEYS = CONFIG.STORAGE_KEYS || {
    TOKEN: 'psh_auth_token',
    USER: 'psh_user',
};

const ROUTES = CONFIG.pages || {};

// ===== PUBLIC PATHS (from CONFIG) =====
const PUBLIC_PATHS = [
    '/', '/index.html',
    '/products', '/products.html',
    '/about', '/about.html',
    '/contact', '/contact.html',
    '/faq', '/faq.html',
    '/blog', '/blog.html',
    '/privacy', '/privacy.html',
    '/terms', '/terms.html',
    '/login', '/login.html',
    '/register', '/register.html',
    '/admin/login', '/staff/login', '/reseller/login', '/wholesale/login',
    '/admin-login', '/admin-login.html'
];

// ===== ROLE-BASED REDIRECT MAP =====
const ROLE_LOGIN_MAP = {
    'admin': '/admin-login',
    'staff': '/staff/login',
    'customer': '/login',
    'reseller': '/reseller/login',
    'wholesale': '/wholesale/login'
};

const ROLE_DASHBOARD_MAP = {
    'admin': '/admin',
    'staff': '/staff/dashboard',
    'customer': '/account',
    'reseller': '/reseller/dashboard',
    'wholesale': '/wholesale/dashboard'
};

// ============================================================
// TOKEN TYPE DETECTION
// ============================================================

function isJWTToken(token) {
    if (!token) return false;
    return token.includes('.') && token.startsWith('eyJ');
}

function isSessionId(token) {
    if (!token) return false;
    return !token.includes('.') && !token.startsWith('eyJ') && token.length < 100;
}

function getTokenType(token) {
    if (!token) return 'none';
    if (isJWTToken(token)) return 'jwt';
    if (isSessionId(token)) return 'session_id';
    return 'unknown';
}

// ============================================================
// MAIN AUTH CHECK FUNCTION
// ============================================================

/**
 * Check authentication status with role-based access control
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.requiredRole - Required role ('admin', 'staff', 'customer', etc.)
 * @param {string} options.redirectIfNot - Redirect URL if not authenticated
 * @param {string} options.redirectIfUnauthorized - Redirect URL if wrong role
 * @param {boolean} options.validateToken - Whether to validate token with server (default: true)
 * @param {boolean} options.allowGuest - Allow guest access (default: false)
 * @param {string[]} options.allowedRoles - Array of allowed roles (alternative to requiredRole)
 * @param {Function} options.onSuccess - Callback when auth succeeds
 * @param {Function} options.onError - Callback when auth fails
 * @param {boolean} options.autoRedirect - Whether to auto-redirect (default: true)
 * @param {string} options.redirectParam - Parameter name for redirect URL (default: 'redirect')
 * @param {boolean} options.redirectOnFail - Whether to redirect on auth failure (default: true)
 * @returns {Promise<Object|null>} - Session object or null
 */
export async function checkAuth(options = {}) {
    const {
        requiredRole = null,
        allowedRoles = null,
        redirectIfNot = '/login',
        redirectIfUnauthorized = '/login',
        validateToken = true,
        allowGuest = false,
        onSuccess = null,
        onError = null,
        autoRedirect = true,
        redirectParam = 'redirect',
        redirectOnFail = true  // ← FIXED: Added this variable
    } = options;

    try {
        // ===== 1. GET CURRENT SESSION =====
        let session = null;
        let user = null;
        let token = null;

        // Use unified auth module first
        try {
            user = auth.getUser();
            token = auth.getToken();
        } catch (e) {
            if (CONFIG.debug) console.warn('[AuthCheck] Auth module error:', e);
        }

        // Fallback to AuthStorage if available
        if (!user || !token) {
            try {
                if (window.AuthStorage && window.AuthStorage.getSession) {
                    session = await window.AuthStorage.getSession();
                    if (session) {
                        user = session.user;
                        token = session.token;
                    }
                }
            } catch (e) {
                if (CONFIG.debug) console.warn('[AuthCheck] AuthStorage error:', e);
            }
        }

        // Fallback to localStorage
        if (!user || !token) {
            try {
                const userStr = localStorage.getItem(STORAGE_KEYS.USER);
                const tokenStr = localStorage.getItem(STORAGE_KEYS.TOKEN);
                if (userStr && tokenStr) {
                    user = JSON.parse(userStr);
                    token = tokenStr;
                }
            } catch (e) {
                // Ignore
            }
        }

        // Log token type for debugging
        if (token) {
            const tokenType = getTokenType(token);
            console.log('[AuthCheck] Token type:', tokenType);
            if (tokenType === 'jwt') {
                console.warn('[AuthCheck] ⚠️ JWT token detected - backend expects session ID!');
            } else if (tokenType === 'session_id') {
                console.log('[AuthCheck] ✅ Session ID detected - correct format!');
            }
        }

        // ===== 2. GUEST MODE CHECK =====
        if (allowGuest && !user) {
            if (CONFIG.debug) console.log('[AuthCheck] Guest mode allowed');
            if (onSuccess) onSuccess(null);
            return { isGuest: true, user: null, token: null };
        }

        // ===== 3. NO AUTHENTICATION =====
        if (!user || !token) {
            if (CONFIG.debug) console.log('[AuthCheck] No valid session found');
            
            if (autoRedirect && redirectOnFail) {
                const loginUrl = getLoginRedirect(requiredRole, redirectIfNot);
                const redirectTarget = buildRedirectUrl(loginUrl, { [redirectParam]: window.location.pathname });
                console.log('[AuthCheck] Redirecting to:', redirectTarget);
                window.location.href = redirectTarget;
                return null;
            }
            
            if (onError) onError(new Error('Not authenticated'));
            return null;
        }

        // ===== 4. VALIDATE TOKEN WITH SERVER (optional) =====
        if (validateToken) {
            try {
                const isValid = await validateTokenWithServer(token);
                if (!isValid) {
                    if (CONFIG.debug) console.warn('[AuthCheck] Token validation failed');
                    // Clear invalid session
                    auth.setToken(null);
                    auth.setUser(null);
                    
                    if (autoRedirect && redirectOnFail) {
                        const loginUrl = getLoginRedirect(requiredRole, redirectIfNot);
                        const redirectTarget = buildRedirectUrl(loginUrl, { [redirectParam]: window.location.pathname });
                        console.log('[AuthCheck] Redirecting to:', redirectTarget);
                        window.location.href = redirectTarget;
                        return null;
                    }
                    
                    if (onError) onError(new Error('Invalid session'));
                    return null;
                }
            } catch (e) {
                if (CONFIG.debug) console.warn('[AuthCheck] Token validation error:', e);
                // Don't fail on validation error, but log it
            }
        }

        // ===== 5. VERIFY DEVICE FINGERPRINT =====
        try {
            const fingerprint = await getDeviceFingerprint();
            const storedFingerprint = localStorage.getItem('psh_device_fp_hash');
            if (storedFingerprint && fingerprint !== storedFingerprint) {
                if (CONFIG.debug) console.warn('[AuthCheck] Fingerprint mismatch - possible session hijacking');
                // Don't block, but could trigger additional verification
            }
        } catch (e) {
            // Ignore fingerprint errors
        }

        // ===== 6. ROLE-BASED ACCESS CONTROL =====
        const userRole = user.role || user.user_type || 'customer';
        
        // Check if role is allowed
        const isRoleAllowed = checkRolePermission(userRole, requiredRole, allowedRoles);
        
        if (!isRoleAllowed) {
            if (CONFIG.debug) console.warn(`[AuthCheck] User has role '${userRole}', but access requires:`, requiredRole || allowedRoles);
            
            if (autoRedirect && redirectOnFail) {
                const redirectUrl = getRoleRedirect(userRole, redirectIfUnauthorized);
                const redirectTarget = buildRedirectUrl(redirectUrl, { 
                    [redirectParam]: window.location.pathname,
                    error: 'unauthorized'
                });
                console.log('[AuthCheck] Redirecting to:', redirectTarget);
                window.location.href = redirectTarget;
                return null;
            }
            
            if (onError) onError(new Error('Insufficient permissions'));
            return null;
        }

        // ===== 7. SUCCESS =====
        const sessionData = {
            user,
            token,
            role: userRole,
            isAuthenticated: true
        };
        
        console.log('[AuthCheck] ✅ Authentication successful for role:', userRole);
        
        if (onSuccess) onSuccess(sessionData);
        
        return sessionData;

    } catch (error) {
        console.error('[AuthCheck] Unexpected error:', error);
        
        if (autoRedirect && redirectOnFail) {
            const loginUrl = getLoginRedirect(requiredRole, redirectIfNot);
            const redirectTarget = buildRedirectUrl(loginUrl, { [redirectParam]: window.location.pathname });
            console.log('[AuthCheck] Redirecting to:', redirectTarget);
            window.location.href = redirectTarget;
            return null;
        }
        
        if (onError) onError(error);
        return null;
    }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function checkRolePermission(userRole, requiredRole, allowedRoles) {
    if (!requiredRole && !allowedRoles) return true;
    if (requiredRole) return userRole === requiredRole;
    if (allowedRoles && Array.isArray(allowedRoles)) {
        return allowedRoles.includes(userRole);
    }
    return false;
}

function getLoginRedirect(requiredRole, defaultRedirect) {
    if (requiredRole && ROLE_LOGIN_MAP[requiredRole]) {
        return ROLE_LOGIN_MAP[requiredRole];
    }
    return defaultRedirect || '/login';
}

function getRoleRedirect(userRole, defaultRedirect) {
    if (userRole && ROLE_DASHBOARD_MAP[userRole]) {
        return ROLE_DASHBOARD_MAP[userRole];
    }
    return defaultRedirect || '/login';
}

function buildRedirectUrl(baseUrl, params = {}) {
    const url = new URL(baseUrl, window.location.origin);
    for (const [key, value] of Object.entries(params)) {
        if (value) url.searchParams.set(key, value);
    }
    return url.toString();
}

async function validateTokenWithServer(token) {
    try {
        const fingerprint = await getDeviceFingerprint();
        
        const response = await fetch(`${CONFIG.apiBase}/auth/check`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-device-fingerprint': fingerprint
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.warn('[AuthCheck] Token invalid - 401');
                return false;
            }
            return false;
        }
        
        const data = await response.json();
        
        // Handle different response structures
        // Backend might return: { authenticated: true, user: {...} }
        // Or: { success: true, user: {...} }
        // Or: { valid: true, user: {...} }
        const isAuthenticated = data.authenticated === true || 
                               data.success === true || 
                               data.valid === true ||
                               (data.user && data.user.id);
        
        // If user data is returned, update it
        if (data.user && isAuthenticated) {
            auth.setUser(data.user);
        }
        
        return isAuthenticated;
    } catch (e) {
        if (CONFIG.debug) console.warn('[AuthCheck] Token validation error:', e.message);
        return false;
    }
}

async function getDeviceFingerprint() {
    try {
        const module = await import('../js/sophisticated/fraud-engine/fingerprint.js');
        return await module.getDeviceFingerprint();
    } catch (e) {
        // Fallback fingerprint
        try {
            const components = [
                navigator.userAgent,
                navigator.language,
                navigator.platform,
                screen.width,
                screen.height,
                screen.colorDepth,
                navigator.hardwareConcurrency || 4,
                new Date().getTimezoneOffset()
            ].join('|||');
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(components));
            return Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .substring(0, 32);
        } catch(err) {
            return 'fallback-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        }
    }
}

// ============================================================
// CONVENIENCE WRAPPERS
// ============================================================

export async function requireAdmin(options = {}) {
    return checkAuth({
        requiredRole: 'admin',
        redirectIfNot: '/admin-login',
        redirectIfUnauthorized: '/admin-login',
        ...options
    });
}

export async function requireStaff(options = {}) {
    return checkAuth({
        requiredRole: 'staff',
        redirectIfNot: '/staff/login',
        redirectIfUnauthorized: '/staff/login',
        ...options
    });
}

export async function requireCustomer(options = {}) {
    return checkAuth({
        requiredRole: 'customer',
        redirectIfNot: '/login',
        redirectIfUnauthorized: '/login',
        allowGuest: options.allowGuest || false,
        ...options
    });
}

export async function requireReseller(options = {}) {
    return checkAuth({
        requiredRole: 'reseller',
        redirectIfNot: '/reseller/login',
        redirectIfUnauthorized: '/reseller/login',
        ...options
    });
}

export async function requireWholesale(options = {}) {
    return checkAuth({
        requiredRole: 'wholesale',
        redirectIfNot: '/wholesale/login',
        redirectIfUnauthorized: '/wholesale/login',
        ...options
    });
}

export async function requireAnyRole(roles, options = {}) {
    return checkAuth({
        allowedRoles: roles,
        redirectIfNot: '/login',
        redirectIfUnauthorized: '/login',
        ...options
    });
}

// ============================================================
// PUBLIC PAGES
// ============================================================

export function isPublicPage() {
    const path = window.location.pathname;
    // Check exact match or starts with
    return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '?'));
}

export function isProtectedPage() {
    return !isPublicPage();
}

export function getPublicPaths() {
    return [...PUBLIC_PATHS];
}

export function addPublicPath(path) {
    if (!PUBLIC_PATHS.includes(path)) {
        PUBLIC_PATHS.push(path);
    }
}

// ============================================================
// INITIALIZATION
// ============================================================

let _initialized = false;

export async function initAuthCheck(options = {}) {
    if (_initialized && !options.force) {
        if (CONFIG.debug) console.log('[AuthCheck] Already initialized');
        return;
    }
    _initialized = true;
    
    const { autoRun = true } = options;
    
    if (!autoRun) {
        if (CONFIG.debug) console.log('[AuthCheck] Auto-run disabled');
        return;
    }
    
    if (CONFIG.debug) console.log('[AuthCheck] Initialized');
    
    // Check if current page requires auth
    const path = window.location.pathname;
    console.log('[AuthCheck] Current path:', path);
    
    // Skip auth check for public pages
    if (isPublicPage()) {
        if (CONFIG.debug) console.log('[AuthCheck] Public page, skipping auth check');
        return;
    }
    
    // Admin pages
    if (path.startsWith('/admin/') && path !== '/admin/login' && path !== '/admin-login') {
        console.log('[AuthCheck] Admin page detected, requiring admin auth');
        return requireAdmin({ autoRedirect: true });
    }
    
    // Check if the path is exactly /admin or /admin/
    if (path === '/admin' || path === '/admin/' || path === '/admin/index.html') {
        console.log('[AuthCheck] Admin dashboard detected, requiring admin auth');
        return requireAdmin({ autoRedirect: true });
    }
    
    // Staff pages
    if (path.startsWith('/staff/') && path !== '/staff/login') {
        return requireStaff({ autoRedirect: true });
    }
    
    // Reseller pages
    if (path.startsWith('/reseller/') && path !== '/reseller/login') {
        return requireReseller({ autoRedirect: true });
    }
    
    // Wholesale pages
    if (path.startsWith('/wholesale/') && path !== '/wholesale/login') {
        return requireWholesale({ autoRedirect: true });
    }
    
    // Protected customer pages
    const protectedPaths = ['/account', '/checkout', '/cart', '/orders', '/profile'];
    if (protectedPaths.some(p => path.startsWith(p))) {
        return requireCustomer({ autoRedirect: true });
    }
    
    // Any other page - just check but don't redirect
    return checkAuth({ autoRedirect: false, allowGuest: true });
}

// ============================================================
// EXPORTS
// ============================================================
export default {
    checkAuth,
    requireAdmin,
    requireStaff,
    requireCustomer,
    requireReseller,
    requireWholesale,
    requireAnyRole,
    isPublicPage,
    isProtectedPage,
    getPublicPaths,
    addPublicPath,
    initAuthCheck
};

// ============================================================
// AUTO-INITIALIZATION
// ============================================================
// Only auto-init if not explicitly disabled
const DISABLE_AUTO_INIT = document.querySelector('meta[name="disable-auth-check"]')?.content === 'true';

if (typeof document !== 'undefined' && !DISABLE_AUTO_INIT) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initAuthCheck({ autoRun: true }));
    } else {
        // Delay to avoid blocking page render
        setTimeout(() => initAuthCheck({ autoRun: true }), 100);
    }
}
