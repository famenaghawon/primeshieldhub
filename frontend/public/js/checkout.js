// ../js/checkout.js
// Enterprise‑grade checkout with fingerprint + behavioral biometrics

import { auth, getUser, onAuthStateChanged } from "./auth.js";
import { cartStore } from "./cart-store.js";
import { api } from "./api-client.js";
import { formatCurrency, debounce, generateSecureId, escapeHtml } from "./utils.js";
import { bus } from "./events.js";
import { CONFIG, goTo, goToProduct, goToTrackOrder } from './config.js';
import { UIEnhancer } from '../js/sophisticated/ui-enhancer.js';
import { MicroInteractions } from '../js/sophisticated/micro-interactions.js';

// ==================== BEHAVIORAL COLLECTOR ====================
class BehaviorCollector {
  constructor() {
    this.startTime = performance.now();
    this.keystrokes = [];
    this.mouseMoves = [];
    this.clicks = 0;
    this.recording = true;

    // Bind event handlers
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onClick = this.onClick.bind(this);

    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('click', this.onClick);
  }

  onKeyDown(e) {
    if (!this.recording) return;
    this.keystrokes.push({
      t: performance.now(),
      k: e.key.length === 1 ? e.key : 'Special'
    });
    // Limit to last 50 keystrokes
    if (this.keystrokes.length > 50) this.keystrokes.shift();
  }

  onMouseMove(e) {
    if (!this.recording) return;
    this.mouseMoves.push({
      x: e.clientX,
      y: e.clientY,
      t: performance.now()
    });
    // Limit to last 100 moves
    if (this.mouseMoves.length > 100) this.mouseMoves.shift();
  }

  onClick() {
    if (!this.recording) return;
    this.clicks++;
  }

  finalize() {
    this.recording = false;
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('click', this.onClick);

    return {
      duration: performance.now() - this.startTime,
      keystrokes: this.keystrokes,
      mouseMoves: this.mouseMoves,
      clicks: this.clicks
    };
  }
}

// ==================== FINGERPRINT MANAGER ====================
class FingerprintManager {
  constructor() {
    this.fingerprint = null;
    this.signature = null;
    this.key = null;
    this.expiresAt = 0;
    this.isRefreshing = false;
  }

  async ensureValid() {
    if (this.key && this.expiresAt > Date.now()) {
      return true;
    }
    if (this.isRefreshing) {
      await new Promise(resolve => {
        const check = setInterval(() => {
          if (!this.isRefreshing) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });
      return this.key !== null;
    }
    this.isRefreshing = true;
    try {
      await this.refresh();
      return true;
    } catch (err) {
      console.error('Fingerprint refresh failed', err);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  async refresh() {
    // 1. Get token from server
    const tokenRes = await fetch('/api/fingerprintToken', { credentials: 'include' });
    if (!tokenRes.ok) throw new Error('Failed to get fingerprint token');
    const { key, salt, expiry } = await tokenRes.json();

    // 2. Generate fingerprint using the provided salt
    const fp = await window.getFingerprint(salt);
    const signature = await window.signFingerprint(fp, key);

    this.fingerprint = fp;
    this.signature = signature;
    this.key = key;
    this.expiresAt = Date.now() + expiry * 1000 - 5000; // small buffer
  }

  getHeaders() {
    if (!this.fingerprint || !this.signature || !this.key) return {};
    return {
      'x-device-fingerprint': this.fingerprint,
      'x-device-signature': this.signature,
      'x-device-key': this.key
    };
  }
}

// ==================== CHECKOUT CORE ====================
class QuantumCheckout {
  constructor() {
    this.uiEnhancer = null;
    this.microInteractions = null;
    this.fingerprintManager = new FingerprintManager();
    this.currentChallenge = null;
    this.currentReference = null;
    this.paymentRetryCount = 0;
    this.behavior = null; // will hold the BehaviorCollector instance
    this.state = {
      currentStep: 1,
      totalSteps: 3,
      order: {
        items: this.loadCartFromStorage(),
        subtotal: 0,
        discount: 0.1,
        shipping: 15000,
        tax: 0.075,
        total: 0
      },
      delivery: {
        fullName: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        instructions: '',
        shipping: null
      },
      payment: {
        method: null
      },
      security: {
        sessionId: generateSecureId('QS')
      }
    };
  }

  loadCartFromStorage() {
    try {
      const stored = localStorage.getItem('psh_cart');
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return [];
  }

  calculateOrder() {
    const o = this.state.order;
    o.subtotal = o.items.reduce((t, i) => t + (i.price * i.quantity), 0);
    const discountAmt = o.subtotal * o.discount;
    const taxable = o.subtotal - discountAmt + o.shipping;
    const taxAmt = taxable * o.tax;
    o.total = o.subtotal - discountAmt + o.shipping + taxAmt;
  }

  async init() {
    // UI enhancements
    this.uiEnhancer = new UIEnhancer();
    this.microInteractions = new MicroInteractions();
    document.addEventListener('DOMContentLoaded', () => {
      this.uiEnhancer.init();
      this.microInteractions.init();
    });

    // Start behavior collection immediately
    this.behavior = new BehaviorCollector();

    // Ensure fingerprint is ready
    await this.fingerprintManager.ensureValid();

    // If cart empty, redirect
    if (!this.state.order.items.length) {
      this.showNotification('error', 'Cart Empty', 'Your cart is empty. Add items before checkout.');
      setTimeout(() => goTo('/'), 1500);
      return;
    }

    this.calculateOrder();
    this.renderStep(1);
    this.attachEventListeners();
    this.startBinaryRain();

    console.log('✅ Quantum Checkout initialized with fingerprint + behavioral biometrics');
  }

  renderStep(step) {
    const stepEls = document.querySelectorAll('.checkout-step');
    stepEls.forEach((el, idx) => {
      el.style.display = (idx + 1 === step) ? 'block' : 'none';
    });
    document.querySelectorAll('.step-indicator').forEach((ind, idx) => {
      if (idx + 1 === step) ind.classList.add('active');
      else ind.classList.remove('active');
    });
    this.state.currentStep = step;
  }

  attachEventListeners() {
    // Step 1: Delivery form
    document.getElementById('nextStep1')?.addEventListener('click', async () => {
      const fullName = document.getElementById('fullName').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const address = document.getElementById('address').value.trim();
      const city = document.getElementById('city').value.trim();
      const state = document.getElementById('state').value;
      const instructions = document.getElementById('instructions').value.trim();
      if (!fullName || !phone || !address || !city || !state) {
        this.showNotification('error', 'Missing Fields', 'Please fill all required fields');
        return;
      }
      this.state.delivery = { fullName, phone, address, city, state, instructions };
      this.renderStep(2);
    });

    // Step 2: Payment method selection
    document.querySelectorAll('.payment-method').forEach(method => {
      method.addEventListener('click', () => {
        document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
        method.classList.add('selected');
        this.state.payment.method = method.dataset.method;
        document.getElementById('nextStep2').disabled = false;
      });
    });
    document.getElementById('nextStep2')?.addEventListener('click', () => {
      if (!this.state.payment.method) {
        this.showNotification('error', 'Select Method', 'Please choose a payment method');
        return;
      }
      this.renderStep(3);
    });

    // Step 3: Pay button
    document.getElementById('payButton')?.addEventListener('click', async () => {
      if (this.state.payment.method === 'card') {
        await this.initiatePayment();
      } else {
        this.showNotification('info', 'Coming Soon', 'Only card payments are currently supported');
      }
    });
  }

  async initiatePayment() {
    const payButton = document.getElementById('payButton');
    payButton.disabled = true;
    payButton.innerHTML = 'Processing...';

    try {
      // Finalize behavior collection and encode as base64
      const behaviorData = this.behavior.finalize();
      const behaviorEncoded = btoa(JSON.stringify(behaviorData));

      // Ensure fingerprint is fresh
      await this.fingerprintManager.ensureValid();

      const payload = {
        amount: this.state.order.total,
        email: auth.currentUser?.email || '',
        reference: `PSH_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        productId: null, // or actual product ID if single product
        metadata: {
          cart: this.state.order.items,
          delivery: this.state.delivery,
          sessionId: this.state.security.sessionId
        }
      };

      const headers = {
        'Content-Type': 'application/json',
        ...this.fingerprintManager.getHeaders(),
        'x-behavior': behaviorEncoded
      };

      const response = await fetch('/api/initiatePaystack', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.challenge) {
          this.currentChallenge = data.challenge;
          this.currentReference = payload.reference;
          this.showChallengeModal();
          return;
        }
        throw new Error(data.error || 'Payment initiation failed');
      }

      if (data.success && data.data.authorization_url) {
        window.location.href = data.data.authorization_url;
      } else {
        throw new Error('Invalid Paystack response');
      }
    } catch (err) {
      console.error('Payment initiation error', err);
      this.showNotification('error', 'Payment Error', err.message);
      payButton.disabled = false;
      payButton.innerHTML = 'Pay Now';
    }
  }

  async showChallengeModal() {
    const modal = document.getElementById('challengeModal');
    if (!modal) {
      console.error('Challenge modal not found');
      return;
    }

    const challengeType = this.currentChallenge.type || 'captcha';
    const modalContent = document.getElementById('challengeContent');
    modalContent.innerHTML = '';

    if (challengeType === 'captcha') {
      const recaptchaDiv = document.createElement('div');
      recaptchaDiv.className = 'g-recaptcha';
      recaptchaDiv.setAttribute('data-sitekey', CONFIG.RECAPTCHA_SITE_KEY);
      modalContent.appendChild(recaptchaDiv);
      if (typeof grecaptcha === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://www.google.com/recaptcha/api.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
        await new Promise(resolve => { script.onload = resolve; });
      }
      grecaptcha.ready(() => grecaptcha.render(recaptchaDiv));
    } else if (challengeType === 'otp') {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Enter OTP';
      input.className = 'form-control';
      modalContent.appendChild(input);
    }

    modal.style.display = 'block';

    const submitBtn = document.getElementById('submitChallenge');
    const cancelBtn = document.getElementById('cancelChallenge');

    const submitHandler = async () => {
      let solution = '';
      if (challengeType === 'captcha') {
        solution = grecaptcha.getResponse();
        if (!solution) {
          this.showNotification('error', 'Captcha', 'Please complete the captcha');
          return;
        }
      } else {
        solution = modalContent.querySelector('input').value.trim();
        if (!solution) {
          this.showNotification('error', 'OTP', 'Please enter the OTP');
          return;
        }
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Verifying...';

      try {
        const verifyRes = await fetch('/api/verifyChallenge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.fingerprintManager.getHeaders()
          },
          body: JSON.stringify({
            type: challengeType,
            solution,
            reference: this.currentReference
          })
        });

        const verifyData = await verifyRes.json();

        if (verifyRes.ok && verifyData.success) {
          modal.style.display = 'none';
          await this.initiatePayment();
        } else {
          this.showNotification('error', 'Verification Failed', verifyData.error || 'Invalid solution');
          if (challengeType === 'captcha') grecaptcha.reset();
        }
      } catch (err) {
        console.error('Challenge verification error', err);
        this.showNotification('error', 'Verification Error', 'Please try again');
        if (challengeType === 'captcha') grecaptcha.reset();
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Verify';
      }
    };

    submitBtn.onclick = submitHandler;
    cancelBtn.onclick = () => {
      modal.style.display = 'none';
      document.getElementById('payButton').disabled = false;
      document.getElementById('payButton').innerHTML = 'Pay Now';
    };
  }

  showNotification(type, title, message, duration = 5000) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `<strong>${escapeHtml(title)}</strong><br>${escapeHtml(message)}`;
    container.appendChild(notification);
    setTimeout(() => notification.remove(), duration);
  }

  startBinaryRain() {
    const container = document.getElementById('binaryRain');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 50; i++) {
      const span = document.createElement('span');
      span.textContent = Math.random() > 0.5 ? '0' : '1';
      span.style.position = 'absolute';
      span.style.left = `${Math.random() * 100}%`;
      span.style.top = `${Math.random() * 100}%`;
      span.style.opacity = Math.random() * 0.5;
      span.style.fontSize = '10px';
      span.style.color = '#0f0';
      container.appendChild(span);
    }
  }

  triggerSuccessCelebration() {
    window.dispatchEvent(new CustomEvent('transaction-complete'));
  }
}

// Instantiate and start
const checkout = new QuantumCheckout();
checkout.init();

window.QuantumCheckout = checkout;


