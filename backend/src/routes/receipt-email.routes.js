// Receipt email routes - extracted, matching real handler signatures
export async function handleReceiptEmailRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/receipt/email' && method === 'POST') {
    const { handleReceiptEmail } = await import('../handlers/receipt-email.js');
    return handleReceiptEmail(request, env, ctx);
  }

  if (routePath === '/api/receipt/email' && method === 'OPTIONS') {
    const { handleReceiptEmailOptions } = await import('../handlers/receipt-email.js');
    return handleReceiptEmailOptions(request);
  }

  return null;
}
