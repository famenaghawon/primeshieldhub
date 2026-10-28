// Thin router - auth + payment modular, everything else falls back to legacy
import { handleAuthRoutes } from './routes/auth.routes.js';
import { handlePaymentRoutes } from './routes/payment.routes.js';
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

  // Fall back to legacy handler for all remaining routes
  const { handleRequest } = await import('./legacy-handler.js');
  return handleRequest(request, env, ctx);
}
