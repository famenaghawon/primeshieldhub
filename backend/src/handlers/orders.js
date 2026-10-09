// ======================================================================
// ORDER HANDLERS - COMPLETE WITH ALL IMPORTS
// ======================================================================
import { requireAuth } from '../middleware/auth.js';
import { logEvent, logAudit } from '../utils/logging.js';
import { validateString, validatePhone, validateEmail, validateAmount } from '../utils/validation.js';
import { getCorsHeaders } from '../middleware/cors.js';
import { CITY_COORDS } from '../utils/constants.js';
import { addSecurityHeaders } from '../middleware/security.js';

/**
 * Handle order tracking (public)
 * Searches by trackingId, reference, OR order id
 */
export async function handleOrderTracking(request, env, ctx, corsHeaders) {
  try {
    const url = new URL(request.url);
    const trackingId = url.searchParams.get('trackingId');
    
    if (!trackingId) {
      return new Response(JSON.stringify({ success: false, message: 'Tracking ID required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const order = await env.DB.prepare(
      'SELECT id, reference, trackingId, trackingStatus, trackingHistory, estimatedDelivery, customerName, customerEmail, customerPhone, shippingAddress, total, paymentMethod, status, created_at, updated_at FROM orders WHERE trackingId = ? OR reference = ? OR id = ?'
    ).bind(trackingId, trackingId, trackingId).first();
    
    if (!order) {
      return new Response(JSON.stringify({ success: false, message: 'Tracking ID not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const origin = {
      address: '108 Ekhorutomwen St, Uselu, Benin City',
      lat: 6.3350, lng: 5.6037
    };
    
    let shippingAddress = {};
    try { shippingAddress = JSON.parse(order.shippingAddress || '{}'); } catch(e) {}
    
    const city = (shippingAddress.city || 'Benin City').toLowerCase();
    const destCoords = CITY_COORDS[city] || { lat: 6.3350, lng: 5.6037 };
    
    let trackingHistory = [];
    try { trackingHistory = JSON.parse(order.trackingHistory || '[]'); } catch(e) {}
    
    ctx.waitUntil(
      logEvent(env, "TRACKING_LOOKUP", "Tracking lookup for: " + trackingId, "public", {
        trackingId, reference: order.reference, status: order.trackingStatus || order.status
      }).catch(() => {})
    );
    
    return new Response(JSON.stringify({
      success: true,
      tracking: {
        trackingId: order.trackingId,
        reference: order.reference,
        status: order.trackingStatus || order.status,
        estimatedDelivery: order.estimatedDelivery,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        total: order.total,
        paymentMethod: order.paymentMethod,
        origin: origin,
        destination: {
          address: shippingAddress.address || '',
          city: shippingAddress.city || '',
          state: shippingAddress.state || '',
          lat: destCoords.lat,
          lng: destCoords.lng
        },
        history: trackingHistory,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      }
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ======================================================================
// EMAIL TEMPLATES — WORLD‑CLASS SOPHISTICATED DESIGNS
// ======================================================================

/**
 * Generate a stunning HTML email for order status updates
 * Features: gradient headers, glassmorphism cards, timeline, tracking CTA
 */
function generateStatusEmailHTML({ reference, customerName, statusText, statusIcon, statusColor, location, note, trackingUrl, estimatedDelivery, paymentMethod, orderAmount, deliveryAddress }) {
  const gradientMap = {
    'processing': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'shipped': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'in-transit': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'out-for-delivery': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'delivered': 'linear-gradient(135deg, #00d68f 0%, #00b884 100%)',
    'cancelled': 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)'
  };

  const bgGradient = gradientMap[statusText.toLowerCase().replace(/\s+/g, '-')] || 
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

  const safeCustomerName = escapeHtml(customerName || 'Valued Customer');
  const safeReference = escapeHtml(reference || 'N/A');
  const safeLocation = escapeHtml(location || 'PrimeShieldHub Facility');
  const safeNote = note ? escapeHtml(note) : null;
  const safeTrackingUrl = escapeHtml(trackingUrl || '#');
  const safeEstimatedDelivery = escapeHtml(estimatedDelivery || 'To be confirmed');
  const safePaymentMethod = escapeHtml(paymentMethod || 'Online Payment');
  const safeOrderAmount = orderAmount ? `₦${Number(orderAmount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}` : 'N/A';
  const safeDeliveryAddress = escapeHtml(deliveryAddress || 'As provided at checkout');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Status Update - ${safeReference}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: #f0f2f5;
      color: #1a1a2e;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 0;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    }
    
    .email-header {
      background: ${bgGradient};
      padding: 40px 32px;
      text-align: center;
      color: #ffffff;
      position: relative;
      overflow: hidden;
    }
    
    .email-header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
      animation: shimmer 6s ease-in-out infinite;
    }
    
    @keyframes shimmer {
      0%, 100% { transform: translate(-10%, -10%); }
      50% { transform: translate(10%, 10%); }
    }
    
    .email-header-content {
      position: relative;
      z-index: 1;
    }
    
    .status-icon {
      font-size: 48px;
      margin-bottom: 16px;
      display: block;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
    }
    
    .email-header h1 {
      font-size: 28px;
      font-weight: 800;
      margin: 0 0 6px;
      letter-spacing: -0.5px;
    }
    
    .email-header .subtitle {
      font-size: 14px;
      opacity: 0.9;
      font-weight: 400;
    }
    
    .email-body {
      padding: 32px;
    }
    
    .greeting {
      font-size: 16px;
      color: #333;
      margin-bottom: 8px;
      font-weight: 600;
    }
    
    .message {
      font-size: 14px;
      color: #666;
      margin-bottom: 24px;
      line-height: 1.7;
    }
    
    .status-card {
      background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
      border: 1px solid #e8ecf4;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: ${statusColor || '#667eea'}15;
      color: ${statusColor || '#667eea'};
      border: 1px solid ${statusColor || '#667eea'}30;
      padding: 6px 16px;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    
    .status-badge .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${statusColor || '#667eea'};
      box-shadow: 0 0 8px ${statusColor || '#667eea'}60;
    }
    
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    
    .detail-item {
      background: #ffffff;
      border-radius: 10px;
      padding: 14px 16px;
      border: 1px solid #eef0f6;
    }
    
    .detail-item.full-width {
      grid-column: 1 / -1;
    }
    
    .detail-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #999;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .detail-value {
      font-size: 14px;
      color: #1a1a2e;
      font-weight: 600;
    }
    
    .detail-value.highlight {
      color: ${statusColor || '#667eea'};
      font-size: 16px;
    }
    
    .note-box {
      background: #fffbf0;
      border: 1px solid #f0e4b8;
      border-left: 4px solid #ffb74d;
      border-radius: 8px;
      padding: 14px 18px;
      margin: 20px 0;
      font-size: 13px;
      color: #8a6d3b;
    }
    
    .note-box .note-icon {
      display: inline-block;
      margin-right: 6px;
    }
    
    .timeline-mini {
      margin: 24px 0;
      padding: 0;
      list-style: none;
    }
    
    .timeline-mini li {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
      font-size: 13px;
      color: #666;
    }
    
    .timeline-mini li:last-child {
      border-bottom: none;
    }
    
    .timeline-mini .tl-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ddd;
      margin-top: 4px;
      flex-shrink: 0;
    }
    
    .timeline-mini .tl-dot.active {
      background: ${statusColor || '#667eea'};
      box-shadow: 0 0 8px ${statusColor || '#667eea'}50;
    }
    
    .timeline-mini .tl-dot.done {
      background: #00d68f;
    }
    
    .cta-button {
      display: block;
      width: 100%;
      background: ${bgGradient};
      color: #ffffff;
      text-align: center;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 700;
      text-decoration: none;
      margin: 24px 0 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(0,0,0,0.2);
    }
    
    .support-links {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    
    .support-link {
      color: #666;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: color 0.2s;
    }
    
    .support-link:hover {
      color: #1a1a2e;
    }
    
    .email-footer {
      background: #f8f9fb;
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid #eef0f6;
    }
    
    .email-footer .brand {
      font-size: 14px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 4px;
    }
    
    .email-footer .brand span {
      color: #d6b25e;
    }
    
    .email-footer p {
      font-size: 12px;
      color: #999;
      margin: 2px 0;
    }
    
    @media (max-width: 480px) {
      .email-header { padding: 28px 20px; }
      .email-header h1 { font-size: 22px; }
      .email-body { padding: 20px; }
      .detail-grid { grid-template-columns: 1fr; }
      .status-icon { font-size: 36px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    
    <!-- Header -->
    <div class="email-header">
      <div class="email-header-content">
        <span class="status-icon">${statusIcon || '📦'}</span>
        <h1>${statusText}</h1>
        <p class="subtitle">Order Reference: ${safeReference}</p>
      </div>
    </div>
    
    <!-- Body -->
    <div class="email-body">
      <p class="greeting">Hello ${safeCustomerName},</p>
      <p class="message">Great news! Your order status has been updated. Here are the latest details:</p>
      
      <!-- Status Card -->
      <div class="status-card">
        <div class="status-badge">
          <span class="dot"></span>
          ${statusText}
        </div>
        
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">Reference</div>
            <div class="detail-value">${safeReference}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Amount</div>
            <div class="detail-value highlight">${safeOrderAmount}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Payment</div>
            <div class="detail-value">${safePaymentMethod}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Est. Delivery</div>
            <div class="detail-value">${safeEstimatedDelivery}</div>
          </div>
          <div class="detail-item full-width">
            <div class="detail-label">Current Location</div>
            <div class="detail-value">📍 ${safeLocation}</div>
          </div>
          <div class="detail-item full-width">
            <div class="detail-label">Delivery Address</div>
            <div class="detail-value">${safeDeliveryAddress}</div>
          </div>
        </div>
      </div>
      
      ${safeNote ? `
      <div class="note-box">
        <span class="note-icon">📝</span>
        <strong>Note:</strong> ${safeNote}
      </div>
      ` : ''}
      
      <!-- Mini Timeline -->
      <ul class="timeline-mini">
        <li><span class="tl-dot done"></span> Order Placed</li>
        <li><span class="tl-dot ${statusText === 'Processing' ? 'active' : 'done'}"></span> Order Confirmed</li>
        <li><span class="tl-dot ${statusText === 'Shipped' ? 'active' : (statusText === 'In Transit' || statusText === 'Out for Delivery' || statusText === 'Delivered' ? 'done' : '')}"></span> Shipped</li>
        <li><span class="tl-dot ${statusText === 'In Transit' ? 'active' : (statusText === 'Out for Delivery' || statusText === 'Delivered' ? 'done' : '')}"></span> In Transit</li>
        <li><span class="tl-dot ${statusText === 'Out for Delivery' ? 'active' : (statusText === 'Delivered' ? 'done' : '')}"></span> Out for Delivery</li>
        <li><span class="tl-dot ${statusText === 'Delivered' ? 'active' : ''}"></span> Delivered</li>
      </ul>
      
      <!-- CTA -->
      <a href="${safeTrackingUrl}" class="cta-button">
        📍 Track Your Order Live
      </a>
      
      <!-- Support Links -->
      <div class="support-links">
        <a href="https://wa.me/2348103535978" class="support-link">💬 WhatsApp Support</a>
        <a href="mailto:primeshieldhub@gmail.com" class="support-link">✉️ Email Support</a>
        <a href="tel:+2348103535978" class="support-link">📞 Call Us</a>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="email-footer">
      <p class="brand"><span>PRIME</span>SHIELDHUB</p>
      <p>Power & Protection Solutions</p>
      <p>RC 9283954 · Benin City, Nigeria</p>
    </div>
    
  </div>
</body>
</html>`;
}

/**
 * Generate plain text email for status updates
 */
function generateStatusEmailText({ reference, customerName, statusText, location, note, trackingUrl, estimatedDelivery, orderAmount }) {
  return `ORDER STATUS UPDATE - PrimeShieldHub
=====================================

Hello ${customerName || 'Valued Customer'},

Your order status has been updated:

Reference: ${reference || 'N/A'}
New Status: ${statusText}
${location ? 'Location: ' + location : ''}
${note ? 'Note: ' + note : ''}
Amount: ${orderAmount ? '₦' + Number(orderAmount).toLocaleString('en-NG', { minimumFractionDigits: 2 }) : 'N/A'}
Est. Delivery: ${estimatedDelivery || 'To be confirmed'}

Track your order live:
${trackingUrl || 'https://primeshieldhub.com/track-order.html'}

=====================================
PrimeShieldHub · Power & Protection Solutions
RC 9283954 · Benin City, Nigeria

Support:
WhatsApp: +234 810 353 5978
Email: primeshieldhub@gmail.com`;
}

/**
 * Escape HTML to prevent XSS
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

// ======================================================================
// HANDLE ORDER NOTIFICATION
// ======================================================================

/**
 * Handle order notification (payment notification) - FULL IMPLEMENTATION
 */
export async function handleOrderNotify(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { orderRef, customerName, customerEmail, customerPhone, amount, items, paymentMethod, type } = data;
    
    // Format items for text
    const itemsList = items ? items.map(i => '• ' + i.name + ' x' + (i.quantity || 1) + ' - ₦' + (i.price || 0).toLocaleString()).join('\n') : 'No items';
    
    // Format items for HTML
    const itemsHtml = items ? items.map(i => 
      '<tr><td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.1);">' + i.name + ' x' + (i.quantity || 1) + '</td><td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.1);text-align:right;">₦' + (i.price || 0).toLocaleString() + '</td></tr>'
    ).join('') : '<tr><td colspan="2">No items</td></tr>';
    
    // Notification message for Telegram
    const notificationMsg = '🔔 *NEW ORDER / PAYMENT*\n\n' +
      '*Reference:* `' + orderRef + '`\n' +
      '*Customer:* ' + customerName + '\n' +
      '*Email:* ' + customerEmail + '\n' +
      '*Phone:* ' + customerPhone + '\n' +
      '*Amount:* ₦' + (amount || 0).toLocaleString() + '\n' +
      '*Method:* ' + paymentMethod + '\n\n' +
      '*Items:*\n' + itemsList + '\n\n' +
      '_Please verify and process._';
    
    // WhatsApp message (shorter format)
    const waMsg = '*' + (type === 'payment_confirmation' ? '💰 PAYMENT' : '📦 NEW ORDER') + '*\n\n' +
      'Reference: ' + orderRef + '\n' +
      'Customer: ' + customerName + '\n' +
      'Amount: ₦' + (amount || 0).toLocaleString() + '\n' +
      'Method: ' + paymentMethod + '\n\n' +
      'Please verify and process.';
    
    // SMS message (even shorter)
    const smsMsg = (type === 'payment_confirmation' ? 'PAYMENT: ' : 'NEW ORDER: ') + orderRef + ' - ₦' + (amount || 0).toLocaleString() + ' from ' + customerName;
    
    const adminEmail = env.ADMIN_EMAIL || 'primeshieldhub@gmail.com';
    const adminPhone = env.ADMIN_PHONE || '+2348103535978';
    
    // HTML Email template
    const emailHtml = '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#0a0a1a;color:#fff;border-radius:12px;">' +
      '<h2 style="color:#d6b25e;">' + (type === 'payment_confirmation' ? '💰 Payment Confirmation' : '📦 New Order') + '</h2>' +
      '<p><strong>Reference:</strong> ' + orderRef + '</p>' +
      '<p><strong>Customer:</strong> ' + customerName + '</p>' +
      '<p><strong>Email:</strong> ' + customerEmail + '</p>' +
      '<p><strong>Phone:</strong> ' + customerPhone + '</p>' +
      '<p><strong>Amount:</strong> ₦' + (amount || 0).toLocaleString() + '</p>' +
      '<p><strong>Method:</strong> ' + paymentMethod + '</p>' +
      '<h3>Items:</h3>' +
      '<table style="width:100%;color:#fff;border-collapse:collapse;">' + itemsHtml + '</table>' +
      '<p style="color:#d6b25e;margin-top:16px;">Please verify and process this order.</p>' +
      '</div>';
    
    // Send notifications using Telegram and Resend
    const notificationPromises = [];
    
    // Send via Telegram
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      notificationPromises.push(
        fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: notificationMsg,
            parse_mode: 'Markdown'
          })
        }).catch(e => console.error('Telegram notify failed:', e))
      );
    }
    
    // Send via Email (Resend)
    if (env.RESEND_API_KEY) {
      notificationPromises.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.RESEND_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'PrimeShieldHub <receipts@primeshieldhub.com>',
            to: [adminEmail],
            subject: (type === 'payment_confirmation' ? '💰 PAYMENT' : '📦 NEW ORDER') + ' - ' + orderRef + ' - ₦' + (amount || 0).toLocaleString(),
            html: emailHtml
          })
        }).catch(e => console.error('Email notify failed:', e))
      );
    }
    
    // Send via Twilio WhatsApp
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_NUMBER) {
      const twilioAuth = btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN);
      notificationPromises.push(
        fetch('https://api.twilio.com/2010-04-01/Accounts/' + env.TWILIO_ACCOUNT_SID + '/Messages.json', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + twilioAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            To: 'whatsapp:' + adminPhone.replace(/^\+/, ''),
            From: 'whatsapp:' + env.TWILIO_WHATSAPP_NUMBER,
            Body: waMsg
          })
        }).catch(e => console.error('WhatsApp notify failed:', e))
      );
    }
    
    // Send via Twilio SMS
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE && adminPhone) {
      const twilioAuth = btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN);
      notificationPromises.push(
        fetch('https://api.twilio.com/2010-04-01/Accounts/' + env.TWILIO_ACCOUNT_SID + '/Messages.json', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + twilioAuth, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: adminPhone, From: env.TWILIO_PHONE, Body: smsMsg })
        }).catch(e => console.error('SMS notify failed:', e))
      );
    }
    
    // Wait for all notifications to complete (or fail silently)
    await Promise.allSettled(notificationPromises);
    
    // Log the notification event
    await logEvent(env, "ORDER_NOTIFY", "Order notification sent for: " + orderRef, "system", {
      orderRef, type, amount, customerName, customerEmail, customerPhone
    }).catch(() => {});
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Notifications sent successfully',
      channels: {
        telegram: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
        email: !!env.RESEND_API_KEY,
        whatsapp: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_WHATSAPP_NUMBER),
        sms: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_PHONE)
      }
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch(e) {
    console.error('Order notification error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ======================================================================
// HANDLE ORDER STATUS UPDATE (ADMIN) — WITH SOPHISTICATED EMAIL
// ======================================================================

/**
 * Handle order status update (admin)
 * Now sends world-class HTML emails on every status change
 */
export async function handleOrderStatusUpdate(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { reference, status, location, note } = data;
    
    const adminToken = request.headers.get('Authorization');
    if (!adminToken || !adminToken.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized - Admin access required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const order = await env.DB.prepare(
      'SELECT * FROM orders WHERE reference = ? OR trackingId = ? OR id = ?'
    ).bind(reference, reference, reference).first();
    
    if (!order) {
      return new Response(JSON.stringify({ success: false, message: 'Order not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    let history = [];
    try { history = JSON.parse(order.trackingHistory || '[]'); } catch(e) {}
    history.push({ 
      status, 
      location: location || 'PrimeShieldHub HQ, Benin City', 
      timestamp: new Date().toISOString(), 
      note: note || '' 
    });
    
    await env.DB.prepare(
      "UPDATE orders SET trackingStatus = ?, trackingHistory = ?, status = ?, updated_at = datetime('now') WHERE reference = ? OR id = ?"
    ).bind(status, JSON.stringify(history), status === 'delivered' ? 'completed' : 'processing', reference, reference).run();
    
    // ====================================================================
    // CUSTOMER NOTIFICATION — SOPHISTICATED EMAIL
    // ====================================================================
    if (order.customerEmail && env.RESEND_API_KEY) {
      try {
        const statusMap = {
          'processing': { text: 'Order Confirmed & Processing', icon: '⚙️', color: '#667eea' },
          'shipped': { text: 'Order Shipped!', icon: '🚀', color: '#f5576c' },
          'in-transit': { text: 'Your Order is In Transit', icon: '🚚', color: '#4facfe' },
          'out-for-delivery': { text: 'Out for Delivery!', icon: '🛵', color: '#43e97b' },
          'delivered': { text: 'Order Delivered! 🎉', icon: '✅', color: '#00d68f' },
          'cancelled': { text: 'Order Cancelled', icon: '❌', color: '#ff6b6b' }
        };
        
        const statusInfo = statusMap[status] || { text: 'Status Updated', icon: '📦', color: '#667eea' };
        
        // Parse shipping address for display
        let deliveryAddress = 'As provided at checkout';
        try {
          const addr = typeof order.shippingAddress === 'string' ? JSON.parse(order.shippingAddress) : (order.shippingAddress || {});
          if (addr.street || addr.address) {
            deliveryAddress = [addr.street || addr.address, addr.city, addr.state].filter(Boolean).join(', ');
          }
        } catch(e) {}
        
        const trackingUrl = `https://primeshieldhub.com/track-order.html?reference=${encodeURIComponent(order.reference || order.id || '')}`;
        
        const emailHTML = generateStatusEmailHTML({
          reference: order.reference || order.id,
          customerName: order.customerName || order.customer_name || 'Valued Customer',
          statusText: statusInfo.text,
          statusIcon: statusInfo.icon,
          statusColor: statusInfo.color,
          location: location || 'PrimeShieldHub Facility',
          note: note || null,
          trackingUrl: trackingUrl,
          estimatedDelivery: order.estimatedDelivery || order.estimated_delivery || 'To be confirmed',
          paymentMethod: order.paymentMethod || order.payment_method || 'Online Payment',
          orderAmount: order.total || order.amount,
          deliveryAddress: deliveryAddress
        });
        
        const emailText = generateStatusEmailText({
          reference: order.reference || order.id,
          customerName: order.customerName || order.customer_name || 'Valued Customer',
          statusText: statusInfo.text,
          location: location || null,
          note: note || null,
          trackingUrl: trackingUrl,
          estimatedDelivery: order.estimatedDelivery || null,
          orderAmount: order.total || order.amount
        });
        
        const emailSubject = status === 'delivered' 
          ? `🎉 Your Order Has Been Delivered! - ${order.reference || order.id}`
          : `📦 ${statusInfo.text} - ${order.reference || order.id}`;
        
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.RESEND_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'PrimeShieldHub <updates@primeshieldhub.com>',
            to: [order.customerEmail],
            subject: emailSubject,
            html: emailHTML,
            text: emailText
          })
        });
        
        console.log(`Status email sent to ${order.customerEmail} for order ${order.reference || order.id}: ${statusInfo.text}`);
      } catch(notifError) {
        console.error('Customer email notification error:', notifError);
      }
    }
    
    await logEvent(env, "ORDER_STATUS_UPDATE", "Order " + reference + " updated to " + status, "admin", {
      reference, newStatus: status, location, note
    });
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Order status updated', 
      newStatus: status,
      notified: !!(order.customerEmail && env.RESEND_API_KEY)
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ======================================================================
// HANDLE GET USER ORDERS
// ======================================================================

/**
 * Handle get user orders
 */
export async function handleGetOrders(request, env, corsHeaders, requestInfo) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const status = url.searchParams.get('status');
    const offset = (page - 1) * limit;
    
    let query = "SELECT id, user_id, reference, trackingId, total, status, trackingStatus, paymentMethod, created_at, updated_at FROM orders WHERE user_id = ?";
    let countQuery = "SELECT COUNT(*) as total FROM orders WHERE user_id = ?";
    const params = [user.id];
    
    if (status) {
      query += " AND (status = ? OR trackingStatus = ?)";
      countQuery += " AND (status = ? OR trackingStatus = ?)";
      params.push(status, status);
    }
    
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    
    const ordersQuery = await env.DB.prepare(query).bind(...params);
    const ordersResult = await ordersQuery.all();
    
    const countResult = await env.DB.prepare(countQuery).bind(...params.slice(0, -2)).first();
    const total = countResult?.total || 0;
    
    return addSecurityHeaders(new Response(JSON.stringify({
      success: true,
      orders: ordersResult.results || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    }), requestInfo);
    
  } catch (error) {
    console.error('Get orders error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// HANDLE CREATE ORDER
// ======================================================================

/**
 * Handle create order
 */
export async function handleCreateOrder(request, env, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const items = body.items;
    const shippingAddress = body.shippingAddress;
    const paymentMethod = validateString(body.paymentMethod, 50) || 'paystack';
    const notes = body.notes ? validateString(body.notes, 500) : null;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "At least one item is required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    // Calculate total
    let total = 0;
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return new Response(JSON.stringify({ error: "Invalid item data" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      // Get product price from DB
      const product = await env.DB.prepare(
        "SELECT price, name FROM products WHERE id = ?"
      ).bind(item.productId).first();
      
      if (!product) {
        return new Response(JSON.stringify({ error: "Product not found: " + item.productId }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      total += product.price * item.quantity;
    }
    
    // Generate order reference
    const reference = 'PSH-ORD-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const trackingId = 'PSH-TRK-' + Date.now().toString(36).toUpperCase();
    
    // Insert order
    const result = await env.DB.prepare(
      `INSERT INTO orders (user_id, reference, trackingId, items, total, status, trackingStatus, shippingAddress, paymentMethod, notes, customerName, customerEmail, customerPhone, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      user.id,
      reference,
      trackingId,
      JSON.stringify(items),
      total,
      JSON.stringify(shippingAddress || {}),
      paymentMethod,
      notes,
      user.name || user.email,
      user.email,
      user.phone || null
    ).run();
    
    await logEvent(env, "ORDER_CREATE", "Order created: " + reference, user.id, {
      reference, total, items: items.length
    });
    
    await logAudit(env, "ORDER_CREATE", user.id, "orders", String(result.meta?.last_row_id || '0'), {
      reference, total, paymentMethod
    }, ip, fingerprint);
    
    return new Response(JSON.stringify({
      success: true,
      order: {
        id: String(result.meta?.last_row_id || '0'),
        reference,
        trackingId,
        total,
        status: 'pending',
        paymentMethod
      }
    }), {
      status: 201, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Create order error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
