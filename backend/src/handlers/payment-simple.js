// src/handlers/payment-simple.js
// LIGHTWEIGHT PAYMENT INITIATION – FOR IN-STORE / POS / STAFF PAYMENTS
// Integrated from api/payment/initiate.js
// Use this for quick payments where enterprise fraud pipeline isn't needed

/**
 * Simple payment initiation - no fraud detection, no fingerprint, no challenge
 * For staff/pos/in-store payments where security is handled at the physical level
 */
export async function handleSimplePaymentInitiate(request, env, ctx) {
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers
    });
  }
  
  try {
    const body = await request.json();
    const { amount, email, customer_name, phone, description, metadata } = body;
    
    // Validation
    if (!amount || amount <= 0 || amount > 10000000) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid amount' }), {
        status: 400, headers
      });
    }
    
    if (!email || !/^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email' }), {
        status: 400, headers
      });
    }
    
    // Generate unique reference
    const reference = `PSH_${Date.now()}_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    
    const paystackSecret = env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      console.error("Paystack secret not configured");
      return new Response(JSON.stringify({ success: false, error: 'Payment service unavailable' }), {
        status: 500, headers
      });
    }
    
    // Call Paystack
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let paystackResponse;
    try {
      const resp = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          email: email.trim().toLowerCase(),
          reference,
          metadata: {
            customer_name: customer_name || 'Walk-in Customer',
            phone: phone || '',
            description: description || 'Quantum Purchase',
            ...metadata,
            source: 'simple_pos'
          },
          callback_url: `${env.APP_URL || env.SITE_URL}/payment-success.html`
        }),
        signal: controller.signal
      });
      paystackResponse = await resp.json();
    } catch (err) {
      console.error("Paystack call failed:", err);
      return new Response(JSON.stringify({ success: false, error: 'Payment gateway timeout' }), {
        status: 502, headers
      });
    } finally {
      clearTimeout(timeoutId);
    }
    
    if (!paystackResponse || !paystackResponse.status) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: paystackResponse?.message || 'Payment initiation failed' 
      }), {
        status: 400, headers
      });
    }
    
    // Save transaction to D1
    if (env.DB) {
      try {
        const transactionId = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO transactions (id, reference, amount, email, customer_name, phone, status, metadata, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `).bind(
          transactionId,
          reference,
          amount,
          email.trim().toLowerCase(),
          customer_name || 'Walk-in Customer',
          phone || '',
          JSON.stringify({ description, ...metadata, source: 'simple_pos' }),
          Date.now()
        ).run();
      } catch (err) {
        console.error("Transaction save failed:", err);
        // Non-fatal - payment still initiated
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        authorization_url: paystackResponse.data.authorization_url,
        reference
      }
    }), { status: 200, headers });
    
  } catch (error) {
    console.error('Simple payment initiation error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers
    });
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function handleSimplePaymentOptions(request) {
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}
