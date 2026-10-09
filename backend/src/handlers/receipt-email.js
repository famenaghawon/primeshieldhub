// src/handlers/receipt-email.js
// EMAIL RECEIPT DELIVERY
// Integrated from api/receipt/email.js
// Uses Resend API (RESEND_API_KEY secret)

/**
 * Send payment receipt via email
 */
export async function handleReceiptEmail(request, env, ctx) {
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
    
    const { email, receiptData } = body;
    
    const targetEmail = email || receiptData?.email;
    if (!targetEmail || !/^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(targetEmail)) {
      return new Response(JSON.stringify({ success: false, error: 'Valid email required' }), {
        status: 400, headers
      });
    }
    
    // Build receipt data with defaults
    const receipt = {
      reference: receiptData?.reference || 'N/A',
      amount: receiptData?.amount || 0,
      customer_name: receiptData?.customer_name || 'Customer',
      date: receiptData?.date || new Date().toISOString(),
      channel: receiptData?.channel || 'online',
      email: targetEmail,
      phone: receiptData?.phone || '',
      status: receiptData?.status || 'completed'
    };
    
    // Generate email content
    const html = generateEmailHTML(receipt);
    const text = generateEmailText(receipt);
    const subject = `PrimeShieldHub Payment Receipt - ${receipt.reference}`;
    
    // Send via Resend (preferred) or fallback
    const result = await sendEmail(env, targetEmail, subject, html, text);
    
    // Log email attempt to DB
    if (env.DB) {
      try {
        await env.DB.prepare(`
          INSERT INTO email_logs (email, receipt_reference, subject, status, sent_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          targetEmail,
          receipt.reference,
          subject,
          result.success ? 'sent' : 'failed',
          Date.now()
        ).run();
      } catch (err) {
        console.error("Email log insert failed:", err);
      }
    }
    
    if (!result.success) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: result.error || 'Failed to send email' 
      }), {
        status: 500, headers
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Receipt email sent successfully',
      messageId: result.messageId
    }), { status: 200, headers });
    
  } catch (error) {
    console.error('Receipt email error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to send receipt email' }), {
      status: 500, headers
    });
  }
}

/**
 * Generate HTML email template
 */
function generateEmailHTML(receipt) {
  const formattedAmount = typeof receipt.amount === 'number' 
    ? receipt.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })
    : receipt.amount;
  
  const formattedDate = receipt.date 
    ? new Date(receipt.date).toLocaleString('en-NG', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : 'N/A';
  
  const channelName = receipt.channel === 'card' ? 'Card Payment' : 
                       receipt.channel === 'bank' ? 'Bank Transfer' : 
                       receipt.channel === 'ussd' ? 'USSD' : 'Online Payment';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0;
      padding: 0;
      background: #f5f5f5;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #ffffff;
    }
    .header { 
      text-align: center; 
      padding: 30px 20px; 
      background: linear-gradient(135deg, #00aa88, #00cc88);
    }
    .header h1 { 
      color: white; 
      margin: 0; 
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 1px;
    }
    .header p {
      color: rgba(255,255,255,0.9);
      margin: 5px 0 0;
      font-size: 14px;
    }
    .body { padding: 30px 20px; }
    .status-badge {
      display: inline-block;
      padding: 4px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      background: #00aa8822;
      color: #00aa88;
      border: 1px solid #00aa8844;
      margin-bottom: 20px;
    }
    .receipt { 
      background: #fafafa; 
      border-radius: 10px; 
      padding: 20px;
      margin: 20px 0;
      border: 1px solid #f0f0f0;
    }
    .row { 
      display: flex; 
      justify-content: space-between; 
      padding: 12px 0; 
      border-bottom: 1px solid #eee; 
    }
    .row:last-child { border-bottom: none; }
    .label { 
      font-weight: 600; 
      color: #666; 
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .value {
      font-weight: 500;
      color: #333;
      text-align: right;
    }
    .total { 
      font-size: 18px; 
      font-weight: 700; 
      color: #00aa88;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 2px solid #00aa8833;
    }
    .total .label { color: #333; font-size: 14px; }
    .total .value { font-size: 20px; }
    .button-container { text-align: center; margin: 25px 0; }
    .button { 
      display: inline-block; 
      padding: 14px 32px; 
      background: #00aa88; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 600;
      font-size: 14px;
    }
    .footer { 
      text-align: center; 
      padding: 20px; 
      font-size: 12px; 
      color: #999;
      border-top: 1px solid #f0f0f0;
    }
    .footer p { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PRIMESHIELDHUB</h1>
      <p>Payment Receipt</p>
    </div>
    
    <div class="body">
      <div class="status-badge">${receipt.status ? receipt.status.toUpperCase() : 'COMPLETED'}</div>
      
      <p style="color: #666; margin: 0 0 15px;">Dear ${escapeHtml(receipt.customer_name)},</p>
      <p style="color: #666; margin: 0 0 15px;">Thank you for your payment. Here is your receipt:</p>
      
      <div class="receipt">
        <div class="row">
          <span class="label">Transaction ID</span>
          <span class="value">${receipt.reference}</span>
        </div>
        <div class="row">
          <span class="label">Date</span>
          <span class="value">${formattedDate}</span>
        </div>
        <div class="row">
          <span class="label">Customer</span>
          <span class="value">${escapeHtml(receipt.customer_name)}</span>
        </div>
        <div class="row">
          <span class="label">Email</span>
          <span class="value">${escapeHtml(receipt.email)}</span>
        </div>
        <div class="row">
          <span class="label">Payment Method</span>
          <span class="value">${channelName}</span>
        </div>
        <div class="row total">
          <span class="label">Total Amount</span>
          <span class="value">₦${formattedAmount}</span>
        </div>
      </div>
      
      <div class="button-container">
        <a href="https://primeshieldhub.com/orders" class="button">Track Your Order</a>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>PrimeShieldHub</strong> - Power & Protection Solutions</p>
      <p>This is an official system-generated receipt.</p>
      <p>For inquiries: support@primeshieldhub.com</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate plain text email
 */
function generateEmailText(receipt) {
  const formattedAmount = typeof receipt.amount === 'number' 
    ? receipt.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })
    : receipt.amount;
  
  return `PRIMESHIELDHUB PAYMENT RECEIPT
================================

Transaction ID: ${receipt.reference}
Date: ${new Date(receipt.date).toLocaleString()}
Customer: ${receipt.customer_name}
Payment Method: ${receipt.channel === 'card' ? 'Card' : 'Bank Transfer'}
Total Amount: ₦${formattedAmount}

================================
Thank you for shopping with PrimeShieldHub!
Track your order: https://primeshieldhub.com/orders

For inquiries: support@primeshieldhub.com`;
}

/**
 * Send email via Resend API
 */
async function sendEmail(env, to, subject, html, text) {
  // Use Resend (your RESEND_API_KEY secret)
  if (env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'PrimeShieldHub <receipts@primeshieldhub.com>',
          to: [to],
          subject,
          html,
          text
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("Resend API error:", data);
        return { success: false, error: data.message || 'Email service error' };
      }
      
      return { success: true, messageId: data.id, provider: 'resend' };
    } catch (err) {
      console.error("Resend send failed:", err);
      return { success: false, error: err.message };
    }
  }
  
  // Fallback: Log that no provider is configured
  console.warn("No email provider configured (RESEND_API_KEY missing)");
  return { success: false, error: 'No email provider configured' };
}

/**
 * Escape HTML entities
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==================== OPTIONS HANDLER ====================
export async function handleReceiptEmailOptions(request) {
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
