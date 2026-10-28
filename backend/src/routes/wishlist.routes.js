// Wishlist routes - extracted, matching real handler signatures
export async function handleWishlistRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/wishlist' && method === 'GET') {
    const { handleGetWishlist } = await import('../handlers/wishlist.js');
    return handleGetWishlist(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/wishlist/add' && method === 'POST') {
    const { handleAddToWishlist } = await import('../handlers/wishlist.js');
    return handleAddToWishlist(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/wishlist\/remove\/[^\/]+$/) && method === 'DELETE') {
    const { handleRemoveFromWishlist } = await import('../handlers/wishlist.js');
    return handleRemoveFromWishlist(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/wishlist/clear' && method === 'POST') {
    const { handleClearWishlist } = await import('../handlers/wishlist.js');
    return handleClearWishlist(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/wishlist/stats' && method === 'GET') {
    const { handleWishlistStats } = await import('../handlers/wishlist.js');
    return handleWishlistStats(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/wishlist\/[^\/]+\/priority$/) && method === 'PUT') {
    const { handleUpdatePriority } = await import('../handlers/wishlist.js');
    return handleUpdatePriority(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/wishlist\/[^\/]+\/notes$/) && method === 'PUT') {
    const { handleUpdateNotes } = await import('../handlers/wishlist.js');
    return handleUpdateNotes(request, env, ctx, corsHeaders);
  }

  return null;
}
