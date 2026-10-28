// Branch routes - extracted, matching real handler signatures
export async function handleBranchRoutes(request, env, ctx, routePath, corsHeaders, ip, fingerprint, requestInfo) {
  const method = request.method;

  if (routePath === '/api/branches' && method === 'GET') {
    const { handleGetBranches } = await import('../handlers/branch.js');
    return handleGetBranches(request, env, ctx, corsHeaders);
  }

  if (routePath === '/api/branches' && method === 'POST') {
    const { handleCreateBranch } = await import('../handlers/branch.js');
    return handleCreateBranch(request, env, ctx, corsHeaders, ip, fingerprint);
  }

  if (routePath.match(/^\/api\/branches\/[^\/]+$/) && method === 'GET') {
    const { handleGetBranch } = await import('../handlers/branch.js');
    return handleGetBranch(request, env, ctx, corsHeaders);
  }

  return null;
}
