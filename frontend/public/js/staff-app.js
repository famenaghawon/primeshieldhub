// ================================================================ //
// STAFF APP - PWA Entry Point for PrimeShieldHub Staff Portal     //
// Unified authentication, PWA support, offline management         //
// ================================================================ //

import { CONFIG } from './config.js';
import { auth } from './auth.js';

// ================================================================ //
// CONFIGURATION                                                     //
// ================================================================ //

const STAFF_CONFIG = {
    API_BASE: CONFIG.apiBase,
    STORAGE_KEYS: CONFIG.STORAGE_KEYS || { 
        TOKEN: 'psh_auth_token', 
        USER: 'psh_user',
        STAFF_TOKEN: 'psh_staff_token',
        STAFF_USER: 'psh_staff_user'
    },
    PWA_INSTALL_DISMISSED_KEY: 'psh_staff_pwa_dismissed',
    AUTO_REFRESH_INTERVAL: 30000,
    MAX_RETRIES: 2,
};

// ================================================================ //
// STATE MANAGEMENT                                                  //
// ================================================================ //

class StaffAppState {
    constructor() {
        this.user = null;
        this.token = null;
        this.isOnline = navigator.onLine;
        this.isPWA = false;
        this.isInstalled = false;
        this.engagementScore = 0;
        this.visitCount = parseInt(localStorage.getItem('psh_staff_visits') || '0');
        this.lastVisit = parseInt(localStorage.getItem('psh_staff_last_visit') || Date.now());
    }

    updateUser(user) {
        this.user = user;
        if (user) {
            try {
                localStorage.setItem(STAFF_CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
                localStorage.setItem(STAFF_CONFIG.STORAGE_KEYS.STAFF_USER, JSON.stringify(user));
            } catch(e) {}
        }
    }

    updateToken(token) {
        this.token = token;
        if (token) {
            try {
                localStorage.setItem(STAFF_CONFIG.STORAGE_KEYS.TOKEN, token);
                localStorage.setItem(STAFF_CONFIG.STORAGE_KEYS.STAFF_TOKEN, token);
            } catch(e) {}
        }
    }

    incrementVisits() {
        this.visitCount++;
        localStorage.setItem('psh_staff_visits', this.visitCount);
        localStorage.setItem('psh_staff_last_visit', Date.now());
    }

    checkPWAStatus() {
        this.isPWA = window.navigator.standalone === true || 
                     window.matchMedia('(display-mode: standalone)').matches;
        this.isInstalled = this.isPWA || localStorage.getItem('psh_staff_app_installed') === 'true';
        return this.isPWA;
    }

    get isAuthenticated() {
        return !!this.token && !!this.user;
    }

    get isStaff() {
        return this.user?.role === 'staff' || this.user?.role === 'admin';
    }
}

// ================================================================ //
// AUTH HELPERS                                                     //
// ================================================================ //

function getAuthToken() {
    try {
        const token = auth.getToken ? auth.getToken() : null;
        if (token) return token;
    } catch(e) {}
    
    return localStorage.getItem(STAFF_CONFIG.STORAGE_KEYS.TOKEN) || 
           localStorage.getItem(STAFF_CONFIG.STORAGE_KEYS.STAFF_TOKEN) || 
           localStorage.getItem('psh_auth_token') || 
           localStorage.getItem('psh_staff_token') || 
           null;
}

function getUser() {
    try {
        const user = auth.getUser ? auth.getUser() : null;
        if (user) return user;
    } catch(e) {}
    
    try {
        const stored = localStorage.getItem(STAFF_CONFIG.STORAGE_KEYS.USER);
        if (stored) return JSON.parse(stored);
    } catch(e) {}
    
    try {
        const stored = localStorage.getItem(STAFF_CONFIG.STORAGE_KEYS.STAFF_USER);
        if (stored) return JSON.parse(stored);
    } catch(e) {}
    
    try {
        const stored = localStorage.getItem('psh_staff_user');
        if (stored) return JSON.parse(stored);
    } catch(e) {}
    
    return null;
}

function isStaffOrAdmin() {
    const user = getUser();
    if (!user) return false;
    return user.role === 'staff' || user.role === 'admin';
}

function logout() {
    try { if (auth.logout) auth.logout(); } catch(e) {}
    
    const keys = [
        STAFF_CONFIG.STORAGE_KEYS.TOKEN,
        STAFF_CONFIG.STORAGE_KEYS.USER,
        STAFF_CONFIG.STORAGE_KEYS.STAFF_TOKEN,
        STAFF_CONFIG.STORAGE_KEYS.STAFF_USER,
        'psh_auth_token',
        'psh_user',
        'psh_staff_token',
        'psh_staff_user',
        'psh_session',
        'psh_branch_id'
    ];
    
    keys.forEach(key => {
        try { localStorage.removeItem(key); } catch(e) {}
        try { sessionStorage.removeItem(key); } catch(e) {}
    });
    
    window.location.href = '/staff/';
}

// ================================================================ //
// API CALLS                                                         //
// ================================================================ //

async function apiCall(path, options = {}) {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    if (csrfToken && options.method && !['GET', 'HEAD'].includes(options.method)) {
        headers['x-csrf-token'] = csrfToken;
    }

    const url = path.startsWith('http') ? path : `${STAFF_CONFIG.API_BASE}${path}`;

    try {
        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include'
        });

        if (response.status === 401) {
            logout();
            throw new Error('Session expired');
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || data.message || `HTTP ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ================================================================ //
// PWA INSTALL HANDLING                                             //
// ================================================================ //

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.banner = null;
        this.installBtn = null;
        this.dismissBtn = null;
        this.isDismissed = localStorage.getItem(STAFF_CONFIG.PWA_INSTALL_DISMISSED_KEY) === 'true';
        this.isInstalled = false;
    }

    init() {
        // Check if already installed
        if (window.navigator.standalone === true || 
            window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            localStorage.setItem('psh_staff_app_installed', 'true');
            return;
        }

        // Find banner elements
        this.banner = document.getElementById('pwaInstallBanner');
        this.installBtn = document.getElementById('pwaInstallBtn');
        this.dismissBtn = document.getElementById('pwaDismissBtn');

        if (!this.banner) {
            // Create banner if not exists
            this.createBanner();
        }

        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            if (!this.isDismissed && !this.isInstalled) {
                this.showBanner();
            }
        });

        // App installed event
        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            localStorage.setItem('psh_staff_app_installed', 'true');
            this.hideBanner();
            this.showToast('✅ Staff Hub installed successfully!', 'success');
        });

        // Setup button listeners
        this.setupListeners();

        console.log('📱 PWA Manager initialized');
    }

    createBanner() {
        const bannerHTML = `
            <div class="pwa-install-banner" id="pwaInstallBanner">
                <div class="pwa-content">
                    <div class="pwa-text">
                        <span class="pwa-icon">📱</span>
                        <div>
                            <div class="pwa-title">Install Staff Hub</div>
                            <div class="pwa-desc">Get faster access to your staff dashboard</div>
                        </div>
                    </div>
                    <div class="pwa-actions">
                        <button class="pwa-btn pwa-btn-install" id="pwaInstallBtn">
                            <i class="fas fa-download"></i> Install
                        </button>
                        <button class="pwa-btn pwa-btn-dismiss" id="pwaDismissBtn">Not now</button>
                    </div>
                </div>
            </div>
        `;

        // Add styles if not present
        if (!document.querySelector('#pwa-styles')) {
            const style = document.createElement('style');
            style.id = 'pwa-styles';
            style.textContent = `
                .pwa-install-banner {
                    display:none;
                    position:fixed;
                    bottom:0;
                    left:0;
                    right:0;
                    z-index:9998;
                    background:linear-gradient(135deg,#12122a,#1a2045);
                    border-top:1px solid rgba(214,178,94,0.2);
                    padding:12px 20px;
                    backdrop-filter:blur(20px);
                    -webkit-backdrop-filter:blur(20px);
                    animation:slideUp 0.4s ease;
                }
                .pwa-install-banner.show { display:flex; }
                .pwa-install-banner .pwa-content {
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    max-width:800px;
                    margin:0 auto;
                    width:100%;
                    gap:12px;
                    flex-wrap:wrap;
                }
                .pwa-install-banner .pwa-text {
                    display:flex;
                    align-items:center;
                    gap:10px;
                    flex:1;
                    min-width:200px;
                }
                .pwa-install-banner .pwa-icon { font-size:24px; flex-shrink:0; }
                .pwa-install-banner .pwa-title {
                    font-weight:600;
                    font-size:0.85rem;
                    color:#e8edff;
                }
                .pwa-install-banner .pwa-desc {
                    font-size:0.7rem;
                    color:#9aa3d4;
                }
                .pwa-install-banner .pwa-actions {
                    display:flex;
                    gap:8px;
                    flex-wrap:wrap;
                }
                .pwa-install-banner .pwa-btn {
                    padding:8px 18px;
                    border:none;
                    border-radius:10px;
                    font-weight:600;
                    font-size:0.75rem;
                    cursor:pointer;
                    transition:all 0.3s ease;
                    font-family:'Inter',sans-serif;
                }
                .pwa-install-banner .pwa-btn-install {
                    background:linear-gradient(135deg,#d6b25e,#f3d27b);
                    color:#000;
                }
                .pwa-install-banner .pwa-btn-install:hover {
                    transform:translateY(-1px);
                    box-shadow:0 4px 15px rgba(214,178,94,0.3);
                }
                .pwa-install-banner .pwa-btn-dismiss {
                    background:rgba(255,255,255,0.05);
                    color:#9aa3d4;
                    border:1px solid rgba(255,255,255,0.08);
                }
                .pwa-install-banner .pwa-btn-dismiss:hover {
                    background:rgba(255,255,255,0.08);
                }
                @keyframes slideUp {
                    from { transform:translateY(100%); opacity:0; }
                    to { transform:translateY(0); opacity:1; }
                }
            `;
            document.head.appendChild(style);
        }

        // Append banner
        document.body.insertAdjacentHTML('beforeend', bannerHTML);
        
        // Get references
        this.banner = document.getElementById('pwaInstallBanner');
        this.installBtn = document.getElementById('pwaInstallBtn');
        this.dismissBtn = document.getElementById('pwaDismissBtn');
    }

    setupListeners() {
        if (this.installBtn) {
            this.installBtn.addEventListener('click', async () => {
                if (this.deferredPrompt) {
                    this.deferredPrompt.prompt();
                    const result = await this.deferredPrompt.userChoice;
                    if (result.outcome === 'accepted') {
                        this.isInstalled = true;
                        localStorage.setItem('psh_staff_app_installed', 'true');
                        this.hideBanner();
                    }
                    this.deferredPrompt = null;
                } else {
                    this.showInstallInstructions();
                }
            });
        }

        if (this.dismissBtn) {
            this.dismissBtn.addEventListener('click', () => {
                this.hideBanner();
                this.isDismissed = true;
                localStorage.setItem(STAFF_CONFIG.PWA_INSTALL_DISMISSED_KEY, 'true');
            });
        }
    }

    showBanner() {
        if (this.banner && !this.isDismissed && !this.isInstalled) {
            this.banner.classList.add('show');
        }
    }

    hideBanner() {
        if (this.banner) {
            this.banner.classList.remove('show');
        }
    }

    showInstallInstructions() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
            alert('📱 To install Staff Hub:\n\n' +
                  '1. Tap the Share button (⬆️)\n' +
                  '2. Scroll down and tap "Add to Home Screen"\n' +
                  '3. Tap "Add" in the top right corner');
        } else {
            alert('📱 To install Staff Hub:\n\n' +
                  '1. Open Chrome browser\n' +
                  '2. Tap the menu (⋮) in the top right\n' +
                  '3. Select "Install App" or "Add to Home Screen"');
        }
    }

    showToast(message, type = 'info') {
        const colors = {
            success: '#33ffaa',
            error: '#ff3366',
            warning: '#ffaa33',
            info: '#00f7ff'
        };

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #12122a;
            color: #fff;
            padding: 14px 28px;
            border-radius: 12px;
            border-left: 4px solid ${colors[type] || '#ffd700'};
            box-shadow: 0 8px 30px rgba(0,0,0,0.5);
            z-index: 99999;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            max-width: 90%;
            animation: slideUp 0.3s ease;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.05);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// ================================================================ //
// STAFF APP MAIN CLASS                                             //
// ================================================================ //

class StaffApp {
    constructor() {
        this.state = new StaffAppState();
        this.pwa = new PWAManager();
        this.initialized = false;
        this.refreshInterval = null;
    }

    async init() {
        if (this.initialized) return;

        console.log('🚀 Initializing Staff App...');

        // Check PWA status
        this.state.checkPWAStatus();

        // Initialize PWA manager
        this.pwa.init();

        // Check authentication
        const token = getAuthToken();
        const user = getUser();

        if (token && user) {
            this.state.updateToken(token);
            this.state.updateUser(user);
            this.state.incrementVisits();
        }

        // Set up network listeners
        this.setupNetworkListeners();

        // Set up auth listeners
        this.setupAuthListeners();

        this.initialized = true;

        console.log('✅ Staff App initialized');
        console.log('📱 PWA Mode:', this.state.isPWA);
        console.log('🔐 Authenticated:', this.state.isAuthenticated);
        console.log('👤 User:', this.state.user?.name || 'Not logged in');

        // Emit event
        document.dispatchEvent(new CustomEvent('staff-app-ready', {
            detail: { state: this.state }
        }));

        return this.state;
    }

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.state.isOnline = true;
            this.showToast('🟢 Connection restored', 'success');
            document.dispatchEvent(new CustomEvent('staff-app-online'));
        });

        window.addEventListener('offline', () => {
            this.state.isOnline = false;
            this.showToast('🔴 You are offline. Some features may be unavailable.', 'error');
            document.dispatchEvent(new CustomEvent('staff-app-offline'));
        });
    }

    setupAuthListeners() {
        // Listen for auth changes
        window.addEventListener('storage', (e) => {
            if (e.key === STAFF_CONFIG.STORAGE_KEYS.TOKEN || 
                e.key === STAFF_CONFIG.STORAGE_KEYS.STAFF_TOKEN) {
                const newToken = e.newValue;
                if (newToken !== this.state.token) {
                    this.state.updateToken(newToken);
                    document.dispatchEvent(new CustomEvent('staff-app-auth-change', {
                        detail: { token: newToken }
                    }));
                }
            }

            if (e.key === STAFF_CONFIG.STORAGE_KEYS.USER || 
                e.key === STAFF_CONFIG.STORAGE_KEYS.STAFF_USER) {
                try {
                    const newUser = e.newValue ? JSON.parse(e.newValue) : null;
                    if (JSON.stringify(newUser) !== JSON.stringify(this.state.user)) {
                        this.state.updateUser(newUser);
                        document.dispatchEvent(new CustomEvent('staff-app-auth-change', {
                            detail: { user: newUser }
                        }));
                    }
                } catch(e) {}
            }
        });
    }

    // ===== STAFF PUSH NOTIFICATIONS =====
    async registerPushNotifications() {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            console.log('[Staff] Push notifications not supported');
            return { supported: false };
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('[Staff] Push permission denied');
                return { supported: true, subscribed: false };
            }

            const registration = await navigator.serviceWorker.ready;
            const existingSubscription = await registration.pushManager.getSubscription();

            if (existingSubscription) {
                console.log('[Staff] Already subscribed to push');
                return { supported: true, subscribed: true };
            }

            // Get VAPID key
            const configRes = await fetch('/api/config/public');
            const config = await configRes.json();
            const vapidPublicKey = config.vapidPublicKey;

            if (!vapidPublicKey) {
                console.warn('[Staff] VAPID public key not configured');
                return { supported: true, subscribed: false };
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
            });

            // Save subscription with staff flag
            const token = getAuthToken();
            const userId = this.state.user?.id || null;

            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: btoa(String.fromCharCode.apply(null, 
                            new Uint8Array(subscription.getKey('p256dh')))),
                        auth: btoa(String.fromCharCode.apply(null, 
                            new Uint8Array(subscription.getKey('auth'))))
                    },
                    userId: userId,
                    staff: true,  // Mark as staff subscription
                    role: 'staff'
                })
            });

            console.log('[Staff] Push notifications registered');
            return { supported: true, subscribed: true };

        } catch (error) {
            console.error('[Staff] Push registration error:', error);
            return { supported: true, subscribed: false, error: error.message };
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    // ===== UTILITY METHODS =====
    showToast(message, type = 'info') {
        const colors = {
            success: '#33ffaa',
            error: '#ff3366',
            warning: '#ffaa33',
            info: '#00f7ff'
        };

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #12122a;
            color: #fff;
            padding: 14px 28px;
            border-radius: 12px;
            border-left: 4px solid ${colors[type] || '#ffd700'};
            box-shadow: 0 8px 30px rgba(0,0,0,0.5);
            z-index: 99999;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            max-width: 90%;
            animation: slideUp 0.3s ease;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.05);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ===== CLEANUP =====
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.initialized = false;
    }
}

// ================================================================ //
// EXPORTS & SINGLETON INSTANCE                                     //
// ================================================================ //

let staffAppInstance = null;

function getStaffApp() {
    if (!staffAppInstance) {
        staffAppInstance = new StaffApp();
    }
    return staffAppInstance;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = getStaffApp();
        app.init();
    });
} else {
    const app = getStaffApp();
    app.init();
}

// Export for module usage
export { 
    StaffApp, 
    StaffAppState, 
    PWAManager, 
    getStaffApp, 
    staffAppInstance,
    getAuthToken,
    getUser,
    isStaffOrAdmin,
    logout,
    apiCall
};

// Make available globally
window.StaffApp = getStaffApp;
window.getAuthToken = getAuthToken;
window.getUser = getUser;
window.isStaffOrAdmin = isStaffOrAdmin;
window.logout = logout;

console.log('📦 Staff App module loaded successfully');
