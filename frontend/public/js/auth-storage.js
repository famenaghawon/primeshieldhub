// ============================================================================
// public../js/auth-storage.js - Centralized Auth Storage v3.1
// Role-based session storage with CONFIG integration and event emission
// FIXED: Unified token storage - ALL roles use psh_auth_token
// FIXED: Added session ID detection and logging
// FIXED: Admin user stored in psh_admin_user for backward compatibility
// ============================================================================

// CONFIG from window
const CONFIG = window.CONFIG || window.PSH_CONFIG || {};
// bus from window
const bus = window.bus || null;
const Events = window.Events || {};

// ===== CONFIG =====
const STORAGE_KEYS = CONFIG.STORAGE_KEYS || {
    TOKEN: 'psh_auth_token',
    USER: 'psh_user',
};

// ===== ROLE KEY MAP - FIXED: All roles use psh_auth_token =====
const KEY_MAP = {
    admin: {
        token: 'psh_auth_token',      // ← FIXED: Use same token for all
        user: 'psh_admin_user',        // ← Admin user stored separately
        expiry: 'psh_token_expiry'
    },
    staff: {
        token: 'psh_auth_token',      // ← FIXED: Use same token for all
        user: 'psh_staff_user',
        expiry: 'psh_token_expiry'
    },
    franchise: {
        token: 'psh_auth_token',      // ← FIXED: Use same token for all
        user: 'psh_franchise_user',
        expiry: 'psh_token_expiry'
    },
    reseller: {
        token: 'psh_auth_token',      // ← FIXED: Use same token for all
        user: 'psh_reseller_user',
        expiry: 'psh_token_expiry'
    },
    customer: {
        token: 'psh_auth_token',
        user: 'psh_user',
        expiry: 'psh_token_expiry'
    },
    user: {
        token: 'psh_auth_token',
        user: 'psh_user',
        expiry: 'psh_token_expiry'
    }
};

// ===== DEFAULT ROLE =====
const DEFAULT_ROLE = 'customer';

// ============================================================
// TOKEN TYPE DETECTION HELPERS
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
// AUTH STORAGE CLASS
// ============================================================

class AuthStorageManager {
    constructor() {
        this._listeners = [];
        this._currentSession = null;
        this._init();
    }

    _init() {
        // Listen for storage events from other tabs
        window.addEventListener('storage', (e) => {
            const role = this._detectRoleFromKey(e.key);
            if (role) {
                this._notifyListeners();
            }
        });
    }

    // ===== KEY HELPERS =====
    _getKeys(role) {
        const validRole = KEY_MAP[role] ? role : DEFAULT_ROLE;
        return KEY_MAP[validRole];
    }

    _detectRoleFromKey(key) {
        if (!key) return null;
        for (const [role, keys] of Object.entries(KEY_MAP)) {
            if (Object.values(keys).includes(key)) {
                return role;
            }
        }
        return null;
    }

    // ===== SESSION MANAGEMENT =====
    /**
     * Saves the token and user data using role-specific localStorage keys.
     * FIXED: All roles use psh_auth_token for the token
     * @param {string} token - The authentication token (session ID from backend).
     * @param {object} user - The user object (must contain a 'role' property).
     * @param {number} [expiry] - Optional expiry timestamp in milliseconds.
     */
    saveSession(token, user, expiry = null) {
        if (!user || !user.role) {
            console.error('[AuthStorage] User object with role is required to save session.');
            return false;
        }

        const keys = this._getKeys(user.role);
        
        // Log token type for debugging
        const tokenType = getTokenType(token);
        console.log('[AuthStorage] Saving token type:', tokenType);
        console.log('[AuthStorage] Token preview:', token ? token.substring(0, 20) + '...' : 'null');
        
        if (tokenType === 'jwt') {
            console.warn('[AuthStorage] ⚠️ Saving JWT token - backend expects session ID!');
            console.warn('[AuthStorage] This may cause authentication issues.');
        } else if (tokenType === 'session_id') {
            console.log('[AuthStorage] ✅ Saving session ID - correct format!');
        }
        
        try {
            // Save token to unified key
            localStorage.setItem(keys.token, token);
            
            // Save user to role-specific key
            localStorage.setItem(keys.user, JSON.stringify(user));
            
            // Also save to generic user key for backward compatibility
            if (user.role === 'admin' || user.role === 'staff') {
                localStorage.setItem('psh_user', JSON.stringify(user));
            }
            
            // Save expiry
            const defaultExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
            const finalExpiry = expiry || defaultExpiry;
            localStorage.setItem(keys.expiry, String(finalExpiry));
            
            // Also save expiry to generic key
            localStorage.setItem('psh_token_expiry', String(finalExpiry));

            this._currentSession = { token, user, expiry: finalExpiry };
            this._notifyListeners();

            // Emit event
            if (bus?.emit) {
                bus.emit(Events.AUTH_STORAGE_CHANGED, {
                    role: user.role,
                    token,
                    user
                });
            }

            console.log('[AuthStorage] ✅ Session saved for role:', user.role);
            console.log('[AuthStorage] Token stored in:', keys.token);
            return true;
        } catch (e) {
            console.error('[AuthStorage] Save failed:', e);
            return false;
        }
    }

    /**
     * Retrieves the session based on the current role or by checking all possible keys.
     * @param {string} [role] - Optional. The expected role.
     * @param {boolean} [validate] - Whether to validate token expiry.
     * @returns {{ token: string|null, user: object|null, expiry: number|null }}
     */
    getSession(role = null, validate = true) {
        // Return cached if available and not expired
        if (this._currentSession && !role) {
            if (!validate || !this._isExpired(this._currentSession.expiry)) {
                return this._currentSession;
            }
        }

        // First try the unified token approach
        const unifiedToken = localStorage.getItem('psh_auth_token');
        if (unifiedToken) {
            // Try to find user for this token
            let user = null;
            let roleFound = null;
            
            // Check admin user first
            const adminUserStr = localStorage.getItem('psh_admin_user');
            if (adminUserStr) {
                try {
                    user = JSON.parse(adminUserStr);
                    if (user && user.role === 'admin') {
                        roleFound = 'admin';
                    }
                } catch(e) {}
            }
            
            // If not admin, check regular user
            if (!user) {
                const userStr = localStorage.getItem('psh_user');
                if (userStr) {
                    try {
                        user = JSON.parse(userStr);
                        if (user && user.role) {
                            roleFound = user.role;
                        }
                    } catch(e) {}
                }
            }
            
            // If still no user, check role-specific keys
            if (!user) {
                const roles = Object.keys(KEY_MAP);
                for (const r of roles) {
                    const keys = this._getKeys(r);
                    const userStr = localStorage.getItem(keys.user);
                    if (userStr) {
                        try {
                            user = JSON.parse(userStr);
                            if (user && user.role) {
                                roleFound = r;
                                break;
                            }
                        } catch(e) {}
                    }
                }
            }
            
            if (user && user.role) {
                const expiry = localStorage.getItem('psh_token_expiry');
                const session = { 
                    token: unifiedToken, 
                    user: user, 
                    expiry: expiry ? parseInt(expiry) : null 
                };
                
                if (validate && this._isExpired(session.expiry)) {
                    this.clearSession(user.role);
                    return { token: null, user: null, expiry: null };
                }
                
                this._currentSession = session;
                return session;
            }
        }

        // Fallback: Check role-specific keys
        let keys;
        let token, user, expiry;

        if (role) {
            keys = this._getKeys(role);
            token = localStorage.getItem(keys.token);
            const userStr = localStorage.getItem(keys.user);
            expiry = localStorage.getItem(keys.expiry);
            
            if (token && userStr) {
                try {
                    user = JSON.parse(userStr);
                    if (validate && this._isExpired(expiry)) {
                        this.clearSession(role);
                        return { token: null, user: null, expiry: null };
                    }
                    this._currentSession = { token, user, expiry: expiry ? parseInt(expiry) : null };
                    return this._currentSession;
                } catch (e) {
                    this.clearSession(role);
                    return { token: null, user: null, expiry: null };
                }
            }
            return { token: null, user: null, expiry: null };
        }

        // No specific role, check all known role keys (priority order)
        const searchOrder = ['admin', 'staff', 'franchise', 'reseller', 'user', 'customer'];
        for (const r of searchOrder) {
            const session = this.getSession(r, validate);
            if (session.token && session.user) {
                console.log('[AuthStorage] Found session for role:', r);
                return session;
            }
        }

        console.log('[AuthStorage] No session found');
        return { token: null, user: null, expiry: null };
    }

    /**
     * Gets the current user without the token
     */
    getUser() {
        const session = this.getSession();
        return session.user || null;
    }

    /**
     * Gets the current token
     */
    getToken() {
        // First try unified token
        const token = localStorage.getItem('psh_auth_token');
        if (token) {
            const tokenType = getTokenType(token);
            if (tokenType === 'session_id') {
                console.log('[AuthStorage] ✅ Found session ID token');
            } else if (tokenType === 'jwt') {
                console.warn('[AuthStorage] ⚠️ Found JWT token - this may cause issues');
            }
            return token;
        }
        
        // Fallback to session
        const session = this.getSession();
        return session.token || null;
    }

    /**
     * Gets the current role
     */
    getRole() {
        const session = this.getSession();
        return session.user?.role || null;
    }

    /**
     * Checks if a session is expired
     */
    _isExpired(expiry) {
        if (!expiry) return false;
        return Date.now() > parseInt(expiry);
    }

    /**
     * Clears the session for a specific role.
     * @param {string} role - The role to clear.
     */
    clearSession(role) {
        const keys = this._getKeys(role);
        localStorage.removeItem(keys.token);
        localStorage.removeItem(keys.user);
        localStorage.removeItem(keys.expiry);
        
        // Also clear generic keys if this is the active role
        if (this._currentSession?.user?.role === role) {
            localStorage.removeItem('psh_user');
            localStorage.removeItem('psh_token_expiry');
            this._currentSession = null;
        }
        
        this._notifyListeners();
        
        if (bus?.emit) {
            bus.emit(Events.AUTH_STORAGE_CHANGED, {
                role,
                cleared: true
            });
        }
        
        console.log('[AuthStorage] Session cleared for role:', role);
    }

    /**
     * Clears all known PrimeShieldHub sessions.
     */
    clearAllSessions() {
        const roles = Object.keys(KEY_MAP);
        for (const role of roles) {
            this.clearSession(role);
        }
        
        // Also clear legacy keys just in case
        localStorage.removeItem('psh_auth_token');
        localStorage.removeItem('psh_user');
        localStorage.removeItem('psh_admin_user');
        localStorage.removeItem('psh_token');
        localStorage.removeItem('psh_token_expiry');
        
        this._currentSession = null;
        this._notifyListeners();
        
        if (bus?.emit) {
            bus.emit(Events.AUTH_STORAGE_CHANGED, { cleared: true, all: true });
        }
        
        console.log('[AuthStorage] All sessions cleared.');
    }

    /**
     * Updates the user data for the current session
     */
    updateUser(user) {
        if (!user) {
            this.clearAllSessions();
            return false;
        }
        
        const session = this.getSession(user.role, false);
        if (!session.token) {
            console.warn('[AuthStorage] No session found for role:', user.role);
            return false;
        }
        
        return this.saveSession(session.token, user, session.expiry);
    }

    /**
     * Refreshes the token for the current session
     */
    refreshToken(newToken, expiry = null) {
        const session = this.getSession(null, false);
        if (!session.user) {
            console.warn('[AuthStorage] No session to refresh');
            return false;
        }
        
        return this.saveSession(newToken, session.user, expiry);
    }

    /**
     * Gets the current session expiry
     */
    getExpiry() {
        const session = this.getSession();
        return session.expiry || null;
    }

    /**
     * Checks if the current session is expired
     */
    isExpired() {
        const session = this.getSession(null, false);
        return this._isExpired(session.expiry);
    }

    /**
     * Gets the time remaining in milliseconds
     */
    getTimeRemaining() {
        const expiry = this.getExpiry();
        if (!expiry) return 0;
        return Math.max(0, expiry - Date.now());
    }

    // ===== LISTENER MANAGEMENT =====
    addListener(callback) {
        this._listeners.push(callback);
        // Immediately call with current state
        setTimeout(() => {
            try {
                callback(this.getSession());
            } catch (e) {
                console.warn('[AuthStorage] Listener error:', e);
            }
        }, 0);
        return () => {
            const index = this._listeners.indexOf(callback);
            if (index !== -1) this._listeners.splice(index, 1);
        };
    }

    _notifyListeners() {
        const session = this.getSession();
        this._listeners.forEach(callback => {
            try {
                callback(session);
            } catch (e) {
                console.warn('[AuthStorage] Listener error:', e);
            }
        });
    }

    // ===== DEBUG HELPERS =====
    /**
     * Debug the current token
     */
    debugToken() {
        const token = this.getToken();
        console.log('🔍 [AuthStorage] Token debug:');
        console.log('  Token:', token);
        if (token) {
            console.log('  Length:', token.length);
            console.log('  Type:', getTokenType(token));
            console.log('  Is JWT?', isJWTToken(token) ? 'YES' : 'NO');
            console.log('  Is Session ID?', isSessionId(token) ? 'YES' : 'NO');
            console.log('  Expired?', this.isExpired() ? 'YES' : 'NO');
        } else {
            console.log('  No token found');
        }
        return token;
    }

    /**
     * Gets all active sessions (for debugging)
     */
    getAllSessions() {
        const sessions = {};
        const roles = Object.keys(KEY_MAP);
        for (const role of roles) {
            const session = this.getSession(role, false);
            if (session.token) {
                sessions[role] = {
                    token: session.token.substring(0, 20) + '...',
                    tokenType: getTokenType(session.token),
                    user: session.user,
                    expiry: session.expiry ? new Date(session.expiry).toISOString() : null
                };
            }
        }
        return sessions;
    }

    /**
     * Gets storage stats (for debugging)
     */
    getStats() {
        let totalKeys = 0;
        let totalSize = 0;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('psh_')) {
                totalKeys++;
                totalSize += (key.length + (localStorage.getItem(key)?.length || 0));
            }
        }
        
        const token = this.getToken();
        return {
            totalKeys,
            totalSize: Math.round(totalSize / 1024) + 'KB',
            activeSession: !!token,
            tokenType: getTokenType(token),
            role: this.getRole()
        };
    }
}

// ===== SINGLETON INSTANCE =====
const AuthStorage = new AuthStorageManager();

// ===== GLOBAL EXPOSURE (for backward compatibility) =====
if (typeof window !== 'undefined') {
    window.AuthStorage = AuthStorage;
    
    // Legacy functions for backward compatibility
    window.AuthStorage.saveSession = AuthStorage.saveSession.bind(AuthStorage);
    window.AuthStorage.getSession = AuthStorage.getSession.bind(AuthStorage);
    window.AuthStorage.clearSession = AuthStorage.clearSession.bind(AuthStorage);
    window.AuthStorage.clearAllSessions = AuthStorage.clearAllSessions.bind(AuthStorage);
    window.AuthStorage.debugToken = AuthStorage.debugToken.bind(AuthStorage);
    
    console.log('🔐 AuthStorage v3.1 initialized');
    console.log('💡 Run AuthStorage.debugToken() to check current token');
}

// ===== EXPORTS =====
export { AuthStorage };

// ===== DEFAULT EXPORT =====
export default AuthStorage;
