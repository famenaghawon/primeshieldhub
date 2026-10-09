// src/handlers/payment-verify.js
// PAYMENT VERIFICATION – POST-PAYSTACK RETURN
// UPDATED: Now handles both Paystack references AND order references

/**
 * Verify a payment by reference
 * Supports both Paystack references and order references
 */
export async function handlePaymentVerify(request, env, ctx) {
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers
    });
  }

  const url = new URL(request.url);
  const reference = url.searchParams.get('reference') || 
                    url.searchParams.get('orderId') || 
                    url.searchParams.get('ref');
  
  if (!reference) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Missing reference parameter. Please provide reference, orderId, or ref.' 
    }), {
      status: 400, headers
    });
  }

  // Allow both Paystack format and order format
  const isPaystackRef = /^ref_[a-zA-Z0-9_-]+$/.test(reference) || 
                         /^pay_[a-zA-Z0-9_-]+$/.test(reference) ||
                         /^[a-zA-Z0-9_-]{10,100}$/.test(reference);
  
  const isOrderRef = /^ORD-[A-Z0-9]+$/.test(reference) ||
                      /^PSH-[0-9]+-[A-Z]+$/.test(reference) ||
                      /^order_[a-zA-Z0-9_-]+$/.test(reference);

  if (!isPaystackRef && !isOrderRef) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid reference format. Expected Paystack reference (ref_xxx) or order reference (ORD-xxx).' 
    }), {
      status: 400, headers
    });
  }

  try {
    // ============================================================
    // CASE 1: ORDER REFERENCE (ORD-xxx, PSH-xxx, etc.)
    // ============================================================
    if (isOrderRef) {
      console.log(`📦 Looking up order reference: ${reference}`);
      
      // Check in orders table first
      let order = null;
      if (env.DB) {
        try {
          order = await env.DB.prepare(`
            SELECT * FROM orders 
            WHERE reference = ? OR id = ? OR trackingId = ?
          `).bind(reference, reference, reference).first();
          
          if (order) {
            console.log(`✅ Found order in database: ${reference}`);
            
            // Check if order is already completed
            const isCompleted = order.status === 'completed' || order.status === 'success';
            
            return new Response(JSON.stringify({
              success: isCompleted,
              data: {
                reference: order.reference || reference,
                amount: order.total || 0,
                currency: 'NGN',
                email: order.customerEmail || '',
                status: isCompleted ? 'success' : 'pending',
                channel: order.paymentMethod || 'card',
                paid_at: order.paid_at || order.updated_at || order.createdAt,
                metadata: {
                  customer_name: order.customerName || 'Customer',
                  items: order.items || '',
                  orderId: order.id
                }
              },
              message: isCompleted ? 'Payment verified successfully' : 'Payment pending verification'
            }), { status: 200, headers });
          }
        } catch (err) {
          console.error("DB query failed:", err);
        }
      }

      // If not found in DB, check localStorage fallback (for development)
      // This is a fallback for when the order exists but not in DB yet
      return new Response(JSON.stringify({
        success: false,
        data: {
          reference: reference,
          status: 'pending',
          message: 'Order found but payment verification pending'
        },
        message: 'Order reference found. Please complete payment or contact support.'
      }), { status: 200, headers });
    }

    // ============================================================
    // CASE 2: PAYSTACK REFERENCE
    // ============================================================
    const paystackSecret = env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      console.error("Paystack secret not configured");
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Payment service unavailable' 
      }), {
        status: 500, headers
      });
    }

    // Verify with Paystack
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    let paystackData;
    try {
      const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      paystackData = await paystackResponse.json();
    } catch (err) {
      console.error("Paystack verification call failed:", err);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Verification service timeout' 
      }), {
        status: 502, headers
      });
    } finally {
      clearTimeout(timeoutId);
    }
    
    if (!paystackData || !paystackData.status) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: paystackData?.message || 'Verification failed' 
      }), {
        status: 400, headers
      });
    }
    
    const transaction = paystackData.data;
    const isSuccess = transaction.status === 'success';
    const verifiedAmount = transaction.amount / 100;
    const verifiedEmail = transaction.customer?.email?.toLowerCase() || '';
    const paidAt = transaction.paid_at ? new Date(transaction.paid_at).getTime() : null;
    const domain = transaction.domain; // "live" or "test"
    const now = Date.now();
    
    // Domain check - only accept live payments in production
    if (env.ENVIRONMENT === 'production' && domain !== 'live') {
      console.warn(`Test payment rejected in production: ${reference}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid payment domain' 
      }), {
        status: 400, headers
      });
    }

    // Update transaction in DB
    if (env.DB) {
      try {
        const updateResult = await env.DB.prepare(`
          UPDATE transactions 
          SET status = ?, paystack_data = ?, updated_at = ?
          WHERE reference = ?
        `).bind(
          isSuccess ? 'completed' : 'failed',
          JSON.stringify(transaction),
          now,
          reference
        ).run();

        // Also update orders table if this was an enterprise payment
        if (isSuccess && updateResult.changes > 0) {
          await env.DB.prepare(`
            UPDATE orders 
            SET status = 'completed', paid_at = ?, updated_at = ?
            WHERE reference = ? AND status != 'completed'
          `).bind(now, now, reference).run();
        }
      } catch (err) {
        console.error("DB update failed:", err);
        // Non-fatal - verification result still returned
      }
    }
    
    // If successful, queue receipt delivery
    if (isSuccess) {
      ctx.waitUntil(
        deliverReceipts(env, reference, transaction, verifiedAmount, verifiedEmail, paidAt)
      );
    }
    
    return new Response(JSON.stringify({
      success: isSuccess,
      data: {
        reference: transaction.reference,
        amount: verifiedAmount,
        currency: transaction.currency,
        email: verifiedEmail,
        status: transaction.status,
        channel: transaction.channel,
        paid_at: transaction.paid_at,
        domain: domain
      },
      message: isSuccess ? 'Payment verified successfully' : 'Payment verification failed'
    }), { status: 200, headers });
    
  } catch (error) {
    console.error('Payment verification error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal verification error: ' + error.message
    }), {
      status: 500, headers
    });
  }
}

/**
 * Deliver receipts via available channels
 * Non-blocking - runs in background via ctx.waitUntil
 */
async function deliverReceipts(env, reference, transaction, amount, email, paidAt) {
  try {
    // Get transaction details from DB
    let txData = null;
    if (env.DB) {
      try {
        txData = await env.DB.prepare(
          "SELECT * FROM transactions WHERE reference = ?"
        ).bind(reference).first();
      } catch (e) {
        console.error("Failed to fetch transaction for receipt:", e);
      }
    }

    const receiptData = {
      reference: reference,
      amount: amount,
      customer_name: txData?.customer_name || transaction.metadata?.customer_name || 'Customer',
      email: email || txData?.email || '',
      phone: txData?.phone || transaction.metadata?.phone || '',
      date: paidAt || Date.now(),
      channel: transaction.channel || 'unknown',
      status: transaction.status || 'success',
      description: txData?.metadata ? 
        (typeof txData.metadata === 'string' ? JSON.parse(txData.metadata) : txData.metadata)?.description : 
        'Purchase'
    };

    // Try to send via each available channel
    const deliveryPromises = [];

    // Email receipt
    if (receiptData.email && env.NOTIFICATION_WEBHOOK_URL) {
      deliveryPromises.push(
        fetch(`${env.NOTIFICATION_WEBHOOK_URL}/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: receiptData.email,
            subject: `Payment Receipt - ${reference}`,
            template: 'payment_receipt',
            data: receiptData
          })
        }).catch(e => console.error("Email receipt failed:", e.message))
      );
    }

    // WhatsApp receipt
    if (receiptData.phone && env.NOTIFICATION_WEBHOOK_URL) {
      deliveryPromises.push(
        fetch(`${env.NOTIFICATION_WEBHOOK_URL}/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: receiptData.phone,
            template: 'payment_receipt',
            data: receiptData
          })
        }).catch(e => console.error("WhatsApp receipt failed:", e.message))
      );
    }

    // SMS receipt
    if (receiptData.phone) {
      deliveryPromises.push(
        fetch(`https://api.primeshieldhub.com/api/notify/sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: receiptData.phone,
            message: `PrimeShieldHub: Payment of ₦${amount.toFixed(2)} received. Ref: ${reference}. Thank you!`
          })
        }).catch(e => console.error("SMS receipt failed:", e.message))
      );
    }

    // Log receipt delivery attempt
    if (env.PAYMENT_LOGS_DB) {
      try {
        await env.PAYMENT_LOGS_DB.prepare(`
          INSERT INTO receipt_logs (reference, email, phone, amount, status, createdAt)
          VALUES (?, ?, ?, ?, 'queued', ?)
        `).bind(reference, receiptData.email, receiptData.phone, amount, Date.now()).run();
      } catch (e) {
        console.error("Receipt log failed:", e);
      }
    }

    // Wait for all deliveries (still within waitUntil)
    await Promise.allSettled(deliveryPromises);
    
  } catch (error) {
    console.error("Receipt delivery error:", error);
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function handlePaymentVerifyOptions(request) {
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}
