// ======================================================================
// push-notifications.js - PrimeShieldHub Push Notification Client
// WITH ENGAGEMENT-BASED AUTO-SUBSCRIBE (The "Peller/Jarvis" Method)
// ======================================================================

const PUSH_CONFIG = {
  swPath: '/sw.js',
  apiBase: '/api/push',
  vapidPublicKey: null, // Will be fetched from server
  engagementThreshold: 70, // Auto-subscribe when engagement > 70%
  checkInterval: 120000, // Check every 2 minutes
  retryAfterDays: 7 // Retry auto-subscribe after 7 days
};

// ======================================================================
// ENGAGEMENT TRACKING CLASS
// ======================================================================

class EngagementTracker {
  constructor() {
    this.score = 0;
    this.visits = parseInt(localStorage.getItem('psh_visits') || '0');
    this.lastVisit = parseInt(localStorage.getItem('psh_last_visit') || Date.now());
    this.clicks = parseInt(localStorage.getItem('psh_clicks') || '0');
    this.scrollDepth = parseFloat(localStorage.getItem('psh_scroll') || '0');
    this.timeOnSite = 0;
    this.startTime = Date.now();
    this.isTracking = false;
  }

  start() {
    if (this.isTracking) return;
    this.isTracking = true;
    this.startTime = Date.now();

    // Track scroll depth
    window.addEventListener('scroll', this.trackScroll.bind(this), { passive: true });

    // Track clicks
    document.addEventListener('click', this.trackClick.bind(this), { passive: true });

    // Track time on site
    setInterval(() => {
      this.timeOnSite = (Date.now() - this.startTime) / 1000 / 60; // minutes
    }, 10000);

    // Calculate engagement score periodically
    setInterval(() => {
      this.calculateScore();
    }, 30000);

    // Save on page unload
    window.addEventListener('beforeunload', () => {
      this.calculateScore();
      localStorage.setItem('psh_engagement', this.score);
    });

    console.log('[Engagement] Tracker started');
  }

  trackScroll() {
    const scrollPercent = Math.round(
      (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
    );
    if (scrollPercent > this.scrollDepth) {
      this.scrollDepth = Math.min(scrollPercent, 100);
      localStorage.setItem('psh_scroll', this.scrollDepth);
    }
  }

  trackClick() {
    this.clicks++;
    localStorage.setItem('psh_clicks', this.clicks);
  }

  calculateScore() {
    // Chrome's engagement algorithm (simplified)
    let score = 0;

    // Visit frequency (max 40)
    const visitScore = Math.min(this.visits * 10, 40);
    score += visitScore;

    // Time on site (max 30)
    const timeScore = Math.min(this.timeOnSite * 2, 30);
    score += timeScore;

    // Scroll depth (max 15)
    const scrollScore = Math.min(this.scrollDepth * 0.15, 15);
    score += scrollScore;

    // Click count (max 15)
    const clickScore = Math.min(this.clicks * 0.5, 15);
    score += clickScore;

    this.score = Math.min(Math.round(score), 100);
    localStorage.setItem('psh_engagement', this.score);

    return this.score;
  }

  getScore() {
    return this.calculateScore();
  }

  getMetrics() {
    return {
      score: this.score,
      visits: this.visits,
      timeOnSite: Math.round(this.timeOnSite * 10) / 10,
      scrollDepth: this.scrollDepth,
      clicks: this.clicks
    };
  }

  incrementVisits() {
    this.visits++;
    localStorage.setItem('psh_visits', this.visits);
    localStorage.setItem('psh_last_visit', Date.now());
  }

  // Send engagement data to server
  async syncToServer() {
    try {
      const metrics = this.getMetrics();
      const response = await fetch('/api/push/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementScore: metrics.score,
          visits: metrics.visits,
          timeOnSite: metrics.timeOnSite,
          scrollDepth: metrics.scrollDepth,
          clickCount: metrics.clicks
        })
      });
      return response.ok;
    } catch (error) {
      console.warn('[Engagement] Sync failed:', error);
      return false;
    }
  }
}

// ======================================================================
// MAIN PUSH NOTIFICATION CLASS WITH AUTO-SUBSCRIBE
// ======================================================================

class PrimeShieldPush {
  constructor() {
    this.engagement = new EngagementTracker();
    this.isSubscribed = false;
    this.isSupported = false;
    this.vapidPublicKey = null;
    this.apiBase = '/api/push';
    this.autoSubscribed = localStorage.getItem('psh_auto_subscribed') === 'true';
    this.subscriptionRetryCount = parseInt(localStorage.getItem('psh_retry_count') || '0');
    this.lastRetryDate = parseInt(localStorage.getItem('psh_last_retry') || '0');
  }

  // ======================================================================
  // INITIALIZE
  // ======================================================================

  async init() {
    console.log('[Push] Initializing...');

    // Check support
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    if (!this.isSupported) {
      console.warn('[Push] Not supported in this browser');
      return { supported: false };
    }

    // Start engagement tracking
    this.engagement.start();

    // Get VAPID public key from server
    try {
      const configRes = await fetch('/api/config/public');
      const config = await configRes.json();
      this.vapidPublicKey = config.vapidPublicKey;
      
      if (!this.vapidPublicKey) {
        console.warn('[Push] VAPID public key not configured');
        return { supported: true, subscribed: false, reason: 'vapid_key_missing' };
      }
    } catch (error) {
      console.warn('[Push] Failed to fetch config:', error);
      return { supported: true, subscribed: false, reason: 'config_fetch_failed' };
    }

    // Register service worker
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[Push] Service Worker registered');
    } catch (error) {
      console.warn('[Push] Service Worker registration failed:', error);
      return { supported: true, subscribed: false, reason: 'sw_registration_failed' };
    }

    // Check current subscription status
    const status = await this.getStatus();
    this.isSubscribed = status.subscribed;

    if (this.isSubscribed) {
      console.log('[Push] Already subscribed');
      return { supported: true, subscribed: true };
    }

    // Increment visit count
    this.engagement.incrementVisits();

    // Check if we should auto-subscribe
    const shouldAutoSubscribe = await this.shouldAutoSubscribe();
    if (shouldAutoSubscribe) {
      const result = await this.autoSubscribe();
      if (result.subscribed) {
        console.log('[Push] Auto-subscribed successfully! 🎉');
        return { supported: true, subscribed: true, autoSubscribed: true };
      }
    }

    // Set up periodic checks
    setInterval(async () => {
      const shouldAutoSubscribe = await this.shouldAutoSubscribe();
      if (shouldAutoSubscribe && !this.isSubscribed) {
        const result = await this.autoSubscribe();
        if (result.subscribed) {
          console.log('[Push] Auto-subscribed (periodic check) 🎉');
          this.isSubscribed = true;
        }
      }
    }, PUSH_CONFIG.checkInterval);

    // Update UI based on status
    this.updateUI();

    console.log('[Push] Initialized - Status:', {
      supported: this.isSupported,
      subscribed: this.isSubscribed,
      engagementScore: this.engagement.getScore(),
      visits: this.engagement.visits
    });

    return { 
      supported: this.isSupported, 
      subscribed: this.isSubscribed,
      engagementScore: this.engagement.getScore()
    };
  }

  // ======================================================================
  // AUTO-SUBSCRIBE (The "Peller/Jarvis" Secret)
  // ======================================================================

  async shouldAutoSubscribe() {
    // Don't auto-subscribe if already subscribed
    if (this.isSubscribed) return false;

    // Don't auto-subscribe if permission is denied
    if (Notification.permission === 'denied') return false;

    // Don't auto-subscribe if we've retried too many times
    if (this.subscriptionRetryCount >= 3) return false;

    // Check if enough time has passed since last retry
    const retryCooldown = PUSH_CONFIG.retryAfterDays * 24 * 60 * 60 * 1000;
    if (Date.now() - this.lastRetryDate < retryCooldown && this.lastRetryDate > 0) {
      return false;
    }

    // Check engagement score
    const score = this.engagement.getScore();
    const shouldSubscribe = score >= PUSH_CONFIG.engagementThreshold;

    console.log(`[Push] Auto-subscribe check: Score=${score}, Threshold=${PUSH_CONFIG.engagementThreshold}, Should=${shouldSubscribe}`);

    return shouldSubscribe;
  }

  async autoSubscribe() {
    try {
      console.log('[Push] Attempting auto-subscribe...');

      // Update retry tracking
      this.subscriptionRetryCount++;
      localStorage.setItem('psh_retry_count', this.subscriptionRetryCount);
      localStorage.setItem('psh_last_retry', Date.now());

      // Request permission (Chrome handles this based on engagement)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[Push] Permission denied for auto-subscribe');
        return { subscribed: false, reason: 'permission_denied' };
      }

      // Get registration
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        this.isSubscribed = true;
        localStorage.setItem('psh_subscribed', 'true');
        return { subscribed: true, alreadySubscribed: true };
      }

      // Subscribe
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      // Save subscription to server
      const saved = await this.saveSubscription(newSubscription, true);

      if (saved) {
        this.isSubscribed = true;
        localStorage.setItem('psh_subscribed', 'true');
        localStorage.setItem('psh_auto_subscribed', 'true');
        
        // Show welcome notification
        this.showInPageNotification(
          'Welcome to PrimeShieldHub! 🎉',
          'You\'ll receive updates about new products and offers.'
        );

        // Sync engagement data
        await this.engagement.syncToServer();

        console.log('[Push] Auto-subscribe successful! 🎉');
        return { subscribed: true, autoSubscribed: true };
      }

      return { subscribed: false, reason: 'save_failed' };

    } catch (error) {
      console.error('[Push] Auto-subscribe error:', error);
      return { subscribed: false, reason: error.message };
    }
  }

  // ======================================================================
  // MANUAL SUBSCRIBE (User clicks "Enable Notifications")
  // ======================================================================

  async manualSubscribe() {
    try {
      console.log('[Push] Manual subscribe...');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.showToast('❌ Please allow notifications in your browser settings.', 'error');
        return { subscribed: false, reason: 'permission_denied' };
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      
      if (existingSubscription) {
        this.isSubscribed = true;
        localStorage.setItem('psh_subscribed', 'true');
        this.updateUI();
        this.showToast('🔔 Notifications already enabled!', 'success');
        return { subscribed: true };
      }

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      const saved = await this.saveSubscription(newSubscription, false);

      if (saved) {
        this.isSubscribed = true;
        localStorage.setItem('psh_subscribed', 'true');
        localStorage.setItem('psh_auto_subscribed', 'false');
        this.updateUI();
        this.showToast('🔔 Notifications enabled!', 'success');
        return { subscribed: true };
      }

      return { subscribed: false, reason: 'save_failed' };

    } catch (error) {
      console.error('[Push] Manual subscribe error:', error);
      this.showToast('❌ Failed to enable notifications: ' + error.message, 'error');
      return { subscribed: false, reason: error.message };
    }
  }

  // ======================================================================
  // UNSUBSCRIBE
  // ======================================================================

  async unsubscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        this.isSubscribed = false;
        localStorage.removeItem('psh_subscribed');
        this.updateUI();
        return { success: true, message: 'Already unsubscribed' };
      }

      const unsubscribed = await subscription.unsubscribe();
      if (!unsubscribed) {
        return { success: false, message: 'Failed to unsubscribe' };
      }

      await this.deleteSubscription(subscription.endpoint);
      
      this.isSubscribed = false;
      localStorage.removeItem('psh_subscribed');
      this.updateUI();
      this.showToast('🔕 Notifications disabled', 'info');

      return { success: true, message: 'Unsubscribed successfully' };

    } catch (error) {
      console.error('[Push] Unsubscribe error:', error);
      return { success: false, message: error.message };
    }
  }

  // ======================================================================
  // API HELPERS
  // ======================================================================

  async saveSubscription(subscription, autoSubscribed) {
    try {
      const userId = localStorage.getItem('psh_user_id') || null;
      const token = localStorage.getItem('psh_auth_token');

      const response = await fetch(`${this.apiBase}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
            auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
          },
          userId: userId,
          autoSubscribed: autoSubscribed || false,
          userAgent: navigator.userAgent,
          platform: navigator.platform || 'unknown'
        })
      });

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('[Push] Save subscription error:', error);
      return false;
    }
  }

  async deleteSubscription(endpoint) {
    try {
      await fetch(`${this.apiBase}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
      });
      return true;
    } catch (error) {
      console.error('[Push] Delete subscription error:', error);
      return false;
    }
  }

  async getStatus() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return {
        supported: this.isSupported,
        subscribed: !!subscription,
        endpoint: subscription ? subscription.endpoint : null,
        permission: Notification.permission,
        engagementScore: this.engagement.getScore()
      };
    } catch (error) {
      return { supported: false, error: error.message };
    }
  }

  // ======================================================================
  // UI HELPERS
  // ======================================================================

  updateUI() {
    const btn = document.getElementById('enablePushBtn');
    if (!btn) return;

    const btnText = btn.querySelector('.btn-text');
    if (this.isSubscribed) {
      btn.classList.add('active');
      btnText.textContent = 'Notifications On';
    } else {
      btn.classList.remove('active');
      btnText.textContent = 'Enable Notifications';
    }
  }

  showToast(message, type = 'info') {
    const colors = {
      success: '#00e5ff',
      error: '#ff4444',
      info: '#ffd700',
      warning: '#ff9800'
    };

    const existingToasts = document.querySelectorAll('.psh-toast');
    existingToasts.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'psh-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: #12122a;
      color: #fff;
      padding: 14px 28px;
      border-radius: 12px;
      border-left: 4px solid ${colors[type] || '#ffd700'};
      box-shadow: 0 8px 30px rgba(0,0,0,0.5);
      z-index: 99999;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      max-width: 90%;
      animation: slideUp 0.3s ease;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.05);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  showInPageNotification(title, message) {
    let container = document.getElementById('psh-notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'psh-notification-container';
      container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        max-width: 380px;
        width: 100%;
      `;
      document.body.appendChild(container);
    }

    const notification = document.createElement('div');
    notification.style.cssText = `
      background: linear-gradient(135deg, #1a2045, #0b0e1a);
      border: 1px solid #2a3170;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5);
      cursor: pointer;
      animation: slideUp 0.3s ease;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: all 0.3s ease;
    `;
    notification.innerHTML = `
      <div style="flex-shrink:0;font-size:28px;">🔔</div>
      <div style="flex:1;">
        <div style="color:#00e5ff;font-weight:600;font-size:14px;">${title}</div>
        <div style="color:#9aa3d4;font-size:13px;">${message}</div>
      </div>
      <button onclick="this.parentElement.remove()" 
        style="background:none;border:none;color:#6a73a8;font-size:18px;cursor:pointer;">✕</button>
    `;
    container.appendChild(notification);

    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(20px)';
        setTimeout(() => notification.remove(), 300);
      }
    }, 8000);
  }

  // ======================================================================
  // HELPER: Convert base64 to Uint8Array
  // ======================================================================

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// ======================================================================
// EXPORT AND INITIALIZE
// ======================================================================

let pushInstance = null;

async function initializePush() {
  if (pushInstance) return pushInstance;
  
  pushInstance = new PrimeShieldPush();
  await pushInstance.init();
  
  // Make available globally
  window.pushSystem = pushInstance;
  
  return pushInstance;
}

// ======================================================================
// BUTTON EVENT HANDLING
// ======================================================================

document.addEventListener('DOMContentLoaded', async () => {
  const btn = document.getElementById('enablePushBtn');
  if (!btn) return;

  // Check if push is supported
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    btn.style.display = 'none';
    return;
  }

  // Initialize push system
  const push = await initializePush();

  // Show button
  btn.style.display = 'flex';

  // Update button state
  const status = await push.getStatus();
  if (status.subscribed) {
    btn.classList.add('active');
    btn.querySelector('.btn-text').textContent = 'Notifications On';
  }

  // Click handler
  btn.addEventListener('click', async () => {
    const currentStatus = await push.getStatus();
    
    if (currentStatus.subscribed) {
      await push.unsubscribe();
    } else {
      await push.manualSubscribe();
    }
  });

  // Auto-prompt after 5 seconds if not subscribed and not prompted
  const hasPrompted = localStorage.getItem('psh_push_prompted');
  if (!hasPrompted && !status.subscribed && Notification.permission === 'default') {
    setTimeout(async () => {
      const result = await push.manualSubscribe();
      if (result.subscribed) {
        localStorage.setItem('psh_push_prompted', 'true');
      }
    }, 5000);
  }

  if (Notification.permission === 'denied') {
    localStorage.setItem('psh_push_prompted', 'true');
    btn.style.display = 'none';
  }
});

// ======================================================================
// EXPORT FUNCTIONS
// ======================================================================

export {
  PrimeShieldPush,
  EngagementTracker,
  initializePush,
  pushInstance as default
};
