// ============================================================================
// public../js/sophisticated/fraud-engine/anomaly-detector.js - Anomaly Detector v2.0
// ============================================================================
// Detects fraudulent behavior patterns including bots, automation, and replay attacks.
// ============================================================================

import { CONFIG } from '../../config.js';
import { auth } from '../../auth.js';
import { bus, Events } from '../../events.js';
import { getDeviceFingerprint } from './fingerprint.js';

// ===== CONSTANTS =====
const RECENT_SESSIONS_KEY = 'psh_recent_sessions';
const MAX_SESSIONS = 10;

// ===== DEFAULT THRESHOLDS =====
const DEFAULT_THRESHOLDS = {
    mouseVelocity: 0.8,
    keystrokeVariance: 0.6,
    scrollPattern: 0.7,
    timeOnPage: 30000,
    interactionCount: 10,
    maxInteractions: 100,
    rapidFormFillTime: 5000,
    minMouseMovements: 20,
    minKeystrokes: 5,
    minScrolls: 3
};

// ===== ANOMALY DETECTOR CLASS =====
export class AnomalyDetector {
    constructor(options = {}) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
        this.baselines = new Map();
        this.isInitialized = false;
        this._eventListeners = [];
        this._detectionInterval = null;
        this._lastDetection = 0;
        this._detectionCooldown = 30000; // 30 seconds between detections
    }

    // ===== INIT =====
    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        // Listen for behavior data
        this._setupListeners();

        // Periodic detection
        this._detectionInterval = setInterval(() => {
            this._performDetection();
        }, 30000);

        if (CONFIG.debug) {
            console.log('[AnomalyDetector] Initialized');
        }

        // Emit event
        if (bus?.emit) {
            bus.emit(Events.ANOMALY_DETECTOR_READY);
        }
    }

    // ===== LISTENERS =====
    _setupListeners() {
        // Listen for behavior events from bus
        if (bus?.on) {
            const handler = (data) => {
                if (data.session) {
                    this._checkForAnomalies(data.session);
                }
            };
            bus.on(Events.BEHAVIOR_DATA, handler);
            this._eventListeners.push(() => bus.off(Events.BEHAVIOR_DATA, handler));
        }

        // Listen for DOM events
        const visibilityHandler = () => {
            if (!document.hidden) {
                // User returned - check for anomalies
                this._checkForAnomalies(this._getCurrentSession());
            }
        };
        document.addEventListener('visibilitychange', visibilityHandler);
        this._eventListeners.push(() => document.removeEventListener('visibilitychange', visibilityHandler));
    }

    // ===== MAIN DETECTION =====
    async detectAnomalies(userSession = null) {
        const session = userSession || this._getCurrentSession();
        if (!session) return [];

        const anomalies = [];
        
        // Check for bot-like behavior
        if (this.isBotLike(session)) {
            anomalies.push({
                type: 'BOT_DETECTED',
                confidence: this.calculateBotConfidence(session),
                evidence: this.gatherBotEvidence(session),
                timestamp: Date.now(),
                severity: 'HIGH'
            });
        }
        
        // Check for automation tools
        const automationTools = this.detectAutomationTools();
        if (automationTools.length > 0) {
            anomalies.push({
                type: 'AUTOMATION_DETECTED',
                tools: automationTools,
                timestamp: Date.now(),
                severity: 'CRITICAL'
            });
        }
        
        // Check for session replay attacks
        if (this.detectSessionReplay(session)) {
            anomalies.push({
                type: 'SESSION_REPLAY',
                timestamp: Date.now(),
                severity: 'HIGH'
            });
        }
        
        // Check for unusual interaction patterns
        const interactionAnomalies = this.analyzeInteractions(session.interactions);
        anomalies.push(...interactionAnomalies);
        
        // Report anomalies to backend
        if (anomalies.length > 0) {
            await this._reportAnomalies(anomalies, session);
            
            // Emit event
            if (bus?.emit) {
                bus.emit(Events.ANOMALIES_DETECTED, { 
                    anomalies, 
                    sessionId: session.sessionId,
                    count: anomalies.length
                });
            }
        }
        
        return anomalies;
    }

    // ===== BOT DETECTION =====
    isBotLike(session) {
        // Check for human-like behavior patterns
        const hasNaturalMovements = this.hasHumanlikeMouseMovements(session.mouseMovements);
        const hasNaturalKeystrokes = this.hasHumanlikeKeystrokes(session.keystrokes);
        const hasNaturalScrolling = this.hasHumanlikeScrolling(session.scrolls);
        
        // If all patterns are missing or unnatural, it's likely a bot
        const score = (hasNaturalMovements ? 1 : 0) + 
                      (hasNaturalKeystrokes ? 1 : 0) + 
                      (hasNaturalScrolling ? 1 : 0);
        
        return score < 2;
    }

    hasHumanlikeMouseMovements(movements) {
        if (!movements || movements.length < this.thresholds.minMouseMovements) {
            return false;
        }
        
        // Humans make curved movements, bots make straight lines
        let curvatureSum = 0;
        let validPoints = 0;
        
        for (let i = 2; i < movements.length; i++) {
            const p1 = movements[i-2];
            const p2 = movements[i-1];
            const p3 = movements[i];
            
            if (p1 && p2 && p3 && p1.x !== undefined && p2.x !== undefined && p3.x !== undefined) {
                const angle = this._calculateAngle(p1, p2, p3);
                curvatureSum += Math.abs(angle - Math.PI / 2);
                validPoints++;
            }
        }
        
        if (validPoints === 0) return false;
        
        const avgCurvature = curvatureSum / validPoints;
        return avgCurvature > 0.5; // More curved = more human-like
    }

    _calculateAngle(p1, p2, p3) {
        const a = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const b = Math.hypot(p3.x - p2.x, p3.y - p2.y);
        const c = Math.hypot(p3.x - p1.x, p3.y - p1.y);
        
        if (a === 0 || b === 0) return 0;
        
        return Math.acos(Math.min(1, Math.max(-1, (a*a + b*b - c*c) / (2*a*b))));
    }

    hasHumanlikeKeystrokes(keystrokes) {
        if (!keystrokes || keystrokes.length < this.thresholds.minKeystrokes) {
            return false;
        }
        
        // Humans have variable typing speed, bots are consistent
        const intervals = [];
        for (let i = 1; i < keystrokes.length; i++) {
            const dt = keystrokes[i].timestamp - keystrokes[i-1].timestamp;
            if (dt > 0 && dt < 5000) { // Reasonable interval
                intervals.push(dt);
            }
        }
        
        if (intervals.length < 3) return false;
        
        const avg = intervals.reduce((a,b) => a+b, 0) / intervals.length;
        const variance = intervals.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / intervals.length;
        
        // High variance indicates human
        return variance > this.thresholds.keystrokeVariance * 50;
    }

    hasHumanlikeScrolling(scrolls) {
        if (!scrolls || scrolls.length < this.thresholds.minScrolls) {
            return false;
        }
        
        // Humans scroll in bursts, bots scroll linearly
        let directionChanges = 0;
        let validDeltas = 0;
        
        for (let i = 2; i < scrolls.length; i++) {
            const prevDelta = scrolls[i-1].y - scrolls[i-2].y;
            const currDelta = scrolls[i].y - scrolls[i-1].y;
            
            if (prevDelta !== 0 && currDelta !== 0) {
                if (prevDelta * currDelta < 0) directionChanges++;
                validDeltas++;
            }
        }
        
        if (validDeltas === 0) return false;
        
        return directionChanges > 0;
    }

    // ===== AUTOMATION DETECTION =====
    detectAutomation() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        // Check for headless browsers
        if (userAgent.includes('headless') || 
            userAgent.includes('phantom') || 
            userAgent.includes('selenium') ||
            userAgent.includes('puppeteer')) {
            return true;
        }
        
        // Check for missing properties
        if (!navigator.plugins || navigator.plugins.length === 0) {
            // Some headless browsers have no plugins
            return true;
        }
        
        // Check for webdriver
        if (navigator.webdriver === true) {
            return true;
        }
        
        // Check for automation-specific properties
        if (window.callPhantom || window._phantom || window.__nightmare) {
            return true;
        }
        
        return false;
    }

    detectAutomationTools() {
        const tools = [];
        
        if (navigator.webdriver === true) tools.push('webdriver');
        if (navigator.webdriver === false) tools.push('webdriver-spoofed');
        if (!navigator.languages || navigator.languages.length === 0) tools.push('missing-languages');
        if (navigator.plugins && navigator.plugins.length === 0) tools.push('no-plugins');
        if (window.callPhantom) tools.push('phantomjs');
        if (window._phantom) tools.push('phantomjs');
        if (window.__nightmare) tools.push('nightmare');
        if (window.__webdriver_evaluate) tools.push('webdriver-evaluate');
        if (window.__selenium_evaluate) tools.push('selenium-evaluate');
        if (window.__webdriver_script_function) tools.push('webdriver-script');
        
        // Check user agent for automation tools
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('headless')) tools.push('headless-chrome');
        if (ua.includes('phantomjs')) tools.push('phantomjs');
        if (ua.includes('selenium')) tools.push('selenium');
        if (ua.includes('puppeteer')) tools.push('puppeteer');
        
        return tools;
    }

    // ===== SESSION REPLAY DETECTION =====
    detectSessionReplay(session) {
        if (!session || !session.sessionId) return false;
        
        try {
            const recentSessions = JSON.parse(localStorage.getItem(RECENT_SESSIONS_KEY) || '[]');
            const sessionId = session.sessionId;
            
            if (recentSessions.includes(sessionId)) {
                return true;
            }
            
            recentSessions.push(sessionId);
            if (recentSessions.length > MAX_SESSIONS) {
                recentSessions.shift();
            }
            localStorage.setItem(RECENT_SESSIONS_KEY, JSON.stringify(recentSessions));
        } catch (e) {
            // Ignore storage errors
        }
        
        return false;
    }

    // ===== INTERACTION ANALYSIS =====
    analyzeInteractions(interactions) {
        const anomalies = [];
        
        if (!interactions || !Array.isArray(interactions)) {
            return anomalies;
        }
        
        // Check for too many interactions in short time
        if (interactions.length > this.thresholds.maxInteractions) {
            anomalies.push({
                type: 'HIGH_INTERACTION_RATE',
                severity: 'MEDIUM',
                count: interactions.length,
                timestamp: Date.now()
            });
        }
        
        // Check for rapid form filling (possible autofill bot)
        const formInteractions = interactions.filter(i => i.type === 'input' || i.type === 'change');
        if (formInteractions.length > 20) {
            const timestamps = formInteractions.map(i => i.timestamp).filter(t => t);
            if (timestamps.length > 1) {
                const first = Math.min(...timestamps);
                const last = Math.max(...timestamps);
                const duration = last - first;
                
                if (duration < this.thresholds.rapidFormFillTime) {
                    anomalies.push({
                        type: 'RAPID_FORM_FILLING',
                        severity: 'HIGH',
                        duration: duration,
                        count: formInteractions.length,
                        timestamp: Date.now()
                    });
                }
            }
        }
        
        // Check for click patterns (bot clicks)
        const clicks = interactions.filter(i => i.type === 'click');
        if (clicks.length > 50) {
            const timestamps = clicks.map(i => i.timestamp).filter(t => t);
            if (timestamps.length > 1) {
                const intervals = [];
                for (let i = 1; i < timestamps.length; i++) {
                    intervals.push(timestamps[i] - timestamps[i-1]);
                }
                const avgInterval = intervals.reduce((a,b) => a+b, 0) / intervals.length;
                const variance = intervals.reduce((acc, val) => acc + Math.pow(val - avgInterval, 2), 0) / intervals.length;
                
                // Very consistent intervals = bot
                if (variance < 50 && avgInterval < 100) {
                    anomalies.push({
                        type: 'BOT_CLICK_PATTERN',
                        severity: 'HIGH',
                        avgInterval: avgInterval,
                        variance: variance,
                        timestamp: Date.now()
                    });
                }
            }
        }
        
        return anomalies;
    }

    // ===== EVIDENCE GATHERING =====
    gatherBotEvidence(session) {
        const evidence = [];
        
        if (!session.mouseMovements || session.mouseMovements.length < this.thresholds.minMouseMovements) {
            evidence.push('insufficient-mouse-movement');
        }
        
        if (!session.keystrokes || session.keystrokes.length === 0) {
            evidence.push('no-keystrokes');
        }
        
        if (!session.scrolls || session.scrolls.length < this.thresholds.minScrolls) {
            evidence.push('no-scrolling');
        }
        
        if (session.interactions && session.interactions.length === 0) {
            evidence.push('no-interactions');
        }
        
        return evidence;
    }

    calculateBotConfidence(session) {
        let confidence = 0;
        
        if (!session.mouseMovements || session.mouseMovements.length < this.thresholds.minMouseMovements) {
            confidence += 25;
        }
        
        if (!session.keystrokes || session.keystrokes.length === 0) {
            confidence += 25;
        }
        
        if (!session.scrolls || session.scrolls.length < this.thresholds.minScrolls) {
            confidence += 15;
        }
        
        if (this.detectAutomation()) {
            confidence += 35;
        }
        
        return Math.min(confidence, 100);
    }

    // ===== SESSION DATA =====
    _getCurrentSession() {
        const user = auth.getUser();
        const fingerprint = localStorage.getItem('psh_device_fp_hash') || null;
        
        return {
            sessionId: this._getSessionId(),
            userId: user?.id || null,
            userRole: user?.role || 'guest',
            fingerprint: fingerprint,
            mouseMovements: window.__psh_mouseMovements || [],
            keystrokes: window.__psh_keystrokes || [],
            scrolls: window.__psh_scrolls || [],
            interactions: window.__psh_interactions || [],
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            screenSize: `${screen.width}x${screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            platform: navigator.platform,
            deviceMemory: navigator.deviceMemory || 'unknown',
            hardwareConcurrency: navigator.hardwareConcurrency || 0,
            connectionType: navigator.connection?.effectiveType || 'unknown'
        };
    }

    _getSessionId() {
        let sessionId = sessionStorage.getItem('psh_anomaly_session');
        if (!sessionId) {
            sessionId = 'anom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            sessionStorage.setItem('psh_anomaly_session', sessionId);
        }
        return sessionId;
    }

    // ===== PERIODIC DETECTION =====
    _performDetection() {
        const now = Date.now();
        if (now - this._lastDetection < this._detectionCooldown) return;
        this._lastDetection = now;
        
        this._checkForAnomalies(this._getCurrentSession());
    }

    async _checkForAnomalies(session) {
        try {
            await this.detectAnomalies(session);
        } catch (error) {
            if (CONFIG.debug) {
                console.warn('[AnomalyDetector] Detection error:', error);
            }
        }
    }

    // ===== REPORTING =====
    async _reportAnomalies(anomalies, session) {
        try {
            const fingerprint = await getDeviceFingerprint();
            const token = auth.getToken();
            
            await fetch(`${CONFIG.apiBase}/security/anomalies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-fingerprint': fingerprint,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({
                    anomalies,
                    session,
                    timestamp: Date.now(),
                    source: 'client_side_detection'
                })
            });
        } catch (e) {
            if (CONFIG.debug) {
                console.warn('[AnomalyDetector] Reporting failed:', e);
            }
        }
    }

    // ===== DESTROY =====
    destroy() {
        if (this._detectionInterval) {
            clearInterval(this._detectionInterval);
            this._detectionInterval = null;
        }
        
        for (const removeFn of this._eventListeners) {
            try { removeFn(); } catch (e) { /* ignore */ }
        }
        this._eventListeners = [];
        
        this.isInitialized = false;
        
        if (CONFIG.debug) {
            console.log('[AnomalyDetector] Destroyed');
        }
    }
}

// ===== SINGLETON =====
let instance = null;

export function getAnomalyDetector(options = {}) {
    if (!instance) {
        instance = new AnomalyDetector(options);
    }
    return instance;
}

// ===== AUTO-INIT =====
if (typeof document !== 'undefined') {
    const init = () => {
        const detector = getAnomalyDetector();
        detector.init();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

// ===== EXPORTS =====
export { AnomalyDetector };
export default AnomalyDetector;
