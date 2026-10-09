// ======================================================================
// CHAT ROOM - Durable Object for Real-time Messaging
// ENHANCED: Spell Correction, Product Detection, Intelligence
// ======================================================================

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // sessionId -> { ws, userId, userName, userRole }
    this.roomId = state.id?.toString() || 'unknown';
    this.actualRoomId = null; // Will be set from X-Room-ID header
    this.messageQueue = [];
    this.isProcessing = false;
  }

  // ======================================================================
  // SPELL CORRECTION & PRODUCT DETECTION ENGINE
  // ======================================================================

  static MISSPELLINGS = {
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
    'dewalt': ['dewalt', 'dewal', 'de walt'],
    'makita': ['makita', 'makta', 'mak']
  };

  static PRODUCT_KNOWLEDGE = {
    'iphone': { brand: 'Apple', category: 'Smartphones', price_range: '₦950,000 - ₦1,450,000', emoji: '📱' },
    'samsung': { brand: 'Samsung', category: 'Smartphones', price_range: '₦950,000 - ₦1,350,000', emoji: '📱' },
    'macbook': { brand: 'Apple', category: 'Laptops', price_range: '₦1,200,000 - ₦2,850,000', emoji: '💻' },
    'tecno': { brand: 'Tecno', category: 'Smartphones', price_range: '₦200,000 - ₦950,000', emoji: '📱' },
    'airpods': { brand: 'Apple', category: 'Accessories', price_range: '₦150,000 - ₦350,000', emoji: '🎧' },
    'dangote': { brand: 'Dangote', category: 'Cement', price_range: '₦6,500 - ₦8,500/bag', emoji: '🏗️' },
    'dulux': { brand: 'Dulux', category: 'Paints', price_range: '₦2,500 - ₦15,000', emoji: '🎨' },
    'berger': { brand: 'Berger', category: 'Paints', price_range: '₦2,500 - ₦12,000', emoji: '🎨' },
    'bosch': { brand: 'Bosch', category: 'Tools', price_range: '₦15,000 - ₦250,000', emoji: '🔧' },
    'dewalt': { brand: 'DeWalt', category: 'Tools', price_range: '₦20,000 - ₦300,000', emoji: '🔧' },
    'makita': { brand: 'Makita', category: 'Tools', price_range: '₦15,000 - ₦200,000', emoji: '🔧' }
  };

  static levenshteinDistance(a, b) {
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

  static similarityScore(a, b) {
    const distance = ChatRoom.levenshteinDistance(a.toLowerCase(), b.toLowerCase());
    const maxLen = Math.max(a.length, b.length);
    return maxLen === 0 ? 1 : 1 - (distance / maxLen);
  }

  static correctSpelling(word) {
    if (!word || word.length < 3) return null;
    const lower = word.toLowerCase();
    
    // Check exact misspellings
    for (const [correct, misspellings] of Object.entries(ChatRoom.MISSPELLINGS)) {
      if (misspellings.some(m => m === lower || lower.includes(m))) {
        return { original: word, corrected: correct, confidence: 95 };
      }
    }
    
    // Fuzzy match
    let bestMatch = null;
    let bestScore = 0;
    for (const [correct] of Object.entries(ChatRoom.MISSPELLINGS)) {
      const score = ChatRoom.similarityScore(lower, correct);
      if (score > 0.7 && score > bestScore) {
        bestScore = score;
        bestMatch = correct;
      }
    }
    
    if (bestMatch && bestScore > 0.7) {
      return { original: word, corrected: bestMatch, confidence: Math.round(bestScore * 100) };
    }
    return null;
  }

  static extractKeywords(text) {
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'for', 'of', 'with', 'on', 'at', 'from', 'by', 'in', 'about', 'like', 'do', 'you', 'have', 'got', 'any', 'me', 'tell', 'show', 'price', 'cost', 'much'];
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
    return words.filter(w => w.length > 2 && !stopWords.includes(w));
  }

  static detectProductMentions(text) {
    const matches = [];
    const words = ChatRoom.extractKeywords(text);
    
    for (const word of words) {
      // Check for corrected spelling
      const corrected = ChatRoom.correctSpelling(word);
      if (corrected) {
        const info = ChatRoom.PRODUCT_KNOWLEDGE[corrected.corrected.toLowerCase()];
        if (info) {
          matches.push({
            detected: word,
            corrected: corrected.corrected,
            info: info,
            confidence: corrected.confidence,
            type: 'spell_correction'
          });
        }
      }
      
      // Check direct matches
      for (const [product, info] of Object.entries(ChatRoom.PRODUCT_KNOWLEDGE)) {
        if (word.includes(product) || product.includes(word)) {
          matches.push({
            detected: word,
            corrected: product,
            info: info,
            confidence: 90,
            type: 'direct_match'
          });
        }
      }
    }
    
    // Remove duplicates
    const seen = new Set();
    return matches.filter(m => {
      const key = m.corrected;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  static formatProductResponse(matches) {
    if (!matches || matches.length === 0) return null;
    
    const match = matches[0];
    const info = match.info;
    
    return {
      detected: match.corrected,
      brand: info.brand,
      category: info.category,
      price_range: info.price_range,
      emoji: info.emoji || '📦',
      confidence: match.confidence,
      correction: match.type === 'spell_correction' ? match.detected : null
    };
  }

  // ======================================================================
  // INITIALIZATION
  // ======================================================================

  async initialize() {
    const stored = await this.state.storage.get('messages');
    if (stored) {
      this.messageQueue = stored;
    }
    console.log(`[ChatRoom ${this.roomId}] Initialized with ${this.sessions.size} sessions`);
  }

  // ======================================================================
  // FETCH HANDLER
  // ======================================================================

  async fetch(request) {
    console.log(`[ChatRoom ${this.roomId}] fetch() called`);
    console.log(`[ChatRoom ${this.roomId}] URL:`, request.url);
    console.log(`[ChatRoom ${this.roomId}] Method:`, request.method);
    console.log(`[ChatRoom ${this.roomId}] Headers - Upgrade:`, request.headers.get('Upgrade'));
    console.log(`[ChatRoom ${this.roomId}] Headers - Connection:`, request.headers.get('Connection'));

    const actualRoomId = request.headers.get('X-Room-ID') || this.roomId;
    this.actualRoomId = actualRoomId;
    console.log(`[ChatRoom ${this.roomId}] Actual room ID:`, this.actualRoomId);

    const url = new URL(request.url);
    const path = url.pathname;

    const upgradeHeader = request.headers.get('Upgrade');
    
    if (upgradeHeader === 'websocket') {
      console.log(`[ChatRoom ${this.roomId}] WebSocket upgrade request detected! (path: ${path})`);
      return this.handleWebSocket(request);
    }

    if (path.endsWith('/messages') && request.method === 'GET') {
      return this.getMessages(request);
    }

    if (path.endsWith('/messages') && request.method === 'POST') {
      return this.sendMessage(request);
    }

    if (path.endsWith('/users') && request.method === 'GET') {
      return this.getUsers(request);
    }

    console.log(`[ChatRoom ${this.roomId}] Not a WebSocket request, returning 404 for path:`, path);
    return new Response('Not Found', { status: 404 });
  }

  // ======================================================================
  // WEBSOCKET HANDLER
  // ======================================================================

  async handleWebSocket(request) {
    console.log(`[ChatRoom ${this.roomId}] handleWebSocket() called`);
    
    try {
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      console.log(`[ChatRoom ${this.roomId}] WebSocket pair created`);

      const user = await this.getUserFromRequest(request);
      if (!user) {
        console.log(`[ChatRoom ${this.roomId}] User authentication failed`);
        return new Response('Unauthorized', { status: 401 });
      }

      console.log(`[ChatRoom ${this.roomId}] User authenticated:`, user.id, user.name);

      // Ensure user exists in database
      try {
        const db = this.env.DB;
        await db.prepare(
          `INSERT OR IGNORE INTO users (id, name, email, role, status) 
           VALUES (?, ?, ?, ?, 'active')`
        ).bind(
          user.id, 
          user.name || 'Staff', 
          user.email || `${user.name || 'staff'}@primeshieldhub.com`, 
          user.role || 'staff'
        ).run();
        console.log(`[ChatRoom ${this.roomId}] User ensured in DB:`, user.id);
      } catch (err) {
        console.warn(`[ChatRoom ${this.roomId}] Could not ensure user in DB:`, err.message);
      }

      // Ensure room exists in chat_rooms table
      try {
        const db = this.env.DB;
        const roomCheck = await db.prepare(
          "SELECT id FROM chat_rooms WHERE id = ?"
        ).bind(this.actualRoomId).first();
        
        if (!roomCheck) {
          console.log(`[ChatRoom ${this.roomId}] Room not found in chat_rooms, inserting...`);
          await db.prepare(
            `INSERT OR IGNORE INTO chat_rooms (id, name, type, description, is_active, created_at, updated_at)
             VALUES (?, ?, 'private', ?, 1, datetime('now'), datetime('now'))`
          ).bind(
            this.actualRoomId,
            `Chat Room`,
            `Private chat room`
          ).run();
          console.log(`[ChatRoom ${this.roomId}] Room inserted into chat_rooms`);
        } else {
          console.log(`[ChatRoom ${this.roomId}] Room exists in chat_rooms:`, roomCheck.id);
        }
      } catch (err) {
        console.warn(`[ChatRoom ${this.roomId}] Could not ensure room in DB:`, err.message);
      }

      server.accept();
      console.log(`[ChatRoom ${this.roomId}] WebSocket accepted`);

      const sessionId = crypto.randomUUID();
      this.sessions.set(sessionId, {
        ws: server,
        userId: user.id,
        userName: user.name || 'Staff',
        userRole: user.role || 'staff',
        userEmail: user.email || '',
        joinedAt: Date.now(),
        lastActive: Date.now()
      });

      console.log(`[ChatRoom ${this.roomId}] Session added:`, sessionId, 'Total sessions:', this.sessions.size);

      // Send welcome message
      try {
        server.send(JSON.stringify({
          type: 'system',
          action: 'welcome',
          data: {
            roomId: this.actualRoomId,
            sessionId: sessionId,
            user: { id: user.id, name: user.name, role: user.role },
            onlineCount: this.sessions.size,
            message: `Welcome to the chat, ${user.name}!`
          }
        }));
        console.log(`[ChatRoom ${this.roomId}] Welcome message sent`);
      } catch (err) {
        console.error(`[ChatRoom ${this.roomId}] Welcome message error:`, err);
      }

      // Send recent messages
      const recentMessages = await this.getRecentMessages(50);
      if (recentMessages.length > 0) {
        try {
          server.send(JSON.stringify({
            type: 'messages',
            action: 'history',
            data: recentMessages
          }));
          console.log(`[ChatRoom ${this.roomId}] History sent: ${recentMessages.length} messages`);
        } catch (err) {
          console.error(`[ChatRoom ${this.roomId}] History send error:`, err);
        }
      }

      // Broadcast user joined
      this.broadcast({
        type: 'system',
        action: 'user_joined',
        data: {
          userId: user.id,
          userName: user.name,
          onlineCount: this.sessions.size
        }
      }, sessionId);

      // Handle messages from this session
      server.addEventListener('message', async (event) => {
        try {
          const data = JSON.parse(event.data);
          await this.handleMessage(server, sessionId, user, data);
        } catch (error) {
          console.error(`[ChatRoom ${this.roomId}] Message error:`, error);
          try {
            server.send(JSON.stringify({
              type: 'error',
              data: { message: 'Failed to process message' }
            }));
          } catch (e) {}
        }
      });

      server.addEventListener('close', async () => {
        console.log(`[ChatRoom ${this.roomId}] WebSocket closing`);
        this.sessions.delete(sessionId);
        
        this.broadcast({
          type: 'system',
          action: 'user_left',
          data: {
            userId: user.id,
            userName: user.name,
            onlineCount: this.sessions.size
          }
        });

        console.log(`[ChatRoom ${this.roomId}] User ${user.name} disconnected, ${this.sessions.size} remaining`);
      });

      server.addEventListener('error', (event) => {
        console.error(`[ChatRoom ${this.roomId}] WebSocket error:`, event);
        this.sessions.delete(sessionId);
      });

      console.log(`[ChatRoom ${this.roomId}] Returning 101 Switching Protocols`);
      
      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });
      
    } catch (error) {
      console.error(`[ChatRoom ${this.roomId}] WebSocket handler error:`, error);
      return new Response('WebSocket upgrade failed: ' + error.message, { status: 500 });
    }
  }

  // ======================================================================
  // ENHANCED MESSAGE HANDLING with Product Detection & Spell Correction
  // ======================================================================

  async handleMessage(ws, sessionId, user, data) {
    const { type, action, payload } = data;

    // Ping/Pong for keep-alive
    if (type === 'ping') {
      try {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      } catch (e) {}
      return;
    }

    // Typing indicator
    if (type === 'typing') {
      this.broadcast({
        type: 'typing',
        action: 'typing',
        data: {
          userId: user.id,
          userName: user.name,
          isTyping: payload?.isTyping || false
        }
      }, sessionId);
      return;
    }

    // New message
    if (type === 'message') {
      let senderId = user.id;
      let senderName = user.name || 'Staff';
      let senderRole = user.role || 'staff';
      let senderEmail = user.email || '';

      if (!senderId) {
        console.error(`[ChatRoom ${this.roomId}] ❌ User ID is undefined!`);
        for (const [sid, session] of this.sessions) {
          if (session.userId) {
            senderId = session.userId;
            senderName = session.userName || 'Staff';
            senderRole = session.userRole || 'staff';
            senderEmail = session.userEmail || '';
            console.log(`[ChatRoom ${this.roomId}] 🔍 Found user from session:`, senderId);
            break;
          }
        }
      }

      if (!senderId) {
        console.error(`[ChatRoom ${this.roomId}] ❌ No valid sender ID found!`);
        try {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid user ID' }
          }));
        } catch (e) {}
        return;
      }

      console.log(`[ChatRoom ${this.roomId}] 📝 New message from user:`, { id: senderId, name: senderName });

      // ===== ENHANCEMENT: Detect product mentions and spell corrections =====
      const messageText = payload?.message || '';
      const productMatches = ChatRoom.detectProductMentions(messageText);
      const productResponse = ChatRoom.formatProductResponse(productMatches);
      
      // Check for spell corrections in the message
      const words = ChatRoom.extractKeywords(messageText);
      const corrections = [];
      for (const word of words) {
        const corrected = ChatRoom.correctSpelling(word);
        if (corrected && corrected.confidence > 70) {
          corrections.push(corrected);
        }
      }

      const messageId = payload?.messageId || crypto.randomUUID();
      
      const messageData = {
        id: messageId,
        roomId: this.actualRoomId || this.roomId,
        senderId: senderId,
        senderName: senderName,
        senderRole: senderRole,
        senderEmail: senderEmail,
        message: messageText,
        messageType: payload?.type || 'text',
        fileUrl: payload?.fileUrl || null,
        fileName: payload?.fileName || null,
        fileSize: payload?.fileSize || null,
        createdAt: payload?.createdAt || new Date().toISOString(),
        readBy: [],
        // ===== ENHANCEMENT: Add product detection data =====
        productMatches: productMatches,
        productResponse: productResponse,
        spellCorrections: corrections,
        hasProductMention: productMatches.length > 0,
        hasSpellCorrections: corrections.length > 0
      };

      console.log(`[ChatRoom ${this.roomId}] 📝 Message data:`, {
        id: messageData.id,
        roomId: messageData.roomId,
        senderId: messageData.senderId,
        senderName: messageData.senderName,
        messageLength: messageData.message.length,
        hasProduct: messageData.hasProductMention,
        hasSpellCorrections: messageData.hasSpellCorrections,
        fromREST: !!payload?.messageId
      });

      // Save to Durable Object storage (cache only)
      this.messageQueue.push(messageData);
      if (this.messageQueue.length > 1000) {
        this.messageQueue.shift();
      }
      await this.state.storage.put('messages', this.messageQueue);

      console.log(`[ChatRoom ${this.roomId}] ℹ️ Message cached, DB save skipped (handled by REST API)`);

      // ===== ENHANCED: Broadcast with product detection data =====
      this.broadcast({
        type: 'message',
        action: 'new_message',
        data: {
          id: messageData.id,
          room_id: messageData.roomId,
          sender_id: messageData.senderId,
          sender_name: messageData.senderName,
          sender_role: messageData.senderRole,
          message: messageData.message,
          message_type: messageData.messageType,
          file_url: messageData.fileUrl,
          file_name: messageData.fileName,
          file_size: messageData.fileSize,
          created_at: messageData.createdAt,
          // ===== ENHANCEMENT: Include product detection data =====
          product_matches: messageData.productMatches,
          product_response: messageData.productResponse,
          spell_corrections: messageData.spellCorrections,
          has_product: messageData.hasProductMention,
          has_spell_corrections: messageData.hasSpellCorrections
        }
      });

      // Send push notification if @mentioned
      if (messageData.message.includes('@') && this.env) {
        await this.handleMentions(messageData);
      }
    }

    // Read receipt
    if (type === 'read') {
      const messageId = payload?.messageId;
      if (messageId) {
        await this.markMessageAsRead(messageId, user.id);
        this.broadcast({
          type: 'read',
          action: 'message_read',
          data: {
            messageId: messageId,
            userId: user.id,
            userName: user.name
          }
        });
      } else if (payload?.roomId) {
        await this.markRoomAsRead(payload.roomId, user.id);
      }
    }
  }

  // ======================================================================
  // DATABASE OPERATIONS
  // ======================================================================

  async saveMessageToDatabase(messageData) {
    const roomId = this.actualRoomId || this.roomId;
    
    console.log(`[ChatRoom ${this.roomId}] 💾 Saving message to DB:`, {
      id: messageData.id,
      senderId: messageData.senderId,
      roomId: roomId,
      message: messageData.message?.substring(0, 30)
    });

    try {
      const db = this.env.DB;
      
      if (!messageData.senderId) {
        console.error(`[ChatRoom ${this.roomId}] ❌ Cannot save message: sender_id is null/undefined`);
        return false;
      }
      
      // Ensure user exists
      let userCheck = await db.prepare(
        "SELECT id FROM users WHERE id = ?"
      ).bind(messageData.senderId).first();
      
      if (!userCheck) {
        console.log(`[ChatRoom ${this.roomId}] ⚠️ User not found, inserting...`);
        await db.prepare(
          `INSERT OR IGNORE INTO users (id, name, email, role, status) 
          VALUES (?, ?, ?, ?, 'active')`
        ).bind(
          messageData.senderId,
          messageData.senderName || 'Staff',
          messageData.senderEmail || `${messageData.senderName || 'staff'}@primeshieldhub.com`,
          messageData.senderRole || 'staff'
        ).run();
      }
      
      // Check if room exists in chat_rooms
      const roomCheck = await db.prepare(
        "SELECT id FROM chat_rooms WHERE id = ?"
      ).bind(roomId).first();
      
      if (!roomCheck) {
        console.log(`[ChatRoom ${this.roomId}] ⚠️ Room not found in chat_rooms, inserting...`);
        
        const privateRoom = await db.prepare(
          "SELECT room_name, is_group FROM chat_private_rooms WHERE id = ?"
        ).bind(roomId).first();
        
        const roomName = privateRoom?.room_name || `Chat Room`;
        const roomType = privateRoom?.is_group ? 'group' : 'private';
        
        try {
          await db.prepare(
            `INSERT OR IGNORE INTO chat_rooms (id, name, type, description, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
          ).bind(
            roomId,
            roomName,
            roomType,
            `Private chat room`
          ).run();
        } catch (err) {
          console.log(`[ChatRoom ${this.roomId}] ⚠️ Description column might not exist, trying without...`);
          await db.prepare(
            `INSERT OR IGNORE INTO chat_rooms (id, name, type, is_active, created_at, updated_at)
            VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`
          ).bind(
            roomId,
            roomName,
            roomType
          ).run();
        }
        
        const roomCheck2 = await db.prepare(
          "SELECT id FROM chat_rooms WHERE id = ?"
        ).bind(roomId).first();
        
        if (!roomCheck2) {
          console.error(`[ChatRoom ${this.roomId}] ❌ Failed to insert room`);
          return false;
        }
        console.log(`[ChatRoom ${this.roomId}] ✅ Room inserted into chat_rooms`);
      }
      
      // ===== ENHANCEMENT: Store product detection data in DB =====
      const productData = messageData.productResponse ? JSON.stringify(messageData.productResponse) : null;
      const spellData = messageData.spellCorrections && messageData.spellCorrections.length > 0 
        ? JSON.stringify(messageData.spellCorrections) 
        : null;
      
      // Insert the message with product data
      const result = await db.prepare(
        `INSERT INTO chat_messages 
        (id, room_id, sender_id, message, message_type, file_url, file_name, file_size, 
         product_data, spell_corrections, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        messageData.id,
        roomId,
        messageData.senderId,
        messageData.message,
        messageData.messageType || 'text',
        messageData.fileUrl || null,
        messageData.fileName || null,
        messageData.fileSize || null,
        productData,
        spellData,
        messageData.createdAt || new Date().toISOString()
      ).run();
      
      if (result.changes && result.changes > 0) {
        console.log(`[ChatRoom ${this.roomId}] ✅ Message saved to DB`);
        return true;
      } else {
        console.warn(`[ChatRoom ${this.roomId}] ⚠️ Message insert returned no changes`);
        return false;
      }
    } catch (error) {
      console.error(`[ChatRoom ${this.roomId}] ❌ Database save error:`, error.message);
      console.error(`[ChatRoom ${this.roomId}] ❌ Error stack:`, error.stack);
      return false;
    }
  }

  async getRecentMessages(limit = 50) {
    const roomId = this.actualRoomId || this.roomId;
    
    try {
      const db = this.env.DB;
      const results = await db.prepare(
        `SELECT m.*, u.name as sender_name, u.role as sender_role,
          m.product_data, m.spell_corrections
         FROM chat_messages m
         LEFT JOIN users u ON m.sender_id = u.id
         WHERE m.room_id = ?
         ORDER BY m.created_at DESC LIMIT ?`
      ).bind(roomId, limit).all();

      console.log(`[ChatRoom ${this.roomId}] Retrieved ${results.results?.length || 0} messages from room ${roomId}`);
      
      // ===== ENHANCEMENT: Parse product data on retrieval =====
      const parsedResults = (results.results || []).map(msg => {
        let productData = null;
        let spellData = null;
        try {
          if (msg.product_data) productData = JSON.parse(msg.product_data);
          if (msg.spell_corrections) spellData = JSON.parse(msg.spell_corrections);
        } catch (e) {}
        
        return {
          ...msg,
          product_response: productData,
          spell_corrections: spellData,
          has_product: !!productData,
          has_spell_corrections: !!spellData
        };
      });
      
      return parsedResults;
    } catch (error) {
      console.error(`[ChatRoom ${this.roomId}] Get messages error:`, error);
      return [];
    }
  }

  async markMessageAsRead(messageId, userId) {
    try {
      const db = this.env.DB;
      
      try {
        const user = await db.prepare(
          "SELECT id FROM users WHERE id = ?"
        ).bind(userId).first();
        if (!user) {
          await db.prepare(
            `INSERT OR IGNORE INTO users (id, name, email, role, status) 
             VALUES (?, 'Staff', 'staff@primeshieldhub.com', 'staff', 'active')`
          ).bind(userId).run();
        }
      } catch (e) {}
      
      await db.prepare(
        `INSERT OR IGNORE INTO chat_read_receipts (message_id, user_id)
         VALUES (?, ?)`
      ).bind(messageId, userId).run();
    } catch (error) {
      console.error(`[ChatRoom ${this.roomId}] Mark read error:`, error);
    }
  }

  async markRoomAsRead(roomId, userId) {
    try {
      const db = this.env.DB;
      await db.prepare(
        `INSERT OR IGNORE INTO chat_read_receipts (message_id, user_id)
         SELECT id, ? FROM chat_messages WHERE room_id = ? AND sender_id != ?`
      ).bind(userId, roomId, userId).run();
    } catch (error) {
      console.error(`[ChatRoom ${this.roomId}] Mark room read error:`, error);
    }
  }

  // ======================================================================
  // MENTIONS & NOTIFICATIONS
  // ======================================================================

  async handleMentions(messageData) {
    const mentionRegex = /@(\w+)/g;
    const mentions = messageData.message.match(mentionRegex);
    
    if (!mentions) return;

    const mentionedNames = mentions.map(m => m.substring(1).toLowerCase());

    try {
      const db = this.env.DB;
      
      const users = await db.prepare(
        `SELECT id, email, name FROM users WHERE LOWER(name) IN (${mentionedNames.map(() => '?').join(',')})`
      ).bind(...mentionedNames).all();

      for (const user of users.results || []) {
        if (user.id === messageData.senderId) continue;
        if (this.env) {
          await this.sendPushNotification(this.env, {
            userId: user.id,
            title: `${messageData.senderName} mentioned you`,
            body: messageData.message.substring(0, 100),
            url: `/staff/chat?room=${this.actualRoomId || this.roomId}`
          });
        }
      }
    } catch (error) {
      console.error(`[ChatRoom ${this.roomId}] Mentions error:`, error);
    }
  }

  async sendPushNotification(env, data) {
    try {
      const db = env.DB;
      const subs = await db.prepare(
        `SELECT * FROM push_subscriptions WHERE user_id = ?`
      ).bind(data.userId).all();

      if (!subs.results || subs.results.length === 0) return;

      const webPushModule = await import('web-push');
      const webPush = webPushModule.default || webPushModule;

      webPush.setVapidDetails(
        env.VAPID_SUBJECT || 'mailto:primeshieldhub@gmail.com',
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
      );

      const payload = JSON.stringify({
        title: data.title,
        body: data.body,
        icon: '/staff-icons/icon-192x192.png',
        badge: '/staff-icons/icon-72x72.png',
        url: data.url || '/staff/chat',
        tag: 'chat-mention-' + Date.now(),
        staff: true,
        requireInteraction: true
      });

      for (const sub of subs.results) {
        try {
          await webPush.sendNotification({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys_p256dh,
              auth: sub.keys_auth
            }
          }, payload);
        } catch (e) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            await db.prepare(
              "DELETE FROM push_subscriptions WHERE endpoint = ?"
            ).bind(sub.endpoint).run();
          }
        }
      }
    } catch (error) {
      console.error(`[ChatRoom ${this.roomId}] Push notification error:`, error);
    }
  }

  // ======================================================================
  // BROADCAST
  // ======================================================================

  broadcast(message, excludeSessionId = null) {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    
    for (const [sessionId, session] of this.sessions) {
      if (sessionId === excludeSessionId) continue;
      try {
        if (session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(messageStr);
          sentCount++;
        }
      } catch (error) {
        console.error(`[ChatRoom ${this.roomId}] Broadcast error:`, error);
      }
    }
    
    if (sentCount > 0) {
      console.log(`[ChatRoom ${this.roomId}] Broadcast sent to ${sentCount} sessions`);
    }
  }

  // ======================================================================
  // AUTH HELPERS
  // ======================================================================

  async getUserFromRequest(request) {
    try {
      // Check for user info in headers
      const userId = request.headers.get('X-User-ID');
      const userName = request.headers.get('X-User-Name');
      const userRole = request.headers.get('X-User-Role');
      const userEmail = request.headers.get('X-User-Email');
      
      if (userId && userId !== 'null' && userId !== 'undefined') {
        console.log(`[ChatRoom ${this.roomId}] User from headers:`, { 
          id: userId, 
          name: userName || 'Staff',
          role: userRole || 'staff' 
        });
        
        const db = this.env.DB;
        let user = await db.prepare(
          "SELECT id, name, email, role FROM users WHERE id = ?"
        ).bind(userId).first();
        
        if (!user) {
          console.log(`[ChatRoom ${this.roomId}] User not found in DB, creating...`);
          await db.prepare(
            `INSERT OR IGNORE INTO users (id, name, email, role, status) 
            VALUES (?, ?, ?, ?, 'active')`
          ).bind(
            userId,
            userName || 'Staff',
            userEmail || `${userId}@primeshieldhub.com`,
            userRole || 'staff'
          ).run();
          user = { 
            id: userId, 
            name: userName || 'Staff', 
            email: userEmail || `${userId}@primeshieldhub.com`,
            role: userRole || 'staff' 
          };
        }
        
        return user;
      }
      
      // Fallback to token from URL
      const url = new URL(request.url);
      const token = url.searchParams.get('token') || 
                    request.headers.get('Authorization')?.replace('Bearer ', '');
      
      console.log(`[ChatRoom ${this.roomId}] getUserFromRequest - token present:`, !!token);
      
      if (!token) return null;

      const payload = await this.verifyToken(token);
      if (!payload || !payload.id) {
        console.log(`[ChatRoom ${this.roomId}] Token verification failed`);
        return null;
      }

      console.log(`[ChatRoom ${this.roomId}] 🔑 Token payload ID:`, payload.id);

      const db = this.env.DB;
      let user = await db.prepare(
        "SELECT id, name, email, role FROM users WHERE id = ?"
      ).bind(payload.id).first();

      if (!user) {
        console.log(`[ChatRoom ${this.roomId}] User not found in DB, attempting to create:`, payload.id);
        try {
          await db.prepare(
            `INSERT OR IGNORE INTO users (id, name, email, role, status) 
            VALUES (?, ?, ?, ?, 'active')`
          ).bind(
            payload.id,
            payload.name || 'Staff',
            payload.email || `${payload.id}@primeshieldhub.com`,
            payload.role || 'staff'
          ).run();
          
          user = await db.prepare(
            "SELECT id, name, email, role FROM users WHERE id = ?"
          ).bind(payload.id).first();
        } catch (createErr) {
          console.error(`[ChatRoom ${this.roomId}] Failed to create user:`, createErr);
        }
      }

      if (!user) {
        console.log(`[ChatRoom ${this.roomId}] User still not found, using fallback`);
        return {
          id: payload.id,
          name: payload.name || 'Staff',
          email: payload.email || '',
          role: payload.role || 'staff'
        };
      }

      console.log(`[ChatRoom ${this.roomId}] ✅ User found:`, { id: user.id, name: user.name });
      return user;
    } catch (error) {
      console.error(`[ChatRoom ${this.roomId}] Auth error:`, error);
      return null;
    }
  }

  async verifyToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [headerB64, payloadB64, signatureB64] = parts;

      let payload = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      while (payload.length % 4) payload += '=';

      const decoded = JSON.parse(atob(payload));

      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      const jwtSecret = this.env.GATEWAY_SECRET || this.env.JWT_SECRET;

      if (jwtSecret) {
        try {
          const encoder = new TextEncoder();
          const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(jwtSecret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
          );

          let signature = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
          while (signature.length % 4) signature += '=';
          const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

          const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            sigBytes,
            encoder.encode(`headerB64.{payloadB64}`)
          );

          if (!isValid) return null;
        } catch (e) {
          return null;
        }
      }

      if (!decoded.id) return null;
      return decoded;
    } catch (e) {
      console.error('[ChatRoom] Token verification error:', e);
      return null;
    }
  }

  // ======================================================================
  // REST API HANDLERS
  // ======================================================================

  async getMessages(request) {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const messages = await this.getRecentMessages(limit);
      return new Response(JSON.stringify({
        success: true,
        messages: messages
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async sendMessage(request) {
    try {
      const body = await request.json();
      const user = await this.getUserFromRequest(request);
      
      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }), { status: 401 });
      }

      const messageText = body.message || '';
      
      // ===== ENHANCEMENT: Detect product mentions and spell corrections =====
      const productMatches = ChatRoom.detectProductMentions(messageText);
      const productResponse = ChatRoom.formatProductResponse(productMatches);
      
      const words = ChatRoom.extractKeywords(messageText);
      const corrections = [];
      for (const word of words) {
        const corrected = ChatRoom.correctSpelling(word);
        if (corrected && corrected.confidence > 70) {
          corrections.push(corrected);
        }
      }

      const messageData = {
        id: body.messageId || crypto.randomUUID(),
        roomId: this.actualRoomId || this.roomId,
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        senderEmail: user.email || '',
        message: messageText,
        messageType: body.type || 'text',
        fileUrl: body.fileUrl || null,
        fileName: body.fileName || null,
        fileSize: body.fileSize || null,
        createdAt: body.createdAt || new Date().toISOString(),
        readBy: [],
        productMatches: productMatches,
        productResponse: productResponse,
        spellCorrections: corrections,
        hasProductMention: productMatches.length > 0,
        hasSpellCorrections: corrections.length > 0
      };

      // Save to cache
      this.messageQueue.push(messageData);
      if (this.messageQueue.length > 1000) {
        this.messageQueue.shift();
      }
      await this.state.storage.put('messages', this.messageQueue);
      
      console.log(`[ChatRoom ${this.roomId}] ℹ️ Message broadcast only (DB save skipped)`);
      
      this.broadcast({
        type: 'message',
        action: 'new_message',
        data: {
          id: messageData.id,
          room_id: messageData.roomId,
          sender_id: messageData.senderId,
          sender_name: messageData.senderName,
          sender_role: messageData.senderRole,
          message: messageData.message,
          message_type: messageData.messageType,
          file_url: messageData.fileUrl,
          file_name: messageData.fileName,
          file_size: messageData.fileSize,
          created_at: messageData.createdAt,
          product_response: messageData.productResponse,
          spell_corrections: messageData.spellCorrections,
          has_product: messageData.hasProductMention,
          has_spell_corrections: messageData.hasSpellCorrections
        }
      });

      return new Response(JSON.stringify({
        success: true,
        message: messageData,
        product_response: productResponse,
        spell_corrections: corrections
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error(`[ChatRoom ${this.roomId}] Send message error:`, error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async getUsers(request) {
    try {
      const users = Array.from(this.sessions.values()).map(s => ({
        id: s.userId,
        name: s.userName,
        role: s.userRole,
        isOnline: true
      }));

      return new Response(JSON.stringify({
        success: true,
        online: users.length,
        users: users
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
