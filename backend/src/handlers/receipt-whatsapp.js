// src/handlers/receipt-whatsapp.js
// WHATSAPP RECEIPT DELIVERY ENDPOINT
// Integrated from api/receipt/whatsapp.js
// Supports: immediate send via Twilio, queue for later, direct WhatsApp link fallback

import { sendWhatsAppReceipt } from './receipt-helpers.js';

/**
 * Send payment receipt via WhatsApp
 * Supports: sendNow=true (immediate) or sendNow=false (queue)
 */
export async function handleReceiptWhatsApp(request, env, ctx) {
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

    const { phone, receiptData, sendNow = true } = body;
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
      email: receiptData?.email || '',
      date: receiptData?.date || new Date().toISOString(),
      channel: receiptData?.channel || 'online',
      status: receiptData?.status || 'completed'
    };

    // Queue mode: store for later delivery
    if (!sendNow) {
      if (env.DB) {
        try {
          await env.DB.prepare(`
            INSERT INTO receipt_queue (type, recipient, reference, receipt_data, status, createdAt)
            VALUES ('whatsapp', ?, ?, ?, 'pending', ?)
          `).bind(
            targetPhone,
            receipt.reference,
            JSON.stringify(receipt),
            Date.now()
          ).run();

          return new Response(JSON.stringify({
            success: true,
            queued: true,
            message: 'WhatsApp receipt queued for delivery'
          }), { status: 200, headers });
        } catch (err) {
          console.error("Failed to queue WhatsApp receipt:", err);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to queue receipt'
          }), { status: 500, headers });
        }
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Database not available for queuing'
      }), { status: 500, headers });
    }

    // Immediate send mode
    // Check if Twilio is configured for proper WhatsApp delivery
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_NUMBER) {
      // Use Twilio WhatsApp Business API
      const result = await sendWhatsAppReceipt(env, receipt);

      return new Response(JSON.stringify({
        success: result.success,
        message: result.success ? 'WhatsApp receipt sent successfully' : 'Failed to send WhatsApp receipt',
        messageId: result.messageId,
        error: result.error
      }), {
        status: result.success ? 200 : 500,
        headers
      });
    } else {
      // Fallback: Generate WhatsApp direct link
      const formattedPhone = formatPhoneNumber(targetPhone);
      const message = generateWhatsAppMessage(receipt);
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

      // Log the link generation
      if (env.DB) {
        try {
          await env.DB.prepare(`
            INSERT INTO receipt_delivery_logs (reference, channel, success, sent_at)
            VALUES (?, 'whatsapp_link', 1, ?)
          `).bind(receipt.reference, Date.now()).run();
        } catch (err) {
          console.error("WhatsApp link log failed:", err);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        method: 'redirect',
        url: whatsappUrl,
        message: 'WhatsApp link generated - redirect user to send'
      }), { status: 200, headers });
    }

  } catch (error) {
    console.error('WhatsApp receipt error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process WhatsApp receipt'
    }), {
      status: 500, headers
    });
  }
}

/**
 * Format phone number to international format (234...)
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('234')) {
    cleaned = '234' + cleaned;
  }
  return cleaned;
}

/**
 * Generate WhatsApp message for receipt
 */
function generateWhatsAppMessage(receipt) {
  const formattedAmount = typeof receipt.amount === 'number'
    ? receipt.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })
    : receipt.amount;

  const formattedDate = receipt.date
    ? new Date(receipt.date).toLocaleDateString('en-NG', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    : new Date().toLocaleDateString('en-NG');

  const paymentMethod = receipt.channel === 'card' ? '💳 Card Payment' :
                         receipt.channel === 'bank' ? '🏦 Bank Transfer' :
                         receipt.channel === 'ussd' ? '📱 USSD' :
                         receipt.channel === 'transfer' ? '🏦 Bank Transfer' :
                         '💳 Online Payment';

  return `🏆 *PRIMESHIELDHUB RECEIPT* 🏆

✅ *Payment Successful!*

📋 *Transaction ID:* ${receipt.reference}
📅 *Date:* ${formattedDate}
💰 *Amount:* ₦${formattedAmount}
👤 *Customer:* ${receipt.customer_name || 'Customer'}
${paymentMethod}

🔗 *Track Order:* https://primeshieldhub.com/orders

🙏 Thank you for shopping with PrimeShieldHub!
_This is an official system-generated receipt._`;
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function handleReceiptWhatsAppOptions(request) {
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
