// ======================================================================
// SECURITY ADMIN HANDLERS
// Added: theft-check, blocked-attempts, fraud-score, block-ip
// ======================================================================

import { requireAuth } from '../middleware/auth.js';
import { logEvent, logAudit } from '../utils/logging.js';
import { getCorsHeaders } from '../middleware/cors.js';
import { nanoid } from 'nanoid';

/**
 * Get theft detection scan results
 * GET /api/security/theft-check
 */
async function handleTheftCheck(request, env, corsHeaders) {
  try {
    const user = await requireAuth(request, env, ["admin", "staff"]);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Query suspicious sessions from charging_sessions
    const suspicious = await env.DB.prepare(`
      SELECT 
        cs.*,
        s.name as staff_name,
        b.name as branch_name
      FROM charging_sessions cs
      LEFT JOIN staff s ON cs.staff = s.id
      LEFT JOIN branches b ON s.branch_id = b.id
      WHERE 
        (strftime('%H', cs.start_time) BETWEEN '00' AND '05') OR
        (cs.status = 'abandoned' AND (cs.amount = 0 OR cs.amount IS NULL)) OR
        (cs.customer_phone IS NULL AND cs.customer_email IS NULL) OR
        (cs.amount > 10000 AND cs.status != 'completed')
      ORDER BY cs.start_time DESC
      LIMIT 50
    `).all();

    const sessions = suspicious.results || [];

    const enriched = sessions.map(s => ({
      id: s.id,
      sessionId: s.id,
      customerName: s.customer_name || 'Unknown',
      customerPhone: s.customer_phone || null,
      customerEmail: s.customer_email || null,
      deviceType: s.device_type || 'unknown',
      amount: s.amount || 0,
      status: s.status || 'unknown',
      staffId: s.staff,
      staffName: s.staff_name || 'Unknown',
      branchId: s.branch_id,
      branchName: s.branch_name || 'Unknown',
      startTime: s.start_time,
      completedTime: s.completed_time,
      suspiciousReason: getSuspiciousReason(s),
      riskScore: calculateRiskScore(s)
    }));

    await logEvent(env, "THEFT_SCAN", `Theft scan performed by ${user.id}`, user.id);
    await logAudit(env, "THEFT_SCAN", user.id, "admin", user.id, {
      count: enriched.length,
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      count: enriched.length,
      sessions: enriched,
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Theft check error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to scan for theft'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

function getSuspiciousReason(session) {
  const reasons = [];
  
  if (session.customer_phone === null && session.customer_email === null) {
    reasons.push('No contact information');
  }
  
  if (session.start_time) {
    const hour = new Date(session.start_time).getHours();
    if (hour >= 0 && hour < 5) {
      reasons.push('Unusual hour (midnight-5am)');
    }
  }
  
  if (session.status === 'abandoned' && (session.amount === 0 || session.amount === null)) {
    reasons.push('Abandoned without payment');
  }
  
  if (session.amount > 10000 && session.status !== 'completed') {
    reasons.push('High value incomplete session');
  }
  
  return reasons.length > 0 ? reasons.join(', ') : 'Potential suspicious activity';
}

function calculateRiskScore(session) {
  let score = 0;
  
  if (session.customer_phone === null && session.customer_email === null) score += 30;
  
  if (session.start_time) {
    const hour = new Date(session.start_time).getHours();
    if (hour >= 0 && hour < 5) score += 25;
  }
  
  if (session.status === 'abandoned') score += 20;
  if (session.amount > 10000 && session.status !== 'completed') score += 15;
  
  return Math.min(score, 100);
}

/**
 * Get blocked attempts count
 * GET /api/security/blocked-attempts
 */
async function handleBlockedAttempts(request, env, corsHeaders) {
  try {
    const user = await requireAuth(request, env, ["admin", "staff"]);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Get counts from various sources
    const [
      loginAttempts,
      fraudAttempts,
      anomalyCount,
      blockedIPs,
      failedPayments
    ] = await Promise.all([
      env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM audit_logs 
        WHERE action = 'LOGIN_FAILED' 
        AND timestamp > datetime('now', '-24 hours')
      `).first(),
      
      env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM security_anomalies 
        WHERE type = 'fraud_attempt' 
        AND created_at > datetime('now', '-24 hours')
      `).first(),
      
      env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM security_anomalies 
        WHERE created_at > datetime('now', '-24 hours')
      `).first(),
      
      env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM blocked_ips 
        WHERE active = 1
      `).first(),
      
      env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM payments 
        WHERE status = 'failed' 
        AND created_at > datetime('now', '-24 hours')
      `).first()
    ]);

    const total = (loginAttempts?.count || 0) + 
                  (fraudAttempts?.count || 0) + 
                  (anomalyCount?.count || 0) +
                  (failedPayments?.count || 0);

    return new Response(JSON.stringify({
      success: true,
      count: total,
      details: {
        loginAttempts: loginAttempts?.count || 0,
        fraudAttempts: fraudAttempts?.count || 0,
        anomalies: anomalyCount?.count || 0,
        blockedIPs: blockedIPs?.count || 0,
        failedPayments: failedPayments?.count || 0,
        period: '24 hours'
      }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Blocked attempts error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to get blocked attempts'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * Get fraud score
 * GET /api/security/fraud-score
 */
async function handleFraudScore(request, env, corsHeaders) {
  try {
    const user = await requireAuth(request, env, ["admin", "staff"]);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const [
      totalTransactions,
      failedTransactions,
      suspiciousTransactions,
      anomalies,
      totalRevenue
    ] = await Promise.all([
      env.DB.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
        FROM payments 
        WHERE created_at > datetime('now', '-7 days')
      `).first(),
      
      env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM payments 
        WHERE status = 'failed' 
        AND created_at > datetime('now', '-7 days')
      `).first(),
      
      env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM security_anomalies 
        WHERE type = 'fraud_attempt' 
        AND created_at > datetime('now', '-7 days')
      `).first(),
      
      env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM security_anomalies 
        WHERE created_at > datetime('now', '-7 days')
      `).first(),
      
      env.DB.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM payments 
        WHERE status = 'completed' 
        AND created_at > datetime('now', '-7 days')
      `).first()
    ]);

    const total = totalTransactions?.count || 1;
    const totalAmount = totalTransactions?.total || 0;
    const failed = failedTransactions?.count || 0;
    const suspicious = suspiciousTransactions?.count || 0;
    const anomalyCount = anomalies?.count || 0;
    const revenue = totalRevenue?.total || 0;

    // Calculate score (0-100)
    const failedRate = Math.min((failed / total) * 30, 30);
    const suspiciousRate = Math.min((suspicious / total) * 40, 40);
    const anomalyRate = Math.min((anomalyCount / total) * 30, 30);
    const score = Math.round(failedRate + suspiciousRate + anomalyRate);

    let riskLevel = 'low';
    if (score > 70) riskLevel = 'critical';
    else if (score > 50) riskLevel = 'high';
    else if (score > 30) riskLevel = 'medium';

    return new Response(JSON.stringify({
      success: true,
      score: score,
      riskLevel: riskLevel,
      details: {
        totalTransactions: total,
        totalRevenue: revenue,
        failedTransactions: failed,
        suspiciousTransactions: suspicious,
        anomalies: anomalyCount,
        period: '7 days'
      }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Fraud score error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to calculate fraud score'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * Block suspicious IP
 * POST /api/security/block-ip
 */
async function handleBlockIP(request, env, corsHeaders) {
  try {
    const user = await requireAuth(request, env, ["admin"]);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const body = await request.json();
    const { ip, reason, expiresAt } = body || {};

    if (!ip) {
      return new Response(JSON.stringify({ error: "IP address is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return new Response(JSON.stringify({ error: "Invalid IP address format" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Check if already blocked
    const existing = await env.DB.prepare(`
      SELECT id FROM blocked_ips WHERE ip = ? AND active = 1
    `).bind(ip).first();

    if (existing) {
      return new Response(JSON.stringify({
        success: false,
        error: "IP already blocked",
        id: existing.id
      }), {
        status: 409,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const id = nanoid();
    const expiry = expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await env.DB.prepare(`
      INSERT INTO blocked_ips (id, ip, reason, blocked_by, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, ip, reason || 'Manual block from security dashboard', user.id, expiry).run();

    await logEvent(env, "IP_BLOCKED", `IP ${ip} blocked by ${user.id}`, user.id);
    await logAudit(env, "IP_BLOCKED", user.id, "admin", user.id, {
      ip,
      reason: reason || 'Manual block',
      expiresAt: expiry
    });

    // Also add to rate limiter KV if available
    try {
      if (env.RATE_LIMITER) {
        await env.RATE_LIMITER.put(`blocked_ip:${ip}`, 'true', { expirationTtl: 30 * 24 * 60 * 60 });
      }
    } catch (e) {
      console.warn('Failed to add IP to rate limiter:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `IP ${ip} blocked successfully`,
      id: id,
      expiresAt: expiry
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Block IP error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to block IP'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * Unblock IP
 * DELETE /api/security/block-ip/:ip
 */
async function handleUnblockIP(request, env, corsHeaders) {
  try {
    const user = await requireAuth(request, env, ["admin"]);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const url = new URL(request.url);
    const ip = url.pathname.split('/').pop();

    if (!ip) {
      return new Response(JSON.stringify({ error: "IP address is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await env.DB.prepare(`
      UPDATE blocked_ips SET active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE ip = ?
    `).bind(ip).run();

    // Remove from rate limiter if available
    try {
      if (env.RATE_LIMITER) {
        await env.RATE_LIMITER.delete(`blocked_ip:${ip}`);
      }
    } catch (e) {
      console.warn('Failed to remove IP from rate limiter:', e);
    }

    await logEvent(env, "IP_UNBLOCKED", `IP ${ip} unblocked by ${user.id}`, user.id);
    await logAudit(env, "IP_UNBLOCKED", user.id, "admin", user.id, { ip });

    return new Response(JSON.stringify({
      success: true,
      message: `IP ${ip} unblocked successfully`
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('Unblock IP error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to unblock IP'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// EXPORTS - Single export at the bottom (no duplicates)
// ======================================================================

export {
    handleTheftCheck,
    handleBlockedAttempts,
    handleFraudScore,
    handleBlockIP,
    handleUnblockIP
};
