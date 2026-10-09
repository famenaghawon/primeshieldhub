// ======================================================================
// NOTIFICATION HANDLERS - v3.0 WITH PUSH NOTIFICATIONS (Cloudflare Compatible)
// Includes sendEmail, sendOTPEmail with professional templates
// Anti-spam headers for Gmail deliverability
// Web Push Notification helpers using VAPID keys from env
// ======================================================================

// ======================================================================
// FIXED: Import path for requireAuth
// ======================================================================
import { requireAuth } from '../middleware/auth.js';
import { validateString, validatePhone } from '../utils/validation.js';
import { getCorsHeaders } from '../middleware/cors.js';

// ======================================================================
// CORE EMAIL SENDING FUNCTION (Anti-Spam Optimized)
// ======================================================================

/**
 * Send email via Resend with anti-spam headers
 * Uses security@primeshieldhub.com as sender for better deliverability
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
        from: "PrimeShieldHub <security@primeshieldhub.com>",
        to,
        subject,
        html,
        reply_to: "support@primeshieldhub.com",
        headers: {
          "X-Priority": "1",
          "X-MSMail-Priority": "High",
          "List-Unsubscribe": "<mailto:support@primeshieldhub.com?subject=unsubscribe>",
          "X-Entity-Ref-ID": `psh-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Notifications] Resend error:', data);
      return { error: data.message || 'Email send failed' };
    }
    console.log(`[Notifications] Email sent to ${to}: ${data.id || 'success'}`);
    return data;
  } catch (e) {
    console.error('[Notifications] Email exception:', e);
    return { error: e.message };
  }
}

// ======================================================================
// OTP EMAIL (Professional Template - Anti-Spam)
// ======================================================================

/**
 * Send OTP verification email
 * Professional HTML template with security branding
 */
export async function sendOTPEmail({ email, otp, purpose = 'login' }, env) {
  const purposeText = purpose === 'login' ? 'sign in to your account' : 
                       purpose === 'register' ? 'complete your registration' : 
                       purpose === 'password-reset' ? 'reset your password' : purpose;
  
  const purposeTitle = purpose === 'login' ? 'Account Sign-In' : 
                        purpose === 'register' ? 'Account Registration' : 
                        purpose === 'password-reset' ? 'Password Reset' : 'Verification';
  
  return sendEmail(
    email,
    `${otp} is your PrimeShieldHub verification code`,
    `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
    </head>
    <body style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background: #f4f4f8; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f8; padding: 20px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; width: 100%; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <tr>
                <td style="background: #12122a; padding: 30px 24px; text-align: center;">
                  <h1 style="color: #d6b25e; font-size: 22px; margin: 0; font-weight: 700; letter-spacing: 1px; font-family: 'Segoe UI', Arial, sans-serif;">PRIMESHIELDHUB</h1>
                  <p style="color: #8888aa; font-size: 12px; margin: 4px 0 0; letter-spacing: 2px; text-transform: uppercase;">SECURE VERIFICATION</p>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 32px 24px; text-align: center;">
                  <p style="font-size: 15px; color: #333; margin: 0 0 8px; line-height: 1.5;">
                    Use the following verification code to <strong>${purposeText}</strong>:
                  </p>
                  
                  <!-- OTP Code Box -->
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
                    <tr>
                      <td style="background: #f8f8fc; border: 2px dashed #d6b25e; border-radius: 10px; padding: 16px 32px; text-align: center;">
                        <span style="font-size: 42px; font-weight: 800; color: #12122a; letter-spacing: 12px; font-family: 'Courier New', Courier, monospace;">${otp}</span>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="font-size: 13px; color: #888; line-height: 1.8; margin: 0;">
                    This code expires in <strong>10 minutes</strong>.<br>
                    <strong style="color: #d63031;">Never share this code with anyone.</strong><br>
                    Our team will never ask for your verification code.
                  </p>
                  
                  <!-- Divider -->
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
                    <tr>
                      <td style="border-top: 1px solid #e8e8ee;"></td>
                    </tr>
                  </table>
                  
                  <!-- Security Info -->
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="font-size: 11px; color: #999; margin: 0 0 8px; line-height: 1.6;">
                          🔒 This is a secure, system-generated message from PrimeShieldHub.<br>
                          Requested from IP: <span style="color: #666;">[Logged for security]</span><br>
                          Time: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background: #f8f8fc; padding: 20px 24px; text-align: center;">
                  <p style="font-size: 11px; color: #999; margin: 0 0 8px; line-height: 1.6;">
                    If you did not request this code, please ignore this email or contact<br>
                    <a href="mailto:support@primeshieldhub.com" style="color: #d6b25e; text-decoration: none;">support@primeshieldhub.com</a>
                  </p>
                  <p style="font-size: 10px; color: #bbb; margin: 0;">
                    This is an automated message. Please do not reply directly to this email.
                  </p>
                </td>
              </tr>
              
              <!-- Legal Footer -->
              <tr>
                <td style="padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
                  <p style="font-size: 10px; color: #bbb; margin: 0; line-height: 1.6;">
                    PrimeShieldHub Gadgets Limited · RC 9283954<br>
                    108 Newton Street (Ekhorummtomwen Street),<br>
                    off Ugbowo-Lagos Road, Benin City, Edo State, Nigeria
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `,
    env
  );
}

// ======================================================================
// WELCOME EMAIL
// ======================================================================

/**
 * Send staff welcome email
 */
export async function sendStaffWelcomeEmail(env, email, name, branchName, status) {
  const isApproved = status === 'active';
  const subject = isApproved 
    ? `Welcome to PrimeShieldHub, ${name}!` 
    : `Registration Received - PrimeShieldHub`;
  
  return sendEmail(
    email,
    subject,
    `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f8; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 30px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background: #12122a; padding: 30px 24px; text-align: center;">
            <h1 style="color: #d6b25e; font-size: 22px; margin: 0; font-weight: 700;">PRIMESHIELDHUB</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 24px;">
            <h2 style="color: #12122a; font-size: 18px; margin: 0 0 16px;">${isApproved ? `Welcome, ${name}! 🎉` : `Hi ${name},`}</h2>
            ${isApproved 
              ? `<p style="font-size: 14px; color: #555; line-height: 1.6;">Your staff account has been <strong>approved</strong>! You are now an active member of the PrimeShieldHub team at <strong>${branchName}</strong>.</p>
                 <p style="font-size: 14px; color: #555; line-height: 1.6;">You can now log in to your dashboard and start serving customers.</p>
                 <div style="text-align: center; margin: 24px 0;">
                   <a href="https://primeshieldhub.com/staff" style="display: inline-block; background: #d6b25e; color: #12122a; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px;">Go to Dashboard</a>
                 </div>`
              : `<p style="font-size: 14px; color: #555; line-height: 1.6;">Thank you for registering with PrimeShieldHub! Your application for <strong>${branchName}</strong> has been received and is currently <strong>pending approval</strong>.</p>
                 <p style="font-size: 14px; color: #555; line-height: 1.6;">You will receive another email once your account has been reviewed by our admin team. This usually takes 24-48 hours.</p>`
            }
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
            <p style="font-size: 10px; color: #bbb;">PrimeShieldHub Gadgets Limited · RC 9283954</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `,
    env
  );
}

// ======================================================================
// ADMIN NOTIFICATION
// ======================================================================

/**
 * Send admin notification
 */
export async function sendAdminNotification(env, data) {
  const adminEmail = env.ADMIN_EMAIL || 'ceo@primeshieldhub.com';
  
  if (data.type === 'staff_registration') {
    return sendEmail(
      adminEmail,
      `New Staff Registration: ${data.staffName}`,
      `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #12122a;">New Staff Registration</h2>
        <p><strong>Name:</strong> ${data.staffName}</p>
        <p><strong>Email:</strong> ${data.staffEmail}</p>
        ${data.staffId ? `<p><strong>Staff ID:</strong> ${data.staffId}</p>` : ''}
        <p><strong>Branch:</strong> ${data.branchName || 'N/A'}</p>
        <p style="margin-top: 20px;"><a href="https://primeshieldhub.com/admin/staff" style="background: #d6b25e; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review in Admin Panel</a></p>
      </div>
      `,
      env
    );
  }
}

// ======================================================================
// ===== PUSH NOTIFICATION HELPER FUNCTIONS =====
// ======================================================================

/**
 * Initialize the push_subscriptions table if it doesn't exist
 */
export async function initPushTable(env) {
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        endpoint TEXT UNIQUE NOT NULL,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Create index for faster lookups
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_push_user_id ON push_subscriptions(user_id)
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_push_endpoint ON push_subscriptions(endpoint)
    `).run();
    
    console.log('[Push] Table initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('[Push] Table init error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a push notification to a single subscription
 * Uses Web Push API directly (no npm package needed)
 */
export async function sendPushNotification(subscription, payload, env) {
  try {
    const vapidPublicKey = env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
    
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('[Push] VAPID keys not configured');
      return { success: false, error: 'VAPID keys not configured' };
    }

    // Ensure payload is a string
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

    // Prepare headers for Web Push API
    const headers = {
      'Content-Type': 'application/octet-stream',
      'TTL': '86400', // 24 hours
    };

    // Add VAPID headers
    const vapidHeaders = await createVapidHeaders(
      subscription.endpoint,
      vapidPublicKey,
      vapidPrivateKey,
      env.VAPID_SUBJECT || 'mailto:primeshieldhub@gmail.com'
    );

    Object.assign(headers, vapidHeaders);

    // Encrypt payload
    const encrypted = await encryptPayload(
      payloadString,
      subscription.keys.p256dh,
      subscription.keys.auth
    );

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: headers,
      body: encrypted
    });

    if (response.status === 410 || response.status === 404) {
      return { 
        success: false, 
        error: 'Subscription expired or invalid',
        isInvalid: true,
        statusCode: response.status
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Push] Send error:', response.status, errorText);
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorText}`,
        statusCode: response.status
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[Push] Send error:', error.message);
    return { 
      success: false, 
      error: error.message,
      isInvalid: error.message.includes('410') || error.message.includes('404')
    };
  }
}

/**
 * Create VAPID headers for Web Push
 */
async function createVapidHeaders(endpoint, publicKey, privateKey, subject) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  // Create JWT for VAPID
  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 43200, // 12 hours
    sub: subject
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Sign with private key (using Web Crypto API)
  const signature = await signVapidJWT(
    `${encodedHeader}.${encodedPayload}`,
    privateKey
  );

  const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;

  return {
    'Authorization': `WebPush ${jwt}`,
    'Crypto-Key': `p256ecdsa=${publicKey}`
  };
}

/**
 * Sign a JWT using VAPID private key
 */
async function signVapidJWT(data, privateKeyPEM) {
  try {
    // Import the private key
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToArrayBuffer(privateKeyPEM),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      encoder.encode(data)
    );

    return base64UrlEncode(arrayBufferToBase64(signature));
  } catch (error) {
    console.error('[Push] Sign error:', error);
    // Fallback: if signing fails, return a placeholder
    return base64UrlEncode('placeholder');
  }
}

/**
 * Encrypt payload for Web Push
 */
async function encryptPayload(payload, p256dhBase64, authBase64) {
  const p256dh = base64UrlToUint8Array(p256dhBase64);
  const auth = base64UrlToUint8Array(authBase64);

  // Generate ephemeral key pair
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(publicKey);

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: await importPublicKey(p256dh) },
    keyPair.privateKey,
    256
  );

  // Create info string for encryption
  const encoder = new TextEncoder();
  const info = encoder.encode('WebPush: info');

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive content encryption key
  const contentKey = await deriveKey(
    sharedSecret,
    auth,
    salt,
    info
  );

  // Encrypt the payload
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    contentKey,
    encoder.encode(payload)
  );

  // Build the final payload
  const result = new Uint8Array(
    1 + // salt length
    16 + // salt
    1 + // public key length
    65 + // public key (uncompressed)
    1 + // IV length
    12 + // IV
    encrypted.byteLength
  );

  let offset = 0;
  result[offset++] = 16; // salt length
  result.set(salt, offset);
  offset += 16;
  result[offset++] = 65; // public key length (uncompressed)
  // Add 0x04 prefix for uncompressed point
  const pubKeyBytes = base64UrlToUint8Array(publicKeyBase64);
  result.set(pubKeyBytes.slice(-65), offset);
  offset += 65;
  result[offset++] = 12; // IV length
  result.set(iv, offset);
  offset += 12;
  result.set(new Uint8Array(encrypted), offset);

  return result;
}

/**
 * Derive encryption key from shared secret
 */
async function deriveKey(sharedSecret, authSecret, salt, info) {
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    authSecret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const prk = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    sharedSecret
  );

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const encoder = new TextEncoder();
  const context = new Uint8Array([...encoder.encode('Content-Encoding: aes128gcm')]);

  const contentKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: context
    },
    keyMaterial,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt', 'decrypt']
  );

  return contentKey;
}

/**
 * Import public key for ECDH
 */
async function importPublicKey(keyData) {
  // Add 0x04 prefix for uncompressed point if missing
  let data = keyData;
  if (data.length === 65 && data[0] !== 0x04) {
    const padded = new Uint8Array(65);
    padded[0] = 0x04;
    padded.set(data, 1);
    data = padded;
  }

  return await crypto.subtle.importKey(
    'spki',
    data,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );
}

/**
 * Utility: Base64 URL encode
 */
function base64UrlEncode(str) {
  return str
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Utility: Base64 URL to Uint8Array
 */
function base64UrlToUint8Array(base64) {
  let b64 = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Utility: ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Utility: PEM to ArrayBuffer
 */
function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN [\w\s]+-----/, '')
    .replace(/-----END [\w\s]+-----/, '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Send push notification to all subscribers for a given user ID
 */
export async function sendPushToUser(userId, title, message, env, options = {}) {
  try {
    // Get user's subscriptions
    const subscriptions = await env.DB.prepare(
      "SELECT * FROM push_subscriptions WHERE user_id = ?"
    ).bind(userId).all();

    if (!subscriptions.results || subscriptions.results.length === 0) {
      return { success: false, message: 'No active subscriptions for this user', sentCount: 0 };
    }

    const payload = JSON.stringify({
      title: title,
      body: message,
      icon: options.icon || '/favicon.png',
      badge: options.badge || '/favicon.png',
      url: options.url || '/',
      tag: options.tag || `psh-${Date.now()}`
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const sub of subscriptions.results) {
      const result = await sendPushNotification({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth
        }
      }, payload, env);

      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
        if (result.isInvalid) {
          // Remove invalid subscription
          await env.DB.prepare(
            "DELETE FROM push_subscriptions WHERE endpoint = ?"
          ).bind(sub.endpoint).run();
        }
      }
    }

    return {
      success: true,
      sentCount,
      failedCount,
      total: subscriptions.results.length
    };
  } catch (error) {
    console.error('[Push] Send to user error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notification to all active subscribers
 */
export async function sendPushToAll(title, message, env, options = {}) {
  try {
    // Get all active subscriptions (last 90 days)
    const subscriptions = await env.DB.prepare(
      "SELECT * FROM push_subscriptions WHERE created_at > datetime('now', '-90 days')"
    ).all();

    if (!subscriptions.results || subscriptions.results.length === 0) {
      return { success: false, message: 'No active subscribers', sentCount: 0 };
    }

    const payload = JSON.stringify({
      title: title,
      body: message,
      icon: options.icon || '/favicon.png',
      badge: options.badge || '/favicon.png',
      url: options.url || '/',
      tag: options.tag || `psh-${Date.now()}`
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const sub of subscriptions.results) {
      const result = await sendPushNotification({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth
        }
      }, payload, env);

      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
        if (result.isInvalid) {
          await env.DB.prepare(
            "DELETE FROM push_subscriptions WHERE endpoint = ?"
          ).bind(sub.endpoint).run();
        }
      }
    }

    return {
      success: true,
      sentCount,
      failedCount,
      total: subscriptions.results.length
    };
  } catch (error) {
    console.error('[Push] Send to all error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a push notification for a specific event (webhook trigger)
 */
export async function sendPushForEvent(event, data, env) {
  const eventMap = {
    'order_placed': {
      title: '🛒 New Order!',
      message: `Order #${data?.orderId || ''} has been placed.`,
      url: '/admin/orders'
    },
    'low_stock': {
      title: '⚠️ Low Stock Alert',
      message: `Product "${data?.productName || ''}" is running low (${data?.stock || 0} left).`,
      url: '/admin/products'
    },
    'new_review': {
      title: '⭐ New Review',
      message: `${data?.customerName || 'A customer'} left a ${data?.rating || '★'} review.`,
      url: '/admin/reviews'
    },
    'staff_verified': {
      title: '✅ Staff Verified',
      message: `${data?.staffName || 'A staff member'} has been verified.`,
      url: '/admin/staff'
    },
    'payment_received': {
      title: '💰 Payment Received',
      message: `Payment of ₦${data?.amount?.toLocaleString() || '0'} received for order #${data?.orderId || ''}`,
      url: '/admin/orders'
    },
    'customer_feedback': {
      title: '💬 New Feedback',
      message: `${data?.customerName || 'A customer'} left feedback: "${data?.feedback?.substring(0, 50) || ''}"`,
      url: '/admin/feedback'
    }
  };

  const notification = eventMap[event];
  if (!notification) {
    return { success: false, error: `Unknown event: ${event}` };
  }

  // Send to all admin users with push enabled
  const result = await sendPushToAll(
    notification.title,
    notification.message,
    env,
    { url: notification.url, icon: '/favicon.png' }
  );

  return result;
}

/**
 * Get VAPID public key for frontend
 */
export function getVapidPublicKey(env) {
  return env.VAPID_PUBLIC_KEY || '';
}

/**
 * Check if push notifications are configured
 */
export function isPushConfigured(env) {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

// ======================================================================
// SMS NOTIFICATION HANDLER
// ======================================================================

/**
 * Handle send SMS notification
 */
export async function handleSendSMS(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized - Staff access required" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const phone = validatePhone(body.phone);
    const message = validateString(body.message, 160);
    const sessionId = body.sessionId ? parseInt(body.sessionId) : null;

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "Valid phone and message required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (sessionId && !isNaN(sessionId)) {
      await env.DB.prepare(
        "UPDATE charging_sessions SET notified_ready = 1, last_notification = datetime('now') WHERE id = ?"
      ).bind(sessionId).run();
    }

    // Send via Termii
    if (env.TERMII_API_KEY) {
      await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: env.TERMII_API_KEY,
          to: phone.replace(/^\+/, ''),
          from: "PrimeShield",
          sms: message,
          type: "plain"
        })
      }).catch(() => {});
    }

    // Send via Twilio SMS
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE) {
      const twilioAuth = btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN);
      await fetch('https://api.twilio.com/2010-04-01/Accounts/' + env.TWILIO_ACCOUNT_SID + '/Messages.json', {
        method: "POST",
        headers: { "Authorization": "Basic " + twilioAuth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: phone, From: env.TWILIO_PHONE, Body: message })
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// WHATSAPP NOTIFICATION HANDLER
// ======================================================================

/**
 * Handle send WhatsApp notification
 */
export async function handleSendWhatsApp(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized - Staff access required" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const phone = validatePhone(body.phone);
    const message = validateString(body.message, 4096);
    const sessionId = body.sessionId ? parseInt(body.sessionId) : null;

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "Valid phone and message required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (sessionId && !isNaN(sessionId)) {
      await env.DB.prepare("UPDATE charging_sessions SET notified_whatsapp = 1 WHERE id = ?").bind(sessionId).run();
    }

    // Send via Twilio WhatsApp
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_NUMBER) {
      const twilioAuth = btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN);
      await fetch('https://api.twilio.com/2010-04-01/Accounts/' + env.TWILIO_ACCOUNT_SID + '/Messages.json', {
        method: "POST",
        headers: { "Authorization": "Basic " + twilioAuth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          To: 'whatsapp:' + phone.replace(/^\+/, ''),
          From: 'whatsapp:' + env.TWILIO_WHATSAPP_NUMBER,
          Body: message
        })
      }).catch(() => {});
    }

    // Send via WhatsApp Cloud API
    if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID) {
      await fetch('https://graph.facebook.com/v18.0/' + env.WHATSAPP_PHONE_ID + '/messages', {
        method: "POST",
        headers: { "Authorization": "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone.replace(/^\+/, ''),
          type: "text",
          text: { body: message }
        })
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// TELEGRAM NOTIFICATION HANDLER
// ======================================================================

/**
 * Handle send Telegram notification
 */
export async function handleSendTelegram(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized - Staff access required" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const chatId = validateString(body.chatId, 100);
    const message = validateString(body.message, 4096);
    const sessionId = body.sessionId ? parseInt(body.sessionId) : null;

    if (!chatId || !message) {
      return new Response(JSON.stringify({ error: "Valid chatId and message required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (sessionId && !isNaN(sessionId)) {
      await env.DB.prepare("UPDATE charging_sessions SET notified_telegram = 1 WHERE id = ?").bind(sessionId).run();
    }

    if (env.TELEGRAM_BOT_TOKEN) {
      const cleanMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: cleanMessage, parse_mode: "Markdown" })
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
