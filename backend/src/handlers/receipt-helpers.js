// src/handlers/receipt-helpers.js
// SHARED RECEIPT DELIVERY HELPERS
// Integrated from api/receipt/helpers.js
// Used by: payment-verify.js, receipt-email.js, receipt-sms.js, receipt-whatsapp.js

// ==================== RECEIPT DELIVERY ====================

/**
 * Send receipt via WhatsApp using Twilio
 */
export async function sendWhatsAppReceipt(env, receiptData) {
  try {
    if (!receiptData.phone) return { success: false, error: 'No phone number' };
    
    const phone = formatPhoneNumber(receiptData.phone);
    const message = generateWhatsAppMessage(receiptData);
    
    // Check Twilio credentials
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_NUMBER) {
      console.warn("Twilio WhatsApp not configured");
      return { success: false, error: 'WhatsApp provider not configured' };
    }
    
    const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: `whatsapp:${phone}`,
          From: `whatsapp:${env.TWILIO_WHATSAPP_NUMBER}`,
          Body: message
        })
      }
    );
    
    const success = response.ok;
    
    // Log delivery attempt
    await logReceiptDelivery(env, receiptData.reference, 'whatsapp', success, 
      success ? null : await response.text().catch(() => 'Unknown error'));
    
    return { success, channel: 'whatsapp' };
  } catch (error) {
    console.error('WhatsApp receipt send failed:', error);
    await logReceiptDelivery(env, receiptData.reference, 'whatsapp', false, error.message);
    return { success: false, channel: 'whatsapp', error: error.message };
  }
}

/**
 * Send receipt via SMS using Twilio
 */
export async function sendSMSReceipt(env, receiptData) {
  try {
    if (!receiptData.phone) return { success: false, error: 'No phone number' };
    
    const phone = formatPhoneNumber(receiptData.phone);
    const message = generateSMSMessage(receiptData);
    
    // Check Twilio credentials
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_SMS_NUMBER) {
      console.warn("Twilio SMS not configured");
      return { success: false, error: 'SMS provider not configured' };
    }
    
    const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: phone,
          From: env.TWILIO_SMS_NUMBER,
          Body: message
        })
      }
    );
    
    const success = response.ok;
    
    // Log delivery attempt
    await logReceiptDelivery(env, receiptData.reference, 'sms', success,
      success ? null : await response.text().catch(() => 'Unknown error'));
    
    return { success, channel: 'sms' };
  } catch (error) {
    console.error('SMS receipt send failed:', error);
    await logReceiptDelivery(env, receiptData.reference, 'sms', false, error.message);
    return { success: false, channel: 'sms', error: error.message };
  }
}

/**
 * Send receipt via Email using Resend
 */
export async function sendEmailReceipt(env, receiptData) {
  try {
    if (!receiptData.email) return { success: false, error: 'No email address' };
    
    const html = generateReceiptEmailHTML(receiptData);
    const text = generateReceiptEmailText(receiptData);
    
    // Check Resend credentials
    if (!env.RESEND_API_KEY) {
      console.warn("Resend email not configured");
      return { success: false, error: 'Email provider not configured' };
    }
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'PrimeShieldHub <receipts@primeshieldhub.com>',
        to: [receiptData.email],
        subject: `PrimeShieldHub Payment Receipt - ${receiptData.reference}`,
        html,
        text
      })
    });
    
    const data = await response.json();
    const success = response.ok;
    
    // Log delivery attempt
    await logReceiptDelivery(env, receiptData.reference, 'email', success,
      success ? null : data.message || 'Unknown error');
    
    return { success, channel: 'email', messageId: data.id };
  } catch (error) {
    console.error('Email receipt send failed:', error);
    await logReceiptDelivery(env, receiptData.reference, 'email', false, error.message);
    return { success: false, channel: 'email', error: error.message };
  }
}

/**
 * Deliver receipt via all available channels
 * Used by payment-verify.js after successful verification
 */
export async function deliverAllReceipts(env, receiptData) {
  const results = await Promise.allSettled([
    sendEmailReceipt(env, receiptData),
    sendWhatsAppReceipt(env, receiptData),
    sendSMSReceipt(env, receiptData)
  ]);
  
  const summary = {
    email: results[0].status === 'fulfilled' ? results[0].value : { success: false, error: results[0].reason },
    whatsapp: results[1].status === 'fulfilled' ? results[1].value : { success: false, error: results[1].reason },
    sms: results[2].status === 'fulfilled' ? results[2].value : { success: false, error: results[2].reason }
  };
  
  return summary;
}

// ==================== LOGGING ====================

/**
 * Log receipt delivery attempt to database
 */
async function logReceiptDelivery(env, reference, channel, success, error = null) {
  if (!env.DB) return;
  
  try {
    await env.DB.prepare(`
      INSERT INTO receipt_delivery_logs (reference, channel, success, error, sent_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      reference,
      channel,
      success ? 1 : 0,
      error ? String(error).substring(0, 500) : null,
      Date.now()
    ).run();
  } catch (err) {
    console.error(`Failed to log ${channel} receipt delivery:`, err);
  }
}

// ==================== PHONE FORMATTING ====================

/**
 * Format phone number to international format (234...)
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove leading zeros and add Nigeria code
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.substring(1);
  }
  
  // Add Nigeria code if no country code
  if (!cleaned.startsWith('234')) {
    cleaned = '234' + cleaned;
  }
  
  // Validate length (Nigeria: 234 + 10 digits = 13)
  if (cleaned.length < 13) {
    console.warn(`Phone number may be invalid: ${phone} → ${cleaned}`);
  }
  
  return cleaned;
}

// ==================== MESSAGE GENERATORS ====================

/**
 * Generate WhatsApp message for receipt
 */
export function generateWhatsAppMessage(receipt) {
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
                         receipt.channel === 'ussd' ? '📱 USSD' : '💳 Online Payment';
  
  return `🏆 *PRIMESHIELDHUB RECEIPT* 🏆

✅ *Payment Successful!*

📋 *Transaction ID:* ${receipt.reference}
📅 *Date:* ${formattedDate}
💰 *Amount:* ₦${formattedAmount}
👤 *Customer:* ${receipt.customer_name || 'Customer'}
${paymentMethod}

🙏 Thank you for shopping with PrimeShieldHub!
🔗 Track your order: https://primeshieldhub.com/orders`;
}

/**
 * Generate SMS message for receipt
 */
export function generateSMSMessage(receipt) {
  const formattedAmount = typeof receipt.amount === 'number'
    ? receipt.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })
    : receipt.amount;
  
  const shortRef = receipt.reference 
    ? receipt.reference.slice(-8) 
    : 'N/A';
  
  return `PrimeShieldHub: Payment of ₦${formattedAmount} confirmed. Ref: ${shortRef}. Thank you for your purchase! Track: primeshieldhub.com/orders`;
}

/**
 * Generate HTML email for receipt
 */
export function generateReceiptEmailHTML(receipt) {
  const formattedAmount = typeof receipt.amount === 'number'
    ? receipt.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })
    : receipt.amount;
  
  const formattedDate = receipt.date
    ? new Date(receipt.date).toLocaleString('en-NG', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : new Date().toLocaleString('en-NG');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #00aa88, #00cc88); }
    .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 800; }
    .header p { color: rgba(255,255,255,0.9); margin: 5px 0 0; font-size: 14px; }
    .body { padding: 30px 20px; }
    .receipt { background: #fafafa; border-radius: 10px; padding: 20px; margin: 20px 0; border: 1px solid #f0f0f0; }
    .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
    .row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { font-weight: 500; color: #333; text-align: right; }
    .total { font-size: 18px; font-weight: 700; color: #00aa88; margin-top: 10px; padding-top: 10px; border-top: 2px solid #00aa8833; }
    .total .label { color: #333; font-size: 14px; }
    .total .value { font-size: 20px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #999; border-top: 1px solid #f0f0f0; }
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
      <p style="color: #666;">Dear ${escapeHtml(receipt.customer_name || 'Customer')},</p>
      <p style="color: #666;">Thank you for your payment. Here is your receipt:</p>
      <div class="receipt">
        <div class="row"><span class="label">Transaction ID</span><span class="value">${receipt.reference}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${formattedDate}</span></div>
        <div class="row"><span class="label">Customer</span><span class="value">${escapeHtml(receipt.customer_name || 'Customer')}</span></div>
        <div class="row"><span class="label">Email</span><span class="value">${escapeHtml(receipt.email || '')}</span></div>
        <div class="row"><span class="label">Payment Method</span><span class="value">${receipt.channel || 'Online'}</span></div>
        <div class="row total"><span class="label">Total Amount</span><span class="value">₦${formattedAmount}</span></div>
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
 * Generate plain text email for receipt
 */
export function generateReceiptEmailText(receipt) {
  const formattedAmount = typeof receipt.amount === 'number'
    ? receipt.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })
    : receipt.amount;
  
  return `PRIMESHIELDHUB PAYMENT RECEIPT
================================

Transaction ID: ${receipt.reference}
Date: ${new Date(receipt.date).toLocaleString()}
Customer: ${receipt.customer_name || 'Customer'}
Amount: ₦${formattedAmount}
Payment Method: ${receipt.channel || 'Online'}

================================
Thank you for shopping with PrimeShieldHub!
Track your order: https://primeshieldhub.com/orders

For inquiries: support@primeshieldhub.com`;
}

// ==================== UTILITIES ====================

/**
 * Escape HTML entities to prevent XSS
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
