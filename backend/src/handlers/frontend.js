// ======================================================================
// FRONTEND LOG HANDLER
// ======================================================================
import { validateString } from '../utils/validation.js';
import { getCorsHeaders } from '../middleware/cors.js';

/**
 * Handle frontend log ingestion
 */
export async function handleFrontendLog(request, env, corsHeaders) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders
    });
  }
  
  try {
    const logs = await request.json();
    
    if (env.DB && Array.isArray(logs)) {
      for (let i = 0; i < Math.min(logs.length, 10); i++) {
        const log = logs[i];
        await env.DB.prepare(
          "INSERT INTO logs (type, message, user, details, timestamp) VALUES (?, ?, ?, ?, ?)"
        ).bind(
          validateString(log.type, 50) || 'frontend',
          validateString(log.message, 500) || 'Frontend log',
          validateString(log.user, 100) || 'anonymous',
          JSON.stringify(log).replace(/[\u0000-\u001f]/g, ''),
          new Date().toISOString()
        ).run().catch(() => {});
      }
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
