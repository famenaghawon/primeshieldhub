// ============================================================================
// public../js/sophisticated/ui-enhancer.js - UI Enhancement Engine v2.0
// ============================================================================
// Adds interactive UI effects: parallax, 3D cards, ripples, glows, typing animations.
// ============================================================================

import { CONFIG } from '../config.js';
import { bus, Events } from '../events.js';

// ===== CONSTANTS =====
const MOUSE_THROTTLE_MS = 16; // ~60fps
const RIPPLE_DURATION_MS = 1000;
const TYPING_INTERVAL_MS = 4000;
const PARALLAX_FACTOR = 0.5;

// ===== STYLES =====
const STYLES = `
    .quantum-ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(214, 178, 94, 0.3);
        transform: scale(0);
        animation: quantum-ripple-anim 1000ms ease-out forwards;
        pointer-events: none;
        width: 100px;
        height: 100px;
        margin-left: -50px;
        margin-top: -50px;
    }

    @keyframes quantum-ripple-anim {
        0% { transform: scale(0); opacity: 1; }
        100% { transform: scale(4); opacity: 0; }
    }

    @keyframes quantum-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(214, 178, 94, 0.2); }
        50% { box-shadow: 0 0 20px 5px rgba(214, 178, 94, 0.3); }
    }

    @keyframes quantum-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }

    .hologram-card {
        transition: transform 0.1s ease;
        transform-style: preserve-3d;
        will-change: transform;
    }

    .hologram-card:hover {
        transform: perspective(1000px) rotateY(3deg) rotateX(-3deg) translateZ(10px);
    }

    .quantum-bg {
        transition: transform 0.1s linear;
        will-change: transform;
    }

    .security-text {
        transition: opacity 0.3s ease;
    }

    .glow-effect {
        position: relative;
        transition: all 0.3s ease;
    }

    .glow-effect::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: inherit;
        background: linear-gradient(135deg, #00f7ff, #b200ff, #ffd966);
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: -1;
        filter: blur(8px);
    }

    .glow-effect:hover::before {
        opacity: 0.5;
    }

    @media (prefers-reduced-motion: reduce) {
        .quantum-ripple {
            animation: none;
        }
        .hologram-card {
            transform: none !important;
            transition: none !important;
        }
        .quantum-bg {
            transform: none !important;
        }
        .glow-effect::before {
            display: none;
        }
    }
`;

// ===== UI ENHANCER CLASS =====
export class UIEnhancer {
    constructor(options = {}) {
        this.options = {
            enableParallax: true,
            enable3DCards: true,
            enableRipples: true,
            enableGlows: true,
            enableTyping: true,
            reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            ...options
        };

        this.mousePosition = { x: 0, y: 0 };
        this.isInitialized = false;
        this._rafId = null;
        this._intervalIds = [];
        this._eventListeners = [];
        this._cardElements = [];
        this._typingIndex = 0;
        this._securityMessages = [];

        // Inject styles
        this._injectStyles();

        // Bind methods
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onScroll = this._onScroll.bind(this);
        this._onResize = this._onResize.bind(this);
        this._animate = this._animate.bind(this);
    }

    // ===== INJECT STYLES =====
    _injectStyles() {
        if (!document.getElementById('ui-enhancer-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'ui-enhancer-styles';
            styleEl.textContent = STYLES;
            document.head.appendChild(styleEl);
        }
    }

    // ===== INIT =====
    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        // Check for reduced motion
        if (window.matchMedia) {
            const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
            this.options.reduceMotion = motionMedia.matches;
            
            const motionHandler = (e) => {
                this.options.reduceMotion = e.matches;
            };
            motionMedia.addEventListener('change', motionHandler);
            this._eventListeners.push(() => motionMedia.removeEventListener('change', motionHandler));
        }

        // Track mouse (throttled)
        if (!this.options.reduceMotion) {
            document.addEventListener('mousemove', this._onMouseMove, { passive: true });
            this._eventListeners.push(() => document.removeEventListener('mousemove', this._onMouseMove));

            // Start animation loop for 3D cards
            if (this.options.enable3DCards) {
                this._rafId = requestAnimationFrame(this._animate);
            }
        }

        // Parallax on scroll
        if (this.options.enableParallax) {
            window.addEventListener('scroll', this._onScroll, { passive: true });
            this._eventListeners.push(() => window.removeEventListener('scroll', this._onScroll));
        }

        // Resize handler
        window.addEventListener('resize', this._onResize, { passive: true });
        this._eventListeners.push(() => window.removeEventListener('resize', this._onResize));

        // Initialize effects
        this._init3DCards();
        this._initRipples();
        this._initGlows();
        this._initTyping();

        // Emit event
        if (bus?.emit) {
            bus.emit(Events.UI_ENHANCER_READY);
        }

        console.log('[UIEnhancer] Initialized');
    }

    // ===== MOUSE TRACKING =====
    _onMouseMove(e) {
        this.mousePosition.x = e.clientX;
        this.mousePosition.y = e.clientY;
    }

    // ===== ANIMATION LOOP =====
    _animate() {
        if (!this.options.enable3DCards) return;

        this._update3DCards();

        if (!this.options.reduceMotion) {
            this._rafId = requestAnimationFrame(this._animate);
        }
    }

    // ===== 3D CARDS =====
    _init3DCards() {
        if (this.options.reduceMotion) return;

        // Cache card elements
        this._cardElements = document.querySelectorAll('.hologram-card');
        if (this._cardElements.length === 0) return;

        // Add hover class for 3D effect
        this._cardElements.forEach(card => {
            if (!card.classList.contains('hologram-card-enhanced')) {
                card.classList.add('hologram-card-enhanced');
            }
        });
    }

    _update3DCards() {
        if (this.options.reduceMotion) return;
        if (this._cardElements.length === 0) return;

        const { x: mouseX, y: mouseY } = this.mousePosition;

        for (const card of this._cardElements) {
            const rect = card.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // Only update if mouse is near card
            const distance = Math.hypot(mouseX - centerX, mouseY - centerY);
            if (distance > window.innerWidth * 0.5) {
                // Reset card if mouse is far
                if (card._lastTransform) {
                    card.style.transform = '';
                    card.style.transition = 'transform 0.5s ease';
                    setTimeout(() => {
                        card.style.transition = '';
                    }, 500);
                }
                continue;
            }

            const rotateX = ((mouseY - centerY) / (rect.height / 2)) * -5;
            const rotateY = ((mouseX - centerX) / (rect.width / 2)) * 5;
            
            // Clamp rotations
            const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
            const finalRotateX = clamp(rotateX, -15, 15);
            const finalRotateY = clamp(rotateY, -15, 15);

            card.style.transform = `perspective(1000px) rotateX(${finalRotateX}deg) rotateY(${finalRotateY}deg) translateZ(5px)`;
            card._lastTransform = true;
        }
    }

    // ===== RIPPLE EFFECTS =====
    _initRipples() {
        if (this.options.reduceMotion || !this.options.enableRipples) return;

        const elements = document.querySelectorAll('.quantum-btn, .hologram-card, [data-ripple]');
        
        for (const element of elements) {
            element.addEventListener('click', this._createRipple.bind(this, element));
            this._eventListeners.push(() => element.removeEventListener('click', this._createRipple));
        }
    }

    _createRipple(element, e) {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement('div');
        ripple.className = 'quantum-ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        element.appendChild(ripple);

        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.remove();
            }
        }, RIPPLE_DURATION_MS);
    }

    // ===== GLOW EFFECTS =====
    _initGlows() {
        if (!this.options.enableGlows) return;

        const elements = document.querySelectorAll('.nav-step, .quantum-btn, [data-glow]');
        
        for (const element of elements) {
            if (!element.classList.contains('glow-effect')) {
                element.classList.add('glow-effect');
            }
        }
    }

    // ===== TYPING ANIMATIONS =====
    _initTyping() {
        if (this.options.reduceMotion || !this.options.enableTyping) return;

        const badge = document.querySelector('.security-text, [data-typing]');
        if (!badge) return;

        // Get messages from data attribute or use defaults
        const messagesAttr = badge.getAttribute('data-messages');
        this._securityMessages = messagesAttr 
            ? JSON.parse(messagesAttr)
            : [
                '🔒 End-to-end encrypted',
                '🛡️ Quantum-safe protocols',
                '⚡ Real-time fraud detection',
                '🌐 Secure payment gateway',
                '✅ 100% Authentic Products',
                '🚀 Nationwide Delivery'
            ];

        this._typingIndex = 0;
        badge.textContent = this._securityMessages[0];

        const intervalId = setInterval(() => {
            this._typingIndex = (this._typingIndex + 1) % this._securityMessages.length;
            badge.style.opacity = '0';
            
            setTimeout(() => {
                badge.textContent = this._securityMessages[this._typingIndex];
                badge.style.opacity = '1';
            }, 300);
        }, TYPING_INTERVAL_MS);

        this._intervalIds.push(intervalId);
    }

    // ===== PARALLAX =====
    _onScroll() {
        if (this.options.reduceMotion || !this.options.enableParallax) return;

        const scrolled = window.scrollY;
        const bg = document.querySelector('.quantum-bg');
        const rain = document.querySelector('.binary-rain');

        if (bg) {
            bg.style.transform = `translateY(${scrolled * 0.3}px)`;
        }

        if (rain) {
            rain.style.transform = `translateY(${scrolled * 0.2}px)`;
        }
    }

    // ===== RESIZE =====
    _onResize() {
        // Update card positions if needed
        if (this._cardElements.length > 0) {
            // Force update on next frame
            if (this._rafId) {
                cancelAnimationFrame(this._rafId);
                this._rafId = requestAnimationFrame(this._animate);
            }
        }
    }

    // ===== DESTROY =====
    destroy() {
        // Cancel animation frame
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        // Clear intervals
        for (const id of this._intervalIds) {
            clearInterval(id);
        }
        this._intervalIds = [];

        // Remove event listeners
        for (const removeFn of this._eventListeners) {
            try { removeFn(); } catch (e) { /* ignore */ }
        }
        this._eventListeners = [];

        // Reset card transforms
        for (const card of this._cardElements) {
            card.style.transform = '';
            card.style.transition = '';
        }
        this._cardElements = [];

        // Reset parallax
        const bg = document.querySelector('.quantum-bg');
        const rain = document.querySelector('.binary-rain');
        if (bg) bg.style.transform = '';
        if (rain) rain.style.transform = '';

        // Remove ripples
        document.querySelectorAll('.quantum-ripple').forEach(el => el.remove());

        this.isInitialized = false;
        console.log('[UIEnhancer] Destroyed');
    }

    // ===== PUBLIC METHODS =====
    /**
     * Refresh UI elements (call after DOM changes)
     */
    refresh() {
        this._init3DCards();
        this._initRipples();
        this._initGlows();
        this._initTyping();
        console.log('[UIEnhancer] Refreshed');
    }

    /**
     * Set custom typing messages
     */
    setTypingMessages(messages) {
        this._securityMessages = messages;
        this._typingIndex = 0;
        const badge = document.querySelector('.security-text, [data-typing]');
        if (badge) {
            badge.textContent = messages[0];
        }
    }

    /**
     * Add 3D card effect to new elements
     */
    add3DCards(elements) {
        if (this.options.reduceMotion) return;
        
        const newElements = elements instanceof NodeList ? elements : [elements];
        for (const el of newElements) {
            if (!el.classList.contains('hologram-card')) {
                el.classList.add('hologram-card');
            }
            if (!el.classList.contains('hologram-card-enhanced')) {
                el.classList.add('hologram-card-enhanced');
            }
        }
        this._cardElements = document.querySelectorAll('.hologram-card');
    }
}

// ===== SINGLETON INSTANCE =====
let instance = null;

export function getUIEnhancer(options = {}) {
    if (!instance) {
        instance = new UIEnhancer(options);
    }
    return instance;
}

// ===== AUTO-INIT =====
if (typeof document !== 'undefined') {
    // Wait for DOM to be ready
    const initUI = () => {
        const enhancer = getUIEnhancer();
        enhancer.init();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        // Small delay to ensure DOM is fully rendered
        setTimeout(initUI, 100);
    }
}

// ===== EXPORT =====
export { UIEnhancer };
export default UIEnhancer;