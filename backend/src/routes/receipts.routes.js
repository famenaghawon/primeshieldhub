// Receipts routes - extracted, matching real handler signatures
export async function handleReceiptsRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath.match(/^\/api\/receipt\/download\/[^\/]+$/) && method === 'GET') {
    const { handleReceiptDownload } = await import('../handlers/receipts.js');
    return handleReceiptDownload(request, env, ctx);
  }

  if (routePath.match(/^\/api\/receipt\/download\/[^\/]+$/) && method === 'OPTIONS') {
    const { handleReceiptDownloadOptions } = await import('../handlers/receipts.js');
    return handleReceiptDownloadOptions(request);
  }

  if (routePath.match(/^\/api\/receipt\/ref\/[^\/]+$/) && method === 'GET') {
    const { handleReceiptByReference } = await import('../handlers/receipts.js');
    return handleReceiptByReference(request, env, ctx);
  }

  if (routePath.match(/^\/api\/receipt\/ref\/[^\/]+$/) && method === 'OPTIONS') {
    const { handleReceiptByRefOptions } = await import('../handlers/receipts.js');
    return handleReceiptByRefOptions(request);
  }

  return null;
}
