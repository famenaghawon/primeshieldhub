// autonomous.js - Autonomous Control Engine
// Executes automated actions based on AI analysis, respecting system controls

import { sendEmail, sendSMS, sendWhatsApp } from "./notifications.js";

/**
 * Run autonomous system based on analysis
 * @param {Object} env - Environment bindings (DB, RATE_LIMITER, etc.)
 * @param {Object} analysis - Output from analyzeLogs()
 * @returns {Promise<Array>} Actions taken
 */
export async function runAutonomousSystem(env, analysis) {
  const actions = [];
  
  // Check master AI enable switch
  const aiEnabled = await getControl(env, "AI_ENABLED");
  if (aiEnabled !== "true") {
    actions.push("AI_DISABLED");
    await logAction(env, "AI_DISABLED", "Autonomous system is turned off");
    return actions;
  }

  const autoPenalty = await getControl(env, "AUTO_PENALTY");
  const riskThreshold = parseInt(await getControl(env, "RISK_THRESHOLD") || "5");

  // ==================== RISK-BASED ACTIONS ====================
  if (analysis.riskLevel === "CRITICAL" || analysis.riskLevel === "HIGH") {
    actions.push("SECURITY_ALERT_TRIGGERED");
    
    // Send immediate alerts
    await sendSMS(env.ADMIN_PHONE, `🚨 CRITICAL: ${analysis.riskLevel} risk detected in system`, env);
    await sendWhatsApp(env.ADMIN_PHONE, `🚨 PrimeShield Alert: ${analysis.riskLevel} risk level. Check dashboard immediately.`, env);
    await sendEmail(
      env.ADMIN_EMAIL,
      `[URGENT] ${analysis.riskLevel} Risk Alert`,
      `<h2>${analysis.riskLevel} Risk Detected</h2><p>Fraud count: ${analysis.fraudCount}</p><p>Alert count: ${analysis.alertCount}</p>`,
      env
    );

    await logAction(env, "SECURITY_ALERT", `${analysis.riskLevel} risk level`, {
      fraudCount: analysis.fraudCount,
      alertCount: analysis.alertCount
    });

    // If auto-penalty is enabled and we have staff data
    if (autoPenalty === "true" && analysis.staffRanking && analysis.staffRanking.length > 0) {
      // Penalize low-scoring staff
      for (const staff of analysis.staffRanking) {
        if (staff.score < 0) {
          const penaltyAmount = Math.abs(staff.score) * 100;
          await penalizeStaff(env, staff.name, "Low performance score / security risk", penaltyAmount);
          actions.push(`PENALIZED_${staff.name}`);
        }
      }
    }
  }

  // ==================== REVENUE ACTIONS ====================
  if (analysis.totalRevenue < 5000) {
    actions.push("LOW_REVENUE_ALERT");
    await logAction(env, "LOW_REVENUE", `Revenue ₦${analysis.totalRevenue} below threshold`, {
      revenue: analysis.totalRevenue
    });
    
    // Send email to admin
    await sendEmail(
      env.ADMIN_EMAIL,
      "Low Revenue Alert",
      `<h3>Revenue below ₦5,000</h3><p>Current: ₦${analysis.totalRevenue}</p><p>Consider promotions or investigate.</p>`,
      env
    );

    // Check if promo mode should be auto-enabled
    const promoMode = await getControl(env, "PROMO_MODE");
    if (promoMode !== "ACTIVE") {
      await setControl(env, "PROMO_MODE", "ACTIVE");
      actions.push("PROMO_MODE_ACTIVATED");
      await logAction(env, "PROMO_ACTIVATED", "Auto-enabled due to low revenue");
    }
  }

  // If revenue is high, adjust pricing upward (dynamic pricing)
  if (analysis.totalRevenue > 20000) {
    const currentPrice = parseInt(await getControl(env, "DYNAMIC_PRICE") || "200");
    const newPrice = Math.min(currentPrice + 50, 500);
    await setControl(env, "DYNAMIC_PRICE", newPrice.toString());
    actions.push(`PRICE_INCREASED_TO_${newPrice}`);
    await logAction(env, "PRICE_ADJUST", `Increased to ₦${newPrice} due to high demand`);
  } else if (analysis.totalRevenue < 8000) {
    const currentPrice = parseInt(await getControl(env, "DYNAMIC_PRICE") || "200");
    const newPrice = Math.max(currentPrice - 50, 100);
    await setControl(env, "DYNAMIC_PRICE", newPrice.toString());
    actions.push(`PRICE_DECREASED_TO_${newPrice}`);
    await logAction(env, "PRICE_ADJUST", `Decreased to ₦${newPrice} to attract customers`);
  }

  // ==================== PEAK HOUR PREPARATION ====================
  if (analysis.peakHour !== null && analysis.peakHourActivity > 10) {
    actions.push("PEAK_HOUR_PREP");
    await logAction(env, "PEAK_HOUR_DETECTED", `Hour ${analysis.peakHour}:00 with ${analysis.peakHourActivity} sessions`);
    
    // Notify admin to prepare
    await sendSMS(
      env.ADMIN_PHONE,
      `⏰ Peak hour approaching: ${analysis.peakHour}:00. Prepare extra capacity.`,
      env
    );
  }

  // ==================== STAFF SUSPENSION / BONUS ====================
  if (analysis.staffRanking && autoPenalty === "true") {
    for (const staff of analysis.staffRanking) {
      // Suspend staff with very low scores
      if (staff.score < -50) {
        await suspendStaff(env, staff.name);
        actions.push(`SUSPENDED_${staff.name}`);
        await sendWhatsApp(env.ADMIN_PHONE, `⚠️ Staff ${staff.name} automatically suspended due to score ${staff.score}`, env);
      }
      // Mark top performers for bonus
      if (staff.score > 100) {
        await markForBonus(env, staff.name, staff.score);
        actions.push(`BONUS_MARKED_${staff.name}`);
      }
    }
  }

  // ==================== FRAUD RESPONSE ====================
  if (analysis.fraudCount > riskThreshold) {
    actions.push("FRAUD_LOCKDOWN");
    await logAction(env, "FRAUD_LOCKDOWN", `Fraud count ${analysis.fraudCount} exceeds threshold ${riskThreshold}`);
    
    // Temporarily disable new sessions? Or increase verification
    await setControl(env, "REQUIRE_OTP_FOR_CHARGING", "true");
    
    await sendSMS(env.ADMIN_PHONE, `🚨 Fraud lockdown initiated. Fraud count: ${analysis.fraudCount}`, env);
    await sendWhatsApp(env.ADMIN_PHONE, `🚨 CRITICAL: Fraud count ${analysis.fraudCount}. System heightened security.`, env);
  }

  return actions;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get a control value from system_control table
 */
async function getControl(env, key) {
  try {
    const result = await env.DB.prepare(
      "SELECT value FROM system_control WHERE key = ?"
    ).bind(key).first();
    return result?.value || null;
  } catch (e) {
    console.error(`[Autonomous] Failed to get control ${key}:`, e);
    return null;
  }
}

/**
 * Set a control value in system_control table
 */
async function setControl(env, key, value) {
  try {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO system_control (key, value) VALUES (?, ?)"
    ).bind(key, value).run();
    return true;
  } catch (e) {
    console.error(`[Autonomous] Failed to set control ${key}:`, e);
    return false;
  }
}

/**
 * Log an autonomous action to the actions table
 */
async function logAction(env, action, details, metadata = {}) {
  try {
    await env.DB.prepare(`
      INSERT INTO actions (action, details, metadata, timestamp)
      VALUES (?, ?, ?, ?)
    `).bind(action, details, JSON.stringify(metadata), new Date().toISOString()).run();
  } catch (e) {
    console.error('[Autonomous] Failed to log action:', e);
  }
}

/**
 * Apply a penalty to a staff member
 */
async function penalizeStaff(env, staffIdentifier, reason, amount) {
  try {
    // Find staff by name or id
    let staffId = staffIdentifier;
    const staff = await env.DB.prepare(
      "SELECT id FROM staff WHERE name = ? OR id = ?"
    ).bind(staffIdentifier, staffIdentifier).first();
    
    if (!staff) {
      console.warn(`[Autonomous] Staff not found: ${staffIdentifier}`);
      return false;
    }
    staffId = staff.id;

    // Insert penalty record
    await env.DB.prepare(`
      INSERT INTO penalties (staff, reason, amount, timestamp)
      VALUES (?, ?, ?, ?)
    `).bind(staffId, reason, amount, new Date().toISOString()).run();

    // Reduce staff score
    await env.DB.prepare(`
      UPDATE staff SET score = MAX(0, score - ?) WHERE id = ?
    `).bind(Math.floor(amount / 100), staffId).run();

    await logAction(env, "PENALTY_APPLIED", `Staff ${staffId} penalized ₦${amount} for ${reason}`);
    return true;
  } catch (e) {
    console.error('[Autonomous] Penalty error:', e);
    return false;
  }
}

/**
 * Suspend a staff member
 */
async function suspendStaff(env, staffIdentifier) {
  try {
    const staff = await env.DB.prepare(
      "SELECT id FROM staff WHERE name = ? OR id = ?"
    ).bind(staffIdentifier, staffIdentifier).first();
    
    if (!staff) return false;

    await env.DB.prepare(`
      UPDATE staff SET status = 'suspended' WHERE id = ?
    `).bind(staff.id).run();

    await logAction(env, "STAFF_SUSPENDED", `Staff ${staff.id} suspended automatically`);
    return true;
  } catch (e) {
    console.error('[Autonomous] Suspend error:', e);
    return false;
  }
}

/**
 * Mark staff for bonus (adds to bonus tracking table)
 */
async function markForBonus(env, staffIdentifier, score) {
  try {
    const staff = await env.DB.prepare(
      "SELECT id FROM staff WHERE name = ? OR id = ?"
    ).bind(staffIdentifier, staffIdentifier).first();
    
    if (!staff) return false;

    await env.DB.prepare(`
      INSERT INTO staff_bonuses (staff_id, score, marked_at, status)
      VALUES (?, ?, ?, 'pending')
    `).bind(staff.id, score, new Date().toISOString()).run();

    await logAction(env, "BONUS_MARKED", `Staff ${staff.id} marked for bonus (score: ${score})`);
    return true;
  } catch (e) {
    console.error('[Autonomous] Bonus error:', e);
    return false;
  }
}

