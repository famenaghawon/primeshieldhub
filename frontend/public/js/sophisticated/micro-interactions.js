// ============================================================================
// public../js/sophisticated/micro-interactions.js - Micro Interactions Engine v2.0
// ============================================================================
// Adds micro-interactions: form animations, success celebrations, loading states,
// haptic feedback, and smooth scrolling.
// ============================================================================

import { CONFIG } from '../config.js';
import { bus, Events } from '../events.js';

// ===== STYLES =====
const STYLES = `
    .quantum-counter {
        position: absolute;
        bottom: -20px;
        right: 10px;
        font-size: 11px;
        font-family: 'Inter', sans-serif;
        transition: all 0.3s ease;
        pointer-events: none;
    }

    .quantum-particle {
        position: fixed;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        pointer-events: none;
        z-index: 99999;
        filter: blur(1px);
        box-shadow: 0 0 10px currentColor;
        animation: particle-fade 1s ease-out forwards;
    }

    .quantum-spinner.quantum-enhanced {
        width: 150px;
        height: 150px;
    }

    @keyframes particle-fade {
        0% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(0.5); }
    }

    @keyframes quantum-pulse {
        0%, 100% { border-color: rgba(0, 247, 255, 0.3); }
        50% { border-color: #00f7ff; }
    }

    @keyframes quantum-glow {
        0%, 100% { box-shadow: 0 0 5px rgba(214, 178, 94, 0.2); }
        50% { box-shadow: 0 0 20px rgba(214, 178, 94, 0.4); }
    }

    .click-feedback {
        animation: click-feedback 0.2s ease;
    }

    @keyframes click-feedback {
        0% { transform: scale(0.95); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
        .quantum-particle {
            display: none;
        }
        .quantum-spinner.quantum-enhanced {
            animation: none !important;
        }
        .quantum-spinner.quantum-enhanced * {
            animation: none !important;
        }
        .click-feedback {
            animation: none !important;
        }
    }
`;

// ===== MICRO INTERACTIONS CLASS =====
export class MicroInteractions {
    constructor(options = {}) {
        this.options = {
            enableFormAnimations: true,
            enableSuccessCelebration: true,
            enableLoadingStates: true,
            enableHapticFeedback: true,
            enableSmoothScrolling: true,
            reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            particleCount: 50,
            ...options
        };

        this.isInitialized = false;
        this._eventListeners = [];
        this._observers = [];
        this._intervalIds = [];
        this._counterElements = [];
        this._particles = [];

        // Inject styles
        this._injectStyles();
    }

    // ===== INJECT STYLES =====
    _injectStyles() {
        if (!document.getElementById('micro-interactions-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'micro-interactions-styles';
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

        // Initialize features
        if (this.options.enableFormAnimations) {
            this._initFormAnimations();
        }

        if (this.options.enableSuccessCelebration) {
            this._initSuccessCelebration();
        }

        if (this.options.enableLoadingStates) {
            this._initLoadingStates();
        }

        if (this.options.enableHapticFeedback) {
            this._initHapticFeedback();
        }

        if (this.options.enableSmoothScrolling) {
            this._initSmoothScrolling();
        }

        // Listen for DOM changes
        this._setupMutationObserver();

        if (CONFIG.debug) {
            console.log('[MicroInteractions] Initialized');
        }

        // Emit event
        if (bus?.emit) {
            bus.emit(Events.MICRO_INTERACTIONS_READY);
        }
    }

    // ===== FORM ANIMATIONS =====
    _initFormAnimations() {
        if (this.options.reduceMotion) return;

        const fields = document.querySelectorAll('.form-input, .form-select, .form-textarea, [data-form-field]');
        
        for (const field of fields) {
            // Focus/blur animations
            const handler = this._createFieldHandler(field);
            field.addEventListener('focus', handler.onFocus);
            field.addEventListener('blur', handler.onBlur);
            field.addEventListener('input', handler.onInput);
            
            this._eventListeners.push(() => {
                field.removeEventListener('focus', handler.onFocus);
                field.removeEventListener('blur', handler.onBlur);
                field.removeEventListener('input', handler.onInput);
            });
        }
    }

    _createFieldHandler(field) {
        const label = field.closest('.form-group')?.querySelector('.form-label, [data-form-label]');
        const isTextarea = field.tagName === 'TEXTAREA';
        
        return {
            onFocus: () => {
                if (label) {
                    label.style.transform = 'translateX(10px)';
                    label.style.color = 'var(--quantum-gold, #d6b25e)';
                    label.style.transition = 'all 0.3s ease';
                }
                field.style.borderColor = 'var(--quantum-gold, #d6b25e)';
                field.style.boxShadow = '0 0 20px rgba(214, 178, 94, 0.1)';
            },
            onBlur: () => {
                if (label && !field.value) {
                    label.style.transform = 'translateX(0)';
                    label.style.color = '';
                }
                field.style.borderColor = '';
                field.style.boxShadow = '';
            },
            onInput: () => {
                this._updateCharacterCounter(field);
            }
        };
    }

    _updateCharacterCounter(field) {
        const maxLength = field.maxLength || field.getAttribute('maxlength');
        if (!maxLength) return;

        const remaining = parseInt(maxLength) - field.value.length;
        const parent = field.parentElement;
        
        if (!parent) return;

        // Remove existing counter
        const existing = parent.querySelector('.quantum-counter');
        if (existing) existing.remove();

        // Only show counter if near limit
        if (remaining > 50) return;

        const counter = document.createElement('span');
        counter.className = 'quantum-counter';
        counter.textContent = remaining === 0 ? '⚠️ Limit reached' : `${remaining} characters remaining`;
        counter.style.color = remaining < 10 ? '#ff3366' : remaining < 20 ? '#ffaa33' : 'rgba(255,255,255,0.5)';
        
        parent.style.position = 'relative';
        parent.appendChild(counter);
        
        this._counterElements.push(counter);

        if (remaining === 0) {
            field.style.borderColor = '#ff3366';
            field.style.animation = 'quantum-pulse 1s ease';
        }
    }

    // ===== SUCCESS CELEBRATION =====
    _initSuccessCelebration() {
        if (this.options.reduceMotion) return;

        // Listen for transaction-complete events
        const handler = (e) => {
            this._triggerCelebration(e.detail || {});
        };
        
        document.addEventListener('transaction-complete', handler);
        document.addEventListener('order-complete', handler);
        document.addEventListener('payment-success', handler);
        
        this._eventListeners.push(() => {
            document.removeEventListener('transaction-complete', handler);
            document.removeEventListener('order-complete', handler);
            document.removeEventListener('payment-success', handler);
        });

        // Also listen to event bus
        if (bus?.on) {
            const busHandler = (data) => {
                this._triggerCelebration(data);
            };
            bus.on(Events.TRANSACTION_COMPLETE, busHandler);
            this._eventListeners.push(() => bus.off(Events.TRANSACTION_COMPLETE, busHandler));
        }
    }

    _triggerCelebration(data) {
        const target = data.target || document.querySelector('.quantum-btn-primary, .success-trigger');
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const count = this.options.particleCount || 50;
        const colors = ['#00f7ff', '#d6b25e', '#b200ff', '#ff3366', '#33ffaa', '#ffd966'];

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                this._createParticle(
                    cx + (Math.random() - 0.5) * 100,
                    cy + (Math.random() - 0.5) * 100,
                    colors[Math.floor(Math.random() * colors.length)]
                );
            }, i * 15);
        }
    }

    _createParticle(x, y, color) {
        if (this.options.reduceMotion) return;

        const particle = document.createElement('div');
        particle.className = 'quantum-particle';
        particle.style.cssText = `
            left: ${x}px;
            top: ${y}px;
            width: ${4 + Math.random() * 8}px;
            height: ${4 + Math.random() * 8}px;
            background: ${color};
            color: ${color};
        `;

        const angle = Math.random() * Math.PI * 2;
        const velocity = 3 + Math.random() * 12;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity - 4;

        document.body.appendChild(particle);
        this._particles.push(particle);

        let startTime = performance.now();
        const duration = 800 + Math.random() * 400;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                const xPos = x + vx * progress * 80;
                const yPos = y + vy * progress * 80 + 0.5 * 800 * progress * progress;
                
                particle.style.left = `${xPos}px`;
                particle.style.top = `${yPos}px`;
                particle.style.opacity = 1 - progress;
                particle.style.transform = `scale(${1 - progress * 0.5})`;
                
                requestAnimationFrame(animate);
            } else {
                particle.remove();
                const index = this._particles.indexOf(particle);
                if (index !== -1) this._particles.splice(index, 1);
            }
        };

        requestAnimationFrame(animate);
    }

    // ===== LOADING STATES =====
    _initLoadingStates() {
        const originalContent = {};

        // Listen for processing events
        const startHandler = (e) => {
            const target = e.target || document.querySelector('.processing-animation, [data-loading-container]');
            if (!target) return;

            // Store original content
            const id = target.id || 'processing';
            if (!originalContent[id]) {
                originalContent[id] = target.innerHTML;
            }

            target.innerHTML = this._getLoadingHTML();
            target.classList.add('loading-active');
        };

        const endHandler = (e) => {
            const target = e.target || document.querySelector('.processing-animation, [data-loading-container]');
            if (!target) return;

            const id = target.id || 'processing';
            if (originalContent[id]) {
                target.innerHTML = originalContent[id];
                delete originalContent[id];
            }
            target.classList.remove('loading-active');
        };

        window.addEventListener('processing-start', startHandler);
        window.addEventListener('loading-start', startHandler);
        window.addEventListener('processing-end', endHandler);
        window.addEventListener('loading-end', endHandler);

        this._eventListeners.push(() => {
            window.removeEventListener('processing-start', startHandler);
            window.removeEventListener('loading-start', startHandler);
            window.removeEventListener('processing-end', endHandler);
            window.removeEventListener('loading-end', endHandler);
        });

        // Event bus integration
        if (bus?.on) {
            const busStart = () => startHandler({ target: document.querySelector('[data-loading-container]') });
            const busEnd = () => endHandler({ target: document.querySelector('[data-loading-container]') });
            
            bus.on(Events.LOADING_START, busStart);
            bus.on(Events.LOADING_END, busEnd);
            
            this._eventListeners.push(() => {
                bus.off(Events.LOADING_START, busStart);
                bus.off(Events.LOADING_END, busEnd);
            });
        }
    }

    _getLoadingHTML() {
        if (this.options.reduceMotion) {
            return `
                <div style="text-align:center;padding:2rem;color:#9ca3cf;">
                    <span style="display:inline-block;width:20px;height:20px;border:2px solid rgba(0,247,255,0.2);border-top-color:#00f7ff;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:0.5rem;"></span>
                    Loading...
                </div>
            `;
        }

        return `
            <svg class="quantum-spinner quantum-enhanced" width="150" height="150" viewBox="0 0 100 100" style="display:block;margin:0 auto;">
                <defs>
                    <linearGradient id="quantumSpinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#d6b25e">
                            <animate attributeName="stop-color" values="#d6b25e;#00f7ff;#b200ff;#d6b25e" dur="3s" repeatCount="indefinite" />
                        </stop>
                        <stop offset="50%" stop-color="#00f7ff">
                            <animate attributeName="stop-color" values="#00f7ff;#b200ff;#d6b25e;#00f7ff" dur="3s" repeatCount="indefinite" />
                        </stop>
                        <stop offset="100%" stop-color="#b200ff">
                            <animate attributeName="stop-color" values="#b200ff;#d6b25e;#00f7ff;#b200ff" dur="3s" repeatCount="indefinite" />
                        </stop>
                    </linearGradient>
                </defs>
                
                <circle cx="50" cy="50" r="45" fill="none" stroke="url(#quantumSpinGradient)" stroke-width="4" 
                    stroke-dasharray="70 213" stroke-linecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="2s" repeatCount="indefinite"/>
                </circle>
                
                <circle cx="50" cy="50" r="35" fill="none" stroke="url(#quantumSpinGradient)" stroke-width="3" 
                    stroke-dasharray="60 160" stroke-linecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="1.5s" repeatCount="indefinite"/>
                </circle>
                
                <circle cx="50" cy="50" r="25" fill="none" stroke="url(#quantumSpinGradient)" stroke-width="2" 
                    stroke-dasharray="50 107" stroke-linecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="-360 50 50" dur="1s" repeatCount="indefinite"/>
                </circle>
                
                <circle cx="50" cy="50" r="8" fill="url(#quantumSpinGradient)">
                    <animate attributeName="r" values="8;10;8" dur="1s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="1;0.7;1" dur="1s" repeatCount="indefinite"/>
                </circle>
            </svg>
            <p style="text-align:center;color:#9ca3cf;margin-top:1rem;font-size:0.9rem;">Processing...</p>
        `;
    }

    // ===== HAPTIC FEEDBACK =====
    _initHapticFeedback() {
        const elements = document.querySelectorAll('.quantum-btn, .nav-step, [data-haptic]');
        
        for (const el of elements) {
            const handler = this._createHapticHandler(el);
            el.addEventListener('click', handler);
            this._eventListeners.push(() => el.removeEventListener('click', handler));
        }
    }

    _createHapticHandler(element) {
        return (e) => {
            if (this.options.reduceMotion) {
                // Simple feedback
                element.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    element.style.transform = '';
                }, 100);
                return;
            }

            // Visual feedback with animation
            element.classList.add('click-feedback');
            
            // Force reflow for animation restart
            void element.offsetWidth;
            
            element.style.transform = 'scale(0.95)';
            element.style.transition = 'transform 0.1s ease';
            
            setTimeout(() => {
                element.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    element.style.transform = '';
                    element.classList.remove('click-feedback');
                }, 100);
            }, 100);
        };
    }

    // ===== SMOOTH SCROLLING =====
    _initSmoothScrolling() {
        if (this.options.reduceMotion) return;

        const anchors = document.querySelectorAll('a[href^="#"]:not([href="#"])');
        
        for (const anchor of anchors) {
            const handler = (e) => {
                e.preventDefault();
                const targetId = anchor.getAttribute('href');
                if (!targetId || targetId === '#') return;
                
                const target = document.querySelector(targetId);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                        inline: 'nearest'
                    });
                }
            };
            
            anchor.addEventListener('click', handler);
            this._eventListeners.push(() => anchor.removeEventListener('click', handler));
        }
    }

    // ===== MUTATION OBSERVER =====
    _setupMutationObserver() {
        // Observe for new elements that need interactions
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if new form fields were added
                        if (this.options.enableFormAnimations) {
                            const fields = node.querySelectorAll?.('.form-input, .form-select, .form-textarea, [data-form-field]') || [];
                            for (const field of fields) {
                                this._initFormAnimations();
                            }
                        }
                        
                        // Check if new buttons were added
                        if (this.options.enableHapticFeedback) {
                            const buttons = node.querySelectorAll?.('.quantum-btn, .nav-step, [data-haptic]') || [];
                            if (buttons.length > 0) {
                                this._initHapticFeedback();
                            }
                        }
                        
                        // Check if new anchors were added
                        if (this.options.enableSmoothScrolling) {
                            const anchors = node.querySelectorAll?.('a[href^="#"]') || [];
                            if (anchors.length > 0) {
                                this._initSmoothScrolling();
                            }
                        }
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this._observers.push(observer);
    }

    // ===== DESTROY =====
    destroy() {
        // Remove event listeners
        for (const removeFn of this._eventListeners) {
            try { removeFn(); } catch (e) { /* ignore */ }
        }
        this._eventListeners = [];

        // Disconnect observers
        for (const observer of this._observers) {
            try { observer.disconnect(); } catch (e) { /* ignore */ }
        }
        this._observers = [];

        // Clear intervals
        for (const id of this._intervalIds) {
            clearInterval(id);
        }
        this._intervalIds = [];

        // Remove particles
        for (const particle of this._particles) {
            try { particle.remove(); } catch (e) { /* ignore */ }
        }
        this._particles = [];

        // Remove counters
        for (const counter of this._counterElements) {
            try { counter.remove(); } catch (e) { /* ignore */ }
        }
        this._counterElements = [];

        // Reset styles
        document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
            el.style.borderColor = '';
            el.style.boxShadow = '';
        });

        this.isInitialized = false;
        console.log('[MicroInteractions] Destroyed');
    }

    // ===== REFRESH =====
    refresh() {
        if (!this.isInitialized) {
            this.init();
            return;
        }

        // Re-initialize features
        if (this.options.enableFormAnimations) {
            this._initFormAnimations();
        }
        if (this.options.enableHapticFeedback) {
            this._initHapticFeedback();
        }
        if (this.options.enableSmoothScrolling) {
            this._initSmoothScrolling();
        }

        console.log('[MicroInteractions] Refreshed');
    }
}

// ===== SINGLETON INSTANCE =====
let instance = null;

export function getMicroInteractions(options = {}) {
    if (!instance) {
        instance = new MicroInteractions(options);
    }
    return instance;
}

// ===== AUTO-INIT =====
if (typeof document !== 'undefined') {
    const initUI = () => {
        const interactions = getMicroInteractions();
        interactions.init();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        setTimeout(initUI, 100);
    }
}

// ===== EXPORT =====
export { MicroInteractions };
export default MicroInteractions;
