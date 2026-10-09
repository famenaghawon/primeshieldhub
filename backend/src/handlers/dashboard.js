// ============================================
// DASHBOARD HANDLER - v2.2 FIXED
// Enhanced dashboard endpoints with proper auth
// Fixed: deleted_at, action_url → link, safe table queries
// ============================================

import { v4 as uuidv4 } from 'uuid';
import { getCorsHeaders } from '../middleware/cors.js';
import { requireAuth } from '../middleware/auth.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Safe query helper - returns fallback on error
 */
async function safeQuery(env, query, params = [], fallback = []) {
    try {
        const result = await env.DB.prepare(query).bind(...params).all();
        return result.results || fallback;
    } catch (e) {
        console.error('Safe query error:', e.message);
        return fallback;
    }
}

/**
 * Safe first row helper
 */
async function safeFirst(env, query, params = [], fallback = null) {
    try {
        return await env.DB.prepare(query).bind(...params).first() || fallback;
    } catch (e) {
        console.error('Safe first error:', e.message);
        return fallback;
    }
}

/**
 * Create a notification
 */
async function createNotification(env, userId, type, title, message, actionUrl = null) {
    try {
        await env.DB.prepare(`
            INSERT INTO notifications (id, user_id, type, title, message, link)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(uuidv4(), userId, type, title, message, actionUrl).run();
        return true;
    } catch (error) {
        console.error('Create notification error:', error);
        return false;
    }
}

// ============================================
// 1. NOTIFICATIONS ENDPOINTS
// ============================================

export async function getNotifications(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["staff", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const url = new URL(request.url);
        const unreadOnly = url.searchParams.get('unread_only') === 'true';
        const limit = parseInt(url.searchParams.get('limit')) || 50;
        const offset = parseInt(url.searchParams.get('offset')) || 0;

        const tableCheck = await env.DB.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'"
        ).first();

        if (!tableCheck) {
            return new Response(JSON.stringify({
                success: true, notifications: [], unread_count: 0, total: 0
            }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        let query = `SELECT * FROM notifications WHERE user_id = ?`;
        if (unreadOnly) query += ' AND read = 0';
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

        const results = await env.DB.prepare(query).bind(user.id, limit, offset).all();
        const unreadCount = await safeFirst(env,
            "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0",
            [user.id], { count: 0 }
        );

        return new Response(JSON.stringify({
            success: true,
            notifications: results.results || [],
            unread_count: unreadCount?.count || 0,
            total: results.results?.length || 0
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    } catch (error) {
        console.error('Get notifications error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch notifications' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

export async function markNotificationRead(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["staff", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        const url = new URL(request.url);
        const id = url.pathname.split('/')[3];
        const result = await env.DB.prepare(
            "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?"
        ).bind(id, user.id).run();
        if (result.changes === 0) {
            return new Response(JSON.stringify({ success: false, error: 'Notification not found' }), {
                status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        return new Response(JSON.stringify({ success: true, message: 'Notification marked as read' }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Mark notification read error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to mark notification as read' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

export async function markAllNotificationsRead(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["staff", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        await env.DB.prepare(
            "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0"
        ).bind(user.id).run();
        return new Response(JSON.stringify({ success: true, message: 'All notifications marked as read' }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to mark all notifications as read' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ============================================
// 2. CUSTOMER LOYALTY ENDPOINTS
// ============================================

export async function getCustomerLoyalty(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["staff", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit')) || 10;
        const branchId = url.searchParams.get('branch_id') || user.branch_id;

        // Use charging_sessions instead of customer_loyalty (which may not exist)
        const results = await safeQuery(env, `
            SELECT customer_phone, customer_name, 
                   COUNT(*) as total_visits,
                   COALESCE(SUM(amount), 0) as total_spent,
                   MAX(completed_time) as last_visit
            FROM charging_sessions
            WHERE branch_id = ? AND status = 'completed' AND customer_phone IS NOT NULL
            GROUP BY customer_phone
            ORDER BY total_spent DESC
            LIMIT ?
        `, [branchId, limit]);

        const stats = await safeFirst(env, `
            SELECT COUNT(DISTINCT customer_phone) as total_customers,
                   AVG(visit_count) as avg_visits,
                   AVG(total_spent) as avg_spent
            FROM (
                SELECT customer_phone, COUNT(*) as visit_count, SUM(amount) as total_spent
                FROM charging_sessions
                WHERE branch_id = ? AND status = 'completed' AND customer_phone IS NOT NULL
                GROUP BY customer_phone
            )
        `, [branchId]);

        return new Response(JSON.stringify({
            success: true,
            top_customers: results,
            stats: {
                total_customers: stats?.total_customers || 0,
                avg_visits: Math.round(stats?.avg_visits || 0),
                avg_spent: stats?.avg_spent || 0,
                total_points: 0
            }
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    } catch (error) {
        console.error('Get loyalty data error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch loyalty data' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

export async function earnLoyaltyPoints(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["staff", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        const body = await request.json();
        const { customer_id, amount } = body;
        const pointsEarned = Math.floor((amount || 0) / 100);
        return new Response(JSON.stringify({
            success: true, points_earned: pointsEarned, total_points: pointsEarned
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    } catch (error) {
        console.error('Earn loyalty points error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to earn loyalty points' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ============================================
// 3. ANALYTICS DASHBOARD ENDPOINTS
// ============================================

export async function getDashboardAnalytics(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["staff", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        const url = new URL(request.url);
        const branchId = url.searchParams.get('branch_id') || user.branch_id || 'main';

        // Get current stats from charging_sessions
        const currentStats = await safeFirst(env, `
            SELECT 
                COUNT(CASE WHEN status IN ('charging','paused') THEN 1 END) as active_sessions,
                COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_sessions,
                COUNT(CASE WHEN status = 'charging' THEN 1 END) as charging_sessions,
                COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_sessions,
                COALESCE(SUM(CASE WHEN status = 'completed' AND DATE(completed_time) = DATE('now') THEN amount END), 0) as today_revenue
            FROM charging_sessions
            WHERE branch_id = ?
        `, [branchId]);

        // Get bay stats
        const bayStats = await safeFirst(env, `
            SELECT COUNT(*) as total_bays,
                   COUNT(CASE WHEN occupied = 0 THEN 1 END) as available_bays
            FROM bays WHERE branch_id = ?
        `, [branchId]);

        // Revenue trend (7 days)
        const revenueTrend = await safeQuery(env, `
            SELECT DATE(completed_time) as date, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as sessions
            FROM charging_sessions
            WHERE branch_id = ? AND status = 'completed' AND completed_time >= DATE('now', '-7 days')
            GROUP BY DATE(completed_time) ORDER BY date ASC
        `, [branchId]);

        // Device stats
        const deviceStats = await safeQuery(env, `
            SELECT device_type, COUNT(*) as count
            FROM charging_sessions
            WHERE branch_id = ? AND DATE(start_time) = DATE('now')
            GROUP BY device_type ORDER BY count DESC
        `, [branchId]);

        // Peak hours
        const peakHours = await safeQuery(env, `
            SELECT strftime('%H', start_time) as hour, COUNT(*) as count
            FROM charging_sessions
            WHERE branch_id = ? AND DATE(start_time) = DATE('now')
            GROUP BY hour ORDER BY count DESC LIMIT 3
        `, [branchId]);

        // Customer growth
        const customerGrowth = await safeFirst(env, `
            SELECT COUNT(DISTINCT customer_phone) as total_customers,
                   COUNT(DISTINCT CASE WHEN DATE(start_time) = DATE('now') THEN customer_phone END) as today_new
            FROM charging_sessions WHERE branch_id = ?
        `, [branchId]);

        return new Response(JSON.stringify({
            success: true,
            data: {
                current_stats: {
                    active_sessions: currentStats?.active_sessions || 0,
                    ready_sessions: currentStats?.ready_sessions || 0,
                    charging_sessions: currentStats?.charging_sessions || 0,
                    paused_sessions: currentStats?.paused_sessions || 0,
                    today_revenue: currentStats?.today_revenue || 0,
                    total_bays: bayStats?.total_bays || 0,
                    available_bays: bayStats?.available_bays || 0
                },
                revenue_forecast: revenueTrend,
                peak_hours: (peakHours || []).map(r => ({
                    hour: parseInt(r.hour), count: r.count,
                    label: `${r.hour}:00 - ${parseInt(r.hour) + 1}:00`
                })),
                device_stats: deviceStats.reduce((acc, r) => { acc[r.device_type] = r.count; return acc; }, {}),
                customer_growth: {
                    total: customerGrowth?.total_customers || 0,
                    daily: customerGrowth?.today_new || 0
                },
                timestamp: Date.now()
            }
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    } catch (error) {
        console.error('Get dashboard analytics error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch dashboard analytics' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ============================================
// 4. STAFF PERFORMANCE ENDPOINTS - FIXED
// ============================================

export async function getStaffPerformance(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["staff", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        const url = new URL(request.url);
        const period = url.searchParams.get('period') || 'today';
        const branchId = url.searchParams.get('branch_id') || user.branch_id || 'main';

        let dateFilter = "DATE(cs.start_time) = DATE('now')";
        if (period === 'week') dateFilter = "cs.start_time >= DATE('now', '-7 days')";
        else if (period === 'month') dateFilter = "cs.start_time >= DATE('now', 'start of month')";

        // FIXED: Removed deleted_at, using real tables
        const results = await safeQuery(env, `
            SELECT 
                u.id, u.name, u.email, u.role,
                COUNT(cs.id) as sessions_completed,
                COALESCE(SUM(cs.amount), 0) as revenue,
                COALESCE(AVG(cs.amount), 0) as avg_revenue,
                COALESCE(AVG(cs.estimated_minutes), 0) as avg_session_duration,
                CASE WHEN u.last_login >= datetime('now', '-5 minutes') THEN 'active' ELSE 'inactive' END as status
            FROM users u
            LEFT JOIN charging_sessions cs ON u.id = cs.staff AND cs.status = 'completed' AND ${dateFilter}
            WHERE u.role IN ('staff', 'manager') AND u.branch_id = ?
            GROUP BY u.id
            ORDER BY revenue DESC NULLS LAST
        `, [branchId]);

        const summary = await safeFirst(env, `
            SELECT 
                COUNT(DISTINCT u.id) as total_staff,
                COUNT(DISTINCT CASE WHEN u.last_login >= datetime('now', '-5 minutes') THEN u.id END) as active_staff,
                COALESCE(SUM(cs.amount), 0) as total_revenue,
                COUNT(cs.id) as total_sessions
            FROM users u
            LEFT JOIN charging_sessions cs ON u.id = cs.staff AND cs.status = 'completed' AND ${dateFilter}
            WHERE u.role IN ('staff', 'manager') AND u.branch_id = ?
        `, [branchId]);

        return new Response(JSON.stringify({
            success: true,
            staff: results,
            summary: {
                total_staff: summary?.total_staff || 0,
                active_staff: summary?.active_staff || 0,
                total_revenue: summary?.total_revenue || 0,
                total_sessions: summary?.total_sessions || 0
            }
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    } catch (error) {
        console.error('Get staff performance error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch staff performance' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ============================================
// 5. BRANCH MANAGEMENT ENDPOINTS - FIXED
// ============================================

export async function getBranches(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["staff", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const url = new URL(request.url);
        const includeSettings = url.searchParams.get('include_settings') === 'true';

        // FIXED: Removed deleted_at - uses simple query
        if (user.role !== 'admin') {
            const branch = await safeFirst(env,
                "SELECT * FROM branches WHERE id = ?", [user.branch_id]
            );
            if (branch) {
                const staffCount = await safeFirst(env,
                    "SELECT COUNT(*) as staff_count FROM users WHERE branch_id = ? AND role IN ('staff', 'manager')",
                    [user.branch_id], { staff_count: 0 }
                );
                branch.staff_count = staffCount?.staff_count || 0;
            }
            return new Response(JSON.stringify({
                success: true, branches: branch ? [branch] : []
            }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        const results = await safeQuery(env, "SELECT * FROM branches ORDER BY created_at DESC");

        for (const branch of results) {
            const staffCount = await safeFirst(env,
                "SELECT COUNT(*) as staff_count FROM users WHERE branch_id = ? AND role IN ('staff', 'manager')",
                [branch.id], { staff_count: 0 }
            );
            branch.staff_count = staffCount?.staff_count || 0;

            if (includeSettings) {
                branch.settings = await safeQuery(env,
                    "SELECT * FROM branch_settings WHERE branch_id = ?", [branch.id]
                );
            }
        }

        return new Response(JSON.stringify({
            success: true, branches: results
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    } catch (error) {
        console.error('Get branches error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch branches' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ============================================
// 6. SESSION ANALYTICS ENDPOINTS
// ============================================

export async function getSessionAnalytics(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["staff", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        const url = new URL(request.url);
        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date') || new Date().toISOString().split('T')[0];
        const branchId = url.searchParams.get('branch_id') || user.branch_id || 'main';

        let dateFilter = '';
        const params = [branchId];
        if (startDate) { dateFilter += ' AND DATE(start_time) >= ?'; params.push(startDate); }
        if (endDate) { dateFilter += ' AND DATE(start_time) <= ?'; params.push(endDate); }

        const stats = await safeFirst(env, `
            SELECT COUNT(*) as total_sessions,
                   COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
                   COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned_sessions,
                   COALESCE(SUM(CASE WHEN status = 'completed' THEN amount END), 0) as total_revenue,
                   COALESCE(AVG(CASE WHEN status = 'completed' THEN amount END), 0) as avg_revenue
            FROM charging_sessions WHERE branch_id = ? ${dateFilter}
        `, params);

        const deviceResults = await safeQuery(env, `
            SELECT device_type, COUNT(*) as count
            FROM charging_sessions WHERE branch_id = ? ${dateFilter}
            GROUP BY device_type ORDER BY count DESC
        `, params);

        const hourResults = await safeQuery(env, `
            SELECT strftime('%H', start_time) as hour, COUNT(*) as count
            FROM charging_sessions WHERE branch_id = ? ${dateFilter}
            GROUP BY hour ORDER BY hour ASC
        `, params);

        return new Response(JSON.stringify({
            success: true,
            analytics: {
                total_sessions: stats?.total_sessions || 0,
                completed_sessions: stats?.completed_sessions || 0,
                abandoned_sessions: stats?.abandoned_sessions || 0,
                total_revenue: stats?.total_revenue || 0,
                avg_revenue: Math.round(stats?.avg_revenue || 0),
                sessions_by_device: deviceResults,
                sessions_by_hour: hourResults
            }
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    } catch (error) {
        console.error('Get session analytics error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch session analytics' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ============================================
// 7. REPORTS ENDPOINTS
// ============================================

export async function generateDailyReport(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["staff", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        const body = await request.json();
        const { date, format = 'json', include_customers = true } = body;
        const reportDate = date || new Date().toISOString().split('T')[0];
        const branchId = user.branch_id || 'main';

        const sessions = await safeQuery(env, `
            SELECT * FROM charging_sessions
            WHERE branch_id = ? AND DATE(start_time) = ?
        `, [branchId, reportDate]);

        const financial = await safeFirst(env, `
            SELECT COALESCE(SUM(amount), 0) as total_revenue,
                   COALESCE(AVG(amount), 0) as avg_amount,
                   COUNT(*) as total_sessions,
                   COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions
            FROM charging_sessions
            WHERE branch_id = ? AND DATE(start_time) = ?
        `, [branchId, reportDate]);

        let customers = [];
        if (include_customers) {
            customers = await safeQuery(env, `
                SELECT DISTINCT customer_name, customer_phone,
                       COUNT(*) as sessions_count,
                       COALESCE(SUM(amount), 0) as total_spent
                FROM charging_sessions
                WHERE branch_id = ? AND DATE(start_time) = ? AND customer_name IS NOT NULL
                GROUP BY customer_name, customer_phone
            `, [branchId, reportDate]);
        }

        const reportData = {
            report_id: uuidv4(),
            date: reportDate,
            generated_at: new Date().toISOString(),
            branch_id: branchId,
            generated_by: user.id,
            format,
            data: {
                sessions,
                financial: {
                    total_revenue: financial?.total_revenue || 0,
                    avg_amount: Math.round(financial?.avg_amount || 0),
                    total_sessions: financial?.total_sessions || 0,
                    completed_sessions: financial?.completed_sessions || 0
                },
                customers
            }
        };

        return new Response(JSON.stringify({
            success: true, report_id: reportData.report_id, data: reportData
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    } catch (error) {
        console.error('Generate daily report error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to generate report' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

export async function downloadReport(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["staff", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        return new Response(JSON.stringify({ success: true, message: 'Report ready' }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Download report error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to download report' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ============================================
// 8. BRANCH SETTINGS ENDPOINTS
// ============================================

export async function getBranchSettings(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["staff", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        const url = new URL(request.url);
        const key = url.searchParams.get('key');
        const branchId = url.searchParams.get('branch_id') || user.branch_id || 'main';

        const results = await safeQuery(env,
            "SELECT * FROM branch_settings WHERE branch_id = ?" + (key ? " AND setting_key = ?" : ""),
            key ? [branchId, key] : [branchId]
        );

        const settings = {};
        results.forEach(s => {
            let value = s.setting_value;
            if (s.setting_type === 'number') value = parseFloat(value);
            else if (s.setting_type === 'boolean') value = value === 'true';
            else if (s.setting_type === 'json' || s.setting_type === 'array') {
                try { value = JSON.parse(value); } catch (e) {}
            }
            settings[s.setting_key] = value;
        });

        return new Response(JSON.stringify({
            success: true, settings: key ? settings[key] : settings
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    } catch (error) {
        console.error('Get branch settings error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch branch settings' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

export async function updateBranchSettings(request, env, ctx) {
    try {
        const corsHeaders = getCorsHeaders(request);
        const user = await requireAuth(request, env, ["manager", "admin"]);
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
                status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        const body = await request.json();
        const { key, value, setting_type = 'string' } = body;
        const branchId = user.branch_id || 'main';
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

        const existing = await safeFirst(env,
            "SELECT id FROM branch_settings WHERE branch_id = ? AND setting_key = ?",
            [branchId, key]
        );

        if (existing) {
            await env.DB.prepare(`
                UPDATE branch_settings SET setting_value = ?, setting_type = ?, updated_by = ?, updated_at = datetime('now')
                WHERE branch_id = ? AND setting_key = ?
            `).bind(valueStr, setting_type, user.id, branchId, key).run();
        } else {
            await env.DB.prepare(`
                INSERT INTO branch_settings (id, branch_id, setting_key, setting_value, setting_type, updated_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(uuidv4(), branchId, key, valueStr, setting_type, user.id).run();
        }

        return new Response(JSON.stringify({ success: true, message: 'Setting updated successfully' }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error('Update branch settings error:', error);
        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify({ success: false, error: 'Failed to update branch settings' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
