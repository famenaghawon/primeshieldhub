// ============================================================================
// public../js/sophisticated/fraud-engine/ml-models.js
// ============================================================================
// Advanced Client‑Side Fraud Detection Engine
// Uses lightweight statistical models, heuristic rules, and dynamic scoring
// Integrated with the global event bus, device fingerprint, and behavioral data.
// ============================================================================

import { CONFIG } from '../../config.js';
import { bus, Events } from '../../events.js';
import { auth } from '../../auth.js';
import { getDeviceFingerprint } from './fingerprint.js';

// ===== CONSTANTS & CONFIG =====
const STORAGE_KEY = 'psh_fraud_model_v2';
const DEFAULT_RISK_THRESHOLD = 0.65;
const DECAY_FACTOR = 0.95;
const MAX_HISTORY_ITEMS = 1000;
const MODEL_VERSION = '2.0.0';

const FEATURE_WEIGHTS = {
    mouseJitter: 0.12,
    clickFrequency: 0.10,
    typingSpeed: 0.08,
    scrollPattern: 0.06,
    timeOnPage: 0.05,
    tabSwitches: 0.09,
    copyPasteRate: 0.07,
    fingerprintMismatch: 0.18,
    hardwareConcurrencyAnomaly: 0.10,
    highValueTransaction: 0.10,
    rapidMultipleOrders: 0.12,
    newDeviceLogin: 0.08,
    unusualHour: 0.06,
    geoIpMismatch: 0.15,
    vpnDetected: 0.10,
    sessionDurationShort: 0.05,
    bounceRate: 0.04
};

// ===== LOAD / SAVE MODEL STATE =====
function loadModelState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Version check for future migrations
        if (parsed.version && parsed.version !== MODEL_VERSION) {
            console.warn('[FraudModel] Version mismatch, resetting model');
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function saveModelState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...state,
            version: MODEL_VERSION,
            updatedAt: Date.now()
        }));
    } catch (e) {
        if (CONFIG.debug) {
            console.warn('[FraudModel] Unable to persist state:', e);
        }
    }
}

// ===== FRAUD DETECTION MODEL =====
class FraudDetectionModel {
    constructor(options = {}) {
        this.options = {
            threshold: DEFAULT_RISK_THRESHOLD,
            decayFactor: DECAY_FACTOR,
            maxHistory: MAX_HISTORY_ITEMS,
            debug: CONFIG.debug || false,
            ...options
        };

        const saved = loadModelState();
        this.weights = saved?.weights ?? { ...FEATURE_WEIGHTS };
        this.history = saved?.history ?? [];
        this.threshold = saved?.threshold ?? this.options.threshold;
        this.totalSamples = saved?.totalSamples ?? 0;
        this.positiveSamples = saved?.positiveSamples ?? 0;
        this.lastFingerprint = null;
        this.sessionStart = Date.now();
        this._intervalId = null;
        this._listeners = [];
        this._initialized = false;

        this._init();
    }

    // ===== INIT =====
    _init() {
        if (this._initialized) return;
        this._initialized = true;

        this._setupEventListeners();
        this._monitorFingerprintChanges();

        if (this.options.debug) {
            console.log('[FraudModel] Initialized v' + MODEL_VERSION);
        }

        // Emit ready event
        if (bus?.emit) {
            bus.emit(Events.FRAUD_MODEL_READY, { 
                version: MODEL_VERSION,
                threshold: this.threshold,
                sampleCount: this.totalSamples
            });
        }
    }

    // ===== PUBLIC API =====

    /**
     * Evaluate a transaction or user action and return a risk score (0‑1).
     */
    evaluateTransaction(features, context = {}) {
        const featureVec = this._normalizeFeatures(features, context);
        let score = 0;
        const activeFlags = [];

        for (const [feature, value] of Object.entries(featureVec)) {
            if (this.weights[feature] === undefined) continue;
            const contribution = value * this.weights[feature];
            score += contribution;
            if (contribution > 0.05) {
                activeFlags.push({ feature, contribution: +contribution.toFixed(3) });
            }
        }

        // Apply sigmoid to squeeze into 0‑1
        score = 1 / (1 + Math.exp(-(score - 0.5) * 4));
        score = Math.min(Math.max(score, 0), 1);

        const isSuspicious = score >= this.threshold;
        const explanation = this._generateExplanation(score, activeFlags, features, context);

        // Record history
        this._addToHistory({
            timestamp: Date.now(),
            features: featureVec,
            score,
            flags: activeFlags,
            context: this._sanitizeContext(context)
        });

        if (bus?.emit) {
            bus.emit(Events.FRAUD_SCORE_CALCULATED, {
                score,
                isSuspicious,
                flags: activeFlags,
                timestamp: Date.now()
            });
        }

        return {
            score: +score.toFixed(4),
            flags: activeFlags,
            isSuspicious,
            explanation
        };
    }

    /**
     * Quick analysis of user behavior features
     */
    analyzeBehavior(behaviorData) {
        const features = {
            mouseJitter: behaviorData.mouseJitter || 0,
            clickFrequency: behaviorData.clickFrequency || 0,
            typingSpeed: behaviorData.typingSpeed || 0,
            scrollPattern: behaviorData.scrollPattern || 0,
            timeOnPage: behaviorData.timeOnPage || 0,
            tabSwitches: behaviorData.tabSwitches || 0,
            copyPasteRate: behaviorData.copyPasteRate || 0,
            bounceRate: behaviorData.bounceRate || 0
        };
        return this.evaluateTransaction(features, { type: 'behavior' });
    }

    /**
     * Update model weights based on feedback
     */
    updateModel(feedback) {
        if (!feedback || feedback.timestamp === undefined) return;

        const event = this.history.find(e => e.timestamp === feedback.timestamp);
        if (!event) return;

        const target = feedback.isFraud ? 1 : 0;
        const learningRate = 0.05;

        for (const [feature, value] of Object.entries(event.features)) {
            const currentWeight = this.weights[feature] || 0;
            const error = target - event.score * currentWeight;
            const update = learningRate * error * value;
            this.weights[feature] = currentWeight + update;
            this.weights[feature] = Math.max(0.01, Math.min(this.weights[feature], 0.3));
        }

        // Update threshold dynamically
        if (feedback.isFraud) {
            this.positiveSamples++;
        }
        this.totalSamples++;
        const positiveRate = this.totalSamples > 0 ? this.positiveSamples / this.totalSamples : 0.5;
        this.threshold = 0.5 + (0.5 - positiveRate) * 0.3;
        this.threshold = Math.max(0.4, Math.min(this.threshold, 0.8));

        // Persist updated model
        this._saveState();

        if (bus?.emit) {
            bus.emit(Events.FRAUD_MODEL_UPDATED, {
                weights: { ...this.weights },
                threshold: this.threshold,
                sampleCount: this.totalSamples
            });
        }
    }

    /**
     * Reset model to default state
     */
    resetModel() {
        this.weights = { ...FEATURE_WEIGHTS };
        this.history = [];
        this.threshold = this.options.threshold;
        this.totalSamples = 0;
        this.positiveSamples = 0;
        this._saveState();
        
        if (bus?.emit) {
            bus.emit(Events.FRAUD_MODEL_RESET);
        }
    }

    /**
     * Get current model state
     */
    getModelState() {
        return {
            weights: { ...this.weights },
            threshold: this.threshold,
            historyLength: this.history.length,
            totalSamples: this.totalSamples,
            positiveRate: this.totalSamples ? (this.positiveSamples / this.totalSamples).toFixed(3) : 'N/A',
            version: MODEL_VERSION,
            sessionDuration: Math.floor((Date.now() - this.sessionStart) / 1000)
        };
    }

    /**
     * Predict risk for a given product/transaction
     */
    predictRisk(data) {
        const features = {
            mouseJitter: data.mouseJitter || 0,
            clickFrequency: data.clickFrequency || 0,
            typingSpeed: data.typingSpeed || 0,
            scrollPattern: data.scrollPattern || 0,
            timeOnPage: data.timeOnPage || 0,
            tabSwitches: data.tabSwitches || 0,
            copyPasteRate: data.copyPasteRate || 0,
            highValueTransaction: data.amount && data.amount > 500000 ? 1 : 0,
            unusualHour: (() => {
                const hour = new Date().getHours();
                return (hour < 6 || hour > 22) ? 1 : 0;
            })(),
            fingerprintMismatch: data.fingerprintMismatch || 0,
            vpnDetected: data.vpnDetected || 0
        };

        const result = this.evaluateTransaction(features, data);
        return {
            riskLevel: result.score,
            factors: result.flags.map(f => f.feature),
            isSuspicious: result.isSuspicious,
            explanation: result.explanation
        };
    }

    // ===== INTERNAL METHODS =====

    _normalizeFeatures(features, context) {
        const normalized = {};
        const ref = {
            mouseJitter: { min: 0, max: 0.1 },
            clickFrequency: { min: 0, max: 10 },
            typingSpeed: { min: 0, max: 300 },
            scrollPattern: { min: 0, max: 1 },
            timeOnPage: { min: 0, max: 300 },
            tabSwitches: { min: 0, max: 20 },
            copyPasteRate: { min: 0, max: 5 },
            fingerprintMismatch: { min: 0, max: 1 },
            hardwareConcurrencyAnomaly: { min: 0, max: 1 },
            highValueTransaction: { min: 0, max: 1 },
            rapidMultipleOrders: { min: 0, max: 1 },
            newDeviceLogin: { min: 0, max: 1 },
            unusualHour: { min: 0, max: 1 },
            geoIpMismatch: { min: 0, max: 1 },
            vpnDetected: { min: 0, max: 1 },
            sessionDurationShort: { min: 0, max: 1 },
            bounceRate: { min: 0, max: 1 }
        };

        for (const key in ref) {
            let value = features[key] ?? 0;
            const range = ref[key];
            value = Math.max(range.min, Math.min(range.max, value));
            normalized[key] = (value - range.min) / (range.max - range.min || 1);
        }

        // Inject contextual features
        if (context.amount && context.amount > 500000) {
            normalized.highValueTransaction = 1;
        }
        if (context.orderCount && context.orderCount > 3) {
            normalized.rapidMultipleOrders = 1;
        }
        if (context.isNewDevice) {
            normalized.newDeviceLogin = 1;
        }
        const hour = new Date().getHours();
        if (hour < 6 || hour > 22) {
            normalized.unusualHour = 1;
        }

        return normalized;
    }

    _generateExplanation(score, flags, features, context) {
        if (score < 0.3) return 'Normal activity pattern.';
        if (score < this.threshold) return 'Slightly elevated risk, but within acceptable range.';

        const highFlags = flags.filter(f => f.contribution > 0.03);
        if (highFlags.length === 0) return 'Multiple low‑risk signals combined.';

        const explanations = highFlags.map(f => {
            const map = {
                'fingerprintMismatch': 'Device fingerprint inconsistency detected',
                'highValueTransaction': 'Unusually high transaction amount',
                'rapidMultipleOrders': 'Multiple orders in quick succession',
                'newDeviceLogin': 'Login from previously unseen device',
                'unusualHour': 'Activity at unusual time of day',
                'geoIpMismatch': 'Geolocation mismatch with previous patterns',
                'vpnDetected': 'Possible VPN/proxy usage',
                'mouseJitter': 'Erratic mouse movement pattern',
                'clickFrequency': 'Abnormal click rate'
            };
            return map[f.feature] || `Elevated ${f.feature}`;
        });

        return explanations.join('; ') + '.';
    }

    _addToHistory(event) {
        this.history.push(event);
        if (this.history.length > this.options.maxHistory) {
            this.history = this.history.slice(-this.options.maxHistory);
        }
    }

    _sanitizeContext(ctx) {
        const { type, amount, orderCount, isNewDevice, sessionDuration } = ctx;
        return { type, amount, orderCount, isNewDevice, sessionDuration };
    }

    _saveState() {
        saveModelState({
            weights: this.weights,
            threshold: this.threshold,
            totalSamples: this.totalSamples,
            positiveSamples: this.positiveSamples,
            history: this.history.slice(-100)
        });
    }

    // ===== FINGERPRINT MONITORING =====
    _monitorFingerprintChanges() {
        getDeviceFingerprint().then(fp => {
            this.lastFingerprint = fp;
        }).catch(() => {});

        this._intervalId = setInterval(async () => {
            try {
                const currentFp = await getDeviceFingerprint();
                if (this.lastFingerprint && currentFp !== this.lastFingerprint) {
                    if (bus?.emit) {
                        bus.emit(Events.FRAUD_FINGERPRINT_CHANGED, {
                            old: this.lastFingerprint.substring(0, 16),
                            new: currentFp.substring(0, 16)
                        });
                    }
                    this.evaluateTransaction({ fingerprintMismatch: 1 }, { type: 'fingerprint_change' });
                }
                this.lastFingerprint = currentFp;
            } catch (e) {
                // Ignore
            }
        }, 30000);
    }

    // ===== EVENT LISTENERS =====
    _setupEventListeners() {
        if (!bus?.on) return;

        const feedbackHandler = (feedback) => {
            this.updateModel(feedback);
        };
        bus.on(Events.FRAUD_FEEDBACK, feedbackHandler);
        this._listeners.push(() => bus.off(Events.FRAUD_FEEDBACK, feedbackHandler));

        const behaviorHandler = (behaviorData) => {
            this.analyzeBehavior(behaviorData);
        };
        bus.on(Events.FRAUD_BEHAVIOR_REPORT, behaviorHandler);
        this._listeners.push(() => bus.off(Events.FRAUD_BEHAVIOR_REPORT, behaviorHandler));

        const evaluateHandler = (payload) => {
            const result = this.evaluateTransaction(payload.features, payload.context);
            if (bus?.emit) {
                bus.emit(Events.FRAUD_EVALUATION_RESULT, result);
            }
        };
        bus.on(Events.FRAUD_EVALUATE, evaluateHandler);
        this._listeners.push(() => bus.off(Events.FRAUD_EVALUATE, evaluateHandler));
    }

    // ===== DESTROY =====
    destroy() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }

        for (const removeFn of this._listeners) {
            try { removeFn(); } catch (e) { /* ignore */ }
        }
        this._listeners = [];

        this._initialized = false;
        
        if (this.options.debug) {
            console.log('[FraudModel] Destroyed');
        }
    }
}

// ===== SINGLETON INSTANCE =====
let instance = null;

export function getFraudDetector(options = {}) {
    if (!instance) {
        instance = new FraudDetectionModel(options);
    }
    return instance;
}

// ===== EXPORTS =====
export const fraudDetector = getFraudDetector();
export { FraudDetectionModel, FEATURE_WEIGHTS, DEFAULT_RISK_THRESHOLD };
export default fraudDetector;
