// src/handlers/fingerprint.js
// FINGERPRINT TOKEN GENERATION
// Returns a short‑lived HMAC key and salt for fingerprint signing.
// Integrated from api/fingerprintToken.js

/**
 * Handle fingerprint token generation (GET)
 * Generates a temporary key+salt pair stored in KV for device verification
 */
export async function handleFingerprintToken(request, env, ctx) {
  const allowedOrigins = [
    "https://primeshieldhub.com",
    "https://www.primeshieldhub.com",
    "http://localhost:8787",
    "http://localhost:5173"
  ];
  const origin = request.headers.get("Origin") || "";
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
  };

  // OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers });
  }

  // Generate random key and salt
  const key = crypto.randomUUID();
  const salt = crypto.randomUUID();
  const expiry = 60; // seconds

  // Store key in KV (using RATE_LIMITER namespace) for verification
  // This is what verifyFingerprint() in payment.js reads back
  await env.RATE_LIMITER?.put(`fp_key:${key}`, JSON.stringify({
    salt,
    expiry: Date.now() + expiry * 1000
  }), { expirationTtl: expiry });

  return new Response(JSON.stringify({
    key,
    salt,
    expiry
  }), { status: 200, headers });
}
