// Cart routes - extracted, matching real handler signatures
export async function handleCartRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/cart' && method === 'GET') {
    const { handleGetCart } = await import('../handlers/cart.js');
    return handleGetCart(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/cart/add' && method === 'POST') {
    const { handleAddToCart } = await import('../handlers/cart.js');
    return handleAddToCart(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/cart\/update\/[^\/]+$/) && method === 'PUT') {
    const { handleUpdateCartItem } = await import('../handlers/cart.js');
    return handleUpdateCartItem(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/cart\/remove\/[^\/]+$/) && method === 'DELETE') {
    const { handleRemoveFromCart } = await import('../handlers/cart.js');
    return handleRemoveFromCart(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/cart/clear' && method === 'POST') {
    const { handleClearCart } = await import('../handlers/cart.js');
    return handleClearCart(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/cart/sync' && method === 'POST') {
    const { handleSyncCart } = await import('../handlers/cart.js');
    return handleSyncCart(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/cart/stats' && method === 'GET') {
    const { handleCartStats } = await import('../handlers/cart.js');
    return handleCartStats(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/cart/discount' && method === 'POST') {
    const { handleApplyDiscount } = await import('../handlers/cart.js');
    return handleApplyDiscount(request, env, ctx, corsHeaders);
  }

  return null;
}
