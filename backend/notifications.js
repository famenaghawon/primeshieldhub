// ======================================================================
// NOTIFICATIONS.JS — COMPLETE INTEGRATED VERSION v11.5 FIXED
// Unified Notification Engine for PrimeShieldHub
// Supports: Email (Resend), SMS (Twilio / Termii), WhatsApp (Twilio), Telegram
// Fixed: Telegram null message guard, notifyUser message fallback
// ======================================================================

// ==================== EMAIL ====================

/**
 * Send an email via Resend
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML body content
 * @param {object} env - Environment bindings (must contain RESEND_API_KEY)
 * @returns {Promise<object>} Resend API response
 */
export async function sendEmail(to, subject, html, env) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn('[Notifications] RESEND_API_KEY not set – email not sent');
    return { error: 'RESEND_API_KEY missing' };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "PrimeShield <notifications@primeshieldhub.com>",
        to,
        subject,
        html
      })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Notifications] Resend error:', data);
      return { error: data.message || 'Email send failed' };
    }
    return data;
  } catch (e) {
    console.error('[Notifications] Email exception:', e);
    return { error: e.message };
  }
}

// ==================== SMS ====================

/**
 * Send an SMS via Twilio (primary) or Termii (fallback)
 * @param {string} to - Phone number (E.164 format recommended)
 * @param {string} message - SMS body (max 160 chars recommended)
 * @param {object} env - Environment bindings
 * @returns {Promise<object>} API response
 */
export async function sendSMS(to, message, env) {
  if (!to || !message) {
    console.warn('[Notifications] SMS skipped - missing phone or message');
    return { error: 'Missing phone or message' };
  }

  // Prefer Twilio if configured
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_SMS_NUMBER) {
    return sendTwilioSMS(to, message, env);
  }
  
  // Fallback to Termii (legacy)
  if (env.TERMII_API_KEY) {
    return sendTermiiSMS(to, message, env);
  }

  console.warn('[Notifications] No SMS provider configured');
  return { error: 'No SMS provider' };
}

/**
 * Send an SMS via Twilio
 */
async function sendTwilioSMS(to, message, env) {
  const ACCOUNT_SID = env.TWILIO_ACCOUNT_SID;
  const AUTH_TOKEN = env.TWILIO_AUTH_TOKEN;
  const FROM = env.TWILIO_SMS_NUMBER;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
    const body = new URLSearchParams({
      To: to,
      From: FROM,
      Body: message.slice(0, 1600)
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Notifications] Twilio SMS error:', data);
      return { error: data.message || 'SMS failed' };
    }
    return data;
  } catch (e) {
    console.error('[Notifications] Twilio SMS exception:', e);
    return { error: e.message };
  }
}

/**
 * Send an SMS via Termii (fallback)
 */
async function sendTermiiSMS(to, message, env) {
  try {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.TERMII_API_KEY,
        to,
        from: "PrimeShield",
        sms: message.slice(0, 160),
        type: "plain"
      })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[Notifications] Termii error:', data);
      return { error: data.message || 'Termii failed' };
    }
    return data;
  } catch (e) {
    console.error('[Notifications] Termii exception:', e);
    return { error: e.message };
  }
}

// ==================== WHATSAPP ====================

/**
 * Send a WhatsApp message via Twilio
 * @param {string} to - Phone number (E.164 format)
 * @param {string} message - Message body (max 4096 chars)
 * @param {object} env - Environment bindings
 * @returns {Promise<object>} API response
 */
export async function sendWhatsApp(to, message, env) {
  if (!to || !message) {
    console.warn('[Notifications] WhatsApp skipped - missing phone or message');
    return { error: 'Missing phone or message' };
  }

  const ACCOUNT_SID = env.TWILIO_ACCOUNT_SID;
  const AUTH_TOKEN = env.TWILIO_AUTH_TOKEN;
  const FROM = env.TWILIO_WHATSAPP_NUMBER;

  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM) {
    console.warn('[Notifications] Twilio WhatsApp not configured');
    // Fallback to Facebook Graph if configured
    if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID) {
      return sendFacebookWhatsApp(to, message, env);
    }
    return { error: 'WhatsApp not configured' };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
    const body = new URLSearchParams({
      To: `whatsapp:${to}`,
      From: FROM,
      Body: message.slice(0, 4096)
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Notifications] Twilio WhatsApp error:', data);
      return { error: data.message || 'WhatsApp failed' };
    }
    return data;
  } catch (e) {
    console.error('[Notifications] WhatsApp exception:', e);
    return { error: e.message };
  }
}

/**
 * Fallback WhatsApp via Facebook Graph API
 */
async function sendFacebookWhatsApp(to, message, env) {
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message.slice(0, 4096) }
      })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[Notifications] Facebook WhatsApp error:', data);
      return { error: data.error?.message || 'Facebook WA failed' };
    }
    return data;
  } catch (e) {
    console.error('[Notifications] Facebook WA exception:', e);
    return { error: e.message };
  }
}

// ==================== TELEGRAM ====================

/**
 * Send a Telegram message via Bot API
 * @param {string} message - Message text (Markdown supported)
 * @param {object} env - Environment bindings (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
 * @returns {Promise<object>} API response
 */
export async function sendTelegram(message, env) {
  // FIXED: Guard against undefined/null message
  if (!message || typeof message !== 'string') {
    console.warn('[Notifications] Telegram skipped - no message provided');
    return { error: 'No message provided' };
  }

  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    console.warn('[Notifications] Telegram not configured');
    return { error: 'Telegram not configured' };
  }
  
  try {
    const cleanMsg = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: cleanMsg, 
        parse_mode: 'Markdown' 
      })
    });
    return await res.json();
  } catch (e) {
    console.error('[Notifications] Telegram exception:', e);
    return { error: e.message };
  }
}

// ==================== UNIFIED NOTIFICATION ====================

/**
 * Send a notification across all available channels simultaneously
 * @param {Object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.phone - Recipient phone number
 * @param {string} params.subject - Email subject
 * @param {string} params.message - Plain text message (for SMS/WhatsApp/Telegram)
 * @param {string} params.html - HTML email body (optional, falls back to message)
 * @param {Object} env - Environment bindings
 * @param {Object} channels - Which channels to use { email, sms, whatsapp, telegram }
 * @returns {Promise<Object>} Results per channel
 */
export async function notifyUser({ email, phone, subject, message, html }, env, channels = {}) {
  const results = {};
  const promises = [];
  
  // FIXED: Use html as fallback for message, and vice versa
  const emailHtml = html || (message ? `<p>${message}</p>` : '<p>Notification from PrimeShieldHub</p>');
  const textMessage = message || subject || 'Notification from PrimeShieldHub';
  
  if (channels.email !== false && email) {
    promises.push(
      sendEmail(email, subject || 'PrimeShieldHub Notification', emailHtml, env)
        .then(r => results.email = r)
        .catch(e => results.email = { error: e.message })
    );
  }
  
  if (channels.sms !== false && phone && textMessage) {
    promises.push(
      sendSMS(phone, textMessage, env)
        .then(r => results.sms = r)
        .catch(e => results.sms = { error: e.message })
    );
  }
  
  if (channels.whatsapp !== false && phone && textMessage) {
    promises.push(
      sendWhatsApp(phone, textMessage, env)
        .then(r => results.whatsapp = r)
        .catch(e => results.whatsapp = { error: e.message })
    );
  }
  
  // FIXED: Only send Telegram if message exists
  if (channels.telegram !== false && textMessage) {
    promises.push(
      sendTelegram(textMessage, env)
        .then(r => results.telegram = r)
        .catch(e => results.telegram = { error: e.message })
    );
  }
  
  await Promise.allSettled(promises);
  return results;
}

// ==================== SPECIFIC NOTIFICATION TYPES ====================

/**
 * Send OTP email
 */
export async function sendOTPEmail({ email, otp, purpose = 'login' }, env) {
  return sendEmail(
    email,
    `Your OTP: ${otp}`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a1a; color: #fff; border-radius: 12px; border: 1px solid #333;">
      <h2 style="color: #00f7ff;">🔐 Verification Code</h2>
      <h1 style="font-size: 40px; letter-spacing: 8px; color: #ffd966;">${otp}</h1>
      <p>Purpose: <strong>${purpose}</strong></p>
      <p style="color: #ff6b6b;">⚠️ Expires in 5 minutes</p>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">If you didn't request this, please ignore.</p>
    </div>`,
    env
  );
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail({ email, name }, env) {
  return sendEmail(
    email,
    `Welcome to PrimeShieldHub, ${name}!`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a1a; color: #fff; border-radius: 12px; border: 1px solid #333;">
      <h1 style="color: #ffd966;">Welcome! 🛡️</h1>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your PrimeShieldHub account has been created successfully.</p>
      <p>You can now access our full range of products and services.</p>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">© 2024 PrimeShieldHub. All rights reserved.</p>
    </div>`,
    env
  );
}

/**
 * Send staff welcome email
 */
export async function sendStaffWelcomeEmail(env, email, name, branchName, status) {
  const subject = status === 'active' 
    ? `🎉 Welcome to PrimeShieldHub, ${name}!` 
    : `📋 Staff Registration Submitted - ${name}`;
  
  const statusMessage = status === 'active'
    ? 'Your account has been activated. You can now log in and start working.'
    : 'Your account is pending approval. You will be notified once an admin approves your registration.';
  
  const statusColor = status === 'active' ? '#33ffaa' : '#ffaa33';
  
  return sendEmail(
    email,
    subject,
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a1a; color: #fff; border-radius: 12px; border: 1px solid #333;">
      <h1 style="color: ${statusColor};">${status === 'active' ? '✅ Staff Account Activated' : '📋 Registration Submitted'}</h1>
      <p>Hi <strong>${name}</strong>,</p>
      <p>${statusMessage}</p>
      ${branchName ? `<p><strong>Branch:</strong> ${branchName}</p>` : ''}
      <p><strong>Role:</strong> Staff</p>
      ${status === 'active' ? `<p style="margin-top: 16px;"><a href="https://primeshieldhub.com/staff/" style="background: #00f7ff; color: #000; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Login to Dashboard</a></p>` : ''}
      <p style="color: #666; font-size: 12px; margin-top: 20px;">© 2024 PrimeShieldHub. All rights reserved.</p>
    </div>`,
    env
  );
}

/**
 * Send admin notification for new staff registration
 */
export async function sendAdminNotification(env, data) {
  const { type, staffName, staffEmail, branchName } = data;
  
  if (!env.ADMIN_EMAIL) {
    console.warn('[Notifications] ADMIN_EMAIL not set');
    return { error: 'ADMIN_EMAIL missing' };
  }
  
  return sendEmail(
    env.ADMIN_EMAIL,
    `👤 New Staff Registration: ${staffName}`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a1a; color: #fff; border-radius: 12px; border: 1px solid #333;">
      <h2 style="color: #ffaa33;">📋 New Staff Registration</h2>
      <p><strong>Name:</strong> ${staffName}</p>
      <p><strong>Email:</strong> ${staffEmail}</p>
      <p><strong>Branch:</strong> ${branchName || 'Not specified'}</p>
      <p><strong>Type:</strong> ${type || 'staff_registration'}</p>
      <p style="margin-top: 16px;"><a href="https://primeshieldhub.com/admin" style="background: #ffd966; color: #000; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Review in Admin Dashboard</a></p>
    </div>`,
    env
  );
}

/**
 * Send security alert
 */
export async function sendSecurityAlert({ email, alertType, details, ip }, env) {
  return sendEmail(
    email,
    `🔒 Security Alert: ${alertType}`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a1a; color: #fff; border-radius: 12px; border: 1px solid #333;">
      <h2 style="color: #ff3366;">⚠️ Security Alert</h2>
      <p><strong>Type:</strong> ${alertType}</p>
      <p><strong>Details:</strong> ${details}</p>
      <p><strong>IP:</strong> ${ip || 'Unknown'}</p>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">If this wasn't you, please contact support immediately.</p>
    </div>`,
    env
  );
}

/**
 * Send payment receipt
 */
export async function sendPaymentReceipt({ email, amount, product, reference }, env) {
  return sendEmail(
    email,
    `Payment Confirmed - ₦${amount}`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a1a; color: #fff; border-radius: 12px; border: 1px solid #333;">
      <h2 style="color: #33ffaa;">✅ Payment Confirmed</h2>
      <p><strong>Product:</strong> ${product}</p>
      <p><strong>Amount:</strong> ₦${amount}</p>
      <p><strong>Reference:</strong> ${reference}</p>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">Thank you for your purchase!</p>
    </div>`,
    env
  );
}

/**
 * Send battery status alert
 */
export async function sendBatteryAlert({ email, deviceName, percentage, status }, env) {
  const statusColors = { full: '#34a853', charging: '#fbbc04', low: '#ea4335', critical: '#d93025' };
  const color = statusColors[status] || '#1a73e8';

  return sendEmail(
    email,
    `🔋 Battery ${status.toUpperCase()}: ${deviceName} at ${percentage}%`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a1a; color: #fff; border-radius: 12px; border: 1px solid #333;">
      <div style="background: ${color}; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: white; margin: 0;">Battery Alert</h2>
      </div>
      <div style="padding: 20px;">
        <h3>${deviceName}</h3>
        <p><strong>Level:</strong> ${percentage}%</p>
        <p><strong>Status:</strong> ${status.toUpperCase()}</p>
      </div>
    </div>`,
    env
  );
}

// ==================== CHARGING NOTIFICATIONS ====================

/**
 * Notify customer their device is ready for pickup
 */
export async function notifyDeviceReady({ name, email, phone, ticketNumber, deviceName, amount }, env) {
  const message = `🔋 Your ${deviceName || 'device'} is fully charged!\n\n` +
    `🎫 Ticket: ${ticketNumber || 'N/A'}\n` +
    `📍 Pickup at PrimeShieldHub\n` +
    `💰 Amount: ₦${amount || '0'}\n` +
    `⏰ We close at 9 PM\n\n` +
    `Thank you for choosing us! 🛡️`;
  
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#0a0a1a;color:#fff;border-radius:12px;border:1px solid #333;">
      <h2 style="color:#33ffaa;">✅ Device Fully Charged!</h2>
      <p>Hi ${name || 'Customer'},</p>
      <p>Your <strong>${deviceName || 'device'}</strong> is ready for pickup.</p>
      ${ticketNumber ? `<p>🎫 Ticket: <strong>${ticketNumber}</strong></p>` : ''}
      ${amount ? `<p>💰 Amount: <strong>₦${amount}</strong></p>` : ''}
      <p>📍 <strong>PrimeShieldHub</strong></p>
      <p>⏰ We close at <strong>9 PM</strong></p>
      <p style="color:#888;font-size:12px;margin-top:20px;">Thank you for choosing PrimeShieldHub 🛡️</p>
    </div>
  `;
  
  return notifyUser(
    { email, phone, subject: '🔋 Your device is ready for pickup!', message, html },
    env,
    { email: !!email, sms: !!phone, whatsapp: !!phone, telegram: true }
  );
}

/**
 * Notify customer that store is closing soon
 */
export async function notifyClosingReminder({ name, email, phone, ticketNumber, minutesLeft }, env) {
  const urgency = minutesLeft && minutesLeft <= 15 ? '⚠️ URGENT: ' : '';
  const message = `${urgency}🏪 PrimeShieldHub closes in ${minutesLeft || 'a few'} minutes!\n\n` +
    `🎫 Ticket: ${ticketNumber || 'N/A'}\n` +
    `Please collect your device before closing.\n` +
    `📍 PrimeShieldHub\n` +
    `📞 +234 810 353 5978`;
  
  const subject = `${urgency}Closing Soon - Collect Your Device`;
  
  return notifyUser(
    { email, phone, subject, message },
    env,
    { email: !!email, sms: !!phone, whatsapp: !!phone }
  );
}

/**
 * Notify urgent closing reminder (within 15 minutes)
 */
export async function notifyUrgentClosing({ name, email, phone, ticketNumber, minutesLeft }, env) {
  const message = `⚠️ URGENT: PrimeShieldHub is closing in ${minutesLeft || 'a few'} minutes!\n\n` +
    `🎫 Ticket: ${ticketNumber || 'N/A'}\n` +
    `Please collect your device IMMEDIATELY!\n` +
    `📍 PrimeShieldHub\n` +
    `📞 +234 810 353 5978`;
  
  return notifyUser(
    { email, phone, subject: '⚠️ URGENT: Store Closing Soon', message },
    env,
    { email: !!email, sms: !!phone, whatsapp: !!phone }
  );
}

/**
 * Notify customer their device is in overnight storage
 */
export async function notifyOvernightStorage({ phone, email, name, ticketNumber, deviceName }, env) {
  const message = `🌙 PrimeShieldHub is now closed.\n\n` +
    `Your ${deviceName || 'device'} (🎫 ${ticketNumber || 'N/A'}) is in overnight storage.\n\n` +
    `📍 Pickup tomorrow from 8 AM\n` +
    `📍 PrimeShieldHub\n` +
    `📞 +234 810 353 5978\n\n` +
    `💵 Storage fee may apply.`;
  
  return notifyUser(
    { email, phone, subject: '🌙 Device in Overnight Storage', message },
    env,
    { email: !!email, sms: !!phone, whatsapp: !!phone }
  );
}

/**
 * Notify customer that a new session has started
 */
export async function notifySessionStarted({ name, email, phone, ticketNumber, deviceName, amount, estimate }, env) {
  const message = `🔋 Charging started!\n\n` +
    `🎫 Ticket: ${ticketNumber}\n` +
    `📱 Device: ${deviceName || 'Your device'}\n` +
    `⏱️ Estimated: ${estimate || 'N/A'} minutes\n` +
    `💰 Fee: ₦${amount || '0'}\n\n` +
    `We'll notify you when it's ready! 🛡️`;
  
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#0a0a1a;color:#fff;border-radius:12px;border:1px solid #333;">
      <h2 style="color:#00f7ff;">🔋 Charging Started</h2>
      <p>Hi ${name || 'Customer'},</p>
      <p>Your device is now charging.</p>
      <p>🎫 Ticket: <strong>${ticketNumber}</strong></p>
      <p>📱 Device: ${deviceName || 'Your device'}</p>
      <p>⏱️ Estimated: ${estimate || 'N/A'} minutes</p>
      <p>💰 Fee: <strong>₦${amount || '0'}</strong></p>
      <p style="color:#888;font-size:12px;margin-top:20px;">We'll notify you when it's ready! 🛡️</p>
    </div>
  `;
  
  return notifyUser(
    { email, phone, subject: `🔋 Charging Started - ${ticketNumber}`, message, html },
    env,
    { email: !!email, sms: !!phone, whatsapp: !!phone, telegram: true }
  );
}

// ==================== EXPORTS ====================

export default {
  // Core
  sendEmail,
  sendSMS,
  sendWhatsApp,
  sendTelegram,
  notifyUser,
  
  // OTP & Auth
  sendOTPEmail,
  sendWelcomeEmail,
  sendStaffWelcomeEmail,
  sendAdminNotification,
  
  // Security
  sendSecurityAlert,
  
  // Payments
  sendPaymentReceipt,
  
  // Battery
  sendBatteryAlert,
  
  // Charging
  notifyDeviceReady,
  notifyClosingReminder,
  notifyUrgentClosing,
  notifyOvernightStorage,
  notifySessionStarted
};
