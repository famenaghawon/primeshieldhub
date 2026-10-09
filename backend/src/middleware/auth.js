// ==================== AUTHENTICATION MIDDLEWARE ====================
// JWT + Session ID auth — D1-backed sessions v13.4
// FIXED: created_at + createdAt both populated for schema compatibility
// FIXED: Added crypto.randomUUID fallback for older Workers runtimes
// FIXED: authenticate() now handles BOTH JWT tokens AND session IDs
// FIXED: Better error handling throughout
// FIXED: Added debug logging to trace authentication flow
// FIXED: Session expiry check uses correct field types (seconds vs ms)
// ============================================================================

import { parseCookies, validateString } from '../utils/validation.js';
import { verifyJWT, safeCompare, hashUserAgent, generateJWT } from '../utils/crypto.js';
import { getSession } from './rate-limit.js';
import { verifySignature } from '../utils/crypto.js';

/**
 * Generate a UUID v4 compatible string
 * Works on all Workers runtime versions
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function createSession(env, userId, role, fingerprint, ip) {
  const jti = generateUUID();
  const now = Math.floor(Date.now() / 1000);       // Unix seconds
  const nowMs = now * 1000;                         // Unix milliseconds
  const expiresAt = now + 86400;                    // +24 hours in seconds
  const expiresAtMs = expiresAt * 1000;             // +24 hours in milliseconds

  const payload = {
    id: userId,
    role: role,
    fp: fingerprint || 'none',
    jti: jti,
    iat: now,
    exp: expiresAt
  };

  const token = await generateJWT(payload, env.GATEWAY_SECRET || env.JWT_SECRET);

  const sessionData = JSON.stringify({
    userId,
    role,
    fingerprint: fingerprint || 'none',
    ip,
    createdAt: now,
    expiresAt
  });

  // INSERT with both timestamp columns for schema compatibility
  // created_at → Unix seconds | createdAt → Unix milliseconds
  try {
    await env.DB.prepare(`
      INSERT INTO sessions (
        jti, user_id, role, fingerprint, ip, session_data, 
        created_at, expires_at, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      jti, 
      userId, 
      role, 
      fingerprint || 'none', 
      ip, 
      sessionData,
      now,            // created_at  (Unix seconds)
      expiresAtMs,    // expires_at  (Unix milliseconds)
      nowMs           // createdAt   (Unix milliseconds)
    ).run();
    
    console.log(`[Session] Created session ${jti} for user ${userId} (role: ${role})`);
  } catch (e) {
    console.error('[Session] D1 write failed:', e.message, e.cause || '');
  }

  // Also write to KV as fallback (store JSON with expiry in seconds for easy lookup)
  try {
    await env.RATE_LIMITER.put(`session:${jti}`, sessionData, { expirationTtl: 86400 });
    await env.RATE_LIMITER.put(`user_session:${userId}`, jti, { expirationTtl: 86400 });
    console.log(`[Session] KV backup written for session ${jti}`);
  } catch (e) {
    console.error('[Session] KV write failed (non-critical):', e.message);
  }

  return { token, jti };
}

export async function authenticate(request, env) {
  try {
    let token = null;
    
    // 1. Check Authorization header first
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    
    // 2. Check cookies
    if (!token) {
      const cookieHeader = request.headers.get("Cookie") || "";
      const cookies = parseCookies(cookieHeader);
      token = cookies["__Host-auth"] || cookies.auth || cookies.session;
    }
    
    if (!token) {
      console.log('[Auth] No token provided in request');
      return { authenticated: false, error: "No token provided" };
    }

    console.log(`[Auth] Token received - length: ${token.length}, has dots: ${token.includes('.')}, starts with eyJ: ${token.startsWith('eyJ')}`);

    // ============================================================
    // FIXED: Handle BOTH JWT tokens AND session IDs
    // JWTs: long (>100 chars), contain dots, start with "eyJ"
    // Session IDs: short (<100 chars), no dots, alphanumeric
    // ============================================================
    
    let payload = null;
    let isSessionId = false;
    
    if (token.length > 100 && token.includes('.') && token.startsWith('eyJ')) {
      // It's a JWT - verify cryptographically
      console.log(`[Auth] Detected JWT token (length: ${token.length})`);
      payload = await verifyJWT(token, env.GATEWAY_SECRET || env.JWT_SECRET);
      if (!payload) {
        console.warn(`[Auth] JWT verification FAILED for token starting: ${token.substring(0, 30)}...`);
        return { authenticated: false, error: "Invalid JWT token" };
      }
      console.log(`[Auth] JWT verified - user: ${payload.id}, role: ${payload.role}, jti: ${payload.jti}`);
    } else if (token.length < 100 && !token.includes('.')) {
      // It's a session ID - look it up in storage
      isSessionId = true;
      console.log(`[Auth] Detected session ID (length: ${token.length}): "${token.substring(0, 15)}..."`);
      
      // Try KV first (faster)
      let sessionData = null;
      try {
        const kvSession = await env.RATE_LIMITER.get(`session:${token}`);
        if (kvSession) {
          sessionData = JSON.parse(kvSession);
          console.log(`[Auth] Session found in KV for: ${sessionData.userId}`);
        }
      } catch (e) {
        console.warn('[Auth] KV session lookup failed:', e.message);
      }
      
      // Fallback to D1
      if (!sessionData) {
        try {
          console.log(`[Auth] Session not in KV, checking D1 for jti: ${token}`);
          const dbSession = await env.DB.prepare(`
            SELECT user_id, role, fingerprint, session_data, created_at, expires_at
            FROM sessions WHERE jti = ?
          `).bind(token).first();
          
          if (dbSession) {
            console.log(`[Auth] Session found in D1 for user: ${dbSession.user_id}`);
            if (dbSession.session_data) {
              try {
                sessionData = JSON.parse(dbSession.session_data);
              } catch(e) {
                sessionData = {
                  userId: dbSession.user_id,
                  role: dbSession.role,
                  fingerprint: dbSession.fingerprint,
                  createdAt: dbSession.created_at,
                  expiresAt: dbSession.expires_at
                };
              }
            } else {
              sessionData = {
                userId: dbSession.user_id,
                role: dbSession.role,
                fingerprint: dbSession.fingerprint,
                createdAt: dbSession.created_at,
                expiresAt: dbSession.expires_at
              };
            }
          } else {
            console.warn(`[Auth] Session NOT found in D1 for jti: ${token}`);
          }
        } catch (e) {
          console.warn('[Auth] D1 session lookup failed:', e.message);
        }
      }
      
      if (!sessionData) {
        console.warn(`[Auth] Session ID not found in KV or D1: ${token.substring(0, 15)}...`);
        return { authenticated: false, error: "Session not found" };
      }
      
      // Check expiry
      const now = Math.floor(Date.now() / 1000);
      // expiresAt is stored in seconds (from sessionData.expiresAt which was set to `now + 86400`)
      const sessionExpiry = sessionData.expiresAt || (sessionData.createdAt + 86400);
      
      console.log(`[Auth] Session expiry check - now: ${now}, expires: ${sessionExpiry}, diff: ${sessionExpiry - now}s`);
      
      if (sessionExpiry < now) {
        console.warn(`[Auth] Session EXPIRED - now: ${now}, expired at: ${sessionExpiry}`);
        return { authenticated: false, error: "Session expired" };
      }
      
      // Build payload from session data
      payload = {
        id: sessionData.userId,
        role: sessionData.role || 'customer',
        jti: token,
        fp: sessionData.fingerprint || 'none',
        iat: sessionData.createdAt || now,
        exp: sessionExpiry
      };
      
      console.log(`[Auth] Session ID authenticated - user: ${payload.id}, role: ${payload.role}`);
    } else {
      console.warn(`[Auth] Unrecognized token format - length: ${token.length}, dots: ${token.includes('.')}, eyJ: ${token.startsWith('eyJ')}`);
      // One more attempt: try as JWT even if it doesn't look like one
      try {
        payload = await verifyJWT(token, env.GATEWAY_SECRET || env.JWT_SECRET);
        if (payload) {
          console.log(`[Auth] Token verified as JWT despite unusual format - user: ${payload.id}`);
        } else {
          return { authenticated: false, error: "Unrecognized token format" };
        }
      } catch (e) {
        return { authenticated: false, error: "Unrecognized token format" };
      }
    }

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.warn(`[Auth] Token EXPIRED - exp: ${payload.exp}, now: ${Math.floor(Date.now() / 1000)}`);
      return { authenticated: false, error: "Token expired" };
    }

    // Skip fingerprint check for admin endpoints
    const url = new URL(request.url);
    const isAdminEndpoint = url.pathname.startsWith('/api/admin/') || 
                            url.pathname === '/api/auth/me' ||
                            url.pathname === '/api/auth/admin-check' ||
                            url.pathname === '/api/auth/check';
    
    if (!isAdminEndpoint && payload.fp) {
      const fingerprint = request.headers.get("x-device-fingerprint") || 'none';
      if (fingerprint !== 'none' && payload.fp !== 'none' && payload.fp !== fingerprint) {
        console.warn(`[Auth] FP mismatch for ${payload.id}: expected ${payload.fp?.slice(0,8)}..., got ${fingerprint?.slice(0,8)}...`);
        // NOT rejecting - just warning as per your existing logic
      }
    }

    // Get session from D1 (with KV fallback) - only for JWTs
    // For session IDs, we already have the session data
    let session = null;
    if (!isSessionId && payload.jti) {
      try {
        session = await getSession(env, payload.jti);
        if (session) {
          console.log(`[Auth] Session record found in storage for jti: ${payload.jti}`);
        }
      } catch (e) {
        console.warn(`[Auth] getSession failed for ${payload.jti}:`, e.message);
      }
      
      if (!session) {
        console.warn(`[Auth] Session ${payload.jti} not found in storage, allowing stateless auth`);
      }
    }

    console.log(`[Auth] ✅ Authentication SUCCESS - user: ${payload.id}, role: ${payload.role}, path: ${url.pathname}`);
    
    return {
      authenticated: true,
      user: { id: payload.id, role: payload.role, jti: payload.jti },
      session: isSessionId ? payload : session
    };
    
  } catch (e) {
    console.error("[Auth] ❌ authenticate exception:", e.message, e.stack);
    return { authenticated: false, error: e.message };
  }
}

export async function requireAuth(request, env, allowedRoles = null) {
  const url = new URL(request.url);
  console.log(`[Auth] requireAuth called for ${request.method} ${url.pathname}`);
  
  const auth = await authenticate(request, env);
  
  if (!auth.authenticated) {
    console.log(`[Auth] requireAuth FAILED for ${url.pathname} - reason: ${auth.error}`);
    return null;
  }
  
  if (allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(auth.user.role)) {
      console.log(`[Auth] requireAuth FAILED for ${url.pathname} - role ${auth.user.role} not in [${roles.join(', ')}]`);
      return null;
    }
  }
  
  console.log(`[Auth] requireAuth SUCCESS for ${url.pathname} - user: ${auth.user.id}, role: ${auth.user.role}`);
  return auth.user;
}

export async function validateToken(request, env, ctx, required = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const fingerprint = request.headers.get("x-device-fingerprint") || "none";
  const userAgent = request.headers.get("user-agent") || "";
  const origin = request.headers.get("Origin") || "";
  const integrityHeader = request.headers.get("x-integrity-token");

  if (!integrityHeader) {
    return { valid: false, error: "Missing integrity token", status: 403 };
  }

  let token;
  try {
    token = JSON.parse(integrityHeader);
  } catch {
    return { valid: false, error: "Invalid integrity token", status: 403 };
  }

  if (!token.payload || !token.signature) {
    return { valid: false, error: "Invalid token structure", status: 403 };
  }
  if (token.payload.path !== path) {
    return { valid: false, error: "Token not bound to this endpoint", status: 403 };
  }
  if (token.payload.method !== request.method) {
    return { valid: false, error: "Token method mismatch", status: 403 };
  }

  const now = Math.floor(Date.now() / 1000);
  const skew = 5;
  const maxAge = (token.payload.expiry || 60);
  if (token.payload.ts > now + skew || now - token.payload.ts > maxAge) {
    return { valid: false, error: "Invalid timestamp", status: 403 };
  }
  if (token.payload.fingerprint !== fingerprint && token.payload.fingerprint !== 'none') {
    return { valid: false, error: "Fingerprint mismatch", status: 403 };
  }
  if (token.payload.ip && token.payload.ip !== ip) {
    return { valid: false, error: "IP mismatch", status: 403 };
  }

  const currentUaHash = await hashUserAgent(userAgent);
  if (token.payload.uaHash && token.payload.uaHash !== currentUaHash) {
    return { valid: false, error: "User-Agent mismatch", status: 403 };
  }
  if (!origin) {
    return { valid: false, error: "Missing Origin header", status: 403 };
  }
  if (token.payload.origin !== origin) {
    return { valid: false, error: "Origin mismatch", status: 403 };
  }
  if (required.requireCsrf && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const csrfToken = request.headers.get("x-csrf-token");
    if (!csrfToken || csrfToken !== token.payload.csrf) {
      return { valid: false, error: "CSRF token invalid", status: 403 };
    }
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const nonceKey = `nonce:${path}:${token.payload.nonce}`;
    const usedNonce = await env.RATE_LIMITER.get(nonceKey);
    if (usedNonce) {
      return { valid: false, error: "Replay attack detected", status: 403 };
    }
    await env.RATE_LIMITER.put(nonceKey, "1", { expirationTtl: Math.ceil(maxAge) + 60 });
  }

  const tokenUsageKey = `token_usage:${token.signature}`;
  const usageCount = Number(await env.RATE_LIMITER.get(tokenUsageKey) || 0);
  if (usageCount >= 1) {
    return { valid: false, error: "Token already used", status: 403 };
  }
  await env.RATE_LIMITER.put(tokenUsageKey, "1", { expirationTtl: Math.ceil(maxAge) + 10 });

  const isValid = await verifySignature(token.payload, token.signature, env.GATEWAY_SECRET);
  if (!isValid) {
    return { valid: false, error: "Invalid signature", status: 403 };
  }

  return { valid: true, payload: token.payload };
}
