// ============================================================================
// public../js/events.js – Quantum Event Bus v11.4.4 (FULLY FIXED)
// Production-Grade Publish/Subscribe System
// Worker-Integrated • AI-Aware • Performance-Optimized
// FIXED: Infinite recursion on wildcard/namespace emissions
// FIXED: Safe initialization even when crypto.randomUUID is unavailable
// FIXED: Memory leak prevention on once listeners
// FIXED: Circular dependency handling in wildcard emissions
// FIXED: Safe cloning with circular reference handling
// FIXED: Once listeners cleaned up even on error
// FIXED: Async listeners cleanup on unsubscribe
// FIXED: Error event recursion protection
// FIXED: Proper wildcard namespace depth limiting
// FIXED: Memory leak in onAsync unsubscribe
// ============================================================================

/**
 * Quantum Event Bus
 * 
 * A high-performance, feature-rich event system for decoupled component
 * communication. Supports priority queues, async listeners, event debouncing,
 * replay of past events, namespace isolation, and built-in telemetry.
 * 
 * @example
 *   import { bus, Events } from '../js/events.js';
 *   
 *   // Subscribe with priority
 *   bus.on(Events.CART_UPDATED, (data) => {
 *     updateCartUI(data);
 *   }, { priority: 10 });
 *   
 *   // Subscribe once
 *   bus.once(Events.PAGE_LOADED, (data) => {
 *     analytics.track('page_view', data);
 *   });
 *   
 *   // Emit event
 *   bus.emit(Events.CART_ITEM_ADDED, { productId: 'abc', qty: 2 });
 *   
 *   // Async listener
 *   bus.onAsync(Events.AUTH_LOGIN, async (user) => {
 *     await fetchUserPreferences(user.id);
 *   });
 *   
 *   // Debounced listener
 *   bus.onDebounced(Events.SEARCH_QUERY, (query) => {
 *     performSearch(query);
 *   }, 300);
 *   
 *   // Namespaced events
 *   const cartBus = bus.namespace('cart');
 *   cartBus.emit('updated'); // Emits 'cart:updated'
 */
class QuantumEventBus {
  constructor() {
    // Main listener storage: Map<eventName, Map<priority, Set<callback>>>
    this._listeners = new Map();
    
    // One-time listeners
    this._onceListeners = new Map();
    
    // Async listeners (Promise-based)
    this._asyncListeners = new Map();
    
    // Store mapping of wrapper callbacks to original async callbacks
    this._asyncWrapperMap = new WeakMap();
    
    // Event history for replay (stores last N events per type)
    this._history = new Map();
    this._maxHistoryPerEvent = 25;
    
    // Debounce timers: Map<eventName, Map<callback, timerId>>
    this._debounceTimers = new Map();
    
    // Throttle state: Map<eventName, Map<callback, lastExecutionTime>>
    this._throttleState = new Map();
    
    // FIXED: Recursion guard - prevents infinite loops from wildcard emissions
    // Uses a Set to track currently emitting events AND a depth counter
    this._emitting = new Set();
    this._emitDepth = 0;
    this._maxEmitDepth = 50; // Failsafe to prevent stack overflow
    
    // FIXED: Circular dependency guard - tracks which events have been emitted
    // during the current emission chain to detect circular references
    this._emissionChain = [];
    
    // FIXED: Error event recursion guard
    this._errorEmissionDepth = 0;
    this._maxErrorDepth = 3;
    
    // Performance metrics
    this._metrics = {
      totalEmits: 0,
      totalListeners: 0,
      totalErrors: 0,
      eventsFired: new Map(),
      slowestEvent: { name: null, duration: 0 },
      recursionDetected: 0,
      circularDetected: 0,
      errorRecursionPrevented: 0
    };
    
    // Configuration
    this._config = {
      debug: window.location.hostname === 'localhost' || 
             window.location.hostname === '127.0.0.1' ||
             new URLSearchParams(window.location.search).has('debug'),
      telemetry: true,
      maxListenersPerEvent: 100,
      warnOnMemoryLeak: true,
      maxEmitDepth: 50
    };
    
    // Namespace registry
    this._namespaces = new Map();
    
    // FIXED: Safe UUID generator that works even without crypto.randomUUID
    this._generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    };
    
    // Bind methods
    this.on = this.on.bind(this);
    this.once = this.once.bind(this);
    this.off = this.off.bind(this);
    this.emit = this.emit.bind(this);
    this.emitAsync = this.emitAsync.bind(this);
    
    this._log('Quantum Event Bus initialized');
  }

  // ==================== SUBSCRIPTION METHODS ====================

  /**
   * Subscribe to an event
   * @param {string} event - Event name (supports dot notation for namespaces)
   * @param {Function} callback - Callback function (can be async)
   * @param {Object} options - { priority: number, once: boolean, context: any }
   * @returns {Function} Unsubscribe function
   */
  on(event, callback, options = {}) {
    if (typeof event !== 'string' || !event) {
      throw new TypeError('[EventBus] Event name must be a non-empty string');
    }
    if (typeof callback !== 'function') {
      throw new TypeError('[EventBus] Callback must be a function');
    }

    const { priority = 0, once = false, context = null } = options;
    const store = once ? this._onceListeners : this._listeners;

    if (!store.has(event)) {
      store.set(event, new Map());
    }

    const priorityMap = store.get(event);
    if (!priorityMap.has(priority)) {
      priorityMap.set(priority, new Set());
    }

    // Check for memory leaks
    if (this._config.warnOnMemoryLeak) {
      const totalForEvent = this._countListenersForEvent(store, event);
      if (totalForEvent >= this._config.maxListenersPerEvent) {
        console.warn(
          `[EventBus] ⚠️ Event "${event}" has ${totalForEvent}+ listeners. ` +
          `Possible memory leak. Use bus.off() to clean up unused listeners.`
        );
      }
    }

    // Bind context if provided
    const boundCallback = context ? callback.bind(context) : callback;
    priorityMap.get(priority).add(boundCallback);

    this._updateMetrics('subscribe');

    this._log(`Subscribed to "${event}" (priority: ${priority}, once: ${once})`);

    // Return unsubscribe function
    return () => this.off(event, boundCallback);
  }

  /**
   * Subscribe to an event for one-time execution
   */
  once(event, callback, options = {}) {
    return this.on(event, callback, { ...options, once: true });
  }

  /**
   * Subscribe with async execution (errors don't block other listeners)
   * FIXED: Proper cleanup of async listeners on unsubscribe
   */
  onAsync(event, callback, options = {}) {
    if (!this._asyncListeners.has(event)) {
      this._asyncListeners.set(event, new Set());
    }
    this._asyncListeners.get(event).add(callback);
    
    // Create wrapper that handles async execution
    const wrapper = async (data) => {
      try {
        await callback(data);
      } catch (error) {
        console.error(`[EventBus] Async listener error for "${event}":`, error);
        this._metrics.totalErrors++;
        
        // Emit error event (with recursion protection)
        if (event !== 'error:occurred' && event !== 'error:*') {
          setTimeout(() => {
            this._emitError('async_listener_error', {
              sourceEvent: event,
              error: error.message || 'Unknown error',
              stack: error.stack
            });
          }, 0);
        }
      }
    };
    
    // Store mapping for cleanup
    this._asyncWrapperMap.set(wrapper, callback);
    
    // Subscribe the wrapper
    const unsubscribe = this.on(event, wrapper, options);
    
    // Store reference for proper cleanup
    unsubscribe._asyncCallback = callback;
    unsubscribe._asyncWrapper = wrapper;
    
    return unsubscribe;
  }

  /**
   * Debounced subscription - callback fires after no events for `delay` ms
   */
  onDebounced(event, callback, delay = 300, options = {}) {
    if (!this._debounceTimers.has(event)) {
      this._debounceTimers.set(event, new Map());
    }

    const debouncedCallback = (data) => {
      const timerMap = this._debounceTimers.get(event);
      if (timerMap.has(callback)) {
        clearTimeout(timerMap.get(callback));
      }
      timerMap.set(callback, setTimeout(() => {
        callback(data);
        timerMap.delete(callback);
      }, delay));
    };

    const unsubscribe = this.on(event, debouncedCallback, options);
    // Store reference for cleanup
    unsubscribe._debounceCallback = callback;
    return unsubscribe;
  }

  /**
   * Throttled subscription - callback fires at most once per `interval` ms
   */
  onThrottled(event, callback, interval = 300, options = {}) {
    if (!this._throttleState.has(event)) {
      this._throttleState.set(event, new Map());
    }

    const throttledCallback = (data) => {
      const stateMap = this._throttleState.get(event);
      const lastRun = stateMap.get(callback) || 0;
      const now = Date.now();

      if (now - lastRun >= interval) {
        stateMap.set(callback, now);
        callback(data);
      }
    };

    const unsubscribe = this.on(event, throttledCallback, options);
    unsubscribe._throttleCallback = callback;
    return unsubscribe;
  }

  /**
   * Create a namespaced event bus (prefixes all events)
   * @example
   *   const cartBus = bus.namespace('cart');
   *   cartBus.emit('updated'); // Emits 'cart:updated'
   */
  namespace(prefix) {
    if (this._namespaces.has(prefix)) {
      return this._namespaces.get(prefix);
    }

    const namespacedBus = {
      on: (event, callback, options) => this.on(`${prefix}:${event}`, callback, options),
      once: (event, callback, options) => this.once(`${prefix}:${event}`, callback, options),
      off: (event, callback) => this.off(`${prefix}:${event}`, callback),
      emit: (event, data) => this.emit(`${prefix}:${event}`, data),
      emitAsync: (event, data) => this.emitAsync(`${prefix}:${event}`, data),
      namespace: (subPrefix) => this.namespace(`${prefix}:${subPrefix}`),
      getBus: () => this
    };

    this._namespaces.set(prefix, namespacedBus);
    return namespacedBus;
  }

  // ==================== EMISSION ====================

  /**
   * Emit an event with data
   * FIXED: Prevents infinite recursion from wildcard/namespace emissions
   * FIXED: Detects circular dependencies
   * FIXED: Safe depth limiting
   * FIXED: Error event recursion protection
   * 
   * @param {string} event - Event name
   * @param {*} data - Data payload
   * @param {Object} options - { async: boolean, replay: boolean }
   */
  emit(event, data, options = {}) {
    if (typeof event !== 'string' || !event) return;

    // FIXED: Error event recursion protection
    if (event === 'error:occurred' || event === 'error:*') {
      if (this._errorEmissionDepth >= this._maxErrorDepth) {
        console.warn('[EventBus] ⛔ Max error event depth reached, preventing error recursion');
        this._metrics.errorRecursionPrevented++;
        return;
      }
      this._errorEmissionDepth++;
    }

    // FIXED: Depth limit to prevent stack overflow
    if (this._emitDepth > this._config.maxEmitDepth) {
      console.error(`[EventBus] ⛔ Max emit depth (${this._config.maxEmitDepth}) reached for "${event}"`);
      this._metrics.recursionDetected++;
      if (event === 'error:occurred' || event === 'error:*') {
        this._errorEmissionDepth--;
      }
      return;
    }

    // FIXED: Circular dependency detection
    if (this._emissionChain.includes(event)) {
      console.warn(`[EventBus] 🔄 Circular dependency detected: ${this._emissionChain.join(' → ')} → ${event}`);
      this._metrics.circularDetected++;
      // Allow it once but log warning - prevents silent failures
    }

    // ===== FIX: Recursion guard =====
    // If this event is already being emitted (from a wildcard cascade), skip
    if (this._emitting.has(event)) {
      this._log(`🔄 Skipping recursive emit for "${event}"`);
      this._metrics.recursionDetected++;
      if (event === 'error:occurred' || event === 'error:*') {
        this._errorEmissionDepth--;
      }
      return;
    }
    
    this._emitting.add(event);
    this._emitDepth++;
    this._emissionChain.push(event);

    const startTime = performance.now();
    this._metrics.totalEmits++;
    
    // Track event frequency
    const count = this._metrics.eventsFired.get(event) || 0;
    this._metrics.eventsFired.set(event, count + 1);

    // Store in history for replay
    if (!this._history.has(event)) {
      this._history.set(event, []);
    }
    const history = this._history.get(event);
    history.push({
      data: this._safeClone(data),
      timestamp: Date.now(),
      id: this._generateId()
    });
    if (history.length > this._maxHistoryPerEvent) {
      history.shift();
    }

    const allCallbacks = [];

    // Collect regular listeners
    this._collectCallbacks(this._listeners, event, allCallbacks);
    
    // FIXED: Collect once listeners BEFORE clearing them
    const onceCallbacks = [];
    this._collectCallbacks(this._onceListeners, event, onceCallbacks);
    allCallbacks.push(...onceCallbacks);
    
    // FIXED: Clear once listeners AFTER collecting (or if error occurs, they'll be cleaned up)
    // But we need to handle errors gracefully
    this._onceListeners.delete(event);

    // Execute callbacks with error handling
    let hasError = false;
    for (const { callback, priority } of allCallbacks) {
      try {
        callback(data);
      } catch (error) {
        hasError = true;
        console.error(`[EventBus] Error in listener for "${event}" (priority: ${priority}):`, error);
        this._metrics.totalErrors++;
        
        // Emit error event (with recursion protection)
        if (event !== 'error:occurred' && event !== 'error:*') {
          // Use setTimeout to break call stack
          setTimeout(() => {
            this._emitError('listener_error', {
              sourceEvent: event,
              error: error.message || 'Unknown error',
              stack: error.stack,
              data: this._safeClone(data)
            });
          }, 0);
        }
      }
    }

    // ===== FIX: Safe wildcard emission with circular detection =====
    // Only emit to wildcard if:
    // 1. This is NOT already a wildcard event ('*' or '*:something')
    // 2. This is NOT already a namespace wildcard ('auth:*', etc.)
    // 3. We haven't already emitted this wildcard in the current chain
    // 4. We haven't exceeded max depth
    const isWildcard = event === '*' || event.endsWith(':*');
    if (!isWildcard && this._emitDepth < this._config.maxEmitDepth) {
      // Emit to global wildcard '*'
      if (!this._emitting.has('*') && !this._emissionChain.includes('*')) {
        this.emit('*', { event, data: this._safeClone(data) });
      }
      
      // Emit to namespace wildcard (e.g., 'auth:*')
      const parts = event.split(':');
      if (parts.length > 1) {
        const namespaceWildcard = `${parts[0]}:*`;
        if (!this._emitting.has(namespaceWildcard) && !this._emissionChain.includes(namespaceWildcard)) {
          this.emit(namespaceWildcard, { event, data: this._safeClone(data) });
        }
      }
      
      // Emit to deeper namespace wildcards (e.g., 'auth:user:*')
      if (parts.length > 2) {
        for (let i = parts.length - 1; i >= 1; i--) {
          const nsWildcard = parts.slice(0, i).join(':') + ':*';
          if (!this._emitting.has(nsWildcard) && !this._emissionChain.includes(nsWildcard)) {
            this.emit(nsWildcard, { event, data: this._safeClone(data) });
          }
        }
      }
    }

    // Track performance
    const duration = performance.now() - startTime;
    if (duration > this._metrics.slowestEvent.duration) {
      this._metrics.slowestEvent = { name: event, duration };
    }
    if (this._config.telemetry && duration > 10) {
      this._log(`🐢 Slow event "${event}" took ${duration.toFixed(2)}ms`);
    }
    
    // FIXED: Remove from emitting set after done
    this._emitting.delete(event);
    this._emitDepth--;
    this._emissionChain.pop();
    
    // Decrement error depth if this was an error event
    if (event === 'error:occurred' || event === 'error:*') {
      this._errorEmissionDepth--;
    }
  }

  /**
   * Emit an event and wait for all async listeners to complete
   */
  async emitAsync(event, data) {
    this.emit(event, data);
    
    // Execute dedicated async listeners
    if (this._asyncListeners.has(event)) {
      const promises = [];
      for (const callback of this._asyncListeners.get(event)) {
        promises.push(
          Promise.resolve(callback(data)).catch(error => {
            console.error(`[EventBus] Async error for "${event}":`, error);
            this._metrics.totalErrors++;
            // Emit error event with recursion protection
            if (event !== 'error:occurred' && event !== 'error:*') {
              this._emitError('async_error', {
                sourceEvent: event,
                error: error.message || 'Unknown error',
                stack: error.stack
              });
            }
          })
        );
      }
      await Promise.allSettled(promises);
    }
  }

  /**
   * Internal method to emit error events with protection
   */
  _emitError(type, data) {
    if (this._errorEmissionDepth >= this._maxErrorDepth) return;
    try {
      this.emit('error:occurred', {
        type: type,
        ...data,
        timestamp: Date.now()
      });
    } catch (e) {
      // Last resort - just log to console
      console.error('[EventBus] Failed to emit error event:', e);
      console.error('[EventBus] Original error:', data.error);
    }
  }

  /**
   * Replay the last N events of a specific type
   */
  replay(event, count = 5, callback) {
    const history = this._history.get(event) || [];
    const recentEvents = history.slice(-count);
    
    for (const record of recentEvents) {
      try {
        callback(record.data);
      } catch (error) {
        console.error(`[EventBus] Replay error for "${event}":`, error);
      }
    }
    
    return recentEvents.length;
  }

  /**
   * Get event history
   */
  getHistory(event) {
    return this._history.get(event) ? [...this._history.get(event)] : [];
  }

  // ==================== UNSUBSCRIPTION ====================

  /**
   * Unsubscribe from an event
   * FIXED: Proper cleanup of async listeners
   */
  off(event, callback) {
    if (!event || !callback) return;

    this._removeCallback(this._listeners, event, callback);
    this._removeCallback(this._onceListeners, event, callback);
    
    // FIXED: Also remove from async listeners
    if (this._asyncListeners.has(event)) {
      const asyncSet = this._asyncListeners.get(event);
      
      // Check if this callback is an async wrapper
      const originalCallback = this._asyncWrapperMap.get(callback);
      if (originalCallback) {
        asyncSet.delete(originalCallback);
        this._asyncWrapperMap.delete(callback);
      }
      
      // Also check for stored original callback
      for (const cb of asyncSet) {
        if (cb === callback || cb._asyncCallback === callback) {
          asyncSet.delete(cb);
        }
      }
      
      // Check if there's a wrapper associated with this callback
      if (callback._asyncWrapper) {
        // Remove the wrapper from regular listeners
        this._removeCallback(this._listeners, event, callback._asyncWrapper);
        this._removeCallback(this._onceListeners, event, callback._asyncWrapper);
        // Remove the original from async listeners
        if (callback._asyncCallback) {
          asyncSet.delete(callback._asyncCallback);
        }
      }
      
      // Clean up empty async listener maps
      if (asyncSet.size === 0) {
        this._asyncListeners.delete(event);
      }
    }
    
    // Clean up debounce timers
    if (this._debounceTimers.has(event)) {
      const timerMap = this._debounceTimers.get(event);
      if (timerMap.has(callback)) {
        clearTimeout(timerMap.get(callback));
        timerMap.delete(callback);
      }
      // Also check for debounce callbacks
      for (const [cb, timerId] of timerMap) {
        if (cb._debounceCallback === callback) {
          clearTimeout(timerId);
          timerMap.delete(cb);
        }
      }
      if (timerMap.size === 0) {
        this._debounceTimers.delete(event);
      }
    }

    this._updateMetrics('unsubscribe');
    this._log(`Unsubscribed from "${event}"`);
  }

  // ==================== CLEANUP ====================

  /**
   * Remove all listeners for an event (or all events)
   * FIXED: Proper async listener cleanup
   */
  clear(event) {
    if (event) {
      // Clear listeners
      this._listeners.delete(event);
      this._onceListeners.delete(event);
      this._asyncListeners.delete(event);
      this._history.delete(event);
      
      // Clean debounce timers for this event
      if (this._debounceTimers.has(event)) {
        const timerMap = this._debounceTimers.get(event);
        for (const timerId of timerMap.values()) {
          clearTimeout(timerId);
        }
        this._debounceTimers.delete(event);
      }
      
      // Clean throttle state
      this._throttleState.delete(event);
      
      this._log(`Cleared "${event}"`);
    } else {
      // Clear all debounce timers
      for (const timerMap of this._debounceTimers.values()) {
        for (const timerId of timerMap.values()) {
          clearTimeout(timerId);
        }
      }
      
      this._listeners.clear();
      this._onceListeners.clear();
      this._asyncListeners.clear();
      this._history.clear();
      this._debounceTimers.clear();
      this._throttleState.clear();
      this._namespaces.clear();
      this._emitting.clear();
      this._emissionChain = [];
      this._emitDepth = 0;
      this._errorEmissionDepth = 0;
      this._asyncWrapperMap = new WeakMap(); // Reset wrapper map
      this._log('Cleared all events');
    }
    this._updateMetrics('clear');
  }

  /**
   * Dispose the entire event bus (call before app teardown)
   */
  destroy() {
    // Clear all debounce timers first
    for (const timerMap of this._debounceTimers.values()) {
      for (const timerId of timerMap.values()) {
        clearTimeout(timerId);
      }
    }
    
    this.clear();
    this._metrics.eventsFired.clear();
    this._emitting.clear();
    this._emissionChain = [];
    this._namespaces.clear();
    this._asyncWrapperMap = new WeakMap();
    console.log('[EventBus] Disposed');
  }

  // ==================== QUERY METHODS ====================

  /**
   * Get listener count for an event
   */
  listenerCount(event) {
    let count = 0;
    count += this._countListenersForEvent(this._listeners, event);
    count += this._countListenersForEvent(this._onceListeners, event);
    if (this._asyncListeners.has(event)) {
      count += this._asyncListeners.get(event).size;
    }
    return count;
  }

  /**
   * Check if event has listeners
   */
  hasListeners(event) {
    return this.listenerCount(event) > 0;
  }

  /**
   * Get all registered event names
   */
  eventNames() {
    const names = new Set([
      ...this._listeners.keys(),
      ...this._onceListeners.keys(),
      ...this._asyncListeners.keys()
    ]);
    return Array.from(names).sort();
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this._metrics,
      totalEvents: this.eventNames().length,
      totalListeners: this._metrics.totalListeners,
      recursionDetected: this._metrics.recursionDetected,
      circularDetected: this._metrics.circularDetected,
      errorRecursionPrevented: this._metrics.errorRecursionPrevented,
      currentEmitDepth: this._emitDepth,
      emissionChain: [...this._emissionChain],
      eventsByFrequency: Object.fromEntries(
        Array.from(this._metrics.eventsFired.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
      )
    };
  }

  // ==================== PRIVATE HELPERS ====================

  _collectCallbacks(store, event, allCallbacks) {
    if (store.has(event)) {
      const priorityMap = store.get(event);
      const sortedPriorities = Array.from(priorityMap.keys()).sort((a, b) => b - a);
      for (const priority of sortedPriorities) {
        for (const callback of priorityMap.get(priority)) {
          allCallbacks.push({ callback, priority });
        }
      }
    }
  }

  _removeCallback(store, event, callback) {
    if (store.has(event)) {
      const priorityMap = store.get(event);
      for (const [priority, callbacks] of priorityMap.entries()) {
        if (callbacks.has(callback)) {
          callbacks.delete(callback);
          if (callbacks.size === 0) priorityMap.delete(priority);
          return true;
        }
      }
      if (priorityMap.size === 0) store.delete(event);
    }
    return false;
  }

  _countListenersForEvent(store, event) {
    if (!store.has(event)) return 0;
    let count = 0;
    for (const callbacks of store.get(event).values()) {
      count += callbacks.size;
    }
    return count;
  }

  _updateMetrics(action) {
    if (action === 'subscribe') this._metrics.totalListeners++;
    if (action === 'unsubscribe') this._metrics.totalListeners = Math.max(0, this._metrics.totalListeners - 1);
    if (action === 'clear') this._metrics.totalListeners = 0;
  }

  /**
   * FIXED: Safe clone with circular reference handling
   */
  _safeClone(data) {
    if (data === null || data === undefined) return data;
    
    // Handle primitive types
    if (typeof data !== 'object') return data;
    
    // Handle Date
    if (data instanceof Date) return data.toISOString();
    
    // Handle RegExp
    if (data instanceof RegExp) return data.toString();
    
    // Handle Map
    if (data instanceof Map) {
      const result = {};
      for (const [key, value] of data) {
        result[key] = this._safeClone(value);
      }
      return result;
    }
    
    // Handle Set
    if (data instanceof Set) {
      return Array.from(data).map(item => this._safeClone(item));
    }
    
    // Handle Arrays
    if (Array.isArray(data)) {
      return data.map(item => this._safeClone(item));
    }
    
    // Handle Objects with circular reference detection
    try {
      // Try using a weak map to track seen objects
      const seen = new WeakMap();
      const safeStringify = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (seen.has(obj)) return '[Circular]';
        seen.set(obj, true);
        
        const result = {};
        for (const key of Object.keys(obj)) {
          try {
            result[key] = safeStringify(obj[key]);
          } catch (e) {
            result[key] = `[Unserializable: ${e.message}]`;
          }
        }
        return result;
      };
      
      return safeStringify(data);
    } catch (e) {
      // Ultimate fallback - just return a string representation
      return `[Uncloneable: ${typeof data}]`;
    }
  }

  _log(message) {
    if (this._config.debug) {
      console.log(`[EventBus] ${message}`);
    }
  }
}

// ==================== SINGLETON INSTANCE ====================
const bus = new QuantumEventBus();

// ==================== STANDARD APPLICATION EVENTS ====================
const Events = {
  // Auth events
  AUTH_CHANGED: 'auth:changed',
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_ERROR: 'auth:error',
  AUTH_SESSION_EXPIRED: 'auth:session_expired',
  AUTH_OTP_REQUESTED: 'auth:otp_requested',
  AUTH_OTP_VERIFIED: 'auth:otp_verified',

  // API events
  API_ERROR: 'api:error',
  API_REQUEST: 'api:request',
  API_RESPONSE: 'api:response',
  API_RATE_LIMITED: 'api:rate_limited',

  // Cart events
  CART_UPDATED: 'cart:updated',
  CART_ITEM_ADDED: 'cart:item_added',
  CART_ITEM_REMOVED: 'cart:item_removed',
  CART_ITEM_QTY_CHANGED: 'cart:item_qty_changed',
  CART_CHECKOUT_STARTED: 'cart:checkout_started',
  CART_CHECKOUT_COMPLETED: 'cart:checkout_completed',
  CART_CLEARED: 'cart:cleared',

  // Wishlist events
  WISHLIST_UPDATED: 'wishlist:updated',
  WISHLIST_ITEM_ADDED: 'wishlist:item_added',
  WISHLIST_ITEM_REMOVED: 'wishlist:item_removed',

  // Product events
  PRODUCT_VIEWED: 'product:viewed',
  PRODUCT_SEARCHED: 'product:searched',
  PRODUCT_FILTERED: 'product:filtered',
  PRODUCT_COMPARED: 'product:compared',

  // UI events
  MODAL_OPENED: 'modal:opened',
  MODAL_CLOSED: 'modal:closed',
  NOTIFICATION_SHOWN: 'notification:shown',
  TOAST_DISPLAYED: 'toast:displayed',
  THEME_CHANGED: 'theme:changed',
  LANGUAGE_CHANGED: 'language:changed',
  CURRENCY_CHANGED: 'currency:changed',

  // Navigation events
  NAVIGATION_START: 'navigation:start',
  NAVIGATION_END: 'navigation:end',
  PAGE_LOADED: 'page:loaded',
  PAGE_UNLOADED: 'page:unloaded',
  ROUTE_CHANGED: 'route:changed',

  // Search events
  SEARCH_QUERY: 'search:query',
  SEARCH_RESULTS: 'search:results',
  SEARCH_CLEARED: 'search:cleared',

  // Review events
  REVIEW_SUBMITTED: 'review:submitted',
  REVIEW_LOADED: 'review:loaded',
  REVIEW_VOTED: 'review:voted',

  // Gamification
  POINTS_EARNED: 'points:earned',
  LEVEL_UP: 'level:up',
  BADGE_UNLOCKED: 'badge:unlocked',
  LEADERBOARD_UPDATED: 'leaderboard:updated',

  // Connectivity
  ONLINE: 'online',
  OFFLINE: 'offline',
  CONNECTIVITY_CHANGED: 'connectivity:changed',

  // Performance
  PERFORMANCE_METRIC: 'performance:metric',
  ERROR_OCCURRED: 'error:occurred',
  MEMORY_WARNING: 'memory:warning',

  // Reseller
  RESELLER_JOINED: 'reseller:joined',
  RESELLER_SALE: 'reseller:sale',
  RESELLER_COMMISSION: 'reseller:commission',

  // AI
  AI_RESPONSE_RECEIVED: 'ai:response_received',
  AI_SUGGESTION_SHOWN: 'ai:suggestion_shown',
  AI_CHAT_STARTED: 'ai:chat_started',
  AI_CHAT_ENDED: 'ai:chat_ended',

  // Charging (Smart Charge OS)
  CHARGING_SESSION_STARTED: 'charging:session_started',
  CHARGING_SESSION_COMPLETED: 'charging:session_completed',
  CHARGING_DEVICE_READY: 'charging:device_ready',
  CHARGING_OVERNIGHT: 'charging:overnight',

  // Analytics
  ANALYTICS_EVENT: 'analytics:event',
  CONVERSION_TRACKED: 'conversion:tracked',
  USER_ENGAGED: 'user:engaged'
};

// ==================== EXPORT ====================
export { bus, Events, QuantumEventBus };
export default bus;
