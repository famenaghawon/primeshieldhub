// ======================================================================
// CHARGING SESSION HANDLERS — COMPLETE FINAL PRODUCTION VERSION
// Full charging session management with AI estimates, bays, loyalty,
// receipt generation via email/SMS, and enhanced device ready notifications
// ======================================================================

import { requireAuth } from '../middleware/auth.js';
import { logEvent, logAudit } from '../utils/logging.js';
import { 
  validateString, validatePhone, validateEmail, validateAmount, 
  validateUUID, validateBranchId 
} from '../utils/validation.js';
import { CABLE_TYPES } from '../utils/constants.js';
import { getCorsHeaders } from '../middleware/cors.js';
import { nanoid } from 'nanoid';

// ===== NOTIFICATION IMPORTS =====
import { notifyUser, notifyDeviceReady, notifyClosingReminder, notifyUrgentClosing } from '../../notifications.js';
import { sendSMSReceipt } from './receipt-helpers.js';
// =================================

// ======================================================================
// UTILITY HELPERS
// ======================================================================

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
 * Calculate AI-powered charging estimate
 */
function calculateEstimate(deviceType, batteryStart = 0, historicalAvg = null) {
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
  
  minutes = Math.min(minutes, estimate.max);
  
  if (historicalAvg) {
    minutes = Math.round(minutes * 0.7 + historicalAvg * 0.3);
  }
  
  return Math.max(estimate.base, Math.round(minutes));
}

/**
 * Calculate dynamic pricing
 */
function calculatePrice(deviceType, customerVisits = 0, currentLoad = 0, maxCapacity = 10) {
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
  const loadPercentage = maxCapacity > 0 ? currentLoad / maxCapacity : 0;
  if (loadPercentage > 0.8) {
    basePrice = Math.round(basePrice * 1.5);
  }
  
  // Loyalty discount for customers with >10 visits
  if (customerVisits >= 10) {
    basePrice = Math.round(basePrice * 0.9);
  }
  
  // Special handling fee
  if (deviceType === 'special') {
    basePrice = 1000;
  }
  
  return basePrice;
}

/**
 * Get customer visit count for loyalty
 */
async function getCustomerVisits(env, phone) {
  if (!phone) return 0;
  try {
    const query = await env.DB.prepare(`
      SELECT COUNT(*) as visits
      FROM charging_sessions
      WHERE customer_phone = ? AND status = 'completed'
    `).bind(phone);
    const result = await query.first();
    return result?.visits || 0;
  } catch (e) {
    console.error('Customer visits error:', e);
    return 0;
  }
}

/**
 * Get current load for surge pricing
 */
async function getCurrentLoad(env, branchId) {
  try {
    const query = await env.DB.prepare(`
      SELECT COUNT(*) as active
      FROM charging_sessions
      WHERE branch_id = ? AND status IN ('charging', 'paused')
    `).bind(branchId);
    const result = await query.first();
    return result?.active || 0;
  } catch (e) {
    console.error('Current load error:', e);
    return 0;
  }
}

/**
 * Get available bay
 */
async function getAvailableBay(env, branchId) {
  try {
    const query = await env.DB.prepare(`
      SELECT id, name, cable_type, power_delivery
      FROM bays
      WHERE branch_id = ? AND occupied = 0
      ORDER BY id ASC
      LIMIT 1
    `).bind(branchId);
    return await query.first();
  } catch (e) {
    console.error('Get available bay error:', e);
    return null;
  }
}

/**
 * Assign session to bay
 */
async function assignBay(env, bayId, sessionId) {
  try {
    await env.DB.prepare(`
      UPDATE bays 
      SET occupied = 1, session_id = ?, occupied_at = datetime('now')
      WHERE id = ?
    `).bind(sessionId, bayId).run();
    
    await env.DB.prepare(`
      UPDATE charging_sessions 
      SET bay_id = ?, bay_name = (SELECT name FROM bays WHERE id = ?)
      WHERE id = ?
    `).bind(bayId, bayId, sessionId).run();
    
    return true;
  } catch (e) {
    console.error('Assign bay error:', e);
    return false;
  }
}

/**
 * Safe notification sender - guards against missing ctx.waitUntil
 */
async function safeNotify(promise, ctx) {
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(promise);
  } else {
    // Fallback: fire and forget
    promise.catch(err => console.error('Notification error:', err));
  }
}

// ======================================================================
// 1. START CHARGING SESSION — COMPLETE FINAL PRODUCTION FIX
// ======================================================================

/**
 * Handle start charging session
 * POST /api/charging/start
 */
export async function handleChargingStart(request, env, ctx, corsHeaders, ip, fingerprint) {
  // ✅ FIXED: Removed ctx parameter from requireAuth
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    
    // Validate required fields
    const name = validateString(body.name, 100);
    const deviceType = validateString(body.deviceType, 50) || 'default';
    const deviceModel = validateString(body.deviceModel, 100) || null;
    const amount = body.amount ? validateAmount(body.amount) : null;
    const staff = validateString(body.staff, 100) || user.id;
    const branchId = body.branchId ? validateString(body.branchId, 100) : user.branch_id || 'main';
    const batteryStart = typeof body.batteryStart === 'number' ? Math.min(100, Math.max(0, body.batteryStart)) : 0;
    const cableType = CABLE_TYPES.includes(body.cableType) ? body.cableType : 'USB-C';
    const customerPhone = body.customerPhone ? validatePhone(body.customerPhone) : null;
    const customerEmail = body.customerEmail ? validateEmail(body.customerEmail) : null;
    const notes = body.notes ? validateString(body.notes, 500) : null;
    const specialHandling = body.specialHandling === true;

    if (!name || !deviceType) {
      return new Response(JSON.stringify({ error: "Customer name and device type required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check if customer has active session
    if (customerPhone) {
      const activeCheck = await env.DB.prepare(`
        SELECT id, ticket_number FROM charging_sessions
        WHERE customer_phone = ? AND branch_id = ? AND status IN ('charging', 'paused', 'ready')
      `).bind(customerPhone, branchId);
      const activeSession = await activeCheck.first();
      
      if (activeSession) {
        return new Response(JSON.stringify({ 
          error: `Customer already has active session: ${activeSession.ticket_number}` 
        }), {
          status: 409, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // Get customer visits for loyalty
    const customerVisits = await getCustomerVisits(env, customerPhone);
    
    // Get current load for surge pricing
    const currentLoad = await getCurrentLoad(env, branchId);
    const totalBays = 10; // Configurable
    const loadPercentage = totalBays > 0 ? currentLoad / totalBays : 0;

    // Calculate price and estimate - ensure proper types
    const finalAmount = amount !== null ? parseFloat(amount) : calculatePrice(deviceType, customerVisits, loadPercentage, totalBays);
    const estimate = calculateEstimate(deviceType, batteryStart);
    
    // Generate ticket number using counter
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
    
    // Use INTEGER ID since table schema shows id is INTEGER
    const id = Date.now() + Math.floor(Math.random() * 1000);
    
    // Convert all values to correct types
    const amountValue = typeof finalAmount === 'number' ? finalAmount : parseFloat(finalAmount) || 0;
    const estimatedMinutesValue = typeof estimate === 'number' ? estimate : parseInt(estimate) || 60;
    const batteryStartValue = typeof batteryStart === 'number' ? batteryStart : parseInt(batteryStart) || 0;
    const staffValue = staff ? String(staff) : null;
    const branchIdValue = branchId ? String(branchId) : 'main';
    const phoneValue = customerPhone ? String(customerPhone) : null;
    const emailValue = customerEmail ? String(customerEmail) : null;
    const modelValue = deviceModel ? String(deviceModel) : null;
    const notesValue = notes ? String(notes) : null;
    const specialHandlingValue = specialHandling ? 1 : 0;
    const cableTypeValue = cableType || 'USB-C';
    const deviceTypeValue = deviceType || 'default';
    const nameValue = name || 'Customer';
    const staffNameValue = user?.name || 'Staff';

    // Calculate estimated completion time manually
    const now = new Date();
    const estimatedCompletionTime = new Date(now.getTime() + estimatedMinutesValue * 60000);
    const estimatedCompletionStr = estimatedCompletionTime.toISOString().replace('T', ' ').slice(0, 19);

    // INSERT with corrected SQL
    await env.DB.prepare(`
      INSERT INTO charging_sessions (
        id,
        customer_name,
        device_type,
        amount,
        staff,
        branch_id,
        customer_phone,
        customer_email,
        device_model,
        ticket_number,
        status,
        start_time,
        estimated_minutes,
        estimated_completion,
        battery_start,
        cable_type,
        notes,
        special_handling,
        staff_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      Number(id),
      String(nameValue),
      String(deviceTypeValue),
      Number(amountValue) || 0,
      staffValue,
      String(branchIdValue),
      phoneValue,
      emailValue,
      modelValue,
      String(ticketNumber),
      String('charging'),
      Number(estimatedMinutesValue) || 60,
      estimatedCompletionStr,
      Number(batteryStartValue) || 0,
      String(cableTypeValue),
      notesValue,
      Number(specialHandlingValue) || 0,
      String(staffNameValue)
    ).run();

    // Assign bay if available
    const bay = await getAvailableBay(env, branchIdValue);
    let bayAssigned = false;
    if (bay) {
      bayAssigned = await assignBay(env, bay.id, String(id));
    }

    // Record in customer history
    if (customerPhone) {
      await env.DB.prepare(`
        INSERT INTO customer_history (id, customer_phone, customer_name, device_type, amount, session_id, date)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(nanoid(), phoneValue, nameValue, deviceTypeValue, amountValue, String(id)).run();
    }

    // Send notification if contact info provided (SAFE - guarded)
    if (customerEmail || customerPhone) {
      await safeNotify(
        notifyUser({
          email: customerEmail,
          phone: customerPhone,
          name: nameValue,
          ticketNumber: ticketNumber,
          deviceType: deviceTypeValue,
          amount: amountValue,
          estimate: estimatedMinutesValue,
          type: 'session_started'
        }, env),
        ctx
      );
    }

    await logEvent(env, "CHARGE_START", `Session ${ticketNumber} started for ${nameValue}`, user.id, {
      amount: amountValue, deviceType: deviceTypeValue, estimate: estimatedMinutesValue
    });
    
    await logAudit(env, "CHARGE_START", user.id, "charging_session", String(id), {
      name: nameValue, deviceType: deviceTypeValue, amount: amountValue, ticketNumber
    }, ip, fingerprint);

    return new Response(JSON.stringify({
      success: true,
      sessionId: String(id),
      ticketNumber: ticketNumber,
      estimatedMinutes: estimatedMinutesValue,
      estimatedCompletion: estimatedCompletionStr,
      amount: amountValue,
      bayAssigned: bayAssigned,
      bayName: bay?.name || null,
      loyaltyDiscount: customerVisits >= 10,
      surgePricing: loadPercentage > 0.8
    }), {
      status: 201, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Start charging error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 2. GET CHARGING SESSIONS
// ======================================================================

/**
 * Handle get charging timer (active sessions)
 * GET /api/charging/timer
 */
export async function handleChargingTimer(request, env, ctx, corsHeaders) {
  // ✅ FIXED: Removed ctx parameter from requireAuth
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const branchId = request.headers.get("x-branch-id") || user.branch_id || 'main';
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'active';
    
    let query = `
      SELECT 
        cs.*,
        u.name as staff_name,
        b.name as branch_name
      FROM charging_sessions cs
      LEFT JOIN users u ON cs.staff = u.id
      LEFT JOIN branches b ON cs.branch_id = b.id
      WHERE cs.branch_id = ?
    `;
    let params = [branchId];
    
    if (status === 'active') {
      query += " AND cs.status IN ('charging', 'paused', 'ready')";
    } else if (status === 'all') {
      // All sessions
    } else if (status === 'completed') {
      query += " AND cs.status = 'completed'";
    } else if (status === 'charging') {
      query += " AND cs.status = 'charging'";
    } else if (status === 'ready') {
      query += " AND cs.status = 'ready'";
    } else if (status === 'overnight') {
      query += " AND cs.status = 'overnight'";
    }
    
    query += " ORDER BY cs.start_time DESC LIMIT 100";

    const timerQuery = await env.DB.prepare(query).bind(...params);
    const timerResult = await timerQuery.all();

    const sessions = (timerResult.results || []).map(s => {
      const startTime = new Date(s.start_time);
      const now = new Date();
      const minutes = Math.floor((now - startTime) / 60000);
      
      return {
        id: s.id,
        ticket_number: s.ticket_number,
        customer_name: s.customer_name,
        customer_phone: s.customer_phone,
        customer_email: s.customer_email,
        device_type: s.device_type,
        device_model: s.device_model,
        battery_start: s.battery_start,
        cable_type: s.cable_type,
        amount: s.amount,
        status: s.status,
        start_time: s.start_time,
        estimated_completion: s.estimated_completion,
        estimated_minutes: s.estimated_minutes,
        minutes: minutes,
        staff: s.staff,
        staff_name: s.staff_name,
        branch_id: s.branch_id,
        branch_name: s.branch_name,
        bay_id: s.bay_id,
        bay_name: s.bay_name,
        special_handling: s.special_handling === 1,
        notified_ready: s.notified_ready === 1,
        notified_closing: s.notified_closing === 1,
        notified_overnight: s.notified_overnight === 1,
        notes: s.notes,
        completed_time: s.completed_time,
        paused_at: s.paused_at,
        resumed_at: s.resumed_at
      };
    });

    return new Response(JSON.stringify(sessions), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Get charging timer error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * Get single session details
 * GET /api/charging/session/:id
 */
export async function handleGetSession(request, env, ctx, corsHeaders) {
  // ✅ FIXED: Removed ctx parameter from requireAuth
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const sessionId = url.pathname.split('/').pop();
    
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const query = await env.DB.prepare(`
      SELECT 
        cs.*,
        u.name as staff_name,
        b.name as branch_name,
        bay.name as bay_name_full
      FROM charging_sessions cs
      LEFT JOIN users u ON cs.staff = u.id
      LEFT JOIN branches b ON cs.branch_id = b.id
      LEFT JOIN bays bay ON cs.bay_id = bay.id
      WHERE cs.id = ? AND (cs.branch_id = ? OR cs.staff = ?)
    `).bind(sessionId, user.branch_id || 'main', user.id);
    
    const result = await query.first();
    
    if (!result) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ success: true, session: result }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Get session error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 3. PAUSE CHARGING SESSION
// ======================================================================

/**
 * Handle pause charging session
 * POST /api/charging/pause
 */
export async function handleChargingPause(request, env, ctx, corsHeaders, ip, fingerprint) {
  // ✅ FIXED: Removed ctx parameter from requireAuth
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const sessionId = body.sessionId;
    const reason = validateString(body.reason, 200) || 'Manually paused';
    
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check session exists and is charging
    const checkQuery = await env.DB.prepare(`
      SELECT id, ticket_number, status FROM charging_sessions 
      WHERE id = ? AND (branch_id = ? OR staff = ?) AND status = 'charging'
    `).bind(sessionId, user.branch_id || 'main', user.id);
    const session = await checkQuery.first();
    
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found or not charging" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await env.DB.prepare(`
      UPDATE charging_sessions 
      SET status = 'paused', paused_at = datetime('now'), pause_reason = ?
      WHERE id = ?
    `).bind(reason, sessionId).run();
    
    await logEvent(env, "CHARGE_PAUSE", `Session ${session.ticket_number} paused`, user.id, { 
      sessionId: sessionId, reason 
    });
    await logAudit(env, "CHARGE_PAUSE", user.id, "charging_session", sessionId, {
      reason
    }, ip, fingerprint);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Session paused',
      sessionId: sessionId,
      pausedAt: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Pause session error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 4. RESUME CHARGING SESSION
// ======================================================================

/**
 * Handle resume charging session
 * POST /api/charging/resume
 */
export async function handleChargingResume(request, env, ctx, corsHeaders, ip, fingerprint) {
  // ✅ FIXED: Removed ctx parameter from requireAuth
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const sessionId = body.sessionId;
    
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check session exists and is paused
    const checkQuery = await env.DB.prepare(`
      SELECT id, ticket_number, status FROM charging_sessions 
      WHERE id = ? AND (branch_id = ? OR staff = ?) AND status = 'paused'
    `).bind(sessionId, user.branch_id || 'main', user.id);
    const session = await checkQuery.first();
    
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found or not paused" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await env.DB.prepare(`
      UPDATE charging_sessions 
      SET status = 'charging', resumed_at = datetime('now')
      WHERE id = ?
    `).bind(sessionId).run();
    
    await logEvent(env, "CHARGE_RESUME", `Session ${session.ticket_number} resumed`, user.id, { 
      sessionId: sessionId 
    });
    await logAudit(env, "CHARGE_RESUME", user.id, "charging_session", sessionId, {}, ip, fingerprint);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Session resumed',
      sessionId: sessionId,
      resumedAt: new Date().toISOString()
    }), {
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
// 5. COMPLETE CHARGING SESSION — WITH RECEIPT VIA EMAIL & SMS
// ======================================================================

/**
 * Handle complete charging session
 * POST /api/charging/complete
 */
export async function handleChargingComplete(request, env, ctx, corsHeaders, ip, fingerprint) {
  // ✅ FIXED: Removed ctx parameter from requireAuth
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const sessionId = body.sessionId;
    const validAmount = validateAmount(body.amount);
    const paymentMethod = validateString(body.paymentMethod, 50) || 'cash';
    const notes = validateString(body.notes, 500) || '';

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    if (validAmount === null) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check session exists and is ready or charging
    const checkQuery = await env.DB.prepare(`
      SELECT id, ticket_number, customer_name, customer_phone, customer_email, 
             amount, status, device_type, start_time, branch_id
      FROM charging_sessions 
      WHERE id = ? AND (branch_id = ? OR staff = ?) AND status IN ('charging', 'ready')
    `).bind(sessionId, user.branch_id || 'main', user.id);
    const session = await checkQuery.first();
    
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found or already completed" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Update session
    await env.DB.prepare(`
      UPDATE charging_sessions 
      SET status = 'completed', 
          completed_time = datetime('now'), 
          amount = ?,
          payment_method = ?,
          completed_by = ?,
          completion_notes = ?
      WHERE id = ?
    `).bind(validAmount, paymentMethod, user.id, notes, sessionId).run();

    // Release bay
    await env.DB.prepare(`
      UPDATE bays
      SET occupied = 0, session_id = NULL, occupied_at = NULL
      WHERE session_id = ?
    `).bind(sessionId).run();

    // Record transaction
    const transactionId = nanoid();
    await env.DB.prepare(`
      INSERT INTO transactions (
        id, session_id, branch_id, amount, payment_method, 
        staff_id, customer_phone, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', datetime('now'))
    `).bind(
      transactionId, 
      sessionId, 
      user.branch_id || 'main', 
      validAmount, 
      paymentMethod, 
      user.id, 
      session.customer_phone
    ).run();

    // Update staff metrics
    await env.DB.prepare(`
      UPDATE users 
      SET points = COALESCE(points, 0) + 10,
          total_revenue = COALESCE(total_revenue, 0) + ?,
          total_sessions = COALESCE(total_sessions, 0) + 1
      WHERE id = ?
    `).bind(validAmount, user.id).run();

    // Check loyalty milestone
    let loyaltyMessage = null;
    if (session.customer_phone) {
      const visitQuery = await env.DB.prepare(`
        SELECT COUNT(*) as visits
        FROM charging_sessions
        WHERE customer_phone = ? AND status = 'completed'
      `).bind(session.customer_phone);
      const visits = await visitQuery.first();
      
      if (visits && visits.visits % 10 === 0) {
        loyaltyMessage = `🎉 Congratulations! This is your ${visits.visits}th visit. You've earned a FREE charge!`;
      }
    }

    // ===== SEND RECEIPT VIA EMAIL & SMS =====
    const durationMin = Math.floor((Date.now() - new Date(session.start_time).getTime()) / 60000);
    const durationStr = durationMin < 60 ? `${durationMin} min` : `${Math.floor(durationMin/60)}h ${durationMin%60}m`;
    
    const receiptData = {
      reference: session.ticket_number,
      amount: validAmount,
      customer_name: session.customer_name,
      phone: session.customer_phone,
      email: session.customer_email,
      date: new Date().toISOString(),
      payment_method: paymentMethod,
      type: 'charging',
      ticket_number: session.ticket_number,
      device_type: session.device_type,
      duration: durationStr
    };

    // Send email receipt via Resend
    if (session.customer_email && env.RESEND_API_KEY) {
      ctx.waitUntil(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'PrimeShieldHub <receipts@primeshieldhub.com>',
            to: [session.customer_email],
            subject: `🧾 Charging Receipt - ${session.ticket_number}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#fff;border-radius:12px;border:1px solid #eee;">
                <div style="text-align:center;padding:20px;background:#12122a;border-radius:8px;margin-bottom:20px;">
                  <h2 style="color:#d6b25e;margin:0;">PRIMESHIELDHUB</h2>
                  <p style="color:#888;font-size:12px;">Charging Service Receipt</p>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:8px;color:#666;">Ticket</td><td style="padding:8px;font-weight:bold;">${session.ticket_number}</td></tr>
                  <tr><td style="padding:8px;color:#666;">Customer</td><td style="padding:8px;">${session.customer_name}</td></tr>
                  <tr><td style="padding:8px;color:#666;">Device</td><td style="padding:8px;">${session.device_type || 'Device'}</td></tr>
                  <tr><td style="padding:8px;color:#666;">Duration</td><td style="padding:8px;">${durationStr}</td></tr>
                  <tr><td style="padding:8px;color:#666;">Amount</td><td style="padding:8px;font-weight:bold;color:#33ffaa;">₦${validAmount.toLocaleString()}</td></tr>
                  <tr><td style="padding:8px;color:#666;">Method</td><td style="padding:8px;">${paymentMethod.toUpperCase()}</td></tr>
                  <tr><td style="padding:8px;color:#666;">Date</td><td style="padding:8px;">${new Date().toLocaleString()}</td></tr>
                </table>
                <div style="text-align:center;padding:16px;background:#f8f8f8;border-radius:8px;margin-top:16px;">
                  <p style="font-size:12px;color:#888;">Thank you for choosing PrimeShieldHub!</p>
                  <p style="font-size:11px;color:#aaa;">108 Newton Street, Benin City</p>
                </div>
              </div>`
          })
        }).catch(e => console.error('Receipt email failed:', e))
      );
    }

    // Send SMS receipt via Twilio using existing helper
    if (session.customer_phone) {
      ctx.waitUntil(
        sendSMSReceipt(env, receiptData).catch(e => console.error('SMS receipt failed:', e))
      );
    }

    await logEvent(env, "CHARGE_COMPLETE", `Session ${session.ticket_number} completed - ₦${validAmount}`, user.id, {
      sessionId, amount: validAmount, paymentMethod, receiptSent: !!(session.customer_email || session.customer_phone)
    });
    
    await logAudit(env, "CHARGE_COMPLETE", user.id, "charging_session", sessionId, {
      amount: validAmount, 
      paymentMethod,
      previousAmount: session.amount,
      receiptSent: !!(session.customer_email || session.customer_phone)
    }, ip, fingerprint);

    return new Response(JSON.stringify({
      success: true,
      message: 'Payment collected successfully',
      sessionId: sessionId,
      ticketNumber: session.ticket_number,
      amount: validAmount,
      transactionId: transactionId,
      loyaltyMessage: loyaltyMessage,
      customerName: session.customer_name,
      receiptSent: !!(session.customer_email || session.customer_phone)
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Complete session error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 6. MARK SESSION AS READY — WITH ENHANCED DEVICE READY NOTIFICATIONS
// ======================================================================

/**
 * Handle mark session as ready
 * POST /api/charging/ready
 */
export async function handleMarkReady(request, env, ctx, corsHeaders, ip, fingerprint) {
  // ✅ FIXED: Removed ctx parameter from requireAuth
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const body = await request.json();
    const sessionId = body.sessionId;
    
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check session exists and is charging
    const checkQuery = await env.DB.prepare(`
      SELECT id, ticket_number, customer_name, customer_email, customer_phone, 
             device_type, start_time, amount, branch_id
      FROM charging_sessions 
      WHERE id = ? AND (branch_id = ? OR staff = ?) AND status = 'charging'
    `).bind(sessionId, user.branch_id || 'main', user.id);
    const session = await checkQuery.first();
    
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found or not charging" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await env.DB.prepare(`
      UPDATE charging_sessions 
      SET status = 'ready', ready_at = datetime('now'), notified_ready = 1
      WHERE id = ?
    `).bind(sessionId).run();

    // ===== SEND DEVICE READY NOTIFICATIONS =====
    if (session.customer_email && env.RESEND_API_KEY) {
      ctx.waitUntil(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'PrimeShieldHub <alerts@primeshieldhub.com>',
            to: [session.customer_email],
            subject: `✅ Your Device is Ready - ${session.ticket_number}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#fff;border-radius:12px;">
                <h2 style="color:#33ffaa;">✅ Device Fully Charged!</h2>
                <p><strong>Ticket:</strong> ${session.ticket_number}</p>
                <p><strong>Device:</strong> ${session.device_type || 'Device'}</p>
                <p>📍 Pickup at PrimeShieldHub, 108 Newton Street, Benin City</p>
                <p>⏰ We close at 9 PM today</p>
                <p style="font-size:14px;color:#888;">Please bring your ticket number.</p>
              </div>`
          })
        }).catch(e => console.error('Ready email failed:', e))
      );
    }

    if (session.customer_phone && env.TWILIO_ACCOUNT_SID && env.TWILIO_SMS_NUMBER) {
      ctx.waitUntil(
        (async () => {
          try {
            const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
            await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
              method: 'POST',
              headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                To: session.customer_phone,
                From: env.TWILIO_SMS_NUMBER,
                Body: `✅ Device Ready!\nTicket: ${session.ticket_number}\nPickup: PrimeShieldHub, 108 Newton St, Benin City\nCloses 9 PM`
              })
            });
          } catch (e) { console.error('Ready SMS failed:', e); }
        })()
      );
    }

    await logEvent(env, "CHARGE_READY", `Session ${session.ticket_number} ready for pickup`, user.id, {
      sessionId: sessionId,
      notifiedEmail: !!(session.customer_email && env.RESEND_API_KEY),
      notifiedSMS: !!(session.customer_phone && env.TWILIO_ACCOUNT_SID)
    });
    
    await logAudit(env, "CHARGE_READY", user.id, "charging_session", sessionId, {
      notifiedEmail: !!(session.customer_email && env.RESEND_API_KEY),
      notifiedSMS: !!(session.customer_phone && env.TWILIO_ACCOUNT_SID)
    }, ip, fingerprint);

    return new Response(JSON.stringify({
      success: true,
      message: 'Session marked as ready',
      sessionId: sessionId,
      ticketNumber: session.ticket_number,
      customerNotified: !!(session.customer_email || session.customer_phone)
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Mark ready error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 7. CHARGING STATS — FIXED CORS
// ======================================================================

/**
 * Handle charging stats
 * GET /api/charging/stats
 */
export async function handleChargingStats(request, env, ctx, corsHeaders) {
  // ✅ FIXED: Removed ctx parameter from requireAuth
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders }  // ✅ Include corsHeaders
    });
  }
  
  try {
    const branchId = request.headers.get("x-branch-id") || user.branch_id || 'main';
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'today';

    let dateFilter = '';
    if (period === 'today') {
      dateFilter = "AND DATE(start_time) = DATE('now')";
    } else if (period === 'week') {
      dateFilter = "AND start_time >= DATE('now', '-7 days')";
    } else if (period === 'month') {
      dateFilter = "AND start_time >= DATE('now', 'start of month')";
    }

    // Overall stats
    const statsQuery = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status IN ('charging', 'paused') THEN 1 END) as active_sessions,
        COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN status = 'overnight' THEN 1 END) as overnight_sessions,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_revenue,
        COALESCE(AVG(amount), 0) as avg_amount
      FROM charging_sessions
      WHERE branch_id = ? ${dateFilter}
    `).bind(branchId);
    const stats = await statsQuery.first();

    // Device breakdown
    const deviceQuery = await env.DB.prepare(`
      SELECT 
        device_type,
        COUNT(*) as count,
        COALESCE(AVG(amount), 0) as avg_price,
        COALESCE(AVG(estimated_minutes), 0) as avg_time
      FROM charging_sessions
      WHERE branch_id = ? ${dateFilter}
      GROUP BY device_type
      ORDER BY count DESC
    `).bind(branchId);
    const deviceBreakdown = await deviceQuery.all();

    // Daily trend
    const trendQuery = await env.DB.prepare(`
      SELECT 
        DATE(start_time) as date,
        COUNT(*) as sessions,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as revenue
      FROM charging_sessions
      WHERE branch_id = ? AND start_time >= DATE('now', '-7 days')
      GROUP BY DATE(start_time)
      ORDER BY date ASC
    `).bind(branchId);
    const trend = await trendQuery.all();

    // Staff performance
    const staffQuery = await env.DB.prepare(`
      SELECT 
        u.name as staff_name,
        COUNT(*) as sessions,
        COALESCE(SUM(amount), 0) as revenue,
        COALESCE(AVG(amount), 0) as avg_revenue
      FROM charging_sessions cs
      LEFT JOIN users u ON cs.staff = u.id
      WHERE cs.branch_id = ? ${dateFilter}
      GROUP BY cs.staff
      ORDER BY revenue DESC
      LIMIT 10
    `).bind(branchId);
    const staffPerformance = await staffQuery.all();

    return new Response(JSON.stringify({
      success: true,
      stats: stats || { total_sessions: 0, active_sessions: 0, ready_sessions: 0, completed_sessions: 0, overnight_sessions: 0, total_revenue: 0, avg_amount: 0 },
      deviceBreakdown: deviceBreakdown.results || [],
      trend: trend.results || [],
      staffPerformance: staffPerformance.results || []
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Charging stats error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }  // ✅ Include corsHeaders
    });
  }
}

// ======================================================================
// 8. BAY MANAGEMENT
// ======================================================================

/**
 * Handle get bays
 * GET /api/charging/bays
 */
export async function handleGetBays(request, env, ctx, corsHeaders) {
  // ✅ FIXED: Removed ctx parameter from requireAuth
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const branchId = request.headers.get("x-branch-id") || user.branch_id || 'main';

    const query = `
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
      LEFT JOIN users u ON cs.staff = u.id
      WHERE b.branch_id = ?
      ORDER BY b.id ASC
    `;

    const baysQuery = await env.DB.prepare(query).bind(branchId);
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
      success: true,
      bays: bays.results || [],
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
