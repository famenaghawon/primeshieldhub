// js/behavior.js – Global UI behaviors (smooth scroll, external links, etc.)
import { $, $$ } from '../../utils.js';

function initSmoothScroll() {
  document.addEventListener('click', e => {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function initExternalLinks() {
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="http"]');
    if (link && link.hostname !== location.hostname) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

function initLazyImages() {
  if ('loading' in HTMLImageElement.prototype) return;
  const images = $$('img[data-src]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  });
  images.forEach(img => observer.observe(img));
}

export function initBehavior() {
  initSmoothScroll();
  initExternalLinks();
  initLazyImages();
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBehavior);
} else {
  initBehavior();
}

// Add this at the end of behavior.js

/**
 * Initialize behavior tracking
 * @param {Object} options - Configuration options
 * @returns {Object} Tracking API
 */
export function initBehaviorTracking(options = {}) {
    console.log('[Behavior Tracking] Initialized with options:', options);
   
    // Track events
    const track = (event, data = {}) => {
        console.log(`[Behavior Track] ${event}:`, data);
        // Send to analytics if available
        if (typeof window.__psh_analytics !== 'undefined') {
            window.__psh_analytics.track(event, data);
        }
    };
   
    // Track page view
    const pageView = (page) => {
        track('page_view', { page, url: window.location.href });
    };
   
    // Track click
    const click = (element, label) => {
        track('click', { element: element?.tagName || 'unknown', label });
    };
   
    return {
        track,
        pageView,
        click
    };
}


// Also export as default for backward compatibility
export default initBehaviorTracking;






