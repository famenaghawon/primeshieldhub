// ======================================================================
// INVESTOR HANDLERS
// ======================================================================
import { logEvent } from '../utils/logging.js';
import { validateString, validateEmail, validatePhone } from '../utils/validation.js';
import { getCorsHeaders } from '../middleware/cors.js';

/**
 * Handle investor express interest
 */
export async function handleInvestorExpressInterest(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const name = data.name;
    const email = data.email;
    const phone = data.phone;
    const amount = data.amount;
    const message = data.message;
    const simulationData = data.simulationData;
    
    await env.DB.prepare(
      "INSERT INTO investor_leads (id, name, email, phone, amount, message, simulation_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(
      crypto.randomUUID(), name, email, phone, amount,
      message, JSON.stringify(simulationData || {})
    ).run();
    
    // Notify admin via Telegram
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      const tgMsg = '🔔 *NEW INVESTOR LEAD*\n\n' +
        '*Name:* ' + name + '\n' +
        '*Email:* ' + email + '\n' +
        '*Phone:* ' + phone + '\n' +
        '*Amount:* ₦' + (amount || 0).toLocaleString() + '\n' +
        '*Message:* ' + (message || 'N/A');
      
      await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: tgMsg, parse_mode: 'Markdown' })
      }).catch(e => console.error('Telegram notify failed:', e));
    }
    
    await logEvent(env, "INVESTOR_LEAD", "New investor lead: " + name + " (" + email + ")", "system", {
      name, email, amount
    });
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Thank you for your interest! We will contact you shortly.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
