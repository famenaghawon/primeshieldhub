// ============================================================================
// public../js/sophisticated/fraud-engine/fingerprint.js
// Enterprise Device Fingerprint Engine v11.4.3
// Combines canvas, WebGL, audio, and font fingerprint with HMAC signing
// FIXED: Uses CONFIG from config.js, event bus integration
// ============================================================================

import { CONFIG } from '../../config.js';
import { bus, Events } from '../../events.js';
import { auth } from '../../auth.js';

// ==================== CONSTANTS ====================
const FINGERPRINT_CACHE_KEY = 'psh_device_fp_full';
const FINGERPRINT_HASH_KEY = 'psh_device_fp_hash';
const FINGERPRINT_CACHE_TIME_KEY = 'psh_device_fp_time';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const VERSION = '2.1';

const API_BASE = CONFIG.apiBase;

// ==================== SAFE COLLECTION HELPER ====================
async function safeCollect(fn, fallback = '') {
  try {
    const result = await fn();
    return result !== undefined && result !== null ? result : fallback;
  } catch (e) {
    if (CONFIG.debug) {
      console.warn('[Fingerprint] Component collection failed:', e.message);
    }
    return fallback;
  }
}

// ==================== CRYPTOGRAPHIC HELPERS ====================
async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSign(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ==================== FINGERPRINT COLLECTION ====================
async function collectComponents() {
  const components = {
    basic: [],
    canvas: '',
    webgl: '',
    audio: '',
    fonts: '',
    additional: []
  };

  // ---- BASIC BROWSER COMPONENTS ----
  components.basic = [
    navigator.userAgent || '',
    navigator.language || '',
    navigator.platform || '',
    String(navigator.hardwareConcurrency || ''),
    String(navigator.deviceMemory || ''),
    String(navigator.maxTouchPoints || ''),
    String(new Date().getTimezoneOffset()),
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth || ''),
    String(screen.pixelDepth || ''),
    `${screen.availWidth}x${screen.availHeight}`,
    String(window.devicePixelRatio || '')
  ];

  // ---- CANVAS FINGERPRINT ----
  components.canvas = await safeCollect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'canvas-unsupported';
    canvas.width = 280;
    canvas.height = 60;
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 280, 60);
    ctx.fillStyle = '#069';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('PrimeShieldHub', 10, 25);
    ctx.fillStyle = '#0f0';
    ctx.font = 'italic 12px "Times New Roman", serif';
    ctx.fillText('Quantum • Secure • Trust', 10, 45);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 270, 50);
    ctx.beginPath();
    ctx.arc(250, 30, 10, 0, 2 * Math.PI);
    ctx.fillStyle = '#f00';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(30, 30, 8, 0, Math.PI);
    ctx.fillStyle = '#ff0';
    ctx.fill();
    return canvas.toDataURL();
  }, 'canvas-error');

  // ---- WEBGL FINGERPRINT ----
  components.webgl = await safeCollect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'webgl-unsupported';
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      return `${gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)}|${gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)}|${gl.getParameter(gl.VERSION)}`;
    }
    return `${gl.getParameter(gl.VENDOR)}|${gl.getParameter(gl.RENDERER)}|${gl.getParameter(gl.VERSION)}`;
  }, 'webgl-error');

  // ---- AUDIO FINGERPRINT ----
  components.audio = await safeCollect(async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return 'audio-unsupported';
    const context = new AudioContext();
    const sampleRate = context.sampleRate;
    const channelCount = context.destination.channelCount;
    const baseLatency = context.baseLatency || 0;
    const oscillator = context.createOscillator();
    const analyser = context.createAnalyser();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, context.currentTime);
    oscillator.connect(analyser);
    analyser.connect(context.destination);
    oscillator.start(0);
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    const freqSum = freqData.reduce((a, b) => a + b, 0);
    oscillator.stop(0);
    oscillator.disconnect();
    analyser.disconnect();
    context.close();
    return `${sampleRate}|${channelCount}|${baseLatency.toFixed(4)}|${freqSum}`;
  }, 'audio-error');

  // ---- FONT FINGERPRINT ----
  components.fonts = await safeCollect(() => {
    const fontList = ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Palatino', 'Garamond', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact', 'Tahoma', 'Lucida Console', 'Monaco', 'Segoe UI', 'Helvetica'];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    ctx.font = `${testSize} monospace`;
    const baselineWidth = ctx.measureText(testString).width;
    const available = [];
    fontList.forEach(font => {
      ctx.font = `${testSize} "${font}", monospace`;
      if (ctx.measureText(testString).width !== baselineWidth) {
        available.push(font);
      }
    });
    return available.join(',');
  }, 'font-error');

  // ---- ADDITIONAL COMPONENTS ----
  components.additional = [
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    navigator.languages?.join(',') || '',
    String('ontouchstart' in window),
    String(navigator.cookieEnabled)
  ];

  return components;
}

// ==================== CONFIDENCE CALCULATION ====================
function calculateConfidence(components) {
  let score = 0;
  if (components.canvas && components.canvas !== 'canvas-error') score += 30;
  if (components.webgl && !components.webgl.includes('unsupported') && !components.webgl.includes('error')) score += 30;
  if (components.audio && !components.audio.includes('error') && !components.audio.includes('unsupported')) score += 15;
  if (components.fonts && !components.fonts.includes('error') && components.fonts.split(',').length > 3) score += 10;
  if (components.basic && components.basic[3] && components.basic[3] !== '0') score += 10;
  if (components.basic && components.basic[4] && components.basic[4] !== '0') score += 5;
  return Math.min(score, 100);
}

// ==================== CACHE MANAGEMENT ====================
function getCachedFingerprint() {
  try {
    const cached = localStorage.getItem(FINGERPRINT_CACHE_KEY);
    const cacheTime = localStorage.getItem(FINGERPRINT_CACHE_TIME_KEY);
    if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < CACHE_TTL) {
      const parsed = JSON.parse(cached);
      if (parsed.hash && parsed.timestamp && parsed.confidence !== undefined) {
        return parsed;
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

function cacheFingerprint(fingerprint) {
  try {
    localStorage.setItem(FINGERPRINT_CACHE_KEY, JSON.stringify(fingerprint));
    localStorage.setItem(FINGERPRINT_HASH_KEY, fingerprint.hash);
    localStorage.setItem(FINGERPRINT_CACHE_TIME_KEY, Date.now().toString());
  } catch (e) {
    if (CONFIG.debug) {
      console.warn('[Fingerprint] Cache write failed:', e);
    }
  }
}

// ==================== MAIN EXPORT FUNCTIONS ====================

/**
 * PRIMARY FUNCTION: Returns the device fingerprint hash string.
 * Used by: auth.js, api-client.js
 */
export async function getDeviceFingerprint(serverSalt = null) {
  // Check cache first
  const cachedHash = localStorage.getItem(FINGERPRINT_HASH_KEY);
  const cacheTime = localStorage.getItem(FINGERPRINT_CACHE_TIME_KEY);
  
  if (cachedHash && cacheTime && (Date.now() - parseInt(cacheTime)) < CACHE_TTL) {
    if (serverSalt) {
      return await sha256(cachedHash + serverSalt);
    }
    return cachedHash;
  }

  // Generate new fingerprint
  const components = await collectComponents();
  const rawString = `v${VERSION}|${components.basic.join('|')}|${components.canvas}|${components.webgl}|${components.audio}|${components.fonts}|${components.additional.join('|')}`;
  const hash = await sha256(rawString);

  const fingerprint = {
    hash,
    components,
    confidence: calculateConfidence(components),
    timestamp: Date.now(),
    version: VERSION
  };

  cacheFingerprint(fingerprint);

  if (CONFIG.debug) {
    console.log('[Fingerprint] Generated:', hash.substring(0, 16) + '...', 'Confidence:', fingerprint.confidence + '%');
  }

  // Emit event
  if (bus?.emit) {
    bus.emit(Events.FINGERPRINT_READY, {
      hash: fingerprint.hash,
      confidence: fingerprint.confidence,
      timestamp: fingerprint.timestamp
    });
  }

  if (serverSalt) {
    return await sha256(hash + serverSalt);
  }
  return hash;
}

/**
 * Returns the complete fingerprint object
 */
export async function getAdvancedFingerprint() {
  const cached = getCachedFingerprint();
  if (cached) return cached;
  
  const components = await collectComponents();
  const rawString = `v${VERSION}|${components.basic.join('|')}|${components.canvas}|${components.webgl}|${components.audio}|${components.fonts}|${components.additional.join('|')}`;
  const hash = await sha256(rawString);
  
  const fingerprint = {
    hash,
    components,
    confidence: calculateConfidence(components),
    timestamp: Date.now(),
    version: VERSION
  };
  
  cacheFingerprint(fingerprint);
  return fingerprint;
}

/**
 * Synchronous version - returns cached hash if available
 */
export function getDeviceFingerprintSync() {
  try {
    const hash = localStorage.getItem(FINGERPRINT_HASH_KEY);
    const cacheTime = localStorage.getItem(FINGERPRINT_CACHE_TIME_KEY);
    if (hash && cacheTime && (Date.now() - parseInt(cacheTime)) < CACHE_TTL) {
      return hash;
    }
  } catch (e) { /* ignore */ }
  return null;
}

/**
 * Force regeneration of fingerprint
 */
export async function refreshDeviceFingerprint() {
  localStorage.removeItem(FINGERPRINT_CACHE_KEY);
  localStorage.removeItem(FINGERPRINT_HASH_KEY);
  localStorage.removeItem(FINGERPRINT_CACHE_TIME_KEY);
  
  // Clear any stored fingerprint in auth
  try {
    if (auth && auth.clearToken) {
      auth.clearToken();
    }
  } catch (e) { /* ignore */ }
  
  return getDeviceFingerprint();
}

/**
 * Sign a fingerprint with HMAC for server verification
 */
export async function signDeviceFingerprint(fingerprint, key) {
  return hmacSign(key, fingerprint);
}

/**
 * Verify fingerprint with the Worker endpoint
 */
export async function verifyFingerprint() {
  try {
    const fp = await getDeviceFingerprint();
    const token = auth.getToken ? auth.getToken() : null;
    
    const response = await fetch(`${API_BASE}/verify-browser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': fp,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      credentials: 'include',
      body: JSON.stringify({ 
        fingerprint: fp, 
        timestamp: Date.now(),
        sessionId: sessionStorage.getItem('psh_session_id') || null
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const isValid = data.valid || false;
      
      if (bus?.emit) {
        bus.emit(Events.FINGERPRINT_VERIFIED, { valid: isValid });
      }
      
      return isValid;
    }
    return false;
  } catch (e) {
    if (CONFIG.debug) {
      console.warn('[Fingerprint] Server verification failed:', e);
    }
    return false;
  }
}

/**
 * Clear fingerprint cache
 */
export function clearFingerprintCache() {
  localStorage.removeItem(FINGERPRINT_CACHE_KEY);
  localStorage.removeItem(FINGERPRINT_HASH_KEY);
  localStorage.removeItem(FINGERPRINT_CACHE_TIME_KEY);
  
  if (CONFIG.debug) {
    console.log('[Fingerprint] Cache cleared');
  }
}

/**
 * Get fingerprint stats
 */
export function getFingerprintStats() {
  const cached = getCachedFingerprint();
  return {
    exists: !!cached,
    hash: cached?.hash || null,
    confidence: cached?.confidence || null,
    age: cached?.timestamp ? Date.now() - cached.timestamp : null,
    version: cached?.version || null,
    ttl: CACHE_TTL
  };
}

// ==================== WINDOW/LEGACY EXPORTS ====================
// For compatibility with non-module scripts

if (typeof window !== 'undefined') {
  window.getDeviceFingerprint = getDeviceFingerprint;
  window.getDeviceFingerprintSync = getDeviceFingerprintSync;
  window.refreshDeviceFingerprint = refreshDeviceFingerprint;
  window.signDeviceFingerprint = signDeviceFingerprint;
  window.verifyFingerprint = verifyFingerprint;
  window.getFingerprint = getDeviceFingerprint;
  window.signFingerprint = signDeviceFingerprint;
  window.clearFingerprintCache = clearFingerprintCache;
  window.getFingerprintStats = getFingerprintStats;

  // For client-api.js compatibility
  window.DeviceFingerprinter = {
    getFingerprint: getDeviceFingerprint,
    init: async () => {
      if (CONFIG.debug) {
        console.log('[DeviceFingerprinter] Initialized');
      }
      return getDeviceFingerprint();
    },
    clearCache: clearFingerprintCache,
    getStats: getFingerprintStats
  };
}

// ==================== AUTO-INITIALIZATION ====================
let autoInitialized = false;

export function disableAutoInit() {
  autoInitialized = true;
}

async function preInitFingerprint() {
  if (autoInitialized) return;
  autoInitialized = true;
  
  try {
    const hash = await getDeviceFingerprint();
    window.__psh_device_fingerprint = hash;
    
    if (CONFIG.debug && hash && hash.length > 16) {
      console.log('[PrimeShieldHub] Fingerprint ready:', hash.substring(0, 16) + '...');
    }
  } catch (e) {
    if (CONFIG.debug) {
      console.warn('[PrimeShieldHub] Fingerprint preload failed:', e.message);
    }
    window.__psh_device_fingerprint = 'fallback-' + Date.now();
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preInitFingerprint);
  } else {
    preInitFingerprint();
  }
}

// ==================== EXPORTS ====================
export default {
  getDeviceFingerprint,
  getAdvancedFingerprint,
  getDeviceFingerprintSync,
  refreshDeviceFingerprint,
  signDeviceFingerprint,
  verifyFingerprint,
  clearFingerprintCache,
  getFingerprintStats,
  disableAutoInit
};
