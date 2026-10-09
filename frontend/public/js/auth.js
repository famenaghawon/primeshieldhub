// ============================================================================
// auth.js – PrimeShieldHub Unified Authentication Module v3.5
// ============================================================================
// FIXED: _isRestoring blocking getUser() from returning stored user
// FIXED: setUser() silent return preventing auth state notifications
// FIXED: Added auth:ready event for dependent modules
// FIXED: Race condition in initAuth where user wasn't available immediately
// ============================================================================

import { CONFIG } from './config.js';

// ===== CONFIG =====
const API_BASE = CONFIG.apiBase || 'https://api.primeshieldhub.com/api';

// FIXED: Handle CONFIG.STORAGE_KEYS safely with fallbacks
const STORAGE_KEYS = CONFIG.STORAGE_KEYS || {};
const TOKEN_KEY = STORAGE_KEYS.TOKEN || CONFIG.TOKEN_KEY || CONFIG.TOKEN || 'psh_auth_token';
const USER_KEY = STORAGE_KEYS.USER || CONFIG.USER_KEY || 'psh_user';
const ADMIN_USER_KEY = STORAGE_KEYS.ADMIN_USER || 'psh_admin_user';
const TOKEN_EXPIRY_KEY = 'psh_token_expiry';
const SESSION_KEY = STORAGE_KEYS.SESSION || 'psh_session';

// ===== STATE =====
let currentUser = null;
let authToken = null;
let tokenExpiry = null;
let authChangeListeners = [];
let _settingUser = false;
let _lastUserString = null;
let _initialized = false;
let _refreshTimeout = null;
let _isRestoring = false;
let _restorePromise = null;  // FIXED: Track restore promise to prevent parallel restores
let _authReady = false;       // FIXED: Flag to indicate auth is fully ready

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

export function getToken() {
    // 1. Return in-memory token if available
    if (authToken) {
        if (isTokenExpired()) {
            clearToken();
            return null;
        }
        return authToken;
    }
    
    // 2. Try to get from AuthStorage first
    try {
        if (window.AuthStorage && window.AuthStorage.getSession) {
            const session = window.AuthStorage.getSession();
            if (session && session.token) {
                authToken = session.token;
                tokenExpiry = session.expiry || null;
                if (isTokenExpired()) {
                    clearToken();
                    return null;
                }
                // Also restore user if available
                if (session.user && !currentUser) {
                    currentUser = session.user;
                    _lastUserString = JSON.stringify(currentUser);
                }
                return authToken;
            }
        }
    } catch(e) {}
    
    // 3. Fallback to localStorage
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        authToken = token;
        tokenExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY) || null;
        if (isTokenExpired()) {
            clearToken();
            return null;
        }
        return token;
    }
    
    // 4. Check sessionStorage
    const sessionToken = sessionStorage.getItem(TOKEN_KEY);
    if (sessionToken) {
        authToken = sessionToken;
        return authToken;
    }
    
    // 5. Check cookie
    const cookieMatch = document.cookie.match(/(^|;\s*)auth=([^;]+)/);
    if (cookieMatch) {
        authToken = cookieMatch[2];
        return authToken;
    }
    
    return null;
}

export function setToken(token, expiry = null) {
    authToken = token;
    tokenExpiry = expiry;
    
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        sessionStorage.setItem(TOKEN_KEY, token);
        if (expiry) {
            localStorage.setItem(TOKEN_EXPIRY_KEY, expiry);
        } else {
            const defaultExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
            localStorage.setItem(TOKEN_EXPIRY_KEY, String(defaultExpiry));
        }
        
        // Also save to AuthStorage if available
        try {
            if (window.AuthStorage && window.AuthStorage.saveSession) {
                const user = getUser();
                window.AuthStorage.saveSession(token, user);
            }
        } catch(e) {}
    } else {
        clearToken();
    }
}

export function clearToken() {
    authToken = null;
    tokenExpiry = null;
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    try {
        if (window.AuthStorage && window.AuthStorage.clearAllSessions) {
            window.AuthStorage.clearAllSessions();
        }
    } catch(e) {}
}

export function isTokenExpired() {
    if (!tokenExpiry) {
        const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
        if (storedExpiry) {
            tokenExpiry = storedExpiry;
        } else {
            return false;
        }
    }
    return Date.now() > parseInt(tokenExpiry);
}

export function getTokenExpiry() {
    return tokenExpiry || localStorage.getItem(TOKEN_EXPIRY_KEY) || null;
}

// ============================================================
// TOKEN TYPE DETECTION
// ============================================================

export function isJWTToken(token) {
    if (!token) return false;
    return token.includes('.') && token.startsWith('eyJ');
}

export function isSessionId(token) {
    if (!token) return false;
    return !token.includes('.') && !token.startsWith('eyJ') && token.length < 100;
}

export function debugTokenInfo() {
    const token = getToken();
    console.log('🔍 Token debug:');
    console.log('  Token:', token);
    if (token) {
        console.log('  Length:', token.length);
        console.log('  Is JWT?', isJWTToken(token) ? 'YES' : 'NO');
        console.log('  Is Session ID?', isSessionId(token) ? 'YES' : 'NO');
        console.log('  Expired?', isTokenExpired() ? 'YES' : 'NO');
    } else {
        console.log('  No token found');
    }
    return token;
}

// ============================================================
// USER MANAGEMENT - FIXED: Better restoration, no blocking
// ============================================================

export function getUser() {
    // If we already have user in memory, return it
    if (currentUser) return currentUser;
    
    // Try to restore from storage (non-blocking)
    return restoreUserFromStorage();
}

function restoreUserFromStorage() {
    // FIXED: If already restoring, return whatever we have (don't block)
    // BUT if we have a valid user from a previous restore, return it
    if (_isRestoring && currentUser) {
        return currentUser;
    }
    
    // FIXED: If we're restoring but have no user, wait briefly
    // but DON'T return null - try to read from storage directly
    if (_isRestoring && !currentUser) {
        // Direct read from storage as fallback
        return readUserDirectly();
    }
    
    _isRestoring = true;
    
    try {
        // 1. Try AuthStorage first
        try {
            if (window.AuthStorage && window.AuthStorage.getSession) {
                const session = window.AuthStorage.getSession();
                if (session && session.user) {
                    currentUser = session.user;
                    _lastUserString = JSON.stringify(currentUser);
                    _authReady = true;
                    return currentUser;
                }
            }
        } catch(e) {}
        
        // 2. Try localStorage
        const storedUser = localStorage.getItem(USER_KEY);
        if (storedUser) {
            try {
                currentUser = JSON.parse(storedUser);
                _lastUserString = storedUser;
                _authReady = true;
                return currentUser;
            } catch(e) {
                localStorage.removeItem(USER_KEY);
            }
        }
        
        // 3. Try sessionStorage
        const sessionUser = sessionStorage.getItem(USER_KEY);
        if (sessionUser) {
            try {
                currentUser = JSON.parse(sessionUser);
                _lastUserString = sessionUser;
                _authReady = true;
                return currentUser;
            } catch(e) {
                sessionStorage.removeItem(USER_KEY);
            }
        }
    } finally {
        _isRestoring = false;
    }
    
    return null;
}

/**
 * FIXED: Direct read from storage without setting _isRestoring
 * Used as fallback when _isRestoring is true but we need a user
 */
function readUserDirectly() {
    try {
        // Try localStorage directly
        const storedUser = localStorage.getItem(USER_KEY);
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                // Update in-memory state too
                currentUser = user;
                _lastUserString = storedUser;
                return user;
            } catch(e) {}
        }
        
        // Try sessionStorage
        const sessionUser = sessionStorage.getItem(USER_KEY);
        if (sessionUser) {
            try {
                const user = JSON.parse(sessionUser);
                currentUser = user;
                _lastUserString = sessionUser;
                return user;
            } catch(e) {}
        }
    } catch(e) {}
    
    return null;
}

export function setUser(user) {
    if (_settingUser) {
        console.warn('[Auth] setUser recursion blocked');
        return;
    }
    
    const userString = JSON.stringify(user);
    
    // FIXED: Only skip if user is exactly the same AND we already have it set
    // But still notify listeners if this is a fresh login
    if (userString === _lastUserString && currentUser) {
        // Same user, but if _authReady isn't set yet, this might be a restoration
        if (!_authReady && user) {
            console.log('[Auth] User restored, marking auth as ready');
            _authReady = true;
            // Still notify listeners for restoration
            notifyAuthListeners(user);
        }
        return;
    }
    _lastUserString = userString;
    
    _settingUser = true;
    try {
        currentUser = user;
        
        if (user) {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            sessionStorage.setItem(USER_KEY, JSON.stringify(user));
            // Also save admin user separately
            if (user.role === 'admin') {
                localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
            }
            try {
                if (window.AuthStorage && window.AuthStorage.saveSession) {
                    const token = getToken();
                    window.AuthStorage.saveSession(token, user);
                }
            } catch(e) {}
            
            // FIXED: Mark auth as ready when user is set
            _authReady = true;
        } else {
            localStorage.removeItem(USER_KEY);
            sessionStorage.removeItem(USER_KEY);
            _authReady = false;
        }
        
        // FIXED: Always notify listeners when user changes
        notifyAuthListeners(user);
        
    } finally {
        _settingUser = false;
    }
}

/**
 * FIXED: Centralized auth listener notification
 */
function notifyAuthListeners(user) {
    // Dispatch DOM event immediately
    try {
        window.dispatchEvent(new CustomEvent('psh:auth:changed', { 
            detail: user 
        }));
    } catch(e) {}
    
    // Also dispatch auth:ready if this is the first time
    if (_authReady && user) {
        try {
            window.dispatchEvent(new CustomEvent('auth:ready', { 
                detail: { user, token: getToken() }
            }));
        } catch(e) {}
    }
    
    // Notify module listeners
    setTimeout(() => {
        authChangeListeners.forEach(cb => {
            try { cb(user); } catch (e) { 
                console.warn('Auth listener error:', e); 
            }
        });
    }, 0);
}

// ============================================================
// AUTH STATE LISTENER
// ============================================================

export function onAuthStateChanged(callback) {
    authChangeListeners.push(callback);
    
    // Immediately call with current state
    setTimeout(() => {
        try { 
            const user = getUser();
            callback(user); 
        } catch (e) { 
            console.warn('Auth listener immediate call error:', e); 
        }
    }, 0);
    
    return () => {
        const index = authChangeListeners.indexOf(callback);
        if (index !== -1) authChangeListeners.splice(index, 1);
    };
}

// ============================================================
// CSRF TOKEN
// ============================================================

async function getCSRFToken() {
    try {
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta && meta.content) {
            return meta.content;
        }
        
        const response = await fetch(`${API_BASE}/auth/csrf`, {
            credentials: 'include',
            headers: {
                'x-device-fingerprint': await getDeviceFingerprint()
            }
        });
        
        if (response.ok) {
            const token = await response.text();
            const metaTag = document.querySelector('meta[name="csrf-token"]');
            if (metaTag) metaTag.setAttribute('content', token);
            return token;
        }
    } catch(e) {
        console.warn('[Auth] CSRF fetch failed:', e);
    }
    return null;
}

// ============================================================
// INIT - FIXED: Proper restoration with ready event
// ============================================================

export function initAuth() {
    if (_initialized) return;
    _initialized = true;
    
    console.log('[Auth] Initializing...');
    
    // FIXED: Restore user BEFORE token (user is more important for UI)
    const user = restoreUserFromStorage();
    
    // Restore token (checks expiry)
    const token = getToken();
    
    // FIXED: If we have both user and token, mark as ready immediately
    if (user && token) {
        _authReady = true;
        console.log('[Auth] Restored session for:', user.email);
    }
    
    // If token exists but no user, try to fetch user
    if (token && !user) {
        console.log('[Auth] Token found but no user, fetching...');
        fetchCurrentUser().then(fetchedUser => {
            if (fetchedUser) {
                console.log('[Auth] User fetched successfully:', fetchedUser.email);
                setUser(fetchedUser);
                _authReady = true;
                dispatchReadyEvent();
            }
        }).catch(e => {
            console.warn('[Auth] Failed to fetch user:', e);
        });
    }
    
    // FIXED: Notify listeners immediately (don't wait for setTimeout)
    const currentUserValue = getUser();
    authChangeListeners.forEach(cb => {
        try { cb(currentUserValue); } catch (e) { 
            console.warn('Auth init listener error:', e); 
        }
    });
    
    // Dispatch events
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('psh:auth:changed', { 
            detail: getUser()
        }));
        
        // FIXED: Dispatch auth:ready event for dependent modules
        if (_authReady) {
            dispatchReadyEvent();
        }
    }, 0);
    
    // Schedule token refresh if token exists
    if (authToken && !isTokenExpired()) {
        scheduleTokenRefresh();
    }
    
    console.log('[Auth] Initialized. User:', getUser()?.email || 'Guest', '| Token:', !!getToken());
}

/**
 * FIXED: Dispatch auth:ready event
 */
function dispatchReadyEvent() {
    try {
        window.dispatchEvent(new CustomEvent('auth:ready', { 
            detail: { 
                user: currentUser, 
                token: getToken() 
            }
        }));
        console.log('[Auth] Dispatched auth:ready event');
    } catch(e) {
        console.warn('[Auth] Failed to dispatch auth:ready:', e);
    }
}

// ============================================================
// TOKEN REFRESH
// ============================================================

function scheduleTokenRefresh() {
    if (_refreshTimeout) {
        clearTimeout(_refreshTimeout);
        _refreshTimeout = null;
    }
    
    if (!authToken || isTokenExpired()) return;
    
    const expiry = parseInt(tokenExpiry || localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
    const now = Date.now();
    const timeUntilExpiry = expiry - now;
    
    const refreshAt = Math.max(0, timeUntilExpiry - (5 * 60 * 1000));
    
    if (refreshAt > 0) {
        _refreshTimeout = setTimeout(async () => {
            try {
                await refreshToken();
            } catch(e) {
                console.warn('[Auth] Token refresh failed:', e);
            }
        }, refreshAt);
    }
}

async function refreshToken() {
    const token = getToken();
    if (!token) return;
    
    try {
        const fingerprint = await getDeviceFingerprint();
        const csrfToken = await getCSRFToken();
        
        const response = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-device-fingerprint': fingerprint,
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify({ 
                csrf: csrfToken 
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            const newToken = data.sessionId || data.session || data.token;
            if (newToken) {
                setToken(newToken, data.expiry);
                scheduleTokenRefresh();
                return true;
            }
        }
    } catch(e) {
        console.warn('[Auth] Refresh failed:', e);
    }
    return false;
}

// ============================================================
// LOGIN
// ============================================================

export async function login(email, password) {
    try {
        const fingerprint = await getDeviceFingerprint();
        const csrfToken = await getCSRFToken();
        
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-device-fingerprint': fingerprint,
                'x-csrf-token': csrfToken || ''
            },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        
        if (response.status === 429) {
            throw new Error('Too many login attempts. Please wait a moment.');
        }
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Login failed');
        }
        
        const data = await response.json();
        
        console.log('🔍 Login response in auth.js:', data);
        
        // Get token from multiple locations
        const sessionId = data.sessionId || data.session || data.token || data.data?.token || null;
        
        // Save session with session ID
        if (sessionId && data.user) {
            console.log('🔑 Storing session ID in auth.js:', sessionId);
            
            authToken = sessionId;
            currentUser = data.user;
            _lastUserString = JSON.stringify(data.user);
            _authReady = true;  // FIXED: Mark as ready
            
            const expiry = data.expiry || Date.now() + (7 * 24 * 60 * 60 * 1000);
            tokenExpiry = String(expiry);
            
            // Save to localStorage and sessionStorage
            localStorage.setItem(TOKEN_KEY, sessionId);
            sessionStorage.setItem(TOKEN_KEY, sessionId);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
            if (data.user.role === 'admin') {
                localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(data.user));
            }
            localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
            
            // Save to AuthStorage
            try {
                if (window.AuthStorage && window.AuthStorage.saveSession) {
                    window.AuthStorage.saveSession(sessionId, data.user);
                }
            } catch(e) {}
            
            // Schedule token refresh
            scheduleTokenRefresh();
            
            // FIXED: Dispatch events immediately
            notifyAuthListeners(data.user);
            dispatchReadyEvent();
            
            return data;
        } else if (sessionId) {
            setToken(sessionId);
        } else if (data.user) {
            setUser(data.user);
        }
        
        return data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// ============================================================
// ADMIN LOGIN
// ============================================================

export async function adminLogin(email, password) {
    try {
        const fingerprint = await getDeviceFingerprint();
        const csrfToken = await getCSRFToken();
        
        const response = await fetch(`${API_BASE}/auth/admin-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-device-fingerprint': fingerprint,
                'x-csrf-token': csrfToken || ''
            },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        
        if (response.status === 429) {
            throw new Error('Too many login attempts. Please wait a moment.');
        }
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Admin login failed');
        }
        
        const data = await response.json();
        
        const sessionId = data.sessionId || data.session || data.token || data.data?.token || null;
        
        if (sessionId && data.user) {
            authToken = sessionId;
            currentUser = data.user;
            _lastUserString = JSON.stringify(data.user);
            _authReady = true;
            
            const expiry = data.expiry || Date.now() + (7 * 24 * 60 * 60 * 1000);
            tokenExpiry = String(expiry);
            
            localStorage.setItem(TOKEN_KEY, sessionId);
            sessionStorage.setItem(TOKEN_KEY, sessionId);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
            localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(data.user));
            localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
            
            try {
                if (window.AuthStorage && window.AuthStorage.saveSession) {
                    window.AuthStorage.saveSession(sessionId, data.user);
                }
            } catch(e) {}
            
            scheduleTokenRefresh();
            notifyAuthListeners(data.user);
            dispatchReadyEvent();
            
            return data;
        } else if (sessionId) {
            setToken(sessionId);
        } else if (data.user) {
            setUser(data.user);
        }
        
        return data;
    } catch (error) {
        console.error('Admin login error:', error);
        throw error;
    }
}

// ============================================================
// REGISTER
// ============================================================

export async function register(email, password, name = null) {
    try {
        const fingerprint = await getDeviceFingerprint();
        const csrfToken = await getCSRFToken();
        
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-device-fingerprint': fingerprint,
                'x-csrf-token': csrfToken || ''
            },
            credentials: 'include',
            body: JSON.stringify({ 
                email, 
                password, 
                name: name || email.split('@')[0] 
            })
        });
        
        if (response.status === 429) {
            throw new Error('Too many registration attempts. Please wait a moment.');
        }
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Registration failed');
        }
        
        const data = await response.json();
        
        const sessionId = data.sessionId || data.session || data.token || data.data?.token || null;
        
        if (sessionId && data.user) {
            authToken = sessionId;
            currentUser = data.user;
            _lastUserString = JSON.stringify(data.user);
            _authReady = true;
            
            const expiry = data.expiry || Date.now() + (7 * 24 * 60 * 60 * 1000);
            tokenExpiry = String(expiry);
            
            localStorage.setItem(TOKEN_KEY, sessionId);
            sessionStorage.setItem(TOKEN_KEY, sessionId);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
            localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
            
            try {
                if (window.AuthStorage && window.AuthStorage.saveSession) {
                    window.AuthStorage.saveSession(sessionId, data.user);
                }
            } catch(e) {}
            
            scheduleTokenRefresh();
            notifyAuthListeners(data.user);
            dispatchReadyEvent();
        } else if (sessionId) {
            setToken(sessionId);
        } else if (data.user) {
            setUser(data.user);
        }
        
        return data;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

// ============================================================
// ADMIN REGISTER
// ============================================================

export async function adminRegister(name, email, phone, password, adminCode) {
    try {
        const fingerprint = await getDeviceFingerprint();
        const csrfToken = await getCSRFToken();
        
        const response = await fetch(`${API_BASE}/auth/admin-register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-device-fingerprint': fingerprint,
                'x-csrf-token': csrfToken || ''
            },
            credentials: 'include',
            body: JSON.stringify({ name, email, phone, password, adminCode })
        });
        
        if (response.status === 429) {
            throw new Error('Too many registration attempts. Please wait a moment.');
        }
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Admin registration failed');
        }
        
        const data = await response.json();
        
        const sessionId = data.sessionId || data.session || data.token || data.data?.token || null;
        
        if (sessionId && data.user) {
            authToken = sessionId;
            currentUser = data.user;
            _lastUserString = JSON.stringify(data.user);
            _authReady = true;
            
            const expiry = data.expiry || Date.now() + (7 * 24 * 60 * 60 * 1000);
            tokenExpiry = String(expiry);
            
            localStorage.setItem(TOKEN_KEY, sessionId);
            sessionStorage.setItem(TOKEN_KEY, sessionId);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
            localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(data.user));
            localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
            
            try {
                if (window.AuthStorage && window.AuthStorage.saveSession) {
                    window.AuthStorage.saveSession(sessionId, data.user);
                }
            } catch(e) {}
            
            scheduleTokenRefresh();
            notifyAuthListeners(data.user);
            dispatchReadyEvent();
        } else if (sessionId) {
            setToken(sessionId);
        } else if (data.user) {
            setUser(data.user);
        }
        
        return data;
    } catch (error) {
        console.error('Admin registration error:', error);
        throw error;
    }
}

// ============================================================
// LOGOUT
// ============================================================

export async function logout() {
    const token = getToken();
    
    try {
        if (token) {
            const csrfToken = await getCSRFToken();
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-csrf-token': csrfToken || ''
                }
            });
        }
    } catch (e) {
        console.warn('Logout request failed:', e);
    }
    
    // Clear state
    authToken = null;
    currentUser = null;
    _lastUserString = null;
    tokenExpiry = null;
    _authReady = false;
    
    if (_refreshTimeout) {
        clearTimeout(_refreshTimeout);
        _refreshTimeout = null;
    }
    
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    
    try {
        if (window.AuthStorage && window.AuthStorage.clearAllSessions) {
            window.AuthStorage.clearAllSessions();
        }
    } catch(e) {}
    
    notifyAuthListeners(null);
}

// ============================================================
// FETCH CURRENT USER
// ============================================================

export async function fetchCurrentUser() {
    const token = getToken();
    if (!token) return null;
    
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-device-fingerprint': await getDeviceFingerprint()
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                clearToken();
                setUser(null);
            }
            return null;
        }
        
        const data = await response.json();
        
        let user = data;
        if (data.success && data.user) {
            user = data.user;
        } else if (data.data && data.data.user) {
            user = data.data.user;
        } else if (data.user) {
            user = data.user;
        }
        
        setUser(user);
        return user;
    } catch (e) {
        console.error('Fetch user failed:', e);
        return null;
    }
}

// ============================================================
// CHECK AUTH
// ============================================================

export async function checkAuth() {
    const token = getToken();
    if (!token) return { authenticated: false };
    
    try {
        const response = await fetch(`${API_BASE}/auth/check`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-device-fingerprint': await getDeviceFingerprint()
            },
            credentials: 'include'
        });
        
        if (!response.ok) return { authenticated: false };
        
        const data = await response.json();
        
        if (data.user) {
            setUser(data.user);
        } else if (data.data && data.data.user) {
            setUser(data.data.user);
        }
        
        return data;
    } catch (e) {
        return { authenticated: false };
    }
}

// ============================================================
// DEVICE FINGERPRINT HELPERS
// ============================================================

async function getDeviceFingerprint() {
    try {
        try {
            const fingerprintModule = await import('../js/sophisticated/fraud-engine/fingerprint.js');
            if (fingerprintModule && typeof fingerprintModule.getDeviceFingerprint === 'function') {
                return await fingerprintModule.getDeviceFingerprint();
            }
        } catch(e) {
            // Module not available, use fallback
        }
        
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
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex.substring(0, 32);
    } catch(err) {
        return 'fallback-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    }
}

// ============================================================
// API REQUEST HELPER
// ============================================================

export async function apiRequest(endpoint, options = {}) {
    const { method = 'GET', body, requireAuth = true } = options;
    
    const headers = new Headers(options.headers || {});
    
    if (body && !(body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    
    const fingerprint = await getDeviceFingerprint();
    headers.set('x-device-fingerprint', fingerprint);
    
    if (requireAuth) {
        const token = getToken();
        if (!token) throw new Error('Not authenticated');
        headers.set('Authorization', `Bearer ${token}`);
    }
    
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    
    const fetchOptions = {
        method,
        headers,
        credentials: 'include'
    };
    
    if (body) {
        if (body instanceof FormData) {
            fetchOptions.body = body;
        } else if (body instanceof URLSearchParams) {
            fetchOptions.body = body;
        } else {
            fetchOptions.body = JSON.stringify(body);
        }
    }
    
    const response = await fetch(url, fetchOptions);
    
    if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment.');
    }
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || err.message || `API error: ${response.status}`);
    }
    
    return response.json();
}

// ============================================================
// EXPORTS
// ============================================================

export const auth = {
    get currentUser() { return getUser(); },
    getToken,
    setToken,
    clearToken,
    getUser,
    setUser,
    onAuthStateChanged,
    initAuth,
    login,
    adminLogin,
    register,
    adminRegister,
    logout,
    fetchCurrentUser,
    checkAuth,
    apiRequest,
    isTokenExpired,
    getTokenExpiry,
    refreshToken,
    isJWTToken,
    isSessionId,
    debugTokenInfo,
    restoreUserFromStorage,
    isAuthReady: () => _authReady  // FIXED: Expose auth ready state
};

// ============================================================
// AUTO-INITIALIZE
// ============================================================
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initAuth();
        });
    } else {
        initAuth();
    }
}

// Expose globally
if (typeof window !== 'undefined') {
    window.auth = auth;
    window.Auth = auth;
    window.debugTokenInfo = auth.debugTokenInfo;
    console.log('🔐 Unified Auth Module v3.5 initialized');
    console.log('💡 Run debugTokenInfo() to check current token');
}

// ============================================================
// EXPORT DEFAULT
// ============================================================
export default auth;
