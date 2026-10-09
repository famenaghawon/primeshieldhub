// src/handlers/anomalies.js
// ENTERPRISE‑GRADE ANOMALY ENGINE – FULLY INTEGRATED
// Integrated from api/anomalies.js
// All Upstash migrated to RATE_LIMITER KV, duplicate crypto removed

import { safeCompare, hashUserAgent, signPayload, verifySignature } from '../utils/crypto.js';

// ==================== KV HELPERS (migrated from Upstash Redis) ====================
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

// ==================== MAIN ANOMALY HANDLER ====================
export async function handleAnomalies(request, env, ctx) {
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
    "Access-Control-Allow-Headers": "Content-Type, x-device-fingerprint, x-integrity-token, x-primeshield-auth",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
  };

  // 0. METHOD ENFORCEMENT
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers });
  }

  // 1. Strict Origin Validation
  const origin = request.headers.get("Origin") || "";
  if (!allowedOrigins.includes(origin) && !origin.includes("localhost")) {
    return new Response(JSON.stringify({ error: "Invalid origin" }), {
      status: 403,
      headers
    });
  }

  // 2. CONTENT‑TYPE & SIZE
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return new Response(JSON.stringify({ error: "Invalid content type" }), {
      status: 415,
      headers
    });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > 10000) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413,
      headers
    });
  }

  // 3. EXTRACT HEADERS
  const fingerprint = request.headers.get("x-device-fingerprint")?.trim();
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const userAgent = request.headers.get("User-Agent") || "";

  if (!fingerprint || fingerprint.length < 32) {
    return new Response(JSON.stringify({ error: "Invalid fingerprint" }), {
      status: 403,
      headers
    });
  }

  if (!userAgent || userAgent.length < 10) {
    return new Response(JSON.stringify({ error: "Invalid client" }), {
      status: 403,
      headers
    });
  }

  // 4. ENFORCE WORKER AUTH HEADER (CRITICAL)
  const gatewayAuth = request.headers.get("x-primeshield-auth");
  if (!gatewayAuth || !safeCompare(gatewayAuth, env.GATEWAY_SECRET)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers
    });
  }

  // 5. VALIDATE INTEGRITY TOKEN
  const tokenResult = await validateToken(request, env, { requireCheckout: false });
  if (!tokenResult.valid) {
    return new Response(JSON.stringify({ error: tokenResult.error }), {
      status: tokenResult.status,
      headers
    });
  }

  // 6. PARSE & LIMIT JSON COMPLEXITY
  let anomalies;
  try {
    anomalies = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers
    });
  }

  if (JSON.stringify(anomalies).length > 10000) {
    return new Response(JSON.stringify({ error: "Payload too complex" }), {
      status: 413,
      headers
    });
  }

  if (!anomalies || typeof anomalies !== "object") {
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers
    });
  }

  const anomalyList = anomalies.anomalies || [];
  if (!Array.isArray(anomalyList)) {
    return new Response(JSON.stringify({ error: "anomalies must be an array" }), {
      status: 400,
      headers
    });
  }

  // 7. ADAPTIVE RATE LIMITING (migrated to KV)
  const ipRep = await getReputation(env, `rep:ip:${ip}`);
  const deviceRep = await getReputation(env, `rep:device:${fingerprint}`);
  const trustScore = Math.round(ipRep * 0.5 + deviceRep * 0.5);

  let rateLimit = 30;
  if (trustScore > 80) rateLimit = 100;
  else if (trustScore > 50) rateLimit = 60;
  else if (trustScore < 20) rateLimit = 10;

  const rateLimitKey = `anomaly:${ip}:${fingerprint}`;
  const currentCount = Number(await env.RATE_LIMITER?.get(rateLimitKey) || 0);
  if (currentCount > rateLimit) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers
    });
  }
  await env.RATE_LIMITER?.put(rateLimitKey, (currentCount + 1).toString(), {
    expirationTtl: 60
  });

  // 8. SCORING ENGINE
  let totalRiskScore = 0;
  const scoredAnomalies = [];

  const anomalyWeights = {
    "rapid_clicks": 20,
    "invalid_token": 35,
    "suspicious_behavior": 25,
    "unusual_location": 15,
    "multiple_accounts": 30,
    "bot_like": 40,
    "high_velocity_checkout": 25,
    "script_detected": 50,
    "cart_abuse": 20,
    "price_scraping": 30,
    "fingerprint_mismatch": 45,
    "pixel_tampering": 60,
    "network_anomaly": 20,
    "human_verification_failure": 35,
    "device_emulation": 70
  };

  const severityMultipliers = {
    "low": 0.5,
    "medium": 1.0,
    "high": 2.0,
    "critical": 3.0
  };

  const now = Date.now();
  for (const anomaly of anomalyList) {
    const type = anomaly.type;
    const severity = anomaly.severity || "medium";
    const details = anomaly.details || {};
    const timestamp = anomaly.timestamp || now;

    let score = anomalyWeights[type] || 10;
    score *= severityMultipliers[severity] || 1.0;

    const age = now - timestamp;
    const recencyWeight = age < 5000 ? 1.5 : age < 30000 ? 1.0 : 0.8;
    score *= recencyWeight;

    if (details.productId && details.price > 500000) score *= 1.2;
    if (details.isReseller) score *= 0.8;
    if (details.userType === "VIP") score *= 0.5;

    score = Math.min(score, 100);
    totalRiskScore += score;

    scoredAnomalies.push({ ...anomaly, computedScore: score });
  }

  let riskScore = Math.min(totalRiskScore, 100);
  if (anomalyList.length === 0) riskScore = 0;

  // 9. AI CLASSIFICATION
  let aiAnalysis = null;
  if (env.OPENAI_API_KEY && anomalyList.length > 0 && riskScore > 50) {
    try {
      const aiPrompt = `Analyze these anomalies and return a JSON with:
        - "classification": "benign|suspicious|malicious"
        - "risk_adjustment": integer -10 to 10
        - "explanation": short sentence
      Anomalies: ${JSON.stringify(scoredAnomalies)}`;
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: aiPrompt }],
          temperature: 0.2,
          response_format: { type: "json_object" }
        })
      });
      const aiData = await aiResponse.json();
      const aiText = aiData.choices?.[0]?.message?.content || "{}";
      aiAnalysis = JSON.parse(aiText);
      if (aiAnalysis.risk_adjustment) {
        riskScore = Math.min(100, Math.max(0, riskScore + aiAnalysis.risk_adjustment));
      }
    } catch (err) {
      console.error("AI analysis failed:", err);
    }
  }

  // 10. DETERMINE ACTION
  let action = "allow";
  if (riskScore >= 90) action = "block";
  else if (riskScore >= 70) action = "challenge";
  else if (riskScore >= 40) action = "monitor";

  // 11. PERSIST TO PAYMENT_LOGS_DB (ANOMALIES_DB not bound, using PAYMENT_LOGS_DB)
  if (env.PAYMENT_LOGS_DB) {
    try {
      const stmt = env.PAYMENT_LOGS_DB.prepare(`
        INSERT INTO anomalies (fingerprint, ip, user_agent, type, severity, details, timestamp, risk_score, action)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of anomalyList) {
        await stmt.bind(
          fingerprint,
          ip,
          userAgent,
          a.type,
          a.severity || "medium",
          JSON.stringify(a.details || {}),
          a.timestamp || now,
          riskScore,
          action
        ).run();
      }
    } catch (err) {
      console.error("D1 insert failed:", err);
    }
  }

  // 12. UPDATE REPUTATION (migrated to KV)
  const reputationKey = `reputation:${fingerprint}`;
  let reputationRaw = await env.RATE_LIMITER?.get(reputationKey);
  let reputation;
  if (reputationRaw) {
    try {
      reputation = JSON.parse(reputationRaw);
    } catch {
      reputation = { score: 0, lastUpdate: now, anomalyCount: 0, actions: [] };
    }
  } else {
    reputation = { score: 0, lastUpdate: now, anomalyCount: 0, actions: [] };
  }
  
  reputation.anomalyCount = (reputation.anomalyCount || 0) + anomalyList.length;
  const timeDecay = Math.exp(-(now - reputation.lastUpdate) / 3600000); // 1h half-life
  reputation.score = (reputation.score * timeDecay) + riskScore * 0.1;
  reputation.lastUpdate = now;
  reputation.actions = reputation.actions || [];
  reputation.actions.push({ timestamp: now, action, riskScore });
  if (reputation.actions.length > 20) reputation.actions = reputation.actions.slice(-20);
  
  await env.RATE_LIMITER?.put(reputationKey, JSON.stringify(reputation), {
    expirationTtl: 86400
  });

  // Update global IP/device reputation (migrated to KV)
  if (action === "block") {
    await decreaseReputation(env, `rep:ip:${ip}`, 20);
    await decreaseReputation(env, `rep:device:${fingerprint}`, 20);
  } else if (action === "monitor" && riskScore > 50) {
    await decreaseReputation(env, `rep:ip:${ip}`, 5);
    await decreaseReputation(env, `rep:device:${fingerprint}`, 5);
  } else if (action === "allow" && riskScore < 20) {
    await increaseReputation(env, `rep:ip:${ip}`, 1);
    await increaseReputation(env, `rep:device:${fingerprint}`, 1);
  }

  // 13. ALERT HIGH-RISK EVENTS
  if (riskScore >= 80 && env.ALERT_WEBHOOK_URL) {
    ctx.waitUntil(
      fetch(env.ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint,
          ip,
          riskScore,
          action,
          anomalies: anomalyList,
          timestamp: now,
          environment: env.ENVIRONMENT || "production"
        })
      }).catch(e => console.error("Alert webhook failed", e))
    );
  }

  // 14. RESPONSE
  const responseBody = {
    success: true,
    riskScore,
    action,
    anomalyCount: anomalyList.length,
    aiAnalysis: aiAnalysis || null,
    timestamp: now
  };

  if (action === "challenge") {
    const challengePayload = { fingerprint, ts: now };
    const challengeSig = await signPayload(challengePayload, env.GATEWAY_SECRET);
    responseBody.challengeToken = JSON.stringify({
      payload: challengePayload,
      signature: challengeSig
    });
  }

  return new Response(JSON.stringify(responseBody), { status: 200, headers });
}

// ==================== OPTIONS HANDLER ====================
export async function handleAnomaliesOptions(request) {
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
      "Access-Control-Allow-Headers": "Content-Type, x-device-fingerprint, x-integrity-token, x-primeshield-auth",
      "Access-Control-Max-Age": "86400",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
    }
  });
}
