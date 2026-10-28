// Thin router - all major domains modular
import { handleAuthRoutes } from './routes/auth.routes.js';
import { handlePaymentRoutes } from './routes/payment.routes.js';
import { handleCartRoutes } from './routes/cart.routes.js';
import { handleOrdersRoutes } from './routes/orders.routes.js';
import { handleReviewsRoutes } from './routes/reviews.routes.js';
import { handleStaffRoutes } from './routes/staff.routes.js';
import { handleAdminRoutes } from './routes/admin.routes.js';
import { handleWholesaleRoutes } from './routes/wholesale.routes.js';
import { handleNotificationsRoutes } from './routes/notifications.routes.js';
import { handleProductsRoutes } from './routes/products.routes.js';
import { handleChatRoutes } from './routes/chat.routes.js';
import { handleChargingRoutes } from './routes/charging.routes.js';
import { handleCategoriesRoutes } from './routes/categories.routes.js';
import { handleWishlistRoutes } from './routes/wishlist.routes.js';
import { handleSecurityRoutes } from './routes/security.routes.js';
import { handleAnomaliesRoutes } from './routes/anomalies.routes.js';
import { handleCustomerRoutes } from './routes/customer.routes.js';
import { handleProfileRoutes } from './routes/profile.routes.js';
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

  const staffResult = await handleStaffRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (staffResult) return staffResult;

  const adminResult = await handleAdminRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (adminResult) return adminResult;

  const wholesaleResult = await handleWholesaleRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (wholesaleResult) return wholesaleResult;

  const notificationsResult = await handleNotificationsRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (notificationsResult) return notificationsResult;

  const productsResult = await handleProductsRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (productsResult) return productsResult;

  const chatResult = await handleChatRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (chatResult) return chatResult;

  const chargingResult = await handleChargingRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (chargingResult) return chargingResult;

  const categoriesResult = await handleCategoriesRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (categoriesResult) return categoriesResult;

  const wishlistResult = await handleWishlistRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (wishlistResult) return wishlistResult;

  const securityResult = await handleSecurityRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (securityResult) return securityResult;

  const anomaliesResult = await handleAnomaliesRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (anomaliesResult) return anomaliesResult;

  const customerResult = await handleCustomerRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (customerResult) return customerResult;

  const profileResult = await handleProfileRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo);
  if (profileResult) return profileResult;

  // Fall back to legacy handler for all remaining routes
  const { handleRequest } = await import('./legacy-handler.js');
  return handleRequest(request, env, ctx);
}
