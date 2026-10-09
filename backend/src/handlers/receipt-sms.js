// src/handlers/receipt-sms.js
// SMS RECEIPT DELIVERY ENDPOINT
// Integrated from api/receipt/sms.js
// Uses Twilio SMS via shared receipt-helpers.js

import { sendSMSReceipt } from './receipt-helpers.js';

/**
 * Send payment receipt via SMS
 */
export async function handleReceiptSMS(request, env, ctx) {
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

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers
    });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
        status: 400, headers
      });
    }

    const { phone, receiptData } = body;
    const targetPhone = phone || receiptData?.phone;

    if (!targetPhone) {
      return new Response(JSON.stringify({ success: false, error: 'Phone number required' }), {
        status: 400, headers
      });
    }

    // Validate phone has enough digits
    const digitsOnly = targetPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid phone number' }), {
        status: 400, headers
      });
    }

    // Build receipt data with defaults
    const receipt = {
      reference: receiptData?.reference || 'N/A',
      amount: receiptData?.amount || 0,
      customer_name: receiptData?.customer_name || 'Customer',
      phone: targetPhone,
      date: receiptData?.date || new Date().toISOString(),
      channel: receiptData?.channel || 'online'
    };

    // Check Twilio configuration
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_SMS_NUMBER) {
      console.warn("SMS not configured - Twilio credentials missing");
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'SMS service not configured' 
      }), {
        status: 500, headers
      });
    }

    // Send via shared helper
    const result = await sendSMSReceipt(env, receipt);

    // Log to DB (additional log beyond what helpers do)
    if (env.DB) {
      try {
        await env.DB.prepare(`
          INSERT INTO sms_logs (phone, message, receipt_reference, status, sent_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          targetPhone,
          `Receipt for ${receipt.reference}`,
          receipt.reference,
          result.success ? 'sent' : 'failed',
          Date.now()
        ).run();
      } catch (err) {
        console.error("SMS log insert failed:", err);
      }
    }

    return new Response(JSON.stringify({
      success: result.success,
      message: result.success ? 'SMS receipt sent successfully' : 'Failed to send SMS receipt',
      error: result.error
    }), {
      status: result.success ? 200 : 500,
      headers
    });

  } catch (error) {
    console.error('SMS receipt error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to send SMS receipt' 
    }), {
      status: 500, headers
    });
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function handleReceiptSMSOptions(request) {
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
