// ============================================================================
// smart-charge.js — PrimeShieldHub Smart Charge OS v12.1
// FULLY LIVE: All operations call real API endpoints, zero simulation
// FIXED: Unified config, auth, and storage keys
// ============================================================================

import { CONFIG } from '../js/config.js';
import { auth } from '../js/auth.js';

// ===== UNIFIED CONFIG =====
const API_BASE = CONFIG.apiBase;
const STORAGE_KEYS = CONFIG.STORAGE_KEYS;
const TOKEN_KEY = STORAGE_KEYS.TOKEN;

// ===== AUTH HELPERS =====
function getAuthToken() {
  try {
    // Try unified auth first
    const token = auth.getToken ? auth.getToken() : null;
    if (token) return token;
  } catch (e) {
    console.debug('Auth module not available, using legacy auth');
  }
  
  // Fallback: check meta tag and localStorage
  try {
    const meta = document.querySelector('meta[name="auth-token"]');
    if (meta?.content) return meta.content;
  } catch {}
  
  // Legacy keys
  return localStorage.getItem(STORAGE_KEYS.TOKEN) || 
         localStorage.getItem('psh_staff_token') || 
         localStorage.getItem('psh_auth_token') || 
         null;
}

function getBranchId() {
  try {
    return localStorage.getItem('psh_branch_id') || 'branch-hq';
  } catch { 
    return 'branch-hq'; 
  }
}

function getStaffId() {
  try {
    const user = auth.getUser ? auth.getUser() : null;
    if (user && user.id) return user.id;
  } catch {}
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    if (stored) {
      const user = JSON.parse(stored);
      if (user.id) return user.id;
    }
  } catch {}
  
  return null;
}

// ===== API CALL WITH AUTH CHECK =====
async function apiCall(endpoint, method = 'GET', body = null) {
  const token = getAuthToken();
  
  // If endpoint requires auth and no token, throw
  const requiresAuth = !endpoint.includes('/public/') && 
                       !endpoint.includes('/auth/') &&
                       !endpoint.includes('/config/');
  
  if (requiresAuth && !token) {
    throw new Error('Authentication required. Please login.');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'x-branch-id': getBranchId(),
    'x-staff-id': getStaffId() || ''
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { 
    method, 
    headers, 
    credentials: 'include' 
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    
    // Handle 401 - Unauthorized
    if (res.status === 401) {
      // Clear invalid token
      try {
        if (auth.logout) auth.logout();
      } catch(e) {}
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      throw new Error('Session expired. Please login again.');
    }
    
    // Handle 404 - Not Found
    if (res.status === 404) {
      throw new Error(`Endpoint not found: ${endpoint}`);
    }
    
    // Parse response
    let data;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = { success: false, message: await res.text() };
    }
    
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}: ${res.statusText}`);
    }
    
    return data;
  } catch (error) {
    console.error(`API Error [${method} ${endpoint}]:`, error);
    throw error;
  }
}

// ================================================================ //
// CHARGING OPERATIONS                                              //
// ================================================================ //

/**
 * Start a new charging session — calls POST /api/charging/start
 */
async function startSession(formData) {
  const staffId = getStaffId();
  
  const body = {
    name: formData.customerName,
    deviceType: formData.deviceType || 'phone',
    deviceModel: formData.deviceModel || formData.deviceType,
    batteryStart: parseInt(formData.batteryStart) || 0,
    cableType: formData.cableType || 'USB-C',
    customerPhone: formData.customerPhone || null,
    customerEmail: formData.customerEmail || null,
    amount: formData.amount ? parseInt(formData.amount) : null,
    notes: formData.notes || '',
    specialHandling: formData.specialHandling || false,
    staff: staffId || formData.staffId || null,
    branchId: formData.branchId || getBranchId()
  };
  
  // Validate required fields
  if (!body.name) {
    throw new Error('Customer name is required');
  }
  
  return await apiCall('/charging/start', 'POST', body);
}

/**
 * Get all active sessions — calls GET /api/charging/timer
 */
async function getActiveSessions(status = 'active') {
  return await apiCall(`/charging/timer?status=${status}`);
}

/**
 * Get all sessions with optional filters
 */
async function getAllSessions(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  
  const query = params.toString() ? `?${params.toString()}` : '';
  return await apiCall(`/charging/sessions${query}`);
}

/**
 * Get single session — calls GET /api/charging/session/:id
 */
async function getSession(sessionId) {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }
  return await apiCall(`/charging/session/${sessionId}`);
}

/**
 * Pause a session — calls POST /api/charging/pause
 */
async function pauseSession(sessionId, reason = '') {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }
  return await apiCall('/charging/pause', 'POST', { sessionId, reason });
}

/**
 * Resume a session — calls POST /api/charging/resume
 */
async function resumeSession(sessionId) {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }
  return await apiCall('/charging/resume', 'POST', { sessionId });
}

/**
 * Mark session as ready — calls POST /api/charging/ready
 */
async function markReady(sessionId) {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }
  return await apiCall('/charging/ready', 'POST', { sessionId });
}

/**
 * Complete session & collect payment — calls POST /api/charging/complete
 */
async function completeSession(sessionId, amount, paymentMethod = 'cash', notes = '') {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }
  if (!amount || amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  
  return await apiCall('/charging/complete', 'POST', {
    sessionId,
    amount: parseInt(amount),
    paymentMethod,
    notes
  });
}

/**
 * Get charging stats — calls GET /api/charging/stats
 */
async function getChargingStats(period = 'today') {
  return await apiCall(`/charging/stats?period=${period}`);
}

/**
 * Get bay status — calls GET /api/charging/bays
 */
async function getBays() {
  return await apiCall('/charging/bays');
}

/**
 * Assign a bay — calls POST /api/staff/bays/assign
 */
async function assignBay(sessionId, bayId) {
  if (!sessionId || !bayId) {
    throw new Error('Session ID and Bay ID are required');
  }
  return await apiCall('/charging/assign-bay', 'POST', { sessionId, bayId });
}

/**
 * Release a bay — calls POST /api/staff/bays/release
 */
async function releaseBay(bayId) {
  if (!bayId) {
    throw new Error('Bay ID is required');
  }
  return await apiCall('/charging/release-bay', 'POST', { bayId });
}

// ================================================================ //
// WEBSOCKET / REAL-TIME UPDATES (if available)                    //
// ================================================================ //

let wsConnection = null;
let wsListeners = [];

/**
 * Connect to WebSocket for real-time updates
 */
function connectWebSocket(sessionId) {
  if (!sessionId) {
    console.warn('Session ID required for WebSocket connection');
    return;
  }
  
  // Close existing connection
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
  
  try {
    // WebSocket URL (if your backend supports it)
    const wsUrl = `wss://api.primeshieldhub.com/ws/charging/${sessionId}`;
    wsConnection = new WebSocket(wsUrl);
    
    wsConnection.onopen = () => {
      console.log('🔌 WebSocket connected for session:', sessionId);
    };
    
    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        wsListeners.forEach(callback => callback(data));
      } catch (e) {
        console.warn('WebSocket message parse error:', e);
      }
    };
    
    wsConnection.onerror = (error) => {
      console.warn('WebSocket error:', error);
    };
    
    wsConnection.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        if (wsConnection && wsConnection.readyState === WebSocket.CLOSED) {
          connectWebSocket(sessionId);
        }
      }, 5000);
    };
  } catch (e) {
    console.warn('WebSocket not available:', e);
  }
}

/**
 * Subscribe to real-time updates
 */
function subscribeToUpdates(callback) {
  wsListeners.push(callback);
  return () => {
    wsListeners = wsListeners.filter(cb => cb !== callback);
  };
}

/**
 * Disconnect WebSocket
 */
function disconnectWebSocket() {
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
  wsListeners = [];
}

// ================================================================ //
// EXPORTS                                                          //
// ================================================================ //

export {
  // Main operations
  startSession,
  getActiveSessions,
  getAllSessions,
  getSession,
  pauseSession,
  resumeSession,
  markReady,
  completeSession,
  getChargingStats,
  getBays,
  assignBay,
  releaseBay,
  
  // Real-time
  connectWebSocket,
  disconnectWebSocket,
  subscribeToUpdates,
  
  // Utilities
  apiCall,
  getAuthToken,
  getBranchId,
  getStaffId,
  
  // Constants
  API_BASE
};

// Export as ChargeAPI for convenience
export const ChargeAPI = {
  startSession,
  getActiveSessions,
  getAllSessions,
  getSession,
  pauseSession,
  resumeSession,
  markReady,
  completeSession,
  getChargingStats,
  getBays,
  assignBay,
  releaseBay,
  connectWebSocket,
  disconnectWebSocket,
  subscribeToUpdates,
  getAuthToken,
  getBranchId,
  getStaffId
};

// Global access
if (typeof window !== 'undefined') {
  window.ChargeAPI = ChargeAPI;
  window.ChargeAPI_BASE = API_BASE;
  console.log('⚡ Smart Charge OS v12.1 — LIVE MODE (Unified Config)');
  console.log('📍 API:', API_BASE);
  console.log('🔐 Auth: Using unified config');
}
