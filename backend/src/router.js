// Thin router - auth + payment + cart + orders + reviews modular
import { handleAuthRoutes } from './routes/auth.routes.js';
import { handlePaymentRoutes } from './routes/payment.routes.js';
import { handleCartRoutes } from './routes/cart.routes.js';
import { handleOrdersRoutes } from './routes/orders.routes.js';
import { handleReviewsRoutes } from './routes/reviews.routes.js';
import { getCorsHeaders } from './middleware/cors.js';

export async function routeRequest(request, env, ctx) {
  const url = new URL(request.url);
  const routePath = url.pathname;
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const fingerprint = request.headers.get('x-device-fingerprint') || 'none';
  const requestInfo = {
    ip,
    path: routePath,
    method: request.method,
    userAgent: request.headers.get('user-agent') || '',
    origin: origin || '',
    fingerprint,
  };

  // Modular routes first
  const authResult = await handleAuthRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (authResult) return authResult;

  const paymentResult = await handlePaymentRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (paymentResult) return paymentResult;

  const cartResult = await handleCartRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (cartResult) return cartResult;

  const ordersResult = await handleOrdersRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (ordersResult) return ordersResult;

  const reviewsResult = await handleReviewsRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (reviewsResult) return reviewsResult;

  // Fall back to legacy handler for all remaining routes
  const { handleRequest } = await import('./legacy-handler.js');
  return handleRequest(request, env, ctx);
}
