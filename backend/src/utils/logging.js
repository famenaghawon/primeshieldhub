// ======================================================================
// LOGGING UTILITIES — FIXED for D1 schema compatibility
// ======================================================================

/**
 * Log an event to the database
 * Auto-detects available columns to prevent SQL errors
 */
export async function logEvent(env, type, message, user, details) {
  try {
    user = user || "system";
    details = details || {};
    
    // Check if logs table exists and what columns it has
    let columns = [];
    try {
      const tableInfo = await env.DB.prepare("PRAGMA table_info(logs)").all();
      columns = (tableInfo.results || []).map(c => c.name);
    } catch (e) {
      // Table might not exist yet, try to create it
      console.warn('Logs table check failed, attempting to create:', e.message);
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            action TEXT,
            message TEXT,
            user TEXT,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
        columns = ['id', 'type', 'action', 'message', 'user', 'details', 'timestamp'];
      } catch (createErr) {
        console.error('Failed to create logs table:', createErr);
        return;
      }
    }
    
    const sanitizedDetails = JSON.stringify(details).replace(/[\u0000-\u001f]/g, '');
    const now = new Date().toISOString();
    
    // Build query based on available columns
    let query, params;
    
    if (columns.includes('type')) {
      query = "INSERT INTO logs (type, message, user, details, timestamp) VALUES (?, ?, ?, ?, ?)";
      params = [type, message, user, sanitizedDetails, now];
    } else if (columns.includes('action')) {
      query = "INSERT INTO logs (action, message, user, details, timestamp) VALUES (?, ?, ?, ?, ?)";
      params = [type, message, user, sanitizedDetails, now];
    } else {
      // Fallback - log to console only
      console.log(`[LOG] ${type}: ${message}`, { user, details });
      return;
    }
    
    await env.DB.prepare(query).bind(...params).run();
    
  } catch (e) {
    // Don't let logging errors break the app
    console.error("Logging error:", e.message);
  }
}

/**
 * Log an audit entry to the database
 */
export async function logAudit(env, action, userId, resource, resourceId, changes, ip, fingerprint) {
  try {
    // Check if audit_logs table exists and what columns it has
    let columns = [];
    try {
      const tableInfo = await env.DB.prepare("PRAGMA table_info(audit_logs)").all();
      columns = (tableInfo.results || []).map(c => c.name);
    } catch (e) {
      console.warn('Audit logs table check failed:', e.message);
      // Try to create table if it doesn't exist
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            action TEXT,
            user_id TEXT,
            resource TEXT,
            resource_id TEXT,
            changes TEXT,
            ip_address TEXT,
            device_fingerprint TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
        columns = ['id', 'action', 'user_id', 'resource', 'resource_id', 'changes', 'ip_address', 'device_fingerprint', 'timestamp'];
      } catch (createErr) {
        console.error('Failed to create audit_logs table:', createErr);
        return;
      }
    }
    
    const auditId = crypto.randomUUID();
    const now = new Date().toISOString();
    const changesJson = JSON.stringify(changes || {});
    
    // Build query based on available columns
    let query, params;
    
    if (columns.includes('timestamp') && columns.includes('id')) {
      query = `INSERT INTO audit_logs 
               (id, action, user_id, resource, resource_id, changes, ip_address, device_fingerprint, timestamp) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [auditId, action, userId, resource, resourceId || null, changesJson, ip || null, fingerprint || null, now];
    } else {
      // Fallback with fewer columns
      query = `INSERT INTO audit_logs 
               (id, action, user_id, resource, resource_id, changes, ip_address, device_fingerprint) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [auditId, action, userId, resource, resourceId || null, changesJson, ip || null, fingerprint || null];
    }
    
    await env.DB.prepare(query).bind(...params).run();
    
  } catch (e) {
    console.error("Audit logging error:", e.message);
  }
}

/**
 * Create a notification for a user
 */
export async function createNotification(env, userId, title, message, type, link) {
  try {
    type = type || 'info';
    link = link || null;
    
    // Check if notifications table exists
    let columns = [];
    try {
      const tableInfo = await env.DB.prepare("PRAGMA table_info(notifications)").all();
      columns = (tableInfo.results || []).map(c => c.name);
    } catch (e) {
      console.warn('Notifications table check failed:', e.message);
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            title TEXT,
            message TEXT,
            type TEXT,
            link TEXT,
            read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
        columns = ['id', 'user_id', 'title', 'message', 'type', 'link', 'read', 'created_at'];
      } catch (createErr) {
        console.error('Failed to create notifications table:', createErr);
        return;
      }
    }
    
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Build query based on available columns
    let query, params;
    
    if (columns.includes('created_at') && columns.includes('read')) {
      query = `INSERT INTO notifications (id, user_id, title, message, type, link, read, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, 0, ?)`;
      params = [id, userId, title, message, type, link, now];
    } else if (columns.includes('created_at')) {
      query = `INSERT INTO notifications (id, user_id, title, message, type, link, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
      params = [id, userId, title, message, type, link, now];
    } else {
      query = `INSERT INTO notifications (id, user_id, title, message, type, link) 
               VALUES (?, ?, ?, ?, ?, ?)`;
      params = [id, userId, title, message, type, link];
    }
    
    await env.DB.prepare(query).bind(...params).run();
    
  } catch (e) {
    console.error('Notification error:', e.message);
  }
}

/**
 * Parse cookie header string into an object
 * Note: This is also in validation.js, keeping for backward compatibility
 */
export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(function(cookie) {
    const parts = cookie.trim().split('=');
    const name = parts[0];
    if (name) {
      cookies[name.trim()] = parts.slice(1).join('=');
    }
  });
  return cookies;
}
