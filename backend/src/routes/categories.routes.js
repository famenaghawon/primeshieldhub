// Categories routes - extracted, matching real handler signatures
export async function handleCategoriesRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/categories' && method === 'GET') {
    const { handleGetCategories } = await import('../handlers/categories.js');
    return handleGetCategories(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/categories/tree' && method === 'GET') {
    const { handleGetCategoryTree } = await import('../handlers/categories.js');
    return handleGetCategoryTree(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/categories\/[^\/]+$/) && method === 'GET') {
    const { handleGetCategory } = await import('../handlers/categories.js');
    return handleGetCategory(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/categories' && method === 'POST') {
    const { handleCreateCategory } = await import('../handlers/categories.js');
    return handleCreateCategory(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/categories\/[^\/]+$/) && method === 'PUT') {
    const { handleUpdateCategory } = await import('../handlers/categories.js');
    return handleUpdateCategory(request, env, ctx, corsHeaders);
  }

  if (routePath.match(/^\/api\/categories\/[^\/]+$/) && method === 'DELETE') {
    const { handleDeleteCategory } = await import('../handlers/categories.js');
    return handleDeleteCategory(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/categories/stats' && method === 'GET') {
    const { handleCategoryStats } = await import('../handlers/categories.js');
    return handleCategoryStats(request, env, ctx, corsHeaders);
  }

  return null;
}
