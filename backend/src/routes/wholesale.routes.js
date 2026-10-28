// Wholesale routes - extracted, matching real handler signatures
export async function handleWholesaleRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/wholesale/verify' && method === 'POST') {
    const { handleWholesaleVerifyCode } = await import('../handlers/wholesale.js');
    return handleWholesaleVerifyCode(request, env, corsHeaders);
  }

  if (routePath === '/api/wholesale/request-access' && method === 'POST') {
    const { handleWholesaleRequestAccess } = await import('../handlers/wholesale.js');
    return handleWholesaleRequestAccess(request, env, corsHeaders);
  }

  if (routePath === '/api/wholesale/products' && method === 'GET') {
    const { handleWholesaleProducts } = await import('../handlers/wholesale.js');
    return handleWholesaleProducts(request, env, corsHeaders, requestInfo);
  }

  if (routePath === '/api/wholesale/quote' && method === 'POST') {
    const { handleWholesaleRequestQuote } = await import('../handlers/wholesale.js');
    return handleWholesaleRequestQuote(request, env, corsHeaders);
  }

  if (routePath === '/api/admin/wholesale/requests' && method === 'GET') {
    const { handleAdminWholesaleRequests } = await import('../handlers/wholesale.js');
    return handleAdminWholesaleRequests(request, env, corsHeaders);
  }

  if (routePath.match(/^\/api\/admin\/wholesale\/requests\/[^\/]+$/) && method === 'PUT') {
    const { handleAdminUpdateWholesaleRequest } = await import('../handlers/wholesale.js');
    return handleAdminUpdateWholesaleRequest(request, env, corsHeaders);
  }

  return null;
}
