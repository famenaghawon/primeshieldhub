// ======================================================================
// FILE: primeshieldhub/backend/src/middleware/cors.js
// DESCRIPTION: CORS handling middleware for PrimeShieldHub
// ======================================================================

import { ALLOWED_ORIGINS, SITE_URL } from '../utils/constants.js';

// ======================================================================
// 1. CORE CORS FUNCTIONS
// ======================================================================

/**
 * Check if an origin is allowed
 */
export function isAllowedOrigin(origin) {
  if (!origin) return false;
  
  // Check exact match
  if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return true;
  
  // Check wildcard subdomains (e.g., *.primeshieldhub.com)
  for (const allowed of ALLOWED_ORIGINS) {
    if (allowed.startsWith('*.')) {
      const domain = allowed.substring(2);
      if (origin.endsWith(domain)) return true;
    }
  }
  
  return false;
}

/**
 * Get CORS headers for a response
 */
export function getCorsHeaders(origin) {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : SITE_URL;
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD',
    'Access-Control-Allow-Headers': [
      'Content-Type',
      'Authorization',
      'x-integrity-token',
      'x-device-fingerprint',
      'x-user-email',
      'x-checkout-session',
      'x-session-id',
      'x-branch-id',
      'x-device-signature',
      'x-device-key',
      'x-behavior',
      'x-primeshield-auth',
      'x-csrf-token',
      'Cookie',
      'X-Requested-With',
      'Accept',
      'Origin',
      'User-Agent',
      'DNT',
      'Cache-Control',
      'Keep-Alive'
    ].join(', '),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': [
      'Set-Cookie',
      'Content-Type',
      'Cache-Control',
      'ETag',
      'X-Total-Count',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ].join(', '),
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
  };
}

// ======================================================================
// 2. EXPRESS/KOA MIDDLEWARE
// ======================================================================

/**
 * Express middleware for CORS handling
 */
export function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  
  // Set CORS headers
  const corsHeaders = getCorsHeaders(origin);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
}

// ======================================================================
// 3. CLOUD FUNCTIONS HANDLERS
// ======================================================================

/**
 * Create a CORS-enabled response for Cloudflare Workers / Lambda
 */
export function createCorsResponse(body, status = 200, origin = null) {
  const headers = getCorsHeaders(origin || null);
  
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      status: status,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Handle CORS preflight for serverless functions
 */
export function handleCorsPreflight(request) {
  const origin = request.headers.get('Origin');
  const headers = getCorsHeaders(origin);
  
  return new Response(null, {
    status: 204,
    headers: {
      ...headers,
      'Content-Length': '0'
    }
  });
}

// ======================================================================
// 4. FRONTEND CLIENT HELPER
// ======================================================================

/**
 * Create a fetch wrapper with CORS support for frontend
 */
export function createCorsFetch(baseURL) {
  return async function corsFetch(endpoint, options = {}) {
    const url = `${baseURL}${endpoint}`;
    
    const defaultOptions = {
      credentials: 'include',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      }
    };

    const fetchOptions = { ...defaultOptions, ...options };
    
    try {
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData || response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('CORS fetch error:', error);
      throw error;
    }
  };
}

// ======================================================================
// 5. TEST UTILITY
// ======================================================================

/**
 * Test if CORS is properly configured
 */
export async function testCors(url) {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
    };
    
    return {
      success: true,
      status: response.status,
      corsHeaders,
      isCorsEnabled: !!corsHeaders['Access-Control-Allow-Origin']
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      isCorsEnabled: false
    };
  }
}

// ======================================================================
// 6. EXPORT ALL
// ======================================================================

export default {
  isAllowedOrigin,
  getCorsHeaders,
  corsMiddleware,
  createCorsResponse,
  handleCorsPreflight,
  createCorsFetch,
  testCors
};
