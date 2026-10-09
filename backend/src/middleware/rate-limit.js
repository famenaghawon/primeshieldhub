// ======================================================================
// RATE LIMITING MIDDLEWARE — D1-BACKED v13.0
// Migrated from KV to D1 to avoid write limits
// ======================================================================

/**
 * Get session from D1
 */
export async function getSession(env, jti) {
  try {
    const result = await env.DB.prepare(
      "SELECT session_data FROM sessions WHERE jti = ? AND expires_at > ?"
    ).bind(jti, Date.now()).first();
    
    if (!result) return null;
    return JSON.parse(result.session_data);
  } catch (e) {
    // Fallback to KV if D1 fails
    try {
      const sessionKey = `session:${jti}`;
      const sessionData = await env.RATE_LIMITER.get(sessionKey);
      return sessionData ? JSON.parse(sessionData) : null;
    } catch {
      return null;
    }
  }
}

/**
 * Check rate limit using D1
 */
export async function checkRateLimit(env, key, maxAttempts, windowSeconds) {
  try {
    const now = Date.now();
    const resetAt = now + (windowSeconds * 1000);
    
    // Try D1 first
    const result = await env.DB.prepare(`
      INSERT INTO rate_limits (key, attempts, reset_at, updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        attempts = CASE WHEN updated_at > reset_at THEN 1 ELSE attempts + 1 END,
        updated_at = ?
    `).bind(key, resetAt, now, now).run();
    
    // Get current count
    const current = await env.DB.prepare(
      "SELECT attempts, reset_at FROM rate_limits WHERE key = ?"
    ).bind(key).first();
    
    if (!current) {
      return { allowed: true, attempts: 0, retryAfter: 0 };
    }
    
    if (now > current.reset_at) {
      // Reset
      await env.DB.prepare(
        "UPDATE rate_limits SET attempts = 1, reset_at = ?, updated_at = ? WHERE key = ?"
      ).bind(resetAt, now, key).run();
      return { allowed: true, attempts: 1, retryAfter: 0 };
    }
    
    if (current.attempts > maxAttempts) {
      const retryAfter = Math.ceil((current.reset_at - now) / 1000);
      return { allowed: false, retryAfter: retryAfter > 0 ? retryAfter : windowSeconds, attempts: current.attempts };
    }
    
    return { allowed: true, attempts: current.attempts, retryAfter: 0 };
    
  } catch (error) {
    console.error('Rate limit check error:', error.message);
    // Fail open
    return { allowed: true, attempts: 0, retryAfter: 0 };
  }
}

/**
 * Increment rate limit counter
 */
export async function incrementRateLimit(env, key, windowSeconds) {
  try {
    const now = Date.now();
    const resetAt = now + (windowSeconds * 1000);
    
    await env.DB.prepare(`
      INSERT INTO rate_limits (key, attempts, reset_at, updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        attempts = attempts + 1,
        updated_at = ?
    `).bind(key, resetAt, now, now).run();
    
    const current = await env.DB.prepare(
      "SELECT attempts FROM rate_limits WHERE key = ?"
    ).bind(key).first();
    
    return current ? current.attempts : 1;
  } catch (error) {
    console.error('Increment rate limit error:', error.message);
    return 0;
  }
}

/**
 * Reset rate limit counter
 */
export async function resetRateLimit(env, key) {
  try {
    await env.DB.prepare("DELETE FROM rate_limits WHERE key = ?").bind(key).run();
    return true;
  } catch (error) {
    console.error('Reset rate limit error:', error.message);
    return false;
  }
}

/**
 * Get remaining attempts for a key
 */
export async function getRemainingAttempts(env, key, maxAttempts) {
  try {
    const current = await env.DB.prepare(
      "SELECT attempts, reset_at FROM rate_limits WHERE key = ?"
    ).bind(key).first();
    
    if (!current) return maxAttempts;
    
    const now = Date.now();
    if (now > current.reset_at) return maxAttempts;
    
    return Math.max(0, maxAttempts - current.attempts);
  } catch (error) {
    return maxAttempts;
  }
}
