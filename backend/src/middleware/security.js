// ======================================================================
// SECURITY MIDDLEWARE
// ======================================================================

/**
 * Add security headers to a response
 */
export function addSecurityHeaders(res, requestInfo) {
  requestInfo = requestInfo || {};
  const newRes = new Response(res.body, res);
  
  newRes.headers.set("X-Frame-Options", "DENY");
  newRes.headers.set("X-Content-Type-Options", "nosniff");
  newRes.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  newRes.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  newRes.headers.set("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://telegram.org https://cdnjs.cloudflare.com https://www.googletagmanager.com https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
    "img-src 'self' data: blob: https:; " +
    "connect-src 'self' https://api.primeshieldhub.com https://api.paystack.co https://api.telegram.org https://graph.facebook.com https://api.twilio.com https://api.ng.termii.com https://www.google-analytics.com https://*.pages.dev https://generativelanguage.googleapis.com; " +
    "frame-src 'self' https://js.paystack.co; " +
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com;"
  );
  newRes.headers.set("Permissions-Policy", "geolocation=(self), microphone=(), camera=()");
  newRes.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  newRes.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  newRes.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  newRes.headers.set("X-DNS-Prefetch-Control", "off");
  newRes.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  newRes.headers.set("Pragma", "no-cache");
  newRes.headers.set("Expires", "0");
  
  if (!newRes.headers.has("X-Request-ID")) {
    newRes.headers.set("X-Request-ID", crypto.randomUUID());
  }
  
  return newRes;
}

/**
 * Get MIME type for a file extension
 */
export function getMimeType(path) {
  const ext = path.split('.').pop();
  if (!ext) return 'application/octet-stream';
  
  const extLower = ext.toLowerCase();
  const mimeTypes = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json; charset=utf-8',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf'
  };
  
  return mimeTypes[extLower] || 'application/octet-stream';
}
