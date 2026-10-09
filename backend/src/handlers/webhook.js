// src/handlers/webhook.js
// ENTERPRISE‑GRADE PAYSTACK WEBHOOK HANDLER – FULLY INTEGRATED
// Integrated from api/paystackWebhook.js + api/payment/webhook.js
// All Upstash migrated to RATE_LIMITER KV, ORDERS_DB → DB
// Now handles: charge.success, charge.dispute.create, transfer.success, charge.refunded

import { safeCompare, signPayload } from '../utils/crypto.js';

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

// ==================== FRAUD SCORE HELPERS ====================
async function getFraudRiskScore(env, fingerprint, ip, email) {
  let risk = 0;

  const deviceRep = Number(await kvGet(env, `rep:device:${fingerprint}`) || 50);
  const ipRep = Number(await kvGet(env, `rep:ip:${ip}`) || 50);
  const emailRep = Number(await kvGet(env, `rep:email:${email}`) || 50);
  risk += (100 - deviceRep) * 0.35;
  risk += (100 - ipRep) * 0.35;
  risk += (100 - emailRep) * 0.3;

  const paymentVelocityKey = `payments:${ip}`;
  let recentPayments = Number(await kvGet(env, paymentVelocityKey) || 0);
  if (recentPayments > 5) risk += 20;

  const flagged = await kvGet(env, `flagged:${ip}`);
  if (flagged) risk += 30;

  return Math.min(100, Math.max(0, risk));
}

// ==================== LOG FAILED WEBHOOK ====================
async function logFailedWebhook(env, reference, event, reason) {
  if (env.PAYMENT_LOGS_DB) {
    try {
      await env.PAYMENT_LOGS_DB.prepare(`
        INSERT INTO webhook_logs (reference, event, processed_at, success, failure_reason)
        VALUES (?, ?, ?, ?, ?)
      `).bind(reference, event, Date.now(), 0, reason).run();
    } catch (err) {
      console.error("Failed to log failed webhook", err);
    }
  }
}

// ==================== LOG SUCCESSFUL WEBHOOK ====================
async function logSuccessfulWebhook(env, reference, event, fraudRiskScore) {
  if (env.PAYMENT_LOGS_DB) {
    try {
      await env.PAYMENT_LOGS_DB.prepare(`
        INSERT INTO webhook_logs (reference, event, processed_at, success, fraud_risk)
        VALUES (?, ?, ?, ?, ?)
      `).bind(reference, event, Date.now(), 1, fraudRiskScore).run();
    } catch (err) {
      console.error("Webhook log insert failed", err);
    }
  }
}

// ==================== HANDLE DISPUTE ====================
async function handleDispute(env, data) {
  const reference = data.reference;
  const now = Date.now();
  
  console.warn(`Dispute created for reference: ${reference}`);
  
  if (env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO disputes (reference, amount, customer_email, status, paystack_data, created_at)
        VALUES (?, ?, ?, 'open', ?, ?)
      `).bind(
        reference,
        (data.amount || 0) / 100,
        data.customer?.email || '',
        JSON.stringify(data),
        now
      ).run();

      // Mark transaction as disputed
      await env.DB.prepare(`
        UPDATE transactions 
        SET status = 'disputed', updated_at = ?
        WHERE reference = ?
      `).bind(now, reference).run();

      // Mark order as disputed
      await env.DB.prepare(`
        UPDATE orders 
        SET status = 'disputed', updated_at = ?
        WHERE reference = ? AND status = 'completed'
      `).bind(now, reference).run();
    } catch (err) {
      console.error("Dispute handling DB error:", err);
    }
  }
  
  // Log to payment logs
  if (env.PAYMENT_LOGS_DB) {
    try {
      await env.PAYMENT_LOGS_DB.prepare(`
        INSERT INTO webhook_logs (reference, event, processed_at, success, details)
        VALUES (?, 'charge.dispute.create', ?, 1, ?)
      `).bind(reference, now, JSON.stringify({ amount: data.amount, email: data.customer?.email })).run();
    } catch (err) {
      console.error("Dispute log failed:", err);
    }
  }

  // Telegram alert for disputes
  if (env.TELEGRAM_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `⚠️ Dispute Alert\nReference: ${reference}\nAmount: ₦${((data.amount || 0) / 100).toFixed(2)}\nEmail: ${data.customer?.email || 'N/A'}\nStatus: OPEN\n\nAction Required: Review dispute in admin panel.`
        }),
      }).catch(() => {});
    } catch (e) {
      console.error("Dispute telegram alert failed:", e);
    }
  }
  
  // Decrease reputation for disputed transactions
  if (data.customer?.email) {
    await decreaseReputation(env, `rep:email:${data.customer.email.toLowerCase()}`, 15);
  }
  if (data.metadata?.ip) {
    await decreaseReputation(env, `rep:ip:${data.metadata.ip}`, 20);
  }
  if (data.metadata?.fingerprint) {
    await decreaseReputation(env, `rep:device:${data.metadata.fingerprint}`, 20);
  }
}

// ==================== HANDLE TRANSFER SUCCESS ====================
async function handleTransferSuccess(env, data) {
  const reference = data.reference;
  const now = Date.now();
  
  console.log(`Transfer successful: ${reference} - Amount: ${(data.amount || 0) / 100}`);
  
  if (env.DB) {
    try {
      // Update payouts table
      await env.DB.prepare(`
        UPDATE payouts 
        SET status = 'completed', paystack_data = ?, updated_at = ?
        WHERE reference = ?
      `).bind(JSON.stringify(data), now, reference).run();

      // Update commissions if linked
      await env.DB.prepare(`
        UPDATE commissions 
        SET status = 'paid', updated_at = ?
        WHERE payout_reference = ? AND status = 'pending'
      `).bind(now, reference).run();
    } catch (err) {
      console.error("Transfer success DB update failed:", err);
    }
  }
  
  if (env.PAYMENT_LOGS_DB) {
    try {
      await env.PAYMENT_LOGS_DB.prepare(`
        INSERT INTO webhook_logs (reference, event, processed_at, success, details)
        VALUES (?, 'transfer.success', ?, 1, ?)
      `).bind(reference, now, JSON.stringify({ amount: data.amount, recipient: data.recipient })).run();
    } catch (err) {
      console.error("Transfer log failed:", err);
    }
  }

  // Telegram notification for successful transfers
  if (env.TELEGRAM_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `✅ Transfer Successful\nReference: ${reference}\nAmount: ₦${((data.amount || 0) / 100).toFixed(2)}\nRecipient: ${data.recipient?.name || 'N/A'}`
        }),
      }).catch(() => {});
    } catch (e) {
      console.error("Transfer telegram alert failed:", e);
    }
  }
}

// ==================== HANDLE REFUND ====================
async function handleRefund(env, data) {
  const reference = data.reference;
  const now = Date.now();
  
  console.warn(`Refund processed for reference: ${reference}`);
  
  if (env.DB) {
    try {
      // Update transactions
      await env.DB.prepare(`
        UPDATE transactions 
        SET status = 'refunded', updated_at = ?
        WHERE reference = ?
      `).bind(now, reference).run();

      // Update orders
      await env.DB.prepare(`
        UPDATE orders 
        SET status = 'refunded', updated_at = ?
        WHERE reference = ?
      `).bind(now, reference).run();
    } catch (err) {
      console.error("Refund DB update failed:", err);
    }
  }

  if (env.PAYMENT_LOGS_DB) {
    try {
      await env.PAYMENT_LOGS_DB.prepare(`
        INSERT INTO webhook_logs (reference, event, processed_at, success, details)
        VALUES (?, 'charge.refunded', ?, 1, ?)
      `).bind(reference, now, JSON.stringify({ amount: data.amount })).run();
    } catch (err) {
      console.error("Refund log failed:", err);
    }
  }

  // Telegram notification for refunds
  if (env.TELEGRAM_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `🔄 Refund Processed\nReference: ${reference}\nAmount: ₦${((data.amount || 0) / 100).toFixed(2)}\nTransaction has been refunded.`
        }),
      }).catch(() => {});
    } catch (e) {
      console.error("Refund telegram alert failed:", e);
    }
  }
}

// ==================== MAIN WEBHOOK HANDLER ====================
export async function handlePaystackWebhook(request, env, ctx) {
  const headers = {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
  };

  // 0. METHOD ENFORCEMENT
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers });
  }

  // 1. CONTENT‑TYPE
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return new Response(JSON.stringify({ error: "Invalid content type" }), { status: 415, headers });
  }

  // 2. WEBHOOK RATE LIMITING (anti‑DoS) - migrated from Redis to KV
  const webhookIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateKey = `webhook_rate:${webhookIp}`;
  const rateCount = Number(await kvGet(env, rateKey) || 0);
  if (rateCount > 100) {
    console.warn(`Webhook rate limit exceeded for IP ${webhookIp}`);
    return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers });
  }
  await kvSet(env, rateKey, rateCount + 1, 60);

  // 3. SIGNATURE VERIFICATION
  const paystackSignature = request.headers.get("x-paystack-signature");
  if (!paystackSignature) {
    return new Response(JSON.stringify({ error: "Missing signature" }), { status: 403, headers });
  }

  const rawBody = await request.text();
  const secret = env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error("PAYSTACK_SECRET_KEY not configured");
    return new Response(JSON.stringify({ error: "Internal configuration error" }), { status: 500, headers });
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(rawBody));
  const computedSignature = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");

  if (!safeCompare(computedSignature, paystackSignature)) {
    console.warn("Invalid Paystack signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 403, headers });
  }

  // 4. PARSE PAYLOAD
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  if (!payload.event || !payload.data) {
    return new Response(JSON.stringify({ error: "Missing event or data" }), { status: 400, headers });
  }

  const eventType = payload.event;
  const now = Date.now();

  // ==================== EVENT: charge.dispute.create ====================
  if (eventType === "charge.dispute.create") {
    await handleDispute(env, payload.data);
    return new Response(JSON.stringify({ status: "dispute_recorded" }), { status: 200, headers });
  }

  // ==================== EVENT: transfer.success ====================
  if (eventType === "transfer.success") {
    await handleTransferSuccess(env, payload.data);
    return new Response(JSON.stringify({ status: "transfer_recorded" }), { status: 200, headers });
  }

  // ==================== EVENT: charge.refunded ====================
  if (eventType === "charge.refunded") {
    await handleRefund(env, payload.data);
    return new Response(JSON.stringify({ status: "refund_recorded" }), { status: 200, headers });
  }

  // ==================== EVENT: charge.success (ENTERPRISE FLOW) ====================
  if (eventType !== "charge.success") {
    // Log unhandled events for monitoring
    console.log(`Unhandled webhook event: ${eventType}`);
    if (env.PAYMENT_LOGS_DB) {
      try {
        await env.PAYMENT_LOGS_DB.prepare(`
          INSERT INTO webhook_logs (reference, event, processed_at, success, details)
          VALUES (?, ?, ?, 1, ?)
        `).bind(
          payload.data?.reference || 'unknown',
          eventType,
          now,
          JSON.stringify({ message: 'Unhandled event type, logged for monitoring' })
        ).run();
      } catch (err) {
        console.error("Unhandled event log failed:", err);
      }
    }
    return new Response(JSON.stringify({ status: "ignored", event: eventType }), { status: 200, headers });
  }

  // ==================== CHARGE.SUCCESS - FULL ENTERPRISE FLOW ====================
  
  const transactionData = payload.data;
  const reference = transactionData.reference;
  const webhookAmount = transactionData.amount;
  const webhookCurrency = transactionData.currency;
  const customerEmail = transactionData.customer?.email?.toLowerCase() || "";
  const metadata = transactionData.metadata || {};
  const fingerprint = metadata.fingerprint;
  const ip = metadata.ip;
  const userAgent = metadata.userAgent;
  const trustScore = metadata.trustScore;

  // Store signature for forensic reference (migrated to KV)
  await kvSet(env, `webhook_sig:${reference}`, paystackSignature, 86400);

  // 5. IDEMPOTENCY CHECK
  const idempotencyKey = `webhook:${reference}`;
  const alreadyProcessed = await env.RATE_LIMITER?.get(idempotencyKey);
  if (alreadyProcessed) {
    return new Response(JSON.stringify({ status: "already_processed" }), { status: 200, headers });
  }

  // 6. SERVER-SIDE VERIFICATION
  let verifyResponse;
  try {
    const verifyUrl = `https://api.paystack.co/transaction/verify/${reference}`;
    const resp = await fetch(verifyUrl, {
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }
    });
    verifyResponse = await resp.json();
  } catch (err) {
    console.error("Verification call failed", err);
    return new Response(JSON.stringify({ error: "Verification service error" }), { status: 502, headers });
  }

  if (!verifyResponse || verifyResponse.status !== true || !verifyResponse.data) {
    await logFailedWebhook(env, reference, payload.event, "verification_failed");
    return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400, headers });
  }

  const verifiedData = verifyResponse.data;
  const verifiedAmount = verifiedData.amount;
  const verifiedCurrency = verifiedData.currency;
  const verifiedReference = verifiedData.reference;
  const verifiedEmail = verifiedData.customer?.email?.toLowerCase() || "";
  const verifiedStatus = verifiedData.status;
  const paidAt = verifiedData.paid_at ? new Date(verifiedData.paid_at).getTime() : null;
  const domain = verifiedData.domain; // "live" or "test"

  // 7. DOMAIN CHECK (critical)
  if (!domain || domain !== "live") {
    await logFailedWebhook(env, reference, payload.event, "invalid_domain");
    return new Response(JSON.stringify({ error: "Invalid domain" }), { status: 400, headers });
  }

  // 8. PAID_AT MUST EXIST
  if (!paidAt) {
    await logFailedWebhook(env, reference, payload.event, "missing_paid_at");
    return new Response(JSON.stringify({ error: "Invalid payment timestamp" }), { status: 400, headers });
  }

  // 9. REFERENCE MATCH
  if (verifiedReference !== reference) {
    await logFailedWebhook(env, reference, payload.event, "reference_mismatch");
    return new Response(JSON.stringify({ error: "Reference mismatch" }), { status: 400, headers });
  }

  // 10. STATUS CHECK
  if (verifiedStatus !== "success") {
    await logFailedWebhook(env, reference, payload.event, "not_success_status");
    return new Response(JSON.stringify({ error: "Payment not successful" }), { status: 400, headers });
  }

  // 11. TIME WINDOW (anti‑replay)
  if (now - paidAt > 1000 * 60 * 60 * 24) { // 24 hours
    await logFailedWebhook(env, reference, payload.event, "stale_payment");
    return new Response(JSON.stringify({ error: "Stale payment" }), { status: 400, headers });
  }

  // 12. CURRENCY VALIDATION
  if (verifiedCurrency !== "NGN") {
    await logFailedWebhook(env, reference, payload.event, "invalid_currency");
    return new Response(JSON.stringify({ error: "Invalid currency" }), { status: 400, headers });
  }

  // 13. LOAD ORDER - FIXED: ORDERS_DB → DB
  if (!env.DB) {
    console.error("DB not configured");
    return new Response(JSON.stringify({ error: "Internal configuration error" }), { status: 500, headers });
  }

  let order;
  try {
    order = await env.DB.prepare(
      "SELECT amount, customerEmail as email, status, 'NGN' as currency FROM orders WHERE reference = ?"
    ).bind(reference).first();
  } catch (err) {
    console.error("DB read failed", err);
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
  }

  if (!order) {
    // Order not in orders table - try transactions table (simple POS payments)
    let transaction;
    try {
      transaction = await env.DB.prepare(
        "SELECT amount, email, status FROM transactions WHERE reference = ?"
      ).bind(reference).first();
    } catch (err) {
      console.error("Transaction DB read failed", err);
    }
    
    if (!transaction) {
      await logFailedWebhook(env, reference, payload.event, "order_not_found");
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers });
    }
    
    // Update simple transaction
    try {
      await env.DB.prepare(`
        UPDATE transactions 
        SET status = 'completed', paystack_data = ?, updated_at = ?
        WHERE reference = ?
      `).bind(JSON.stringify(verifiedData), now, reference).run();
    } catch (err) {
      console.error("Transaction update failed", err);
    }
    
    order = transaction;
  }

  // 14. AMOUNT VALIDATION
  const storedAmountKobo = Math.round(order.amount * 100);
  if (storedAmountKobo !== verifiedAmount) {
    await logFailedWebhook(env, reference, payload.event, "amount_mismatch");
    return new Response(JSON.stringify({ error: "Amount mismatch" }), { status: 400, headers });
  }

  // 15. EMAIL VALIDATION
  if (order.email && verifiedEmail && order.email.toLowerCase() !== verifiedEmail) {
    await logFailedWebhook(env, reference, payload.event, "email_mismatch");
    return new Response(JSON.stringify({ error: "Customer mismatch" }), { status: 400, headers });
  }

  // 16. CONDITIONAL ORDER UPDATE
  let orderUpdated = false;
  if (order.status !== "completed" && order.status !== "paid") {
    try {
      const result = await env.DB.prepare(`
        UPDATE orders
        SET status = 'completed',
            paid_at = ?,
            paystack_data = ?,
            updated_at = ?
        WHERE reference = ?
        AND status != 'completed'
        AND status != 'paid'
      `).bind(now, JSON.stringify(verifiedData), now, reference).run();
      orderUpdated = result.changes > 0;
      
      // Also update transactions table
      await env.DB.prepare(`
        UPDATE transactions 
        SET status = 'completed', paystack_data = ?, updated_at = ?
        WHERE reference = ?
      `).bind(JSON.stringify(verifiedData), now, reference).run();
    } catch (err) {
      console.error("DB update failed", err);
      return new Response(JSON.stringify({ error: "Database update failed" }), { status: 500, headers });
    }
  } else {
    orderUpdated = true; // Already completed
  }

  // 17. MARK IDEMPOTENT (after successful update)
  try {
    await env.RATE_LIMITER?.put(idempotencyKey, "1", {
      expirationTtl: 86400,
      nx: true
    });
  } catch {
    const existing = await env.RATE_LIMITER?.get(idempotencyKey);
    if (!existing) {
      await env.RATE_LIMITER?.put(idempotencyKey, "1", { expirationTtl: 86400 });
    }
  }

  // 18. UPDATE REPUTATION (migrated from Redis to KV)
  if (fingerprint && fingerprint.length >= 32) {
    await increaseReputation(env, `rep:device:${fingerprint}`, 5);
  }
  if (ip && ip !== "unknown") {
    await increaseReputation(env, `rep:ip:${ip}`, 5);
  }
  if (verifiedEmail) {
    await increaseReputation(env, `rep:email:${verifiedEmail}`, 5);
  }

  // 19. VELOCITY UPDATE (for fraud scoring) - migrated to KV
  const paymentVelocityKey = `payments:${ip}`;
  let recentPayments = Number(await kvGet(env, paymentVelocityKey) || 0);
  await kvSet(env, paymentVelocityKey, recentPayments + 1, 60);

  // 20. FRAUD RISK SCORE
  const fraudRiskScore = await getFraudRiskScore(env, fingerprint, ip, verifiedEmail);
  const shouldDelayFulfillment = fraudRiskScore > 70;

  // 21. NEGATIVE FEEDBACK: if high risk, flag IP (migrated to KV)
  if (fraudRiskScore > 80) {
    await kvSet(env, `flagged:${ip}`, "1", 3600); // 1 hour
  }

  // 22. SAFE FULFILLMENT with retry queue
  if (shouldDelayFulfillment) {
    // Send to manual review queue
    if (env.REVIEW_QUEUE_URL) {
      ctx.waitUntil(
        fetch(env.REVIEW_QUEUE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference, fraudRiskScore, reason: "High risk detected" })
        }).catch(e => console.error("Review queue failed", e))
      );
    }
    // Also add to failed fulfillment queue for possible later retry (migrated to KV)
    await kvSet(env, `failed_fulfillment:${reference}`, JSON.stringify({
      reference,
      retryAt: Date.now() + 60000,
      fraudRiskScore
    }), 3600);
  } else {
    // Auto-fulfill with signed token
    ctx.waitUntil(
      (async () => {
        try {
          const fulfillmentPayload = { reference, timestamp: now };
          const fulfillmentSig = await signPayload(fulfillmentPayload, env.GATEWAY_SECRET);
          const fulfillmentHeaders = {
            "Content-Type": "application/json",
            "x-integrity-token": JSON.stringify({ payload: fulfillmentPayload, signature: fulfillmentSig })
          };
          if (env.FULFILLMENT_WEBHOOK_URL) {
            await fetch(env.FULFILLMENT_WEBHOOK_URL, {
              method: "POST",
              headers: fulfillmentHeaders,
              body: JSON.stringify({
                reference,
                customer: { email: verifiedEmail },
                items: metadata.items || [],
                trustScore,
                fraudRiskScore
              })
            });
          }
        } catch (err) {
          console.error("Fulfillment trigger failed", err);
          // Store in retry queue (migrated to KV)
          await kvSet(env, `failed_fulfillment:${reference}`, JSON.stringify({
            reference,
            retryAt: Date.now() + 60000,
            error: err.message
          }), 3600);
        }
      })()
    );
  }

  // 23. TELEGRAM ALERT (sanitized)
  if (env.TELEGRAM_TOKEN && env.TELEGRAM_CHAT_ID) {
    ctx.waitUntil(
      fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `💰 Payment successful\nReference: ${reference}\nAmount: ₦${(verifiedAmount / 100).toFixed(2)}\nEmail: ${verifiedEmail}\nRisk: ${fraudRiskScore}\nFingerprint: ${fingerprint?.slice(0, 10)}...\nIP: ${ip}`
        }),
      }).catch(() => {})
    );
  }

  // 24. LOG SUCCESS
  await logSuccessfulWebhook(env, reference, payload.event, fraudRiskScore);

  // 25. RESPONSE
  return new Response(
    JSON.stringify({
      status: "success",
      reference,
      orderUpdated,
      fraudRiskScore,
      delayedFulfillment: shouldDelayFulfillment
    }),
    { status: 200, headers }
  );
}

// ==================== OPTIONS HANDLER ====================
export async function handleWebhookOptions(request) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://primeshieldhub.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-paystack-signature",
      "Access-Control-Max-Age": "86400",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
    }
  });
}
