// Receipt WhatsApp routes - extracted, matching real handler signatures
export async function handleReceiptWhatsappRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/receipt/whatsapp' && method === 'POST') {
    const { handleReceiptWhatsApp } = await import('../handlers/receipt-whatsapp.js');
    return handleReceiptWhatsApp(request, env, ctx);
  }

  if (routePath === '/api/receipt/whatsapp' && method === 'OPTIONS') {
    const { handleReceiptWhatsAppOptions } = await import('../handlers/receipt-whatsapp.js');
    return handleReceiptWhatsAppOptions(request);
  }

  return null;
}
