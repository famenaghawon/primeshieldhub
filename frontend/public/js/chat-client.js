// ======================================================================
// CHAT CLIENT - WebSocket-based Real-time Chat with Premium Sound
// ENHANCED: Spell Correction, Product Detection, Intelligence
// Robust, Production-Ready with Automatic Reconnection
// Supports: Public Rooms, Private Rooms, Permissions
// ======================================================================

class ChatClient {
  constructor(options = {}) {
    // Core configuration
    this.ws = null;
    this.roomId = options.roomId || 'room-general';
    this.roomType = options.roomType || 'public'; // 'public' or 'private'
    this.user = options.user || null;
    this.token = options.token || null;
    
    // Sound system
    this.soundEnabled = options.soundEnabled !== undefined ? options.soundEnabled : true;
    this.soundEngine = options.soundEngine || null;
    this.soundCallbacks = {
      onMessage: options.onSoundMessage || null,
      onJoin: options.onSoundJoin || null,
      onSystem: options.onSoundSystem || null
    };
    
    // Callbacks
    this.onMessage = options.onMessage || null;
    this.onUserJoin = options.onUserJoin || null;
    this.onUserLeave = options.onUserLeave || null;
    this.onTyping = options.onTyping || null;
    this.onError = options.onError || null;
    this.onConnect = options.onConnect || null;
    this.onDisconnect = options.onDisconnect || null;
    this.onReconnect = options.onReconnect || null;
    this.onHistory = options.onHistory || null;
    this.onRoomChange = options.onRoomChange || null;
    
    // Connection state
    this.isConnected = false;
    this.isConnecting = false;
    this.isAuthenticated = false;
    this.connectionId = null;
    this.isManualDisconnect = false;
    this._isDestroyed = false;
    
    // Reconnection settings
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.reconnectTimer = null;
    this.connectionTimeout = null;
    this.reconnectBackoff = 1.5;
    
    // Keep-alive
    this.pingInterval = null;
    this.pingTimeout = null;
    this.lastPongTime = null;
    this.pingCount = 0;
    this.pongCount = 0;
    this.pingIntervalMs = 25000;
    this.pingTimeoutMs = 10000;
    
    // Typing
    this.typingTimeout = null;
    this.isTyping = false;
    this.typingDebounce = null;
    this.typingDelayMs = 300;
    this.typingExpireMs = 3000;
    
    // Message queue
    this.messageQueue = [];
    this.maxQueueSize = 100;
    this.isProcessingQueue = false;
    
    // Message deduplication
    this.receivedMessageIds = new Set();
    this.maxMessageIdCache = 1000;
    
    // API base
    this.apiBase = options.apiBase || 'https://api.primeshieldhub.com';
    
    // Debug mode
    this.debug = options.debug || false;
    
    // Rate limiting
    this.lastMessageTime = 0;
    this.messageRateLimit = 500; // ms between messages
    
    // Session ID
    this.sessionId = null;
    
    // User join tracking for sound deduplication
    this._recentJoins = new Set();
    this._joinCooldown = 5000;
    
    // ======================================================================
    // ENHANCEMENT: Spell Correction & Product Detection
    // ======================================================================
    
    this.MISSPELLINGS = {
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

    this.PRODUCT_KNOWLEDGE = {
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

    this.log('[ChatClient] Initialized with intelligence', {
      apiBase: this.apiBase,
      roomId: this.roomId,
      roomType: this.roomType,
      soundEnabled: this.soundEnabled,
      productKnowledge: Object.keys(this.PRODUCT_KNOWLEDGE).length + ' products',
      misspellings: Object.keys(this.MISSPELLINGS).length + ' patterns'
    });
  }

  // ===== LOGGING =====
  log(...args) {
    if (this.debug) {
      console.log('[ChatClient]', ...args);
    }
  }

  // ======================================================================
  // ENHANCEMENT: Spell Correction & Product Detection Methods
  // ======================================================================

  levenshteinDistance(a, b) {
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

  similarityScore(a, b) {
    const distance = this.levenshteinDistance(a.toLowerCase(), b.toLowerCase());
    const maxLen = Math.max(a.length, b.length);
    return maxLen === 0 ? 1 : 1 - (distance / maxLen);
  }

  correctSpelling(word) {
    if (!word || word.length < 3) return null;
    const lower = word.toLowerCase();
    
    // Check exact misspellings
    for (const [correct, misspellings] of Object.entries(this.MISSPELLINGS)) {
      if (misspellings.some(m => m === lower || lower.includes(m))) {
        return { original: word, corrected: correct, confidence: 95 };
      }
    }
    
    // Fuzzy match
    let bestMatch = null;
    let bestScore = 0;
    for (const [correct] of Object.entries(this.MISSPELLINGS)) {
      const score = this.similarityScore(lower, correct);
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

  extractKeywords(text) {
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'for', 'of', 'with', 'on', 'at', 'from', 'by', 'in', 'about', 'like', 'do', 'you', 'have', 'got', 'any', 'me', 'tell', 'show', 'price', 'cost', 'much'];
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
    return words.filter(w => w.length > 2 && !stopWords.includes(w));
  }

  detectProductMentions(text) {
    const matches = [];
    const words = this.extractKeywords(text);
    
    for (const word of words) {
      // Check for corrected spelling
      const corrected = this.correctSpelling(word);
      if (corrected) {
        const info = this.PRODUCT_KNOWLEDGE[corrected.corrected.toLowerCase()];
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
      for (const [product, info] of Object.entries(this.PRODUCT_KNOWLEDGE)) {
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

  formatProductResponse(matches) {
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
      correction: match.type === 'spell_correction' ? match.detected : null,
      type: match.type
    };
  }

  /**
   * Detect intelligence in a message and add metadata
   */
  analyzeMessage(text) {
    if (!text || text.trim() === '') {
      return { productMatches: [], productResponse: null, spellCorrections: [] };
    }
    
    const productMatches = this.detectProductMentions(text);
    const productResponse = this.formatProductResponse(productMatches);
    
    const words = this.extractKeywords(text);
    const corrections = [];
    for (const word of words) {
      const corrected = this.correctSpelling(word);
      if (corrected && corrected.confidence > 70) {
        corrections.push(corrected);
      }
    }
    
    return {
      productMatches,
      productResponse,
      spellCorrections: corrections,
      hasProductMention: productMatches.length > 0,
      hasSpellCorrections: corrections.length > 0
    };
  }

  // ===== GENERATE CONNECTION ID =====
  generateConnectionId() {
    return 'conn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  }

  // ===== SOUND SYSTEM =====
  playSound(type = 'message') {
    if (!this.soundEnabled) return;
    if (!this.soundEngine) {
      if (window.notificationSound && typeof window.notificationSound.play === 'function') {
        window.notificationSound.play();
        return;
      }
      return;
    }
    
    try {
      if (typeof this.soundEngine.play === 'function') {
        this.soundEngine.play();
      } else if (typeof this.soundEngine === 'function') {
        this.soundEngine();
      }
    } catch (e) {
      console.debug('[ChatClient] Sound playback error:', e);
    }
    
    if (type === 'message' && this.soundCallbacks.onMessage) {
      this.soundCallbacks.onMessage();
    } else if (type === 'join' && this.soundCallbacks.onJoin) {
      this.soundCallbacks.onJoin();
    } else if (type === 'system' && this.soundCallbacks.onSystem) {
      this.soundCallbacks.onSystem();
    }
  }

  toggleSound(enabled) {
    this.soundEnabled = enabled !== undefined ? enabled : !this.soundEnabled;
    this.log(`Sound ${this.soundEnabled ? 'enabled' : 'disabled'}`);
    return this.soundEnabled;
  }

  setSoundEngine(engine) {
    this.soundEngine = engine;
    this.log('Sound engine set');
  }

  // ===== CONNECT =====
  connect() {
    if (this._isDestroyed) {
      console.warn('[ChatClient] Cannot connect - client is destroyed');
      return;
    }
    
    if (this.isConnecting || this.isConnected) {
      this.log('Already connected or connecting, skipping...');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isConnecting = true;
    this.isManualDisconnect = false;
    this.connectionId = this.generateConnectionId();
    
    const wsUrl = this.getWebSocketUrl();
    this.log('Connecting to WebSocket:', wsUrl.replace(/token=[^&]+/, 'token=REDACTED'));

    try {
      this.ws = new WebSocket(wsUrl);
      
      this.connectionTimeout = setTimeout(() => {
        if (this.isConnecting && !this.isConnected) {
          this.log('Connection timeout');
          if (this.ws) {
            try {
              this.ws.close(1008, 'Connection timeout');
            } catch (e) {}
          }
          this.isConnecting = false;
          this.handleReconnect();
        }
      }, 10000);
      
      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onclose = (event) => this.handleClose(event);
      this.ws.onerror = (event) => this.handleError(event);
      
      this.log('WebSocket created, waiting for connection...');
    } catch (error) {
      console.error('[ChatClient] WebSocket creation error:', error);
      this.isConnecting = false;
      this.handleReconnect();
    }
  }

  // ===== DISCONNECT =====
  disconnect() {
    this.log('Disconnecting...');
    this.isManualDisconnect = true;
    this.isConnecting = false;
    
    this.cleanup();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, 'User disconnected');
        }
      } catch (e) {}
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isAuthenticated = false;
    
    if (this.onDisconnect) {
      this.onDisconnect({ code: 1000, reason: 'User disconnected' });
    }
  }

  // ===== DESTROY =====
  destroy() {
    this.log('Destroying client...');
    this._isDestroyed = true;
    this.isManualDisconnect = true;
    this.disconnect();
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.receivedMessageIds.clear();
    this.user = null;
    this.token = null;
    this.onMessage = null;
    this.onUserJoin = null;
    this.onUserLeave = null;
    this.onTyping = null;
    this.onError = null;
    this.onConnect = null;
    this.onDisconnect = null;
    this.onReconnect = null;
    this.onHistory = null;
    this.onRoomChange = null;
    this.soundEngine = null;
    this.soundCallbacks = {};
  }

  // ===== CHANGE ROOM =====
  changeRoom(roomId, roomType = 'public') {
    if (roomId === this.roomId && roomType === this.roomType) {
      this.log('Already in this room, skipping change');
      return;
    }
    
    this.log(`Changing room from ${this.roomId} (${this.roomType}) to ${roomId} (${roomType})`);
    
    if (this.onRoomChange) {
      this.onRoomChange(roomId, roomType);
    }
    
    this.roomId = roomId;
    this.roomType = roomType;
    this.receivedMessageIds.clear();
    
    this.disconnect();
    setTimeout(() => {
      if (!this._isDestroyed) {
        this.connect();
      }
    }, 200);
  }

  // ===== CLEANUP =====
  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    
    if (this.typingDebounce) {
      clearTimeout(this.typingDebounce);
      this.typingDebounce = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  // ======================================================================
  // ENHANCED SEND MESSAGE with Intelligence
  // ======================================================================

  sendMessage(message, type = 'text', fileData = null) {
    if (!message || message.trim() === '') {
      console.warn('[ChatClient] Cannot send empty message');
      return false;
    }

    // Analyze message for product mentions and spell corrections
    const analysis = this.analyzeMessage(message);
    
    if (analysis.hasProductMention) {
      this.log(`🔍 Product detected: ${analysis.productResponse?.detected || 'unknown'}`);
    }
    if (analysis.hasSpellCorrections) {
      this.log(`✏️ Spell corrections: ${analysis.spellCorrections.map(c => `"${c.original}"→"${c.corrected}"`).join(', ')}`);
    }

    const now = Date.now();
    if (now - this.lastMessageTime < this.messageRateLimit) {
      console.warn('[ChatClient] Rate limit exceeded, slowing down');
      if (this.messageQueue.length < this.maxQueueSize) {
        this.messageQueue.push({ 
          message: message.trim(), 
          type, 
          fileData,
          analysis
        });
      }
      return true;
    }

    if (!this.isConnected) {
      if (this.messageQueue.length < this.maxQueueSize) {
        this.log('Not connected, queueing message');
        this.messageQueue.push({ 
          message: message.trim(), 
          type, 
          fileData,
          analysis
        });
        return true;
      } else {
        console.warn('[ChatClient] Message queue full');
        return false;
      }
    }

    try {
      const payload = {
        type: 'message',
        action: 'send',
        payload: {
          message: message.trim(),
          type: type,
          roomId: this.roomId,
          roomType: this.roomType,
          fileUrl: fileData?.url || null,
          fileName: fileData?.name || null,
          fileSize: fileData?.size || null,
          timestamp: Date.now(),
          // ===== ENHANCEMENT: Include intelligence data =====
          product_matches: analysis.productMatches,
          product_response: analysis.productResponse,
          spell_corrections: analysis.spellCorrections,
          has_product: analysis.hasProductMention,
          has_spell_corrections: analysis.hasSpellCorrections
        }
      };
      
      this.ws.send(JSON.stringify(payload));
      this.lastMessageTime = Date.now();
      this.log('Message sent:', message.substring(0, 50) + (message.length > 50 ? '...' : ''));
      if (analysis.hasProductMention) {
        this.log(`📦 Product: ${analysis.productResponse?.emoji || '📦'} ${analysis.productResponse?.detected || 'unknown'} - ${analysis.productResponse?.price_range || ''}`);
      }
      return true;
    } catch (error) {
      console.error('[ChatClient] Send error:', error);
      if (this.messageQueue.length < this.maxQueueSize) {
        this.messageQueue.push({ 
          message: message.trim(), 
          type, 
          fileData,
          analysis
        });
      }
      return false;
    }
  }

  // ===== TYPING INDICATOR =====
  sendTyping(isTyping = true) {
    if (!this.isConnected) return;
    
    if (this.typingDebounce) {
      clearTimeout(this.typingDebounce);
      this.typingDebounce = null;
    }
    
    this.typingDebounce = setTimeout(() => {
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
        this.typingTimeout = null;
      }

      try {
        this.ws.send(JSON.stringify({
          type: 'typing',
          payload: {
            isTyping: isTyping,
            roomId: this.roomId
          }
        }));
      } catch (error) {
        console.error('[ChatClient] Typing error:', error);
      }

      if (isTyping) {
        this.typingTimeout = setTimeout(() => {
          if (this.isTyping) {
            this.sendTyping(false);
          }
        }, this.typingExpireMs);
      }
    }, this.typingDelayMs);
  }

  // ===== MARK AS READ =====
  markAsRead(messageId) {
    if (!this.isConnected || !messageId) return;

    try {
      this.ws.send(JSON.stringify({
        type: 'read',
        payload: {
          messageId: messageId,
          roomId: this.roomId,
          roomType: this.roomType
        }
      }));
    } catch (error) {
      console.error('[ChatClient] Mark read error:', error);
    }
  }

  // ===== MARK ROOM AS READ =====
  markRoomAsRead() {
    if (!this.isConnected) return;

    try {
      this.ws.send(JSON.stringify({
        type: 'read',
        payload: {
          roomId: this.roomId,
          roomType: this.roomType,
          markAll: true
        }
      }));
    } catch (error) {
      console.error('[ChatClient] Mark room read error:', error);
    }
  }

  // ===== GET RECENT MESSAGES =====
  async getRecentMessages(limit = 50, before = null) {
    try {
      let url = `${this.apiBase}/api/chat/messages?roomId=${this.roomId}&type=${this.roomType}&limit=${limit}`;
      if (before) url += `&before=${before}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success) {
        return data.messages || [];
      }
      return [];
    } catch (error) {
      console.error('[ChatClient] Get messages error:', error);
      return [];
    }
  }

  // ===== LOAD MORE MESSAGES =====
  async loadMoreMessages(limit = 50, before = null) {
    return this.getRecentMessages(limit, before);
  }

  // ======================================================================
  // WEB SOCKET EVENT HANDLERS - ENHANCED
  // ======================================================================

  handleOpen() {
    if (this._isDestroyed) {
      this.log('Open event ignored - client destroyed');
      return;
    }
    
    this.log('WebSocket connection opened');
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.startKeepAlive();
    this.processQueue();

    if (this.onConnect) {
      this.onConnect();
    }
  }

  handleMessage(event) {
    if (this._isDestroyed) return;
    
    try {
      const data = JSON.parse(event.data);
      this.processMessage(data);
    } catch (error) {
      console.error('[ChatClient] Parse message error:', error, 'Raw data:', event.data);
    }
  }

  processMessage(data) {
    // Filter messages by room ID
    if (data.data?.roomId && data.data.roomId !== this.roomId) {
      this.log(`Ignoring message from different room: ${data.data.roomId} (current: ${this.roomId})`);
      return;
    }
    
    if (data.roomId && data.roomId !== this.roomId) {
      this.log(`Ignoring message from different room: ${data.roomId} (current: ${this.roomId})`);
      return;
    }

    switch (data.type) {
      case 'system':
        this.handleSystemMessage(data);
        break;
      case 'message':
        this.handleChatMessage(data);
        break;
      case 'typing':
        this.handleTypingIndicator(data);
        break;
      case 'read':
        this.handleReadReceipt(data);
        break;
      case 'messages':
        this.handleMessageHistory(data);
        break;
      case 'ping':
        this.handlePing(data);
        break;
      case 'pong':
        this.handlePong(data);
        break;
      case 'error':
        this.handleErrorMessage(data);
        break;
      default:
        this.log('Unknown message type:', data.type, data);
    }
  }

  handleSystemMessage(data) {
    this.log('System message:', data.action);
    
    switch (data.action) {
      case 'welcome':
        this.isAuthenticated = true;
        if (data.data?.sessionId) {
          this.sessionId = data.data.sessionId;
        }
        if (this.onConnect) {
          this.onConnect(data.data);
        }
        break;
      case 'user_joined':
        const userId = data.data?.userId || data.data?.id;
        if (userId && !this._recentJoins.has(userId)) {
          this._recentJoins.add(userId);
          setTimeout(() => {
            this._recentJoins.delete(userId);
          }, this._joinCooldown);
          
          if (userId !== this.user?.id) {
            this.playSound('join');
          }
        }
        
        if (this.onUserJoin) {
          this.onUserJoin(data.data);
        }
        break;
      case 'user_left':
        if (this.onUserLeave) {
          this.onUserLeave(data.data);
        }
        break;
      default:
        this.log('System message:', data.action, data.data);
    }
  }

  // ======================================================================
  // ENHANCED CHAT MESSAGE HANDLING with Intelligence
  // ======================================================================

  handleChatMessage(data) {
    const msg = data.data;
    
    // Deduplicate
    if (msg.id) {
      if (this.receivedMessageIds.has(msg.id)) {
        this.log('Duplicate message ignored:', msg.id);
        return;
      }
      this.receivedMessageIds.add(msg.id);
      
      if (this.receivedMessageIds.size > this.maxMessageIdCache) {
        const toRemove = this.receivedMessageIds.size - this.maxMessageIdCache;
        const iterator = this.receivedMessageIds.values();
        for (let i = 0; i < toRemove; i++) {
          this.receivedMessageIds.delete(iterator.next().value);
        }
      }
    }
    
    // Only process messages for this room
    if (msg.room_id && msg.room_id !== this.roomId) {
      this.log(`Ignoring message from different room: ${msg.room_id}`);
      return;
    }
    
    // Play sound for incoming messages (not from current user)
    if (msg.sender_id && msg.sender_id !== this.user?.id) {
      this.playSound('message');
    }
    
    // ===== ENHANCEMENT: Log intelligence data =====
    if (msg.has_product) {
      const product = msg.product_response;
      this.log(`📦 Product detected in message: ${product?.emoji || '📦'} ${product?.detected || 'unknown'} (${product?.category || 'N/A'})`);
    }
    if (msg.has_spell_corrections) {
      const corrections = msg.spell_corrections || [];
      this.log(`✏️ Spell corrections: ${corrections.map(c => `"${c.original}"→"${c.corrected}"`).join(', ')}`);
    }
    
    if (this.onMessage) {
      this.onMessage(msg);
    }
  }

  handleTypingIndicator(data) {
    if (data.data?.roomId && data.data.roomId !== this.roomId) {
      return;
    }
    
    if (this.onTyping) {
      this.onTyping(data.data);
    }
  }

  handleReadReceipt(data) {
    this.log('Read receipt:', data.data);
  }

  handleMessageHistory(data) {
    const messages = Array.isArray(data.data) ? data.data : [data.data];
    const filtered = messages.filter(msg => {
      const msgRoomId = msg.room_id || msg.roomId;
      return !msgRoomId || msgRoomId === this.roomId;
    });
    
    if (this.onHistory && filtered.length > 0) {
      this.onHistory(filtered);
    } else if (this.onMessage && filtered.length > 0) {
      filtered.forEach(msg => {
        if (msg.id) {
          if (this.receivedMessageIds.has(msg.id)) return;
          this.receivedMessageIds.add(msg.id);
        }
        this.onMessage(msg);
      });
    }
  }

  handlePing(data) {
    if (this.isConnected && this.ws) {
      try {
        this.ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now(),
          echo: data.timestamp,
          roomId: this.roomId
        }));
      } catch (e) {}
    }
  }

  handlePong(data) {
    this.pongCount++;
    this.lastPongTime = Date.now();
    
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  handleErrorMessage(data) {
    console.error('[ChatClient] Server error:', data.data?.message || data.message);
    if (this.onError) {
      this.onError({
        type: 'server_error',
        message: data.data?.message || data.message || 'Unknown server error',
        data: data.data
      });
    }
  }

  // ===== KEEP-ALIVE =====
  startKeepAlive() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, this.pingIntervalMs);
    
    setTimeout(() => this.sendPing(), 5000);
  }

  sendPing() {
    if (!this.isConnected || !this.ws) return;
    
    this.pingCount++;
    try {
      this.ws.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now(),
        pingId: this.pingCount,
        roomId: this.roomId
      }));
      
      if (this.pingTimeout) {
        clearTimeout(this.pingTimeout);
      }
      
      this.pingTimeout = setTimeout(() => {
        console.warn('[ChatClient] Ping timeout - no pong received');
        if (this.isConnected) {
          this.handleReconnect();
        }
      }, this.pingTimeoutMs);
    } catch (error) {
      console.error('[ChatClient] Ping error:', error);
      if (this.isConnected) {
        this.handleReconnect();
      }
    }
  }

  // ===== QUEUE PROCESSING =====
  processQueue() {
    if (this.isProcessingQueue || this.messageQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    this.log(`Processing ${this.messageQueue.length} queued messages`);
    
    let processed = 0;
    while (this.messageQueue.length > 0 && processed < 10) {
      const msg = this.messageQueue.shift();
      this.sendMessage(msg.message, msg.type, msg.fileData);
      processed++;
    }
    
    this.isProcessingQueue = false;
    
    if (this.messageQueue.length > 0) {
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  // ===== CLOSE HANDLING =====
  handleClose(event) {
    if (this._isDestroyed) {
      this.log('Close event ignored - client destroyed');
      return;
    }
    
    this.log('WebSocket closed:', event.code, event.reason || 'No reason provided');
    this.isConnected = false;
    this.isConnecting = false;
    this.isAuthenticated = false;
    
    this.cleanup();

    if (this.onDisconnect) {
      this.onDisconnect(event);
    }

    if (event.code !== 1000 && !this.isManualDisconnect && !this._isDestroyed) {
      this.log('Unexpected close, attempting reconnect...');
      this.handleReconnect();
    } else {
      this.log('Normal closure or manual disconnect, no reconnect');
    }
  }

  handleError(event) {
    if (this._isDestroyed) {
      this.log('Error event ignored - client destroyed');
      return;
    }
    
    console.error('[ChatClient] WebSocket error:', event);
    this.isConnected = false;
    this.isConnecting = false;
    
    if (this.onError) {
      this.onError({
        type: 'websocket_error',
        event: event,
        message: 'WebSocket connection error'
      });
    }
    
    if (!this.isManualDisconnect && !this._isDestroyed) {
      if (this.ws) {
        try {
          this.ws.close();
        } catch (e) {}
        this.ws = null;
      }
      this.handleReconnect();
    }
  }

  // ===== RECONNECT =====
  handleReconnect() {
    if (this.isManualDisconnect || this._isDestroyed) {
      this.log('Manual disconnect or destroyed, skipping reconnect');
      return;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[ChatClient] Max reconnect attempts reached, giving up');
      if (this.onError) {
        this.onError({
          type: 'max_reconnect',
          message: `Max reconnect attempts (${this.maxReconnectAttempts}) reached`
        });
      }
      return;
    }

    this.reconnectAttempts++;
    
    const baseDelay = this.reconnectDelay * Math.pow(this.reconnectBackoff, this.reconnectAttempts - 1);
    const jitter = Math.random() * 500;
    const delay = Math.min(baseDelay + jitter, 30000);
    
    this.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      if (!this.isConnected && !this.isManualDisconnect && !this._isDestroyed) {
        this.log(`Attempting reconnect ${this.reconnectAttempts}...`);
        if (this.onReconnect) {
          this.onReconnect(this.reconnectAttempts);
        }
        this.connect();
      }
    }, delay);
  }

  // ===== getWebSocketUrl with correct token handling =====
  getWebSocketUrl() {
    let token = this.token;
    
    if (!token) {
      try {
        token = localStorage.getItem('psh_auth_token') ||
                localStorage.getItem('psh_staff_token') ||
                localStorage.getItem('token') ||
                localStorage.getItem('auth_token');
      } catch (e) {}
    }
    
    if (!token) {
      try {
        const session = JSON.parse(sessionStorage.getItem('auth_session') || '{}');
        token = session.token || session.accessToken;
      } catch (e) {}
    }

    if (!token) {
      console.warn('[ChatClient] ❌ No token available');
    }

    let base = this.apiBase || 'https://api.primeshieldhub.com';
    base = base.replace(/\/+$/, '');
    
    const isProd = base.includes('primeshieldhub.com');
    const wsProtocol = isProd ? 'wss' : 'ws';
    const wsHost = base.replace(/^https?:\/\//, '');
    
    const encodedRoomId = encodeURIComponent(this.roomId);
    const encodedRoomType = encodeURIComponent(this.roomType);
    const encodedToken = encodeURIComponent(token || '');
    
    const wsUrl = `${wsProtocol}://${wsHost}/api/chat/ws?room=${encodedRoomId}&token=${encodedToken}&type=${encodedRoomType}`;
    
    console.log(`[ChatClient] WebSocket URL: ${wsUrl.replace(/token=[^&]+/, 'token=REDACTED')}`);
    console.log(`[ChatClient] Token present: ${!!token}`);
    console.log(`[ChatClient] Protocol: ${wsProtocol}, Host: ${wsHost}`);
    
    return wsUrl;
  }

  // ===== GET STATUS =====
  getStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      isAuthenticated: this.isAuthenticated,
      roomId: this.roomId,
      roomType: this.roomType,
      connectionId: this.connectionId,
      sessionId: this.sessionId,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      apiBase: this.apiBase,
      messageQueueSize: this.messageQueue.length,
      pingCount: this.pingCount,
      pongCount: this.pongCount,
      receivedMessages: this.receivedMessageIds.size,
      isDestroyed: this._isDestroyed,
      userId: this.user?.id || null,
      userName: this.user?.name || null,
      soundEnabled: this.soundEnabled,
      // ===== ENHANCEMENT: Intelligence stats =====
      productKnowledge: Object.keys(this.PRODUCT_KNOWLEDGE).length,
      misspellings: Object.keys(this.MISSPELLINGS).length,
      intelligenceEnabled: true
    };
  }

  // ===== RECONNECT MANUALLY =====
  reconnect() {
    this.log('Manual reconnect requested');
    this.reconnectAttempts = 0;
    this.disconnect();
    setTimeout(() => {
      if (!this._isDestroyed) {
        this.connect();
      }
    }, 500);
  }
}

// ===== EXPORT =====
export default ChatClient;
