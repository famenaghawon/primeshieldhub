// src/handlers/payment.js
// ENTERPRISE‑GRADE PAYSTACK INITIATION – CLOUDFLARE NATIVE
// Integrated from api/initiatePaystack.js with placeholder functions preserved

import { getCorsHeaders } from '../middleware/cors.js';
import { addSecurityHeaders } from '../middleware/security.js';
import { validateAmount, validateEmail, validateUUID } from '../utils/validation.js';
import { safeCompare, hashUserAgent, signPayload, verifySignature, generateJWT } from '../utils/crypto.js';

// ==================== FINGERPRINT VERIFICATION ====================
async function verifyFingerprint(fp, signature, key, env) {
  if (!fp || !signature || !key) return false;
  const stored = await env.RATE_LIMITER?.get(`fp_key:${key}`);
  if (!stored) return false;
  const { salt, expiry } = JSON.parse(stored);
  if (Date.now() > expiry) return false;

  const expected = await signPayload(fp, key);
  return safeCompare(expected, signature);
}

// ==================== KV HELPERS ====================
async function kvGet(env, key) {
  try {
    return await env.RATE_LIMITER?.get(key);
  } catch {
    return null;
  }
}

async function kvSet(env, key, value, ttlSeconds = 3600) {
  try {
    await env.RATE_LIMITER?.put(key, value.toString(), { expirationTtl: ttlSeconds });
  } catch {}
}

async function getReputation(env, key) {
  const score = await kvGet(env, key);
  return score ? Number(score) : 50;
}

async function increaseReputation(env, key, amount = 2) {
  const score = Number(await kvGet(env, key) || 50);
  const newScore = Math.min(score + amount, 100);
  await kvSet(env, key, newScore, 86400 * 30);
}

async function decreaseReputation(env, key, amount = 10) {
  const score = Number(await kvGet(env, key) || 50);
  const newScore = Math.max(score - amount, 0);
  await kvSet(env, key, newScore, 86400 * 30);
}

// ==================== UNIFIED TOKEN VALIDATOR ====================
async function validateToken(request, env, required = {}) {
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

  const now = Date.now();
  const skew = 10000;
  const maxAge = (token.payload.expiry || 300) * 1000;
  if (token.payload.ts > now + skew || now - token.payload.ts > maxAge) {
    return { valid: false, error: "Invalid timestamp", status: 403 };
  }

  if (token.payload.fingerprint !== fingerprint) {
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

  if (required.requireCheckout) {
    const checkoutSession = request.headers.get("x-checkout-session");
    if (!checkoutSession) {
      return { valid: false, error: "Missing checkout session", status: 403 };
    }
    if (token.payload.checkoutSession !== checkoutSession) {
      return { valid: false, error: "Checkout session mismatch", status: 403 };
    }
  }

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

  const tokenUsageKey = `token_usage:${token.signature}`;
  let usageCount = Number(await env.RATE_LIMITER?.get(tokenUsageKey) || 0);
  if (usageCount >= 3) {
    return { valid: false, error: "Token usage limit exceeded", status: 429 };
  }
  await env.RATE_LIMITER?.put(tokenUsageKey, (usageCount + 1).toString(), {
    expirationTtl: maxAge / 1000
  });

  const isValid = await verifySignature(token.payload, token.signature, env.GATEWAY_SECRET);
  if (!isValid) {
    return { valid: false, error: "Invalid signature", status: 403 };
  }

  return { valid: true, payload: token.payload };
}

// ==================== BEHAVIORAL BIOMETRICS ====================
function analyzeBehavior(behavior) {
  if (!behavior) return { score: 50, flags: ["missing"] };

  let risk = 0;
  const flags = [];

  const { duration, keystrokes, mouseMoves, clicks } = behavior;

  if (duration < 1000) {
    risk += 25;
    flags.push("too_fast");
  }

  if (!mouseMoves || mouseMoves.length < 5) {
    risk += 20;
    flags.push("no_mouse");
  }

  let straightMoves = 0;
  if (mouseMoves && mouseMoves.length > 1) {
    for (let i = 1; i < mouseMoves.length; i++) {
      const dx = mouseMoves[i].x - mouseMoves[i - 1].x;
      const dy = mouseMoves[i].y - mouseMoves[i - 1].y;
      if (dx === 0 || dy === 0) straightMoves++;
    }
    if (straightMoves > mouseMoves.length * 0.8) {
      risk += 15;
      flags.push("linear_mouse");
    }
  }

  if (keystrokes && keystrokes.length > 5) {
    const intervals = [];
    for (let i = 1; i < keystrokes.length; i++) {
      intervals.push(keystrokes[i].t - keystrokes[i - 1].t);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0);
    if (variance < 50) {
      risk += 15;
      flags.push("uniform_typing");
    }
  }

  if (clicks === 0) {
    risk += 10;
    flags.push("no_clicks");
  }

  return {
    score: Math.min(100, risk),
    flags
  };
}

// ==================== FRAUD RISK EVALUATION ====================
async function evaluateFraudRisk(env, request, params, ctx) {
  const { fingerprint, ip, email, userAgent, amount, productId, trustScore, reference } = params;
  const now = Date.now();
  let risk = 0;

  let fpRisk = 0;
  if (fingerprint.length < 32) fpRisk += 20;
  if (fingerprint.includes("fallback")) fpRisk += 30;
  risk += fpRisk;

  const ipRep = await getReputation(env, `rep:ip:${ip}`);
  const deviceRep = await getReputation(env, `rep:device:${fingerprint}`);
  const emailRep = await getReputation(env, `rep:email:${email}`);
  risk += (100 - ipRep) * 0.2;
  risk += (100 - deviceRep) * 0.3;
  risk += (100 - emailRep) * 0.2;

  const paymentVelocityKey = `payments:${ip}`;
  let recentPayments = Number(await kvGet(env, paymentVelocityKey) || 0);
  if (recentPayments > 5) risk += 20;

  const emailFpCountKey = `email_fp_count:${email}`;
  let emailFpCount = Number(await kvGet(env, emailFpCountKey) || 0);
  const emailFpKey = `email_fp:${email}:${fingerprint}`;
  const existingFp = await env.RATE_LIMITER?.get(emailFpKey);
  if (!existingFp && deviceRep > 30) {
    emailFpCount++;
    await kvSet(env, emailFpCountKey, emailFpCount, 86400 * 30);
    await env.RATE_LIMITER?.put(emailFpKey, "1", { expirationTtl: 86400 });
  }
  if (emailFpCount > 3) risk += 20;

  let country = request.headers.get("CF-IPCountry") || "UNKNOWN";
  if (country !== "NG" && country !== "UNKNOWN") risk += 15;

  const hour = new Date().getUTCHours();
  if (hour >= 2 && hour < 5) risk += 15;

  const lastIp = await kvGet(env, `device_last_ip:${fingerprint}`);
  if (lastIp && lastIp !== ip) risk += 15;
  await kvSet(env, `device_last_ip:${fingerprint}`, ip, 86400);

  const fingerprintKey = `cluster_item:${ip}:${fingerprint}`;
  const existing = await env.RATE_LIMITER?.get(fingerprintKey);
  if (!existing) {
    await env.RATE_LIMITER?.put(fingerprintKey, "1", { expirationTtl: 3600 });
  }
  let clusterCount = Number(await kvGet(env, `cluster_count:${ip}`) || 0);
  if (!existing) clusterCount++;
  await kvSet(env, `cluster_count:${ip}`, clusterCount, 3600);
  if (clusterCount > 5) risk += 25;

  const riskyDomains = ["tempmail.com", "mailinator.com", "guerrillamail.com", "10minutemail.com"];
  const emailDomain = email.split('@')[1];
  if (riskyDomains.some(d => emailDomain?.includes(d))) risk += 25;

  const historicalRisk = Number(await kvGet(env, `risk:${fingerprint}`) || 0);
  const decayedRisk = historicalRisk * 0.7;
  risk += decayedRisk * 0.2;

  let behaviorResult = { score: 50, flags: ["missing"] };
  try {
    const rawBehavior = request.headers.get("x-behavior");
    if (rawBehavior) {
      const decoded = atob(rawBehavior);
      const behavior = JSON.parse(decoded);
      behaviorResult = analyzeBehavior(behavior);
      await kvSet(env, `behavior:${fingerprint}`, JSON.stringify(behaviorResult), 3600);
    }
  } catch (err) {
    console.warn("Behavior decoding failed", err);
  }
  risk += behaviorResult.score * 0.4;

  risk = Math.min(100, Math.max(0, risk));
  await kvSet(env, `risk:${fingerprint}`, risk, 3600);

  let blockThreshold = 80;
  let challengeThreshold = 60;
  if (hour >= 2 && hour < 5) {
    blockThreshold = 70;
    challengeThreshold = 50;
  }
  if (country !== "NG" && country !== "UNKNOWN") {
    blockThreshold = 75;
    challengeThreshold = 55;
  }
  if (amount > 500000) {
    blockThreshold = 70;
    challengeThreshold = 50;
  }

  const blacklisted =
    await env.RATE_LIMITER?.get(`blacklist:fingerprint:${fingerprint}`) ||
    await env.RATE_LIMITER?.get(`blacklist:ip:${ip}`) ||
    await env.RATE_LIMITER?.get(`blacklist:email:${email}`);
  if (blacklisted) {
    return { action: "block", risk, reason: "blacklisted" };
  }

  risk = risk * 0.85;

  if (risk >= blockThreshold) {
    return { action: "block", risk, reason: "high_risk" };
  } else if (risk >= challengeThreshold) {
    return { action: "challenge", risk, reason: "moderate_risk" };
  } else {
    return { action: "allow", risk, reason: "low_risk" };
  }
}

// ==================== EVIDENCE LOGGING ====================
async function logEvidence(env, data) {
  const evidenceKey = `evidence:${data.reference}`;
  await env.RATE_LIMITER?.put(evidenceKey, JSON.stringify({
    ...data,
    timestamp: Date.now()
  }), { expirationTtl: 86400 * 90 });
  
  if (env.PAYMENT_LOGS_DB) {
    try {
      await env.PAYMENT_LOGS_DB.prepare(`
        INSERT INTO evidence (reference, fingerprint, ip, email, amount, product_id, risk_score, action, details, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        data.reference,
        data.fingerprint,
        data.ip,
        data.email,
        data.amount,
        data.productId,
        data.riskScore,
        data.action,
        JSON.stringify(data.details),
        Date.now()
      ).run();
    } catch (err) {
      console.error("Evidence D1 insert failed", err);
    }
  }
}

// ==================== ORDER CREATION ====================
async function createOrder(env, paymentData) {
  if (!env.DB) return null;
  
  try {
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const result = await env.DB.prepare(`
      INSERT INTO orders (
        order_id, reference, email, amount, product_id, 
        fingerprint, ip, status, metadata, createdAt, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId,
      paymentData.reference,
      paymentData.email,
      paymentData.amount,
      paymentData.productId || null,
      paymentData.fingerprint,
      paymentData.ip,
      'pending',
      JSON.stringify(paymentData.metadata || {}),
      Date.now(),
      Date.now()
    ).run();
    
    return { orderId, success: true };
  } catch (err) {
    console.error("Order creation failed", err);
    return null;
  }
}

// ==================== HANDLE PAYMENT INTENT (PAYSTACK INITIATION) ====================
export async function handlePaymentIntent(request, env, ctx, corsHeaders, requestInfo) {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = [
    "https://primeshieldhub.com",
    "https://www.primeshieldhub.com",
    "http://localhost:8787",
    "http://localhost:5173"
  ];
  if (!allowedOrigins.includes(origin) && !origin.includes("localhost")) {
    return new Response(JSON.stringify({ error: "Invalid origin" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return new Response(JSON.stringify({ error: "Invalid content type" }), {
      status: 415,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > 5000) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const fingerprint = request.headers.get("x-device-fingerprint")?.trim();
  const signature = request.headers.get("x-device-signature")?.trim();
  const fpKey = request.headers.get("x-device-key")?.trim();
  const ip = requestInfo.ip || request.headers.get("CF-Connecting-IP") || "unknown";
  const userAgent = request.headers.get("User-Agent") || "";

  if (!fingerprint || fingerprint.length < 32) {
    return new Response(JSON.stringify({ error: "Invalid fingerprint" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  if (!userAgent || userAgent.length < 10) {
    return new Response(JSON.stringify({ error: "Invalid client" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  if (!signature || !fpKey) {
    return new Response(JSON.stringify({ error: "Missing fingerprint signature" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  const isValidFp = await verifyFingerprint(fingerprint, signature, fpKey, env);
  if (!isValidFp) {
    return new Response(JSON.stringify({ error: "Device spoof detected" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const replayKey = `fp_replay:${fingerprint}:${ip}`;
  const used = await env.RATE_LIMITER?.get(replayKey);
  if (used) {
    return new Response(JSON.stringify({ error: "Replay detected" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  await env.RATE_LIMITER?.put(replayKey, "1", { expirationTtl: 60 });

  const profileKey = `fp_profile:${fingerprint}`;
  const existingProfile = await env.RATE_LIMITER?.get(profileKey);
  if (existingProfile) {
    const profile = JSON.parse(existingProfile);
    if (profile.userAgent !== userAgent) {
      return new Response(JSON.stringify({ error: "Device mismatch" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  } else {
    await env.RATE_LIMITER?.put(profileKey, JSON.stringify({
      userAgent,
      firstSeen: Date.now()
    }), { expirationTtl: 86400 * 7 });
  }

  const gatewayAuth = request.headers.get("x-primeshield-auth");
  if (!gatewayAuth || !safeCompare(gatewayAuth, env.GATEWAY_SECRET)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const tokenResult = await validateToken(request, env, { requireCheckout: true });
  if (!tokenResult.valid) {
    return new Response(JSON.stringify({ error: tokenResult.error }), {
      status: tokenResult.status,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  let { amount, email, reference, metadata, productId } = body;
  if (!amount || !email || !reference) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  email = email.trim().toLowerCase();
  if (typeof amount !== "number" || amount <= 0 || amount > 10000000) {
    return new Response(JSON.stringify({ error: "Invalid amount" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  if (!/^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  if (productId && env.PRODUCTS_CACHE) {
    const cachedProduct = await env.PRODUCTS_CACHE?.get(productId);
    if (!cachedProduct) {
      return new Response(JSON.stringify({ error: "Product validation failed" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    try {
      const product = JSON.parse(cachedProduct);
      const expectedPrice = product.price;
      const roundedAmount = Math.round(amount * 100) / 100;
      const roundedExpected = Math.round(expectedPrice * 100) / 100;
      if (Math.abs(roundedAmount - roundedExpected) > 0.01) {
        return new Response(JSON.stringify({ error: "Price mismatch" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: "Product data error" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }

  const ipRep = await getReputation(env, `rep:ip:${ip}`);
  const deviceRep = await getReputation(env, `rep:device:${fingerprint}`);
  const trustScore = Math.round(ipRep * 0.4 + deviceRep * 0.6);

  const fraudResult = await evaluateFraudRisk(env, request, {
    fingerprint, ip, email, userAgent, amount, productId, trustScore, reference
  }, ctx);

  await logEvidence(env, {
    reference,
    fingerprint,
    ip,
    email,
    amount,
    productId,
    riskScore: fraudResult.risk,
    action: fraudResult.action,
    details: {
      reason: fraudResult.reason,
      userAgent,
      trustScore,
      timestamp: Date.now()
    }
  });

  if (fraudResult.action === "block") {
    const delay = Math.min(3000, 500 + fraudResult.risk * 20);
    await new Promise(r => setTimeout(r, delay));
    return new Response(JSON.stringify({ error: "Transaction blocked due to fraud risk", risk: fraudResult.risk }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } else if (fraudResult.action === "challenge") {
    // ===== DUAL WRITE: KV + D1 =====
    const challengeData = {
      reference,
      fingerprint,
      ip,
      type: 'turnstile', // Payment challenges use Turnstile
      status: 'pending',
      used: false,
      captchaNonce: crypto.randomUUID(), // Generate nonce for captcha binding
      createdAt: Date.now(),
      expiresAt: Date.now() + (120 * 1000) // 2 minutes
    };

    // Write to KV (existing - keep for backward compatibility)
    const challengeKey = `challenge:${reference}`;
    await env.RATE_LIMITER?.put(
      challengeKey,
      JSON.stringify(challengeData),
      { expirationTtl: 120 }
    );

    // Write to D1 (new - primary store)
    try {
      const { ChallengeStore } = await import('../stores/challenge-store.js');
      const store = new ChallengeStore(env.DB);
      await store.createChallenge(reference, {
        fingerprint,
        ip,
        type: 'turnstile',
        captchaNonce: challengeData.captchaNonce
      }, 120);
    } catch (d1Error) {
      console.error('D1 challenge write failed (non-critical):', d1Error.message);
      // Continue - KV is the fallback
    }

    const challengePayload = {
      fingerprint,
      ip,
      reference,
      ts: Date.now(),
      expiry: 120
    };
    const challengeSig = await signPayload(challengePayload, env.GATEWAY_SECRET);
    const challengeToken = JSON.stringify({ payload: challengePayload, signature: challengeSig });
    return new Response(JSON.stringify({ error: "Additional verification required", challenge: challengeToken, risk: fraudResult.risk }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  // Check if challenge was completed - try D1 first, fallback to KV
  let challengeCompleted = false;
  try {
    const { ChallengeStore } = await import('../stores/challenge-store.js');
    const store = new ChallengeStore(env.DB);
    const d1Challenge = await store.getChallenge(reference);
    if (d1Challenge && d1Challenge.status === 'verified') {
      challengeCompleted = true;
    }
  } catch (e) {
    // D1 check failed, fall through to KV
  }

  // Fallback to KV if D1 check didn't confirm completion
  if (!challengeCompleted) {
    const challengeDataRaw = await env.RATE_LIMITER?.get(`challenge:${reference}`);
    if (challengeDataRaw) {
      try {
        const challengeData = JSON.parse(challengeDataRaw);
        if (challengeData.status === "verified") {
          challengeCompleted = true;
        } else if (challengeData.status === "pending") {
          if (challengeData.fingerprint !== fingerprint || challengeData.ip !== ip) {
            return new Response(JSON.stringify({ error: "Challenge context mismatch" }), {
              status: 403,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }
          return new Response(JSON.stringify({ error: "Challenge not completed" }), {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      } catch (parseError) {
        // Old format - just a string, ignore
      }
    }
  }

  const refKey = `pay_ref:${reference}`;
  let refSet;
  try {
    refSet = await env.RATE_LIMITER?.put(refKey, "1", {
      expirationTtl: 3600,
      nx: true
    });
  } catch {
    const existing = await env.RATE_LIMITER?.get(refKey);
    if (existing) {
      refSet = false;
    } else {
      await env.RATE_LIMITER?.put(refKey, "1", { expirationTtl: 3600 });
      refSet = true;
    }
  }
  if (!refSet) {
    return new Response(JSON.stringify({ error: "Duplicate payment reference" }), {
      status: 409,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const globalRateKey = `payment_ip:${ip}`;
  let globalCount = Number(await env.RATE_LIMITER?.get(globalRateKey) || 0);
  if (globalCount > 100) {
    return new Response(JSON.stringify({ error: "IP rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  await env.RATE_LIMITER?.put(globalRateKey, globalCount + 1, { expirationTtl: 60 });

  let rateLimit = 10;
  if (trustScore > 80) rateLimit = 30;
  else if (trustScore > 50) rateLimit = 15;
  else if (trustScore < 20) rateLimit = 3;

  const rateLimitKey = `payment:${ip}:${fingerprint}`;
  let currentCount = Number(await env.RATE_LIMITER?.get(rateLimitKey) || 0);
  if (currentCount > 50) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  if (currentCount > rateLimit) {
    return new Response(JSON.stringify({ error: "Too many payment attempts" }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  await env.RATE_LIMITER?.put(rateLimitKey, (currentCount + 1).toString(), {
    expirationTtl: 60
  });

  const failKey = "paystack_failures";
  let failures = Number(await kvGet(env, failKey) || 0);
  if (failures > 20) {
    console.error("Paystack circuit breaker open");
    return new Response(JSON.stringify({ error: "Payment system temporarily unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const paystackSecret = env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    console.error("Paystack secret not configured");
    return new Response(JSON.stringify({ error: "Payment service unavailable" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  // Create order in DB before Paystack call
  await createOrder(env, { reference, email, amount, productId, fingerprint, ip, metadata });

  const amountInKobo = Math.round(amount * 100);
  const paystackPayload = {
    amount: amountInKobo,
    email,
    reference,
    metadata: {
      ...metadata,
      fingerprint,
      ip,
      userAgent,
      trustScore,
      normalizedEmail: email,
      productId,
      originalAmount: amount,
      fraudRisk: fraudResult.risk,
      fraudAction: fraudResult.action
    }
  };

  let paystackResponse;
  let fetchError = null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(paystackPayload),
      signal: controller.signal
    });
    const data = await resp.json();
    paystackResponse = { status: resp.status, data };
  } catch (err) {
    fetchError = err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (fetchError || (paystackResponse && (paystackResponse.status >= 500 || paystackResponse.status === 0))) {
    await kvSet(env, failKey, failures + 1, 60);
  } else if (paystackResponse && paystackResponse.status === 200) {
    await kvSet(env, failKey, 0, 60);
  }

  if (fetchError) {
    await env.RATE_LIMITER?.delete(refKey);
    console.error("Paystack call failed", fetchError);
    return new Response(JSON.stringify({ error: "Payment gateway timeout or error" }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const authUrl = paystackResponse?.data?.data?.authorization_url;
  const success =
    paystackResponse.status === 200 &&
    paystackResponse.data &&
    paystackResponse.data.status === true &&
    authUrl &&
    typeof authUrl === "string";

  if (!success) {
    await env.RATE_LIMITER?.delete(refKey);
  }

  if (success) {
    await increaseReputation(env, `rep:ip:${ip}`, 1);
    await increaseReputation(env, `rep:device:${fingerprint}`, 1);
  } else {
    await decreaseReputation(env, `rep:ip:${ip}`, 5);
    await decreaseReputation(env, `rep:device:${fingerprint}`, 5);
  }

  if (env.PAYMENT_LOGS_DB) {
    try {
      await env.PAYMENT_LOGS_DB.prepare(`
        INSERT INTO payment_logs (fingerprint, ip, reference, amount, email, success, response, timestamp, fraud_risk)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        fingerprint,
        ip,
        reference,
        amount,
        email,
        success ? 1 : 0,
        JSON.stringify(paystackResponse?.data),
        Date.now(),
        fraudResult.risk
      ).run();
    } catch (err) {
      console.error("D1 insert failed", err);
    }
  }

  // Update order status in DB
  if (env.DB) {
    try {
      await env.DB.prepare(`
        UPDATE orders SET status = ?, paystack_response = ?, updated_at = ? WHERE reference = ?
      `).bind(
        success ? 'processing' : 'failed',
        JSON.stringify(paystackResponse?.data || {}),
        Date.now(),
        reference
      ).run();
    } catch (err) {
      console.error("Order update failed", err);
    }
  }

  const responseBody = {
    success: success,
    message: success ? "Payment initialized" : "Payment initialization failed",
    data: success ? paystackResponse.data.data : null,
    trustScore,
    fraudRisk: fraudResult.risk
  };

  return addSecurityHeaders(new Response(JSON.stringify(responseBody), {
    status: success ? 200 : (paystackResponse?.status || 400),
    headers: { "Content-Type": "application/json", ...corsHeaders }
  }), requestInfo);
}

// ==================== HANDLE INTEGRITY TOKEN GENERATION ====================
export async function handleIntegrityToken(request, env, corsHeaders, requestInfo) {
  try {
    const body = await request.json();
    const endpointPath = typeof body.path === 'string' ? body.path.substring(0, 200) : null;
    const method = ['GET', 'POST', 'PUT', 'DELETE'].includes(body.method) ? body.method : null;
    const expiry = typeof body.expiry === 'number' ? Math.min(body.expiry, 300) : 60;
    
    if (!endpointPath || !method) {
      return new Response(JSON.stringify({ error: "path and method required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const fp = request.headers.get("x-device-fingerprint") || "none";
    const ua = request.headers.get("user-agent") || "";
    const uaHash = await hashUserAgent(ua);
    const nonce = crypto.randomUUID();
    const csrf = crypto.randomUUID();
    
    const payload = {
      path: endpointPath,
      method: method,
      ts: Math.floor(Date.now() / 1000),
      expiry: expiry,
      fingerprint: fp,
      ip: requestInfo.ip,
      origin: requestInfo.origin || "https://primeshieldhub.com",
      uaHash: uaHash,
      nonce: nonce,
      csrf: csrf
    };
    
    const signature = await signPayload(payload, env.GATEWAY_SECRET);
    
    return new Response(JSON.stringify({
      token: { payload, signature }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ==================== HANDLE CHECKOUT TOKEN GENERATION ====================
export async function handleCheckoutToken(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const amount = validateAmount(body.amount);
    const email = validateEmail(body.email);
    const productId = body.productId ? validateUUID(body.productId) : null;
    
    if (!amount || !email) {
      return new Response(JSON.stringify({ error: "Valid amount and email required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const tokenPayload = {
      type: "checkout",
      amount: amount,
      email: email,
      productId: productId,
      ts: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    
    const token = await generateJWT(tokenPayload, env.GATEWAY_SECRET);
    
    return new Response(JSON.stringify({ token }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
