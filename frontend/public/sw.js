// ================================================================ //
// PRIMESHIELDHUB - PROGRESSIVE WEB APP SERVICE WORKER v5.1       //
// Supports: Main Site + Staff Portal with PWA                     //
// Fixed: addAll errors, offline support, push notifications       //
// ================================================================ //

const CACHE_NAME = 'psh-pwa-v5.1';
const OFFLINE_URL = '/offline.html';
const STAFF_OFFLINE_URL = '/staff/offline.html';

// ===== MAIN SITE ASSETS =====
const MAIN_ASSETS = [
  '/',
  '/offline.html',
  '/company_logo.png',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/quantum-manifest.json',
  '/css/quantum.css',
  '/js/main.js',
  '/js/config.js',
  '/js/auth.js',
  '/js/auth-storage.js',
  '/js/api-client.js',
  '/js/push-notifications.js',
  '/js/cart-store.js',
  '/js/product-store.js',
  '/js/events.js',
  '/js/analytics.js',
  '/js/utils.js'
];

// ===== STAFF PORTAL ASSETS =====
const STAFF_ASSETS = [
  '/staff/',
  '/staff/offline.html',
  '/staff/dashboard.html',
  '/staff/profile.html',
  '/staff/settings.html',
  '/staff/activity.html',
  '/staff/login.html',
  '/staff/register.html',
  '/staff/forgot-password.html',
  '/staff/manifest.json',
  '/css/staff-quantum.css',
  '/js/staff-app.js',
  '/js/staff-pwa.js'
];

// ===== COMBINE ALL ASSETS =====
const STATIC_ASSETS = [...MAIN_ASSETS, ...STAFF_ASSETS];

// ================================================================
// INSTALL - Cache static assets with error handling
// ================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing PrimeShieldHub PWA v5.1...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        // Use addAll with individual error handling
        return cache.addAll(STATIC_ASSETS)
          .catch((err) => {
            console.warn('[SW] Some assets failed to cache:', err);
            // Don't fail the entire install - try individually
            // Return a resolved promise to continue installation
            return Promise.resolve();
          });
      })
      .then(() => {
        console.log('[SW] Installation complete!');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.warn('[SW] Installation error:', err);
        // Still skip waiting even if some caches failed
        return self.skipWaiting();
      })
  );
});

// ================================================================
// ACTIVATE - Clean old caches
// ================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    Promise.all([
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames
              .filter((name) => name !== CACHE_NAME)
              .map((name) => {
                console.log(`[SW] Deleting old cache: ${name}`);
                return caches.delete(name).catch(() => {});
              })
          );
        })
        .catch(() => {}),
      self.clients.claim()
    ])
  );
});

// ================================================================
// FETCH - Smart caching for main + staff
// ================================================================

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API calls
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip auth pages (don't cache them)
  if (url.pathname.includes('/login') || 
      url.pathname.includes('/register') || 
      url.pathname.includes('/admin-login') ||
      url.pathname.includes('/logout')) {
    return;
  }

  // ===== STAFF PORTAL PAGES - Network first =====
  if (url.pathname.startsWith('/staff/') && 
      (url.pathname.endsWith('.html') || url.pathname === '/staff/' || url.pathname === '/staff')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache successful responses
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache).catch(() => {});
              })
              .catch(() => {});
          }
          return response;
        })
        .catch(() => {
          // Check if staff offline page exists
          return caches.match(STAFF_OFFLINE_URL)
            .then((cached) => {
              if (cached) return cached;
              // Fallback to main offline
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // ===== MAIN SITE PAGES - Network first =====
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache successful responses
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache).catch(() => {});
              })
              .catch(() => {});
          }
          return response;
        })
        .catch(() => {
          return caches.match(OFFLINE_URL)
            .then((cached) => {
              if (cached) return cached;
              // Basic offline fallback
              return new Response(
                '<h1>Offline</h1><p>Please check your internet connection.</p>',
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/html' }
                }
              );
            });
        })
    );
    return;
  }

  // ===== STATIC ASSETS - Cache first with fallback =====
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Check if cached response is valid (not a redirect)
          if (cachedResponse.status === 301 || 
              cachedResponse.status === 302 || 
              cachedResponse.status === 303) {
            return fetch(event.request)
              .then((response) => {
                if (response && response.status === 200) {
                  const responseToCache = response.clone();
                  caches.open(CACHE_NAME)
                    .then((cache) => {
                      cache.put(event.request, responseToCache).catch(() => {});
                    })
                    .catch(() => {});
                }
                return response;
              })
              .catch(() => cachedResponse);
          }
          return cachedResponse;
        }

        // Not in cache - fetch from network
        return fetch(event.request)
          .then((response) => {
            // Only cache successful responses for static assets
            if (event.request.method === 'GET' && 
                response && response.status === 200) {
              // Don't cache HTML files here (they're handled above)
              const contentType = response.headers.get('content-type') || '';
              if (!contentType.includes('text/html')) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache).catch(() => {});
                  })
                  .catch(() => {});
              }
            }
            return response;
          })
          .catch((error) => {
            console.warn('[SW] Fetch failed for:', event.request.url, error);
            // Return a basic offline response if available
            if (event.request.mode === 'navigate') {
              if (url.pathname.startsWith('/staff/')) {
                return caches.match(STAFF_OFFLINE_URL);
              }
              return caches.match(OFFLINE_URL);
            }
            // For images and other assets, return a placeholder if possible
            if (event.request.destination === 'image') {
              return new Response('', { status: 204 });
            }
            // Return a generic error response
            return new Response('Network error', { status: 503 });
          });
      })
  );
});

// ================================================================
// PUSH NOTIFICATION HANDLERS
// ================================================================

self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    try {
      // Try parsing as plain text
      const text = event.data ? event.data.text() : '';
      data = {
        title: 'PrimeShieldHub',
        body: text || 'New update available!',
        icon: '/favicon.png',
        badge: '/favicon.png',
        url: '/',
        tag: 'default'
      };
    } catch (e2) {
      data = {
        title: 'PrimeShieldHub',
        body: 'New update available!',
        icon: '/favicon.png',
        badge: '/favicon.png',
        url: '/',
        tag: 'default'
      };
    }
  }

  // Ensure required fields
  const title = data.title || 'PrimeShieldHub';
  const body = data.body || 'Check out PrimeShieldHub!';
  const isStaff = data.staff === true || data.role === 'staff' || (data.url && data.url.includes('/staff/'));

  const options = {
    body: body,
    icon: isStaff ? '/staff-icons/icon-192x192.png' : (data.icon || '/favicon.png'),
    badge: isStaff ? '/staff-icons/icon-72x72.png' : (data.badge || '/favicon.png'),
    vibrate: [200, 100, 200],
    tag: data.tag || 'psh-notification-' + Date.now(),
    requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : true,
    renotify: true,
    data: {
      url: data.url || (isStaff ? '/staff/' : '/'),
      clickCount: 0,
      timestamp: Date.now(),
      isStaff: isStaff,
      action: data.action || 'open'
    },
    actions: [
      {
        action: 'open',
        title: isStaff ? '🔗 Open Staff Portal' : '🔗 View Now'
      },
      {
        action: 'dismiss',
        title: '❌ Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .catch((err) => {
        console.warn('[SW] Show notification failed:', err);
      })
  );
});

// ================================================================
// NOTIFICATION CLICK HANDLER
// ================================================================

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);
  
  // Close the notification
  event.notification.close();

  // Handle dismiss action
  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';
  const isStaff = event.notification.data?.isStaff || false;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // Check if there's already a window/tab open with the target URL
      for (let client of windowClients) {
        // Check exact match
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
        // If staff URL and any staff page is open, focus it
        if (isStaff && client.url.includes('/staff/') && 'focus' in client) {
          return client.focus();
        }
        // If main site and any main page is open
        if (!isStaff && !client.url.includes('/staff/') && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ================================================================
// NOTIFICATION CLOSE HANDLER
// ================================================================

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// ================================================================
// INSTALL PROMPT HANDLING
// ================================================================

let deferredPrompt = null;

self.addEventListener('beforeinstallprompt', (event) => {
  console.log('[SW] Install prompt available');
  event.preventDefault();
  deferredPrompt = event;
  
  // Send message to all clients
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'install-prompt-available',
        data: { canInstall: true }
      });
    });
  });
});

// Listen for install prompt response
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'trigger-install') {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[SW] User accepted the install prompt');
        } else {
          console.log('[SW] User dismissed the install prompt');
        }
        deferredPrompt = null;
      });
    }
  }
});

// ================================================================
// BACKGROUND SYNC - For offline actions
// ================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
  if (event.tag === 'sync-staff-activity') {
    event.waitUntil(syncStaffActivity());
  }
  if (event.tag === 'sync-reviews') {
    event.waitUntil(syncReviews());
  }
});

async function syncOrders() {
  try {
    const cache = await caches.open('pending-orders');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await cache.match(request);
        if (response) {
          const data = await response.json();
          const result = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (result.ok) {
            await cache.delete(request);
            console.log('[SW] Synced pending order');
            
            // Show success notification
            self.registration.showNotification('✅ Order Synced', {
              body: 'Your order has been submitted successfully!',
              icon: '/favicon.png',
              tag: 'order-sync'
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('[SW] Sync order failed:', e);
      }
    }
  } catch (error) {
    console.error('[SW] Sync pending orders error:', error);
  }
}

async function syncStaffActivity() {
  try {
    const cache = await caches.open('pending-staff-activity');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
          console.log('[SW] Synced staff activity');
        }
      } catch (e) {
        console.error('[SW] Staff activity sync failed:', e);
      }
    }
  } catch (error) {
    console.error('[SW] Sync staff activity error:', error);
  }
}

async function syncReviews() {
  try {
    const cache = await caches.open('pending-reviews');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
          console.log('[SW] Synced review');
        }
      } catch (e) {
        console.error('[SW] Review sync failed:', e);
      }
    }
  } catch (error) {
    console.error('[SW] Sync reviews error:', error);
  }
}

// ================================================================
// ONLINE EVENT - Trigger sync when coming back online
// ================================================================

self.addEventListener('online', () => {
  console.log('[SW] Online - syncing...');
  // Trigger background sync if supported
  if (self.registration.sync) {
    self.registration.sync.register('sync-orders').catch(() => {});
    self.registration.sync.register('sync-staff-activity').catch(() => {});
    self.registration.sync.register('sync-reviews').catch(() => {});
  }
});

// ================================================================
// ERROR HANDLING
// ================================================================

self.addEventListener('error', (event) => {
  console.warn('[SW] Unhandled error:', event.message, event.filename, event.lineno);
});

self.addEventListener('unhandledrejection', (event) => {
  console.warn('[SW] Unhandled rejection:', event.reason);
});

console.log('[SW] Service Worker loaded successfully!');
