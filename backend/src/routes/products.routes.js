// Products routes - extracted, matching real handler signatures
export async function handleProductsRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/products' && method === 'GET') {
    const { handleGetProducts } = await import('../handlers/products.js');
    return handleGetProducts(request, env, corsHeaders, requestInfo);
  }

  if (routePath === '/api/products' && method === 'POST') {
    const { handleCreateProduct } = await import('../handlers/products.js');
    return handleCreateProduct(request, env, corsHeaders, ip, fingerprint);
  }

  if (routePath.match(/^\/api\/products\/[^\/]+$/) && method === 'PUT') {
    const { handleUpdateProduct } = await import('../handlers/products.js');
    return handleUpdateProduct(request, env, corsHeaders, ip, fingerprint);
  }

  if (routePath.match(/^\/api\/products\/[^\/]+$/) && method === 'DELETE') {
    const { handleDeleteProduct } = await import('../handlers/products.js');
    return handleDeleteProduct(request, env, corsHeaders, ip, fingerprint);
  }

  return null;
}
