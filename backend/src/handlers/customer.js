// ======================================================================
// CUSTOMER HANDLERS
// ======================================================================
import { requireAuth } from '../middleware/auth.js';
import { validatePhone, validatePeriod } from '../utils/validation.js';
import { getCorsHeaders } from '../middleware/cors.js';

/**
 * Handle customer history
 */
export async function handleCustomerHistory(request, env, corsHeaders) {
  const user = await requireAuth(request, env, ["staff", "admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
  
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get('phone');
    if (!phone || !validatePhone(phone)) {
      return new Response(JSON.stringify({ error: "Valid phone parameter required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const historyQuery = await env.DB.prepare(
      "SELECT * FROM customer_history WHERE customer_phone = ? ORDER BY date DESC LIMIT 50"
    ).bind(phone);
    const historyResult = await historyQuery.all();

    const stats = {
      totalVisits: historyResult.results.length,
      totalSpent: historyResult.results.reduce((sum, r) => sum + (r.amount || 0), 0),
      lastVisit: historyResult.results.length > 0 ? historyResult.results[0].date : null,
      devices: Array.from(new Set(historyResult.results.map(r => r.device_type))),
      history: historyResult.results
    };

    return new Response(JSON.stringify(stats), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * Handle top customers
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
    const period = validatePeriod(url.searchParams.get('period') || 'month');

    let dateFilter = '';
    if (period === 'week') dateFilter = "AND date >= datetime('now', '-7 days')";
    else if (period === 'month') dateFilter = "AND date >= datetime('now', 'start of month')";
    else if (period === 'year') dateFilter = "AND date >= datetime('now', 'start of year')";

    const topQuery = await env.DB.prepare(
      "SELECT customer_phone, customer_name, COUNT(*) as visits, SUM(amount) as total_spent FROM customer_history WHERE 1=1 " + dateFilter + " GROUP BY customer_phone ORDER BY visits DESC LIMIT 10"
    );
    const topResult = await topQuery.all();

    return new Response(JSON.stringify(topResult.results), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
