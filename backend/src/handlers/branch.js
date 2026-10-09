// ======================================================================
// BRANCH HANDLERS — COMPLETE INTEGRATED VERSION v11.4
// Full branch management with revenue tracking, staff management,
// performance metrics, and analytics
// ======================================================================

import { requireAuth } from '../middleware/auth.js';
import { getCorsHeaders } from '../middleware/cors.js';
import { logAudit } from '../utils/logging.js';
import { validateString, validateBranchId, validateUUID } from '../utils/validation.js';
import { nanoid } from 'nanoid';

// ======================================================================
// UTILITY HELPERS
// ======================================================================

/**
 * Get branch details by ID
 */
async function getBranchDetails(env, branchId) {
  if (!branchId) return null;
  try {
    const query = await env.DB.prepare(`
      SELECT 
        b.*,
        COUNT(DISTINCT s.id) as staff_count,
        COUNT(DISTINCT cs.id) as session_count,
        COALESCE(SUM(CASE WHEN cs.status = 'completed' THEN cs.amount ELSE 0 END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN cs.status = 'completed' THEN cs.amount ELSE NULL END), 0) as avg_revenue
      FROM branches b
      LEFT JOIN staff s ON b.id = s.branch_id AND s.status = 'active'
      LEFT JOIN charging_sessions cs ON b.id = cs.branch_id
      WHERE b.id = ?
      GROUP BY b.id
    `).bind(branchId);
    return await query.first();
  } catch (e) {
    console.error('Branch details error:', e);
    return null;
  }
}

/**
 * Get branch performance metrics
 */
async function getBranchMetrics(env, branchId, period = 'today') {
  if (!branchId) return null;
  
  let dateFilter = '';
  if (period === 'today') {
    dateFilter = "AND DATE(cs.start_time) = DATE('now')";
  } else if (period === 'week') {
    dateFilter = "AND cs.start_time >= DATE('now', '-7 days')";
  } else if (period === 'month') {
    dateFilter = "AND cs.start_time >= DATE('now', 'start of month')";
  } else if (period === 'year') {
    dateFilter = "AND cs.start_time >= DATE('now', 'start of year')";
  }
  
  try {
    const query = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN cs.status IN ('charging', 'paused') THEN 1 END) as active_sessions,
        COUNT(CASE WHEN cs.status = 'ready' THEN 1 END) as ready_sessions,
        COUNT(CASE WHEN cs.status = 'completed' THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN cs.status = 'overnight' THEN 1 END) as overnight_sessions,
        COUNT(CASE WHEN cs.status = 'abandoned' THEN 1 END) as abandoned_sessions,
        COALESCE(SUM(CASE WHEN cs.status = 'completed' THEN cs.amount ELSE 0 END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN cs.status = 'completed' THEN cs.amount ELSE NULL END), 0) as avg_revenue,
        COALESCE(AVG(cs.estimated_minutes), 0) as avg_charge_time,
        COALESCE(SUM(CASE WHEN cs.special_handling = 1 THEN 1 ELSE 0 END), 0) as special_handling_count
      FROM charging_sessions cs
      WHERE cs.branch_id = ? ${dateFilter}
    `).bind(branchId);
    return await query.first();
  } catch (e) {
    console.error('Branch metrics error:', e);
    return null;
  }
}

/**
 * Get branch device popularity
 */
async function getBranchDevicePopularity(env, branchId, limit = 10) {
  if (!branchId) return [];
  
  try {
    const query = await env.DB.prepare(`
      SELECT 
        cs.device_type,
        COUNT(*) as count,
        COALESCE(AVG(cs.amount), 0) as avg_price,
        COALESCE(AVG(cs.estimated_minutes), 0) as avg_time,
        COALESCE(SUM(cs.amount), 0) as total_revenue
      FROM charging_sessions cs
      WHERE cs.branch_id = ? AND cs.status = 'completed'
      GROUP BY cs.device_type
      ORDER BY count DESC
      LIMIT ?
    `).bind(branchId, limit);
    const result = await query.all();
    return result.results || [];
  } catch (e) {
    console.error('Device popularity error:', e);
    return [];
  }
}

/**
 * Get branch daily revenue trend
 */
async function getBranchRevenueTrend(env, branchId, days = 7) {
  if (!branchId) return [];
  
  try {
    const query = await env.DB.prepare(`
      SELECT 
        DATE(cs.completed_at) as date,
        COALESCE(SUM(cs.amount), 0) as revenue,
        COUNT(*) as sessions
      FROM charging_sessions cs
      WHERE cs.branch_id = ? 
        AND cs.status = 'completed'
        AND cs.completed_at >= DATE('now', '-' || ? || ' days')
      GROUP BY DATE(cs.completed_at)
      ORDER BY date ASC
    `).bind(branchId, days);
    const result = await query.all();
    return result.results || [];
  } catch (e) {
    console.error('Revenue trend error:', e);
    return [];
  }
}

/**
 * Get branch staff performance
 */
async function getBranchStaffPerformance(env, branchId, limit = 10) {
  if (!branchId) return [];
  
  try {
    const query = await env.DB.prepare(`
      SELECT 
        s.id as staff_id,
        s.name as staff_name,
        s.role,
        COUNT(cs.id) as sessions,
        COALESCE(SUM(cs.amount), 0) as revenue,
        COALESCE(AVG(cs.amount), 0) as avg_revenue,
        COALESCE(AVG(cs.estimated_minutes), 0) as avg_charge_time,
        COUNT(CASE WHEN cs.status = 'completed' THEN 1 END) as completed_sessions
      FROM staff s
      LEFT JOIN charging_sessions cs ON s.id = cs.staff_id
      WHERE s.branch_id = ? AND s.status = 'active'
      GROUP BY s.id
      ORDER BY revenue DESC
      LIMIT ?
    `).bind(branchId, limit);
    const result = await query.all();
    return result.results || [];
  } catch (e) {
    console.error('Staff performance error:', e);
    return [];
  }
}

// ======================================================================
// 1. BRANCH REVENUE (Enhanced)
// ======================================================================

/**
 * Handle branch total revenue
 * GET /api/branch/total-revenue
 */
export async function handleBranchRevenue(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ctx, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'today';
    const branchId = request.headers.get("x-branch-id") || user.branch_id || null;
    
    if (!branchId) {
      return new Response(JSON.stringify({ error: "Branch ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    let dateFilter = '';
    let params = [branchId];
    
    if (period === 'today') {
      dateFilter = "AND DATE(completed_at) = DATE('now')";
    } else if (period === 'week') {
      dateFilter = "AND completed_at >= DATE('now', '-7 days')";
    } else if (period === 'month') {
      dateFilter = "AND completed_at >= DATE('now', 'start of month')";
    } else if (period === 'year') {
      dateFilter = "AND completed_at >= DATE('now', 'start of year')";
    }
    
    const query = `
      SELECT 
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as sessions,
        COALESCE(AVG(amount), 0) as average,
        COALESCE(MAX(amount), 0) as highest,
        COALESCE(MIN(amount), 0) as lowest,
        COUNT(DISTINCT customer_phone) as unique_customers
      FROM charging_sessions
      WHERE branch_id = ? AND status = 'completed' ${dateFilter}
    `;
    
    const revenueQuery = await env.DB.prepare(query).bind(...params);
    const revenueResult = await revenueQuery.first();
    
    const dailyQuery = await env.DB.prepare(`
      SELECT 
        DATE(completed_at) as date,
        COALESCE(SUM(amount), 0) as total
      FROM charging_sessions
      WHERE branch_id = ? AND status = 'completed' ${dateFilter}
      GROUP BY DATE(completed_at)
      ORDER BY date DESC
      LIMIT 30
    `).bind(...params);
    const dailyResult = await dailyQuery.all();
    
    return new Response(JSON.stringify({
      total: revenueResult?.total || 0,
      sessions: revenueResult?.sessions || 0,
      average: revenueResult?.average || 0,
      highest: revenueResult?.highest || 0,
      lowest: revenueResult?.lowest || 0,
      uniqueCustomers: revenueResult?.unique_customers || 0,
      dailyBreakdown: dailyResult.results || [],
      period: period
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Branch revenue error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 2. BRANCH STAFF LIST (Enhanced)
// ======================================================================

/**
 * Handle branch staff list
 * GET /api/branch/staff
 */
export async function handleBranchStaff(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ctx, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const branchId = request.headers.get("x-branch-id") || user.branch_id || null;
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    const status = url.searchParams.get('status') || 'active';
    const search = url.searchParams.get('search') || '';
    
    if (!branchId) {
      return new Response(JSON.stringify({ error: "Branch ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    let query = `
      SELECT 
        s.id,
        s.name,
        s.email,
        s.phone,
        s.role,
        s.score,
        s.status,
        s.created_at,
        COALESCE((
          SELECT COUNT(*) FROM charging_sessions 
          WHERE staff_id = s.id AND status = 'completed'
        ), 0) as total_sessions,
        COALESCE((
          SELECT SUM(amount) FROM charging_sessions 
          WHERE staff_id = s.id AND status = 'completed'
        ), 0) as total_revenue,
        COALESCE((
          SELECT AVG(amount) FROM charging_sessions 
          WHERE staff_id = s.id AND status = 'completed'
        ), 0) as avg_revenue,
        COALESCE((
          SELECT COUNT(*) FROM charging_sessions 
          WHERE staff_id = s.id AND status IN ('charging', 'paused')
        ), 0) as active_sessions,
        COALESCE((
          SELECT AVG(estimated_minutes) FROM charging_sessions 
          WHERE staff_id = s.id AND status = 'completed'
        ), 0) as avg_charge_time
      FROM staff s
      WHERE s.branch_id = ?
    `;
    const params = [branchId];
    
    if (status !== 'all') {
      query += " AND s.status = ?";
      params.push(status);
    }
    
    if (search) {
      query += " AND (s.name LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)";
      const searchTerm = '%' + search + '%';
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += " ORDER BY s.total_revenue DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    
    const staffQuery = await env.DB.prepare(query).bind(...params);
    const staffResult = await staffQuery.all();
    
    let countQuery = "SELECT COUNT(*) as count FROM staff s WHERE s.branch_id = ?";
    let countParams = [branchId];
    
    if (status !== 'all') {
      countQuery += " AND s.status = ?";
      countParams.push(status);
    }
    
    if (search) {
      countQuery += " AND (s.name LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)";
      const searchTerm = '%' + search + '%';
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
    const total = countResult?.count || 0;
    
    const staffList = (staffResult.results || []).map(staff => ({
      ...staff,
      performance: {
        sessionsPerDay: staff.total_sessions / 30,
        revenuePerSession: staff.total_sessions > 0 ? staff.total_revenue / staff.total_sessions : 0,
        completionRate: staff.total_sessions > 0 ? 
          Math.round((staff.total_sessions / (staff.total_sessions + staff.active_sessions)) * 100) : 0
      }
    }));
    
    const summaryQuery = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_staff,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_staff,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_staff,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_staff,
        COALESCE(SUM(total_revenue), 0) as total_revenue,
        COALESCE(AVG(score), 0) as avg_score
      FROM staff
      WHERE branch_id = ?
    `).bind(branchId);
    const summary = await summaryQuery.first();
    
    return new Response(JSON.stringify({
      staff: staffList,
      summary: summary || { total_staff: 0, active_staff: 0, pending_staff: 0, inactive_staff: 0, total_revenue: 0, avg_score: 0 },
      pagination: { total, limit, offset, hasMore: offset + limit < total }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Branch staff error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 3. BRANCH DETAILS (NEW)
// ======================================================================

/**
 * Handle branch details
 * GET /api/branch/:id
 */
export async function handleBranchDetails(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ctx, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const branchId = url.pathname.split('/').pop();
    
    if (!branchId) {
      return new Response(JSON.stringify({ error: "Branch ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    if (user.role !== 'admin' && user.branch_id !== branchId) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const branch = await getBranchDetails(env, branchId);
    
    if (!branch) {
      return new Response(JSON.stringify({ error: "Branch not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const metrics = await getBranchMetrics(env, branchId);
    const devicePopularity = await getBranchDevicePopularity(env, branchId);
    const revenueTrend = await getBranchRevenueTrend(env, branchId);
    const staffPerformance = await getBranchStaffPerformance(env, branchId);
    
    return new Response(JSON.stringify({
      success: true,
      branch: branch,
      metrics: metrics || {},
      devicePopularity: devicePopularity,
      revenueTrend: revenueTrend,
      staffPerformance: staffPerformance
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Branch details error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 4. BRANCH SESSIONS (NEW)
// ======================================================================

/**
 * Handle branch sessions
 * GET /api/branch/sessions
 */
export async function handleBranchSessions(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ctx, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const branchId = request.headers.get("x-branch-id") || user.branch_id || null;
    const status = url.searchParams.get('status') || 'all';
    const limit = parseInt(url.searchParams.get('limit')) || 100;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    
    if (!branchId) {
      return new Response(JSON.stringify({ error: "Branch ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    let query = `
      SELECT 
        cs.*,
        u.name as staff_name,
        u.role as staff_role
      FROM charging_sessions cs
      LEFT JOIN users u ON cs.staff = u.id
      WHERE cs.branch_id = ?
    `;
    const params = [branchId];
    
    if (status !== 'all') {
      query += " AND cs.status = ?";
      params.push(status);
    }
    
    if (from) {
      query += " AND DATE(cs.start_time) >= ?";
      params.push(from);
    }
    
    if (to) {
      query += " AND DATE(cs.start_time) <= ?";
      params.push(to);
    }
    
    query += " ORDER BY cs.start_time DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    
    const sessionsQuery = await env.DB.prepare(query).bind(...params);
    const sessionsResult = await sessionsQuery.all();
    
    let countQuery = "SELECT COUNT(*) as count FROM charging_sessions cs WHERE cs.branch_id = ?";
    let countParams = [branchId];
    
    if (status !== 'all') {
      countQuery += " AND cs.status = ?";
      countParams.push(status);
    }
    
    if (from) {
      countQuery += " AND DATE(cs.start_time) >= ?";
      countParams.push(from);
    }
    
    if (to) {
      countQuery += " AND DATE(cs.start_time) <= ?";
      countParams.push(to);
    }
    
    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
    const total = countResult?.count || 0;
    
    const statusQuery = await env.DB.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as revenue
      FROM charging_sessions
      WHERE branch_id = ?
      GROUP BY status
    `).bind(branchId);
    const statusSummary = await statusQuery.all();
    
    return new Response(JSON.stringify({
      success: true,
      sessions: sessionsResult.results || [],
      statusSummary: statusSummary.results || [],
      pagination: { total, limit, offset, hasMore: offset + limit < total }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Branch sessions error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 5. BRANCH ANALYTICS (NEW)
// ======================================================================

/**
 * Handle branch analytics
 * GET /api/branch/analytics
 */
export async function handleBranchAnalytics(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ctx, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const branchId = request.headers.get("x-branch-id") || user.branch_id || null;
    const period = url.searchParams.get('period') || 'week';
    
    if (!branchId) {
      return new Response(JSON.stringify({ error: "Branch ID required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const [
      metrics,
      devicePopularity,
      revenueTrend,
      staffPerformance,
      hourlyDistribution
    ] = await Promise.all([
      getBranchMetrics(env, branchId, period),
      getBranchDevicePopularity(env, branchId),
      getBranchRevenueTrend(env, branchId, period === 'week' ? 7 : period === 'month' ? 30 : 7),
      getBranchStaffPerformance(env, branchId),
      env.DB.prepare(`
        SELECT 
          strftime('%H', start_time) as hour,
          COUNT(*) as sessions,
          COALESCE(SUM(amount), 0) as revenue
        FROM charging_sessions
        WHERE branch_id = ? AND status = 'completed'
        GROUP BY hour
        ORDER BY hour ASC
      `).bind(branchId).all()
    ]);
    
    const loyaltyQuery = await env.DB.prepare(`
      SELECT 
        customer_phone,
        customer_name,
        COUNT(*) as visits,
        COALESCE(SUM(amount), 0) as total_spent,
        MAX(completed_at) as last_visit
      FROM charging_sessions
      WHERE branch_id = ? AND status = 'completed' AND customer_phone IS NOT NULL
      GROUP BY customer_phone
      ORDER BY visits DESC
      LIMIT 20
    `).bind(branchId);
    const loyaltyStats = await loyaltyQuery.all();
    
    const peakQuery = await env.DB.prepare(`
      SELECT 
        strftime('%H', start_time) as hour,
        COUNT(*) as sessions
      FROM charging_sessions
      WHERE branch_id = ? AND status IN ('charging', 'paused', 'ready')
      GROUP BY hour
      ORDER BY sessions DESC
      LIMIT 5
    `).bind(branchId);
    const peakHours = await peakQuery.all();
    
    return new Response(JSON.stringify({
      success: true,
      period: period,
      metrics: metrics || {},
      devicePopularity: devicePopularity,
      revenueTrend: revenueTrend,
      staffPerformance: staffPerformance,
      hourlyDistribution: hourlyDistribution.results || [],
      loyaltyStats: loyaltyStats.results || [],
      peakHours: peakHours.results || []
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Branch analytics error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 6. BRANCH LOCATIONS (NEW)
// ======================================================================

/**
 * Handle branch locations
 * GET /api/branch/locations
 */
export async function handleBranchLocations(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ctx, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const branchId = request.headers.get("x-branch-id") || user.branch_id || null;
    
    let query = `
      SELECT 
        id,
        name,
        city,
        address,
        phone,
        email,
        manager_name,
        status,
        latitude,
        longitude
      FROM branches
      WHERE status = 'active'
    `;
    const params = [];
    
    if (branchId) {
      query += " AND id = ?";
      params.push(branchId);
    }
    
    query += " ORDER BY name ASC";
    
    const locationsQuery = await env.DB.prepare(query).bind(...params);
    const locationsResult = await locationsQuery.all();
    
    return new Response(JSON.stringify({
      success: true,
      locations: locationsResult.results || []
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Branch locations error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

// ======================================================================
// 7. BRANCH COMPARISON (NEW)
// ======================================================================

/**
 * Handle branch comparison
 * GET /api/branch/compare
 */
export async function handleBranchCompare(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ctx, ["admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized - Admin access required" }), {
      status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const branchIdsParam = url.searchParams.get('branches') || '';
    const branchIds = branchIdsParam.split(',').filter(id => id.trim() !== '');
    const period = url.searchParams.get('period') || 'month';
    
    if (branchIds.length === 0) {
      return new Response(JSON.stringify({ error: "Branch IDs required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    let dateFilter = '';
    if (period === 'today') {
      dateFilter = "AND DATE(start_time) = DATE('now')";
    } else if (period === 'week') {
      dateFilter = "AND start_time >= DATE('now', '-7 days')";
    } else if (period === 'month') {
      dateFilter = "AND start_time >= DATE('now', 'start of month')";
    } else if (period === 'year') {
      dateFilter = "AND start_time >= DATE('now', 'start of year')";
    }
    
    const placeholders = branchIds.map(() => '?').join(',');
    const comparisonQuery = await env.DB.prepare(`
      SELECT 
        b.id as branch_id,
        b.name as branch_name,
        b.city,
        COUNT(DISTINCT s.id) as staff_count,
        COUNT(cs.id) as total_sessions,
        COUNT(CASE WHEN cs.status = 'completed' THEN 1 END) as completed_sessions,
        COALESCE(SUM(CASE WHEN cs.status = 'completed' THEN cs.amount ELSE 0 END), 0) as revenue,
        COALESCE(AVG(CASE WHEN cs.status = 'completed' THEN cs.amount ELSE NULL END), 0) as avg_revenue,
        COALESCE(AVG(cs.estimated_minutes), 0) as avg_charge_time,
        COUNT(CASE WHEN cs.status IN ('charging', 'paused') THEN 1 END) as active_sessions
      FROM branches b
      LEFT JOIN staff s ON b.id = s.branch_id AND s.status = 'active'
      LEFT JOIN charging_sessions cs ON b.id = cs.branch_id ${dateFilter}
      WHERE b.id IN (${placeholders})
      GROUP BY b.id
      ORDER BY revenue DESC
    `).bind(...branchIds);
    const comparisonResult = await comparisonQuery.all();
    
    const comparisons = (comparisonResult.results || []).map(item => ({
      ...item,
      ranking: {
        revenue: 0,
        sessions: 0,
        avgRevenue: 0,
        staffCount: 0
      }
    }));
    
    const sortedByRevenue = [...comparisons].sort((a, b) => b.revenue - a.revenue);
    const sortedBySessions = [...comparisons].sort((a, b) => b.total_sessions - a.total_sessions);
    const sortedByAvgRevenue = [...comparisons].sort((a, b) => b.avg_revenue - a.avg_revenue);
    const sortedByStaff = [...comparisons].sort((a, b) => b.staff_count - a.staff_count);
    
    comparisons.forEach(item => {
      item.ranking.revenue = sortedByRevenue.findIndex(i => i.branch_id === item.branch_id) + 1;
      item.ranking.sessions = sortedBySessions.findIndex(i => i.branch_id === item.branch_id) + 1;
      item.ranking.avgRevenue = sortedByAvgRevenue.findIndex(i => i.branch_id === item.branch_id) + 1;
      item.ranking.staffCount = sortedByStaff.findIndex(i => i.branch_id === item.branch_id) + 1;
    });
    
    return new Response(JSON.stringify({
      success: true,
      period: period,
      comparison: comparisons
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Branch comparison error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
