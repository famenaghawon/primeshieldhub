// ======================================================================
// SECURITY HANDLERS
// ======================================================================
import { requireAuth } from '../middleware/auth.js';
import { safeCompare } from '../utils/crypto.js';
import { getCorsHeaders } from '../middleware/cors.js';
import { logEvent, logAudit } from '../utils/logging.js';

/**
 * Handle security anomalies - ENHANCED
 * GET /api/security/anomalies
 */
export async function handleSecurityAnomalies(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    // Get long sessions
    const longSessionsQuery = await env.DB.prepare(`
      SELECT id, ticket_number, customer_name, device_type, 
             ROUND((julianday('now') - julianday(start_time)) * 1440) as minutes,
             start_time, status, amount
      FROM charging_sessions 
      WHERE status = 'charging' 
      AND ROUND((julianday('now') - julianday(start_time)) * 1440) > 120
    `);
    const longSessionsResult = await longSessionsQuery.all();

    // Get abandoned sessions
    const abandonedQuery = await env.DB.prepare(`
      SELECT id, ticket_number, customer_name, device_type, 
             start_time, status, amount
      FROM charging_sessions 
      WHERE status = 'abandoned' 
      AND created_at > datetime('now', '-24 hours')
      LIMIT 20
    `);
    const abandonedResult = await abandonedQuery.all();

    // Get security anomalies from database
    const anomalyQuery = await env.DB.prepare(`
      SELECT * FROM security_anomalies 
      ORDER BY created_at DESC 
      LIMIT 30
    `);
    const anomalyResult = await anomalyQuery.all();

    let alerts = [];
    
    // Long sessions
    const sessions = longSessionsResult.results || [];
    for (const s of sessions) {
      alerts.push({
        id: 'anom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        type: 'LONG_SESSION',
        message: `Session ${s.ticket_number} (${s.customer_name}) has been charging for ${Math.round(s.minutes)} minutes`,
        staff: s.customer_name || 'Unknown',
        branch: 'N/A',
        severity: s.minutes > 240 ? 'high' : 'medium',
        timestamp: new Date().toISOString(),
        source: 'charging_sessions'
      });
    }

    // Abandoned sessions
    const abandoned = abandonedResult.results || [];
    for (const s of abandoned) {
      alerts.push({
        id: 'anom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        type: 'ABANDONED_SESSION',
        message: `Session ${s.ticket_number} (${s.customer_name}) was abandoned`,
        staff: s.customer_name || 'Unknown',
        branch: 'N/A',
        severity: 'medium',
        timestamp: s.start_time || new Date().toISOString(),
        source: 'charging_sessions'
      });
    }

    // Database anomalies
    const anomalies = anomalyResult.results || [];
    for (const a of anomalies) {
      alerts.push({
        id: a.id || 'anom-' + Date.now(),
        type: a.type || 'SECURITY_ANOMALY',
        message: a.message || 'Security anomaly detected',
        staff: a.staff || 'System',
        branch: a.branch || 'N/A',
        severity: a.severity || 'medium',
        timestamp: a.created_at || new Date().toISOString(),
        source: 'security_anomalies'
      });
    }

    // Sort by timestamp descending
    alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Log the access
    await logEvent(env, "SECURITY_ANOMALIES_VIEWED", `Anomalies viewed by ${user.id}`, user.id);

    return new Response(JSON.stringify(alerts.slice(0, 50)), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Security anomalies error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      data: [] 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * Handle verify browser fingerprint
 * POST /api/verify-browser
 */
export async function handleVerifyBrowser(request, corsHeaders) {
  try {
    const body = await request.json();
    const bodyFingerprint = body.fingerprint;
    const sentFp = request.headers.get("x-device-fingerprint");
    
    if (bodyFingerprint && sentFp && safeCompare(bodyFingerprint, sentFp)) {
      return new Response(JSON.stringify({ 
        valid: true,
        message: "Fingerprint verified" 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    return new Response(JSON.stringify({ 
      valid: false, 
      message: "Fingerprint mismatch" 
    }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ 
      error: e.message,
      valid: false 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
