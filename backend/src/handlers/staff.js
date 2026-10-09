// ======================================================================
// STAFF HANDLERS — COMPLETE INTEGRATED VERSION v11.4
// Full staff management, dashboard, sessions, bays, analytics, and attendance
// FIXED: Attendance handlers resolve users.id → staff.id for JWT mismatch
// ======================================================================

import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../utils/logging.js';
import { validateString, validateImageUpload, validateEmail, validatePhone } from '../utils/validation.js';
import { getCorsHeaders } from '../middleware/cors.js';
import { nanoid } from 'nanoid';

// ======================================================================
// UTILITY HELPERS
// ======================================================================

/**
 * Helper: Resolve correct staff ID from JWT user ID
 * The JWT stores the users table ID, but staff_attendance uses staff table ID.
 * This function finds the matching staff record by checking direct ID match
 * first, then falling back to email lookup.
 */
async function resolveStaffId(env, userId) {
  // First try direct ID match (common case when users.id === staff.id)
  const directCheck = await env.DB.prepare("SELECT id FROM staff WHERE id = ?").bind(userId).first();
  if (directCheck) return directCheck.id;
  
  // Fallback: look up staff by matching email between users and staff tables
  const staffByEmail = await env.DB.prepare(
    "SELECT s.id FROM staff s JOIN users u ON s.email = u.email WHERE u.id = ?"
  ).bind(userId).first();
  
  if (staffByEmail) return staffByEmail.id;
  
  // If no staff record found at all, return the original user ID
  return userId;
}

/**
 * Generate secure ticket number
 */
function generateTicketNumber(counter) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid(4).toUpperCase();
  const padded = counter.toString().padStart(4, '0');
  return `PSH-${timestamp.slice(-3)}${padded}${random}`;
}

/**
 * Log staff activity
 */
async function logStaffActivity(env, data) {
  try {
    await env.DB.prepare(`
      INSERT INTO staff_activity (
        id, staff_id, branch_id, action, details, session_id, ip, fingerprint, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      nanoid(),
      data.staffId,
      data.branchId || null,
      data.action,
      data.details || '',
      data.sessionId || null,
      data.ip || null,
      data.fingerprint || null
    ).run();
  } catch (e) {
    console.error('Log activity error:', e);
  }
}

/**
 * Calculate charging estimate based on device type
 */
function calculateEstimate(deviceType, batteryStart = 0) {
  const estimates = {
    phone: { base: 60, max: 120, batteryFactor: 0.9 },
    laptop: { base: 90, max: 180, batteryFactor: 1.5 },
    tablet: { base: 80, max: 150, batteryFactor: 1.1 },
    powerbank: { base: 120, max: 300, batteryFactor: 1.2 },
    bluetooth: { base: 40, max: 80, batteryFactor: 0.5 },
    smartwatch: { base: 45, max: 90, batteryFactor: 0.6 },
    camera: { base: 60, max: 120, batteryFactor: 0.8 },
    default: { base: 70, max: 140, batteryFactor: 1.0 }
  };
  
  const estimate = estimates[deviceType] || estimates.default;
  let minutes = estimate.base;
  
  if (batteryStart >= 0 && batteryStart <= 100) {
    const batteryRemaining = 100 - batteryStart;
    minutes += batteryRemaining * estimate.batteryFactor;
  }
  
  return Math.min(Math.round(minutes), estimate.max);
}

/**
 * Calculate dynamic pricing
 */
function calculatePrice(deviceType, customerVisits = 0, currentLoad = 0) {
  const pricing = {
    phone: 300,
    laptop: 700,
    tablet: 400,
    powerbank: 500,
    bluetooth: 200,
    smartwatch: 250,
    camera: 350,
    default: 200
  };
  
  let basePrice = pricing[deviceType] || pricing.default;
  
  // Surge pricing when >80% capacity
  if (currentLoad > 0.8) {
    basePrice = Math.round(basePrice * 1.5);
  }
  
  // Loyalty discount for customers with >10 visits
  if (customerVisits >= 10) {
    basePrice = Math.round(basePrice * 0.9);
  }
  
  return basePrice;
}

// ======================================================================
// 1. STAFF PROFILE & DASHBOARD
// ======================================================================

/**
 * GET /api/staff/me — Get staff profile with metrics
 */
export async function handleStaffMe(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    // Get staff details with branch info
    const staffQuery = await env.DB.prepare(`
      SELECT 
        u.id, u.name, u.email, u.phone, u.role, u.status,
        u.branch_id, u.points, u.created_at, u.avatar_url,
        b.id as branch_id, b.name as branch_name, b.city, b.address,
        b.phone as branch_phone, b.manager_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.id = ? AND u.role IN ('staff', 'admin', 'manager')
    `).bind(user.id);
    const staffResult = await staffQuery.first();
    
    if (!staffResult) {
      // Fallback for staff not in users table yet
      const fallback = await env.DB.prepare(
        "SELECT id, name, role, score, total_revenue, total_sessions, branch_id, branch_name, status FROM staff WHERE id = ?"
      ).bind(user.id).first();
      
      if (fallback) {
        return new Response(JSON.stringify({
          ...fallback,
          metrics: await getStaffMetrics(env, user.id, fallback.branch_id)
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      return new Response(JSON.stringify({
        id: user.id,
        name: user.name || "Staff",
        email: user.email || "",
        role: user.role || "staff",
        score: 100,
        branch_name: "Main",
        metrics: { total_sessions: 0, total_revenue: 0, active_sessions: 0, ready_sessions: 0 }
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    // Get staff metrics
    const metrics = await getStaffMetrics(env, user.id, staffResult.branch_id);
    
    return new Response(JSON.stringify({
      ...staffResult,
      metrics
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Staff profile error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * Helper: Get staff metrics
 */
async function getStaffMetrics(env, staffId, branchId) {
  try {
    const result = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        COALESCE(SUM(amount), 0) as total_revenue,
        COUNT(CASE WHEN status IN ('charging', 'paused') THEN 1 END) as active_sessions,
        COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
        AVG(estimated_minutes) as avg_charge_time,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as today_revenue
      FROM charging_sessions
      WHERE staff_id = ? OR branch_id = ?
    `).bind(staffId, branchId).first();
    
    return result || { total_sessions: 0, total_revenue: 0, active_sessions: 0, ready_sessions: 0, completed_sessions: 0, avg_charge_time: 0, today_revenue: 0 };
  } catch (e) {
    console.error('Metrics error:', e);
    return { total_sessions: 0, total_revenue: 0, active_sessions: 0, ready_sessions: 0, completed_sessions: 0, avg_charge_time: 0, today_revenue: 0 };
  }
}

/**
 * GET /api/staff/dashboard — Full dashboard data
 */
export async function handleStaffDashboard(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const branchId = user.branch_id || user.branchId || 'main';
    
    // Get active sessions
    const sessionsQuery = await env.DB.prepare(`
      SELECT 
        cs.*,
        u.name as staff_name,
        b.name as branch_name,
        b.city as branch_city
      FROM charging_sessions cs
      LEFT JOIN users u ON cs.staff_id = u.id
      LEFT JOIN branches b ON cs.branch_id = b.id
      WHERE cs.branch_id = ? AND cs.status IN ('charging', 'paused', 'ready')
      ORDER BY cs.start_time DESC
      LIMIT 50
    `).bind(branchId);
    const sessions = await sessionsQuery.all();
    
    // Get today's revenue
    const revenueQuery = await env.DB.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM charging_sessions
      WHERE branch_id = ? 
        AND status = 'completed'
        AND DATE(completed_at) = DATE('now')
    `).bind(branchId);
    const todayRevenue = await revenueQuery.first();
    
    // Get bay status
    const baysQuery = await env.DB.prepare(`
      SELECT 
        b.*,
        cs.ticket_number,
        cs.customer_name,
        cs.customer_phone,
        cs.start_time as occupied_since,
        cs.estimated_completion
      FROM bays b
      LEFT JOIN charging_sessions cs ON b.session_id = cs.id
      WHERE b.branch_id = ?
      ORDER BY b.id ASC
    `).bind(branchId);
    const bays = await baysQuery.all();
    
    // Get weekly revenue
    const weeklyQuery = await env.DB.prepare(`
      SELECT 
        DATE(completed_at) as date,
        COALESCE(SUM(amount), 0) as total
      FROM charging_sessions
      WHERE branch_id = ? 
        AND status = 'completed'
        AND completed_at >= DATE('now', '-7 days')
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `).bind(branchId);
    const weeklyRevenue = await weeklyQuery.all();
    
    // Get top customers (loyalty)
    const loyaltyQuery = await env.DB.prepare(`
      SELECT 
        customer_phone,
        customer_name,
        COUNT(*) as visits,
        SUM(amount) as total_spent,
        MAX(completed_at) as last_visit
      FROM charging_sessions
      WHERE branch_id = ? 
        AND status = 'completed'
        AND customer_phone IS NOT NULL
        AND customer_phone != ''
      GROUP BY customer_phone
      ORDER BY visits DESC
      LIMIT 10
    `).bind(branchId);
    const loyaltyStats = await loyaltyQuery.all();
    
    // Get staff activity summary
    const activityQuery = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_actions,
        action,
        COUNT(*) as count
      FROM staff_activity
      WHERE staff_id = ? AND created_at >= DATE('now', '-7 days')
      GROUP BY action
    `).bind(user.id);
    const activitySummary = await activityQuery.all();
    
    return new Response(JSON.stringify({
      activeSessions: sessions.results || [],
      todayRevenue: todayRevenue?.total || 0,
      bays: bays.results || [],
      weeklyRevenue: weeklyRevenue.results || [],
      loyaltyStats: loyaltyStats.results || [],
      activitySummary: activitySummary.results || []
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Dashboard error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 2. STAFF LOCATION & CAPTURE (Existing)
// ======================================================================

/**
 * POST /api/staff/location — Update staff location
 */
export async function handleStaffLocation(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const lat = typeof body.lat === 'number' && body.lat >= -90 && body.lat <= 90 ? body.lat : null;
    const lng = typeof body.lng === 'number' && body.lng >= -180 && body.lng <= 180 ? body.lng : null;
    const staffId = validateString(body.staffId, 100) || user.id;
    const branchId = body.branchId ? validateString(body.branchId, 100) : null;

    if (lat === null || lng === null) {
      return new Response(JSON.stringify({ error: "Valid lat/lng required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await env.DB.prepare(
      "INSERT INTO staff_locations (id, staff_id, lat, lng, branch_id, timestamp) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).bind(nanoid(), staffId, lat, lng, branchId).run();
    
    await logStaffActivity(env, {
      staffId: user.id,
      branchId: branchId,
      action: 'location_update',
      details: `Location updated: ${lat}, ${lng}`
    });
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Location error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * POST /api/staff/capture — Upload photo evidence
 */
export async function handleStaffCapture(request, env, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const image = validateString(body.image, 5000000);
    const staffId = validateString(body.staffId, 100) || user.id;
    const branchId = body.branchId ? validateString(body.branchId, 100) : null;

    if (!image || !image.startsWith('data:image/')) {
      return new Response(JSON.stringify({ error: "Valid image required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const imageValidation = validateImageUpload(image, 5);
    if (!imageValidation.valid) {
      return new Response(JSON.stringify({ error: imageValidation.error }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const captureId = nanoid();
    
    if (env.STORAGE && image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      await env.STORAGE.put('captures/' + captureId + '.png', binaryData, {
        httpMetadata: { contentType: 'image/png' }
      });
    }
    
    await env.DB.prepare(
      "INSERT INTO staff_captures (id, staff_id, image_url, branch_id, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
    ).bind(captureId, staffId, '/files/captures/' + captureId + '.png', branchId).run();
    
    await logAudit(env, "CAPTURE_UPLOADED", user.id, "staff_capture", captureId, {
      staffId
    }, ip, fingerprint);
    
    await logStaffActivity(env, {
      staffId: user.id,
      branchId: branchId,
      action: 'capture_uploaded',
      details: `Evidence capture uploaded: ${captureId}`
    });
    
    return new Response(JSON.stringify({ success: true, captureId }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Capture error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 3. CHARGING SESSION MANAGEMENT
// ======================================================================

/**
 * POST /api/staff/session/start — Start new charging session
 */
export async function handleStartSession(request, env, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    
    // Validate required fields
    const customerName = validateString(body.customerName, 100);
    const customerPhone = validateString(body.customerPhone, 20);
    const deviceType = validateString(body.deviceType, 50) || 'default';
    const deviceModel = validateString(body.deviceModel, 100) || '';
    const batteryStart = typeof body.batteryStart === 'number' ? Math.min(100, Math.max(0, body.batteryStart)) : 0;
    const amount = body.amount ? parseFloat(body.amount) : null;
    const notes = validateString(body.notes, 500) || '';
    const staffId = validateString(body.staffId, 100) || user.id;
    const branchId = validateString(body.branchId, 100) || user.branch_id || 'main';

    if (!customerName || !customerPhone) {
      return new Response(JSON.stringify({ error: "Customer name and phone required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check if customer has active session
    const activeCheck = await env.DB.prepare(`
      SELECT id, ticket_number FROM charging_sessions
      WHERE customer_phone = ? AND branch_id = ? AND status IN ('charging', 'paused', 'ready')
    `).bind(customerPhone, branchId).first();
    
    if (activeCheck) {
      return new Response(JSON.stringify({ 
        error: `Customer already has active session: ${activeCheck.ticket_number}` 
      }), {
        status: 409, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Get customer visit count for loyalty
    const visitQuery = await env.DB.prepare(`
      SELECT COUNT(*) as visits
      FROM charging_sessions
      WHERE customer_phone = ? AND branch_id = ? AND status = 'completed'
    `).bind(customerPhone, branchId);
    const visits = await visitQuery.first();
    const customerVisits = visits?.visits || 0;

    // Get current load for surge pricing
    const loadQuery = await env.DB.prepare(`
      SELECT COUNT(*) as active
      FROM charging_sessions
      WHERE branch_id = ? AND status IN ('charging', 'paused')
    `).bind(branchId);
    const load = await loadQuery.first();
    const totalBays = 10; // Configurable
    const currentLoad = totalBays > 0 ? (load?.active || 0) / totalBays : 0;

    // Calculate price and estimate
    const price = amount || calculatePrice(deviceType, customerVisits, currentLoad);
    const estimate = calculateEstimate(deviceType, batteryStart);
    
    // Generate ticket number
    const counterQuery = await env.DB.prepare(
      "SELECT value FROM counters WHERE key = 'ticket_counter'"
    ).first();
    
    let counter = 1;
    if (counterQuery) {
      counter = parseInt(counterQuery.value) + 1;
      await env.DB.prepare(
        "UPDATE counters SET value = ? WHERE key = 'ticket_counter'"
      ).bind(counter).run();
    } else {
      await env.DB.prepare(
        "INSERT INTO counters (key, value) VALUES ('ticket_counter', ?)"
      ).bind(counter).run();
    }
    
    const ticketNumber = generateTicketNumber(counter);

    // Create session
    const sessionId = nanoid();
    await env.DB.prepare(`
      INSERT INTO charging_sessions (
        id, ticket_number, customer_name, customer_phone, customer_email,
        device_type, device_model, battery_start, amount, estimated_minutes,
        status, staff_id, branch_id, notes, start_time, estimated_completion,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'charging', ?, ?, ?, datetime('now'), datetime('now', ? || ' minutes'), datetime('now'))
    `).bind(
      sessionId, ticketNumber, customerName, customerPhone, body.customerEmail || null,
      deviceType, deviceModel, batteryStart, price, estimate,
      staffId, branchId, notes,
      estimate
    ).run();

    // Assign bay if available
    const bayQuery = await env.DB.prepare(`
      SELECT id, name FROM bays
      WHERE branch_id = ? AND occupied = 0
      LIMIT 1
    `).bind(branchId);
    const availableBay = await bayQuery.first();
    
    if (availableBay) {
      await env.DB.prepare(`
        UPDATE bays 
        SET occupied = 1, session_id = ?, occupied_at = datetime('now')
        WHERE id = ?
      `).bind(sessionId, availableBay.id).run();
      
      await env.DB.prepare(`
        UPDATE charging_sessions 
        SET bay_id = ?, bay_name = ?
        WHERE id = ?
      `).bind(availableBay.id, availableBay.name, sessionId).run();
    }

    // Log activity
    await logStaffActivity(env, {
      staffId: user.id,
      branchId: branchId,
      action: 'session_started',
      details: `Started session ${ticketNumber} for ${customerName}`,
      sessionId: sessionId,
      ip: ip,
      fingerprint: fingerprint
    });

    // Get the created session
    const sessionQuery = await env.DB.prepare(`
      SELECT * FROM charging_sessions WHERE id = ?
    `).bind(sessionId);
    const session = await sessionQuery.first();

    return new Response(JSON.stringify({
      success: true,
      session: session,
      bayAssigned: !!availableBay,
      bayName: availableBay?.name || null,
      ticketNumber: ticketNumber
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Start session error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * POST /api/staff/session/collect — Collect payment and complete session
 */
export async function handleCollectSession(request, env, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const sessionId = validateString(body.sessionId, 100);
    const amount = body.amount ? parseFloat(body.amount) : null;
    const paymentMethod = validateString(body.paymentMethod, 50) || 'cash';

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Get session
    const sessionQuery = await env.DB.prepare(`
      SELECT * FROM charging_sessions
      WHERE id = ? AND branch_id = ? AND status IN ('charging', 'ready')
    `).bind(sessionId, user.branch_id || user.branchId || 'main');
    const session = await sessionQuery.first();

    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found or already collected" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const finalAmount = amount || session.amount;

    // Update session
    await env.DB.prepare(`
      UPDATE charging_sessions
      SET 
        status = 'completed',
        completed_at = datetime('now'),
        amount = ?,
        payment_method = ?,
        collected_by = ?
      WHERE id = ?
    `).bind(finalAmount, paymentMethod, user.id, sessionId).run();

    // Release bay
    await env.DB.prepare(`
      UPDATE bays
      SET occupied = 0, session_id = NULL, occupied_at = NULL
      WHERE session_id = ?
    `).bind(sessionId).run();

    // Record transaction
    await env.DB.prepare(`
      INSERT INTO transactions (
        id, session_id, branch_id, amount, payment_method, 
        staff_id, customer_phone, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', datetime('now'))
    `).bind(nanoid(), sessionId, user.branch_id || user.branchId, finalAmount, paymentMethod, user.id, session.customer_phone).run();

    // Update staff metrics
    await env.DB.prepare(`
      UPDATE users 
      SET points = COALESCE(points, 0) + 10,
          total_revenue = COALESCE(total_revenue, 0) + ?,
          total_sessions = COALESCE(total_sessions, 0) + 1
      WHERE id = ?
    `).bind(finalAmount, user.id).run();

    // Log activity
    await logStaffActivity(env, {
      staffId: user.id,
      branchId: user.branch_id || user.branchId,
      action: 'payment_collected',
      details: `Collected ₦${finalAmount} from ${session.customer_name} (${session.ticket_number})`,
      sessionId: sessionId,
      ip: ip,
      fingerprint: fingerprint
    });

    // Check loyalty milestone
    const visitQuery = await env.DB.prepare(`
      SELECT COUNT(*) as visits
      FROM charging_sessions
      WHERE customer_phone = ? AND status = 'completed'
    `).bind(session.customer_phone);
    const visits = await visitQuery.first();
    
    let loyaltyMessage = null;
    if (visits && visits.visits % 10 === 0) {
      loyaltyMessage = `🎉 Congratulations! This is your ${visits.visits}th visit. You've earned a FREE charge!`;
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Payment collected successfully',
      amount: finalAmount,
      sessionId: sessionId,
      ticketNumber: session.ticket_number,
      loyaltyMessage: loyaltyMessage
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Collect session error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * POST /api/staff/session/pause — Pause charging session
 */
export async function handlePauseSession(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const sessionId = validateString(body.sessionId, 100);
    const reason = validateString(body.reason, 200) || 'Manually paused';

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const result = await env.DB.prepare(`
      UPDATE charging_sessions
      SET status = 'paused', paused_at = datetime('now'), pause_reason = ?
      WHERE id = ? AND branch_id = ? AND status = 'charging'
    `).bind(reason, sessionId, user.branch_id || user.branchId || 'main').run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: "Session not found or not in charging state" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await logStaffActivity(env, {
      staffId: user.id,
      branchId: user.branch_id || user.branchId,
      action: 'session_paused',
      details: `Paused session ${sessionId}: ${reason}`,
      sessionId: sessionId
    });

    return new Response(JSON.stringify({ success: true, message: 'Session paused' }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Pause session error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * POST /api/staff/session/resume — Resume paused session
 */
export async function handleResumeSession(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const sessionId = validateString(body.sessionId, 100);

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const result = await env.DB.prepare(`
      UPDATE charging_sessions
      SET status = 'charging', resumed_at = datetime('now')
      WHERE id = ? AND branch_id = ? AND status = 'paused'
    `).bind(sessionId, user.branch_id || user.branchId || 'main').run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: "Session not found or not in paused state" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await logStaffActivity(env, {
      staffId: user.id,
      branchId: user.branch_id || user.branchId,
      action: 'session_resumed',
      details: `Resumed session ${sessionId}`,
      sessionId: sessionId
    });

    return new Response(JSON.stringify({ success: true, message: 'Session resumed' }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Resume session error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 4. BAY MANAGEMENT
// ======================================================================

/**
 * GET /api/staff/bays — Get bay status
 */
export async function handleGetBays(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const branchId = user.branch_id || user.branchId || 'main';

    const baysQuery = await env.DB.prepare(`
      SELECT 
        b.*,
        cs.ticket_number,
        cs.customer_name,
        cs.customer_phone,
        cs.start_time as occupied_since,
        cs.estimated_completion,
        u.name as staff_name
      FROM bays b
      LEFT JOIN charging_sessions cs ON b.session_id = cs.id
      LEFT JOIN users u ON cs.staff_id = u.id
      WHERE b.branch_id = ?
      ORDER BY b.id ASC
    `).bind(branchId);
    const bays = await baysQuery.all();

    const stats = {
      total: bays.results.length,
      occupied: bays.results.filter(b => b.occupied).length,
      available: bays.results.filter(b => !b.occupied).length,
      occupancyRate: bays.results.length > 0 
        ? Math.round((bays.results.filter(b => b.occupied).length / bays.results.length) * 100)
        : 0
    };

    return new Response(JSON.stringify({
      bays: bays.results,
      stats
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Get bays error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * POST /api/staff/bays/assign — Assign bay to session
 */
export async function handleAssignBay(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const sessionId = validateString(body.sessionId, 100);
    const bayId = body.bayId ? parseInt(body.bayId) : null;

    if (!sessionId || !bayId) {
      return new Response(JSON.stringify({ error: "Session ID and Bay ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check bay availability
    const bayQuery = await env.DB.prepare(`
      SELECT id, occupied, session_id, name
      FROM bays
      WHERE id = ? AND branch_id = ?
    `).bind(bayId, user.branch_id || user.branchId || 'main');
    const bay = await bayQuery.first();

    if (!bay) {
      return new Response(JSON.stringify({ error: "Bay not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (bay.occupied) {
      return new Response(JSON.stringify({ error: "Bay is already occupied" }), {
        status: 409, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check session
    const sessionQuery = await env.DB.prepare(`
      SELECT id, status
      FROM charging_sessions
      WHERE id = ? AND branch_id = ? AND status IN ('charging', 'paused')
    `).bind(sessionId, user.branch_id || user.branchId || 'main');
    const session = await sessionQuery.first();

    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found or not active" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Assign bay
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE bays 
        SET occupied = 1, session_id = ?, occupied_at = datetime('now')
        WHERE id = ?
      `).bind(sessionId, bayId),
      env.DB.prepare(`
        UPDATE charging_sessions 
        SET bay_id = ?, bay_name = ?
        WHERE id = ?
      `).bind(bayId, bay.name, sessionId)
    ]);

    await logStaffActivity(env, {
      staffId: user.id,
      branchId: user.branch_id || user.branchId,
      action: 'bay_assigned',
      details: `Assigned ${bay.name} (Bay ${bayId}) to session ${sessionId}`,
      sessionId: sessionId
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Bay assigned successfully',
      bayId: bayId,
      bayName: bay.name,
      sessionId: sessionId
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Assign bay error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * POST /api/staff/bays/release — Release bay from session
 */
export async function handleReleaseBay(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const sessionId = validateString(body.sessionId, 100);

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const result = await env.DB.prepare(`
      UPDATE bays
      SET occupied = 0, session_id = NULL, occupied_at = NULL
      WHERE session_id = ? AND branch_id = ?
    `).bind(sessionId, user.branch_id || user.branchId || 'main').run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: "Bay not found for this session" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await logStaffActivity(env, {
      staffId: user.id,
      branchId: user.branch_id || user.branchId,
      action: 'bay_released',
      details: `Released bay from session ${sessionId}`,
      sessionId: sessionId
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Bay released successfully'
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Release bay error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 5. CUSTOMER LOYALTY & ANALYTICS
// ======================================================================

/**
 * GET /api/staff/customer/:phone — Get customer history
 */
export async function handleGetCustomer(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const phone = url.pathname.split('/').pop();

    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone number required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const cleanedPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Get customer history
    const historyQuery = await env.DB.prepare(`
      SELECT 
        id, ticket_number, customer_name, customer_phone,
        device_type, device_model, amount, status,
        start_time, completed_at, estimated_minutes,
        branch_name, staff_name
      FROM charging_sessions
      WHERE customer_phone = ? AND branch_id = ?
      ORDER BY start_time DESC
      LIMIT 50
    `).bind(cleanedPhone, user.branch_id || user.branchId || 'main');
    const history = await historyQuery.all();

    // Get customer stats
    const statsQuery = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_visits,
        COALESCE(SUM(amount), 0) as total_spent,
        AVG(amount) as avg_spent,
        COUNT(DISTINCT device_type) as devices_used,
        MAX(completed_at) as last_visit
      FROM charging_sessions
      WHERE customer_phone = ? AND branch_id = ? AND status = 'completed'
    `).bind(cleanedPhone, user.branch_id || user.branchId || 'main');
    const stats = await statsQuery.first();

    // Check loyalty tier
    const visits = stats?.total_visits || 0;
    let loyaltyTier = 'Regular';
    let nextMilestone = null;
    
    if (visits >= 100) loyaltyTier = 'VIP Diamond';
    else if (visits >= 50) loyaltyTier = 'VIP Platinum';
    else if (visits >= 20) loyaltyTier = 'VIP Gold';
    else if (visits >= 10) loyaltyTier = 'VIP Silver';
    
    const milestones = [10, 20, 50, 100];
    for (const m of milestones) {
      if (visits < m) {
        nextMilestone = { visits: m, reward: visits >= 10 ? 'FREE charge' : 'Discount' };
        break;
      }
    }

    return new Response(JSON.stringify({
      customer: {
        name: history.results[0]?.customer_name || 'Unknown',
        phone: cleanedPhone
      },
      stats: {
        totalVisits: stats?.total_visits || 0,
        totalSpent: stats?.total_spent || 0,
        avgSpent: stats?.avg_spent || 0,
        devicesUsed: stats?.devices_used || 0,
        lastVisit: stats?.last_visit || null,
        loyaltyTier: loyaltyTier,
        nextMilestone: nextMilestone
      },
      history: history.results || []
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Get customer error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * GET /api/staff/loyalty/top — Get top customers
 */
export async function handleTopCustomers(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'month'; // month, year, all
    const limit = parseInt(url.searchParams.get('limit')) || 10;

    let dateFilter = '';
    if (period === 'month') {
      dateFilter = "AND completed_at >= DATE('now', 'start of month')";
    } else if (period === 'year') {
      dateFilter = "AND completed_at >= DATE('now', 'start of year')";
    }

    const query = await env.DB.prepare(`
      SELECT 
        customer_phone,
        customer_name,
        COUNT(*) as visits,
        SUM(amount) as total_spent,
        AVG(amount) as avg_spent,
        MAX(completed_at) as last_visit,
        COUNT(DISTINCT device_type) as devices_used
      FROM charging_sessions
      WHERE branch_id = ? 
        AND status = 'completed'
        AND customer_phone IS NOT NULL
        AND customer_phone != ''
        ${dateFilter}
      GROUP BY customer_phone
      ORDER BY visits DESC, total_spent DESC
      LIMIT ?
    `).bind(user.branch_id || user.branchId || 'main', limit);
    const customers = await query.all();

    return new Response(JSON.stringify({
      period: period,
      customers: customers.results || []
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Top customers error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 6. STAFF ACTIVITY & ANALYTICS
// ======================================================================

/**
 * GET /api/staff/activity — Get staff activity log
 */
export async function handleStaffActivity(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    const query = await env.DB.prepare(`
      SELECT 
        a.*,
        u.name as staff_name,
        cs.ticket_number,
        cs.customer_name
      FROM staff_activity a
      LEFT JOIN users u ON a.staff_id = u.id
      LEFT JOIN charging_sessions cs ON a.session_id = cs.id
      WHERE a.staff_id = ? OR a.branch_id = ?
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(user.id, user.branch_id || user.branchId || 'main', limit, offset);
    const activities = await query.all();

    // Get activity summary
    const summaryQuery = await env.DB.prepare(`
      SELECT 
        action,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM staff_activity
      WHERE staff_id = ? AND created_at >= DATE('now', '-7 days')
      GROUP BY action, DATE(created_at)
      ORDER BY date DESC
    `).bind(user.id);
    const summary = await summaryQuery.all();

    return new Response(JSON.stringify({
      activities: activities.results || [],
      summary: summary.results || [],
      pagination: { limit, offset }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Staff activity error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * GET /api/staff/stats — Get staff performance stats
 */
export async function handleStaffStats(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'today'; // today, week, month

    let dateFilter = '';
    if (period === 'today') {
      dateFilter = "AND DATE(start_time) = DATE('now')";
    } else if (period === 'week') {
      dateFilter = "AND start_time >= DATE('now', '-7 days')";
    } else if (period === 'month') {
      dateFilter = "AND start_time >= DATE('now', 'start of month')";
    }

    // Staff stats
    const staffQuery = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_revenue,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN status = 'charging' THEN 1 END) as active_sessions,
        COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_sessions,
        AVG(estimated_minutes) as avg_charge_time,
        COALESCE(AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END), 0) as avg_revenue_per_session
      FROM charging_sessions
      WHERE staff_id = ? ${dateFilter}
    `).bind(user.id);
    const stats = await staffQuery.first();

    // Daily trend
    const trendQuery = await env.DB.prepare(`
      SELECT 
        DATE(start_time) as date,
        COUNT(*) as sessions,
        COALESCE(SUM(amount), 0) as revenue
      FROM charging_sessions
      WHERE staff_id = ? AND start_time >= DATE('now', '-7 days')
      GROUP BY DATE(start_time)
      ORDER BY date ASC
    `).bind(user.id);
    const trend = await trendQuery.all();

    // Device breakdown
    const deviceQuery = await env.DB.prepare(`
      SELECT 
        device_type,
        COUNT(*) as count,
        COALESCE(AVG(amount), 0) as avg_price
      FROM charging_sessions
      WHERE staff_id = ? ${dateFilter}
      GROUP BY device_type
      ORDER BY count DESC
    `).bind(user.id);
    const deviceBreakdown = await deviceQuery.all();

    return new Response(JSON.stringify({
      stats: stats || { total_sessions: 0, total_revenue: 0, completed_sessions: 0, active_sessions: 0, ready_sessions: 0, avg_charge_time: 0, avg_revenue_per_session: 0 },
      trend: trend.results || [],
      deviceBreakdown: deviceBreakdown.results || []
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Staff stats error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 7. STAFF ATTENDANCE — FIXED with enhanced resolveStaffId()
// ======================================================================

/**
 * POST /api/staff/attendance/clock-in — Clock in for shift
 * FIXED: Resolves users.id → staff.id for JWT mismatch
 * Checks direct ID, then falls back to email lookup
 * Handles both insert and update for existing records
 */
export async function handleClockIn(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    // Resolve staff ID from users table
    let staffId = user.id;
    
    // Check if this ID exists in staff table
    const staffExists = await env.DB.prepare(
      "SELECT id FROM staff WHERE id = ?"
    ).bind(user.id).first();
    
    if (!staffExists) {
      // Look up by email
      const userRecord = await env.DB.prepare(
        "SELECT email FROM users WHERE id = ?"
      ).bind(user.id).first();
      
      if (userRecord) {
        const staffRecord = await env.DB.prepare(
          "SELECT id FROM staff WHERE email = ?"
        ).bind(userRecord.email).first();
        
        if (staffRecord) {
          staffId = staffRecord.id;
        } else {
          return new Response(JSON.stringify({ 
            error: "Staff record not found. Please contact admin." 
          }), {
            status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Check if already clocked in
    const existing = await env.DB.prepare(
      "SELECT * FROM staff_attendance WHERE staff_id = ? AND date = ?"
    ).bind(staffId, today).first();
    
    if (existing?.clock_in) {
      return new Response(JSON.stringify({ 
        error: "Already clocked in today",
        attendance: existing
      }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const now = new Date().toISOString();
    
    // Calculate lateness
    const shiftStart = "08:00"; // Default, could be from staff record
    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes();
    let lateMinutes = 0;
    
    const [startHour, startMinute] = shiftStart.split(':').map(Number);
    if (currentHour > startHour || (currentHour === startHour && currentMinute > startMinute)) {
      lateMinutes = (currentHour - startHour) * 60 + (currentMinute - startMinute);
    }
    
    const status = lateMinutes > 15 ? 'late' : 'present';
    
    if (existing) {
      // Update existing record
      await env.DB.prepare(
        "UPDATE staff_attendance SET clock_in = ?, status = ?, late_minutes = ? WHERE id = ?"
      ).bind(now, status, lateMinutes, existing.id).run();
    } else {
      // Create new record
      await env.DB.prepare(
        "INSERT INTO staff_attendance (id, staff_id, date, clock_in, status, late_minutes, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).bind(crypto.randomUUID(), staffId, today, now, status, lateMinutes).run();
    }
    
    // Update attendance streak
    await env.DB.prepare(
      "UPDATE staff SET attendance_streak = COALESCE(attendance_streak, 0) + 1 WHERE id = ?"
    ).bind(staffId).run().catch(() => {});
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Clocked in successfully",
      time: now,
      status: status,
      lateMinutes: lateMinutes
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (e) {
    console.error('Clock-in error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * POST /api/staff/attendance/clock-out — Clock out
 * FIXED: Uses resolveStaffId() to handle users.id vs staff.id mismatch
 */
export async function handleClockOut(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    // FIX: Resolve the correct staff_id
    let staffId = user.id;
    
    // Check if this ID exists in staff table
    const staffExists = await env.DB.prepare(
      "SELECT id FROM staff WHERE id = ?"
    ).bind(user.id).first();
    
    if (!staffExists) {
      // Look up by email
      const userRecord = await env.DB.prepare(
        "SELECT email FROM users WHERE id = ?"
      ).bind(user.id).first();
      
      if (userRecord) {
        const staffRecord = await env.DB.prepare(
          "SELECT id FROM staff WHERE email = ?"
        ).bind(userRecord.email).first();
        
        if (staffRecord) {
          staffId = staffRecord.id;
        } else {
          return new Response(JSON.stringify({ 
            error: "Staff record not found. Please contact admin." 
          }), {
            status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }
    }
    
    // FIX: Use resolved staffId for lookup
    const existing = await env.DB.prepare(
      "SELECT * FROM staff_attendance WHERE staff_id = ? AND date = ?"
    ).bind(staffId, today).first();
    
    if (!existing?.clock_in) {
      return new Response(JSON.stringify({ error: "Not clocked in today" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    if (existing.clock_out) {
      return new Response(JSON.stringify({ error: "Already clocked out" }), {
        status: 409, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    // Calculate overtime
    const clockInTime = new Date(existing.clock_in);
    const hoursWorked = (Date.now() - clockInTime.getTime()) / (1000 * 60 * 60);
    const overtimeMinutes = hoursWorked > 8 ? Math.round((hoursWorked - 8) * 60) : 0;
    
    await env.DB.prepare(`
      UPDATE staff_attendance 
      SET clock_out = ?, overtime_minutes = ?
      WHERE id = ?
    `).bind(now, overtimeMinutes, existing.id).run();
    
    return new Response(JSON.stringify({
      success: true,
      clockOut: now,
      hoursWorked: Math.round(hoursWorked * 10) / 10,
      overtimeMinutes
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
// EXPORTS
// ======================================================================

export default {
  handleStaffMe,
  handleStaffDashboard,
  handleStaffLocation,
  handleStaffCapture,
  handleStartSession,
  handleCollectSession,
  handlePauseSession,
  handleResumeSession,
  handleGetBays,
  handleAssignBay,
  handleReleaseBay,
  handleGetCustomer,
  handleTopCustomers,
  handleStaffActivity,
  handleStaffStats,
  handleClockIn,
  handleClockOut
};
