// ======================================================================
// WISHLIST HANDLER - COMPLETE IMPLEMENTATION (FIXED)
// ======================================================================

import { logEvent, logAudit } from '../utils/logging.js';
import { requireAuth } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

// ================================================================
// ✅ FIXED: ALLOWED ROLES CONSTANT
// ================================================================
const ALLOWED_ROLES = ['user', 'customer', 'staff', 'admin'];

/**
 * ================================================================
 * WISHLIST CRUD OPERATIONS
 * ================================================================
 */

/**
 * GET /api/wishlist
 * Get all wishlist items for authenticated user
 * Includes product details and price alerts
 */
export async function handleGetWishlist(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ALLOWED_ROLES);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // ✅ FIXED: Removed "w.active = 1" condition
    const result = await env.DB.prepare(`
      SELECT 
        w.id,
        w.user_id,
        w.product_id,
        w.priority,
        w.notes,
        w.created_at,
        w.updated_at,
        p.name,
        p.price,
        p.original_price,
        p.image,
        p.description,
        p.category,
        p.stock,
        p.rating,
        p.wholesale_price,
        p.slug
      FROM wishlist w
      LEFT JOIN products p ON w.product_id = p.id
      WHERE w.user_id = ?
      ORDER BY 
        CASE w.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        w.created_at DESC
    `).bind(user.id).all();

    const items = result.results || [];

    // Get price alerts for each item
    for (const item of items) {
      const alert = await env.DB.prepare(`
        SELECT * FROM wishlist_alerts 
        WHERE wishlist_id = ? AND active = 1
      `).bind(item.id).first();

      if (alert) {
        const currentPrice = parseFloat(item.price) || 0;
        const targetPrice = parseFloat(alert.target_price) || 0;
        const percentage = targetPrice > 0 ? Math.round(((targetPrice - currentPrice) / currentPrice) * 100) : 0;

        item.priceAlert = {
          active: true,
          id: alert.id,
          target: targetPrice,
          currentPrice: currentPrice,
          percentage: percentage,
          createdAt: alert.created_at,
          triggeredAt: alert.triggered_at
        };
      } else {
        item.priceAlert = null;
      }
    }

    // Get share info
    const share = await env.DB.prepare(`
      SELECT share_token, expires_at, created_at 
      FROM wishlist_shares 
      WHERE user_id = ? AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(user.id, Date.now()).first();

    return new Response(JSON.stringify({
      success: true,
      items: items,
      count: items.length,
      share: share ? {
        token: share.share_token,
        expiresAt: share.expires_at,
        createdAt: share.created_at
      } : null,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * POST /api/wishlist/add
 * Add item to wishlist
 */
export async function handleAddToWishlist(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ALLOWED_ROLES);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { productId, priority = 'medium', notes = '' } = body || {};

    if (!productId) {
      return new Response(JSON.stringify({ error: 'Product ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify product exists and is active
    const product = await env.DB.prepare(`
      SELECT id, name, price, stock, active 
      FROM products 
      WHERE id = ? AND active = 1
    `).bind(productId).first();

    if (!product) {
      return new Response(JSON.stringify({ error: 'Product not found or inactive' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ✅ FIXED: Removed "active" column from the query since it doesn't exist
    const existing = await env.DB.prepare(`
      SELECT id FROM wishlist 
      WHERE user_id = ? AND product_id = ?
    `).bind(user.id, productId).first();

    if (existing) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Product already in wishlist',
        alreadyExists: true,
        wishlistId: existing.id
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ✅ FIXED: Removed "active" column from INSERT
    const wishlistId = uuidv4();
    await env.DB.prepare(`
      INSERT INTO wishlist (
        id, user_id, product_id, priority, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(wishlistId, user.id, productId, priority, notes).run();

    await logEvent(env, 'WISHLIST_ADD', 
      `User ${user.id} added product ${productId} to wishlist`, user.id);
    await logAudit(env, 'WISHLIST_ADD', user.id, 'user', user.id, {
      productId,
      productName: product.name,
      priority
    }, null, null);

    return new Response(JSON.stringify({
      success: true,
      message: 'Added to wishlist',
      wishlistId: wishlistId,
      product: {
        id: product.id,
        name: product.name,
        price: product.price
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * DELETE /api/wishlist/remove/:productId
 * Remove item from wishlist
 */
export async function handleRemoveFromWishlist(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ALLOWED_ROLES);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const productId = url.pathname.split('/')[4];

    if (!productId) {
      return new Response(JSON.stringify({ error: 'Product ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ✅ FIXED: Removed "active = 1" condition since column doesn't exist
    const wishlistItem = await env.DB.prepare(`
      SELECT id, product_id FROM wishlist 
      WHERE user_id = ? AND product_id = ?
    `).bind(user.id, productId).first();

    if (!wishlistItem) {
      return new Response(JSON.stringify({ error: 'Item not found in wishlist' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ✅ FIXED: Use DELETE instead of UPDATE since no active column
    await env.DB.prepare(`
      DELETE FROM wishlist 
      WHERE id = ?
    `).bind(wishlistItem.id).run();

    // Deactivate alerts
    await env.DB.prepare(`
      UPDATE wishlist_alerts 
      SET active = 0, updated_at = datetime('now') 
      WHERE wishlist_id = ?
    `).bind(wishlistItem.id).run();

    await logEvent(env, 'WISHLIST_REMOVE', 
      `User ${user.id} removed product ${productId} from wishlist`, user.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Removed from wishlist'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * PUT /api/wishlist/priority/:productId
 * Update priority of wishlist item
 */
export async function handleUpdatePriority(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ALLOWED_ROLES);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const productId = url.pathname.split('/')[4];
    const body = await request.json();
    const { priority } = body || {};

    if (!productId) {
      return new Response(JSON.stringify({ error: 'Product ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const validPriorities = ['critical', 'high', 'medium', 'low'];
    if (!priority || !validPriorities.includes(priority)) {
      return new Response(JSON.stringify({ 
        error: 'Valid priority required: critical, high, medium, or low' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ✅ FIXED: Removed "active = 1" condition
    const result = await env.DB.prepare(`
      UPDATE wishlist 
      SET priority = ?, updated_at = datetime('now') 
      WHERE user_id = ? AND product_id = ?
    `).bind(priority, user.id, productId).run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: 'Item not found in wishlist' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await logEvent(env, 'WISHLIST_PRIORITY', 
      `User ${user.id} updated priority for product ${productId} to ${priority}`, user.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Priority updated',
      priority: priority
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error updating priority:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * PUT /api/wishlist/notes/:productId
 * Update notes for wishlist item
 */
export async function handleUpdateNotes(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ALLOWED_ROLES);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const productId = url.pathname.split('/')[4];
    const body = await request.json();
    const { notes } = body || {};

    if (!productId) {
      return new Response(JSON.stringify({ error: 'Product ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ✅ FIXED: Removed "active = 1" condition
    const result = await env.DB.prepare(`
      UPDATE wishlist 
      SET notes = ?, updated_at = datetime('now') 
      WHERE user_id = ? AND product_id = ?
    `).bind(notes || '', user.id, productId).run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: 'Item not found in wishlist' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Notes updated'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error updating notes:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * ================================================================
 * PRICE ALERT SYSTEM
 * ================================================================
 */

/**
 * POST /api/wishlist/alert
 * Set price alert for wishlist item
 */
export async function handleSetPriceAlert(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ALLOWED_ROLES);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { productId, targetPrice, notificationMethod = 'email' } = body || {};

    if (!productId) {
      return new Response(JSON.stringify({ error: 'Product ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!targetPrice || targetPrice <= 0) {
      return new Response(JSON.stringify({ error: 'Valid target price is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ✅ FIXED: Removed "active = 1" condition
    const wishlistItem = await env.DB.prepare(`
      SELECT id FROM wishlist 
      WHERE user_id = ? AND product_id = ?
    `).bind(user.id, productId).first();

    if (!wishlistItem) {
      return new Response(JSON.stringify({ error: 'Item not in wishlist' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get current product price
    const product = await env.DB.prepare(`
      SELECT price FROM products WHERE id = ?
    `).bind(productId).first();

    // Check if alert already exists
    const existingAlert = await env.DB.prepare(`
      SELECT id FROM wishlist_alerts 
      WHERE wishlist_id = ? AND active = 1
    `).bind(wishlistItem.id).first();

    let alertId;
    if (existingAlert) {
      // Update existing
      await env.DB.prepare(`
        UPDATE wishlist_alerts 
        SET target_price = ?, notification_method = ?, updated_at = datetime('now') 
        WHERE id = ?
      `).bind(targetPrice, notificationMethod, existingAlert.id).run();
      alertId = existingAlert.id;
    } else {
      // Create new
      alertId = uuidv4();
      await env.DB.prepare(`
        INSERT INTO wishlist_alerts (
          id, wishlist_id, target_price, notification_method, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `).bind(alertId, wishlistItem.id, targetPrice, notificationMethod).run();
    }

    await logEvent(env, 'WISHLIST_ALERT_SET', 
      `User ${user.id} set price alert for product ${productId} at ${targetPrice}`, user.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Price alert set successfully',
      alertId: alertId,
      targetPrice: targetPrice,
      currentPrice: product?.price || 0,
      notificationMethod: notificationMethod
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error setting price alert:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * DELETE /api/wishlist/alert/:alertId
 * Remove price alert
 */
export async function handleRemovePriceAlert(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ALLOWED_ROLES);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const alertId = url.pathname.split('/')[4];

    if (!alertId) {
      return new Response(JSON.stringify({ error: 'Alert ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify ownership
    const alert = await env.DB.prepare(`
      SELECT wa.id, w.user_id 
      FROM wishlist_alerts wa
      JOIN wishlist w ON wa.wishlist_id = w.id
      WHERE wa.id = ? AND w.user_id = ?
    `).bind(alertId, user.id).first();

    if (!alert) {
      return new Response(JSON.stringify({ error: 'Alert not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await env.DB.prepare(`
      UPDATE wishlist_alerts 
      SET active = 0, updated_at = datetime('now') 
      WHERE id = ?
    `).bind(alertId).run();

    await logEvent(env, 'WISHLIST_ALERT_REMOVED', 
      `User ${user.id} removed price alert ${alertId}`, user.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Price alert removed'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error removing price alert:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * POST /api/wishlist/alert/check
 * Check all active price alerts and trigger notifications
 * This should be called by a scheduled job
 */
export async function handleCheckPriceAlerts(request, env, ctx, corsHeaders) {
  try {
    const now = new Date().toISOString();
    
    // Get all active alerts with product prices
    const alerts = await env.DB.prepare(`
      SELECT 
        wa.*,
        w.user_id,
        w.product_id,
        p.price as current_price,
        p.name as product_name,
        u.name as user_name,
        u.email as user_email
      FROM wishlist_alerts wa
      JOIN wishlist w ON wa.wishlist_id = w.id
      JOIN products p ON w.product_id = p.id
      JOIN users u ON w.user_id = u.id
      WHERE wa.active = 1 
        AND p.price <= wa.target_price
        AND wa.triggered_at IS NULL
    `).all();

    const triggered = [];

    for (const alert of (alerts.results || [])) {
      // Mark as triggered
      await env.DB.prepare(`
        UPDATE wishlist_alerts 
        SET triggered_at = datetime('now'), updated_at = datetime('now') 
        WHERE id = ?
      `).bind(alert.id).run();

      triggered.push({
        alertId: alert.id,
        userId: alert.user_id,
        productId: alert.product_id,
        productName: alert.product_name,
        currentPrice: alert.current_price,
        targetPrice: alert.target_price,
        email: alert.user_email,
        name: alert.user_name
      });

      // Here you would send notifications (email, push, etc.)
      // await sendPriceDropEmail(alert.user_email, alert.product_name, alert.current_price, alert.target_price);
    }

    await logEvent(env, 'WISHLIST_ALERT_CHECK', 
      `Checked ${alerts.results?.length || 0} price alerts, ${triggered.length} triggered`, 'system');

    return new Response(JSON.stringify({
      success: true,
      checked: alerts.results?.length || 0,
      triggered: triggered.length,
      alerts: triggered
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error checking price alerts:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * ================================================================
 * WISHLIST SHARING
 * ================================================================
 */

/**
 * POST /api/wishlist/share
 * Generate shareable link for wishlist
 */
export async function handleShareWishlist(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ALLOWED_ROLES);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { expiresInDays = 7 } = body || {};

    // Check if active share exists
    const existing = await env.DB.prepare(`
      SELECT share_token, expires_at FROM wishlist_shares 
      WHERE user_id = ? AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(user.id, Date.now()).first();

    if (existing) {
      return new Response(JSON.stringify({
        success: true,
        shareUrl: `https://primeshieldhub.com/wishlist/share/${existing.share_token}`,
        token: existing.share_token,
        expiresAt: existing.expires_at,
        alreadyExists: true
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const shareToken = uuidv4();
    const expiresAt = Date.now() + (expiresInDays * 24 * 60 * 60 * 1000);

    await env.DB.prepare(`
      INSERT INTO wishlist_shares (
        id, user_id, share_token, expires_at, created_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(uuidv4(), user.id, shareToken, expiresAt).run();

    await logEvent(env, 'WISHLIST_SHARE', 
      `User ${user.id} created shareable wishlist link`, user.id);

    return new Response(JSON.stringify({
      success: true,
      shareUrl: `https://primeshieldhub.com/wishlist/share/${shareToken}`,
      token: shareToken,
      expiresAt: expiresAt,
      expiresInDays: expiresInDays
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error sharing wishlist:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * GET /api/wishlist/share/:token
 * Get shared wishlist (public - no auth required)
 */
export async function handleGetSharedWishlist(request, env, ctx, corsHeaders) {
  try {
    const url = new URL(request.url);
    const token = url.pathname.split('/')[4];

    if (!token) {
      return new Response(JSON.stringify({ error: 'Share token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify share token
    const share = await env.DB.prepare(`
      SELECT user_id, expires_at FROM wishlist_shares 
      WHERE share_token = ? AND expires_at > ?
    `).bind(token, Date.now()).first();

    if (!share) {
      return new Response(JSON.stringify({ error: 'Share link expired or invalid' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ✅ FIXED: Removed "active = 1" condition
    const items = await env.DB.prepare(`
      SELECT 
        w.product_id,
        w.priority,
        w.notes,
        p.name,
        p.price,
        p.original_price,
        p.image,
        p.description,
        p.category,
        p.rating
      FROM wishlist w
      LEFT JOIN products p ON w.product_id = p.id
      WHERE w.user_id = ?
      ORDER BY 
        CASE w.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END
    `).bind(share.user_id).all();

    // Get user info for display
    const user = await env.DB.prepare(`
      SELECT name, email FROM users WHERE id = ?
    `).bind(share.user_id).first();

    return new Response(JSON.stringify({
      success: true,
      items: items.results || [],
      sharedBy: user?.name || 'A PrimeShieldHub customer',
      expiresAt: share.expires_at,
      totalItems: (items.results || []).length
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error getting shared wishlist:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * DELETE /api/wishlist/share/:token
 * Revoke shareable link
 */
export async function handleRevokeShare(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ALLOWED_ROLES);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const token = url.pathname.split('/')[4];

    if (!token) {
      return new Response(JSON.stringify({ error: 'Share token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const result = await env.DB.prepare(`
      DELETE FROM wishlist_shares 
      WHERE share_token = ? AND user_id = ?
    `).bind(token, user.id).run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: 'Share link not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await logEvent(env, 'WISHLIST_SHARE_REVOKED', 
      `User ${user.id} revoked shareable wishlist link`, user.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Share link revoked'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error revoking share:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * ================================================================
 * BULK OPERATIONS
 * ================================================================
 */

/**
 * POST /api/wishlist/bulk/add
 * Add multiple items to wishlist
 */
export async function handleBulkAddToWishlist(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ALLOWED_ROLES);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { products } = body || {};

    if (!products || !Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ error: 'Products array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const results = [];
    const errors = [];

    for (const item of products) {
      try {
        const { productId, priority = 'medium', notes = '' } = item;
        
        if (!productId) {
          errors.push({ productId, error: 'Product ID is required' });
          continue;
        }

        // Verify product exists
        const product = await env.DB.prepare(`
          SELECT id FROM products WHERE id = ? AND active = 1
        `).bind(productId).first();

        if (!product) {
          errors.push({ productId, error: 'Product not found or inactive' });
          continue;
        }

        // ✅ FIXED: Removed "active = 1" condition
        const existing = await env.DB.prepare(`
          SELECT id FROM wishlist 
          WHERE user_id = ? AND product_id = ?
        `).bind(user.id, productId).first();

        if (existing) {
          results.push({ productId, status: 'already_exists' });
          continue;
        }

        const wishlistId = uuidv4();
        await env.DB.prepare(`
          INSERT INTO wishlist (
            id, user_id, product_id, priority, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(wishlistId, user.id, productId, priority, notes).run();

        results.push({ productId, status: 'added', wishlistId });
      } catch (err) {
        errors.push({ productId: item.productId, error: err.message });
      }
    }

    await logEvent(env, 'WISHLIST_BULK_ADD', 
      `User ${user.id} bulk added ${results.filter(r => r.status === 'added').length} items to wishlist`, user.id);

    return new Response(JSON.stringify({
      success: true,
      added: results.filter(r => r.status === 'added').length,
      alreadyExists: results.filter(r => r.status === 'already_exists').length,
      errors: errors,
      results: results
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error bulk adding to wishlist:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * POST /api/wishlist/clear
 * Clear all items from wishlist
 */
export async function handleClearWishlist(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ALLOWED_ROLES);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // ✅ FIXED: Use DELETE instead of UPDATE since no active column
    const result = await env.DB.prepare(`
      DELETE FROM wishlist 
      WHERE user_id = ?
    `).bind(user.id).run();

    // Deactivate all alerts
    await env.DB.prepare(`
      UPDATE wishlist_alerts 
      SET active = 0, updated_at = datetime('now') 
      WHERE wishlist_id IN (
        SELECT id FROM wishlist WHERE user_id = ?
      )
    `).bind(user.id).run();

    await logEvent(env, 'WISHLIST_CLEAR', 
      `User ${user.id} cleared wishlist (${result.changes || 0} items)`, user.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Wishlist cleared',
      itemsRemoved: result.changes || 0
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * ================================================================
 * STATISTICS
 * ================================================================
 */

/**
 * GET /api/wishlist/stats
 * Get wishlist statistics
 */
export async function handleWishlistStats(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ALLOWED_ROLES);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // ✅ FIXED: Removed "active = 1" condition
    const total = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM wishlist 
      WHERE user_id = ?
    `).bind(user.id).first();

    // Priority breakdown - no active column needed
    const priorities = await env.DB.prepare(`
      SELECT priority, COUNT(*) as count 
      FROM wishlist 
      WHERE user_id = ? 
      GROUP BY priority
    `).bind(user.id).all();

    // Total potential value
    const value = await env.DB.prepare(`
      SELECT SUM(p.price) as total 
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      WHERE w.user_id = ?
    `).bind(user.id).first();

    // Active alerts
    const alerts = await env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM wishlist_alerts wa
      JOIN wishlist w ON wa.wishlist_id = w.id
      WHERE w.user_id = ? AND wa.active = 1
    `).bind(user.id).first();

    // Build priority map
    const priorityMap = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    for (const p of (priorities.results || [])) {
      priorityMap[p.priority] = p.count;
    }

    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalItems: total?.count || 0,
        totalValue: value?.total || 0,
        activeAlerts: alerts?.count || 0,
        priorities: priorityMap
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error getting wishlist stats:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * ================================================================
 * EXPORT ALL HANDLERS
 * ================================================================
 */

export default {
  handleGetWishlist,
  handleAddToWishlist,
  handleRemoveFromWishlist,
  handleUpdatePriority,
  handleUpdateNotes,
  handleSetPriceAlert,
  handleRemovePriceAlert,
  handleCheckPriceAlerts,
  handleShareWishlist,
  handleGetSharedWishlist,
  handleRevokeShare,
  handleBulkAddToWishlist,
  handleClearWishlist,
  handleWishlistStats
};
