// ============================================================================
// public../js/sophisticated/ai-closer.js - AI Closer Module v2.0
// ============================================================================
// PrimeShieldHub AI Assistant with website knowledge base integration.
// ============================================================================

// ============================================================================
// ai-closer.js — PrimeShieldHub AI Closer Module
// FIXED: All import paths corrected to match actual file structure
// ============================================================================

import { CONFIG } from '../config.js';
import { auth } from '../auth.js';
import { api } from '../api-client.js';
import { bus, Events } from '../events.js';
import { navigate } from '../router.js';
import { getDeviceFingerprint } from '../sophisticated/fraud-engine/fingerprint.js';
import { askBrain } from '../ai-brain-client.js';
import { buildAIContext, websiteKnowledge, localAIResponse } from '../website-knowledge.js';

// ===== CONSTANTS =====
const TYPING_TIMEOUT = 5000; // 5 seconds max typing
const MAX_HISTORY = 50;
const SUGGESTIONS = [
    '💳 Payment methods',
    '🚚 Delivery time',
    '🌟 Reseller program',
    '🛡️ Warranty info',
    '📱 Product prices',
    '📍 Track my order',
    '🏢 Enterprise solutions',
    '✅ Authenticity guarantee'
];

// ===== AI CLOSER CLASS =====
class AICloser {
    constructor(options = {}) {
        this.options = {
            autoOpen: false,
            debug: CONFIG.debug || false,
            ...options
        };

        // DOM elements
        this.chatbot = document.getElementById('aiChatbot');
        this.toggleBtn = document.getElementById('aiChatbotToggle');
        this.closeBtn = document.getElementById('aiChatbotClose');
        this.messagesContainer = document.getElementById('aiChatContent');
        this.input = document.getElementById('aiInput');
        this.sendBtn = document.getElementById('aiSend');
        
        // State
        this.isOpen = false;
        this.isTyping = false;
        this.conversationHistory = [];
        this._typingTimeout = null;
        this._eventListeners = [];
        this._initialized = false;
        
        // Init
        this.init();
    }

    // ===== INIT =====
    init() {
        if (this._initialized) return;

        // Check if chatbot elements exist
        if (!this.chatbot && !this.toggleBtn) {
            if (this.options.debug) {
                console.log('[AICloser] Running in background mode (no DOM elements)');
            }
            // Still set up event listeners for bus
            this._setupBusListeners();
            return;
        }

        if (!this.chatbot || !this.toggleBtn) {
            console.warn('[AICloser] Partial DOM elements missing — some features disabled');
        }

        // Attach event listeners
        this._setupEventListeners();
        this._setupBusListeners();

        // Add suggestions
        this._addSuggestions();

        // Load saved conversation
        this._loadConversation();

        // Auto-open if enabled
        if (this.options.autoOpen) {
            setTimeout(() => this.open(), 1000);
        }

        this._initialized = true;

        if (this.options.debug) {
            console.log('[AICloser] Initialized with website knowledge base');
        }

        // Emit event
        if (bus?.emit) {
            bus.emit(Events.AI_CLOSER_READY);
        }
    }

    // ===== DOM EVENT LISTENERS =====
    _setupEventListeners() {
        // Toggle button
        if (this.toggleBtn) {
            const handler = () => this.toggle();
            this.toggleBtn.addEventListener('click', handler);
            this._eventListeners.push(() => this.toggleBtn.removeEventListener('click', handler));
        }

        // Close button
        if (this.closeBtn) {
            const handler = () => this.close();
            this.closeBtn.addEventListener('click', handler);
            this._eventListeners.push(() => this.closeBtn.removeEventListener('click', handler));
        }

        // Send button
        if (this.sendBtn) {
            const handler = () => this.sendMessage();
            this.sendBtn.addEventListener('click', handler);
            this._eventListeners.push(() => this.sendBtn.removeEventListener('click', handler));
        }

        // Input field
        if (this.input) {
            const keyHandler = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            };
            this.input.addEventListener('keypress', keyHandler);
            this._eventListeners.push(() => this.input.removeEventListener('keypress', keyHandler));

            // Auto-resize
            const resizeHandler = () => {
                this.input.style.height = 'auto';
                this.input.style.height = Math.min(this.input.scrollHeight, 120) + 'px';
            };
            this.input.addEventListener('input', resizeHandler);
            this._eventListeners.push(() => this.input.removeEventListener('input', resizeHandler));
        }

        // Click outside to close
        if (this.chatbot) {
            const outsideHandler = (e) => {
                if (this.isOpen && this.chatbot && !this.chatbot.contains(e.target) && !this.toggleBtn?.contains(e.target)) {
                    this.close();
                }
            };
            document.addEventListener('click', outsideHandler);
            this._eventListeners.push(() => document.removeEventListener('click', outsideHandler));
        }

        // Escape key to close
        const escHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        };
        document.addEventListener('keydown', escHandler);
        this._eventListeners.push(() => document.removeEventListener('keydown', escHandler));
    }

    // ===== BUS EVENT LISTENERS =====
    _setupBusListeners() {
        if (!bus?.on) return;

        const openHandler = () => this.open();
        bus.on('ai:open', openHandler);
        this._eventListeners.push(() => bus.off('ai:open', openHandler));

        const closeHandler = () => this.close();
        bus.on('ai:close', closeHandler);
        this._eventListeners.push(() => bus.off('ai:close', closeHandler));

        const toggleHandler = () => this.toggle();
        bus.on('ai:toggle', toggleHandler);
        this._eventListeners.push(() => bus.off('ai:toggle', toggleHandler));

        const sendHandler = (msg) => {
            this.open();
            setTimeout(() => this.handleUserMessage(msg), 300);
        };
        bus.on('ai:send', sendHandler);
        this._eventListeners.push(() => bus.off('ai:send', sendHandler));
    }

    // ===== PUBLIC METHODS =====
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        if (!this.chatbot) return;
        this.chatbot.classList.add('active');
        this.isOpen = true;
        if (this.input) {
            setTimeout(() => this.input.focus(), 100);
        }
        if (bus?.emit) {
            bus.emit('ai:opened');
        }
    }

    close() {
        if (!this.chatbot) return;
        this.chatbot.classList.remove('active');
        this.isOpen = false;
        if (bus?.emit) {
            bus.emit('ai:closed');
        }
    }

    async sendMessage() {
        if (!this.input) return;
        const message = this.input.value.trim();
        if (!message) return;

        this.input.value = '';
        this.input.style.height = 'auto';
        await this.handleUserMessage(message);
    }

    async handleUserMessage(message) {
        // Add user message
        this.addMessage(message, 'user');
        this.conversationHistory.push({ role: 'user', content: message });

        // Show typing indicator
        this.showTyping();

        try {
            // Get AI response
            const context = this._buildContext();
            const response = await this._sendToAI(message, context);

            this.hideTyping();

            if (response.error) {
                const fallback = localAIResponse(message);
                this.addMessage(fallback, 'bot');
                this.conversationHistory.push({ role: 'assistant', content: fallback });
                this._saveConversation();
                return;
            }

            const aiMessage = response.reply || response.message || localAIResponse(message);
            this.addMessage(aiMessage, 'bot');
            this.conversationHistory.push({ role: 'assistant', content: aiMessage });

            // Handle navigation suggestions
            if (response.action === 'navigate' && response.url) {
                setTimeout(() => {
                    try {
                        navigate(response.url);
                    } catch (e) {
                        window.location.href = response.url;
                    }
                }, 1500);
            }

            this._saveConversation();

        } catch (error) {
            this.hideTyping();
            console.error('[AICloser] Error:', error);
            const fallback = localAIResponse(message);
            this.addMessage(fallback, 'bot');
            this.conversationHistory.push({ role: 'assistant', content: fallback });
            this._saveConversation();
        }
    }

    // ===== MESSAGE UI =====
    addMessage(text, sender) {
        if (!this.messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${sender}`;
        
        if (sender === 'bot') {
            messageDiv.innerHTML = this._formatBotMessage(text);
        } else {
            messageDiv.textContent = text;
        }

        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    showTyping() {
        if (this.isTyping) return;
        this.isTyping = true;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message bot typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = '<span>.</span><span>.</span><span>.</span>';
        this.messagesContainer.appendChild(typingDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

        // Safety timeout
        if (this._typingTimeout) {
            clearTimeout(this._typingTimeout);
        }
        this._typingTimeout = setTimeout(() => {
            if (this.isTyping) {
                this.hideTyping();
                const fallback = localAIResponse('I apologize for the delay. How can I help you?');
                this.addMessage(fallback, 'bot');
                this.conversationHistory.push({ role: 'assistant', content: fallback });
                this._saveConversation();
            }
        }, TYPING_TIMEOUT);
    }

    hideTyping() {
        if (!this.isTyping) return;
        const typingDiv = document.getElementById('typing-indicator');
        if (typingDiv) typingDiv.remove();
        this.isTyping = false;
        if (this._typingTimeout) {
            clearTimeout(this._typingTimeout);
            this._typingTimeout = null;
        }
    }

    // ===== SUGGESTIONS =====
    _addSuggestions() {
        if (!this.messagesContainer) return;
        if (document.querySelector('.ai-suggestions')) return;

        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'ai-suggestions';
        suggestionsDiv.style.cssText = `
            display: flex;
            gap: 8px;
            padding: 8px 16px;
            overflow-x: auto;
            flex-wrap: wrap;
            border-top: 1px solid rgba(255,255,255,0.05);
        `;

        SUGGESTIONS.forEach(s => {
            const chip = document.createElement('button');
            chip.textContent = s;
            chip.className = 'ai-suggestion-chip';
            chip.style.cssText = `
                background: rgba(255,255,255,0.08);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 20px;
                padding: 6px 14px;
                font-size: 12px;
                cursor: pointer;
                color: #c0c0c0;
                white-space: nowrap;
                transition: all 0.2s;
                font-family: 'Inter', sans-serif;
            `;
            chip.addEventListener('mouseenter', () => {
                chip.style.background = 'rgba(214,178,94,0.2)';
                chip.style.borderColor = '#d6b25e';
                chip.style.color = '#d6b25e';
            });
            chip.addEventListener('mouseleave', () => {
                chip.style.background = 'rgba(255,255,255,0.08)';
                chip.style.borderColor = 'rgba(255,255,255,0.1)';
                chip.style.color = '#c0c0c0';
            });
            chip.addEventListener('click', () => this.handleUserMessage(s));
            suggestionsDiv.appendChild(chip);
        });

        const inputContainer = this.chatbot?.querySelector('.ai-input-container');
        if (inputContainer) {
            inputContainer.parentNode.insertBefore(suggestionsDiv, inputContainer);
        } else {
            this.messagesContainer.parentNode.insertBefore(suggestionsDiv, this.messagesContainer.nextSibling);
        }
    }

    // ===== AI COMMUNICATION =====
    async _sendToAI(message, context) {
        try {
            // Try backend AI first
            if (typeof askBrain === 'function') {
                const response = await askBrain({
                    type: 'chat',
                    message,
                    context,
                    systemPrompt: buildAIContext(),
                    fingerprint: await getDeviceFingerprint(),
                    features: window.getBehaviorFeatures ? window.getBehaviorFeatures() : {}
                });
                return response;
            }

            // Fallback: direct fetch
            const fingerprint = await getDeviceFingerprint();
            const response = await fetch(`${CONFIG.apiBase}/brain`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-fingerprint': fingerprint,
                    'Authorization': auth.getToken() ? `Bearer ${auth.getToken()}` : ''
                },
                credentials: 'include',
                body: JSON.stringify({
                    type: 'chat',
                    message,
                    context,
                    systemPrompt: buildAIContext(),
                    features: window.getBehaviorFeatures ? window.getBehaviorFeatures() : {}
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.warn('[AICloser] Backend AI unavailable:', error.message);
            return { error: true, message: error.message };
        }
    }

    // ===== HELPERS =====
    _buildContext() {
        const user = auth.getUser();
        return {
            url: window.location.pathname,
            referrer: document.referrer,
            user: user ? {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name
            } : null,
            isAuthenticated: !!user,
            productId: this._getProductIdFromUrl(),
            cartCount: window.cart ? window.cart.getCount() : 0,
            timestamp: Date.now()
        };
    }

    _getProductIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const idParam = params.get('id');
        if (idParam) return idParam;
        
        const match = window.location.pathname.match(/\/product\/([^\/]+)/);
        return match ? match[1] : null;
    }

    _formatBotMessage(text) {
        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:#d6b25e;text-decoration:underline;">$1</a>')
            .replace(/\n- /g, '<br>• ')
            .replace(/\n/g, '<br>');
        
        // Convert bullet points
        formatted = formatted.replace(/•/g, '<span style="color:#d6b25e;">•</span>');
        
        return formatted;
    }

    // ===== CONVERSATION STORAGE =====
    _saveConversation() {
        if (this.conversationHistory.length === 0) return;
        const toStore = this.conversationHistory.slice(-MAX_HISTORY);
        try {
            localStorage.setItem('psh_ai_conversation', JSON.stringify(toStore));
        } catch (e) {
            // Ignore
        }
    }

    _loadConversation() {
        try {
            const saved = localStorage.getItem('psh_ai_conversation');
            if (saved) {
                const messages = JSON.parse(saved);
                if (Array.isArray(messages) && messages.length > 0) {
                    messages.forEach(msg => {
                        const sender = msg.role === 'assistant' ? 'bot' : 'user';
                        this.addMessage(msg.content, sender);
                    });
                    this.conversationHistory = messages;
                }
            }
        } catch (e) {
            // Ignore
        }
    }

    // ===== CLEAR CONVERSATION =====
    clearConversation() {
        this.conversationHistory = [];
        localStorage.removeItem('psh_ai_conversation');
        if (this.messagesContainer) {
            // Keep suggestions, remove messages
            const suggestions = this.messagesContainer.querySelector('.ai-suggestions');
            this.messagesContainer.innerHTML = '';
            if (suggestions) {
                this.messagesContainer.appendChild(suggestions);
            }
        }
        if (this.options.debug) {
            console.log('[AICloser] Conversation cleared');
        }
    }

    // ===== DESTROY =====
    destroy() {
        // Clear timeout
        if (this._typingTimeout) {
            clearTimeout(this._typingTimeout);
            this._typingTimeout = null;
        }

        // Remove event listeners
        for (const removeFn of this._eventListeners) {
            try { removeFn(); } catch (e) { /* ignore */ }
        }
        this._eventListeners = [];

        // Close chatbot
        this.close();

        this._initialized = false;
        if (this.options.debug) {
            console.log('[AICloser] Destroyed');
        }
    }
}

// ===== SINGLETON =====
let instance = null;

export function getAICloser(options = {}) {
    if (!instance) {
        instance = new AICloser(options);
    }
    return instance;
}

// ===== AUTO-INIT =====
if (typeof document !== 'undefined') {
    const init = () => {
        // Don't auto-create if disabled
        const disable = document.querySelector('meta[name="disable-ai-closer"]')?.content === 'true';
        if (!disable) {
            getAICloser();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

// ===== EXPORTS =====
export default getAICloser;
