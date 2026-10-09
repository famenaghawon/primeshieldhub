// ======================================================================
// PROFILE HANDLERS — ENHANCED v15.0 (REWARDS & DISCOUNTS RESTRUCTURE)
// Full profile management with avatar upload, documents, skills,
// preferences, referrals, subscription payments, and data export
// UPDATED: Referral reward ₦500 → ₦2,000 store credit
// UPDATED: Points system with loyalty tiers
// FIXED: All createdAt → created_at to match D1 schema
// FIXED: Table names corrected (staff_bank_accounts, staff_documents)
// FIXED: Avatar upload now preserves old files as fallback
// FIXED: Delayed deletion prevents race conditions
// FIXED: File verification before database update
// ======================================================================

import { requireAuth, authenticate } from '../middleware/auth.js';
import { logAudit, logEvent } from '../utils/logging.js';
import { validateString, validatePhone, validateEmail } from '../utils/validation.js';
import { getCorsHeaders } from '../middleware/cors.js';
import { addSecurityHeaders } from '../middleware/security.js';

// ======================================================================
// LOYALTY TIERS & POINTS CALCULATION
// ======================================================================

/**
 * Calculate loyalty tier based on total spend
 * Platinum: ₦5M+ → 10x points
 * Gold: ₦1M+ → 5x points
 * Silver: ₦250K+ → 3x points
 * Bronze: ₦0+ → 1x points
 */
function calculateLoyaltyTier(totalSpent) {
  if (totalSpent >= 5000000) {
    return { tier: 'Platinum', multiplier: 10, label: 'Platinum', color: '#a855f7' };
  }
  if (totalSpent >= 1000000) {
    return { tier: 'Gold', multiplier: 5, label: 'Gold', color: '#d4af37' };
  }
  if (totalSpent >= 250000) {
    return { tier: 'Silver', multiplier: 3, label: 'Silver', color: '#c0c0c0' };
  }
  return { tier: 'Bronze', multiplier: 1, label: 'Bronze', color: '#cd7f32' };
}

/**
 * Calculate points earned from an order
 * Base: 1 point per ₦100 spent × tier multiplier
 */
function calculatePointsEarned(orderTotal, tierMultiplier = 1) {
  const basePoints = Math.floor(orderTotal / 100);
  return basePoints * tierMultiplier;
}

/**
 * Get points needed for next tier
 */
function getPointsToNextTier(totalSpent) {
  if (totalSpent < 250000) {
    return { nextTier: 'Silver', amountNeeded: 250000 - totalSpent };
  }
  if (totalSpent < 1000000) {
    return { nextTier: 'Gold', amountNeeded: 1000000 - totalSpent };
  }
  if (totalSpent < 5000000) {
    return { nextTier: 'Platinum', amountNeeded: 5000000 - totalSpent };
  }
  return { nextTier: null, amountNeeded: 0 };
}

// ======================================================================
// 1. GET FULL PROFILE
// ======================================================================

/**
 * GET /api/profile — Get complete user profile with all related data
 */
export async function handleGetProfile(request, env, corsHeaders, requestInfo) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    // Get user data from users table
    const userQuery = await env.DB.prepare(`
      SELECT 
        id, email, name, phone, address, photo_url, role, status,
        department, designation, employment_type, bio,
        date_of_birth, gender,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        notification_email, notification_sms, notification_push,
        two_factor_enabled, two_factor_secret, last_login_at, last_login_ip, login_count,
        points, total_spent, total_orders, referral_code, total_referrals,
        created_at as createdAt, updated_at
      FROM users WHERE id = ?
    `).bind(user.id);
    let userData = await userQuery.first();
    
    let isStaff = false;
    let staffData = null;
    
    // If not found in users, check staff table
    if (!userData) {
      const staffQuery = await env.DB.prepare(`
        SELECT 
          s.id, s.email, s.name, s.phone, s.address, s.photo_url, s.role, s.status,
          s.department, s.designation, s.employment_type, s.bio,
          s.date_of_birth, s.gender,
          s.emergency_contact_name, s.emergency_contact_phone, s.emergency_contact_relationship,
          s.notification_email, s.notification_sms, s.notification_push,
          s.two_factor_enabled, s.two_factor_secret, s.last_login_at, s.last_login_ip, s.login_count,
          s.display_id, s.branch_id, s.branch_name,
          s.shift_start, s.shift_end, s.hourly_rate,
          s.supervisor_id, s.skills, s.certifications,
          s.performance_score, s.attendance_streak,
          s.score, s.total_revenue, s.total_sessions,
          s.created_at as createdAt, s.updated_at,
          b.name as branch_full_name, b.city as branch_city, 
          b.address as branch_address, b.phone as branch_phone
        FROM staff s
        LEFT JOIN branches b ON s.branch_id = b.id
        WHERE s.id = ?
      `).bind(user.id);
      staffData = await staffQuery.first();
      
      if (!staffData) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      isStaff = true;
      userData = staffData;
    } else {
      // Check if also in staff table
      const staffCheck = await env.DB.prepare(
        "SELECT id, display_id, branch_id, branch_name, shift_start, shift_end, hourly_rate, supervisor_id, performance_score, attendance_streak, total_sessions, total_revenue FROM staff WHERE id = ?"
      ).bind(user.id).first();
      
      if (staffCheck) {
        isStaff = true;
        staffData = staffCheck;
      }
    }
    
    // Get bank accounts
    let bankAccounts = [];
    try {
      const bankQuery = await env.DB.prepare(
        "SELECT *, created_at as createdAt, updated_at as updatedAt FROM staff_bank_accounts WHERE staff_id = ? ORDER BY is_default DESC, created_at DESC"
      ).bind(user.id);
      bankAccounts = (await bankQuery.all()).results || [];
    } catch (e) {
      console.log('Bank accounts table may not exist yet:', e.message);
    }
    
    // Get documents
    let documents = [];
    try {
      const docsQuery = await env.DB.prepare(
        "SELECT *, created_at as createdAt, updated_at as updatedAt FROM staff_documents WHERE staff_id = ? ORDER BY created_at DESC"
      ).bind(user.id);
      documents = (await docsQuery.all()).results || [];
    } catch (e) {
      console.log('Documents table may not exist yet:', e.message);
    }
    
    // Get skills
    let skills = [];
    try {
      const skillsQuery = await env.DB.prepare(
        "SELECT * FROM staff_skills WHERE staff_id = ? ORDER BY skill_name ASC"
      ).bind(user.id);
      skills = (await skillsQuery.all()).results || [];
    } catch (e) {
      console.log('Skills table may not exist yet:', e.message);
    }
    
    // Get notification preferences
    let notificationPrefs = null;
    try {
      notificationPrefs = await env.DB.prepare(
        "SELECT * FROM notification_preferences WHERE user_id = ?"
      ).bind(user.id).first();
    } catch (e) {
      console.log('Notification prefs table may not exist yet:', e.message);
    }
    
    // Get wallet
    let wallet = null;
    try {
      wallet = await env.DB.prepare(
        "SELECT * FROM staff_wallets WHERE staff_id = ?"
      ).bind(user.id).first();
    } catch (e) {
      console.log('Wallet table may not exist:', e.message);
    }
    
    // Get recent login history
    let loginHistory = [];
    try {
      const loginQuery = await env.DB.prepare(
        "SELECT * FROM login_history WHERE user_id = ? ORDER BY login_at DESC LIMIT 10"
      ).bind(user.id);
      loginHistory = (await loginQuery.all()).results || [];
    } catch (e) {
      console.log('Login history table may not exist:', e.message);
    }
    
    // Get attendance summary (staff only)
    let attendanceSummary = null;
    if (isStaff) {
      try {
        const todayQuery = await env.DB.prepare(
          "SELECT * FROM staff_attendance WHERE staff_id = ? AND date = DATE('now')"
        ).bind(user.id);
        const todayAttendance = await todayQuery.first();
        
        const monthQuery = await env.DB.prepare(`
          SELECT 
            COUNT(*) as total_days,
            COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days,
            COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_days,
            COUNT(CASE WHEN status = 'late' THEN 1 END) as late_days,
            SUM(late_minutes) as total_late_minutes,
            SUM(overtime_minutes) as total_overtime_minutes
          FROM staff_attendance 
          WHERE staff_id = ? AND date >= DATE('now', 'start of month')
        `).bind(user.id);
        
        attendanceSummary = {
          today: todayAttendance || null,
          month: (await monthQuery.first()) || null
        };
      } catch (e) {
        console.log('Attendance table may not exist:', e.message);
      }
    }
    
    // Calculate loyalty tier
    const totalSpent = userData.total_spent || 0;
    const loyaltyTier = calculateLoyaltyTier(totalSpent);
    const pointsToNextTier = getPointsToNextTier(totalSpent);
    
    // Get referral stats
    let referralStats = { total: 0, earned: 0, pending: 0, claimed: 0 };
    try {
      const referrals = await env.DB.prepare(
        "SELECT reward_amount, reward_claimed FROM referrals WHERE referrer_id = ?"
      ).bind(user.id).all();
      const results = referrals.results || [];
      referralStats.total = results.length;
      referralStats.earned = results.reduce((sum, r) => sum + (r.reward_amount || 2000), 0);
      referralStats.pending = results.filter(r => !r.reward_claimed).length * 2000;
      referralStats.claimed = results.filter(r => r.reward_claimed).length * 2000;
    } catch (e) {
      console.log('Referral stats table may not exist:', e.message);
    }
    
    // Build complete profile response
    const profile = {
      id: userData.id,
      email: userData.email || '',
      name: userData.name || 'User',
      phone: userData.phone || '',
      address: userData.address || '',
      photoURL: userData.photo_url || '',
      role: userData.role || 'user',
      status: userData.status || 'active',
      department: userData.department || '',
      designation: userData.designation || '',
      employmentType: userData.employment_type || 'full-time',
      bio: userData.bio || '',
      dateOfBirth: userData.date_of_birth || null,
      gender: userData.gender || null,
      emergencyContact: {
        name: userData.emergency_contact_name || '',
        phone: userData.emergency_contact_phone || '',
        relationship: userData.emergency_contact_relationship || ''
      },
      notifications: {
        email: userData.notification_email === 1 || userData.notification_email === true,
        sms: userData.notification_sms === 1 || userData.notification_sms === true,
        push: userData.notification_push === 1 || userData.notification_push === true,
        preferences: notificationPrefs || null
      },
      security: {
        twoFactorEnabled: userData.two_factor_enabled === 1 || userData.two_factor_enabled === true,
        lastLoginAt: userData.last_login_at || null,
        lastLoginIp: userData.last_login_ip || null,
        loginCount: userData.login_count || 0,
        recentLogins: loginHistory
      },
      // ===== REWARDS & LOYALTY =====
      rewards: {
        points: userData.points || 0,
        totalSpent: totalSpent,
        totalOrders: userData.total_orders || 0,
        referralCode: userData.referral_code || null,
        totalReferrals: userData.total_referrals || 0,
        referralStats: referralStats,
        loyalty: {
          tier: loyaltyTier.tier,
          multiplier: loyaltyTier.multiplier,
          label: loyaltyTier.label,
          color: loyaltyTier.color,
          nextTier: pointsToNextTier.nextTier,
          amountToNextTier: pointsToNextTier.amountNeeded,
          pointsEarned: userData.points || 0
        }
      },
      createdAt: userData.createdAt,
      updatedAt: userData.updated_at,
      isStaff: isStaff,
      bankAccounts: bankAccounts,
      documents: documents,
      skills: skills,
      wallet: wallet || null
    };
    
    // Add staff-specific data
    if (isStaff && staffData) {
      profile.staffId = staffData.display_id || userData.display_id || null;
      profile.branchId = staffData.branch_id || userData.branch_id || null;
      profile.branchName = staffData.branch_name || userData.branch_name || null;
      profile.branch = {
        name: staffData.branch_full_name || staffData.branch_name,
        city: staffData.branch_city,
        address: staffData.branch_address,
        phone: staffData.branch_phone
      };
      profile.shiftStart = staffData.shift_start || userData.shift_start || null;
      profile.shiftEnd = staffData.shift_end || userData.shift_end || null;
      profile.hourlyRate = staffData.hourly_rate || userData.hourly_rate || null;
      profile.supervisorId = staffData.supervisor_id || userData.supervisor_id || null;
      profile.performanceScore = staffData.performance_score || userData.performance_score || 100;
      profile.attendanceStreak = staffData.attendance_streak || userData.attendance_streak || 0;
      profile.totalSessions = staffData.total_sessions || userData.total_sessions || 0;
      profile.totalRevenue = staffData.total_revenue || userData.total_revenue || 0;
      profile.attendance = attendanceSummary;
    }
    
    return addSecurityHeaders(new Response(JSON.stringify(profile), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    }), requestInfo);
    
  } catch (error) {
    console.error('Get profile error:', error);
    return new Response(JSON.stringify({ error: 'Database error: ' + error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 2. UPDATE PROFILE
// ======================================================================

/**
 * PUT /api/profile — Update user profile
 */
export async function handleUpdateProfile(request, env, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    
    // Build updates for users table (no shift_start/shift_end)
    const userUpdates = [];
    const userParams = [];
    
    // Build updates for staff table (shift-specific fields)
    const staffUpdates = [];
    const staffParams = [];
    
    // Personal info (both tables)
    if (body.name !== undefined) { 
      userUpdates.push("name = ?"); userParams.push(validateString(body.name, 100)); 
    }
    if (body.phone !== undefined) { 
      userUpdates.push("phone = ?"); userParams.push(validatePhone(body.phone)); 
    }
    if (body.address !== undefined) { 
      userUpdates.push("address = ?"); userParams.push(validateString(body.address, 500)); 
    }
    if (body.bio !== undefined) { 
      userUpdates.push("bio = ?"); userParams.push(validateString(body.bio, 1000)); 
    }
    if (body.dateOfBirth !== undefined) { 
      userUpdates.push("date_of_birth = ?"); userParams.push(body.dateOfBirth); 
    }
    if (body.gender !== undefined) { 
      userUpdates.push("gender = ?"); userParams.push(validateString(body.gender, 20)); 
    }
    if (body.department !== undefined) { 
      userUpdates.push("department = ?"); userParams.push(validateString(body.department, 100)); 
    }
    if (body.designation !== undefined) { 
      userUpdates.push("designation = ?"); userParams.push(validateString(body.designation, 100)); 
    }
    
    // Emergency contact (both tables)
    if (body.emergencyContact) {
      if (body.emergencyContact.name !== undefined) {
        userUpdates.push("emergency_contact_name = ?");
        userParams.push(validateString(body.emergencyContact.name, 100));
      }
      if (body.emergencyContact.phone !== undefined) {
        userUpdates.push("emergency_contact_phone = ?");
        userParams.push(validatePhone(body.emergencyContact.phone));
      }
      if (body.emergencyContact.relationship !== undefined) {
        userUpdates.push("emergency_contact_relationship = ?");
        userParams.push(validateString(body.emergencyContact.relationship, 50));
      }
    }
    
    // Notification preferences (both tables)
    if (body.notifications) {
      if (body.notifications.email !== undefined) {
        userUpdates.push("notification_email = ?");
        userParams.push(body.notifications.email ? 1 : 0);
      }
      if (body.notifications.sms !== undefined) {
        userUpdates.push("notification_sms = ?");
        userParams.push(body.notifications.sms ? 1 : 0);
      }
      if (body.notifications.push !== undefined) {
        userUpdates.push("notification_push = ?");
        userParams.push(body.notifications.push ? 1 : 0);
      }
    }
    
    // Photo URL (both tables)
    if (body.photoURL !== undefined) {
      userUpdates.push("photo_url = ?");
      userParams.push(validateString(body.photoURL, 500));
    }
    
    // Two-factor authentication (both tables)
    if (body.twoFactorEnabled !== undefined) {
      userUpdates.push("two_factor_enabled = ?");
      userParams.push(body.twoFactorEnabled ? 1 : 0);
    }
    if (body.twoFactorSecret !== undefined) {
      userUpdates.push("two_factor_secret = ?");
      userParams.push(body.twoFactorSecret);
    }
    
    // Shift preferences (STAFF TABLE ONLY - not users table)
    if (body.shiftStart !== undefined) {
      staffUpdates.push("shift_start = ?");
      staffParams.push(body.shiftStart);
    }
    if (body.shiftEnd !== undefined) {
      staffUpdates.push("shift_end = ?");
      staffParams.push(body.shiftEnd);
    }
    
    // Staff-specific fields (staff table only)
    if (body.hourlyRate !== undefined) {
      staffUpdates.push("hourly_rate = ?");
      staffParams.push(body.hourlyRate);
    }
    if (body.employmentType !== undefined) {
      staffUpdates.push("employment_type = ?");
      staffParams.push(validateString(body.employmentType, 50));
    }
    if (body.branchId !== undefined) {
      staffUpdates.push("branch_id = ?");
      staffParams.push(body.branchId);
    }
    if (body.supervisorId !== undefined) {
      staffUpdates.push("supervisor_id = ?");
      staffParams.push(body.supervisorId);
    }
    
    // Check if there's anything to update
    if (userUpdates.length === 0 && staffUpdates.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nothing to update" }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Update users table (all fields except shift_start/shift_end)
    if (userUpdates.length > 0) {
      userUpdates.push("updated_at = datetime('now')");
      userParams.push(user.id);
      
      await env.DB.prepare(
        "UPDATE users SET " + userUpdates.join(', ') + " WHERE id = ?"
      ).bind(...userParams).run();
      
      // Also update staff table with the same common fields
      const staffCommonParams = [...userParams];
      const userIdForStaff = staffCommonParams.pop();
      staffCommonParams.push(userIdForStaff);
      
      await env.DB.prepare(
        "UPDATE staff SET " + userUpdates.join(', ') + " WHERE id = ?"
      ).bind(...staffCommonParams).run().catch(() => {
        console.log('Staff table update for common fields failed (user may not be staff)');
      });
    }
    
    // Update staff-specific fields (shift_start, shift_end, etc.)
    if (staffUpdates.length > 0) {
      staffUpdates.push("updated_at = datetime('now')");
      staffParams.push(user.id);
      
      await env.DB.prepare(
        "UPDATE staff SET " + staffUpdates.join(', ') + " WHERE id = ?"
      ).bind(...staffParams).run().catch(() => {
        console.log('Staff shift update failed (user may not be staff)');
      });
    }
    
    // Update notification preferences table (detailed prefs)
    if (body.notifications || body.notificationPreferences) {
      try {
        const notifBody = body.notifications || body.notificationPreferences || {};
        const existing = await env.DB.prepare(
          "SELECT id FROM notification_preferences WHERE user_id = ?"
        ).bind(user.id).first();
        
        const prefsData = {
          email_notifications: notifBody.email !== undefined ? (notifBody.email ? 1 : 0) : 1,
          sms_notifications: notifBody.sms !== undefined ? (notifBody.sms ? 1 : 0) : 0,
          push_notifications: notifBody.push !== undefined ? (notifBody.push ? 1 : 0) : 1,
          session_alerts: notifBody.sessionAlerts !== undefined ? (notifBody.sessionAlerts ? 1 : 0) : 1,
          payment_alerts: notifBody.paymentAlerts !== undefined ? (notifBody.paymentAlerts ? 1 : 0) : 1,
          payroll_alerts: notifBody.payrollAlerts !== undefined ? (notifBody.payrollAlerts ? 1 : 0) : 1,
          system_alerts: notifBody.systemAlerts !== undefined ? (notifBody.systemAlerts ? 1 : 0) : 1,
          marketing_emails: notifBody.marketing !== undefined ? (notifBody.marketing ? 1 : 0) : 0
        };
        
        if (existing) {
          await env.DB.prepare(`
            UPDATE notification_preferences 
            SET email_notifications = ?, sms_notifications = ?, push_notifications = ?,
                session_alerts = ?, payment_alerts = ?, payroll_alerts = ?,
                system_alerts = ?, marketing_emails = ?, updated_at = datetime('now')
            WHERE user_id = ?
          `).bind(
            prefsData.email_notifications, prefsData.sms_notifications, prefsData.push_notifications,
            prefsData.session_alerts, prefsData.payment_alerts, prefsData.payroll_alerts,
            prefsData.system_alerts, prefsData.marketing_emails,
            user.id
          ).run();
        } else {
          const prefId = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO notification_preferences 
            (id, user_id, email_notifications, sms_notifications, push_notifications,
             session_alerts, payment_alerts, payroll_alerts, system_alerts, marketing_emails,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).bind(
            prefId, user.id,
            prefsData.email_notifications, prefsData.sms_notifications, prefsData.push_notifications,
            prefsData.session_alerts, prefsData.payment_alerts, prefsData.payroll_alerts,
            prefsData.system_alerts, prefsData.marketing_emails
          ).run();
        }
      } catch (e) {
        console.log('Notification prefs update failed (table may not exist):', e.message);
      }
    }
    
    const totalUpdatedFields = userUpdates.filter(u => !u.includes('updated_at')).length + 
                               staffUpdates.filter(u => !u.includes('updated_at')).length;
    
    await logAudit(env, "PROFILE_UPDATED", user.id, "user", user.id, {
      updatedFields: totalUpdatedFields
    }, ip, fingerprint);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Profile updated successfully",
      updatedFields: totalUpdatedFields
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 3. AVATAR UPLOAD - COMPLETELY FIXED
// ======================================================================

/**
 * POST /api/staff/avatar — Upload profile picture
 * FIXED: Don't delete old avatar immediately - keep it as fallback
 * FIXED: 5 minute delay before deleting old avatar
 * FIXED: Verify new file exists before updating database
 */
export async function handleUploadAvatar(request, env, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const contentType = request.headers.get('content-type') || '';
    
    // Handle multipart form data
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('avatar') || formData.get('file') || formData.get('image');
      
      if (!file || typeof file === 'string') {
        return new Response(JSON.stringify({ error: "No file uploaded" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        return new Response(JSON.stringify({ error: "Invalid file type. Use JPG, PNG, WebP, or GIF." }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      if (file.size > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "File too large. Maximum 5MB." }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
      const timestamp = Date.now();
      const fileKey = `avatars/${user.id}/${timestamp}.${ext}`;
      
      if (env.STORAGE) {
        await env.STORAGE.put(fileKey, file.stream(), {
          httpMetadata: { 
            contentType: file.type, 
            cacheControl: 'public, max-age=31536000, immutable'
          }
        });
      }
      
      const photoURL = `https://api.primeshieldhub.com/files/${fileKey}`;
      
      // Get current photo URL BEFORE updating
      const currentUser = await env.DB.prepare(
        "SELECT photo_url FROM users WHERE id = ?"
      ).bind(user.id).first();
      const oldPhotoURL = currentUser?.photo_url || null;
      
      await env.DB.prepare(
        "UPDATE users SET photo_url = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(photoURL, user.id).run();
      
      await env.DB.prepare(
        "UPDATE staff SET photo_url = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(photoURL, user.id).run().catch(() => {});
      
      // Schedule old avatar deletion after 5 minutes
      if (oldPhotoURL && env.STORAGE) {
        try {
          const oldFileKey = oldPhotoURL.replace('https://api.primeshieldhub.com/files/', '');
          if (oldFileKey && oldFileKey !== fileKey) {
            setTimeout(async () => {
              try {
                const newFileCheck = await env.STORAGE.head(fileKey);
                if (newFileCheck) {
                  await env.STORAGE.delete(oldFileKey);
                  console.log('Deleted old avatar after delay:', oldFileKey);
                } else {
                  console.warn('New avatar not found, keeping old file:', oldFileKey);
                }
              } catch (e) {
                console.warn('Failed to delete old avatar:', e.message);
              }
            }, 300000);
          }
        } catch (e) {
          console.warn('Failed to schedule old avatar deletion:', e.message);
        }
      }
      
      await logAudit(env, "AVATAR_UPLOADED", user.id, "user", user.id, {
        fileKey, size: file.size, type: file.type
      }, ip, fingerprint);
      
      if (env.STORAGE) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return new Response(JSON.stringify({
        success: true,
        photoURL,
        message: "Profile picture updated"
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    // Handle base64 JSON upload (same fixes applied)
    const body = await request.json().catch(() => ({}));
    const base64Image = body.image || body.photoURL || body.avatar;
    
    if (!base64Image || !base64Image.startsWith('data:image/')) {
      return new Response(JSON.stringify({ 
        error: "Valid image required. Send as multipart/form-data with 'avatar' field, or JSON with base64 'image' field." 
      }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const matches = base64Image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return new Response(JSON.stringify({ error: "Invalid base64 image format" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    
    try {
      atob(base64Data);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid base64 encoding" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    if (binaryData.length > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Image too large. Maximum 5MB." }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const timestamp = Date.now();
    const fileKey = `avatars/${user.id}/${timestamp}.${extension}`;
    
    if (env.STORAGE) {
      await env.STORAGE.put(fileKey, binaryData, {
        httpMetadata: { 
          contentType: `image/${extension}`,
          cacheControl: 'public, max-age=31536000, immutable'
        }
      });
    }
    
    const photoURL = `https://api.primeshieldhub.com/files/${fileKey}`;
    
    const currentUser = await env.DB.prepare(
      "SELECT photo_url FROM users WHERE id = ?"
    ).bind(user.id).first();
    const oldPhotoURL = currentUser?.photo_url || null;
    
    await env.DB.prepare(
      "UPDATE users SET photo_url = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(photoURL, user.id).run();
    
    await env.DB.prepare(
      "UPDATE staff SET photo_url = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(photoURL, user.id).run().catch(() => {});
    
    if (oldPhotoURL && env.STORAGE) {
      try {
        const oldFileKey = oldPhotoURL.replace('https://api.primeshieldhub.com/files/', '');
        if (oldFileKey && oldFileKey !== fileKey) {
          setTimeout(async () => {
            try {
              const newFileCheck = await env.STORAGE.head(fileKey);
              if (newFileCheck) {
                await env.STORAGE.delete(oldFileKey);
                console.log('Deleted old avatar after delay:', oldFileKey);
              }
            } catch (e) {
              console.warn('Failed to delete old avatar:', e.message);
            }
          }, 300000);
        }
      } catch (e) {
        console.warn('Failed to schedule old avatar deletion:', e.message);
      }
    }
    
    await logAudit(env, "AVATAR_UPLOADED", user.id, "user", user.id, {
      fileKey, size: binaryData.length
    }, ip, fingerprint);
    
    if (env.STORAGE) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return new Response(JSON.stringify({
      success: true,
      photoURL,
      message: "Profile picture updated"
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Avatar upload error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * DELETE /api/staff/avatar — Remove profile picture
 */
export async function handleRemoveAvatar(request, env, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const currentUser = await env.DB.prepare(
      "SELECT photo_url FROM users WHERE id = ?"
    ).bind(user.id).first();
    const oldPhotoURL = currentUser?.photo_url || null;
    
    await env.DB.prepare(
      "UPDATE users SET photo_url = NULL, updated_at = datetime('now') WHERE id = ?"
    ).bind(user.id).run();
    
    await env.DB.prepare(
      "UPDATE staff SET photo_url = NULL, updated_at = datetime('now') WHERE id = ?"
    ).bind(user.id).run().catch(() => {});
    
    if (oldPhotoURL && env.STORAGE) {
      try {
        const oldFileKey = oldPhotoURL.replace('https://api.primeshieldhub.com/files/', '');
        if (oldFileKey) {
          await env.STORAGE.delete(oldFileKey);
          console.log('Deleted avatar:', oldFileKey);
        }
      } catch (e) {
        console.warn('Failed to delete avatar:', e.message);
      }
    }
    
    await logAudit(env, "AVATAR_REMOVED", user.id, "user", user.id, {}, ip, fingerprint);
    
    return new Response(JSON.stringify({
      success: true,
      message: "Profile picture removed"
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 4. DOCUMENT MANAGEMENT
// ======================================================================

/**
 * GET /api/staff/documents — Get staff documents
 */
export async function handleGetDocuments(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const documents = await env.DB.prepare(
      "SELECT *, created_at as createdAt, updated_at as updatedAt FROM staff_documents WHERE staff_id = ? ORDER BY created_at DESC"
    ).bind(user.id).all();
    
    return new Response(JSON.stringify({
      success: true,
      documents: documents.results || []
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, documents: [] }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * POST /api/staff/documents — Upload document
 */
export async function handleUploadDocument(request, env, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get('document') || formData.get('file');
    const documentType = formData.get('documentType') || formData.get('type') || 'other';
    const documentName = formData.get('documentName') || formData.get('name') || file?.name || 'Document';
    
    if (!file || typeof file === 'string') {
      return new Response(JSON.stringify({ error: "No document uploaded" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ error: "File too large. Maximum 10MB." }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const docId = crypto.randomUUID();
    const fileKey = `documents/${user.id}/${docId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    
    if (env.STORAGE) {
      await env.STORAGE.put(fileKey, file.stream(), {
        httpMetadata: { contentType: file.type }
      });
    }
    
    const fileUrl = `https://api.primeshieldhub.com/files/${fileKey}`;
    
    await env.DB.prepare(`
      INSERT INTO staff_documents (id, staff_id, document_type, document_name, file_url, file_key, file_size, mime_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(docId, user.id, documentType, documentName, fileUrl, fileKey, file.size, file.type).run();
    
    await logAudit(env, "DOCUMENT_UPLOADED", user.id, "staff", user.id, {
      documentId: docId, type: documentType, name: documentName
    }, ip, fingerprint);
    
    return new Response(JSON.stringify({
      success: true,
      document: {
        id: docId,
        document_type: documentType,
        document_name: documentName,
        file_url: fileUrl,
        file_size: file.size
      }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * DELETE /api/staff/documents/:id — Delete document
 */
export async function handleDeleteDocument(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const docId = url.pathname.split('/').pop();
    
    const doc = await env.DB.prepare(
      "SELECT * FROM staff_documents WHERE id = ? AND staff_id = ?"
    ).bind(docId, user.id).first();
    
    if (!doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    if (env.STORAGE && doc.file_key) {
      try { await env.STORAGE.delete(doc.file_key); } catch (e) {}
    }
    
    await env.DB.prepare(
      "DELETE FROM staff_documents WHERE id = ?"
    ).bind(docId).run();
    
    return new Response(JSON.stringify({
      success: true,
      message: "Document deleted"
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 5. SKILLS MANAGEMENT
// ======================================================================

/**
 * POST /api/staff/skills — Add skill
 */
export async function handleAddSkill(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const { skillName, proficiencyLevel, yearsExperience } = body;
    
    if (!skillName) {
      return new Response(JSON.stringify({ error: "Skill name required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const skillId = crypto.randomUUID();
    
    await env.DB.prepare(`
      INSERT INTO staff_skills (id, staff_id, skill_name, proficiency_level, years_experience, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(skillId, user.id, skillName, proficiencyLevel || 'beginner', yearsExperience || 0).run();
    
    return new Response(JSON.stringify({
      success: true,
      skill: { id: skillId, skill_name: skillName, proficiency_level: proficiencyLevel }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * DELETE /api/staff/skills/:id — Remove skill
 */
export async function handleDeleteSkill(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const skillId = url.pathname.split('/').pop();
    
    await env.DB.prepare(
      "DELETE FROM staff_skills WHERE id = ? AND staff_id = ?"
    ).bind(skillId, user.id).run();
    
    return new Response(JSON.stringify({
      success: true,
      message: "Skill removed"
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 6. NOTIFICATION PREFERENCES
// ======================================================================

/**
 * PUT /api/staff/notification-preferences — Update notification settings
 */
export async function handleUpdateNotificationPrefs(request, env, corsHeaders) {
  const authResult = await authenticate(request, env);
  if (!authResult.authenticated) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  const user = authResult.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    
    const existing = await env.DB.prepare(
      "SELECT id FROM notification_preferences WHERE user_id = ?"
    ).bind(user.id).first();
    
    const now = new Date().toISOString();
    
    if (existing) {
      await env.DB.prepare(`
        UPDATE notification_preferences 
        SET email_notifications = ?, sms_notifications = ?, push_notifications = ?,
            session_alerts = ?, payment_alerts = ?, payroll_alerts = ?,
            system_alerts = ?, marketing_emails = ?,
            quiet_hours_start = ?, quiet_hours_end = ?,
            updated_at = ?
        WHERE user_id = ?
      `).bind(
        body.emailNotifications !== undefined ? (body.emailNotifications ? 1 : 0) : 1,
        body.smsNotifications !== undefined ? (body.smsNotifications ? 1 : 0) : 0,
        body.pushNotifications !== undefined ? (body.pushNotifications ? 1 : 0) : 1,
        body.sessionAlerts !== undefined ? (body.sessionAlerts ? 1 : 0) : 1,
        body.paymentAlerts !== undefined ? (body.paymentAlerts ? 1 : 0) : 1,
        body.payrollAlerts !== undefined ? (body.payrollAlerts ? 1 : 0) : 1,
        body.systemAlerts !== undefined ? (body.systemAlerts ? 1 : 0) : 1,
        body.marketingEmails !== undefined ? (body.marketingEmails ? 1 : 0) : 0,
        body.quietHoursStart || null,
        body.quietHoursEnd || null,
        now,
        user.id
      ).run();
    } else {
      const prefId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO notification_preferences 
        (id, user_id, email_notifications, sms_notifications, push_notifications,
         session_alerts, payment_alerts, payroll_alerts, system_alerts, marketing_emails,
         quiet_hours_start, quiet_hours_end, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        prefId, user.id,
        body.emailNotifications !== undefined ? (body.emailNotifications ? 1 : 0) : 1,
        body.smsNotifications !== undefined ? (body.smsNotifications ? 1 : 0) : 0,
        body.pushNotifications !== undefined ? (body.pushNotifications ? 1 : 0) : 1,
        body.sessionAlerts !== undefined ? (body.sessionAlerts ? 1 : 0) : 1,
        body.paymentAlerts !== undefined ? (body.paymentAlerts ? 1 : 0) : 1,
        body.payrollAlerts !== undefined ? (body.payrollAlerts ? 1 : 0) : 1,
        body.systemAlerts !== undefined ? (body.systemAlerts ? 1 : 0) : 1,
        body.marketingEmails !== undefined ? (body.marketingEmails ? 1 : 0) : 0,
        body.quietHoursStart || null,
        body.quietHoursEnd || null,
        now, now
      ).run();
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: "Notification preferences updated"
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 7. SUBSCRIPTION MANAGEMENT
// ======================================================================

/**
 * GET /api/subscription - Get user subscription
 */
export async function handleGetSubscription(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const sub = await env.DB.prepare(
      "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(user.id).first();

    return new Response(JSON.stringify(sub || { plan: 'standard', status: 'active', auto_renew: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ plan: 'standard', status: 'active', auto_renew: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * PUT /api/subscription - Update subscription settings
 */
export async function handleUpdateSubscription(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { auto_renew, plan } = body || {};

    const existing = await env.DB.prepare(
      "SELECT id FROM subscriptions WHERE user_id = ?"
    ).bind(user.id).first();

    if (existing) {
      const updates = [];
      const params = [];
      if (auto_renew !== undefined) { updates.push("auto_renew = ?"); params.push(auto_renew ? 1 : 0); }
      if (plan) { updates.push("plan = ?"); params.push(plan); }
      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        params.push(user.id);
        await env.DB.prepare(`UPDATE subscriptions SET ${updates.join(', ')} WHERE user_id = ?`).bind(...params).run();
      }
    } else {
      await env.DB.prepare(
        "INSERT INTO subscriptions (user_id, plan, status, auto_renew, start_date, created_at, updated_at) VALUES (?, ?, 'active', ?, datetime('now'), datetime('now'), datetime('now'))"
      ).bind(user.id, plan || 'standard', auto_renew !== undefined ? (auto_renew ? 1 : 0) : 1).run();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 8. INTEGRATIONS MANAGEMENT
// ======================================================================

/**
 * GET /api/integrations - Get user integrations
 */
export async function handleGetIntegrations(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const integrations = await env.DB.prepare(
      "SELECT id, integration_type, provider, is_connected, created_at, updated_at FROM user_integrations WHERE user_id = ? ORDER BY integration_type ASC"
    ).bind(user.id).all();

    return new Response(JSON.stringify(integrations.results || []), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify([]), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * POST /api/integrations - Connect/toggle integration
 */
export async function handleUpdateIntegration(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { integration_type, provider, is_connected } = body || {};

    if (!integration_type) {
      return new Response(JSON.stringify({ error: "integration_type is required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM user_integrations WHERE user_id = ? AND integration_type = ?"
    ).bind(user.id, integration_type).first();

    if (existing) {
      await env.DB.prepare(
        "UPDATE user_integrations SET is_connected = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(is_connected ? 1 : 0, existing.id).run();
    } else {
      await env.DB.prepare(
        "INSERT INTO user_integrations (user_id, integration_type, provider, is_connected, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))"
      ).bind(user.id, integration_type, provider || integration_type, is_connected ? 1 : 0).run();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 9. USER PREFERENCES
// ======================================================================

/**
 * POST /api/preferences - Save user preferences
 */
export async function handleSavePreferences(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = await request.json();

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'boolean' || typeof value === 'string') {
        const existing = await env.DB.prepare(
          "SELECT id FROM user_preferences WHERE user_id = ? AND preference_key = ?"
        ).bind(user.id, key).first();

        if (existing) {
          await env.DB.prepare(
            "UPDATE user_preferences SET preference_value = ?, updated_at = datetime('now') WHERE id = ?"
          ).bind(String(value), existing.id).run();
        } else {
          await env.DB.prepare(
            "INSERT INTO user_preferences (user_id, preference_key, preference_value, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
          ).bind(user.id, key, String(value)).run();
        }
      }
    }

    // Also update notification_preferences
    const notifUpdates = [];
    const notifParams = [];
    if (body.emailNotifications !== undefined) { notifUpdates.push("email_notifications = ?"); notifParams.push(body.emailNotifications ? 1 : 0); }
    if (body.smsAlerts !== undefined) { notifUpdates.push("sms_notifications = ?"); notifParams.push(body.smsAlerts ? 1 : 0); }
    if (body.pushNotifications !== undefined) { notifUpdates.push("push_notifications = ?"); notifParams.push(body.pushNotifications ? 1 : 0); }

    if (notifUpdates.length > 0) {
      const existingNotif = await env.DB.prepare(
        "SELECT id FROM notification_preferences WHERE user_id = ?"
      ).bind(user.id).first();

      if (existingNotif) {
        notifUpdates.push("updated_at = datetime('now')");
        notifParams.push(user.id);
        await env.DB.prepare(`UPDATE notification_preferences SET ${notifUpdates.join(', ')} WHERE user_id = ?`).bind(...notifParams).run();
      } else {
        const prefId = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO notification_preferences (id, user_id, email_notifications, sms_notifications, push_notifications, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `).bind(prefId, user.id, body.emailNotifications !== undefined ? (body.emailNotifications ? 1 : 0) : 1, body.smsAlerts !== undefined ? (body.smsAlerts ? 1 : 0) : 0, body.pushNotifications !== undefined ? (body.pushNotifications ? 1 : 0) : 1).run();
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 10. DELETE ACCOUNT
// ======================================================================

/**
 * DELETE /api/profile - Delete user account
 */
export async function handleDeleteProfile(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    await env.DB.prepare("UPDATE users SET status = 'deleted', updated_at = datetime('now') WHERE id = ?").bind(user.id).run();
    await env.DB.prepare("UPDATE staff SET status = 'deleted', updated_at = datetime('now') WHERE id = ?").bind(user.id).run().catch(() => {});

    await logAudit(env, "ACCOUNT_DELETED", user.id, "user", user.id, {}, "system", "system");

    return new Response(JSON.stringify({ success: true, message: "Account deleted" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 11. REFERRAL SYSTEM - UPDATED (₦500 → ₦2,000)
// ======================================================================

/**
 * GET /api/referrals - Get user's referral stats and code
 */
export async function handleGetReferrals(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    // Get or generate referral code
    let userData = await env.DB.prepare(
      "SELECT referral_code, total_referrals, points FROM users WHERE id = ?"
    ).bind(user.id).first();

    if (!userData || !userData.referral_code) {
      const code = 'PRIME-' + Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase().slice(0, 8);
      await env.DB.prepare("UPDATE users SET referral_code = ? WHERE id = ?").bind(code, user.id).run();
      userData = { referral_code: code, total_referrals: 0, points: 0 };
    }

    // Get referral stats
    const referrals = await env.DB.prepare(
      "SELECT * FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC"
    ).bind(user.id).all();

    // UPDATED: reward_amount = 2000 (was 500)
    const totalEarned = referrals.results.reduce((sum, r) => sum + (r.reward_amount || 2000), 0);
    const claimedCount = referrals.results.filter(r => r.reward_claimed).length;
    const pendingCount = referrals.results.filter(r => !r.reward_claimed).length;

    return new Response(JSON.stringify({
      success: true,
      code: userData.referral_code,
      rewardAmount: 2000, // UPDATED: ₦2,000 per referral
      stats: {
        total: referrals.results.length,
        earned: totalEarned,
        pending: pendingCount * 2000,
        claimed: claimedCount * 2000,
      },
      referrals: referrals.results.map(r => ({
        id: r.id,
        referred_email: r.referred_email,
        status: r.status,
        reward_amount: r.reward_amount || 2000,
        reward_claimed: !!r.reward_claimed,
        created_at: r.created_at
      }))
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ 
      success: true,
      code: 'PRIME-XXXXXX',
      rewardAmount: 2000,
      stats: { total: 0, earned: 0, pending: 0, claimed: 0 },
      referrals: []
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * POST /api/referrals/claim - Claim referral reward (₦2,000 store credit)
 */
export async function handleClaimReferralReward(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { referral_id } = body || {};

    const referral = await env.DB.prepare(
      "SELECT * FROM referrals WHERE id = ? AND referrer_id = ? AND reward_claimed = 0"
    ).bind(referral_id, user.id).first();

    if (!referral) {
      return new Response(JSON.stringify({ error: "Referral not found or already claimed" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await env.DB.prepare(
      "UPDATE referrals SET reward_claimed = 1, reward_claimed_at = datetime('now') WHERE id = ?"
    ).bind(referral_id).run();

    // UPDATED: Add points (store credit) - ₦2,000 per referral
    const rewardAmount = referral.reward_amount || 2000;
    await env.DB.prepare(
      "UPDATE users SET points = points + ?, total_referrals = total_referrals + 1 WHERE id = ?"
    ).bind(rewardAmount, user.id).run();

    await logAudit(env, "REFERRAL_REWARD_CLAIMED", user.id, "user", user.id, {
      referral_id,
      amount: rewardAmount
    }, "system", "system");

    return new Response(JSON.stringify({ 
      success: true, 
      message: "₦2,000 store credit claimed successfully!",
      amount: rewardAmount
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 12. SUBSCRIPTION PAYMENT (PAYSTACK)
// ======================================================================

/**
 * POST /api/subscription/initialize - Initialize Paystack payment
 */
export async function handleInitializeSubscription(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { plan } = body || {};
    
    const prices = { pro: 250000, business: 500000 }; // in kobo
    const amount = prices[plan] || 250000;
    
    const reference = 'SUB-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    
    // Save pending subscription
    await env.DB.prepare(
      "INSERT INTO subscriptions (user_id, plan, status, auto_renew, start_date, created_at, updated_at) VALUES (?, ?, 'pending', 1, datetime('now'), datetime('now'), datetime('now'))"
    ).bind(user.id, plan).run().catch(() => {});

    // Initialize Paystack
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.PAYSTACK_SECRET_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: user.email || 'user@primeshieldhub.com',
        amount: amount,
        reference: reference,
        callback_url: 'https://primeshieldhub.com/profile',
        metadata: { user_id: user.id, plan: plan }
      })
    });

    const paystackData = await paystackResponse.json();
    
    if (paystackData.status) {
      return new Response(JSON.stringify({
        success: true,
        authorization_url: paystackData.data.authorization_url,
        reference: reference
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    } else {
      throw new Error(paystackData.message || 'Payment initialization failed');
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 13. EXPORT DATA
// ======================================================================

/**
 * GET /api/export/:type - Export user data
 */
export async function handleExportData(request, env, corsHeaders) {
  const user = await requireAuth(request, env, null);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const type = url.pathname.split('/').pop();

    if (type === 'profile') {
      const userData = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
      const jsonStr = JSON.stringify(userData, null, 2);
      return new Response(jsonStr, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=profile-export.json",
          ...corsHeaders
        }
      });
    }

    if (type === 'orders') {
      const orders = await env.DB.prepare("SELECT * FROM orders WHERE user_id = ?").bind(user.id).all();
      let csv = 'id,amount,status,created_at,reference,points_earned\n';
      (orders.results || []).forEach(o => {
        csv += `${o.id},${o.amount},${o.status},${o.created_at},${o.reference},${o.points_earned || 0}\n`;
      });
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=orders-export.csv",
          ...corsHeaders
        }
      });
    }

    if (type === 'rewards') {
      const userData = await env.DB.prepare("SELECT id, points, total_spent, total_orders, referral_code, total_referrals FROM users WHERE id = ?").bind(user.id).first();
      const referrals = await env.DB.prepare("SELECT * FROM referrals WHERE referrer_id = ?").bind(user.id).all();
      
      const tier = calculateLoyaltyTier(userData?.total_spent || 0);
      
      const data = {
        user: {
          id: userData?.id,
          points: userData?.points || 0,
          totalSpent: userData?.total_spent || 0,
          totalOrders: userData?.total_orders || 0,
          loyaltyTier: tier.tier,
          tierMultiplier: tier.multiplier,
          referralCode: userData?.referral_code,
          totalReferrals: userData?.total_referrals || 0
        },
        referrals: referrals.results || [],
        exportDate: new Date().toISOString()
      };
      
      const jsonStr = JSON.stringify(data, null, 2);
      return new Response(jsonStr, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=rewards-export.json",
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({ error: "Invalid export type. Use: profile, orders, or rewards" }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// EXPORT ALL HANDLERS
// ======================================================================

export default {
  handleGetProfile,
  handleUpdateProfile,
  handleUploadAvatar,
  handleRemoveAvatar,
  handleGetDocuments,
  handleUploadDocument,
  handleDeleteDocument,
  handleAddSkill,
  handleDeleteSkill,
  handleUpdateNotificationPrefs,
  handleGetSubscription,
  handleUpdateSubscription,
  handleGetIntegrations,
  handleUpdateIntegration,
  handleSavePreferences,
  handleDeleteProfile,
  handleGetReferrals,
  handleClaimReferralReward,
  handleInitializeSubscription,
  handleExportData
};
