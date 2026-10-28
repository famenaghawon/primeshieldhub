// Payment routes - extracted, matching real handler signatures exactly
// Do not change call order or arguments

export async function handlePaymentRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  // Payment intent / initialize (most common path)
  if (routePath === '/api/payment/initialize' && method === 'POST') {
    const { handlePaymentIntent } = await import('../handlers/payment.js');
    return handlePaymentIntent(request, env, ctx, corsHeaders, requestInfo);
  }

  // Integrity token
  if (routePath === '/api/payment/integrity' && method === 'POST') {
    const { handleIntegrityToken } = await import('../handlers/payment.js');
    return handleIntegrityToken(request, env, corsHeaders, requestInfo);
  }

  // Checkout token
  if (routePath === '/api/payment/checkout-token' && method === 'POST') {
    const { handleCheckoutToken } = await import('../handlers/payment.js');
    return handleCheckoutToken(request, env, corsHeaders);
  }

  // Payment verification (GET)
  if (routePath.startsWith('/api/payment/verify') && method === 'GET') {
    const { handlePaymentVerify } = await import('../handlers/payment-verify.js');
    return handlePaymentVerify(request, env, ctx);
  }

  // Paystack webhook
  if (routePath.startsWith('/api/webhook/paystack') && method === 'POST') {
    const { handlePaystackWebhook } = await import('../handlers/webhook.js');
    return handlePaystackWebhook(request, env, ctx);
  }

  // Webhook OPTIONS preflight
  if (routePath.startsWith('/api/webhook/paystack') && method === 'OPTIONS') {
    const { handleWebhookOptions } = await import('../handlers/webhook.js');
    return handleWebhookOptions(request);
  }

  return null;
}
