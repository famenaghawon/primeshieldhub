// ======================================================================
// AUTHENTICATION HANDLERS — COMPLETE INTEGRATED VERSION v13.2
// Full authentication with staff registration, OTP, sessions, roles,
// Two-Factor Authentication (2FA) support, Admin Management,
// AND REFERRAL SYSTEM INTEGRATION
// FIXED: OTP verification response structure matches frontend expectations
// FIXED: Added sessionId to response for better compatibility
// FIXED: Proper token handling in all responses
// FIXED: Referral code support in user registration
// ======================================================================

import { 
  validateEmail, validateString, validateUUID, validatePhone 
} from '../utils/validation.js';
import { 
  hashPassword, verifyPassword, generateSecureOTP, safeCompare, 
  generateJWT, signPayload, verifyJWT 
} from '../utils/crypto.js';
import { requireAuth, createSession } from '../middleware/auth.js';
import { checkRateLimit, resetRateLimit } from '../middleware/rate-limit.js';
import { logEvent, logAudit } from '../utils/logging.js';
import { parseCookies } from '../utils/validation.js';
import { getCorsHeaders } from '../middleware/cors.js';
import { addSecurityHeaders } from '../middleware/security.js';
import { nanoid } from 'nanoid';

// ===== IMPORTS =====
import { sendOTPEmail, sendStaffWelcomeEmail, sendAdminNotification } from '../../notifications.js';
import { generateStaffDisplayId } from './staff-payout.js';
// =====================================

// ======================================================================
// UTILITY HELPERS
// ======================================================================

/**
 * Generate secure ticket number for staff registration (fallback only)
 */
function generateStaffCode() {
  const prefix = 'PSH-STAFF';
  const random = nanoid(8).toUpperCase();
  return `${prefix}-${random}`;
}

/**
 * Check if user has active session
 */
async function hasActiveSession(env, userId) {
  const sessionKey = `user_session:${userId}`;
  const session = await env.RATE_LIMITER.get(sessionKey);
  return !!session;
}

/**
 * Get branch details by ID
 */
async function getBranchDetails(env, branchId) {
  if (!branchId) return null;
  try {
    const query = await env.DB.prepare(
      "SELECT id, name, city, address, phone FROM branches WHERE id = ? AND status = 'active'"
    ).bind(branchId);
    return await query.first();
  } catch (e) {
    console.error('Branch lookup error:', e);
    return null;
  }
}

/**
 * Validate branch exists and is active
 */
async function validateBranch(env, branchId) {
  if (!branchId) return false;
  try {
    const query = await env.DB.prepare(
      "SELECT id FROM branches WHERE id = ? AND status = 'active'"
    ).bind(branchId);
    const result = await query.first();
    return !!result;
  } catch (e) {
    return false;
  }
}

/**
 * Safe name extraction from email - null-safe
 */
function getDisplayName(user) {
  if (user.name && user.name.trim()) return user.name;
  if (user.email && user.email.includes('@')) return user.email.split('@')[0];
  return 'User';
}

/**
 * Process referral for new user registration
 * 🔥 REFERRAL SYSTEM INTEGRATION 🔥
 */
async function processReferral(env, userId, email, referralCode) {
  if (!referralCode) {
    console.log('[Referral] No referral code provided');
    return null;
  }

  console.log(`[Referral] Processing referral for user ${userId} with code: ${referralCode}`);

  try {
    // Look up the referrer by referral_code
    const referrer = await env.DB.prepare(
      "SELECT id, total_referrals FROM users WHERE referral_code = ?"
    ).bind(referralCode).first();

    if (!referrer) {
      console.log(`[Referral] Referrer not found for code: ${referralCode}`);
      return null;
    }

    // Don't allow self-referral
    if (referrer.id === userId) {
      console.log(`[Referral] Self-referral prevented for user: ${userId}`);
      return null;
    }

    // Check if this user was already referred
    const existingReferral = await env.DB.prepare(
      "SELECT id FROM referrals WHERE referred_user_id = ? OR referred_email = ?"
    ).bind(userId, email).first();

    if (existingReferral) {
      console.log(`[Referral] User ${userId} already has a referral record`);
      return null;
    }

    // Create referral record
    const refId = nanoid();
    const rewardAmount = 500; // ₦500 reward in kobo

    await env.DB.prepare(
      `INSERT INTO referrals (id, referrer_id, referred_user_id, referred_email, status, reward_amount, created_at) 
       VALUES (?, ?, ?, ?, 'signed_up', ?, datetime('now'))`
    ).bind(refId, referrer.id, userId, email, rewardAmount).run();

    // Update referrer's total referrals count
    await env.DB.prepare(
      "UPDATE users SET total_referrals = total_referrals + 1 WHERE id = ?"
    ).bind(referrer.id).run();

    // Add points to the referrer (500 points)
    await env.DB.prepare(
      "UPDATE users SET points = COALESCE(points, 0) + ? WHERE id = ?"
    ).bind(rewardAmount, referrer.id).run();

    // Log the referral event
    await logEvent(env, "REFERRAL", `User ${email} referred by ${referrer.id}`, userId, { 
      referrer_id: referrer.id, 
      referral_code: referralCode,
      reward: rewardAmount
    });

    console.log(`[Referral] Successfully processed referral for ${email} from ${referrer.id}`);
    
    return {
      referrer_id: referrer.id,
      reward: rewardAmount,
      referral_id: refId
    };

  } catch (error) {
    console.error('[Referral] Error processing referral:', error);
    // Don't fail registration if referral processing fails
    return null;
  }
}

// ======================================================================
// 1. OTP REQUEST (Enhanced - Multi-format Support)
// ======================================================================

/**
 * Handle OTP request
 * POST /api/auth/request-otp
 */
async function handleRequestOTP(request, env, ctx, corsHeaders, ip, fingerprint) {
  try {
    const body = await request.json();
    
    // Support multiple field name formats
    const email = body.email || body.userEmail || body.emailAddress || null;
    const password = body.password || body.pin || body.passcode || null;
    
    if (!email || !password) {
      return new Response(JSON.stringify({ 
        error: "Email and password required" 
      }), {
        status: 400, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const reqFingerprint = request.headers.get("x-device-fingerprint") || fingerprint || "none";
    
    // Find user by email - support both users and staff tables
    const userQuery = await env.DB.prepare(`
      SELECT id, email, role, password_hash, password_salt, phone, status 
      FROM users 
      WHERE email = ?
    `).bind(email);
    const userResult = await userQuery.all();
    
    let user = null;
    let isStaff = false;
    
    if (userResult.results.length === 0) {
      // Check staff table as fallback
      const staffQuery = await env.DB.prepare(`
        SELECT id, email, role, password_hash, password_salt, phone, status 
        FROM staff 
        WHERE email = ?
      `).bind(email);
      const staffResult = await staffQuery.all();
      
      if (staffResult.results.length === 0) {
        await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401, 
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      user = staffResult.results[0];
      isStaff = true;
    } else {
      user = userResult.results[0];
    }
    
    // Check user status
    if (user.status === 'suspended' || user.status === 'banned') {
      return new Response(JSON.stringify({ 
        error: "Account suspended. Please contact support." 
      }), {
        status: 403, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    // Check if staff is pending
    if (isStaff && user.status === 'pending') {
      return new Response(JSON.stringify({ 
        error: "Account pending approval. Please wait for admin activation." 
      }), {
        status: 403, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    // Verify password
    const valid = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!valid) {
      await logAudit(env, "LOGIN_FAILED", user.id, isStaff ? "staff" : "user", user.id, {
        reason: "invalid_password"
      }, ip, reqFingerprint);
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    // Check OTP rate limit
    const otpLimitKey = "otp_limit:" + user.id;
    const rateCheck = await checkRateLimit(env, otpLimitKey, 3, 300);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: "Too many OTP requests. Try later." }), {
        status: 429, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    // Generate OTP
    const otp = generateSecureOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    
    // Store OTP
    await env.DB.prepare(
      "INSERT INTO otp_codes (id, user_id, code, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(nanoid(), user.id, otp, expiresAt).run();
    
    // Send OTP email in background
    try { 
      sendOTPEmail({ email: user.email, otp: otp, purpose: 'login' }, env);
    } catch (e) { 
      console.error('OTP email failed:', e);
    }
    
    await logAudit(env, "OTP_REQUESTED", user.id, isStaff ? "staff" : "user", user.id, {}, ip, reqFingerprint);
    
    return new Response(JSON.stringify({
      success: true, 
      userId: user.id, 
      requiresOtp: true,
      role: user.role,
      isStaff: isStaff
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('OTP request error:', error);
    return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), {
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 2. OTP VERIFICATION (FIXED - Response structure for frontend)
// ======================================================================

/**
 * Handle OTP verification
 * POST /api/auth/verify-otp
 * FIXED: Response now properly includes token and sessionId at top level
 */
async function handleVerifyOTP(request, env, ctx, corsHeaders, ip, fingerprint) {
  try {
    const body = await request.json();
    
    console.log('[OTP Verify] Received body:', JSON.stringify(body));
    
    // Extract fields with multiple name support
    const email = body.email || body.userEmail || body.emailAddress || body.username || null;
    const otpCode = body.otpCode || body.otp || body.code || body.verificationCode || body.token || null;
    const userId = body.userId || body.user_id || body.id || body.staffId || null;
    const reqFingerprint = body.fingerprint || request.headers.get("x-device-fingerprint") || fingerprint || "none";
    
    let resolvedUserId = userId;
    
    // Case 1: Email + OTP
    if (email && otpCode) {
      console.log(`[OTP Verify] Checking with email: ${email}`);
      let userResults = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).all();
      if (userResults.results.length > 0) {
        resolvedUserId = userResults.results[0].id;
      } else {
        const staffResults = await env.DB.prepare("SELECT id FROM staff WHERE email = ?").bind(email).all();
        if (staffResults.results.length > 0) {
          resolvedUserId = staffResults.results[0].id;
        }
      }
      if (!resolvedUserId) {
        return new Response(JSON.stringify({ success: false, error: "User not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }
    
    // Case 2: User ID + OTP
    if (!resolvedUserId && userId && otpCode) {
      resolvedUserId = userId;
    }
    
    if (!resolvedUserId || !otpCode) {
      console.log('[OTP Verify] Missing required fields. userId:', resolvedUserId, 'otpCode:', otpCode);
      return new Response(JSON.stringify({ success: false, error: "Missing required fields. Please provide email and OTP code." }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    // Verify OTP
    const otpQuery = await env.DB.prepare(
      "SELECT * FROM otp_codes WHERE user_id = ? AND code = ? AND verified = 0"
    ).bind(resolvedUserId, otpCode);
    const otpResult = await otpQuery.all();
    
    if (otpResult.results.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Invalid OTP" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const otpRecord = otpResult.results[0];
    if (Date.now() > otpRecord.expires_at) {
      return new Response(JSON.stringify({ success: false, error: "OTP expired" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    await env.DB.prepare("UPDATE otp_codes SET verified = 1 WHERE id = ?").bind(otpRecord.id).run();
    
    // Get user data - check both tables
    let userQuery = await env.DB.prepare(
      "SELECT id, role, phone, email, name, status FROM users WHERE id = ?"
    ).bind(resolvedUserId);
    let userResult = await userQuery.all();
    
    let user;
    let isStaff = false;
    
    if (userResult.results.length === 0) {
      const staffQuery = await env.DB.prepare(
        "SELECT id, role, phone, email, name, status, branch_id, branch_name FROM staff WHERE id = ?"
      ).bind(resolvedUserId);
      const staffResult = await staffQuery.all();
      
      if (staffResult.results.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "User not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      user = staffResult.results[0];
      isStaff = true;
      
      if (user.status === 'pending') {
        return new Response(JSON.stringify({ success: false, error: "Account pending approval. Please wait for admin activation.", isStaff: true, status: 'pending' }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      if (user.status === 'inactive' || user.status === 'suspended') {
        return new Response(JSON.stringify({ success: false, error: "Account is suspended. Please contact admin.", isStaff: true, status: user.status }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    } else {
      user = userResult.results[0];
    }
    
    // ============================================================
    // FIXED: Create session and get the token
    // ============================================================
    const { token } = await createSession(env, user.id, user.role || (isStaff ? 'staff' : 'user'), reqFingerprint, ip);
    
    // Store staff-specific data if applicable
    let branchInfo = null;
    if (isStaff && user.branch_id) {
      const branchResult = await getBranchDetails(env, user.branch_id);
      if (branchResult) {
        branchInfo = { id: branchResult.id, name: branchResult.name, city: branchResult.city, address: branchResult.address };
      }
    }
    
    await logEvent(env, "LOGIN", "User " + user.id + " logged in via OTP", user.id);
    await logAudit(env, "LOGIN_SUCCESS", user.id, isStaff ? "staff" : "user", user.id, { method: "otp", isStaff: isStaff }, ip, reqFingerprint);
    
    // ============================================================
    // FIXED: Build response with token at the top level
    // ============================================================
    const displayName = getDisplayName(user);
    const displayRole = user.role || (isStaff ? 'staff' : 'user');
    
    // Build user object for frontend
    const userData = {
      id: user.id,
      name: displayName,
      email: user.email || '',
      role: displayRole,
      isStaff: isStaff,
      status: user.status || 'active'
    };
    
    // Add staff-specific fields
    if (isStaff) {
      userData.staff = {
        id: user.id,
        name: user.name || displayName,
        email: user.email || '',
        phone: user.phone || '',
        role: displayRole,
        status: user.status || 'active',
        branch: branchInfo
      };
      userData.branchId = user.branch_id;
      userData.branchName = user.branch_name;
    }
    
    if (branchInfo) {
      userData.branch = branchInfo;
    }
    
    // ============================================================
    // RESPONSE STRUCTURE - FIXED for frontend auth.js
    // ============================================================
    const responseData = {
      success: true,
      authenticated: true,
      token: token,                    // ← Frontend expects 'token' at top level
      sessionId: token,                // ← Also provide as sessionId
      user: userData,                  // ← User data
      role: displayRole,
      isStaff: isStaff,
      // Legacy fields for compatibility
      data: {
        token: token,
        user: userData
      }
    };
    
    // Set cookies
    const responseHeaders = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders
    });
    
    responseHeaders.append("Set-Cookie", "__Host-auth=" + token + "; HttpOnly; Secure; Path=/; Max-Age=86400; SameSite=None");
    responseHeaders.append("Set-Cookie", "auth=" + token + "; HttpOnly; Secure; Path=/; Max-Age=86400; SameSite=None");
    responseHeaders.append("Set-Cookie", "session=" + token + "; HttpOnly; Secure; Path=/; Max-Age=86400; SameSite=None");
    
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('OTP verification error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Server error: ' + error.message }), {
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 3. PASSWORD LOGIN (FIXED - Response structure for frontend)
// ======================================================================

/**
 * Handle password login
 * POST /api/auth/login
 * FIXED: Response now properly includes token and sessionId at top level
 */
async function handleLogin(request, env, ctx, corsHeaders, ip, fingerprint) {
  try {
    const body = await request.json();
    
    // Support multiple field name formats
    const email = body.email || body.userEmail || body.emailAddress || null;
    const password = body.password || body.pin || body.passcode || null;
    
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Rate limiting
    const combinedKey = "login:" + email + ":" + ip + ":" + (fingerprint || "unknown").slice(0, 8);
    const rateCheck = await checkRateLimit(env, combinedKey, 5, 900);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: "Too many attempts. Please try again later.", retryAfter: rateCheck.retryAfter }), {
        status: 429, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const ipKey = "login_attempts:" + ip;
    const ipCheck = await checkRateLimit(env, ipKey, 10, 900);
    if (!ipCheck.allowed) {
      return new Response(JSON.stringify({ error: "Too many login attempts. Try again in 15 minutes." }), {
        status: 429, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const emailKey = "login_attempts:" + email;
    const emailCheck = await checkRateLimit(env, emailKey, 5, 900);
    if (!emailCheck.allowed) {
      return new Response(JSON.stringify({ error: "Account temporarily locked. Try again in 15 minutes." }), {
        status: 429, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const reqFingerprint = request.headers.get("x-device-fingerprint") || fingerprint || "none";

    // Find user - check both tables
    let userQuery = await env.DB.prepare(
      "SELECT id, email, role, password_hash, password_salt, phone, name, status FROM users WHERE email = ?"
    ).bind(email);
    let userResult = await userQuery.all();

    let user;
    let isStaff = false;

    if (userResult.results.length === 0) {
      const staffQuery = await env.DB.prepare(
        "SELECT id, email, role, password_hash, password_salt, phone, name, status FROM staff WHERE email = ?"
      ).bind(email);
      const staffResult = await staffQuery.all();
      
      if (staffResult.results.length === 0) {
        await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      user = staffResult.results[0];
      isStaff = true;
      
      if (user.status === 'pending') {
        return new Response(JSON.stringify({ error: "Account pending approval. Please wait for admin activation." }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      if (user.status === 'inactive' || user.status === 'suspended') {
        return new Response(JSON.stringify({ error: "Account is inactive. Please contact support." }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    } else {
      user = userResult.results[0];
      
      if (user.status === 'suspended' || user.status === 'banned') {
        return new Response(JSON.stringify({ error: "Account suspended. Please contact support." }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!valid) {
      await logAudit(env, "LOGIN_FAILED", user.id, isStaff ? "staff" : "user", user.id, { reason: "invalid_password" }, ip, reqFingerprint);
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await resetRateLimit(env, combinedKey);
    await resetRateLimit(env, ipKey);
    await resetRateLimit(env, emailKey);

    // Create session
    const { token } = await createSession(env, user.id, user.role || (isStaff ? 'staff' : 'user'), reqFingerprint, ip);

    await logEvent(env, "LOGIN", "User " + user.id + " logged in", user.id);
    await logAudit(env, "LOGIN_SUCCESS", user.id, isStaff ? "staff" : "user", user.id, { method: "password", isStaff: isStaff }, ip, reqFingerprint);

    // ============================================================
    // FIXED: Build response with token at the top level
    // ============================================================
    const displayName = getDisplayName(user);
    const displayRole = user.role || (isStaff ? 'staff' : 'user');

    // Build user object
    const userData = {
      id: user.id,
      email: user.email || '',
      name: displayName,
      role: displayRole,
      isStaff: isStaff,
      status: user.status || 'active'
    };

    // Add branch info for staff
    if (isStaff) {
      const branchQuery = await env.DB.prepare(
        "SELECT branch_id, branch_name FROM staff WHERE id = ?"
      ).bind(user.id);
      const branchResult = await branchQuery.first();
      if (branchResult) {
        userData.branchId = branchResult.branch_id;
        userData.branchName = branchResult.branch_name;
      }
    }

    // Response with token at top level
    const responseData = {
      success: true,
      authenticated: true,
      token: token,
      sessionId: token,
      user: userData,
      role: displayRole,
      isStaff: isStaff,
      data: {
        token: token,
        user: userData
      }
    };

    const responseHeaders = new Headers({
      "Content-Type": "application/json", 
      ...corsHeaders
    });
    responseHeaders.append("Set-Cookie", "__Host-auth=" + token + "; HttpOnly; Secure; Path=/; Max-Age=86400; SameSite=None");
    responseHeaders.append("Set-Cookie", "auth=" + token + "; HttpOnly; Secure; Path=/; Max-Age=86400; SameSite=None");
    responseHeaders.append("Set-Cookie", "session=" + token + "; HttpOnly; Secure; Path=/; Max-Age=86400; SameSite=None");

    return new Response(JSON.stringify(responseData), {
      status: 200, 
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), {
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 4. STAFF REGISTRATION (Enhanced) - WITH SEQUENTIAL IDs
// ======================================================================

/**
 * Handle staff registration
 * POST /api/auth/register-staff
 * UPDATED: Now generates clean sequential display IDs like PSH-EMP-0001
 */
async function handleRegisterStaff(request, env, ctx, corsHeaders, ip, fingerprint) {
  try {
    const body = await request.json();
    const email = validateEmail(body.email);
    const password = validateString(body.password, 128);
    const name = validateString(body.name, 100);
    const phone = validateString(body.phone, 20);
    const branchId = body.branchId ? parseInt(body.branchId) : null;
    const employeeCode = body.employeeCode ? validateString(body.employeeCode, 50) : null;
    const adminCode = body.adminCode ? validateString(body.adminCode, 50) : null;
    const department = body.department ? validateString(body.department, 100) : null;
    const designation = body.designation ? validateString(body.designation, 100) : null;

    if (!email || !password || !name || !phone) {
      return new Response(JSON.stringify({ error: "Name, email, phone, and password are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check if email already exists
    const existingResult = await env.DB.prepare(
      "SELECT id, email FROM users WHERE email = ? UNION SELECT id, email FROM staff WHERE email = ?"
    ).bind(email, email).all();

    if (existingResult.results.length > 0) {
      return new Response(JSON.stringify({ error: "Email already registered" }), {
        status: 409, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Validate branch if provided
    let branchName = null;
    if (branchId) {
      const branchValid = await validateBranch(env, branchId);
      if (!branchValid) {
        return new Response(JSON.stringify({ error: "Invalid branch selected" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const branchDetails = await getBranchDetails(env, branchId);
      branchName = branchDetails?.name || null;
    }

    // Determine role and status
    let role = 'staff';
    let status = 'pending';

    // Check admin code
    if (adminCode && env.ADMIN_REGISTRATION_CODE) {
      const adminCodeResult = await env.DB.prepare(
        "SELECT id FROM admin_invitations WHERE code = ? AND status = 'pending' AND expires_at > datetime('now')"
      ).bind(adminCode).first();
      
      if (adminCodeResult) {
        role = 'admin';
        status = 'active';
        await env.DB.prepare("UPDATE admin_invitations SET status = 'used', used_by = ?, used_at = datetime('now') WHERE code = ?").bind(email, adminCode).run();
      }
    }

    // Check employee code (pre-approved)
    if (employeeCode && env.STAFF_PREAPPROVED_CODES) {
      const preapproved = env.STAFF_PREAPPROVED_CODES.split(',').map(c => c.trim());
      if (preapproved.includes(employeeCode)) { status = 'active'; }
      
      const inviteResult = await env.DB.prepare(
        "SELECT id FROM staff_invites WHERE code = ? AND status = 'pending' AND expires_at > datetime('now')"
      ).bind(employeeCode).first();
      
      if (inviteResult) {
        status = 'active';
        await env.DB.prepare("UPDATE staff_invites SET status = 'used', used_by = ?, used_at = datetime('now') WHERE code = ?").bind(email, employeeCode).run();
      }
    }

    // Hash password
    const hashResult = await hashPassword(password);
    const userId = nanoid();

    // Generate clean sequential Staff ID
    const displayId = await generateStaffDisplayId(env, role);
    console.log(`Generated staff ID: ${displayId} for role: ${role}`);

    // Create user
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, phone, password_hash, password_salt, role, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(userId, email, name, phone, hashResult.hash, hashResult.salt, role, status).run();

    // Create staff record WITH display_id
    await env.DB.prepare(
      `INSERT INTO staff (id, display_id, name, email, phone, role, branch_id, branch_name, status, department, designation, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(userId, displayId, name, email, phone, role, branchId, branchName, status, department, designation).run();

    // Create staff activity record
    await env.DB.prepare(
      `INSERT INTO staff_activity (id, staff_id, branch_id, action, details, created_at)
       VALUES (?, ?, ?, 'registered', ?, datetime('now'))`
    ).bind(nanoid(), userId, branchId, `Staff ${name} (${displayId}) registered`).run();

    // Send welcome email in background
    ctx.waitUntil(sendStaffWelcomeEmail(env, email, name, branchName || 'Main Branch', status));

    // Notify admin if pending approval
    if (status === 'pending') {
      ctx.waitUntil(sendAdminNotification(env, { type: 'staff_registration', staffName: name, staffEmail: email, staffId: displayId, branchName: branchName || 'Main Branch' }));
    }

    await logEvent(env, "STAFF_REGISTER", `Staff ${name} (${email}) registered as ${displayId} - ${status}`, userId);
    await logAudit(env, "STAFF_REGISTERED", userId, "staff", userId, { name, email, displayId, branchId, branchName, role, status }, ip, fingerprint);

    const message = status === 'active' 
      ? `Registration successful! Your Staff ID is ${displayId}. You can now log in.` 
      : `Registration submitted! Your Staff ID is ${displayId}. Your account is pending approval. You will be notified once approved.`;

    return new Response(JSON.stringify({ 
      success: true, 
      message, 
      userId, 
      staffId: displayId,
      role, 
      status, 
      branchName 
    }), {
      status: 201, headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Staff registration error:', error);
    return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 5. STANDARD USER REGISTRATION - WITH REFERRAL INTEGRATION 🔥
// ======================================================================

/**
 * Handle user registration
 * POST /api/auth/register
 * 🔥 UPDATED: Now processes referral codes
 */
async function handleRegister(request, env, ctx, corsHeaders, ip, fingerprint) {
  try {
    const body = await request.json();
    const email = validateEmail(body.email);
    const password = validateString(body.password, 128);
    const name = validateString(body.name, 100) || (email ? email.split('@')[0] : 'User');
    const phone = body.phone ? validatePhone(body.phone) : null;
    
    // 🔥 REFERRAL CODE EXTRACTION 🔥
    // Support multiple field names for referral code
    const referralCode = body.referral_code || body.referralCode || body.referral || body.ref || null;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check if email already exists
    const existingResult = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ?"
    ).bind(email).all();
    
    if (existingResult.results.length > 0) {
      return new Response(JSON.stringify({ error: "Email already registered" }), {
        status: 409, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Hash password
    const hashResult = await hashPassword(password);
    const userId = nanoid();

    // Create user
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, phone, password_hash, password_salt, role, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, 'user', 'active', datetime('now'))`
    ).bind(userId, email, name, phone || '', hashResult.hash, hashResult.salt).run();

    // ================================================================
    // 🔥 REFERRAL PROCESSING 🔥
    // ================================================================
    let referralResult = null;
    if (referralCode) {
      console.log(`[Register] Processing referral code: ${referralCode} for user ${userId}`);
      referralResult = await processReferral(env, userId, email, referralCode);
      
      if (referralResult) {
        console.log(`[Register] Referral processed successfully:`, referralResult);
      } else {
        console.log(`[Register] Referral processing failed or skipped for code: ${referralCode}`);
      }
    } else {
      console.log(`[Register] No referral code provided for user ${userId}`);
    }

    // Log registration
    await logEvent(env, "REGISTER", `User ${email} registered`, userId);
    await logAudit(env, "USER_REGISTERED", userId, "user", userId, { 
      email: email,
      name: name,
      referral_code: referralCode || null,
      referral_processed: !!referralResult
    }, ip, fingerprint);

    // Build response message
    let message = "Registration successful!";
    if (referralResult) {
      message = `Registration successful! You were referred and earned ₦${referralResult.reward/100} credit!`;
    } else if (referralCode) {
      message = "Registration successful! (Referral code not found or already used)";
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message,
      user: {
        id: userId,
        email: email,
        name: name,
        role: 'user'
      },
      referral: referralResult ? {
        processed: true,
        referrer_id: referralResult.referrer_id,
        reward: referralResult.reward
      } : null
    }), {
      status: 201, headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 6. GET CURRENT USER
// ======================================================================

async function handleMe(request, env, corsHeaders, requestInfo) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized", authenticated: false }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    let userResult = await env.DB.prepare(
      "SELECT id, email, name, role, phone, address, photo_url, created_at, status, referral_code, total_referrals, points FROM users WHERE id = ?"
    ).bind(user.id).all();
    
    let userData;
    let isStaff = false;
    
    if (userResult.results.length === 0) {
      const staffResult = await env.DB.prepare(
        "SELECT id, email, name, role, phone, branch_id, branch_name, display_id, status, created_at FROM staff WHERE id = ?"
      ).bind(user.id).all();
      
      if (staffResult.results.length === 0) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      userData = staffResult.results[0];
      isStaff = true;
    } else {
      userData = userResult.results[0];
    }
    
    const response = {
      id: userData.id,
      email: userData.email || '',
      name: userData.name || 'User',
      role: userData.role,
      phone: userData.phone || '',
      address: userData.address || '',
      photoURL: userData.photo_url || '',
      createdAt: userData.created_at,
      status: userData.status || 'active',
      isStaff: isStaff,
      referralCode: userData.referral_code || null,
      totalReferrals: userData.total_referrals || 0,
      points: userData.points || 0
    };
    
    if (isStaff) {
      response.staffId = userData.display_id;
      response.branchId = userData.branch_id;
      response.branchName = userData.branch_name;
    }
    
    return addSecurityHeaders(new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    }), requestInfo);
    
  } catch (error) {
    console.error('Get user error:', error);
    return new Response(JSON.stringify({ error: "Database error: " + error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 7. LOGOUT
// ======================================================================

async function handleLogout(request, env, corsHeaders, ip, fingerprint) {
  const cookies = parseCookies(request.headers.get("cookie") || "");
  const token = cookies["__Host-auth"] || cookies.auth;
  
  if (token) {
    const payload = await verifyJWT(token, env.GATEWAY_SECRET);
    if (payload && payload.jti) {
      await env.RATE_LIMITER.delete("session:" + payload.jti);
      await env.RATE_LIMITER.delete("user_session:" + payload.id);
      await env.RATE_LIMITER.delete("staff_branch:" + payload.id);
      await logEvent(env, "LOGOUT", "User " + payload.id + " logged out", payload.id);
      await logAudit(env, "LOGOUT", payload.id, "user", payload.id, {}, ip, fingerprint);
    }
  }
  
  const responseHeaders = new Headers({ "Content-Type": "application/json", ...corsHeaders });
  responseHeaders.append("Set-Cookie", "__Host-auth=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=None");
  responseHeaders.append("Set-Cookie", "auth=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=None");
  
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: responseHeaders });
}

// ======================================================================
// 8. AUTH CHECK
// ======================================================================

async function handleAuthCheck(request, env, corsHeaders) {
  let user = await requireAuth(request, env, null);
  
  if (!user) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const payload = await verifyJWT(token, env.GATEWAY_SECRET);
      if (payload && payload.jti) {
        const sessionExists = await env.RATE_LIMITER.get("session:" + payload.jti);
        if (sessionExists) user = payload;
      }
    }
  }
  
  if (!user) {
    return new Response(JSON.stringify({ authenticated: false, message: "Please log in again" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    let userResult = await env.DB.prepare(
      "SELECT id, email, name, role, phone, photo_url, created_at, status, referral_code, total_referrals, points FROM users WHERE id = ?"
    ).bind(user.id).all();
    
    let userData;
    let isStaff = false;
    
    if (userResult.results.length === 0) {
      const staffResult = await env.DB.prepare(
        "SELECT id, email, name, role, phone, branch_id, branch_name, display_id, status, created_at FROM staff WHERE id = ?"
      ).bind(user.id).all();
      
      if (staffResult.results.length > 0) {
        userData = staffResult.results[0];
        isStaff = true;
      } else {
        return new Response(JSON.stringify({ authenticated: true, user: { id: user.id, role: user.role, isStaff: false } }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    } else {
      userData = userResult.results[0];
    }
    
    const response = {
      authenticated: true,
      user: {
        id: userData.id,
        email: userData.email || '',
        name: userData.name || 'User',
        role: userData.role,
        phone: userData.phone || '',
        photoURL: userData.photo_url || '',
        createdAt: userData.created_at,
        status: userData.status || 'active',
        isStaff: isStaff,
        referralCode: userData.referral_code || null,
        totalReferrals: userData.total_referrals || 0,
        points: userData.points || 0
      }
    };
    
    if (isStaff) {
      response.user.staffId = userData.display_id;
      response.user.branchId = userData.branch_id;
      response.user.branchName = userData.branch_name;
    }
    
    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (e) {
    console.error("Auth check user fetch error:", e);
    return new Response(JSON.stringify({ authenticated: true, user: { id: user.id, role: user.role, isStaff: false } }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 9. CSRF TOKEN
// ======================================================================

async function handleCSRF(request, corsHeaders) {
  const csrfToken = nanoid();
  const responseHeaders = new Headers({ "Content-Type": "text/plain", ...corsHeaders });
  responseHeaders.append("Set-Cookie", "csrf_token=" + csrfToken + "; Path=/; SameSite=None; Secure; Max-Age=3600");
  return new Response(csrfToken, { headers: responseHeaders });
}

// ======================================================================
// 10. CHANGE PASSWORD
// ======================================================================

async function handleChangePassword(request, env, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const currentPassword = validateString(body.currentPassword, 128);
    const newPassword = validateString(body.newPassword, 128);

    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({ error: "Current and new password required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (newPassword.length < 8) {
      return new Response(JSON.stringify({ error: "New password must be at least 8 characters" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    let userResult = await env.DB.prepare("SELECT id, password_hash, password_salt FROM users WHERE id = ?").bind(user.id).all();
    let passwordHash, passwordSalt;

    if (userResult.results.length === 0) {
      const staffResult = await env.DB.prepare("SELECT id, password_hash, password_salt FROM staff WHERE id = ?").bind(user.id).all();
      if (staffResult.results.length === 0) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      passwordHash = staffResult.results[0].password_hash;
      passwordSalt = staffResult.results[0].password_salt;
    } else {
      passwordHash = userResult.results[0].password_hash;
      passwordSalt = userResult.results[0].password_salt;
    }

    const valid = await verifyPassword(currentPassword, passwordHash, passwordSalt);
    if (!valid) {
      await logAudit(env, "PASSWORD_CHANGE_FAILED", user.id, "user", user.id, { reason: "invalid_current_password" }, ip, fingerprint);
      return new Response(JSON.stringify({ error: "Current password is incorrect" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const hashResult = await hashPassword(newPassword);

    await env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?").bind(hashResult.hash, hashResult.salt, user.id).run();
    await env.DB.prepare("UPDATE staff SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?").bind(hashResult.hash, hashResult.salt, user.id).run();

    await logEvent(env, "PASSWORD_CHANGED", "User " + user.id + " changed password", user.id);
    await logAudit(env, "PASSWORD_CHANGED", user.id, "user", user.id, {}, ip, fingerprint);

    return new Response(JSON.stringify({ success: true, message: "Password updated successfully" }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// 11. TWO-FACTOR AUTHENTICATION (2FA)
// ======================================================================

/**
 * Enable Two-Factor Authentication
 * POST /api/auth/2fa/enable
 */
async function handleEnable2FA(request, env, corsHeaders, ip, fingerprint) {
  try {
    const user = await requireAuth(request, env, null);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const body = await request.json();
    const { secret, code } = body || {};

    if (!secret || !code) {
      return new Response(JSON.stringify({ error: "Secret and verification code are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: "Invalid verification code format" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    let userExists = await env.DB.prepare(
      "SELECT id FROM users WHERE id = ?"
    ).bind(user.id).first();

    if (userExists) {
      await env.DB.prepare(
        "UPDATE users SET two_factor_secret = ?, two_factor_enabled = 1, updated_at = datetime('now') WHERE id = ?"
      ).bind(secret, user.id).run();
    }

    let staffExists = await env.DB.prepare(
      "SELECT id FROM staff WHERE id = ?"
    ).bind(user.id).first();

    if (staffExists) {
      await env.DB.prepare(
        "UPDATE staff SET two_factor_secret = ?, two_factor_enabled = 1, updated_at = datetime('now') WHERE id = ?"
      ).bind(secret, user.id).run();
    }

    await logEvent(env, "2FA_ENABLED", `User ${user.id} enabled 2FA`, user.id);
    await logAudit(env, "2FA_ENABLED", user.id, "user", user.id, {
      method: "totp",
      timestamp: new Date().toISOString()
    }, ip, fingerprint);

    return new Response(JSON.stringify({
      success: true,
      enabled: true,
      message: "Two-factor authentication enabled successfully"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Enable 2FA error:', error);
    return new Response(JSON.stringify({ error: error.message || "Failed to enable 2FA" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * Disable Two-Factor Authentication
 * POST /api/auth/2fa/disable
 */
async function handleDisable2FA(request, env, corsHeaders, ip, fingerprint) {
  try {
    const user = await requireAuth(request, env, null);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    let userExists = await env.DB.prepare(
      "SELECT id FROM users WHERE id = ?"
    ).bind(user.id).first();

    if (userExists) {
      await env.DB.prepare(
        "UPDATE users SET two_factor_secret = NULL, two_factor_enabled = 0, updated_at = datetime('now') WHERE id = ?"
      ).bind(user.id).run();
    }

    let staffExists = await env.DB.prepare(
      "SELECT id FROM staff WHERE id = ?"
    ).bind(user.id).first();

    if (staffExists) {
      await env.DB.prepare(
        "UPDATE staff SET two_factor_secret = NULL, two_factor_enabled = 0, updated_at = datetime('now') WHERE id = ?"
      ).bind(user.id).run();
    }

    await logEvent(env, "2FA_DISABLED", `User ${user.id} disabled 2FA`, user.id);
    await logAudit(env, "2FA_DISABLED", user.id, "user", user.id, {
      timestamp: new Date().toISOString()
    }, ip, fingerprint);

    return new Response(JSON.stringify({
      success: true,
      enabled: false,
      message: "Two-factor authentication disabled successfully"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Disable 2FA error:', error);
    return new Response(JSON.stringify({ error: error.message || "Failed to disable 2FA" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * Verify 2FA Code (for login flow)
 * POST /api/auth/2fa/verify
 */
async function handleVerify2FA(request, env, corsHeaders, ip, fingerprint) {
  try {
    const body = await request.json();
    const { userId, code } = body || {};

    if (!userId || !code) {
      return new Response(JSON.stringify({ error: "User ID and verification code are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: "Invalid verification code format" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    let userResult = await env.DB.prepare(
      "SELECT id, two_factor_secret, two_factor_enabled FROM users WHERE id = ?"
    ).bind(userId).first();

    if (!userResult) {
      userResult = await env.DB.prepare(
        "SELECT id, two_factor_secret, two_factor_enabled FROM staff WHERE id = ?"
      ).bind(userId).first();
    }

    if (!userResult) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!userResult.two_factor_enabled) {
      return new Response(JSON.stringify({ error: "2FA is not enabled for this user" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await logAudit(env, "2FA_VERIFIED", userId, "user", userId, {
      method: "totp",
      timestamp: new Date().toISOString()
    }, ip, fingerprint);

    return new Response(JSON.stringify({
      success: true,
      verified: true,
      message: "2FA verification successful"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Verify 2FA error:', error);
    return new Response(JSON.stringify({ error: error.message || "Failed to verify 2FA" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 12. ADMIN REGISTRATION (INVITE-BASED)
// ======================================================================

async function handleAdminRegister(request, env, ctx, corsHeaders, ip, fingerprint) {
  try {
    const body = await request.json();
    const { email, password, name, phone, invitationCode } = body || {};

    if (!email || !password || !name || !invitationCode) {
      return new Response(JSON.stringify({ error: "All fields are required" }), {
        status: 400, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const invite = await env.DB.prepare(
      "SELECT * FROM admin_invitations WHERE code = ? AND status = 'pending' AND expires_at > datetime('now')"
    ).bind(invitationCode).first();

    if (!invite) {
      return new Response(JSON.stringify({ error: "Invalid or expired invitation code" }), {
        status: 400, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ? UNION SELECT id FROM staff WHERE email = ?"
    ).bind(email, email).first();

    if (existing) {
      return new Response(JSON.stringify({ error: "Email already registered" }), {
        status: 409, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const hashResult = await hashPassword(password);
    const userId = nanoid();

    await env.DB.prepare(
      `INSERT INTO users (id, email, name, phone, password_hash, password_salt, role, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active', datetime('now'))`
    ).bind(userId, email, name, phone || '', hashResult.hash, hashResult.salt).run();

    const displayId = await generateStaffDisplayId(env, 'admin');
    await env.DB.prepare(
      `INSERT INTO staff (id, display_id, name, email, phone, role, status, created_at) 
       VALUES (?, ?, ?, ?, ?, 'admin', 'active', datetime('now'))`
    ).bind(userId, displayId, name, email, phone || '').run();

    await env.DB.prepare(
      "UPDATE admin_invitations SET status = 'used', used_by = ?, used_at = datetime('now') WHERE code = ?"
    ).bind(email, invitationCode).run();

    await logEvent(env, "ADMIN_REGISTER", `Admin ${email} registered`, userId);
    await logAudit(env, "ADMIN_REGISTERED", userId, "admin", userId, { email, name }, ip, fingerprint);

    return new Response(JSON.stringify({
      success: true,
      message: "Admin registration successful! You can now log in.",
      userId,
      staffId: displayId
    }), {
      status: 201, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Admin registration error:', error);
    return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), {
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 13. ADMIN CHECK (Verify Admin Status)
// ======================================================================

async function handleAdminCheck(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ["admin"]);
  if (!user) {
    return new Response(JSON.stringify({ 
      authenticated: false, 
      isAdmin: false,
      message: "Not authenticated as admin" 
    }), {
      status: 401, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const adminCheck = await env.DB.prepare(
      "SELECT id, role FROM users WHERE id = ? AND role = 'admin'"
    ).bind(user.id).first();

    if (!adminCheck) {
      return new Response(JSON.stringify({ 
        authenticated: false, 
        isAdmin: false,
        message: "User is not an admin" 
      }), {
        status: 403, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const adminDetails = await env.DB.prepare(
      "SELECT id, email, name, phone, role, status, created_at, referral_code, total_referrals, points FROM users WHERE id = ?"
    ).bind(user.id).first();

    const staffDetails = await env.DB.prepare(
      "SELECT display_id FROM staff WHERE id = ?"
    ).bind(user.id).first();

    return new Response(JSON.stringify({
      authenticated: true,
      isAdmin: true,
      user: {
        ...adminDetails,
        staffId: staffDetails?.display_id || null
      }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Admin check error:', error);
    return new Response(JSON.stringify({ 
      authenticated: false, 
      isAdmin: false,
      error: error.message 
    }), {
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 14. LIST ADMINS
// ======================================================================

async function handleListAdmins(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ["admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const admins = await env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.phone, u.role, u.status, u.created_at, u.referral_code, u.total_referrals, u.points,
              s.display_id, s.branch_id, s.branch_name
       FROM users u
       LEFT JOIN staff s ON u.id = s.id
       WHERE u.role = 'admin' 
       ORDER BY u.created_at DESC`
    ).all();

    return new Response(JSON.stringify(admins.results || []), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('List admins error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 15. GENERATE ADMIN INVITATION (Admin Only)
// ======================================================================

async function handleGenerateAdminInvite(request, env, ctx, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, ["admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { email, name, expiresInDays } = body || {};

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ? UNION SELECT id FROM staff WHERE email = ?"
    ).bind(email, email).first();

    if (existing) {
      return new Response(JSON.stringify({ error: "User with this email already exists" }), {
        status: 409, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const existingInvite = await env.DB.prepare(
      "SELECT code FROM admin_invitations WHERE email = ? AND status = 'pending' AND expires_at > datetime('now')"
    ).bind(email).first();

    if (existingInvite) {
      return new Response(JSON.stringify({ 
        error: "An invitation already exists for this email",
        code: existingInvite.code 
      }), {
        status: 409, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const code = 'ADMIN-' + nanoid(8).toUpperCase();
    const expiresAt = new Date(Date.now() + (expiresInDays || 7) * 24 * 60 * 60 * 1000);

    await env.DB.prepare(
      `INSERT INTO admin_invitations (id, code, email, name, expires_at, status, created_by, created_at) 
       VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'))`
    ).bind(nanoid(), code, email, name || '', expiresAt.toISOString(), user.id).run();

    await logEvent(env, "ADMIN_INVITE_GENERATED", `Admin invite generated for ${email}`, user.id);
    await logAudit(env, "ADMIN_INVITE_GENERATED", user.id, "admin", user.id, { email, code }, ip, fingerprint);

    return new Response(JSON.stringify({
      success: true,
      code: code,
      email: email,
      expiresAt: expiresAt.toISOString(),
      message: "Admin invitation generated successfully"
    }), {
      status: 201, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Generate admin invite error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 16. LIST ADMIN INVITATIONS (Admin Only)
// ======================================================================

async function handleListAdminInvites(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ["admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const invites = await env.DB.prepare(
      `SELECT ai.*, u.name as created_by_name 
       FROM admin_invitations ai
       LEFT JOIN users u ON ai.created_by = u.id
       ORDER BY ai.created_at DESC`
    ).all();

    return new Response(JSON.stringify(invites.results || []), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('List admin invites error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 17. REVOKE ADMIN INVITATION (Admin Only)
// ======================================================================

async function handleRevokeAdminInvite(request, env, ctx, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, ["admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { code } = body || {};

    if (!code) {
      return new Response(JSON.stringify({ error: "Invitation code is required" }), {
        status: 400, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const invite = await env.DB.prepare(
      "SELECT email FROM admin_invitations WHERE code = ? AND status = 'pending'"
    ).bind(code).first();

    if (!invite) {
      return new Response(JSON.stringify({ error: "Invitation not found or already used" }), {
        status: 404, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await env.DB.prepare(
      "UPDATE admin_invitations SET status = 'revoked', revoked_at = datetime('now'), revoked_by = ? WHERE code = ?"
    ).bind(user.id, code).run();

    await logEvent(env, "ADMIN_INVITE_REVOKED", `Admin invite revoked for ${invite.email}`, user.id);
    await logAudit(env, "ADMIN_INVITE_REVOKED", user.id, "admin", user.id, { email: invite.email, code }, ip, fingerprint);

    return new Response(JSON.stringify({
      success: true,
      message: "Invitation revoked successfully"
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Revoke admin invite error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// EXPORTS - COMPLETE WITH ALL ADMIN FUNCTIONS + REFERRAL SUPPORT
// ======================================================================

export {
  // Core Auth
  handleRequestOTP,
  handleVerifyOTP,
  handleLogin,
  handleRegister,
  handleRegisterStaff,
  handleMe,
  handleLogout,
  handleAuthCheck,
  handleCSRF,
  handleChangePassword,
  
  // 2FA
  handleEnable2FA,
  handleDisable2FA,
  handleVerify2FA,
  
  // Admin Management
  handleAdminRegister,
  handleAdminCheck,
  handleListAdmins,
  handleGenerateAdminInvite,
  handleListAdminInvites,
  handleRevokeAdminInvite
};



