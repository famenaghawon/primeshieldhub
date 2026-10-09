/**
 * router.js — UltraRouter v4.1.0
 * Hyper‑sophisticated, mobile‑optimized client‑side router.
 * FIXED: Integrated with CONFIG, auth, and fingerprint.
 * Module‑first export. IIFE wrapper removed.
 */

import { CONFIG } from './config.js';
import { auth } from './auth.js';
import { getDeviceFingerprint } from './sophisticated/fraud-engine/fingerprint.js';
import { bus, Events } from './events.js';

// ---------------------------------------------------------------
// 0. Environment Detection
// ---------------------------------------------------------------
const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const HAS_WAAPI = typeof Element.prototype.animate === 'function';
const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SUPPORTS_SAVE_DATA = 'connection' in navigator && navigator.connection && navigator.connection.saveData;

// ---------------------------------------------------------------
// 1. Lightweight path‑to‑regexp
// ---------------------------------------------------------------
function pathToRegexp(path, keys = []) {
  const pattern = path
    .replace(/\/:([^/]+)/g, (_, key) => { keys.push({ name: key }); return '/([^/]+)'; })
    .replace(/\*/g, '.*');
  return new RegExp(`^${pattern}$`);
}

// ---------------------------------------------------------------
// 2. Defaults (now using CONFIG)
// ---------------------------------------------------------------
const DEFAULTS = {
  useHash: false,
  root: '/',
  outlet: '#app',
  linkSelector: 'a[href]',
  ignoreExternalLinks: true,
  lazyLoading: true,
  transitionType: 'slide-left',
  transitionDuration: IS_TOUCH ? 250 : 300,
  scrollToTop: true,
  restoreScroll: true,
  predictivePrefetch: true,
  gestureNavigation: true,
  gestureThreshold: 80,
  viewportBreakpoints: { mobile: 768, tablet: 1024, desktop: Infinity },
  interceptLinks: true,
  debug: CONFIG.debug || false,
  routes: CONFIG.pages || {},
  // Auth protection config
  protectedRoutes: {
    '/account': ['customer', 'admin', 'staff'],
    '/checkout': ['customer'],
    '/admin': ['admin'],
    '/admin/*': ['admin'],
    '/staff': ['staff', 'admin'],
    '/staff/*': ['staff', 'admin'],
    '/reseller': ['reseller', 'admin'],
    '/wholesale': ['wholesale', 'admin'],
  },
  // Public routes that don't require auth
  publicRoutes: ['/', '/products', '/about', '/contact', '/faq', '/blog', '/login', '/register'],
};

// ---------------------------------------------------------------
// 3. Utilities
// ---------------------------------------------------------------
const utils = {
  log: (...args) => DEFAULTS.debug && console.log('[UltraRouter]', ...args),
  warn: (...args) => console.warn('[UltraRouter]', ...args),
  error: (...args) => console.error('[UltraRouter]', ...args),

  parseQuery(qs) {
    const query = {};
    if (!qs) return query;
    (qs.replace(/^\?/, '').split('&')).forEach(pair => {
      const [key, val = ''] = pair.split('=');
      if (key) query[decodeURIComponent(key)] = decodeURIComponent(val);
    });
    return query;
  },

  stringifyQuery(q) {
    return Object.keys(q).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(q[k])}`).join('&');
  },

  matchPath(pattern, pathname) {
    const keys = [];
    const regex = pathToRegexp(pattern, keys);
    const match = regex.exec(pathname);
    if (!match) return null;
    const params = {};
    keys.forEach((k, i) => params[k.name] = match[i + 1]);
    return { params, match };
  },

  getViewportProfile() {
    const w = window.innerWidth;
    if (w <= DEFAULTS.viewportBreakpoints.mobile) return 'mobile';
    if (w <= DEFAULTS.viewportBreakpoints.tablet) return 'tablet';
    return 'desktop';
  },

  detectSwipe(startX, startY, endX, endY, threshold = 80) {
    const dx = endX - startX;
    const dy = endY - startY;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return null;
    return dx > 0 ? 'right' : 'left';
  },

  deepMerge(target, ...sources) {
    sources.forEach(source => {
      for (const key in source) {
        if (Array.isArray(source[key])) {
          target[key] = [...(target[key] || []), ...source[key]];
        } else if (source[key] instanceof Object) {
          target[key] = utils.deepMerge(target[key] || {}, source[key]);
        } else {
          target[key] = source[key];
        }
      }
    });
    return target;
  },

  // Check if path matches a pattern with wildcard
  matchesPattern(path, pattern) {
    if (pattern === path) return true;
    if (pattern.endsWith('/*')) {
      const base = pattern.slice(0, -2);
      return path.startsWith(base);
    }
    return false;
  },

  // Check if route requires authentication
  isProtectedRoute(path) {
    const protectedRoutes = DEFAULTS.protectedRoutes;
    for (const [pattern, roles] of Object.entries(protectedRoutes)) {
      if (this.matchesPattern(path, pattern)) {
        return roles;
      }
    }
    return false;
  },

  isPublicRoute(path) {
    return DEFAULTS.publicRoutes.some(route => 
      route === path || (route.endsWith('/*') && path.startsWith(route.slice(0, -2)))
    );
  }
};

// ---------------------------------------------------------------
// 4. EventEmitter
// ---------------------------------------------------------------
class EventEmitter {
  constructor() { this._events = {}; }
  on(e, fn) { (this._events[e] = this._events[e] || []).push(fn); return this; }
  off(e, fn) { if (!this._events[e]) return this; this._events[e] = this._events[e].filter(f => f !== fn); return this; }
  emit(e, ...args) { (this._events[e] || []).forEach(fn => fn(...args)); return this; }
}

// ---------------------------------------------------------------
// 5. Route
// ---------------------------------------------------------------
class Route {
  constructor(path, options = {}) {
    this.path = path;
    this.name = options.name || null;
    this.component = options.component || null;
    this.lazyComponent = options.lazyComponent || null;
    this.middleware = options.middleware || [];
    this.children = options.children || [];
    this.meta = options.meta || {};
    this.redirect = options.redirect || null;
    this.viewports = options.viewports || null;
    this.requiresAuth = options.requiresAuth || false;
    this.allowedRoles = options.allowedRoles || null;
    this.title = options.title || null;
  }
  addChild(child) { this.children.push(child); return this; }
}

// ---------------------------------------------------------------
// 6. UltraRouter (FIXED)
// ---------------------------------------------------------------
class UltraRouter extends EventEmitter {
  constructor(customOptions = {}) {
    super();
    this.options = utils.deepMerge({}, DEFAULTS, customOptions);
    this.routes = [];
    this.flatRoutes = [];
    this.currentRoute = null;
    this.currentParams = null;
    this.currentQuery = null;
    this.history = window.history;
    this.transitionInProgress = false;
    this.prefetchInstance = null;
    this._scrollPositions = new Map();
    this._orientationHandler = null;
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._interceptionDisabled = false;
    this._bound = false;
    this._init();
  }

  _init() {
    if (!window.history?.pushState) {
      this.options.useHash = true;
      utils.warn('History API missing – enabling hash routing.');
    }

    if (this.options.interceptLinks !== false) {
      this._bindLinks();
    }

    window.addEventListener('popstate', this._handlePopState.bind(this));
    if (this.options.useHash) {
      window.addEventListener('hashchange', this._handleHashChange.bind(this));
    }

    if (IS_TOUCH && this.options.gestureNavigation) {
      document.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: true });
      document.addEventListener('touchend', this._onTouchEnd.bind(this));
    }

    this._orientationHandler = () => {
      this.emit('viewport:change', { profile: utils.getViewportProfile() });
      this._revalidateCurrentRoute();
    };
    window.addEventListener('orientationchange', this._orientationHandler);
    window.matchMedia(`(min-width: ${this.options.viewportBreakpoints.mobile + 1}px)`).addEventListener('change', this._orientationHandler);

    if (this.options.predictivePrefetch && window.PredictivePrefetch && !SUPPORTS_SAVE_DATA) {
      this.prefetchInstance = new window.PredictivePrefetch({ router: this });
    } else if (this.options.predictivePrefetch && SUPPORTS_SAVE_DATA) {
      utils.log('Save-Data detected – prefetching disabled');
    }

    if (this.options.restoreScroll && window.sessionStorage) {
      try {
        const saved = sessionStorage.getItem('__ur_scroll_positions');
        if (saved) this._scrollPositions = new Map(JSON.parse(saved));
      } catch (e) {}
    }

    // Listen for auth changes to revalidate protected routes
    if (auth.onAuthStateChanged) {
      auth.onAuthStateChanged(() => {
        this._revalidateCurrentRoute();
      });
    }

    this._resolveInitialPath();
  }

  addRoute(path, options = {}) {
    this.routes.push(new Route(path, options));
    this._flattenRoutes();
    return this;
  }

  addRoutes(arr) { arr.forEach(r => this.addRoute(r.path, r)); return this; }

  _flattenRoutes(parentPath = '') {
    this.flatRoutes = [];
    const flatten = (routes, currentPath) => {
      routes.forEach(route => {
        const fullPath = (currentPath + route.path).replace(/\/+/g, '/') || '/';
        const keys = [];
        const regex = pathToRegexp(fullPath, keys);
        this.flatRoutes.push({ path: fullPath, route, regex, keys, parent: null });
        if (route.children?.length) flatten(route.children, fullPath);
      });
    };
    flatten(this.routes, parentPath);
  }

  _match(pathname) {
    const currentProfile = utils.getViewportProfile();
    for (const r of this.flatRoutes) {
      if (r.route.viewports && !r.route.viewports.includes(currentProfile)) continue;
      const match = r.regex.exec(pathname);
      if (match) {
        const params = {};
        r.keys.forEach((k, i) => params[k.name] = match[i + 1]);
        return { route: r.route, params, match: r };
      }
    }
    return null;
  }

  _revalidateCurrentRoute() {
    if (!this.currentRoute) return;
    const currentPath = this.options.useHash
      ? window.location.hash.slice(1) || '/'
      : window.location.pathname;
    const match = this._match(currentPath);
    if (!match || match.route !== this.currentRoute) {
      utils.log('Viewport/auth change triggered route re‑validation');
      this.navigateTo(currentPath, { replace: true, force: true });
    }
  }

  // ===== AUTH CHECK =====
  _checkRouteAuth(pathname) {
    // Public routes don't require auth
    if (utils.isPublicRoute(pathname)) {
      return { allowed: true };
    }

    // Check if route is protected
    const requiredRoles = utils.isProtectedRoute(pathname);
    if (!requiredRoles) {
      return { allowed: true };
    }

    // Get current user
    const user = auth.getUser();
    if (!user) {
      return { 
        allowed: false, 
        redirect: '/login',
        reason: 'Authentication required'
      };
    }

    // Check role
    const userRole = user.role || user.user_type || 'customer';
    if (!requiredRoles.includes(userRole)) {
      return {
        allowed: false,
        redirect: '/unauthorized',
        reason: `Role '${userRole}' not authorized`
      };
    }

    return { allowed: true };
  }

  async navigateTo(url, options = {}) {
    if (this.transitionInProgress && !options.force) {
      utils.warn('Transition already in progress.');
      return false;
    }

    if (this.currentRoute && this.options.restoreScroll) {
      this._scrollPositions.set(this._currentFullPath(), window.scrollY);
      this._persistScrollPositions();
    }

    let parsedUrl;
    try { parsedUrl = new URL(url, window.location.href); }
    catch { parsedUrl = { pathname: url, search: '', hash: '' }; }

    const pathname = parsedUrl.pathname;
    const query = utils.parseQuery(parsedUrl.search);
    const hash = parsedUrl.hash;

    // ===== AUTH CHECK =====
    const authCheck = this._checkRouteAuth(pathname);
    if (!authCheck.allowed) {
      if (authCheck.redirect) {
        utils.log(`Auth required for ${pathname}, redirecting to ${authCheck.redirect}`);
        return this.navigateTo(authCheck.redirect, { 
          replace: true, 
          force: true,
          query: { redirect: pathname }
        });
      }
      return false;
    }

    // Update CSRF token on navigation
    try {
      await this._refreshCSRF();
    } catch (e) {
      utils.warn('CSRF refresh failed:', e);
    }

    // Send fingerprint with navigation
    try {
      const fp = await getDeviceFingerprint();
      window.__psh_device_fingerprint = fp;
    } catch (e) {
      // Fingerprint not critical for navigation
    }

    const matchResult = this._match(pathname);
    if (!matchResult) return this._handleNotFound(pathname, query);
    if (matchResult.route.redirect) {
      return this.navigateTo(matchResult.route.redirect, { replace: true, force: true });
    }

    const context = { 
      params: matchResult.params, 
      query, 
      hash, 
      profile: utils.getViewportProfile(),
      user: auth.getUser(),
      isAuthenticated: !!auth.getUser()
    };
    
    const pipeline = this._buildMiddlewarePipeline(matchResult.route);
    try {
      const result = await pipeline(context);
      if (result === false) return false;
    } catch (err) {
      this.transitionInProgress = false;
      this.emit('route:error', { error: err, pathname });
      return false;
    }

    let component = matchResult.route.component;
    if (this.options.lazyLoading && matchResult.route.lazyComponent) {
      try { component = await matchResult.route.lazyComponent(); }
      catch (err) {
        this.emit('route:error', { error: err, pathname });
        return false;
      }
    }

    this.transitionInProgress = true;
    const transitionDirection = options.direction || (this.currentRoute ? 'forward' : 'initial');
    await this._renderRoute(component, { ...context, direction: transitionDirection }, matchResult.route.meta);
    this.transitionInProgress = false;

    const newUrl = this.options.useHash ? `#${pathname}` : pathname;
    const fullUrl = newUrl + (parsedUrl.search ? parsedUrl.search : '');
    if (window.location.href !== fullUrl) {
      if (options.replace) this.history.replaceState({}, '', fullUrl);
      else this.history.pushState({}, '', fullUrl);
    }

    this.currentRoute = matchResult.route;
    this.currentParams = matchResult.params;
    this.currentQuery = query;

    const fullKey = this._currentFullPath();
    if (this.options.restoreScroll && options.replace && this._scrollPositions.has(fullKey)) {
      window.scrollTo(0, this._scrollPositions.get(fullKey));
    } else if (this.options.scrollToTop) {
      window.scrollTo(0, 0);
    }

    // Update page title
    if (matchResult.route.title) {
      document.title = matchResult.route.title;
    } else if (matchResult.route.meta?.title) {
      document.title = matchResult.route.meta.title;
    }

    this.emit('route:change', {
      path: pathname, route: matchResult.route,
      params: matchResult.params, query, hash, 
      direction: transitionDirection,
      user: auth.getUser()
    });

    // Emit to global event bus
    if (bus?.emit) {
      bus.emit(Events.ROUTE_CHANGED, { 
        path: pathname, 
        params: matchResult.params, 
        query 
      });
    }

    this._maybePrefetchNearby();
    return true;
  }

  // ===== CSRF REFRESH =====
  async _refreshCSRF() {
    try {
      const response = await fetch(`${CONFIG.apiBase}/auth/csrf`, {
        credentials: 'include',
        headers: {
          'x-device-fingerprint': await getDeviceFingerprint()
        }
      });
      if (response.ok) {
        const token = await response.text();
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) meta.setAttribute('content', token);
      }
    } catch (e) {
      // Ignore CSRF errors
    }
  }

  _buildMiddlewarePipeline(route) {
    const middlewares = route.middleware || [];
    return async (context) => {
      let idx = 0;
      const next = async () => {
        if (idx < middlewares.length) {
          const fn = middlewares[idx++];
          const result = await fn(context, next);
          if (result === false) return false;
          return result;
        }
        return context;
      };
      return next();
    };
  }

  async _renderRoute(component, context, meta) {
    const outlet = document.querySelector(this.options.outlet);
    if (!outlet) throw new Error(`Outlet ${this.options.outlet} not found.`);

    if (context.direction !== 'initial' && !PREFERS_REDUCED_MOTION) {
      await this._animateOut(outlet, context.direction);
    }

    if (typeof component === 'function') {
      outlet.innerHTML = component(context);
    } else if (component?.render) {
      outlet.innerHTML = component.render(context);
    } else {
      outlet.innerHTML = component || '';
    }

    // Dispatch app:render event for other modules to hook into
    document.dispatchEvent(new CustomEvent('app:render', { 
      detail: { route: this.currentRoute, context } 
    }));

    if (component?.mounted) component.mounted(context);

    if (context.direction !== 'initial' && !PREFERS_REDUCED_MOTION) {
      await this._animateIn(outlet, context.direction);
    }

    if (meta?.title) document.title = meta.title;
  }

  async _animateOut(el, direction) {
    if (!HAS_WAAPI || this.options.transitionType === 'none') return;
    const dur = this.options.transitionDuration;
    const type = this.options.transitionType;
    const keyframes = type.startsWith('slide')
      ? { transform: ['translateX(0)', direction === 'forward' ? 'translateX(-25%)' : 'translateX(25%)'], opacity: [1, 0.3] }
      : { opacity: [1, 0] };
    await el.animate(keyframes, { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }).finished;
  }

  async _animateIn(el, direction) {
    if (!HAS_WAAPI || this.options.transitionType === 'none') return;
    const dur = this.options.transitionDuration;
    const type = this.options.transitionType;
    const keyframes = type.startsWith('slide')
      ? { transform: [direction === 'forward' ? 'translateX(25%)' : 'translateX(-25%)', 'translateX(0)'], opacity: [0.3, 1] }
      : { opacity: [0, 1] };
    await el.animate(keyframes, { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }).finished;
  }

  _onTouchStart(e) {
    if (e.touches.length !== 1) return;
    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
  }

  _onTouchEnd(e) {
    if (!this._touchStartX) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const direction = utils.detectSwipe(this._touchStartX, this._touchStartY, endX, endY, this.options.gestureThreshold);
    if (direction === 'right' && this.currentRoute) {
      this.back();
    } else if (direction === 'left') {
      this.forward();
    }
    this._touchStartX = 0;
  }

  // ============================================================================
  // FIXED: _bindLinks() - CRITICAL NAVIGATION FIX
  // Now allows hash links, external links, email, phone, and JS links
  // to work natively while still supporting SPA routing for internal pages
  // ============================================================================
  _bindLinks() {
    if (this._bound) return;
    this._bound = true;

    document.addEventListener('click', (e) => {
      if (this._interceptionDisabled) return;

      const link = e.target.closest(this.options.linkSelector);
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href) return;

      // ===== ALLOW THESE LINK TYPES TO WORK NATIVELY =====
      if (href === '#' ||
        href.startsWith('#') ||
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:') ||
        href === ''
      ) {
        return;
      }

      // Check for external links
      if (this.options.ignoreExternalLinks) {
        try {
          const targetUrl = new URL(href, window.location.href);
          if (targetUrl.origin !== window.location.origin) {
            return;
          }
        } catch {
          return;
        }
      }

      // Allow opening in new tab
      if (link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) {
        return;
      }

      // ===== ONLY INTERCEPT INTERNAL PAGE NAVIGATIONS =====
      e.preventDefault();
      this.navigateTo(href, { direction: 'forward' });
    });

    // Touch support for predictive prefetch
    if (IS_TOUCH && this.options.predictivePrefetch) {
      document.addEventListener('touchstart', (e) => {
        const link = e.target.closest(this.options.linkSelector);
        if (!link) return;
        const href = link.getAttribute('href');
        if (
          href && 
          !href.startsWith('#') && 
          !href.startsWith('http://') && 
          !href.startsWith('https://') &&
          !href.startsWith('mailto:') &&
          !href.startsWith('tel:') &&
          this.prefetchInstance
        ) {
          this.prefetchInstance.prefetch(href);
        }
      }, { passive: true });
    }
  }

  _handlePopState() {
    const path = this.options.useHash ? window.location.hash.slice(1) || '/' : window.location.pathname;
    this.navigateTo(path, { replace: true, direction: 'back' });
  }

  _handleHashChange() {
    const path = window.location.hash.slice(1) || '/';
    this.navigateTo(path, { replace: true });
  }

  _resolveInitialPath() {
    const initial = this.options.useHash
      ? (window.location.hash.slice(1) || '/')
      : window.location.pathname;
    this.navigateTo(initial, { replace: true, direction: 'initial' });
  }

  _currentFullPath() {
    return this.options.useHash
      ? window.location.hash.slice(1) || '/'
      : window.location.pathname + window.location.search;
  }

  _persistScrollPositions() {
    if (!window.sessionStorage) return;
    try {
      sessionStorage.setItem('__ur_scroll_positions',
        JSON.stringify(Array.from(this._scrollPositions.entries())));
    } catch (e) {}
  }

  _handleNotFound(pathname, query) {
    const notFound = this._match('/404') || this._match('*');
    if (notFound) return this.navigateTo('/404', { replace: true, force: true });
    const outlet = document.querySelector(this.options.outlet);
    if (outlet) {
      outlet.innerHTML = `
        <div style="text-align:center;padding:80px 20px;max-width:600px;margin:0 auto;">
          <h1 style="font-size:4rem;color:#d6b25e;margin-bottom:20px;">404</h1>
          <h2 style="color:#f0f0f0;margin-bottom:12px;">Page Not Found</h2>
          <p style="color:#888;margin-bottom:30px;">The page you're looking for doesn't exist or has been moved.</p>
          <button onclick="window.router?.go('/')" style="background:#d6b25e;color:#000;padding:12px 32px;border:none;border-radius:12px;font-weight:700;cursor:pointer;">
            <i class="fas fa-home"></i> Go Home
          </button>
        </div>
      `;
    }
    this.emit('route:notfound', { pathname, query });
    return false;
  }

  _maybePrefetchNearby() {
    if (!this.prefetchInstance || SUPPORTS_SAVE_DATA) return;
    const links = document.querySelectorAll(this.options.linkSelector);
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('http')) {
        this.prefetchInstance.prefetch(href, { priority: 'low' });
      }
    });
  }

  // ===== PUBLIC API =====
  go(path, opts = {}) { return this.navigateTo(path, { ...opts, direction: 'forward' }); }
  back() { if (this.currentRoute) this.history.back(); }
  forward() { this.history.forward(); }

  updateQuery(query, replace = false) {
    const newQuery = { ...this.currentQuery, ...query };
    const qs = utils.stringifyQuery(newQuery);
    const base = this.options.useHash
      ? `#${this.currentRoute.path}`
      : this.currentRoute.path;
    const url = base + (qs ? `?${qs}` : '');
    if (replace) this.history.replaceState({}, '', url);
    else this.history.pushState({}, '', url);
    this.currentQuery = newQuery;
    this.emit('route:querychange', { query: newQuery });
  }

  enableGesture(el, callback) {
    if (!IS_TOUCH) return;
    let sx = 0, sy = 0;
    el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', e => {
      const dir = utils.detectSwipe(sx, sy, e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      if (dir) callback(dir);
    });
  }

  disableLinkInterception() { this._interceptionDisabled = true; }
  enableLinkInterception() { this._interceptionDisabled = false; }

  // Get current route info
  getCurrentRoute() {
    return {
      route: this.currentRoute,
      params: this.currentParams,
      query: this.currentQuery,
      path: this._currentFullPath()
    };
  }

  destroy() {
    window.removeEventListener('popstate', this._handlePopState);
    window.removeEventListener('hashchange', this._handleHashChange);
    window.removeEventListener('orientationchange', this._orientationHandler);
  }
}

// ---------------------------------------------------------------
// EXPORTS (module‑first, consistent)
// ---------------------------------------------------------------
export { UltraRouter as default, UltraRouter };

export const navigate = (path, options = {}) => {
  if (window.router?.navigateTo) return window.router.navigateTo(path, options);
  // Fallback: use native browser navigation
  if (path.startsWith('#') || path.startsWith('http')) {
    window.location.href = path;
    return Promise.resolve(true);
  }
  window.location.href = path;
  return Promise.resolve(true);
};

export const setRouter = (instance) => {
  window.router = instance;
};

// Also expose on window for non‑module consumers
window.UltraRouter = UltraRouter;
window.navigate = navigate;
