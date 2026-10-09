// ======================================================================
// CHAT HANDLERS - ENHANCED v2.0
// Supports: Public Rooms, Private Rooms, Product Intelligence, Spell Correction
// ======================================================================

import { requireAuth } from '../middleware/auth.js';

// ======================================================================
// UTILITY FUNCTIONS - Spell Correction & Product Intelligence
// ======================================================================

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Similarity score between two strings (0-1)
 */
function similarityScore(a, b) {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

/**
 * Common misspellings dictionary for product names
 */
const MISSPELLINGS = {
  'iphone': ['iphne', 'iphon', 'iph0ne', 'iph', 'ip', 'ihpone', 'ipone', 'apple phone'],
  'samsung': ['sumsung', 'samsing', 'samsng', 'samsun', 'sam', 'smasung', 'sansung'],
  'macbook': ['macbok', 'macbk', 'mbp', 'mac', 'mackbook', 'macbook pro'],
  'galaxy': ['galax', 'galxy', 'gal', 'glaxy', 'gallaxy'],
  'tecno': ['tecnno', 'tecno', 'tec', 'tekno', 'teckno'],
  'phantom': ['phandom', 'fantom', 'phan', 'phantom'],
  'airpods': ['airpod', 'airpods', 'airpodz', 'air', 'earpods', 'airpods pro'],
  'power': ['power', 'p0wer', 'powr', 'pw', 'powe'],
  'battery': ['battery', 'batery', 'batt', 'baterry'],
  'charger': ['charger', 'chager', 'charg', 'chareger'],
  'cement': ['cement', 'ciment', 'cemnt', 'cment'],
  'paint': ['paint', 'pint', 'pait', 'peint'],
  'roofing': ['roofing', 'roofng', 'roof', 'rufing'],
  'hardware': ['hardware', 'hardwar', 'hard', 'hardwear'],
  'dangote': ['dangote', 'dangot', 'dang'],
  'dulux': ['dulux', 'dulux', 'dul'],
  'berger': ['berger', 'bergar', 'ber'],
  'bosch': ['bosch', 'bosh', 'bosc'],
  'dewalt': ['dewalt', 'dewal', 'de walt']
};

/**
 * Product knowledge base
 */
const PRODUCT_KNOWLEDGE = {
  'iphone': { brand: 'Apple', category: 'Smartphones', price_range: '₦950,000 - ₦1,450,000' },
  'samsung': { brand: 'Samsung', category: 'Smartphones', price_range: '₦950,000 - ₦1,350,000' },
  'macbook': { brand: 'Apple', category: 'Laptops', price_range: '₦1,200,000 - ₦2,850,000' },
  'tecno': { brand: 'Tecno', category: 'Smartphones', price_range: '₦200,000 - ₦950,000' },
  'airpods': { brand: 'Apple', category: 'Accessories', price_range: '₦150,000 - ₦350,000' },
  'dangote': { brand: 'Dangote', category: 'Cement', price_range: '₦6,500 - ₦8,500/bag' },
  'dulux': { brand: 'Dulux', category: 'Paints', price_range: '₦2,500 - ₦15,000' },
  'berger': { brand: 'Berger', category: 'Paints', price_range: '₦2,500 - ₦12,000' },
  'bosch': { brand: 'Bosch', category: 'Tools', price_range: '₦15,000 - ₦250,000' },
  'dewalt': { brand: 'DeWalt', category: 'Tools', price_range: '₦20,000 - ₦300,000' }
};

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
  const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'for', 'of', 'with', 'on', 'at', 'from', 'by', 'in', 'about', 'like', 'do', 'you', 'have', 'got', 'any', 'me', 'tell', 'show', 'price', 'cost', 'much', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'will', 'would', 'could', 'should', 'may', 'might'];
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  return words.filter(w => w.length > 2 && !stopWords.includes(w));
}

/**
 * Correct spelling of product names
 */
function correctSpelling(word) {
  if (!word || word.length < 3) return null;
  const lower = word.toLowerCase();
  
  // Check exact misspellings
  for (const [correct, misspellings] of Object.entries(MISSPELLINGS)) {
    if (misspellings.some(m => m === lower || lower.includes(m))) {
      return { original: word, corrected: correct, confidence: 0.95 };
    }
  }
  
  // Fuzzy match
  let bestMatch = null;
  let bestScore = 0;
  for (const [correct, misspellings] of Object.entries(MISSPELLINGS)) {
    const score = similarityScore(lower, correct);
    if (score > 0.7 && score > bestScore) {
      bestScore = score;
      bestMatch = correct;
    }
    for (const misspelling of misspellings) {
      const msScore = similarityScore(lower, misspelling);
      if (msScore > 0.6 && msScore > bestScore) {
        bestScore = msScore;
        bestMatch = correct;
      }
    }
  }
  
  if (bestMatch && bestScore > 0.7) {
    return { original: word, corrected: bestMatch, confidence: Math.round(bestScore * 100) };
  }
  return null;
}

/**
 * Detect product intent in message
 */
function detectProductIntent(text) {
  const productKeywords = ['phone', 'iphone', 'samsung', 'galaxy', 'macbook', 'tecno', 'airpods', 'gadget', 'device', 'laptop', 'tablet', 'accessory', 'charger', 'cable', 'case', 'screen protector', 'earphone', 'speaker', 'watch', 'band', 'power bank', 'battery', 'camera', 'drone', 'headset', 'keyboard', 'mouse', 'monitor', 'printer', 'router', 'modem', 'tv', 'projector', 'soundbar', 'subwoofer', 'amplifier', 'mixer', 'microphone', 'stand', 'mount', 'adapter', 'hub', 'dock', 'bag', 'backpack', 'sleeve', 'cover', 'film', 'tempered glass', 'cement', 'roofing', 'paint', 'pipe', 'tool', 'timber', 'hardware', 'tile', 'gas', 'cylinder', 'construction', 'building', 'material'];
  const lower = text.toLowerCase();
  return productKeywords.some(kw => lower.includes(kw));
}

/**
 * Get product suggestion from knowledge base
 */
function getProductSuggestion(query) {
  const lower = query.toLowerCase();
  const matches = [];
  for (const [product, info] of Object.entries(PRODUCT_KNOWLEDGE)) {
    if (lower.includes(product) || product.includes(lower)) {
      matches.push({ name: product, info });
    }
  }
  const words = extractKeywords(query);
  for (const word of words) {
    const corrected = correctSpelling(word);
    if (corrected) {
      const info = PRODUCT_KNOWLEDGE[corrected.corrected.toLowerCase()];
      if (info) {
        matches.push({ 
          name: corrected.corrected, 
          info, 
          correction: corrected.original,
          confidence: corrected.confidence 
        });
      }
    }
  }
  return matches;
}

/**
 * Format product suggestion as HTML response
 */
function formatProductSuggestion(productMatches) {
  if (productMatches.length === 0) return '';
  
  const match = productMatches[0];
  let html = `<div style="background:rgba(214,178,94,0.06);border:1px solid rgba(214,178,94,0.15);border-radius:12px;padding:12px;margin:8px 0;">`;
  html += `<p style="margin:0;font-size:0.85rem;"><strong>📦 Product Detected: ${match.name}</strong></p>`;
  html += `<p style="margin:4px 0 0;font-size:0.75rem;color:var(--text-muted);">`;
  html += `Category: ${match.info.category} • Price Range: ${match.info.price_range}`;
  if (match.correction) {
    html += ` <span style="color:var(--accent-warning);">(corrected from "${match.correction}")</span>`;
  }
  html += `</p></div>`;
  return html;
}

// ======================================================================
// GET CHAT ROOMS - ENHANCED
// ======================================================================

export async function handleGetRooms(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Get public rooms with permissions
    const publicRooms = await env.DB.prepare(
      `SELECT r.*, 
        (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id = r.id AND m.created_at > datetime('now', '-7 days')) as message_count,
        (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id = r.id AND NOT EXISTS (
          SELECT 1 FROM chat_read_receipts rr WHERE rr.message_id = m.id AND rr.user_id = ?
        ) AND m.sender_id != ?) as unread_count,
        (SELECT can_post FROM chat_room_permissions p WHERE p.room_id = r.id AND (p.user_id = ? OR p.user_id IS NULL) ORDER BY p.user_id DESC LIMIT 1) as can_post,
        (SELECT can_read FROM chat_room_permissions p WHERE p.room_id = r.id AND (p.user_id = ? OR p.user_id IS NULL) ORDER BY p.user_id DESC LIMIT 1) as can_read
       FROM chat_rooms r
       WHERE r.is_active = 1 AND r.type != 'private'
       ORDER BY r.type = 'announcement' DESC, r.created_at ASC`
    ).bind(user.id, user.id, user.id, user.id).all();

    // Get private rooms (DMs and group chats)
    const privateRooms = await env.DB.prepare(
      `SELECT 
        pr.id,
        pr.room_name,
        pr.is_group,
        pr.created_at,
        pr.updated_at,
        (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id = pr.id AND m.created_at > datetime('now', '-7 days')) as message_count,
        (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id = pr.id AND NOT EXISTS (
          SELECT 1 FROM chat_read_receipts rr WHERE rr.message_id = m.id AND rr.user_id = ?
        ) AND m.sender_id != ?) as unread_count,
        (SELECT name FROM users WHERE id = (
          SELECT user_id FROM chat_private_members 
          WHERE room_id = pr.id AND user_id != ? LIMIT 1
        )) as other_user_name,
        (SELECT id FROM users WHERE id = (
          SELECT user_id FROM chat_private_members 
          WHERE room_id = pr.id AND user_id != ? LIMIT 1
        )) as other_user_id,
        (SELECT count(*) FROM chat_private_members WHERE room_id = pr.id) as member_count
       FROM chat_private_rooms pr
       INNER JOIN chat_private_members pm ON pr.id = pm.room_id
       WHERE pm.user_id = ?
       ORDER BY pr.updated_at DESC`
    ).bind(user.id, user.id, user.id, user.id, user.id).all();

    return new Response(JSON.stringify({
      success: true,
      publicRooms: publicRooms.results || [],
      privateRooms: privateRooms.results || []
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Get rooms error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// GET ROOM MESSAGES - ENHANCED with Product Detection
// ======================================================================

export async function handleGetMessages(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const roomId = url.searchParams.get('roomId');
    const roomType = url.searchParams.get('type') || 'public';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const before = url.searchParams.get('before');

    if (!roomId) {
      return new Response(JSON.stringify({ error: 'Room ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check permissions for public rooms
    if (roomType === 'public') {
      const permission = await env.DB.prepare(
        `SELECT can_read FROM chat_room_permissions 
         WHERE room_id = ? AND (user_id = ? OR user_id IS NULL)
         ORDER BY user_id DESC LIMIT 1`
      ).bind(roomId, user.id).first();
      
      if (!permission || !permission.can_read) {
        return new Response(JSON.stringify({ error: 'No permission to read this room' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Check private room membership
    if (roomType === 'private') {
      const member = await env.DB.prepare(
        `SELECT user_id FROM chat_private_members WHERE room_id = ? AND user_id = ?`
      ).bind(roomId, user.id).first();
      
      if (!member) {
        return new Response(JSON.stringify({ error: 'Not a member of this private room' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    let query = `
      SELECT m.*, u.name as sender_name, u.role as sender_role,
        EXISTS (SELECT 1 FROM chat_read_receipts WHERE message_id = m.id AND user_id = ?) as is_read
      FROM chat_messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.room_id = ?
    `;
    const params = [user.id, roomId];

    if (before) {
      query += ` AND m.created_at < ?`;
      params.push(before);
    }

    query += ` ORDER BY m.created_at DESC LIMIT ?`;
    params.push(limit);

    const messages = await env.DB.prepare(query).bind(...params).all();
    
    // Process messages for product detection
    const processedMessages = (messages.results || []).map(msg => {
      // Check if message contains product mentions
      const productMatches = getProductSuggestion(msg.message || '');
      return {
        ...msg,
        productMatches: productMatches.slice(0, 3) // Limit to top 3
      };
    });

    return new Response(JSON.stringify({
      success: true,
      messages: processedMessages
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Get messages error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// SEND MESSAGE - ENHANCED with Product Intelligence
// ======================================================================

export async function handleSendMessage(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { roomId, message, type, roomType, fileUrl, fileName, fileSize } = body || {};

    if (!roomId || !message) {
      return new Response(JSON.stringify({ error: 'Room ID and message required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ===== STEP 1: Ensure sender exists =====
    let userCheck = await env.DB.prepare(
      "SELECT id FROM users WHERE id = ?"
    ).bind(user.id).first();
   
    if (!userCheck) {
      console.log(`[Chat] User ${user.id} not found, inserting...`);
      await env.DB.prepare(
        `INSERT OR IGNORE INTO users (id, name, email, role, status)
         VALUES (?, ?, ?, ?, 'active')`
      ).bind(
        user.id,
        user.name || 'Staff',
        user.email || `${user.id}@primeshieldhub.com`,
        user.role || 'staff'
      ).run();
    }

    // ===== STEP 2: Check permissions for public rooms =====
    if (roomType === 'public' || !roomType) {
      const permission = await env.DB.prepare(
        `SELECT can_post FROM chat_room_permissions
         WHERE room_id = ? AND (user_id = ? OR user_id IS NULL)
         ORDER BY user_id DESC LIMIT 1`
      ).bind(roomId, user.id).first();
     
      if (!permission || !permission.can_post) {
        return new Response(JSON.stringify({ error: 'No permission to post in this room' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // ===== STEP 3: For private rooms, handle room and recipient =====
    let recipientId = user.id;

    if (roomType === 'private') {
      const member = await env.DB.prepare(
        `SELECT user_id FROM chat_private_members WHERE room_id = ? AND user_id = ?`
      ).bind(roomId, user.id).first();
     
      if (!member) {
        return new Response(JSON.stringify({ error: 'Not a member of this private room' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
     
      const roomCheck = await env.DB.prepare(
        "SELECT id FROM chat_rooms WHERE id = ?"
      ).bind(roomId).first();
     
      if (!roomCheck) {
        console.log(`[Chat] Private room ${roomId} not in chat_rooms, inserting...`);
       
        const privateRoom = await env.DB.prepare(
          "SELECT room_name, is_group FROM chat_private_rooms WHERE id = ?"
        ).bind(roomId).first();
       
        const roomName = privateRoom?.room_name || 'Private Chat';
        const roomTypeDb = privateRoom?.is_group ? 'group' : 'private';
       
        await env.DB.prepare(
          `INSERT OR IGNORE INTO chat_rooms (id, name, type, is_active, created_at, updated_at)
           VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`
        ).bind(roomId, roomName, roomTypeDb).run();
       
        console.log(`[Chat] ✅ Private room ${roomId} added to chat_rooms`);
      }
      
      const recipient = await env.DB.prepare(
        `SELECT user_id FROM chat_private_members 
         WHERE room_id = ? AND user_id != ? 
         LIMIT 1`
      ).bind(roomId, user.id).first();
      
      recipientId = recipient?.user_id || user.id;
      console.log(`[Chat] Private message recipient: ${recipientId}`);
    }

    // ===== STEP 4: Detect product mentions in message =====
    const productMatches = getProductSuggestion(message);
    const hasProductMention = productMatches.length > 0;
    const productContext = hasProductMention ? JSON.stringify(productMatches) : null;

    // ===== STEP 5: Insert message =====
    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    const result = await env.DB.prepare(
      `INSERT INTO chat_messages
       (id, room_id, sender_id, recipient_id, message, message_type, file_url, file_name, file_size, product_context, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      messageId,
      roomId,
      user.id,
      recipientId,
      message,
      type || 'text',
      fileUrl || null,
      fileName || null,
      fileSize || null,
      productContext,
      now
    ).run();

    console.log(`[Chat] ✅ Message inserted: ${messageId}, recipient: ${recipientId}`);

    // Update private room last activity
    if (roomType === 'private') {
      await env.DB.prepare(
        `UPDATE chat_private_rooms SET updated_at = ? WHERE id = ?`
      ).bind(now, roomId).run();
    }

    // Get the message with sender info
    const messageResult = await env.DB.prepare(
      `SELECT m.*, u.name as sender_name, u.role as sender_role
       FROM chat_messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`
    ).bind(messageId).first();

    // ===== STEP 6: Generate product response if product detected =====
    let productResponse = null;
    if (hasProductMention && productMatches.length > 0) {
      const match = productMatches[0];
      const info = match.info || PRODUCT_KNOWLEDGE[match.name.toLowerCase()];
      if (info) {
        productResponse = {
          detected: match.name,
          category: info.category,
          price_range: info.price_range,
          correction: match.correction || null,
          confidence: match.confidence || null
        };
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: messageResult,
      productResponse: productResponse,
      productMatches: productMatches.slice(0, 5)
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Send message error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// CREATE PRIVATE ROOM - ENHANCED
// ======================================================================

export async function handleCreatePrivateRoom(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { targetUserId, roomName, isGroup, memberIds } = body || {};

    if (!targetUserId && !isGroup) {
      return new Response(JSON.stringify({ error: 'Target user ID required for direct messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if target user exists
    if (!isGroup) {
      const targetUser = await env.DB.prepare(
        "SELECT id, name FROM users WHERE id = ?"
      ).bind(targetUserId).first();

      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'Target user not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // For 1-on-1 DMs, check if a room already exists
    if (!isGroup) {
      const existing = await env.DB.prepare(
        `SELECT pr.id FROM chat_private_rooms pr
         INNER JOIN chat_private_members pm1 ON pr.id = pm1.room_id
         INNER JOIN chat_private_members pm2 ON pr.id = pm2.room_id
         WHERE pr.is_group = 0 
         AND pm1.user_id = ? AND pm2.user_id = ?
         AND (SELECT COUNT(*) FROM chat_private_members WHERE room_id = pr.id) = 2`
      ).bind(user.id, targetUserId).first();

      if (existing) {
        return new Response(JSON.stringify({
          success: true,
          roomId: existing.id,
          message: 'Private room already exists'
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Create the private room
    const roomId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Get target user name for room name
    let targetName = '';
    if (!isGroup && targetUserId) {
      const targetUser = await env.DB.prepare(
        "SELECT name FROM users WHERE id = ?"
      ).bind(targetUserId).first();
      targetName = targetUser?.name || 'User';
    }

    const roomNameFinal = roomName || (isGroup ? 'Group Chat' : `DM: ${user.name} & ${targetName}`);

    // Insert into chat_private_rooms
    await env.DB.prepare(
      `INSERT INTO chat_private_rooms (id, room_name, is_group, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      roomId,
      roomNameFinal,
      isGroup ? 1 : 0,
      user.id,
      now,
      now
    ).run();

    // Add members
    const members = [user.id];
    if (!isGroup && targetUserId) {
      members.push(targetUserId);
    } else if (isGroup && memberIds && Array.isArray(memberIds)) {
      members.push(...memberIds);
    } else if (isGroup && targetUserId) {
      members.push(targetUserId);
    }

    for (const memberId of members) {
      await env.DB.prepare(
        `INSERT INTO chat_private_members (room_id, user_id, joined_at)
         VALUES (?, ?, ?)`
      ).bind(roomId, memberId, now).run();
    }

    // Also insert into chat_rooms
    const roomType = isGroup ? 'group' : 'private';
    await env.DB.prepare(
      `INSERT OR IGNORE INTO chat_rooms (id, name, type, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`
    ).bind(
      roomId,
      roomNameFinal,
      roomType,
      now,
      now
    ).run();

    // Return the room details
    const roomDetails = await env.DB.prepare(
      `SELECT 
        pr.id,
        pr.room_name,
        pr.is_group,
        pr.created_at,
        pr.updated_at,
        (SELECT count(*) FROM chat_private_members WHERE room_id = pr.id) as member_count
       FROM chat_private_rooms pr
       WHERE pr.id = ?`
    ).bind(roomId).first();

    return new Response(JSON.stringify({
      success: true,
      roomId: roomId,
      room: roomDetails,
      message: 'Private room created successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Create private room error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// GET PRIVATE ROOMS - ENHANCED
// ======================================================================

export async function handleGetPrivateRooms(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const rooms = await env.DB.prepare(
      `SELECT 
        pr.id,
        pr.room_name,
        pr.is_group,
        pr.created_at,
        pr.updated_at,
        (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id = pr.id AND m.created_at > datetime('now', '-7 days')) as message_count,
        (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id = pr.id AND m.read_at IS NULL AND m.sender_id != ?) as unread_count,
        (SELECT COUNT(*) FROM chat_private_members WHERE room_id = pr.id) as member_count
       FROM chat_private_rooms pr
       INNER JOIN chat_private_members pm ON pr.id = pm.room_id
       WHERE pm.user_id = ?
       ORDER BY pr.updated_at DESC`
    ).bind(user.id, user.id).all();

    const results = [];
    for (const room of rooms.results || []) {
      const members = await env.DB.prepare(
        `SELECT u.id, u.name, u.role, u.status 
         FROM chat_private_members pm
         INNER JOIN users u ON pm.user_id = u.id
         WHERE pm.room_id = ?`
      ).bind(room.id).all();
      
      const otherUser = (members.results || []).find(m => m.id !== user.id);
      
      let displayName = room.room_name;
      if (!displayName || displayName === 'undefined' || displayName === 'null') {
        displayName = otherUser ? `DM: ${otherUser.name}` : 'Private Chat';
      }
      
      results.push({
        ...room,
        room_name: displayName,
        other_user_name: otherUser?.name || 'Unknown',
        other_user_id: otherUser?.id || null,
        members: members.results || []
      });
    }

    return new Response(JSON.stringify({
      success: true,
      rooms: results
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Get private rooms error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// GET ALL USERS (for DM creation) - ENHANCED
// ======================================================================

export async function handleGetUsersForChat(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const users = await env.DB.prepare(
      `SELECT id, name, email, role, status 
       FROM users 
       WHERE role IN ('staff', 'admin') AND id != ? AND status = 'active'
       ORDER BY name ASC`
    ).bind(user.id).all();

    // Add online status
    const onlineUsers = await env.DB.prepare(
      `SELECT DISTINCT user_id FROM chat_read_receipts 
       WHERE read_at > datetime('now', '-5 minutes')`
    ).all();
    const onlineIds = new Set((onlineUsers.results || []).map(u => u.user_id));

    const usersWithStatus = (users.results || []).map(u => ({
      ...u,
      isOnline: onlineIds.has(u.id)
    }));

    return new Response(JSON.stringify({
      success: true,
      users: usersWithStatus
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Get users error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// MARK MESSAGES AS READ - ENHANCED
// ======================================================================

export async function handleMarkRead(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { messageId, roomId, roomType } = body || {};

    if (!messageId && !roomId) {
      return new Response(JSON.stringify({ error: 'Message ID or Room ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Update last read for private rooms
    if (roomType === 'private' && roomId) {
      await env.DB.prepare(
        `UPDATE chat_private_members SET last_read_at = datetime('now') 
         WHERE room_id = ? AND user_id = ?`
      ).bind(roomId, user.id).run();
    }

    // Update last read for public rooms
    if (roomType === 'public' && roomId) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO chat_read_receipts (message_id, user_id)
         SELECT id, ? FROM chat_messages WHERE room_id = ? AND sender_id != ? AND NOT EXISTS (
           SELECT 1 FROM chat_read_receipts WHERE message_id = chat_messages.id AND user_id = ?
         )`
      ).bind(user.id, roomId, user.id, user.id).run();
    }

    if (messageId) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO chat_read_receipts (message_id, user_id, read_at)
         VALUES (?, ?, datetime('now'))`
      ).bind(messageId, user.id).run();
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Messages marked as read'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Mark read error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// GET ONLINE USERS - ENHANCED
// ======================================================================

export async function handleGetOnlineUsers(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const users = await env.DB.prepare(
      `SELECT DISTINCT u.id, u.name, u.email, u.role,
        CASE WHEN rr.read_at > datetime('now', '-5 minutes') THEN 1 ELSE 0 END as is_online
       FROM users u
       LEFT JOIN chat_read_receipts rr ON u.id = rr.user_id
       WHERE u.role IN ('staff', 'admin')
       AND (rr.read_at > datetime('now', '-5 minutes') OR u.id = ?)
       GROUP BY u.id
       ORDER BY is_online DESC, u.name ASC`
    ).bind(user.id).all();

    const onlineCount = await env.DB.prepare(
      `SELECT COUNT(DISTINCT user_id) as count
       FROM chat_read_receipts 
       WHERE read_at > datetime('now', '-5 minutes')`
    ).first();

    return new Response(JSON.stringify({
      success: true,
      onlineCount: onlineCount?.count || 0,
      users: users.results || []
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Get online users error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// GET UNREAD COUNT - ENHANCED
// ======================================================================

export async function handleGetUnreadCount(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Unread for public rooms
    const publicCounts = await env.DB.prepare(
      `SELECT m.room_id, COUNT(*) as unread_count
       FROM chat_messages m
       WHERE NOT EXISTS (
         SELECT 1 FROM chat_read_receipts r 
         WHERE r.message_id = m.id AND r.user_id = ?
       )
       AND m.sender_id != ?
       AND EXISTS (
         SELECT 1 FROM chat_rooms cr 
         WHERE cr.id = m.room_id AND cr.is_active = 1 AND cr.type != 'private'
       )
       GROUP BY m.room_id`
    ).bind(user.id, user.id).all();

    // Unread for private rooms
    const privateCounts = await env.DB.prepare(
      `SELECT m.room_id, COUNT(*) as unread_count
       FROM chat_messages m
       INNER JOIN chat_private_members pm ON m.room_id = pm.room_id AND pm.user_id = ?
       WHERE NOT EXISTS (
         SELECT 1 FROM chat_read_receipts r 
         WHERE r.message_id = m.id AND r.user_id = ?
       )
       AND m.sender_id != ?
       GROUP BY m.room_id`
    ).bind(user.id, user.id, user.id).all();

    // Total unread across all rooms
    const total = await env.DB.prepare(
      `SELECT COUNT(*) as total
       FROM chat_messages m
       WHERE NOT EXISTS (
         SELECT 1 FROM chat_read_receipts r 
         WHERE r.message_id = m.id AND r.user_id = ?
       )
       AND m.sender_id != ?`
    ).bind(user.id, user.id).first();

    return new Response(JSON.stringify({
      success: true,
      publicCounts: publicCounts.results || [],
      privateCounts: privateCounts.results || [],
      total: total?.total || 0
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Get unread count error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// GET ROOM DETAILS - ENHANCED
// ======================================================================

export async function handleGetRoomDetails(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const roomId = url.searchParams.get('roomId');
    const roomType = url.searchParams.get('type') || 'public';

    if (!roomId) {
      return new Response(JSON.stringify({ error: 'Room ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    let room = null;

    if (roomType === 'public') {
      room = await env.DB.prepare(
        `SELECT r.*, 
          (SELECT can_post FROM chat_room_permissions p WHERE p.room_id = r.id AND (p.user_id = ? OR p.user_id IS NULL) ORDER BY p.user_id DESC LIMIT 1) as can_post,
          (SELECT can_read FROM chat_room_permissions p WHERE p.room_id = r.id AND (p.user_id = ? OR p.user_id IS NULL) ORDER BY p.user_id DESC LIMIT 1) as can_read
         FROM chat_rooms r
         WHERE r.id = ? AND r.is_active = 1`
      ).bind(user.id, user.id, roomId).first();
    } else if (roomType === 'private') {
      room = await env.DB.prepare(
        `SELECT pr.*, 
          (SELECT count(*) FROM chat_private_members WHERE room_id = pr.id) as member_count
         FROM chat_private_rooms pr
         INNER JOIN chat_private_members pm ON pr.id = pm.room_id
         WHERE pr.id = ? AND pm.user_id = ?`
      ).bind(roomId, user.id).first();
    }

    if (!room) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      room: room
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Get room details error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// DELETE MESSAGE (Admin only) - ENHANCED
// ======================================================================

export async function handleDeleteMessage(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized - Admin only' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const messageId = url.searchParams.get('messageId');

    if (!messageId) {
      return new Response(JSON.stringify({ error: 'Message ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await env.DB.prepare(
      `UPDATE chat_messages SET is_deleted = 1, deleted_at = datetime('now'), deleted_by = ?
       WHERE id = ?`
    ).bind(user.id, messageId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Message deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Delete message error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// GET ROOM MEMBERS (for private rooms) - ENHANCED
// ======================================================================

export async function handleGetRoomMembers(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const roomId = url.searchParams.get('roomId');

    if (!roomId) {
      return new Response(JSON.stringify({ error: 'Room ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const member = await env.DB.prepare(
      `SELECT user_id FROM chat_private_members WHERE room_id = ? AND user_id = ?`
    ).bind(roomId, user.id).first();

    if (!member) {
      return new Response(JSON.stringify({ error: 'Not a member of this room' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const members = await env.DB.prepare(
      `SELECT u.id, u.name, u.email, u.role, u.status,
        pm.joined_at,
        CASE WHEN rr.read_at > datetime('now', '-5 minutes') THEN 1 ELSE 0 END as is_online
       FROM chat_private_members pm
       INNER JOIN users u ON pm.user_id = u.id
       LEFT JOIN chat_read_receipts rr ON u.id = rr.user_id
       WHERE pm.room_id = ?
       ORDER BY is_online DESC, u.name ASC`
    ).bind(roomId).all();

    return new Response(JSON.stringify({
      success: true,
      members: members.results || []
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Get room members error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// ADD USER TO PRIVATE ROOM (Group chat) - ENHANCED
// ======================================================================

export async function handleAddRoomMember(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { roomId, userId: targetUserId } = body || {};

    if (!roomId || !targetUserId) {
      return new Response(JSON.stringify({ error: 'Room ID and user ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const room = await env.DB.prepare(
      `SELECT id, is_group FROM chat_private_rooms WHERE id = ?`
    ).bind(roomId).first();

    if (!room) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!room.is_group) {
      return new Response(JSON.stringify({ error: 'Cannot add members to a direct message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const existing = await env.DB.prepare(
      `SELECT user_id FROM chat_private_members WHERE room_id = ? AND user_id = ?`
    ).bind(roomId, targetUserId).first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'User is already a member' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const targetUser = await env.DB.prepare(
      "SELECT id FROM users WHERE id = ?"
    ).bind(targetUserId).first();

    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO chat_private_members (room_id, user_id, joined_at)
       VALUES (?, ?, ?)`
    ).bind(roomId, targetUserId, now).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'User added to room successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Add room member error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// REMOVE USER FROM PRIVATE ROOM (Group chat) - ENHANCED
// ======================================================================

export async function handleRemoveRoomMember(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['staff', 'admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { roomId, userId: targetUserId } = body || {};

    if (!roomId || !targetUserId) {
      return new Response(JSON.stringify({ error: 'Room ID and user ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const room = await env.DB.prepare(
      `SELECT id, is_group FROM chat_private_rooms WHERE id = ?`
    ).bind(roomId).first();

    if (!room) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!room.is_group) {
      return new Response(JSON.stringify({ error: 'Cannot remove members from a direct message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (targetUserId === user.id) {
      const memberCount = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM chat_private_members WHERE room_id = ?`
      ).bind(roomId).first();

      if (memberCount?.count <= 1) {
        return new Response(JSON.stringify({ error: 'Cannot leave a group with no members' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    await env.DB.prepare(
      `DELETE FROM chat_private_members WHERE room_id = ? AND user_id = ?`
    ).bind(roomId, targetUserId).run();

    const remaining = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM chat_private_members WHERE room_id = ?`
    ).bind(roomId).first();

    if (remaining?.count === 0) {
      await env.DB.prepare(
        `DELETE FROM chat_private_rooms WHERE id = ?`
      ).bind(roomId).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'User removed from room successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('[Chat] Remove room member error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ======================================================================
// EXPORT ALL HANDLERS
// ======================================================================

export default {
  handleGetRooms,
  handleGetMessages,
  handleSendMessage,
  handleCreatePrivateRoom,
  handleGetPrivateRooms,
  handleGetUsersForChat,
  handleMarkRead,
  handleGetOnlineUsers,
  handleGetUnreadCount,
  handleGetRoomDetails,
  handleDeleteMessage,
  handleGetRoomMembers,
  handleAddRoomMember,
  handleRemoveRoomMember
};
