// Orders routes - extracted, matching real handler signatures
export async function handleOrdersRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/orders' && method === 'GET') {
    const { handleGetOrders } = await import('../handlers/orders.js');
    return handleGetOrders(request, env, corsHeaders, requestInfo);
  }

  if (routePath === '/api/orders' && method === 'POST') {
    const { handleCreateOrder } = await import('../handlers/orders.js');
    return handleCreateOrder(request, env, corsHeaders, ip, fingerprint);
  }

  if (routePath.match(/^\/api\/orders\/[^\/]+\/tracking$/) && method === 'GET') {
    const { handleOrderTracking } = await import('../handlers/orders.js');
    return handleOrderTracking(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/orders\/[^\/]+\/notify$/) && method === 'POST') {
    const { handleOrderNotify } = await import('../handlers/orders.js');
    return handleOrderNotify(request, env, corsHeaders);
  }

  if (routePath.match(/^\/api\/orders\/[^\/]+\/status$/) && method === 'PUT') {
    const { handleOrderStatusUpdate } = await import('../handlers/orders.js');
    return handleOrderStatusUpdate(request, env, corsHeaders);
  }

  return null;
}
