// src/handlers/verify-challenge.js
// ENTERPRISE‑GRADE CHALLENGE VERIFICATION – FULLY INTEGRATED
// Integrated from api/verifyChallenge.js
// All duplicate crypto removed, KV storage preserved
// UPDATED: reCAPTCHA → Cloudflare Turnstile, secret names corrected

import { safeCompare, hashUserAgent, signPayload, verifySignature, signRaw } from '../utils/crypto.js';

// ==================== HASH VALUE HELPER ====================
async function hashValue(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ==================== UNIFIED TOKEN VALIDATOR (light version) ====================
async function validateChallengeToken(request, env) {
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

  // Path binding
  if (token.payload.path !== path) {
    return { valid: false, error: "Token not bound to this endpoint", status: 403 };
  }

  // Method binding
  if (token.payload.method !== request.method) {
    return { valid: false, error: "Token method mismatch", status: 403 };
  }

  // Timestamp and expiry (expiry in seconds)
  const now = Date.now();
  const skew = 10000; // 10 seconds tolerance
  const maxAge = (token.payload.expiry || 120) * 1000;
  if (token.payload.ts > now + skew || now - token.payload.ts > maxAge) {
    return { valid: false, error: "Invalid timestamp", status: 403 };
  }

  // Fingerprint binding
  if (token.payload.fingerprint !== fingerprint) {
    return { valid: false, error: "Fingerprint mismatch", status: 403 };
  }

  // IP binding
  if (token.payload.ip && token.payload.ip !== ip) {
    return { valid: false, error: "IP mismatch", status: 403 };
  }

  // User-Agent hash binding (optional)
  if (token.payload.uaHash) {
    const currentUaHash = await hashUserAgent(userAgent);
    if (token.payload.uaHash !== currentUaHash) {
      return { valid: false, error: "User-Agent mismatch", status: 403 };
    }
  }

  // Origin binding (optional but we check if present)
  if (token.payload.origin && token.payload.origin !== origin) {
    return { valid: false, error: "Origin mismatch", status: 403 };
  }

  // Nonce replay protection (atomic write)
  const nonceKey = `nonce:${path}:${token.payload.nonce}`;
  let nonceSet;
  try {
    nonceSet = await env.RATE_LIMITER?.put(nonceKey, "1", {
      expirationTtl: 300,
      nx: true
    });
  } catch {
    const usedNonce = await env.RATE_LIMITER?.get(nonceKey);
    if (usedNonce) {
      nonceSet = false;
    } else {
      await env.RATE_LIMITER?.put(nonceKey, "1", { expirationTtl: 300 });
      nonceSet = true;
    }
  }
  if (!nonceSet) {
    return { valid: false, error: "Replay attack detected", status: 403 };
  }

  // Token usage rate limiting
  const tokenUsageKey = `token_usage:${token.signature}`;
  let usageCount = Number(await env.RATE_LIMITER?.get(tokenUsageKey) || 0);
  if (usageCount >= 3) {
    return { valid: false, error: "Token usage limit exceeded", status: 429 };
  }
  await env.RATE_LIMITER?.put(tokenUsageKey, (usageCount + 1).toString(), {
    expirationTtl: maxAge / 1000
  });

  // Signature verification
  const isValid = await verifySignature(token.payload, token.signature, env.GATEWAY_SECRET);
  if (!isValid) {
    return { valid: false, error: "Invalid signature", status: 403 };
  }

  return { valid: true, payload: token.payload };
}

// ==================== TURNSTILE VERIFICATION (Cloudflare native, replaces reCAPTCHA) ====================
async function verifyTurnstile(token, secret, remoteIp) {
  if (!secret || !token) return false;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    // Cloudflare Turnstile siteverify endpoint
    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }
    
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    
    // Turnstile returns { success: true, challenge_ts, hostname, ... }
    return data.success === true;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("Turnstile verification error:", err);
    return false;
  }
}

// ==================== OTP VERIFICATION (with salted hash) ====================
async function verifyOtp(submittedOtp, expectedHash, reference) {
  if (typeof submittedOtp !== "string" || typeof expectedHash !== "string") return false;
  const submittedHash = await hashValue(`${reference}:${submittedOtp}`);
  return safeCompare(submittedHash, expectedHash);
}

// ==================== MAIN CHALLENGE VERIFICATION HANDLER ====================
export async function handleVerifyChallenge(request, env, ctx) {
  const allowedOrigins = [
    "https://primeshieldhub.com",
    "https://www.primeshieldhub.com",
    "http://localhost:8787",
    "http://localhost:5173"
  ];
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigins[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-device-fingerprint, x-integrity-token",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
  };

  // 0. METHOD ENFORCEMENT
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers });
  }

  // 1. ORIGIN VALIDATION
  const origin = request.headers.get("Origin") || "";
  if (!allowedOrigins.includes(origin) && !origin.includes("localhost")) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 403, headers });
  }

  // 2. CONTENT‑TYPE & SIZE
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 415, headers });
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > 2000) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 413, headers });
  }

  // 3. EXTRACT HEADERS
  const fingerprint = request.headers.get("x-device-fingerprint")?.trim();
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const userAgent = request.headers.get("User-Agent") || "";
  if (!fingerprint || fingerprint.length < 32) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 403, headers });
  }
  if (!userAgent || userAgent.length < 10) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 403, headers });
  }

  // 4. MULTI‑DIMENSION BLACKLIST CHECK
  const blacklisted =
    await env.RATE_LIMITER?.get(`blacklist:fingerprint:${fingerprint}`) ||
    await env.RATE_LIMITER?.get(`blacklist:ip:${ip}`);
  if (blacklisted) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 403, headers });
  }

  // 5. VALIDATE CHALLENGE TOKEN
  const tokenResult = await validateChallengeToken(request, env);
  if (!tokenResult.valid) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 403, headers });
  }

  const { reference, fingerprint: tokenFp, ip: tokenIp } = tokenResult.payload;
  if (tokenFp !== fingerprint || tokenIp !== ip) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 403, headers });
  }

  // Validate reference format
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(reference)) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400, headers });
  }

  // 6. RATE LIMIT PER TRANSACTION (sliding window, extended TTL)
  const verifyKey = `verify:${ip}:${fingerprint}:${reference}`;
  let attempts = Number(await env.RATE_LIMITER?.get(verifyKey) || 0);
  if (attempts > 5) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 429, headers });
  }
  // Store with longer window (15 minutes) to slow brute force
  await env.RATE_LIMITER?.put(verifyKey, (attempts + 1).toString(), { expirationTtl: 900 });

  // 7. PARSE REQUEST BODY
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400, headers });
  }

  const { type, solution } = body;
  if (!type || !solution) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400, headers });
  }

  // 8. FETCH CHALLENGE DATA (longer TTL: 5 minutes)
  const challengeKey = `challenge:${reference}`;
  const challengeDataRaw = await env.RATE_LIMITER?.get(challengeKey);
  if (!challengeDataRaw) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 404, headers });
  }

  let challengeData;
  try {
    challengeData = JSON.parse(challengeDataRaw);
  } catch {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 500, headers });
  }

  // Ensure the stored challenge contains all required fields
  if (!challengeData.reference || !challengeData.fingerprint || !challengeData.ip || !challengeData.type) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 500, headers });
  }

  // Verify binding
  if (challengeData.reference !== reference || challengeData.fingerprint !== fingerprint || challengeData.ip !== ip) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 403, headers });
  }

  // Enforce challenge type
  if (challengeData.type !== type) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 403, headers });
  }

  // Prevent reuse (one‑time usage)
  if (challengeData.status !== "pending") {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400, headers });
  }
  if (challengeData.used) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 403, headers });
  }

  // 9. ATOMIC VERIFICATION LOCK
  const lockKey = `verify_lock:${reference}`;
  const lockAcquired = await env.RATE_LIMITER?.put(lockKey, "1", {
    expirationTtl: 10,
    nx: true
  });
  if (!lockAcquired) {
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 409, headers });
  }
  // Lock expires automatically – no deletion needed.

  try {
    // 10. GLOBAL OTP PRESSURE (prevents distributed brute force)
    if (type === "otp") {
      const globalOtpKey = `otp_global:${ip}`;
      let globalAttempts = Number(await env.RATE_LIMITER?.get(globalOtpKey) || 0);
      if (globalAttempts > 20) {
        await env.RATE_LIMITER?.put(`blacklist:ip:${ip}`, "1", { expirationTtl: 86400 });
        
        // Alert on brute force attempt via Telegram
        if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
          ctx.waitUntil(
            fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: env.TELEGRAM_CHAT_ID,
                text: `🚨 OTP Brute Force Detected\nIP: ${ip}\nFingerprint: ${fingerprint?.slice(0, 12)}...\nReference: ${reference}\nIP has been blacklisted for 24 hours.`
              }),
            }).catch(() => {})
          );
        }
        
        return new Response(JSON.stringify({ error: "Verification failed" }), { status: 429, headers });
      }
      await env.RATE_LIMITER?.put(globalOtpKey, (globalAttempts + 1).toString(), {
        expirationTtl: 900
      });
    }

    // 11. VERIFY SOLUTION
    let verified = false;
    let delay = 0;

    if (type === "captcha" || type === "turnstile") {
      // Use Turnstile secret (Cloudflare native)
      const turnstileSecret = env.TURNSTILE_SECRET_KEY;
      if (!turnstileSecret) {
        console.error("TURNSTILE_SECRET_KEY not configured");
        return new Response(JSON.stringify({ error: "Verification failed" }), { status: 500, headers });
      }
      
      // Bind captcha to transaction + nonce (prevents cross‑transaction replay)
      const captchaNonce = challengeData.captchaNonce || "legacy";
      const captchaHash = await hashValue(`${reference}:${captchaNonce}:${solution}`);
      const captchaKey = `captcha:${captchaHash}`;
      const usedCaptcha = await env.RATE_LIMITER?.get(captchaKey);
      
      if (usedCaptcha) {
        verified = false;
      } else {
        verified = await verifyTurnstile(solution, turnstileSecret, ip);
        if (verified) {
          await env.RATE_LIMITER?.put(captchaKey, "1", { expirationTtl: 300 });
        }
      }
    } else if (type === "otp") {
      const otpHash = challengeData.otpHash;
      if (!otpHash) {
        return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400, headers });
      }

      // OTP attempt limit per reference
      const otpAttemptKey = `otp_attempts:${reference}`;
      let otpAttempts = Number(await env.RATE_LIMITER?.get(otpAttemptKey) || 0);
      if (otpAttempts >= 5) {
        await env.RATE_LIMITER?.put(`blacklist:fingerprint:${fingerprint}`, "1", {
          expirationTtl: 86400
        });
        
        // Alert on OTP brute force
        if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
          ctx.waitUntil(
            fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: env.TELEGRAM_CHAT_ID,
                text: `🚨 OTP Brute Force (Per-Reference)\nReference: ${reference}\nFingerprint: ${fingerprint?.slice(0, 12)}...\nIP: ${ip}\nFingerprint blacklisted for 24 hours.`
              }),
            }).catch(() => {})
          );
        }
        
        verified = false;
      } else {
        verified = await verifyOtp(solution, otpHash, reference);
        if (!verified) {
          await env.RATE_LIMITER?.put(otpAttemptKey, (otpAttempts + 1).toString(), {
            expirationTtl: 900
          });
        } else {
          await env.RATE_LIMITER?.delete(otpAttemptKey);
        }
      }
    } else {
      return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400, headers });
    }

    // 12. DYNAMIC + RANDOMIZED DELAY (anti‑timing)
    if (!verified) {
      delay = Math.min(2000, 200 + attempts * 150 + Math.random() * 200);
      await new Promise(r => setTimeout(r, delay));
    }

    if (!verified) {
      return new Response(JSON.stringify({ error: "Verification failed" }), { status: 403, headers });
    }

    // 13. UPDATE CHALLENGE STATUS TO VERIFIED
    challengeData.status = "verified";
    challengeData.verifiedAt = Date.now();
    challengeData.used = true;
    challengeData.verifiedVia = type;
    challengeData.verifiedIp = ip;
    await env.RATE_LIMITER?.put(challengeKey, JSON.stringify(challengeData), { expirationTtl: 300 }); // 5 min TTL

    // 14. CLEAR RATE LIMIT COUNTER ON SUCCESS
    await env.RATE_LIMITER?.delete(verifyKey);

    // 15. RETURN SUCCESS
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Verification successful",
      reference,
      verifiedAt: challengeData.verifiedAt
    }), {
      status: 200,
      headers
    });
  } catch (err) {
    console.error("Verification error", err);
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 500, headers });
  }
}

// ==================== OPTIONS HANDLER ====================
export async function handleVerifyChallengeOptions(request) {
  const allowedOrigins = [
    "https://primeshieldhub.com",
    "https://www.primeshieldhub.com",
    "http://localhost:8787",
    "http://localhost:5173"
  ];
  const origin = request.headers.get("Origin") || "";
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-device-fingerprint, x-integrity-token",
      "Access-Control-Max-Age": "86400",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
    }
  });
}
