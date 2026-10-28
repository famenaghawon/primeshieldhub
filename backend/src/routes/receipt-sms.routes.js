// Receipt SMS routes - extracted, matching real handler signatures
export async function handleReceiptSmsRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/receipt/sms' && method === 'POST') {
    const { handleReceiptSMS } = await import('../handlers/receipt-sms.js');
    return handleReceiptSMS(request, env, ctx);
  }

  if (routePath === '/api/receipt/sms' && method === 'OPTIONS') {
    const { handleReceiptSMSOptions } = await import('../handlers/receipt-sms.js');
    return handleReceiptSMSOptions(request);
  }

  return null;
}
